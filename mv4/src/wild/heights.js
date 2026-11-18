// 高度场：把天然地貌（land.js）取样成格网，按路、建筑的地基、溪修整。
// 三层：近处（主峰、湖和抱湖的山梁、水口外云还没盖住的那一段出谷）每 3 个单位一个点；路两旁十几个单位以内的格子再细分成 4×4（每 0.75 个单位一个点），
// 基座的墙脚、护坡后面抬高的地面、路肩的小起伏都靠这一层才立得住；远处（云海下的谷地和远山）每 37.5 个单位一个点。
// 细分的格子和没细分的格子交界处，细点的高度退回粗格的线性插值，两层网格之间没有缝。
import { landHeight } from './land.js';
import { fbm, smooth, lerp, clamp } from './noise.js';
import { roadside, FOOT } from './roadside.js';

export const NEAR = { x0: -681, z0: -450, cell: 3, nx: 455, nz: 758 };      // 近处的格网：起点、格距、两个方向的点数
export const FARG = { x0: -4800, z0: -4480, cell: 37.5, nx: 257, nz: 257 }; // 远处的格网
export const SUB = 4, CREEK_REACH = 17;                                     // 路边的格子一边细分成几段；溪影响两侧多远的地形
const FINE_REACH = 15;                                                      // 离路中线这么近的格子要细分

export const inside = (g, x, z) => x >= g.x0 && z >= g.z0 && x <= g.x0 + (g.nx - 1) * g.cell && z <= g.z0 + (g.nz - 1) * g.cell;
export function sample(g, H, x, z) {
  const fx = clamp((x - g.x0) / g.cell, 0, g.nx - 1.0001), fz = clamp((z - g.z0) / g.cell, 0, g.nz - 1.0001), i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, k = j * g.nx + i;
  return lerp(lerp(H[k], H[k + 1], u), lerp(H[k + g.nx], H[k + g.nx + 1], u), v);
}

