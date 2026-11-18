// 灯火模块各部分共用的东西：月光的方向、着色器里的噪声和「这一点有没有月光」的判断、旋转体的建法、画纹饰用的小画布。
import * as THREE from 'three';
import { WALL, MOON, SCREEN, DESK } from '../layout.js';

export const TOP = DESK.top;                                        // 书案台面的高度，器物都立在这上面
// 指向月亮的单位向量，和 lights.js 里那盏月光（平行光）的方向一致：光从 MOON 方向 60 远处照向表演区后方 6 个单位的地方
export const MOON_DIR = MOON.clone().normalize().multiplyScalar(60).add(new THREE.Vector3(0, 0, 6)).normalize();
export const MOON_TINT = new THREE.Color('#C9D2FF');
export const FLAME_TINT = new THREE.Color('#FFB45A');

const f = x => x.toFixed(4);                                        // 把数字写成着色器里的浮点字面量
const v3 = v => `vec3(${f(v.x)}, ${f(v.y)}, ${f(v.z)})`;
const screenX1 = Math.max(...SCREEN.panels.map(p => p.c[0] + p.w / 2)), screenZ = SCREEN.panels[0].c[2];

// 噪声：哈希、三维值噪声、分形叠加（NOISE）；细胞噪声的边界，画开片用（CELLS，要和 NOISE 一起用）
export const NOISE = /* glsl */`
float hash31(vec3 p) { p = fract(p * vec3(.1031, .1030, .0973)); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }
vec3 hash33(vec3 p) { p = fract(p * vec3(.1031, .1030, .0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
float vnoise(vec3 p) {
  vec3 i = floor(p), u = fract(p); u = u * u * (3. - 2. * u);
  return mix(mix(mix(hash31(i), hash31(i + vec3(1, 0, 0)), u.x), mix(hash31(i + vec3(0, 1, 0)), hash31(i + vec3(1, 1, 0)), u.x), u.y),
             mix(mix(hash31(i + vec3(0, 0, 1)), hash31(i + vec3(1, 0, 1)), u.x), mix(hash31(i + vec3(0, 1, 1)), hash31(i + vec3(1, 1, 1)), u.x), u.y), u.z);
}
float fbm(vec3 p) { float a = .5, s = 0.; for (int k = 0; k < 4; k++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= .5; } return s; }`;
export const CELLS = /* glsl */`
float cellEdge(vec3 p) {
  vec3 i = floor(p), u = fract(p); float d1 = 8., d2 = 8.;
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
    vec3 g = vec3(float(x), float(y), float(z)); float d = length(g + hash33(i + g) - u);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  return d2 - d1;
}`;

// 月光只从月洞窗进屋。beamMask(p)：从 p 逆着月光走回后墙，落在窗洞里才有光；途中撞上屏风的没有光。
// beamStreak(p, t)：窗外的梅枝把月光分成一道一道，条纹取在窗面上，随枝条轻摇缓慢变化。
export const BEAM = /* glsl */`
const vec3 MOON_DIR = ${v3(MOON_DIR)};
vec2 beamWindow(vec3 p) { return (p.xy + MOON_DIR.xy * ((p.z - ${f(WALL.z)}) / -MOON_DIR.z) - vec2(${f(WALL.window.c[0])}, ${f(WALL.window.c[1])})) / ${f(WALL.window.r)}; }
float beamMask(vec3 p) {
  float far = (p.z - ${f(WALL.z)}) / -MOON_DIR.z, soft = .07 + far * .0028;       // 离窗越远，光柱的边越虚
  float m = 1. - smoothstep(1. - soft * 2., 1. + soft, length(beamWindow(p)));
  vec2 h = p.xy + MOON_DIR.xy * ((p.z - ${f(screenZ)}) / -MOON_DIR.z);             // 这条光线经过屏风所在深度时的位置
  float blocked = step(${f(screenZ)}, p.z) * (1. - smoothstep(${f(screenX1 - .6)}, ${f(screenX1 + 1.4)}, h.x)) * (1. - smoothstep(${f(SCREEN.top - .6)}, ${f(SCREEN.top + .8)}, h.y));
  return m * (1. - blocked);
}
float beamStreak(vec3 p, float t) {
  vec2 q = beamWindow(p);
  vec2 k = vec2(dot(q, vec2(.9, .44)), dot(q, vec2(-.44, .9)));                   // 条纹顺着枝条的走向拉长：光被切成一片一片斜立的光幕
  float a = .65 * vnoise(vec3(k.x * 4.4 + t * .012, k.y * .6, t * .02)) + .35 * vnoise(vec3(k.x * 10. + 5., k.y * 1.2, 3. + t * .025));
  return smoothstep(.43, .57, a);
}`;

