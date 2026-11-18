// 谷里的人烟摆在哪：村子和院子、零散的几户人家、塔和寺、亭、牌坊、溪上的石桥、湖边的码头和船、路边添的石灯。只算位置，不造网格。
// 都只摆在「能放东西」的地方：离路中线 ROAD_GAP 以外（不挡路，也不进近景机位看小蟹的视线）、离近景机位 SHOT_GAP 以外、不在湖里、不压着溪和梯田。
//   村子——在谷底和缓坡上找平的地方，彼此隔开 VILLAGE_GAP；每个村子顺着坡排成两三行，房子背靠上坡、门朝下坡；有的带一个院子；村口一棵老树、一座牌坊。
//   零散人家——支脊的缓坡、湖岸、溪边，两三户一处。
//   塔立在西北那座孤山顶上，寺在湖西那座孤山上；亭子在湖心的小洲、几座孤山顶和支脊的脊头。
//   溪上的桥：每个挨着溪的村子，在溪离村子最近的地方架一座；码头：湖岸上离村子近的地方，从岸边朝湖心伸出去，旁边拴两条船，湖面上再漂几条。
import * as THREE from 'three';
import { rnd } from '../anim.js';
import { fbm, smooth } from './noise.js';
import { KNOLLS, ISLES, LAKE, WATER, lakeDepth, inBowl, D2R, VALE_END } from './scenerymap.js';
import { MOUTH_Z } from './outland.js';
import { EXIT } from './sceneryexit.js';
import { tracer, WALL_AT } from './roadside.js';

const ROAD_GAP = 24, SHOT_GAP = 100, VILLAGE_GAP = 92, HAMLET_GAP = 50, HOUSE_GAP = 14;
const EXIT_LAMP_GAP = 8;                                             // 古道边的石灯：隔几个中线点一盏（左右交替）
const LAMP_GAP = 30, LAMP_FROM = 29;                                 // 路边添的石灯：和 props.js 的石灯（从 14 起每 30 一盏）错开半个间距

