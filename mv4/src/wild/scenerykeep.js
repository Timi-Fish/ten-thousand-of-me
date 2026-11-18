// 大远景的布景动到哪里为止：离路、溪、建筑的地基、桥边的溪谷、近景机位越近，新的山形和新摆的东西越收敛，贴着它们的地方一丝不动。
// 在一张 6 个单位一格的网上先把「离路多远」「能改几成」算好，用的时候双线性插值。
import { smooth, clamp, lerp } from './noise.js';

const CELL = 6, X0 = -720, Z0 = -480, NX = 242, NZ = 392;
export const KEEP = { road: [30, 70], creek: [24, 55], north: [340, 420], forest: [24, 42] };   // forest：林子按林分长，离路多远起
const GORGE = { x: 75, z: 410, r: [140, 190], trees: [80, 120] };
const SUMMIT = [110, 160];                                           // 主峰顶上这么近以内：崖壁从离路更近处就刻竖槽、换细网格（渐变到 SUMMIT[1]）
export const nearSummit = (x, z) => smooth(SUMMIT[1], SUMMIT[0], Math.hypot(x, z));                     // 桥、瀑布和桥边溪谷那一带整个不动（夏天雨中放晴的那几个镜头都在这里）

export function buildKeep(road, creek, pads, shots) {
  const roadPts = road.pts.filter((_, i) => i % 6 === 0), creekPts = creek.pts.filter((_, i) => i % 2 === 0);
  // 近景机位：镜头和它看的那一点周围
  const close = shots.filter(s => Math.hypot(s.p[0] - s.q[0], s.p[2] - s.q[2]) < 70).flatMap(s => [s.p, s.q]);
  const D = new Float32Array(NX * NZ), W = new Float32Array(NX * NZ), C = new Float32Array(NX * NZ), F = new Float32Array(NX * NZ);
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const x = X0 + i * CELL, z = Z0 + j * CELL;
    let dr = Infinity, dc = Infinity;
    for (const p of roadPts) { const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < dr) dr = d; }
    for (const p of creekPts) { const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < dc) dc = d; }
    dr = Math.sqrt(dr); dc = Math.sqrt(dc);
    const creek = smooth(KEEP.creek[0], KEEP.creek[1], dc);
    let padFar = 1, padNear = 1, shotsOk = 1;
    for (const pad of pads) { const d = Math.hypot(x - pad.x, z - pad.z); padFar *= smooth(pad.r + 20, pad.r + 60, d); padNear *= smooth(pad.r + pad.blend + 2, pad.r + pad.blend + 10, d); }
    for (const p of close) shotsOk *= smooth(55, 95, Math.hypot(x - p[0], z - p[2]));
    // 桥边溪谷：地形整个不动；林子只在桥和瀑布跟前不动（那几个镜头看得见的一圈）
    // 主峰顶上（离峰顶 SUMMIT 以内）：崖壁的竖槽从离路 20 起就刻（峰顶四面是绝壁，只有石阶那一线是路），亭子的地基外面一点就可以刻
    const gorge = Math.hypot(x - GORGE.x, z - GORGE.z), north = smooth(KEEP.north[0], KEEP.north[1], z), k = j * NX + i, summit = smooth(SUMMIT[1], SUMMIT[0], Math.hypot(x, z));
    const same = creek * shotsOk * smooth(GORGE.r[0], GORGE.r[1], gorge);
    D[k] = dr; W[k] = same * padFar * smooth(KEEP.road[0], KEEP.road[1], dr) * north;
    C[k] = same * lerp(padFar, padNear, summit) * smooth(lerp(KEEP.road[0], 20, summit), lerp(KEEP.road[1], 34, summit), dr);
    F[k] = creek * shotsOk * padFar * smooth(GORGE.trees[0], GORGE.trees[1], gorge) * smooth(KEEP.forest[0], KEEP.forest[1], dr) * north;
  }
  const sample = (A, x, z, outside) => {
    const fx = (x - X0) / CELL, fz = (z - Z0) / CELL;
    if (fx < 0 || fz < 0 || fx >= NX - 1 || fz >= NZ - 1) return outside;
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, k = j * NX + i;
    return lerp(lerp(A[k], A[k + 1], u), lerp(A[k + NX], A[k + NX + 1], u), v);
  };
  return {
    // 这一处的山形能改几成（0 不动，1 完全按新的）
    weight: (x, z) => clamp(sample(W, x, z, 0)),
    // 崖壁上的竖槽能刻几成：和上面一样，只是主峰那一带（北面）也算在内
    cliff: (x, z) => clamp(sample(C, x, z, 0)),
    // 林子按林分长有几成（离路近一些也算，近景机位一带不算）
    forest: (x, z) => clamp(sample(F, x, z, 0)),
    // 离路中线多远（网格外算很远）
    roadDist: (x, z) => sample(D, x, z, 1e4),
  };
}
