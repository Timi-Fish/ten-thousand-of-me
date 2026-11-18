// 崖壁的细网格：近处地形每 3 个单位一个点，直上直下的崖壁在这个格距上会拉出一条条长三角，远看是一块块平板、轮廓是一段段直线。
// 离路远（ROAD_CLEAR 以外）、又陡（格子四角高差超过 STEEP）的格子，换成每边 SKIN 段的细格：格子里面的点按周围 4×4 个格点做三次插值
// （崖面成了弯的），再加一层一两个单位大小的起伏（石面的棱）；格子的边上，两边都是细格才用插值的高度，挨着粗格的边退回两角的直线，
// 两种格子之间没有缝。路边的东西（石头、草、灯、小蟹）都在这些格子以外，它们贴的地面不变。
import { vnoise, smooth, clamp, lerp } from './noise.js';
import { nearSummit } from './scenerykeep.js';

export const SKIN = 3, STEEP = 7.5, ROAD_CLEAR = 75, SUMMIT_CLEAR = 30;   // 主峰顶上四面是绝壁，离路 30 以外就换细格

const cr = (p0, p1, p2, p3, t) => .5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t * t * t);

// g：近处的格网；H：格点高度；slot：哪些格子已经为路细分了；keep：sceneryKeep（离路多远、崖壁能不能改）
export function planSkin(g, H, slot, keep) {
  const cw = g.nx - 1, ch = g.nz - 1, on = new Uint8Array(cw * ch);
  let count = 0;
  for (let j = 1; j < ch - 1; j++) for (let i = 1; i < cw - 1; i++) {
    if (slot[j * cw + i] >= 0) continue;
    const k = j * g.nx + i, a = H[k], b = H[k + 1], c = H[k + g.nx], d = H[k + g.nx + 1];
    if (Math.max(a, b, c, d) - Math.min(a, b, c, d) < STEEP) continue;
    const x = g.x0 + (i + .5) * g.cell, z = g.z0 + (j + .5) * g.cell;
    if (keep.roadDist(x, z) < lerp(ROAD_CLEAR, SUMMIT_CLEAR, nearSummit(x, z)) || keep.cliff(x, z) < .5) continue;
    on[j * cw + i] = 1; count++;
  }
  const isOn = (i, j) => i >= 0 && j >= 0 && i < cw && j < ch && on[j * cw + i] === 1;
  // 细格里一点的高度（格子 i, j 里，u, v 是格子内的 0 到 1）
  const H4 = (i, j) => H[clamp(j, 0, g.nz - 1) * g.nx + clamp(i, 0, g.nx - 1)];
  function detail(i, j, u, v) {
    const rows = [-1, 0, 1, 2].map(b => cr(H4(i - 1, j + b), H4(i, j + b), H4(i + 1, j + b), H4(i + 2, j + b), u));
    let h = cr(rows[0], rows[1], rows[2], rows[3], v), lo = Infinity, hi = -Infinity;
    for (let b = 0; b <= 1; b++) for (let a = 0; a <= 1; a++) { const q = H4(i + a, j + b); lo = Math.min(lo, q); hi = Math.max(hi, q); }
    const range = hi - lo, x = g.x0 + (i + u) * g.cell, z = g.z0 + (j + v) * g.cell;
    h = clamp(h, lo - .15 * range, hi + .15 * range);
    return h + (vnoise(x / 2.4 + 5.1, z / 2.4 + 1.7) - .5) * 2.6 * smooth(STEEP, 20, range);
  }
  // 细格的一个顶点：角上用格点；边上两边都细才用插值，否则两角连直线
  function vertexHeight(i, j, a, b) {
    const u = a / SKIN, v = b / SKIN, edgeU = a === 0 || a === SKIN, edgeV = b === 0 || b === SKIN;
    if (edgeU && edgeV) return H4(i + (a ? 1 : 0), j + (b ? 1 : 0));
    if (edgeU) { const ni = a ? i + 1 : i - 1; return isOn(ni, j) ? detail(i, j, u, v) : lerp(H4(i + (a ? 1 : 0), j), H4(i + (a ? 1 : 0), j + 1), v); }
    if (edgeV) { const nj = b ? j + 1 : j - 1; return isOn(i, nj) ? detail(i, j, u, v) : lerp(H4(i, j + (b ? 1 : 0)), H4(i + 1, j + (b ? 1 : 0)), u); }
    return detail(i, j, u, v);
  }
  // 一块地块里的细格：返回 { pos, nor, away, idx } 或 null
  function chunk(ci, cj, w, h) {
    const pos = [], nor = [], away = [], idx = [], e = g.cell / SKIN, P = SKIN + 1;
    for (let j = cj; j < cj + h; j++) for (let i = ci; i < ci + w; i++) {
      if (!isOn(i, j)) continue;
      const base = pos.length / 3, Y = [];
      for (let b = 0; b <= SKIN; b++) for (let a = 0; a <= SKIN; a++) { const y = vertexHeight(i, j, a, b); Y.push(y); pos.push(g.x0 + i * g.cell + a * e, y, g.z0 + j * g.cell + b * e); away.push(99); }
      for (let b = 0; b <= SKIN; b++) for (let a = 0; a <= SKIN; a++) {
        const at = (aa, bb) => aa >= 0 && aa <= SKIN && bb >= 0 && bb <= SKIN ? Y[bb * P + aa] : vertexHeight(i, j, clamp(aa, 0, SKIN), clamp(bb, 0, SKIN));
        const nx = at(a - 1, b) - at(a + 1, b), nz = at(a, b - 1) - at(a, b + 1), ny = 2 * e, len = Math.hypot(nx, ny, nz);
        nor.push(nx / len, ny / len, nz / len);
      }
      for (let b = 0; b < SKIN; b++) for (let a = 0; a < SKIN; a++) { const p = base + b * P + a, q = p + P; idx.push(p, q, p + 1, p + 1, q, q + 1); }
    }
    return idx.length ? { pos: new Float32Array(pos), nor: new Float32Array(nor), away: new Float32Array(away), idx } : null;
  }
  return { on, count, chunk };
}