export function planSites(road, terrain, relief, shots, houseSizes) {
  const { groundAt, slopeAt } = terrain, { keep, streams } = relief;
  const close = shots.filter(s => Math.hypot(s.p[0] - s.q[0], s.p[2] - s.q[2]) < 70).flatMap(s => [s.p, s.q]);
  const taken = [];                                                   // 已经占了的地方 [x, z, 半径]
  const clear = (x, z, r) => taken.every(([tx, tz, tr]) => Math.hypot(x - tx, z - tz) > r + tr);
  // 这一处能不能摆东西（pad：东西本身多大）
  const open = (x, z, pad = 0) => {
    const h = groundAt(x, z);
    return (h > 1.6 || z > WATER.z1) && inBowl(x, z) > .5 && keep.roadDist(x, z) > ROAD_GAP + pad && close.every(p => Math.hypot(x - p[0], z - p[2]) > SHOT_GAP) && lakeDepth(x, z) < -.025 &&
      streams.near(x, z).d > 9 + pad && relief.field(x, z, h) < .2 && keep.weight(x, z) > .55 && clear(x, z, pad);
  };
  const downhill = (x, z) => Math.atan2(groundAt(x - 3, z) - groundAt(x + 3, z), groundAt(x, z - 3) - groundAt(x, z + 3));   // 朝下坡的方位（+z 为 0）
  const flatAround = (x, z, r, limit) => [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]].every(([a, b]) => slopeAt(x + a, z + b) < limit);
  const footing = (x, z, w, d, yaw) => {                              // 房子的地坪：四角和中心的平均，往下压一点
    const c = Math.cos(yaw), s = Math.sin(yaw);
    let sum = groundAt(x, z), low = sum;
    for (const [a, b] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) { const g = groundAt(x + a * c + b * s, z - a * s + b * c); sum += g; low = Math.min(low, g); }
    return Math.max(low + .2, sum / 5 - .25);
  };

  const sites = { houses: [], yards: [], villages: [], trees: [], pavilions: [], paifangs: [], bridges: [], piers: [], boats: [], lamps: [], exitLamps: [], exit: [], pagoda: null, temple: null };

  // 古道先占地方：路面上不摆东西；中线（每点 [x, 路面高, z]）留给影片里往山外流的灯火；路边隔一段一盏石灯，水口立一座大牌坊，路从中间穿过去
  {
    const way = relief.exit, heading = i => { const a = way[Math.max(0, i - 1)], b = way[Math.min(way.length - 1, i + 1)]; return Math.atan2(b.x - a.x, b.z - a.z); };
    sites.exit = way.map(p => [p.x, groundAt(p.x, p.z) + EXIT.lift, p.z]);
    way.forEach((p, i) => { if (i % 2 === 0) taken.push([p.x, p.z, EXIT.half + 2.5]); });
    for (let i = 4, k = 0; i < way.length && way[i].z < VALE_END; i += EXIT_LAMP_GAP, k++) {
      const yaw = heading(i), side = k % 2 ? -1 : 1, x = way[i].x + Math.cos(yaw) * side * (EXIT.half + 1.4), z = way[i].z - Math.sin(yaw) * side * (EXIT.half + 1.4);
      sites.exitLamps.push({ x, y: groundAt(x, z), z, yaw: yaw + side * Math.PI / 2 });
    }
    const gate = way.findIndex(p => p.z > MOUTH_Z + 8);
    sites.paifangs.push({ x: way[gate].x, z: way[gate].z, y: groundAt(way[gate].x, way[gate].z) - .2, yaw: heading(gate), scale: 1.5 });
  }

  // 地标再占地方
  {
    const [x, z] = KNOLLS[0];
    sites.pagoda = { x, z, y: groundAt(x, z) - .4, yaw: .3 }; taken.push([x, z, 12]);
  }
  {
    const [x, z] = KNOLLS[1], yaw = downhill(x, z);
    sites.temple = { x, z, y: groundAt(x, z) - .3, yaw }; taken.push([x, z, 30]);
  }
  const pavilionAt = (x, z) => { if (open(x, z, 4) || (lakeDepth(x, z) < -.025 && groundAt(x, z) > 1.6 && clear(x, z, 10))) { sites.pavilions.push({ x, z, y: groundAt(x, z) - .5, yaw: rnd(x * .37 + z) * 6.28 }); taken.push([x, z, 12]); } };
  pavilionAt(ISLES[0][0], ISLES[0][1]);
  for (const k of [2, 4, 5]) pavilionAt(KNOLLS[k][0], KNOLLS[k][1]);
  for (const s of relief.spurs.filter(s => s.len > 150)) { const p = s.pts[s.pts.length - 2]; if (slopeAt(p.x, p.z) < .3) pavilionAt(p.x, p.z); }

  // 村子：在 30 一格的网上找平的地方，按分数挑，彼此隔开。古道起头的地方（湖南岸）一定有一个：渡口村
  const spots = [{ x: relief.exit[0].x + 24, z: relief.exit[0].z + 6, score: 9 }];
  for (let z = 380; z < VALE_END; z += 30) for (let x = -560; x < 560; x += 30) {
    const jx = x + 12 * (rnd(x * .13 + z * .71) - .5), jz = z + 12 * (rnd(x * .57 + z * .19) - .5), h = groundAt(jx, jz);
    if (h > 135 || !flatAround(jx, jz, 14, .28) || slopeAt(jx, jz) > .2 || !open(jx, jz, 8)) continue;
    const shore = smooth(-.3, -.06, lakeDepth(jx, jz)), fields = relief.field(jx + 40, jz, h) + relief.field(jx - 40, jz, h) + relief.field(jx, jz + 40, h) + relief.field(jx, jz - 40, h);
    spots.push({ x: jx, z: jz, score: rnd(jx * .31 + jz * .17) + .6 * shore + .3 * Math.min(fields, 2) + .3 * smooth(80, 10, h) });
  }
  spots.sort((a, b) => b.score - a.score);
  const villages = [];
  for (const s of spots) if (villages.every(v => Math.hypot(v.x - s.x, v.z - s.z) > VILLAGE_GAP) && villages.length < 26) villages.push(s);

  // 一处人家：在 c 周围按行排 n 户
  const settle = (cx, cz, n, rows, tag) => {
    const axis = Math.round(downhill(cx, cz) / (Math.PI / 4)) * (Math.PI / 4) + (rnd(cx + cz) - .5) * .3, ax = Math.sin(axis), az = Math.cos(axis);
    const slots = [];
    for (let r = -rows; r <= rows; r++) for (let c = -4; c <= 4; c++) slots.push([c * 17 + 5 * (rnd(cx * .3 + r * 7 + c) - .5), r * 21 + 5 * (rnd(cz * .3 + r * 3 + c * 5) - .5)]);
    slots.sort((a, b) => Math.hypot(...a) - Math.hypot(...b));
    const placed = [];
    for (const [c, r] of slots) {
      if (placed.length >= n) break;
      const x = cx + c * az + r * ax, z = cz - c * ax + r * az, h = groundAt(x, z), seed = rnd(x * .71 + z * .37);
      if (slopeAt(x, z) > .3 || !open(x, z, 5)) continue;
      const style = h > 105 || (slopeAt(x, z) > .22 && seed < .45) ? 'timber' : seed < .3 ? 'horse' : 'white', variant = Math.floor(rnd(seed * 9.1) * houseSizes[style].length), [w, d] = houseSizes[style][variant];
      const yaw = axis + (rnd(seed * 3.3) - .5) * .25, y = footing(x, z, w, d, yaw);
      const house = { x, z, y, yaw, style, variant, w, d, village: tag };
      // 院子：屋前围一圈矮墙（先看屋前那块地空不空，再把房子占上）
      const fx = x + Math.sin(yaw) * (d / 2 + 4), fz = z + Math.cos(yaw) * (d / 2 + 4), yard = style === 'white' && rnd(seed * 5.7) < .55 && open(fx, fz, 3) && slopeAt(fx, fz) < .25;
      sites.houses.push(house); placed.push(house); taken.push([x, z, HOUSE_GAP / 2]);
      if (yard) { sites.yards.push({ x: x + Math.sin(yaw) * d / 2, z: z + Math.cos(yaw) * d / 2, y: y - .1, yaw, w: w + 1, depth: 7, village: tag }); taken.push([fx, fz, 4]); }
    }
    return placed;
  };
  villages.forEach((v, i) => {
    const n = 5 + Math.floor(rnd(i * 3.7 + 1) * 8 + 4 * v.score), placed = settle(v.x, v.z, n, 1, i);
    if (placed.length < 3) return;
    const cx = placed.reduce((s, p) => s + p.x, 0) / placed.length, cz = placed.reduce((s, p) => s + p.z, 0) / placed.length;
    const village = { x: cx, z: cz, y: groundAt(cx, cz), houses: placed.length, reach: 20 + 3 * placed.length, tag: i };
    sites.villages.push(village);
    // 村口的老树：村子下坡那一头
    const axis = downhill(cx, cz);
    for (const out of [26, 34, 42]) { const tx = cx + Math.sin(axis) * out, tz = cz + Math.cos(axis) * out; if (open(tx, tz, 3)) { sites.trees.push({ x: tx, z: tz, kind: 'broad', form: 'oak', scale: 1.5 + .3 * rnd(i * 5.1), yaw: rnd(i * 1.7) * 6.28 }); taken.push([tx, tz, 5]); break; } }
    // 大一点的村子村口立一座牌坊
    if (placed.length >= 6) for (const out of [38, 48, 58]) { const px = cx + Math.sin(axis) * out, pz = cz + Math.cos(axis) * out; if (open(px, pz, 7) && slopeAt(px, pz) < .2) { sites.paifangs.push({ x: px, z: pz, y: groundAt(px, pz) - .2, yaw: axis, scale: 1 }); taken.push([px, pz, 8]); break; } }
  });
  // 零散人家
  const hamlets = [];
  for (const s of spots.slice().reverse()) if (hamlets.length < 40 && [...villages, ...hamlets].every(v => Math.hypot(v.x - s.x, v.z - s.z) > HAMLET_GAP)) hamlets.push(s);
  for (let z = 400; z < VALE_END; z += 22) for (let x = -560; x < 560; x += 22) {
    if (hamlets.length >= 60) break;
    const jx = x + 9 * (rnd(x * .23 + z * .41) - .5), jz = z + 9 * (rnd(x * .67 + z * .29) - .5);
    if (slopeAt(jx, jz) > .26 || !flatAround(jx, jz, 9, .32) || !open(jx, jz, 6) || rnd(jx * .11 + jz * .07) > .35) continue;
    if ([...villages, ...hamlets].every(v => Math.hypot(v.x - jx, v.z - jz) > HAMLET_GAP)) hamlets.push({ x: jx, z: jz });
  }
  hamlets.forEach((h, i) => { const placed = settle(h.x, h.z, 2 + Math.floor(rnd(i * 7.9) * 3), 0, 100 + i); if (placed.length) sites.villages.push({ x: h.x, z: h.z, y: groundAt(h.x, h.z), houses: placed.length, reach: 12 + 3 * placed.length, tag: 100 + i }); });

  // 溪上的桥
  for (const v of sites.villages) {
    const hit = streams.near(v.x, v.z);
    if (hit.d > 75) continue;
    const s = streams.list[hit.s], p = s.pts[hit.i], q = s.pts[hit.i + 1], flow = Math.atan2(q.x - p.x, q.z - p.z);
    if (s.pts[hit.i].steep > .25 || sites.bridges.some(b => Math.hypot(b.x - p.x, b.z - p.z) < 60)) continue;
    const across = flow + Math.PI / 2, bank = (groundAt(p.x + Math.sin(across) * 9, p.z + Math.cos(across) * 9) + groundAt(p.x - Math.sin(across) * 9, p.z - Math.cos(across) * 9)) / 2;
    sites.bridges.push({ x: p.x, z: p.z, y: Math.min(bank, p.y + 3.5) - 1.2, yaw: across - Math.PI / 2, span: 9 });
  }
  // 码头和船：沿湖岸找离村子近的地方
  for (let a = 0; a < 360; a += 6) {
    const dx = Math.cos(a * D2R) * LAKE.rx, dz = Math.sin(a * D2R) * LAKE.rz;
    let k = 0;
    while (k < 1.6 && lakeDepth(LAKE.x + dx * k, LAKE.z + dz * k) > 0) k += .01;
    const x = LAKE.x + dx * k, z = LAKE.z + dz * k, v = sites.villages.find(v => Math.hypot(v.x - x, v.z - z) < 85);
    if (!v || keep.roadDist(x, z) < 40 || close.some(p => Math.hypot(x - p[0], z - p[2]) < SHOT_GAP) || sites.piers.some(p => Math.hypot(p.x - x, p.z - z) < 70)) continue;
    const yaw = Math.atan2(LAKE.x - x, LAKE.z - z), len = 14 + 8 * rnd(a * .37);
    sites.piers.push({ x, z, y: 0, yaw, len });
    for (const side of [-1, 1]) sites.boats.push({ x: x + Math.sin(yaw) * len * .7 + Math.cos(yaw) * side * 3.6, z: z + Math.cos(yaw) * len * .7 - Math.sin(yaw) * side * 3.6, yaw: yaw + Math.PI / 2 + side * .15, drift: 0 });
  }
  for (let i = 0; sites.boats.length < sites.piers.length * 2 + 9 && i < 200; i++) {
    const x = LAKE.x + (rnd(i * 3.1) - .5) * LAKE.rx * 1.7, z = LAKE.z + (rnd(i * 5.7) - .5) * LAKE.rz * 1.7;
    if (lakeDepth(x, z) > .3 && ISLES.every(([ix, iz, r]) => Math.hypot(x - ix, z - iz) > r * 2.5) && keep.roadDist(x, z) > 60) sites.boats.push({ x, z, yaw: rnd(i * 7.7) * 6.28, drift: 1 });
  }
  // 路边添的石灯：在 props.js 的两盏之间，近景机位附近不添
  const T = tracer(road);
  for (let s = LAMP_FROM, k = 0; s < road.length - 4; s += LAMP_GAP, k++) {
    if (!T.offBridge(s, 8)) continue;
    const sign = k % 2 ? -1 : 1, at = T.point(s, sign * (WALL_AT + .5), T.curb(s) - .06), t = road.tangent(s, new THREE.Vector3());
    if (close.some(p => Math.hypot(at.x - p[0], at.z - p[2]) < 110)) continue;
    sites.lamps.push({ x: at.x, y: at.y, z: at.z, yaw: Math.atan2(t.x, t.z) + sign * Math.PI / 2 });
  }
  sites.taken = taken;
  // 树要让开的地方
  sites.blocked = (x, z) => taken.some(([tx, tz, tr]) => Math.hypot(x - tx, z - tz) < tr + 3.5);
  return sites;
}

// 灯火的颜色要不要更暖一些，各处用的灯光强度（给 scenery.js 的光晕用）：fbm 让村子之间亮暗有别
export const villageWarmth = (x, z) => .75 + .5 * fbm(x / 200 + 3.1, z / 200 + 7.7, 2);
