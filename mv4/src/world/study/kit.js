// 文房模块共用的小工具：可复现的随机数和噪声、常用的几何做法（车削、放样、粗细渐变的管子）、
// 柔和的器物材质（釉、石、木、竹都在片元里按物体坐标现算纹理，近看不糊）、画贴图的画布。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rnd, TAU } from '../../anim.js';
import { DESK, PAL } from '../layout.js';

export const TOP = DESK.top;                                       // 书案台面的高度，器物都立在这上面
export const V3 = THREE.Vector3;
export const KAI = '"Kaiti SC", STKaiti, KaiTi, "Songti SC", serif';   // 写字用系统自带的楷体

// 一串可复现的随机数：同一个种子永远给出同一串
export const stream = seed => { let i = 0; return () => rnd(seed * 91.73 + (i++) * 1.3713); };
export const pick = (r, a, b) => a + (b - a) * r();
export const smooth = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };

// 格点噪声（值噪声），二维、三维通用；fbm 叠几层，ridge 是带棱线的版本（用来做山的沟壑、树皮）
const lattice = (x, y, z) => rnd(x * 157.31 + y * 311.7 + z * 74.7 + 11.3);
export function noise(x, y = 0, z = 0) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const s = v => v * v * (3 - 2 * v), fx = s(x - ix), fy = s(y - iy), fz = s(z - iz);
  const at = (a, b, c) => lattice(ix + a, iy + b, iz + c), mix = (a, b, k) => a + (b - a) * k;
  return mix(mix(mix(at(0, 0, 0), at(1, 0, 0), fx), mix(at(0, 1, 0), at(1, 1, 0), fx), fy),
    mix(mix(at(0, 0, 1), at(1, 0, 1), fx), mix(at(0, 1, 1), at(1, 1, 1), fx), fy), fz);
}
export function fbm(x, y = 0, z = 0, octaves = 4) {
  let sum = 0, amp = .5;
  for (let i = 0; i < octaves; i++) { sum += amp * noise(x, y, z); x = x * 2.03 + 7.1; y = y * 2.03 + 3.7; z = z * 2.03 + 5.3; amp *= .5; }
  return sum;
}
export function ridge(x, y = 0, z = 0, octaves = 4) {
  let sum = 0, amp = .5;
  for (let i = 0; i < octaves; i++) { sum += amp * (1 - Math.abs(2 * noise(x, y, z) - 1)); x = x * 2.03 + 7.1; y = y * 2.03 + 3.7; z = z * 2.03 + 5.3; amp *= .5; }
  return sum;
}

// —— 几何 ——
// 把几个几何体并成一个。各自带的属性不一样时，只留大家都有的
export function merge(geos) {
  const flat = geos.map(g => (g.index ? g.toNonIndexed() : g.clone()));
  const names = Object.keys(flat[0].attributes).filter(n => flat.every(g => g.attributes[n]));
  flat.forEach(g => Object.keys(g.attributes).forEach(n => names.includes(n) || g.deleteAttribute(n)));
  return mergeGeometries(flat, false);
}
// 给几何体做位移、旋转（返回自身，方便连着写）
export const moved = (geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
  if (rx) geo.rotateX(rx); if (ry) geo.rotateY(ry); if (rz) geo.rotateZ(rz);
  return geo.translate(x, y, z);
};

// 车削：runs 是若干段轮廓，每段是 [半径, 高度] 的列表。段内用样条拉顺，段与段的接头保留棱线（接头处的点要重复给一次）
export function turn(runs, segs = 96, perSpan = 7) {
  const pts = [];
  for (const run of runs) {
    const src = run.map(([r, y]) => new THREE.Vector2(Math.max(r, 0), y));
    pts.push(...(src.length > 2 ? new THREE.SplineCurve(src).getPoints((src.length - 1) * perSpan) : src));
  }
  pts.forEach(p => { p.x = Math.max(p.x, 0); });
  return new THREE.LatheGeometry(pts, segs);
}

