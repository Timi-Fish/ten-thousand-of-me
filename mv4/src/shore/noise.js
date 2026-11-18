// 噪声：岸、海、天用到的「看起来随机、其实确定」的数，全部来自 anim.js 的 rnd。
//   JS 这边：值噪声和分形叠加（造礁石、沙滩的高度）。
//   着色器那边：一张 256×256 的随机数表贴图（和 JS 同一张表）；一张 256×256、四通道、上下左右无缝的云纹贴图。
import * as THREE from 'three';
import { rnd } from '../anim.js';

const N = 256, MASK = N - 1, TABLE = new Float32Array(N * N);
for (let i = 0; i < N * N; i++) TABLE[i] = rnd(i * .913 + 5.31);

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const smooth = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };

// 值噪声，0 到 1，五次曲线插值
export function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10), v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const x0 = xi & MASK, x1 = (xi + 1) & MASK, y0 = (yi & MASK) * N, y1 = ((yi + 1) & MASK) * N;
  const a = TABLE[y0 + x0], b = TABLE[y0 + x1], c = TABLE[y1 + x0], d = TABLE[y1 + x1];
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
// 分形叠加，0 到 1。每层放大一倍并转一个角度
export function fbm(x, y, octaves = 4) {
  let sum = 0, amp = .5, norm = 0;
  for (let k = 0; k < octaves; k++) {
    sum += amp * vnoise(x, y); norm += amp; amp *= .5;
    const nx = 1.6 * x - 1.2 * y + 19.7; y = 1.2 * x + 1.6 * y + 7.3; x = nx;
  }
  return sum / norm;
}

// 随机数表做成的贴图：R 是表本身，G、B、A 是平移过的副本（着色器靠 R、G 的固定偏移拼出三维噪声）
export function tableTexture() {
  const data = new Uint8Array(N * N * 4), at = (x, y) => Math.round(TABLE[((y & MASK) * N) + (x & MASK)] * 255);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = (y * N + x) * 4;
    data[i] = at(x, y); data[i + 1] = at(x - 37, y - 17); data[i + 2] = at(x + 59, y + 83); data[i + 3] = at(x + 101, y + 29);
  }
  const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
  return tex;
}

// 周期值噪声：格点按 period 折回，所以贴图上下左右接得上
function pnoise(x, y, period, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const h = (i, j) => TABLE[(((((j % period) + period) % period) + seed * 7) & MASK) * N + (((((i % period) + period) % period) + seed * 13) & MASK)];
  const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function pfbm(u, v, period, octaves, seed) {
  let sum = 0, amp = .5, norm = 0, p = period;
  for (let k = 0; k < octaves; k++) { sum += amp * pnoise(u * p, v * p, p, seed + k); norm += amp; amp *= .5; p *= 2; }
  return sum / norm;
}
// 周期蜂窝：到最近特征点的距离，反过来（点上最高），0 到 1
function pcells(u, v, period, seed) {
  const x = u * period, y = v * period, xi = Math.floor(x), yi = Math.floor(y);
  let best = 9;
  for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) {
    const cx = (((xi + a) % period) + period) % period, cy = (((yi + b) % period) + period) % period;
    const r = TABLE[((cy + seed * 11) & MASK) * N + ((cx + seed * 5) & MASK)], s = TABLE[((cy + seed * 3 + 91) & MASK) * N + ((cx + seed * 17 + 47) & MASK)];
    const dx = xi + a + r - x, dy = yi + b + s - y;
    best = Math.min(best, dx * dx + dy * dy);
  }
  return 1 - Math.min(1, Math.sqrt(best));
}
// 拉满到 0 到 1
function stretch(values) {
  let lo = Infinity, hi = -Infinity;
  for (const v of values) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  for (let i = 0; i < values.length; i++) values[i] = (values[i] - lo) / (hi - lo);
}

// 云纹贴图（256×256，四通道，无缝，带逐级缩小的副本）：
//   R 云团：大形的浓淡被蜂窝撑开，一团一团   G 絮：细的浓淡，啃云的边、做浪沫的纹   B 烟：匀净的浓淡   A 网：蜂窝的边（浪沫的网纹）
export function cloudTexture() {
  const S = 256, R = new Float32Array(S * S), G = new Float32Array(S * S), B = new Float32Array(S * S), A = new Float32Array(S * S);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const u = i / S, v = j / S, k = j * S + i;
    const big = pfbm(u, v, 4, 5, 1), cell = pcells(u, v, 6, 3) * .6 + pcells(u, v, 12, 4) * .4;
    R[k] = big * .6 + cell * .4;
    G[k] = pfbm(u, v, 16, 4, 9) * .6 + pcells(u, v, 24, 6) * .4;
    B[k] = pfbm(u, v, 8, 5, 17);
    const c1 = pcells(u, v, 10, 8), c2 = pcells(u, v, 20, 12);
    A[k] = Math.max(Math.pow(1 - c1, 6), .7 * Math.pow(1 - c2, 6));
  }
  [R, G, B, A].forEach(stretch);
  const data = new Uint8Array(S * S * 4);
  for (let k = 0; k < S * S; k++) { data[k * 4] = R[k] * 255; data[k * 4 + 1] = G[k] * 255; data[k * 4 + 2] = B[k] * 255; data[k * 4 + 3] = A[k] * 255; }
  const tex = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true; tex.needsUpdate = true;
  return tex;
}
