// 岸：一道伸进海里的矶头（小蟹站在它的尖上），右手边一小湾沙滩，身后是起伏的岸坡；海里散着几块礁。
// 地面是一张高度场：沙滩和海底是一个平缓的剖面，礁石是一块块「石块」并起来的——
//   每块石头是一个凸的多面体的上表面：一个略斜的顶面，加上五到七个陡峭的侧面（各自的方位、远近、陡缓不同），取其中最低的那个。
//   所以石头有国画山石那样一块一块的面（斧劈皴的块面），顶上平、侧面陡，几块挤在一起就有了层次。
// 近处一张细网格（0.25 一格），远处一张粗网格垫在下面一直铺到天边；海底的高度另烘成一张贴图，交给海面算水深。
import * as THREE from 'three';
import { rnd } from '../anim.js';
import { fbm, smooth, clamp } from './noise.js';

// 小蟹站的那块石头：顶面平，高 3.3
export const STAND = { x: 0, z: -5.6, y: 3.3 };

// [中心 x, 中心 z, 半径, 顶高, 顶面朝 x、z 的斜度, 侧面数, 侧面最缓, 最陡]
const BLOCKS = [
  [STAND.x, STAND.z, 2.2, STAND.y, 0, 0, 6, 3.2, 6.5],                              // 矶头的尖，小蟹站在上面
  [-1.4, -8.7, 2.3, 1.05, .02, -.07, 6, 1.4, 3.2],                                 // 尖前面伸进海里的一层矮台，浪先拍在这里
  [2.6, -7.6, 1.7, .55, .06, -.04, 5, 1.3, 2.8],
  [-2.7, -4.3, 1.9, 1.8, -.12, 0, 5, 1.8, 3.8],
  [.7, -2.0, 2.0, 3.6, .02, .05, 6, 2.4, 4.8],
  [2.5, 1.2, 2.4, 3.95, 0, .03, 6, 2, 4.2],
  [4.6, 4.8, 2.8, 4.4, .05, .05, 7, 1.7, 3.8],
  [1.6, 8.6, 3.3, 6.1, -.02, .06, 7, 1.5, 3.2],                                    // 矶头的根，最高，松长在这里
  [-2.6, 5.4, 2.5, 2.9, -.1, 0, 6, 1.5, 3],
  [5.5, -1.2, 1.5, 1.05, .06, 0, 5, 1.4, 2.8],
  [8.0, 8.4, 1.5, 2.1, .05, .06, 5, 1.6, 3],                                       // 沙滩上来的那一级
  [3.5, 3.0, 1.4, 4.0, 0, 0, 5, 2, 4],                                             // 矶头背上填住一道缝，路从上面过
  [-6.5, 10, 3.6, 5.2, -.05, .05, 7, 1.4, 3],                                      // 左边岸上的石坡
  [-12.5, 13.5, 4.2, 6.4, -.06, .05, 7, 1.3, 2.8],
  [-9.5, 4.5, 2.6, 2.3, -.08, -.03, 6, 1.3, 2.8],
  [-16, 7.5, 3, 2.8, -.05, 0, 6, 1.2, 2.6],
  [12.6, 6.4, 1.0, .75, 0, 0, 5, 1.4, 2.6],                                        // 沙滩上的散石
  [15.4, 8.6, .7, .55, 0, 0, 5, 1.4, 2.6],
  [10.4, 10.5, .8, .95, 0, 0, 5, 1.4, 2.6],
  [19, 3.4, 1.2, .5, 0, -.05, 5, 1.2, 2.4],                                        // 湾里半淹着的一块
  [-7.2, -12.5, 1.9, 2.7, -.04, -.02, 6, 2.2, 4.5],                                // 海里的礁
  [6.8, -13.5, 1.3, .9, 0, 0, 5, 1.5, 3],
  [-2.2, -18, 1.1, .3, 0, 0, 5, 1.2, 2.4],
  [-13, -6.5, 2.2, 1.4, 0, 0, 6, 1.6, 3.4],
  [28, -2, 2.4, 1.6, 0, 0, 6, 1.6, 3.4],                                           // 湾口另一侧的一组礁
  [31, 1.5, 1.8, 2.4, 0, 0, 6, 1.6, 3.4],
];
// 每块石头除了顶面和侧面，还有：
//   台阶——顶面的一侧落下去一级，石头才不像一块切平的糕；
//   石缝——一两道竖着劈开的 V 形缝（节理），一块石头分成几瓣。
// 小蟹站的那块（第一块）不加台阶和石缝，顶面保持平。
const SOLIDS = BLOCKS.map(([cx, cz, R, h, gx, gz, n, m0, m1], i) => {
  const r = k => rnd(i * 17.3 + k * 3.91 + .7), turn = r(1) * 6.283, sides = [], plain = i === 0;
  for (let j = 0; j < n; j++) {
    const a = turn + (j + .7 * (rnd(i * 13.1 + j * 3.7) - .5)) * 6.283 / n;
    sides.push([Math.cos(a), Math.sin(a), R * (.78 + .42 * rnd(i * 5.9 + j * 1.3)), m0 + (m1 - m0) * rnd(i * 3.3 + j * 9.1)]);
  }
  const steps = plain ? [] : [0, 1].filter(k => r(10 + k) < .75).map(k => {
    const a = r(20 + k) * 6.283;
    return [Math.cos(a), Math.sin(a), R * (r(30 + k) * .7 - .1), Math.min(h + 2, .3 + h * (.12 + .2 * r(40 + k)))];
  });
  const joints = plain ? [] : [0, 1].filter(k => k === 0 || r(50) < .5).map(k => {
    const a = r(60 + k) * 3.1416;
    return [Math.cos(a), Math.sin(a), (r(70 + k) - .5) * R, .2 + .25 * r(80 + k), .5 + h * .25 * r(90 + k)];
  });
  const tilt = plain ? 0 : .14;
  return { cx, cz, h, gx: gx + tilt * (r(2) - .5), gz: gz + tilt * (r(3) - .5), sides, steps, joints, round: plain ? .25 : .45 + .3 * r(4), reach: R * 1.25 + (h + 10) / m0, tone: rnd(i * 2.7 + .4) };
});
// 圆一点的取小：两个面相交的棱不是一刀切的，略带一点磨圆
const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * .25; };
// 一块石头在 (x, z) 处的高度
function solidAt(s, x, z) {
  const dx = x - s.cx, dz = z - s.cz;
  let y = s.h + s.gx * dx + s.gz * dz;
  for (const [cx, cz, r, m] of s.sides) y = smin(y, s.h + m * (r - dx * cx - dz * cz), s.round);
  for (const [cx, cz, r, drop] of s.steps) y = smin(y, s.h - drop + Math.max(0, 5 * (r - dx * cx - dz * cz)), .12);
  for (const [cx, cz, off, w, deep] of s.joints) {
    const d = Math.abs(dx * cz - dz * cx - off);
    if (d < w) y -= deep * (1 - d / w);
  }
  return y;
}