// 车削，但轮廓按弧长均匀取点：贴图的纵向坐标正比于沿轮廓走过的长度，方便在器身上按位置画纹饰。返回几何体和各点的 [半径, 高度]
export function turnEven(profile, segs = 96, count = 160) {
  const dense = new THREE.SplineCurve(profile.map(([r, y]) => new THREE.Vector2(r, y))).getPoints(count * 6), acc = [0];
  for (let i = 1; i < dense.length; i++) acc.push(acc[i - 1] + dense[i].distanceTo(dense[i - 1]));
  const pts = [];
  for (let i = 0, j = 0; i <= count; i++) {
    const want = acc[acc.length - 1] * i / count;
    while (j < dense.length - 2 && acc[j + 1] < want) j++;
    pts.push(dense[j].clone().lerp(dense[j + 1], Math.min(1, (want - acc[j]) / Math.max(1e-6, acc[j + 1] - acc[j]))));
  }
  return { geo: new THREE.LatheGeometry(pts, segs), pts: pts.map(p => [p.x, p.y]) };
}
// 在车削出来的器身上做浮雕：relief(绕轴的角度, 高度, 贴图纵坐标) 返回这一点沿法线鼓出多少。做完重算法线，并把接缝两侧抹平。
// tint(同样的参数) 可以顺便给每个点一个颜色（例如凹处积釉、颜色深）
export function emboss(geo, relief, tint) {
  const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv, colors = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), a = uv.getX(i) * TAU, off = relief(a, y, uv.getY(i));
    pos.setXYZ(i, x + nor.getX(i) * off, y + nor.getY(i) * off, z + nor.getZ(i) * off);
    if (tint) { const c = tint(a, y, uv.getY(i), off); colors.push(c.r, c.g, c.b); }
  }
  if (tint) geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const rows = geo.parameters.points.length, last = geo.parameters.segments * rows, a = new V3(), b = new V3();
  for (let j = 0; j < rows; j++) {
    a.fromBufferAttribute(nor, j); b.fromBufferAttribute(nor, last + j); a.add(b).normalize();
    nor.setXYZ(j, a.x, a.y, a.z); nor.setXYZ(last + j, a.x, a.y, a.z);
  }
  return geo;
}

