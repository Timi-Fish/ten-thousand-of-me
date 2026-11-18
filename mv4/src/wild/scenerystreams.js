// 山上流下来的溪：从山梁内侧几条侧谷的谷头起，顺着地势一路往低处走，汇进湖里。
// 走法：每一步朝最陡的下坡方向挪一点，同时记着上一步的方向（水有惯性，在平处才拐得出弯），平得找不到方向时朝湖心偏。
// 走不到湖、或者走到路和桥边那些不能动的地方，这条就不要了。
// 水道：沿溪的中线把地面挖下去一道（谷底的「水面」顺流只降不升），两岸缓缓抬回原来的地面。
// 湖从南面水口流出去的那条溪走向是定好的（sceneryexit.js），排在最后一条，比山上的溪宽（wide）。
import { smooth, lerp, clamp, vnoise } from './noise.js';
import { LAKE, crestR, fromPolar, D2R } from './scenerymap.js';

export const STREAM = { step: 2.5, bank: 9, bed: 1.2 };              // 每一步走多远；两岸抬回原地面要多宽；水面比沟底高多少
// 谷头：[方位°, 离山梁脊线往里多远]。都在两道支脊之间
const HEADS = [[59, 30], [77, 26], [96, 30], [116, 30], [136, 30], [151, 26], [211, 26], [227, 30], [243, 28], [258, 26], [275, 30], [292, 28], [309, 30], [326, 30]];
const CELL = 20;

// outlet：出水的溪 { pts, wide }
export function traceStreams(heightAt, keep, road, outlet) {
  const list = [];
  for (const [deg, inset] of HEADS) {
    const phi = deg * D2R, [x0, z0] = fromPolar(phi, crestR(phi) - inset);
    let x = x0, z = z0, dx = -Math.sin(phi), dz = Math.cos(phi), h = heightAt(x, z), ok = false;
    const pts = [];
    for (let k = 0; k < 520; k++) {
      pts.push({ x, z, ground: h });
      if (h < -.4) { ok = true; break; }
      if (keep.weight(x, z) < .7 || keep.roadDist(x, z) < 45) break;
      const e = 3, gx = heightAt(x + e, z) - heightAt(x - e, z), gz = heightAt(x, z + e) - heightAt(x, z - e), g = Math.hypot(gx, gz);
      const lx = LAKE.x - x, lz = LAKE.z - z, ll = Math.hypot(lx, lz), wander = (vnoise(k * .08 + deg, 3.1) - .5) * 1.6;
      let nx = dx * .55, nz = dz * .55;
      if (g > 1e-3) { nx -= gx / g * clamp(g * 3, .25, 1); nz -= gz / g * clamp(g * 3, .25, 1); }
      nx += lx / ll * .18 * smooth(.3, .02, g) - dz * wander * .2; nz += lz / ll * .18 * smooth(.3, .02, g) + dx * wander * .2;
      const nl = Math.hypot(nx, nz); dx = nx / nl; dz = nz / nl;
      x += dx * STREAM.step; z += dz * STREAM.step; h = heightAt(x, z);
    }
    if (!ok || pts.length < 30) continue;
    // 沟底：顺流只降不升；比地面低 2.2 到 3（平处浅，陡处深）
    let low = Infinity;
    for (const p of pts) { low = Math.min(low, p.ground - 2.6); p.y = Math.max(low, -1.2); }
    if (pts.some(p => p.ground - p.y > 16)) continue;                                   // 要切穿一道梁才过得去：不是一条自然的溪
    for (let i = 0; i < pts.length; i++) { const a = pts[Math.max(0, i - 2)], b = pts[Math.min(pts.length - 1, i + 2)]; pts[i].steep = (a.y - b.y) / Math.hypot(b.x - a.x, b.z - a.z); }
    list.push({ pts, wide: 1 });
  }
  list.push(outlet);
  // 找最近的溪段：按格子分桶
  const buckets = new Map(), key = (i, j) => i * 4096 + j;
  list.forEach((s, si) => s.pts.forEach((p, pi) => { if (pi === s.pts.length - 1) return; const k = key(Math.floor(p.x / CELL), Math.floor(p.z / CELL)); if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push([si, pi]); }));
  // 离 (x, z) 最近的溪：d 水平距离（CELL 以外算很远），y 沟底高，s 哪一条，i 第几段
  const hit = { d: 0, y: 0, s: 0, i: 0 };
  function near(x, z) {
    const ci = Math.floor(x / CELL), cj = Math.floor(z / CELL);
    hit.d = Infinity;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const cell = buckets.get(key(ci + a, cj + b));
      if (cell) for (const [si, pi] of cell) {
        const p = list[si].pts[pi], q = list[si].pts[pi + 1], ex = q.x - p.x, ez = q.z - p.z, k = clamp(((x - p.x) * ex + (z - p.z) * ez) / (ex * ex + ez * ez));
        const d = Math.hypot(x - p.x - ex * k, z - p.z - ez * k);
        if (d < hit.d) { hit.d = d; hit.y = lerp(p.y, q.y, k); hit.s = si; hit.i = pi; }
      }
    }
    return hit;
  }
  function carve(x, z, h) {
    const { d, y, s } = near(x, z);
    if (d === Infinity) return h;                                     // 附近没有溪
    const wide = list[s].wide;
    if (d > (STREAM.bank + 4) * wide) return h;
    return Math.min(h, lerp(y, h, smooth(2 * wide, (STREAM.bank + 4) * wide, d)));
  }
  return { list, carve, near };
}