// 岸线：沙滩的水边在 z = coastZ(x)，两头往岸里退，所以右边是一个小湾，左边岸往后收
const coastZ = x => 7 + .006 * (x - 14) ** 2 + 5 * (fbm(x * .03 + 3, 1.7, 3) - .5);
// 沙滩、海底和岸坡的剖面：s 是离水边多远（正的往岸上）
function baseAt(x, z) {
  const s = z - coastZ(x);
  if (s < 0) return Math.max(s > -3 ? s * .1 : s > -14 ? -.3 + (s + 3) * .2 : -2.5 + (s + 14) * .26, -9);
  if (s < 7) return s * .1;
  const hill = smooth(8, 70, s) * (7 + 8 * fbm(x * .02 + 9, z * .02, 4)) + smooth(30, 160, s) * 22 * fbm(x * .008, z * .008 + 4, 3);
  return .7 + (s - 7) * .16 + hill;
}

// 地面在 (x, z) 处：沙滩剖面和各块石头里最高的那个；石头表面再加一点起伏（站的那块顶面不加，保持平）。
// 同时给出这里有几成是石头（沙和石的交界软一点）、和这块石头的色调
const out = { y: 0, rock: 0, tone: 0 };
function sampleGround(x, z) {
  const base = baseAt(x, z);
  let top = -99, tone = 0;
  for (const s of SOLIDS) {
    if (Math.abs(x - s.cx) > s.reach || Math.abs(z - s.cz) > s.reach) continue;
    const y = solidAt(s, x, z);
    if (y > top) { top = y; tone = s.tone; }
  }
  out.tone = tone;
  if (top < base - 1) { out.rock = 0; out.y = base; return out; }
  const calm = smooth(1.2, 2.2, Math.hypot(x - STAND.x, z - STAND.z));
  const rough = (fbm(x * .45, z * .45, 4) - .5) * .9 * calm + (fbm(x * 1.7 + 5, z * 1.7, 3) - .5) * .22 * calm;
  const rocky = top + rough;
  out.rock = smooth(-.06, .2, rocky - base);
  out.y = Math.max(base, rocky);
  return out;
}

// 一张网格：x0..x1、z0..z1，每格 step。drop：整张往下压多少（粗网格垫在细网格下面）。返回网格和每个顶点的高度
function grid(x0, x1, z0, z1, step, attrs) {
  const nx = Math.round((x1 - x0) / step), nz = Math.round((z1 - z0) / step), W = nx + 1, count = W * (nz + 1);
  const pos = new Float32Array(count * 3), extra = new Float32Array(count * 4), hs = new Float32Array(count), crease = new Float32Array(count);
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const k = j * W + i, x = x0 + i * step, z = z0 + j * step, g = sampleGround(x, z);
    pos[k * 3] = x; pos[k * 3 + 1] = g.y; pos[k * 3 + 2] = z; hs[k] = g.y;
    extra[k * 4] = g.rock; extra[k * 4 + 3] = g.tone;
  }
  attrs(hs, extra, W, nz + 1, step, pos, crease);
  const index = new Uint32Array(nx * nz * 6);
  let n = 0;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const a = j * W + i, b = a + W, c = b + 1, d = a + 1;
    index[n++] = a; index[n++] = b; index[n++] = d; index[n++] = b; index[n++] = c; index[n++] = d;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aGround', new THREE.BufferAttribute(extra, 4));
  geo.setAttribute('aCrease', new THREE.BufferAttribute(crease, 1));
  geo.setIndex(new THREE.BufferAttribute(index, 1));
  geo.computeVertexNormals();
  return { geo, hs, W, H: nz + 1, x0, z0, step };
}

