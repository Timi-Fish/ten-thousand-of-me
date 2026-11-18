// 软体变形：把「没变形的身体坐标」里的一个点搬到变形后的位置。
// 同一套算式写两遍：SOFT_GLSL 在显卡上逐顶点算（身体、衣服、头饰都走它）；warp() 在这边算，给小短手、嘴的位置这些要跟着身体走的东西用。
// 两边必须保持一致，改一处要改另一处。
import { BW, BH, BD } from './pose.js';

const CY = .72, HX = BW / 2, HY = BH / 2, HZ = BD / 2;          // 身体中心的高度、三个方向的半长
const BALL = [.99, .9, .88];                                    // 鼓成球时三个方向的半径（体积和方的时候差不多）
const TILT = .7;                                                // 身体弯的时候，横截面跟着脊线倾斜多少

// 每只小蟹自己的一组变形量：
//   sq   = [纵向比例, 横向比例, 底部鼓出, 圆成球的程度]
//   wave = [二阶波纹, 三阶波纹, 上半截扭转（弧度）, 瘪下去]
//   bend = [上半截落后 x, z, S 形弯 x, z]
//   pull = [被扯出的位移 x, y, z, 影响范围（1 / 半径²）]，pullAt = 扯的那个点
export const SOFT_GLSL = /* glsl */`
uniform vec4 uSq, uWave, uBend, uPull;
uniform vec3 uPullAt;
float pullGain = 1.0;     // 这个顶点被牵时跟着走几成：皮肤全跟，衣服和头饰只跟一点（由调用方按顶点设）
vec3 deform(vec3 p) {
  float h = clamp(p.y / ${BH.toFixed(3)}, -0.1, 1.3);
  // 鼓气：从身体中心看出去，方的角收一点、平的面鼓一点，整体趋向一个球
  vec3 d = p - vec3(0.0, ${CY}, 0.0);
  vec3 e = abs(d) / vec3(${HX}, ${HY}, ${HZ}) + 1e-5, g = d / vec3(${BALL.join(', ')});
  float boxy = pow(e.x * e.x * e.x + e.y * e.y * e.y + e.z * e.z * e.z, 1.0 / 3.0), orb = length(g) + 1e-5;
  d *= mix(1.0, boxy / orb, uSq.w);
  // 横向比例随高度变：压扁时底部鼓出去，落地后的波纹沿着身体走，瘪的时候腰先塌
  float k = 1.0 - h, fade = 1.0 - 0.6 * clamp(h, 0.0, 1.0);        // 波纹越往头顶越弱，脸不至于被挤歪
  float lat = uSq.y * (1.0 + uSq.z * (k * k - 0.3333) + (uWave.x * cos(6.2832 * h) + uWave.y * cos(9.4248 * h)) * fade - uWave.w * sin(3.1416 * clamp(h, 0.0, 1.0)));
  d.xz *= lat;
  // 上半截跟着转身慢半拍
  float a = uWave.z * h * h, ca = cos(a), sa = sin(a);
  d.xz = vec2(ca * d.x + sa * d.z, ca * d.z - sa * d.x);
  // 弯：上半截落后（越往上越多），外加一个 S 形；横截面跟着脊线倾斜
  float s1 = sin(3.1416 * h);
  vec2 off = uBend.xy * h * h + uBend.zw * s1 * h;
  vec2 slope = (uBend.xy * 2.0 * h + uBend.zw * (3.1416 * cos(3.1416 * h) * h + s1)) / ${BH.toFixed(3)};
  vec3 q = vec3(d.x + off.x, (d.y + ${CY}) * uSq.x - dot(d.xz, slope) * ${TILT}, d.z + off.y);
  // 被牵：离牵点越近，被扯得越远
  vec3 r = q - uPullAt;
  return q + uPull.xyz * (pullGain * exp(-dot(r, r) * uPull.w));
}
// 变形后的法线：量出这一点附近被拉成了什么样，再把法线按它转过去
vec3 deformNormal(vec3 p, vec3 n, vec3 moved) {
  const float E = 0.01;
  vec3 jx = deform(p + vec3(E, 0.0, 0.0)) - moved, jy = deform(p + vec3(0.0, E, 0.0)) - moved, jz = deform(p + vec3(0.0, 0.0, E)) - moved;
  return normalize(cross(jy, jz) * n.x + cross(jz, jx) * n.y + cross(jx, jy) * n.z);
}`;

// 和上面同一套算式（被牵按皮肤算，全跟）。u：{ sq, wave, bend, pull, pullAt }，都是数组
export function warp(p, u) {
  const { sq, wave, bend, pull, pullAt } = u, h = Math.min(1.3, Math.max(-.1, p[1] / BH));
  let dx = p[0], dy = p[1] - CY, dz = p[2];
  const ex = Math.abs(dx) / HX + 1e-5, ey = Math.abs(dy) / HY + 1e-5, ez = Math.abs(dz) / HZ + 1e-5;
  const boxy = Math.cbrt(ex ** 3 + ey ** 3 + ez ** 3), orb = Math.hypot(dx / BALL[0], dy / BALL[1], dz / BALL[2]) + 1e-5, f = 1 + (boxy / orb - 1) * sq[3];
  dx *= f; dy *= f; dz *= f;
  const k = 1 - h, h01 = Math.min(1, Math.max(0, h)), fade = 1 - .6 * h01;
  const lat = sq[1] * (1 + sq[2] * (k * k - .3333) + (wave[0] * Math.cos(6.2832 * h) + wave[1] * Math.cos(9.4248 * h)) * fade - wave[3] * Math.sin(3.1416 * h01));
  dx *= lat; dz *= lat;
  const a = wave[2] * h * h, ca = Math.cos(a), sa = Math.sin(a), tx = ca * dx + sa * dz, tz = ca * dz - sa * dx;
  const s1 = Math.sin(3.1416 * h), c1 = 3.1416 * Math.cos(3.1416 * h) * h + s1;
  const ox = bend[0] * h * h + bend[2] * s1 * h, oz = bend[1] * h * h + bend[3] * s1 * h;
  const mx = (bend[0] * 2 * h + bend[2] * c1) / BH, mz = (bend[1] * 2 * h + bend[3] * c1) / BH;
  const q = [tx + ox, (dy + CY) * sq[0] - (tx * mx + tz * mz) * TILT, tz + oz];
  const r = [q[0] - pullAt[0], q[1] - pullAt[1], q[2] - pullAt[2]], w = Math.exp(-(r[0] ** 2 + r[1] ** 2 + r[2] ** 2) * pull[3]);
  return [q[0] + pull[0] * w, q[1] + pull[1] * w, q[2] + pull[2] * w];
}
// 身体上一点 p 变形后的落脚架：位置，和三个方向各被拉成了多长、朝哪（给贴在身上的硬东西定位）
export function frameAt(p, u) {
  const E = .02, o = warp(p, u), axis = i => { const q = [...p]; q[i] += E; const w = warp(q, u); return [(w[0] - o[0]) / E, (w[1] - o[1]) / E, (w[2] - o[2]) / E]; };
  return { at: o, x: axis(0), y: axis(1), z: axis(2) };
}