// 放样：沿一圈平面轮廓套一条剖面，做出底座、托盘这类非圆的器形。
// loop(k) 返回 [x, z]，k 从 0 到 1 绕一圈，绕向是从 +x 转向 +z；profile 是 [向外偏移, 高度] 的列表，外壁从上往下写
export function loft(loop, profile, n = 160) {
  const pos = [], idx = [], m = profile.length;
  for (let i = 0; i <= n; i++) {
    const k = i / n, [x, z] = loop(k), [xa, za] = loop(k - .002), [xb, zb] = loop(k + .002);
    const tx = xb - xa, tz = zb - za, tl = Math.hypot(tx, tz), nx = tz / tl, nz = -tx / tl;   // 轮廓朝外的法线
    for (const [off, y] of profile) pos.push(x + nx * off, y, z + nz * off);
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < m - 1; j++) {
    const a = i * m + j, b = a + m;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  const flat = geo.toNonIndexed();                                  // 剖面的折角要保留棱线，所以先拆开再按夹角重算法线
  flat.computeVertexNormals();
  return creased(flat, 40);
}
// 夹角小于 deg 的相邻面共用法线（圆顺），大于的保留棱线
export function creased(geo, deg) {
  const pos = geo.attributes.position, nor = geo.attributes.normal, cos = Math.cos(deg * Math.PI / 180), map = new Map();
  const key = i => `${Math.round(pos.getX(i) * 2e3)},${Math.round(pos.getY(i) * 2e3)},${Math.round(pos.getZ(i) * 2e3)}`;
  for (let i = 0; i < pos.count; i++) { const k = key(i); (map.get(k) ?? map.set(k, []).get(k)).push(i); }
  const out = new Float32Array(pos.count * 3), a = new V3(), b = new V3(), sum = new V3();
  for (const group of map.values()) for (const i of group) {
    a.fromBufferAttribute(nor, i); sum.set(0, 0, 0);
    for (const j of group) { b.fromBufferAttribute(nor, j); if (a.dot(b) > cos) sum.add(b); }
    sum.normalize().toArray(out, i * 3);
  }
  geo.setAttribute('normal', new THREE.BufferAttribute(out, 3));
  return geo;
}

// 粗细可变的管子：pts 中心线上的点，radii 各点的半径。bump(i, j, 沿线长度) 可以再乘一个起伏（树皮、绳股）。
// 贴图坐标：u 绕一圈，v 是沿线的长度
export function tube(pts, radii, sides = 8, { cap = true, bump } = {}) {
  const n = pts.length, pos = [], uv = [], idx = [], ring = sides + 1;
  const tan = pts.map((_, i) => new V3().subVectors(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)]).normalize());
  const N = Math.abs(tan[0].y) > .9 ? new V3(1, 0, 0) : new V3(0, 1, 0), B = new V3();
  let len = 0;
  for (let i = 0; i < n; i++) {
    if (i) len += pts[i].distanceTo(pts[i - 1]);
    N.addScaledVector(tan[i], -N.dot(tan[i])).normalize();           // 沿线把截面的朝向平移过去，管子不会拧
    B.crossVectors(tan[i], N);
    for (let j = 0; j <= sides; j++) {
      const a = j / sides * TAU, r = radii[i] * (bump ? bump(i, j % sides, len) : 1), c = Math.cos(a) * r, s = Math.sin(a) * r;
      pos.push(pts[i].x + N.x * c + B.x * s, pts[i].y + N.y * c + B.y * s, pts[i].z + N.z * c + B.z * s);
      uv.push(j / sides, len);
    }
  }
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < sides; j++) {
    const a = i * ring + j, b = a + ring;
    idx.push(a, a + 1, b, a + 1, b + 1, b);
  }
  if (cap) for (const [i, flip] of [[0, false], [n - 1, true]]) {
    const c = pos.length / 3;
    pos.push(pts[i].x, pts[i].y, pts[i].z); uv.push(.5, i ? len : 0);
    for (let j = 0; j < sides; j++) idx.push(c, ...(flip ? [i * ring + j, i * ring + j + 1] : [i * ring + j + 1, i * ring + j]));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const nor = geo.attributes.normal, a = new V3(), b = new V3();    // 接缝两侧是同一圈上的同一个点，法线取平均，看不出缝
  for (let i = 0; i < n; i++) {
    a.fromBufferAttribute(nor, i * ring); b.fromBufferAttribute(nor, i * ring + sides); a.add(b).normalize();
    nor.setXYZ(i * ring, a.x, a.y, a.z); nor.setXYZ(i * ring + sides, a.x, a.y, a.z);
  }
  return geo;
}

// 把一个正方形格子压成四角圆的矩形：(x, z) 在 ±w、±d 之内，rc 是圆角半径。砚台、墨锭这类方器的顶面用它排格子
export function roundRect(x, z, w, d, rc) {
  const dx = Math.max(0, Math.abs(x) - (w - rc)), dz = Math.max(0, Math.abs(z) - (d - rc));
  if (dx === 0 || dz === 0) return [x, z];
  const px = dx * Math.sqrt(1 - dz * dz / (2 * rc * rc)), pz = dz * Math.sqrt(1 - dx * dx / (2 * rc * rc));
  return [Math.sign(x) * (w - rc + px), Math.sign(z) * (d - rc + pz)];
}
// 高度场：在 nx × nz 的格子上，at(u, v)（u、v 从 -1 到 1）返回 [x, y, z]。贴图坐标是 (u, v) 映到 0..1
export function field(nx, nz, at) {
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const u = i / nx * 2 - 1, v = j / nz * 2 - 1;
    pos.push(...at(u, v)); uv.push(i / nx, 1 - j / nz);
  }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const a = j * (nx + 1) + i, b = a + nx + 1;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

