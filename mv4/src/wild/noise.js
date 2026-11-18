// 噪声：地形、摆放、贴图都从这里取「看起来随机、其实确定」的数。
// 底下是一张 256×256 的随机数表（用 anim.js 的 rnd 填），值噪声在表上插值；分形叠加（fbm）和脊状噪声（ridged）在它上面搭出来。
// 同一张表也做成贴图交给着色器，显卡上的噪声和这边同源。
import * as THREE from 'three';
import { rnd } from '../anim.js';

const N = 256, MASK = N - 1, TABLE = new Float32Array(N * N);
for (let i = 0; i < N * N; i++) TABLE[i] = rnd(i * .731 + 2.17);

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const smooth = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };

// 值噪声，0 到 1。格点取表里的数，格子内用五次曲线插值（一阶、二阶导数都连续，地形上不会出现格子印）
export function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10), v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const x0 = xi & MASK, x1 = (xi + 1) & MASK, y0 = (yi & MASK) * N, y1 = ((yi + 1) & MASK) * N;
  const a = TABLE[y0 + x0], b = TABLE[y0 + x1], c = TABLE[y1 + x0], d = TABLE[y1 + x1];
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// 分形叠加，0 到 1。每一层放大一倍并转一个角度，免得各层的格子对齐
export function fbm(x, y, octaves = 5) {
  let sum = 0, amp = .5, norm = 0;
  for (let k = 0; k < octaves; k++) {
    sum += amp * vnoise(x, y); norm += amp; amp *= .5;
    const nx = 1.6 * x - 1.2 * y + 19.7; y = 1.2 * x + 1.6 * y + 7.3; x = nx;
  }
  return sum / norm;
}

// 脊状噪声，0 到 1：把每层噪声折成尖脊，脊上再长小脊（上一层高的地方下一层才有分量），像山的棱线
export function ridged(x, y, octaves = 5) {
  let sum = 0, amp = .5, norm = 0, weight = 1;
  for (let k = 0; k < octaves; k++) {
    let v = 1 - Math.abs(2 * vnoise(x, y) - 1); v *= v;
    sum += amp * v * weight; norm += amp; weight = clamp(v * 1.7); amp *= .5;
    const nx = 1.6 * x - 1.2 * y + 31.3; y = 1.2 * x + 1.6 * y + 11.9; x = nx;
  }
  return sum / norm;
}

// 给着色器用的噪声贴图。R 是表本身；G 是 R 平移 (37, 17) 的副本（着色器靠这个偏移在两层之间插值，拼出三维噪声）；B、A 是另外两份平移的副本
export function noiseTexture() {
  const data = new Uint8Array(N * N * 4), at = (x, y) => Math.round(TABLE[((y & MASK) * N) + (x & MASK)] * 255);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = (y * N + x) * 4;
    data[i] = at(x, y); data[i + 1] = at(x - 37, y - 17); data[i + 2] = at(x + 59, y + 83); data[i + 3] = at(x + 101, y + 29);
  }
  const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
  return tex;
}