// 轮廓：一串 [半径, 高度] 控制点，中间夹 'c' 表示前一个点是棱（两侧各自光滑）。返回加密后的折线
export function profile(spec, step = .045) {
  const runs = [[]];
  for (const p of spec) {
    if (p === 'c') { const last = runs[runs.length - 1].at(-1); runs.push([last]); } else runs[runs.length - 1].push(p);
  }
  const out = [];
  runs.forEach((run, k) => {
    const pts = run.map(([r, y]) => new THREE.Vector2(r, y));
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += pts[i].distanceTo(pts[i - 1]);
    const n = Math.max(2, Math.ceil(len / step));
    const dense = pts.length > 2 ? new THREE.SplineCurve(pts).getPoints(n) : [pts[0], pts[1]];
    if (k > 0) dense[0] = dense[0].clone().lerp(dense[1], .04);        // 棱两侧各留一个几乎重合的点，法线就不会被抹圆
    out.push(...dense);
  });
  return out;
}

// 旋转体。pts 是 profile() 的结果，自外壁下端往上、翻过口沿、再沿内壁往下走，法线始终朝外。
// 贴图坐标 v 按轮廓的弧长铺开；另带一个 cavity：轮廓凹进去的地方为正（积锈、积釉），凸出来的棱为负（磨亮、釉薄）
export function lathe(pts, seg = 72) {
  const g = new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(Math.max(p.x, 0), p.y)), seg), n = pts.length;
  const arc = [0], turn = new Array(n).fill(0);
  for (let j = 1; j < n; j++) arc[j] = arc[j - 1] + pts[j].distanceTo(pts[j - 1]);
  for (let j = 1; j < n - 1; j++) {
    const a = pts[j].clone().sub(pts[j - 1]), b = pts[j + 1].clone().sub(pts[j]);
    if (a.length() > 1e-3 && b.length() > 1e-3) turn[j] = Math.atan2(a.x * b.y - a.y * b.x, a.dot(b));   // 向外鼓是正
  }
  const wide = turn.map((_, j) => { let s = 0, w = 0; for (let k = -4; k <= 4; k++) if (turn[j + k] !== undefined) { const q = 1 - Math.abs(k) / 5; s += turn[j + k] * q; w += q; } return s / w; });
  const cav = new Float32Array((seg + 1) * n), uv = g.attributes.uv;
  for (let i = 0; i <= seg; i++) for (let j = 0; j < n; j++) {
    cav[i * n + j] = THREE.MathUtils.clamp(-wide[j] * 5, -1, 1);
    uv.setY(i * n + j, arc[j] / arc[n - 1]);
  }
  g.setAttribute('cavity', new THREE.BufferAttribute(cav, 1));
  g.userData.vAt = (r, y) => {                                        // 轮廓上离 [r, y] 最近的那一点的 v，摆纹饰带用
    const at = new THREE.Vector2(r, y); let best = 0;
    for (let j = 0; j < n; j++) if (pts[j].distanceTo(at) < pts[best].distanceTo(at)) best = j;
    return arc[best] / arc[n - 1];
  };
  return g;
}

// 给不是旋转体的几何体补上 cavity（整体一个值），好和旋转体合并、共用材质
export function flatCavity(g, value = 0) {
  g.setAttribute('cavity', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(value), 1));
  return g;
}

// 小画布：draw(ctx, w, h) 在上面画，画完整张柔化 soften 个像素，返回可横向重复的贴图。
// 画布在内存里绘制（willReadFrequently）：大画布交给显卡画再读回来，会拖住显卡进程，页面的 WebGL 会因此掉线
export function canvasTexture(w, h, draw, soften = 0, repeatX = 1) {
  const make = () => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; return cv; };
  let cv = make();
  draw(cv.getContext('2d', { willReadFrequently: true }), w, h);
  if (soften > 0) {
    const soft = make(), c = soft.getContext('2d', { willReadFrequently: true });
    c.filter = `blur(${soften}px)`; c.drawImage(cv, 0, 0); cv = soft;
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = THREE.RepeatWrapping; tex.repeat.x = repeatX; tex.anisotropy = 8;
  return tex;
}

// 所有自写着色器的结尾：色调映射和色彩空间交给 three 按当前渲染目标处理，直接出画面或进后期都对
export const OUTPUT = /* glsl */`
#include <tonemapping_fragment>
#include <colorspace_fragment>`;