export function mesh(geo, mat, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast; m.receiveShadow = receive;
  return m;
}

// —— 贴图 ——
export function canvasTex(w, h, draw, { color = true, repeat = false } = {}) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(cv);
  if (color) tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

// —— 材质 ——
// 片元里用的噪声：vnoise 值噪声，fbm 叠四层，crack 是细胞格的边界（0 在裂纹上，用来做开片、石纹）
export const NOISE = /* glsl */`
float h13(vec3 p){ p = fract(p * .1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
vec3 h33(vec3 p){ p = fract(p * vec3(.1031, .1030, .0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
float vnoise(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(mix(h13(i), h13(i + vec3(1,0,0)), f.x), mix(h13(i + vec3(0,1,0)), h13(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h13(i + vec3(0,0,1)), h13(i + vec3(1,0,1)), f.x), mix(h13(i + vec3(0,1,1)), h13(i + vec3(1,1,1)), f.x), f.y), f.z); }
float fbm(vec3 p){ float a = .5, s = 0.; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + 7.1; a *= .5; } return s; }
float crack(vec3 p){ vec3 i = floor(p), f = fract(p); float d1 = 8., d2 = 8.;
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
    vec3 g = vec3(x, y, z), r = g + h33(i + g) - f; float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
  return sqrt(d2) - sqrt(d1); }
// 一条细线：d 是到线的距离，w 是线宽。线比像素还细时自动变淡，远看不闪
float hair(float d, float w){ float px = fwidth(d) + 1e-5; return (1. - smoothstep(w, w + px, d)) * min(1., w / px * 1.6); }
`;
const BUMP = /* glsl */`
vec3 bumpN(vec3 N, float h, float amt){
  vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition), r1 = cross(dpy, N), r2 = cross(N, dpx);
  float det = dot(dpx, r1); vec3 g = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2);
  return normalize(abs(det) * N - amt * g); }
`;
// 柔和的器物材质。在标准材质上加三样：
//   albedo：一段片元代码，按物体坐标 p 现算颜色 col（还可以写 gBump 起伏高度、gRough 粗糙度倍数、gGlow 自发的微光）
//   bump：gBump 的起伏强度
//   rim：边缘一圈柔和的冷色泛光，替代硬高光，让瓷和玉显得温润
//   ownNormal：双面的细带子（笔毛）不按正反面翻转法线，一律用几何体自己给的法线
//   head：加在片元程序开头的声明（自己的 uniform 等），uniforms 是它们的值
// 其他参数原样交给 MeshStandardMaterial
export function soft({ albedo = '', head = '', bump = 0, rim = .25, rimColor = PAL.mist, rimPow = 3, ownNormal = false, uniforms = {}, ...params }) {
  const mat = new THREE.MeshStandardMaterial(params);
  const own = { uRim: { value: new THREE.Color(rimColor).multiplyScalar(rim) }, uRimPow: { value: rimPow }, uBump: { value: bump }, ...uniforms };
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, own);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvP = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vP; uniform vec3 uRim; uniform float uRimPow, uBump;\nfloat gBump = 0., gRough = 1.; vec3 gGlow = vec3(0.);\n${NOISE}${BUMP}${head}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n{ vec3 p = vP; vec3 col = diffuseColor.rgb;\n${albedo}\ndiffuseColor.rgb = col; }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor * gRough, .05, 1.);')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${ownNormal ? 'normal = normalize(vNormal);' : ''}\nif (uBump > 0.) normal = bumpN(normal, gBump, uBump);`)
      .replace('#include <opaque_fragment>', 'outgoingLight += gGlow + uRim * pow(1. - saturate(dot(normal, normalize(vViewPosition))), uRimPow);\n#include <opaque_fragment>');
  };
  mat.customProgramCacheKey = () => `study|${ownNormal}|${head}|${albedo}`;
  return mat;
}
