// 路两旁的地势：山路怎样「坐」进山里。只有数据和算法，地形（heights.js）、基座和护坡（roadwalls.js）、路肩的碎石（scree.js）都按它来做。
// 沿路每个取样点、左右两侧各有两个数：
//   drop  路缘外侧的地面比路的中线低多少——地势往外落得越多，条石基座露出来的越高；
//   bank  地势高过路面的一侧，离路缘一步远立一道垒石护坡，这是它的高度（0 就是没有，土坡自己缓缓升上去）。
// 横着看一侧的剖面（d：离中线多远）：
//   d < WALL_AT           路面和路缘石底下，地面压在路面以下
//   WALL_AT … FOOT        基座的墙脚，地面平平地在「中线高度 - drop」
//   有护坡时 BANK_AT 是墙面，BANK_BACK 往外地面抬到墙顶；再往外渐渐回到天然的山坡
import * as THREE from 'three';
import { landHeight } from './land.js';
import { ROUND } from './ranges.js';
import { HALF, CURB, RIDGE_END } from './road.js';
import { fbm, smooth, lerp, clamp } from './noise.js';

export const WALL_AT = HALF + CURB, FOOT = 4.7, BANK_AT = 4.95, BANK_BACK = 5.9, GUTTER = .5;
export const RIDGE_REACH = 12, ROAD_REACH = 22;                      // 主峰的石头山上、半山以下的山坡上，路各影响两侧多远的地形
const PROBE = 10, CELL = ROAD_REACH + 4;                             // 在离中线多远处量天然的地势；找最近路点用的分桶格子

// 路的坐标：弧长 s、离中线 o（右正左负）、高度 y → 世界里的点；以及沿路的几条高度线
export function tracer(road) {
  const p = new THREE.Vector3(), r = new THREE.Vector3();
  return {
    point(s, o, y, out = new THREE.Vector3()) { road.at0(s, p); road.right(s, r); return out.set(p.x + r.x * o, y, p.z + r.z * o); },
    right(s, out = new THREE.Vector3()) { return road.right(s, out); },
    mid: s => road.at0(s, p).y,                                                    // 中线平滑的高度（石阶处不分级）
    curb: s => road.at0(s, p).y + .2 + .24 * road.stepsAt(s) + road.humpAt(s),     // 路缘石的顶面（和入口算路缘高度用的是同一个式子）
    offBridge: (s, margin) => s < road.bridge.s0 - margin || s > road.bridge.s1 + margin,
  };
}

const cache = new WeakMap();
export function roadside(road) {
  if (cache.has(road)) return cache.get(road);
  const { n, ds, pts } = road, p = new THREE.Vector3(), r = new THREE.Vector3();
  const sides = [-1, 1].map(side => {
    const raw = new Float32Array(n + 1), drop = new Float32Array(n + 1), bank = new Float32Array(n + 1), W = 10;
    for (let i = 0; i <= n; i++) { road.at0(i * ds, p); road.right(i * ds, r); raw[i] = p.y - landHeight(p.x + r.x * side * PROBE, p.z + r.z * side * PROBE, ROUND); }
    for (let i = 0; i <= n; i++) {
      let fall = 0;
      for (let a = -W; a <= W; a++) fall += raw[clamp(i + a, 0, n)];
      fall /= 2 * W + 1;                                                                                // 前后五个单位取平均，墙不会忽高忽低
      const s = i * ds, open = 1 - road.onBridge(s), uneven = .74 + .52 * fbm(s / 8 + side * 17.3, 3.3, 2), wall = clamp((-fall - 1.3) * .7, 0, 2.5) * open;
      drop[i] = lerp(GUTTER, Math.max(GUTTER, clamp(.5 + .3 * Math.max(fall, 0), .5, 2.3) * uneven), open);
      bank[i] = wall > .5 ? wall : 0;
    }
    return { drop, bank };
  });

  // 找离 (x, z) 最近的中线点，CELL 以内保证找得到（road.locate 的格子小，十几个单位以外会漏）
  const buckets = new Map(), key = (cx, cz) => cx * 4096 + cz;
  for (let i = 0; i <= n; i += 2) {
    const k = key(Math.floor(pts[i].x / CELL), Math.floor(pts[i].z / CELL));
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(i);
  }
  const hit = { s: 0, d: 0, side: 1 };
  // 返回 { s 弧长, d 离中线的水平距离, side 左(-1) 右(+1) }（每次返回同一个对象）；附近没有路就返回 null
  function locate(x, z) {
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    let best = -1, bd = Infinity;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const list = buckets.get(key(cx + a, cz + b));
      if (list) for (const i of list) { const d = (pts[i].x - x) ** 2 + (pts[i].z - z) ** 2; if (d < bd) { bd = d; best = i; } }
    }
    if (best < 0) return null;
    hit.s = best * ds; hit.d = Math.sqrt(bd); hit.side = 1;
    for (let i = Math.max(0, best - 2); i < Math.min(n, best + 2); i++) {
      const a = pts[i], b = pts[i + 1], ex = b.x - a.x, ez = b.z - a.z, k = clamp(((x - a.x) * ex + (z - a.z) * ez) / (ex * ex + ez * ez));
      const px = a.x + ex * k, pz = a.z + ez * k, dist = Math.hypot(x - px, z - pz);
      if (dist <= hit.d) { hit.d = dist; hit.s = (i + k) * ds; hit.side = ex * (z - pz) - ez * (x - px) > 0 ? 1 : -1; }
    }
    return hit;
  }

  // 弧长 s 处、q 侧（0 左 1 右）的 drop 和 bank
  const edge = (s, q, out = {}) => {
    const f = clamp(s / ds, 0, n - 1e-6), i = Math.floor(f), k = f - i, { drop, bank } = sides[q];
    out.drop = lerp(drop[i], drop[i + 1], k); out.bank = Math.min(bank[i], bank[i + 1]) > 0 ? lerp(bank[i], bank[i + 1], k) : 0;
    return out;
  };
  const reachAt = z => lerp(RIDGE_REACH, ROAD_REACH, smooth(RIDGE_END - 10, RIDGE_END + 40, z));
  const L = {}, R = {};
  // 把天然高度 natural 按路修整：on 是 locate 的结果。桥上不动（桥下是溪谷）
  function shape(on, natural) {
    road.at0(on.s, p);
    const reach = reachAt(p.z);
    if (on.d >= reach) return natural;
    edge(on.s, 0, L); edge(on.s, 1, R);
    const mine = on.side > 0 ? R : L, drop = on.d < WALL_AT ? lerp(L.drop, R.drop, clamp(.5 + .5 * on.side * on.d / WALL_AT)) : mine.drop;
    const raised = mine.bank > 0 && on.d > BANK_BACK, base = p.y - drop + (raised ? mine.bank - .12 : 0), full = mine.bank > 0 ? BANK_BACK + 1.6 : FOOT + .5;
    return lerp(natural, base, smooth(reach, full, on.d) * (1 - road.onBridge(on.s)));
  }

  const out = { sides, locate, edge, shape, reachAt };
  cache.set(road, out);
  return out;
}
