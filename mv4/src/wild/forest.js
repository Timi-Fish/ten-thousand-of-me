// 树林：按地势把树种到山上，用实例化成片地画。
// 山梁以内的南坡是阔叶林（成片的枫、橡、黄栌，秋天满山红黄），林子里夹着松；低处靠近湖和路的地方成片的桃树，缓坡上几片竹林；
// 湖岸一圈垂柳，湖边的路旁一排；小屋前几株梅、屋后一片竹；山顶亭边的树池里一棵探出去的松；路两旁隔几步一丛灌木。山梁以外只有高出云海的山头、石峰的平台上站着松，陡处的松朝崖外探出去。
// 林子有疏密（密的地方挤着长，疏的地方露出草坡）、有高矮（老林子高、幼林矮），不是匀匀地撒。
// 三档：离路 NEAR 以内用精细档，MID 以内用中档，更远的用精简档（不投影）。树按地块分组实例化，镜头外的地块整块不画。
// 每棵树脚下还有一圈东西让它「长在」地上（草、落叶、贴地的暗影），在 roots.js。
import * as THREE from 'three';
import { rnd } from '../anim.js';
import { fbm, smooth } from './noise.js';
import { cloudSea } from './outland.js';
import { WATER } from './scenerymap.js';
import { RIDGE_END } from './road.js';
import { shadowed } from './paint.js';
import { buildTreeShapes } from './trees.js';
import { treeMaterial } from './foliage.js';
import { buildRoots } from './roots.js';
import { PINE_SPOT } from './pavilion.js';
import { standTree } from './sceneryforest.js';

const STEP = 8.5, CELL = 170, NEAR = 25, MID = 64;                  // 撒点的间距；分组地块的大小；离路多近算近景、中景
const FAR_SCALE = .8;                                               // 离路远的树只在大远景里看得见，种得小一些：树小，山才显得高
const AREA = { x0: -660, x1: 660, z0: -430, z1: 1800 };
const CLEAR = { pine: 10.5, broad: 10.5, peach: 8.4, willow: 8.4, plum: 7.6, bamboo: 8.4, shrub: 6.9 };   // 树干离路的中线至少多远（树冠可以探到路上方）

