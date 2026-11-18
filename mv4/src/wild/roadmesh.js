// 山路的网格：一块块石头垒出来的路。
//   石阶——每一级是一排三到五块有厚度的条石，前棱磨圆，各块高低、进出差一点点；上一级压着下一级的后沿，立面的根上发暗；
//   平路——大小不一的石板错缝铺成，板与板之间留缝，缝底是土和苔；
//   路缘——两侧各一道长条石，石阶处顺着坡斜下去（垂带），顶面的高度和入口里算路缘高度的式子一致；
//   路缘以下的条石基座、高处一侧的垒石护坡在 roadwalls.js。
// 路面的高度逐排取自 road.surface，小蟹踩的就是石头的顶面。
import * as THREE from 'three';
import { rnd } from '../anim.js';
import { HALF, CURB } from './road.js';
import { shadowed } from './paint.js';
import { StoneSet, stoneMaterial, KIND } from './stone.js';
import { tracer } from './roadside.js';
import { buildWalls } from './roadwalls.js';

const SLAB = 1.25, STAIR_MAX = 1.9;                                  // 平路上一排石板大约多长；两道立面之间比这还长就算平路（要分成几排）
const DOWN = d => new THREE.Vector3(0, -d, 0);

// 沿路把路面切成一排排：石阶的每一级一排，平路每隔一块石板的长度一排。
// 每排：{ s0, s1 起止弧长, y0, y1 两头的路面高度, riser 这一排前沿往下跌多高（0 就是平接）, tight 是不是石阶（石头挨紧）, under 后沿是不是压在上一级底下 }
function rowsOf(road) {
  const E = 2e-3, L = road.length, cuts = [0];
  let prev = road.surface(0);
  for (let s = .02; s <= L; s += .02) {
    const y = road.surface(s);
    if (prev - y > .03) {                                                           // 这 0.02 里有一道立面：二分找准位置
      let lo = s - .02, hi = s;
      for (let k = 0; k < 14; k++) { const m = (lo + hi) / 2; if (road.surface(lo) - road.surface(m) > (prev - y) / 2) hi = m; else lo = m; }
      cuts.push((lo + hi) / 2);
    }
    prev = y;
  }
  cuts.push(L);
  const rows = [];
  let under = false;
  for (let i = 0; i + 1 < cuts.length; i++) {
    const a = cuts[i], b = cuts[i + 1], riser = i + 2 < cuts.length ? road.surface(b - E) - road.surface(b + E) : 0, tight = b - a < STAIR_MAX, n = tight ? 1 : Math.round((b - a) / SLAB);
    const at = j => j === 0 ? a : j === n ? b : a + (b - a) * (j + (rnd(i * 7.7 + j * 3.1) - .5) * .3) / n;
    for (let j = 0; j < n; j++) {
      const s0 = at(j), s1 = at(j + 1);
      rows.push({ s0, s1, y0: road.surface(s0 + E), y1: road.surface(s1 - E), riser: j === n - 1 ? riser : 0, tight, under: j === 0 && under });
    }
    under = riser > 0;
  }
  return rows;
}

export function buildRoadMesh(road) {
  const T = tracer(road), set = new StoneSet(road.length), group = new THREE.Group();
  rowsOf(road).forEach((row, ri) => {
    const stones = set.at(row.s0), count = 3 + Math.floor(rnd(ri * 3.7 + 1.1) * 2.4), cut = [-HALF];
    for (let j = 1; j < count; j++) cut.push(-HALF + 2 * HALF * (j + (rnd(ri * 5.1 + j * 7.3) - .5) * .5) / count);
    cut.push(HALF);
    const gap = row.tight ? .01 : .012 + .02 * rnd(ri * 2.3 + .9), behind = row.under ? .55 : 1;
    for (let j = 0; j < count; j++) {
      const seed = rnd(ri * 9.7 + j * 3.3 + .5), dy = (rnd(seed * 77.7) - .5) * (row.tight ? .02 : .028), tip = (rnd(seed * 51.3) - .5) * .014;
      const back = row.under ? row.s0 - .1 : row.s0 + gap, front = row.s1 - (row.riser > 0 ? .035 * rnd(seed * 31.1) : gap), l = cut[j] + gap, r = cut[j + 1] - gap;
      stones.block(
        [T.point(back, l, row.y0 + dy + tip), T.point(back, r, row.y0 + dy - tip), T.point(front, r, row.y1 + dy - tip), T.point(front, l, row.y1 + dy + tip)], DOWN(row.riser + .12),
        { seed, kind: row.tight ? KIND.stair : KIND.tread, bevel: row.tight ? .02 + .022 * rnd(seed * 17.9) : .03 + .03 * rnd(seed * 17.9),sides: [!row.under, true, true, true], hide: [behind, behind, 1, 1], deep: .42, across: [l / HALF, r / HALF, r / HALF, l / HALF] },
      );
    }
    // 石缝底下的垫层：从缝里看下去是土，不是空的
    const y0 = row.y0 - .075, y1 = row.y1 - .075, up = new THREE.Vector3(0, 1, 0);
    stones.quad([T.point(row.s0 - .1, -HALF, y0), T.point(row.s0 - .1, HALF, y0), T.point(row.s1, HALF, y1), T.point(row.s1, -HALF, y1)], [up, up, up, up], [.5, .5, .5, .5], .5, KIND.bed, [0, 0, 0, 0], up);
  });

  // 路缘石：一条条长石，里侧压住踏面的两端
  for (const side of [-1, 1]) for (let s = 0, k = 0; s < road.length - 1e-6; k++) {
    const len = Math.min(1.5 + .9 * rnd(k * 4.1 + side * 1.7), road.length - s), a = s + .012, b = s + len - .012, inner = side * (HALF - .04), outer = side * (HALF + CURB);
    set.at(s).block([T.point(a, inner, T.curb(a)), T.point(a, outer, T.curb(a)), T.point(b, outer, T.curb(b)), T.point(b, inner, T.curb(b))], DOWN(.85), { seed: rnd(k * 6.7 + side * 3.1 + .2), kind: KIND.curb, bevel: .035, deep: .55 });
    s += len;
  }

  buildWalls(road, set);
  const material = stoneMaterial();
  for (const mesh of set.meshes(material)) group.add(shadowed(mesh, true, true));
  return group;
}
