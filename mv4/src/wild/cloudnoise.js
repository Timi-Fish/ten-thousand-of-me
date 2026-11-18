// 云的噪声：天上的云、云海、雾共用的一张贴图（512×512，四个通道，上下左右都能无缝接上）。
// 一次查表就拿到好几层细节叠好的形状，所以着色器里沿视线一步步走进云里也走得起；带逐级缩小的副本，远处的云自动变得平顺、不闪。
//   R 团：柏林噪声被蜂窝噪声撑开——一朵朵顶上圆、底下连成片的云团（积云、云海的大形）
//   G 絮：三层蜂窝——一粒粒圆鼓鼓的小云包（用来把云的边缘啃出菜花一样的轮廓）
//   B 烟：六层柏林噪声——匀净的浓淡（卷云、雾里的丝缕、扭动别的层）
//   A 涌：把柏林噪声对折——圆包之间夹着尖沟（云海上翻涌的云头和它们之间的沟壑）
// 随机数只来自 anim.js 的 rnd，每次生成的贴图一模一样。
import * as THREE from 'three';
import { rnd } from '../anim.js';

export const CLOUD_MAP_SIZE = 512;

// 排列表和梯度表：格点 (x, y) 先按周期折回，再查表得到这个格点的梯度方向 / 特征点位置
const PERM = new Uint8Array(512), GX = new Float32Array(256), GY = new Float32Array(256), JX = new Float32Array(256), JY = new Float32Array(256);
{
  const order = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(rnd(i * 3.71 + 5.3) * (i + 1)), t = order[i]; order[i] = order[j]; order[j] = t; }
  for (let i = 0; i < 512; i++) PERM[i] = order[i & 255];
  for (let i = 0; i < 256; i++) {
    const a = rnd(i * 1.37 + 71.9) * Math.PI * 2;
    GX[i] = Math.cos(a); GY[i] = Math.sin(a); JX[i] = rnd(i * 2.93 + 13.1); JY[i] = rnd(i * 4.57 + 29.7);
  }
}
const wrap = (i, period) => ((i % period) + period) % period;
const cellHash = (ix, iy, period, seed) => PERM[PERM[(wrap(ix, period) + seed) & 255] + wrap(iy, period)];

// 柏林噪声，约 -1 到 1，两个方向的周期都是 period（整数）
function perlin(x, y, period, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10), v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const h00 = cellHash(xi, yi, period, seed), h10 = cellHash(xi + 1, yi, period, seed), h01 = cellHash(xi, yi + 1, period, seed), h11 = cellHash(xi + 1, yi + 1, period, seed);
  const a = GX[h00] * fx + GY[h00] * fy, b = GX[h10] * (fx - 1) + GY[h10] * fy, c = GX[h01] * fx + GY[h01] * (fy - 1), d = GX[h11] * (fx - 1) + GY[h11] * (fy - 1);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 1.41;
}

// 蜂窝噪声：每个格子里有一个点，返回到最近那个点的距离（0 到 1）
function cells(x, y, period, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  let best = 9;
  for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) {
    const h = cellHash(xi + a, yi + b, period, seed), dx = xi + a + JX[h] - x, dy = yi + b + JY[h] - y, d = dx * dx + dy * dy;
    if (d < best) best = d;
  }
  return Math.min(1, Math.sqrt(best));
}

// 把一个通道拉满到 0～1
function stretch(values) {
  let lo = Infinity, hi = -Infinity;
  for (const v of values) { if (v < lo) lo = v; if (v > hi) hi = v; }
  for (let i = 0; i < values.length; i++) values[i] = (values[i] - lo) / (hi - lo);
  return values;
}

export function cloudMapTexture() {
  const N = CLOUD_MAP_SIZE, count = N * N, R = new Float32Array(count), G = new Float32Array(count), B = new Float32Array(count), A = new Float32Array(count);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const u = i / N, v = j / N, k = j * N + i;
    // 蜂窝：周期 4、8、16、32 的四层，反过来（点上最高）
    const w4 = 1 - cells(u * 4, v * 4, 4, 11), w8 = 1 - cells(u * 8, v * 8, 8, 23), w16 = 1 - cells(u * 16, v * 16, 16, 37), w32 = 1 - cells(u * 32, v * 32, 32, 53);
    const puffLow = w4 * .625 + w8 * .25 + w16 * .125, puffHigh = w8 * .625 + w16 * .25 + w32 * .125;
    let smoke = 0, base = 0, billow = 0, amp = .5;
    for (let o = 0; o < 6; o++) {
      const p3 = 3 << o, p4 = 4 << o;
      smoke += amp * perlin(u * p3, v * p3, Math.min(p3, 256), 61 + o * 7);
      const n = perlin(u * p4, v * p4, Math.min(p4, 256), 101 + o * 5);
      if (o < 5) base += amp * n;
      billow += amp * Math.abs(n);
      amp *= .5;
    }
    const soft = Math.min(1, Math.max(0, .5 + .62 * base));
    R[k] = puffLow + soft * (1 - puffLow);        // 柏林噪声的 0～1 映到「蜂窝～1」：蜂窝把云团撑圆
    G[k] = puffHigh; B[k] = smoke; A[k] = billow;
  }
  [R, G, B, A].forEach(stretch);
  const half = new Uint16Array(count * 4);
  for (let k = 0; k < count; k++) {
    half[k * 4] = THREE.DataUtils.toHalfFloat(R[k]); half[k * 4 + 1] = THREE.DataUtils.toHalfFloat(G[k]);
    half[k * 4 + 2] = THREE.DataUtils.toHalfFloat(B[k]); half[k * 4 + 3] = THREE.DataUtils.toHalfFloat(A[k]);
  }
  const tex = new THREE.DataTexture(half, N, N, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true; tex.needsUpdate = true;
  return tex;
}