// shots：推荐机位。近景机位从镜头到它看的那一点（再往后延一半）之间不种树，免得树冠糊在镜头上、挡住小蟹身后的景
// relief：大远景的山形（离路远的地方林子按林分长，sceneryforest.js）；sites：谷里的人烟（房子、院子、塔寺占的地方不种树，村口种一棵老树）
export function buildForest(road, terrain, plan, creek, shots, relief, sites) {
  const { groundAt, slopeAt } = terrain, shapes = buildTreeShapes(), trees = [];
  const lanes = shots.filter(s => Math.hypot(s.p[0] - s.q[0], s.p[2] - s.q[2]) < 70);
  const inLane = (x, z) => lanes.some(({ p, q }) => {
    const ex = q[0] - p[0], ez = q[2] - p[2], k = Math.min(1.5, Math.max(-.25, ((x - p[0]) * ex + (z - p[2]) * ez) / (ex * ex + ez * ez)));
    return Math.hypot(x - p[0] - ex * k, z - p[2] - ez * k) < 7.5;
  });
  // 离路多远：近处用路自己的算法（准），远处粗量（每 4 个单位取一个点）
  const marks = road.pts.filter((_, i) => i % 8 === 0);
  const roadAway = (x, z) => { const on = road.locate(x, z); return on ? on.d : Math.sqrt(marks.reduce((best, p) => Math.min(best, (p.x - x) ** 2 + (p.z - z) ** 2), Infinity)); };
  const bridgeZ = road.at0(road.bridge.s0, new THREE.Vector3()).z;
  const nearCreek = (x, z) => creek.pts.some((p, i) => i % 3 === 0 && Math.hypot(p.x - x, p.z - z) < (p.z < bridgeZ + 8 ? 15 : 6.5));   // 桥以上的溪谷敞开，从桥上望得见瀑布
  const onPad = (x, z) => plan.pads.some(pad => Math.hypot(pad.x - x, pad.z - z) < pad.r + 3) || plan.clearings.some(c => Math.hypot(c.x - x, c.z - z) < c.r);   // 建筑的地基上、留出来的空地上不种
  const downhill = (x, z) => Math.atan2(groundAt(x, z + 2) - groundAt(x, z - 2), groundAt(x - 2, z) - groundAt(x + 2, z));          // 把树的 +x 对着下坡要转的角度
  // placed：特意摆好位置的（小屋前的梅），不受「机位前、屋基旁不种树」的限制
  const add = (kind, form, x, z, scale, seed, yaw = seed * 40, placed = false) => {
    const away = roadAway(x, z);
    if (!placed && (away < CLEAR[kind] || inLane(x, z) || onPad(x, z) || sites.blocked(x, z))) return;
    const tier = away < NEAR ? 'near' : away < MID ? 'mid' : 'far';
    trees.push({ kind, form, tier, x, y: groundAt(x, z) - .15, z, scale: tier === 'far' ? scale * FAR_SCALE : scale, seed, yaw });
  };
  // 松的长相看坡度：陡坡上贴着崖探出去，斜坡上斜着长，平处多是直的
  const addPine = (x, z, slope, pick, scale, seed) => { const form = slope > .42 ? 'crag' : slope > .28 || pick < .07 ? 'lean' : 'tall'; add('pine', form, x, z, scale, seed, form === 'tall' ? seed * 40 : downhill(x, z)); };

  // 撒点：一个格子一个候选点，按地势决定种不种、种什么
  let n = 0;
  for (let gz = AREA.z0; gz < AREA.z1; gz += STEP) for (let gx = AREA.x0; gx < AREA.x1; gx += STEP) {
    n++;
    const x = gx + STEP * rnd(n * 1.31 + .7), z = gz + STEP * rnd(n * 2.17 + 3.3), h = groundAt(x, z);
    if (h < .8 && z < WATER.z1) continue;                                                            // 湖里不种（出谷的谷底低过湖面，照样长树）
    const slope = slopeAt(x, z), pick = rnd(n * 3.71 + 9.1), seed = rnd(n * 5.93 + 1.7), grove = fbm(x / 70 + 7.1, z / 70 + 3.3, 3), bowl = cloudSea(x, z) < .5 && z > RIDGE_END;
    const scale = (.62 + .7 * rnd(n * 7.7 + 4.3) ** 1.5) * (.82 + .4 * smooth(.35, .7, fbm(x / 120 + 31.1, z / 120 + 12.7, 2)));
    if (slope > .74 || nearCreek(x, z)) continue;
    if (!bowl) { if (h > 96 && pick < (slope > .62 ? .3 : .2 + .6 * smooth(.4, .6, grove))) addPine(x, z, slope, pick, scale, seed); continue; }   // 山梁以外：山头和石峰上的松，绝壁上也零星探出几棵
    // 离路远的地方：按林分长（林缘、草甸、孤松），避开溪、梯田
    if (relief.keep.forest(x, z) > .35 + .5 * rnd(n * 2.3 + .9) && h > 4.6) {
      const stream = relief.streams.near(x, z).d;
      if (stream < 6 || relief.field(x, z, h) > .15) continue;
      const ridge = h - .25 * (groundAt(x + 25, z) + groundAt(x - 25, z) + groundAt(x, z + 25) + groundAt(x, z - 25));
      const home = sites.villages.reduce((m, v) => Math.max(m, Math.exp(-((x - v.x) ** 2 + (z - v.z) ** 2) / (v.reach + 50) ** 2)), 0);
      const t = standTree(x, z, h, slope, ridge, smooth(32, 8, stream), home, seed);
      if (t) t.kind === 'pine' ? add('pine', t.form, x, z, t.scale, seed, t.form === 'tall' ? seed * 40 : downhill(x, z)) : add(t.kind, t.form, x, z, t.scale, seed);
      if (t && t.kind === 'bamboo') add('bamboo', 'clump', x + STEP * .5, z + STEP * (rnd(n * 8.3) - .5), t.scale, rnd(n * 4.1));
      continue;
    }
    if (slope > .62) continue;
    if (h < 4.6) { if (slope < .3 && rnd(n * 4.9 + 6.1) < .3) add('willow', 'weeping', x, z, .85 + .35 * seed, seed); continue; }   // 湖岸的垂柳
    if (roadAway(x, z) < NEAR && pick > .66) continue;                                               // 路边留出空，不把路堵死
    if (pick > .1 + .9 * smooth(.34, .56, grove)) continue;                                          // 林子成片：密的地方挤着长，疏的地方露出草坡
    if (slope > .5) { if (pick < .5) addPine(x, z, slope, pick, scale, seed); continue; }
    const kindOf = fbm(x / 90 + 13.3, z / 90 + 44.1, 2) + (rnd(n * 6.7 + 1.9) - .5) * .12;
    if (h > 6 && h < 190 && slope < .36 && fbm(x / 34 + 71.3, z / 34 + 28.8, 2) > .715) {            // 竹林：一格两丛，挤着长
      add('bamboo', 'clump', x, z, .8 + .4 * seed, seed);
      add('bamboo', 'clump', x + STEP * .5, z + STEP * (rnd(n * 8.3) - .5), .8 + .4 * rnd(n * 2.9), rnd(n * 4.1));
    } else if (h < 80 && slope < .4 && fbm(x / 55 + 51.3, z / 55 + 8.8, 2) > .54) add('peach', 'open', x, z, scale, seed);
    else if (rnd(n * 9.3 + 2.2) < .82 && slope < .44) add('broad', kindOf > .55 ? 'maple' : kindOf < .44 ? 'smoke' : 'oak', x, z, scale, seed);
    else addPine(x, z, slope, pick, scale, seed);
  }
  // 村口的老树；主峰顶上和山脊两肩崖沿上的松（scenerypeak.js 挑好了位置，崖上的朝崖外探出去）
  sites.trees.forEach((t, i) => add(t.kind, t.form, t.x, t.z, t.scale, rnd(i * 3.9 + .2), t.yaw, true));
  // 湖边那段路：靠水的一侧一排垂柳，另一侧隔几步一棵桃
  const p = new THREE.Vector3(), r = new THREE.Vector3();
  for (let s = road.length - 6, k = 0; s > road.length - 215; s -= 15.5, k++) {
    road.at0(s, p); road.right(s, r);
    const off = 8.6 + 3 * rnd(k * 3.3 + 1), x = p.x - r.x * off, z = p.z - r.z * off;
    if (groundAt(x, z) > .5) add('willow', 'weeping', x, z, .95 + .3 * rnd(k * 7.1), rnd(k * 2.9 + 5));
    if (k % 2 === 0) add('peach', 'open', p.x + r.x * (8.6 + 4 * rnd(k * 4.7)), p.z + r.z * (8.6 + 4 * rnd(k * 4.7)), 1 + .25 * rnd(k * 6.1), rnd(k * 8.3));
  }
  // 小屋：屋前路边一株梅，往下山方向再两株；屋后一片竹
  const hs = road.locate(plan.hut.x, plan.hut.z).s;
  [[10, 7.7, 1.15, .37], [27, 8.6, .95, .71], [41, -9, 1.05, .13]].forEach(([ahead, side, scale, seed]) => { road.at0(hs + ahead, p); road.right(hs + ahead, r); add('plum', 'old', p.x - r.x * side, p.z - r.z * side, scale, seed, seed * 40, true); });
  road.at0(hs, p);
  const back = new THREE.Vector3(plan.hut.x - p.x, 0, plan.hut.z - p.z).normalize();
  for (let i = 0; i < 16; i++) {
    const out = 14.5 + 9 * rnd(i * 3.7 + 2), along = (i / 15 - .5) * 34 + 3 * rnd(i * 5.1);
    add('bamboo', 'clump', plan.hut.x + back.x * out - back.z * along, plan.hut.z + back.z * out + back.x * along, .85 + .35 * rnd(i * 7.3), rnd(i * 9.7 + 1));
  }

  // 山顶亭边树池里的那棵松：斜着朝亭外探出去
  add('pine', 'lean', plan.pavilion.x + PINE_SPOT.x, plan.pavilion.z + PINE_SPOT.z, 1.05, .43, Math.atan2(-PINE_SPOT.z, PINE_SPOT.x), true);
  Object.assign(trees[trees.length - 1], { y: plan.pavilion.y - .05, potted: true });                  // 长在石砌的树池里：脚下不围草
  // 路边的灌木：隔几步一丛，成片地有、成片地没有，填在草和树之间那一层（主峰的石头山上、桥头不种）
  for (let s = 20, k = 0; s < road.length - 4; s += 4.5, k++) {
    road.at0(s, p); road.right(s, r);
    if (p.z < RIDGE_END || (s > road.bridge.s0 - 6 && s < road.bridge.s1 + 6)) continue;
    for (const side of [-1, 1]) {
      const off = 7 + 5.5 * rnd(k * 3.9 + side), x = p.x + r.x * side * off, z = p.z + r.z * side * off;
      if (rnd(k * 6.3 + side * 2.1) < .5 && fbm(x / 17 + 9.9, z / 17 + 4.4, 2) > .46 && groundAt(x, z) > 1.2 && slopeAt(x, z) < .5) add('shrub', 'bush', x, z, .8 + .5 * rnd(k * 2.7 + side), rnd(k * 8.1 + side * 1.3));
    }
  }

  // 实例化：按（树种、档、长相、第几棵、地块）分组
  const groups = new Map(), group = new THREE.Group(), m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  for (const t of trees) {
    const pool = shapes[t.kind][t.tier].filter(g => g.userData.form === t.form), copy = Math.floor(t.seed * 977) % pool.length, key = `${t.kind}|${t.tier}|${t.form}|${copy}|${Math.floor(t.x / CELL)}|${Math.floor(t.z / CELL)}`;
    if (!groups.has(key)) groups.set(key, { geo: pool[copy], mat: treeMaterial(t.kind), cast: t.tier !== 'far', name: `${t.kind} ${t.tier}`, items: [] });
    groups.get(key).items.push(t);
  }
  let tris = 0;
  for (const { geo, mat, cast, name, items } of groups.values()) {
    const g = new THREE.BufferGeometry();                                                            // 顶点数据和同样的树共用，只有每棵各自的 aSeed 是这一组自己的
    for (const [name, attribute] of Object.entries(geo.attributes)) g.setAttribute(name, attribute);
    g.boundingSphere = geo.boundingSphere;
    g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(Float32Array.from(items, t => t.seed), 1));
    const mesh = new THREE.InstancedMesh(g, mat, items.length);
    mesh.name = name;
    items.forEach((t, i) => mesh.setMatrixAt(i, m.compose(p.set(t.x, t.y, t.z), q.setFromAxisAngle(up, t.yaw), r.set(t.scale, t.scale * (.9 + .2 * t.seed), t.scale))));
    group.add(shadowed(mesh, cast, true));
    tris += g.attributes.position.count / 3 * items.length;
  }
  group.add(buildRoots(trees, terrain, road));
  group.userData.trees = trees;                                                                      // 自查页（preview-tree.js）用它找各种树在哪
  return { group, trees, tris };
}