// 凹处的暗和凸处的亮：拿这一点的高度和周围一圈的平均高度比（横竖各模糊一遍）
// 大的一圈（1.4 个单位）给凹处的暗；小的一圈（两格）找出面和面相交的棱：凸棱留白，凹的折线勾一道墨（crease）
function cavity(hs, extra, W, H, step, pos, crease) {
  const big = blurred(hs, W, H, Math.max(1, Math.round(1.4 / step))), small = blurred(hs, W, H, 2);
  for (let k = 0; k < hs.length; k++) {
    extra[k * 4 + 1] = clamp(1 + (hs[k] - big[k]) * .45, .35, 1);                 // 凹处暗
    extra[k * 4 + 2] = clamp((hs[k] - small[k]) * 6, 0, 1);                       // 凸起的棱
    crease[k] = clamp((small[k] - hs[k]) * 7, 0, 1);                              // 凹进去的折线
  }
}
function blurred(hs, W, H, r) {
  const tmp = new Float32Array(hs.length), blur = new Float32Array(hs.length);
  const pass = (src, dst, along) => {
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      let s = 0, c = 0;
      for (let d = -r; d <= r; d++) {
        const ii = along ? i + d : i, jj = along ? j : j + d;
        if (ii < 0 || jj < 0 || ii >= W || jj >= H) continue;
        s += src[jj * W + ii]; c++;
      }
      dst[j * W + i] = s / c;
    }
  };
  pass(hs, tmp, true); pass(tmp, blur, false);
  return blur;
}

export const FINE = { x0: -28, x1: 44, z0: -32, z1: 30, step: .25 };
const BED = { x0: -80, x1: 100, z0: -70, z1: 70, size: [480, 384] };

export function buildLand() {
  const fine = grid(FINE.x0, FINE.x1, FINE.z0, FINE.z1, FINE.step, cavity);
  // 粗网格：在细网格盖住的地方往下压 1.5，免得两张面打架；边上照常，接得上
  const coarse = grid(-520, 520, -120, 640, 4, (hs, extra, W, H, step, pos) => {
    for (let k = 0; k < hs.length; k++) {
      extra[k * 4 + 1] = 1;
      const x = pos[k * 3], z = pos[k * 3 + 2];
      if (x > FINE.x0 + 4 && x < FINE.x1 - 4 && z > FINE.z0 + 4 && z < FINE.z1 - 4) pos[k * 3 + 1] -= 1.5;
    }
  });
  // 海底的高度贴图（海面拿它算水深）：半浮点，线性插值
  const [bw, bh] = BED.size, bed = new Uint16Array(bw * bh);
  for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) {
    bed[j * bw + i] = THREE.DataUtils.toHalfFloat(sampleGround(BED.x0 + (i + .5) / bw * (BED.x1 - BED.x0), BED.z0 + (j + .5) / bh * (BED.z1 - BED.z0)).y);
  }
  const bedTex = new THREE.DataTexture(bed, bw, bh, THREE.RedFormat, THREE.HalfFloatType);
  bedTex.magFilter = bedTex.minFilter = THREE.LinearFilter; bedTex.needsUpdate = true;
  const bedRect = new THREE.Vector4(BED.x0, BED.z0, 1 / (BED.x1 - BED.x0), 1 / (BED.z1 - BED.z0));

  // 地面高度：细网格里按网格的三角形插值（和画出来的面一致，小蟹不会陷进去或浮起来），外面按公式
  const heightAt = (x, z) => {
    const fx = (x - fine.x0) / fine.step, fz = (z - fine.z0) / fine.step, i = Math.floor(fx), j = Math.floor(fz);
    if (i < 0 || j < 0 || i >= fine.W - 1 || j >= fine.H - 1) return sampleGround(x, z).y;
    const u = fx - i, v = fz - j, h = fine.hs, a = h[j * fine.W + i], b = h[(j + 1) * fine.W + i], c = h[(j + 1) * fine.W + i + 1], d = h[j * fine.W + i + 1];
    return u + v <= 1 ? a + (d - a) * u + (b - a) * v : c + (b - c) * (1 - u) + (d - c) * (1 - v);
  };
  return { fine: fine.geo, coarse: coarse.geo, bedTex, bedRect, heightAt };
}