// pads：建筑的地基 [{ x, z, r, y, blend }]，那一圈地面削平到 y；relief：大远景的山形（sceneryrelief.js），离路远的地方在天然地貌上再雕一遍，离路近的按修路时的地貌
export function buildHeights(road, creek, pads, relief) {
  const g = NEAR, f = FARG, count = g.nx * g.nz, side = roadside(road);
  const box = creek.pts.reduce((b, p) => ({ x0: Math.min(b.x0, p.x - CREEK_REACH), x1: Math.max(b.x1, p.x + CREEK_REACH), z0: Math.min(b.z0, p.z - CREEK_REACH), z1: Math.max(b.z1, p.z + CREEK_REACH) }), { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity });
  // 一个点的高度：天然地貌（离路远的地方再雕一遍）→ 按路修整 → 地基削平 → 溪往下挖出一道沟。细分的点上另加一层小起伏（路肩不是一张平板）。
  // 结果放在 at 里：h 高度，road、creek 离路中线和溪多远
  const at = { h: 0, road: Infinity, creek: Infinity };
  function ground(x, z, fine) {
    let h = relief.at(x, z);
    const on = side.locate(x, z);
    at.road = on ? on.d : Infinity;
    if (on) {
      h = side.shape(on, h);
      if (fine) h += (fbm(x / 2.9 + 3.7, z / 2.9 + 9.3, 3) - .5) * .55 * smooth(FOOT, FOOT + 3, on.d) * (1 - road.onBridge(on.s));
    }
    for (const pad of pads) { const d = Math.hypot(pad.x - x, pad.z - z); if (d < pad.r + pad.blend) h = lerp(h, pad.y, smooth(pad.r + pad.blend, pad.r, d)); }
    at.creek = Infinity;
    if (x > box.x0 && x < box.x1 && z > box.z0 && z < box.z1) {
      let level = 0;
      for (const p of creek.pts) { const d = Math.hypot(p.x - x, p.z - z); if (d < at.creek) { at.creek = d; level = p.y; } }
      if (at.creek < CREEK_REACH) h -= smooth(CREEK_REACH, 2.6, at.creek) * Math.max(0, h - (level - .9));
    }
    at.h = h;
    return at;
  }

  const H = new Float32Array(count), roadD = new Float32Array(count), creekD = new Float32Array(count);
  for (let j = 0; j < g.nz; j++) for (let i = 0; i < g.nx; i++) {
    const k = j * g.nx + i, a = ground(g.x0 + i * g.cell, g.z0 + j * g.cell, false);
    H[k] = a.h; roadD[k] = a.road; creekD[k] = a.creek;
  }

  relief.flute(H, g);                                                        // 离路远的崖壁上刻出竖的石柱和石缝

  // 哪些格子细分：slot 是它在细点数组里排第几，-1 是不细分
  const cw = g.nx - 1, ch = g.nz - 1, slot = new Int32Array(cw * ch).fill(-1), P = SUB + 1, e = g.cell / SUB;
  let cells = 0;
  for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
    const k = j * g.nx + i;
    if (Math.min(roadD[k], roadD[k + 1], roadD[k + g.nx], roadD[k + g.nx + 1]) < FINE_REACH) slot[j * cw + i] = cells++;
  }
  // 粗格点四周的格子全都细分了，这个点才完全用细的高度（1）；挨着没细分的格子就用粗的（0）。格子里按四角插值
  const isFine = (i, j) => i >= 0 && j >= 0 && i < cw && j < ch && slot[j * cw + i] >= 0, own = new Float32Array(count);
  for (let j = 0; j < g.nz; j++) for (let i = 0; i < g.nx; i++) own[j * g.nx + i] = isFine(i - 1, j - 1) && isFine(i, j - 1) && isFine(i - 1, j) && isFine(i, j) ? 1 : 0;
  // 细点：每个细分的格子 P×P 个，高度 F、离路中线多远 FD、用细的高度占几成 FW。相邻格子共用的点只算一次，两边的值完全相同
  const F = new Float32Array(cells * P * P), FD = new Float32Array(cells * P * P), FW = new Float32Array(cells * P * P), memo = new Map(), fw = g.nx * SUB;
  for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
    const c = slot[j * cw + i], k = j * g.nx + i;
    if (c < 0) continue;
    for (let b = 0; b <= SUB; b++) for (let a = 0; a <= SUB; a++) {
      const id = (j * SUB + b) * fw + i * SUB + a, o = c * P * P + b * P + a;
      let m = memo.get(id);
      if (!m) {
        const u = a / SUB, v = b / SUB, w = lerp(lerp(own[k], own[k + 1], u), lerp(own[k + g.nx], own[k + g.nx + 1], u), v);
        const coarse = lerp(lerp(H[k], H[k + 1], u), lerp(H[k + g.nx], H[k + g.nx + 1], u), v), fine = ground(g.x0 + (i * SUB + a) * e, g.z0 + (j * SUB + b) * e, true);
        m = [lerp(coarse, fine.h, w), fine.road, w];
        memo.set(id, m);
      }
      F[o] = m[0]; FD[o] = m[1]; FW[o] = m[2];
    }
  }

  const HF = new Float32Array(f.nx * f.nz);
  for (let j = 0; j < f.nz; j++) for (let i = 0; i < f.nx; i++) {
    const x = f.x0 + i * f.cell, z = f.z0 + j * f.cell;
    HF[j * f.nx + i] = inside(g, x, z) ? sample(g, H, x, z) : landHeight(x, z);
  }

  // 地面的高度：近处细分过的格子查细点，没细分的查粗格，出了近处的范围查远处的格网
  const groundAt = (x, z) => {
    if (!inside(g, x, z)) return sample(f, HF, x, z);
    const fx = clamp((x - g.x0) / g.cell, 0, cw - .0001), fz = clamp((z - g.z0) / g.cell, 0, ch - .0001), i = Math.floor(fx), j = Math.floor(fz), c = slot[j * cw + i];
    if (c < 0) { const u = fx - i, v = fz - j, k = j * g.nx + i; return lerp(lerp(H[k], H[k + 1], u), lerp(H[k + g.nx], H[k + g.nx + 1], u), v); }
    const su = (fx - i) * SUB, sv = (fz - j) * SUB, a = Math.min(SUB - 1, Math.floor(su)), b = Math.min(SUB - 1, Math.floor(sv)), u = su - a, v = sv - b, o = c * P * P + b * P + a;
    return lerp(lerp(F[o], F[o + 1], u), lerp(F[o + P], F[o + P + 1], u), v);
  };
  return { H, HF, roadD, creekD, slot, cells, F, FD, FW, groundAt };
}
