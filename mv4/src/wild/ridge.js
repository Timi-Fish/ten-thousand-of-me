// 山脊石阶一带的布景：主峰南面那道刀背山脊上，石阶两边的陡坡长满了东西，风从山脊上一阵阵刮过去。
// 这里是入口：按 ridgeplace.js 定的范围和密度，把各部分种到坡上、摆到石阶边，装成网格，交给 wild.js。
//   坡面——ridgeground.js：贴着地的一层（草茬、裸土、碎石、苔、落叶的颜色和笔触），把地形底色的平涂盖住，远看连成有深浅的一片。
//   草本——ridgeherbs.js：芒草成丛、矮草丛填空，野菊紫菀一簇簇，背阴处蕨和苔垫，背风处落叶堆。
//   石头——ridgerocks.js：成组的露头岩（一块大的带几块小的，层理一致）、草里的孤石、满坡的碎石；石顶和石缝里长草、长小松。
//   树——ridgeflora.js 的灌木（红、橙黄、紫红三种）、旗形树冠的红枫和黄栌、枯树；evergreens.js 的松（朝崖外、朝下风探）。
//   石阶边——ridgestair.js：台阶角落的落叶、缝里的苔和草、路标石、栏杆上系的祈福红绸。
//   风和空气——ridgewind.js：成群横掠的落叶、草屑和尘，贴着山坡走的薄云。
// 所有东西按沿路的段分组，镜头离得远的段不画（wild.js 每帧按镜头位置开关），大远景里这一带和原来一样。
import * as THREE from 'three';
import { rnd } from '../anim.js';
import { fbm, smooth, clamp } from './noise.js';
import { shadowed } from './paint.js';
import { SEASONS } from './seasons.js';
import { DETAIL } from './plant.js';
import { pine } from './evergreens.js';
import { treeMaterial } from './foliage.js';
import { ridgePlace } from './ridgeplace.js';
import { ridgeHerbShapes, ridgeHerbMaterial, herbMesh } from './ridgeherbs.js';
import { rockShapes, rockMesh } from './ridgerocks.js';
import { FLORA, floraShapes, floraMesh } from './ridgeflora.js';
import { buildRidgeGround } from './ridgeground.js';
import { buildRidgeStair } from './ridgestair.js';
import { buildRidgeWind } from './ridgewind.js';

const CHUNK = 45;                                                    // 沿路每多长分一组
const WIND = SEASONS.秋.u.uWind, DOWNWIND = Math.atan2(-WIND[1], WIND[0]);   // 常年的风往哪边吹：实例绕 y 转这个角，造型的 +x 就朝着下风
const TAU = Math.PI * 2;

export function buildRidge(road, terrain, shots) {
  const P = ridgePlace(road, terrain.groundAt, shots), { surfaceAt, normalAt, blocks, cameraSide, scatter } = P;
  const group = new THREE.Group(), culled = [], bins = new Map(), nrm = new THREE.Vector3();
  // 收一个实例：kind 是分组的名字（同名同造型的进一个网格），s 是它在哪段路边，reach 镜头多远以内才画
  const put = (kind, copy, s, reach, item) => {
    const key = `${kind}|${copy}|${Math.floor(s / CHUNK)}`;
    if (!bins.has(key)) bins.set(key, { kind, copy, s: (Math.floor(s / CHUNK) + .5) * CHUNK, reach, items: [] });
    bins.get(key).items.push(item);
  };
  const slopeOf = (x, z) => 1 - normalAt(x, z, nrm).y;
  const downhillYaw = (x, z) => { normalAt(x, z, nrm); return Math.atan2(-nrm.z, nrm.x); };          // 绕 y 转这个角，+x 朝下坡
  const lean = (x, z, k) => normalAt(x, z, new THREE.Vector3()).lerp(new THREE.Vector3(0, 1, 0), k).normalize();   // 贴着坡长的东西：朝上的方向在坡面法线和竖直之间
  const rocksOut = [];                                                                                   // 摆好的石头（草和小松要长在石顶、石缝里，草丛要让开石头）

  // —— 石头：露头岩先摆，草木绕着它们长 ——
  scatter({ ds: 5.5, dO: 5.5, o0: 7, o1: 50, salt: 11.7 }, (x, z, s, o, k, w) => {
    const slope = slopeOf(x, z), crag = smooth(.25, .6, slope), spot = fbm(x / 23 + 4.1, z / 23 + 9.3, 2);
    if (slope > .58) return;                                                                           // 崖壁上坐不住石头（鲫鱼背两侧是近乎直立的崖）
    const backdrop = !cameraSide(s, o) && Math.abs(o) < 26 && w > .8 ? .3 : 0;                         // 机位对面、石阶背后那面坡上多几组，画面里看得见
    if (rnd(k * 2.3) > w * (.12 + .5 * crag + backdrop) * smooth(.36, .6, spot + .2 * crag + backdrop)) return;
    const big = 1.6 + 3.4 * rnd(k * 3.7) ** 1.3 * (.6 + .6 * crag), yaw = rnd(k * 5.1) * TAU, tilt = [(rnd(k * 6.1) - .5) * .12, (rnd(k * 7.3) - .5) * .12];
    const n = 1 + Math.floor(rnd(k * 8.9) * 3.4);
    for (let i = 0; i <= n; i++) {
      const a = yaw + i * 2.2 + rnd(k * 9.7 + i), d = i === 0 ? 0 : big * (.9 + .8 * rnd(k * 4.4 + i)), rx = x + Math.cos(a) * d, rz = z + Math.sin(a) * d;
      const on = road.locate(rx, rz);
      if (on && on.d < 7) continue;
      const wide = (i === 0 ? big : big * (.25 + .45 * rnd(k * 1.9 + i))) * (.8 + .4 * rnd(k * 2.7 + i)), tall = wide * (.45 + .45 * rnd(k * 3.9 + i)), deep = wide * (.6 + .5 * rnd(k * 5.3 + i));
      // 坡上的石头顺着坡躺一半（层理跟着斜一点，像岩层露头），剩下那一半坡度靠往下埋
      const up = lean(rx, rz, .5), rest = Math.tan(Math.acos(clamp(up.dot(normalAt(rx, rz, nrm)), .3, 1))), sink = rest * Math.max(wide, deep) * .85 + .12 * tall;
      if (blocks(rx, surfaceAt(rx, rz) + tall * .5, rz, wide)) continue;
      const it = { x: rx, y: surfaceAt(rx, rz) - sink, z: rz, yaw: yaw + (rnd(k * 6.6 + i) - .5) * .8, tilt, up, size: [wide, tall + sink, deep], seed: rnd(k * 7.7 + i) };
      const tier = wide > 2.4 && w > .6 && Math.abs(o) < 34 ? 'hero' : wide > .8 ? 'mid' : 'small';
      put(`rock-${tier}`, Math.floor(rnd(k * 3.1 + i) * 4), s, tier === 'hero' ? 520 : tier === 'mid' ? 260 : 120, it);
      rocksOut.push({ x: rx, z: rz, r: Math.max(wide, deep) * .85, top: it.y + it.size[1] * 1, wide, s, seed: k + i });
    }
  });
  const onRock = (x, z) => rocksOut.some(r => Math.hypot(r.x - x, r.z - z) < r.r * .85);
  // 碎石：满坡零零星星，坡上散的、沟里攒的
  scatter({ ds: 1.6, dO: 1.6, o0: 6.6, o1: 40, salt: 23.9 }, (x, z, s, o, k, w) => {
    if (rnd(k * 1.7) > w * .22 * smooth(.4, .7, fbm(x / 9 + 2.2, z / 9 + 5.5, 2) + .3 * slopeOf(x, z)) || onRock(x, z)) return;
    const size = .14 + .5 * rnd(k * 3.3) ** 2;
    put('rock-small', Math.floor(rnd(k * 2.1) * 4), s, 90, { x, y: surfaceAt(x, z) - size * .25, z, up: lean(x, z, .4), yaw: rnd(k * 4.7) * TAU, tilt: [(rnd(k * 5.9) - .5) * .5, (rnd(k * 6.3) - .5) * .5], size: [size, size * (.5 + .4 * rnd(k * 7.1)), size * (.7 + .4 * rnd(k * 8.3))], seed: rnd(k * 9.1) });
  });

  // —— 草本 ——
  const grassy = (x, z) => fbm(x / 8.5 + 7.7, z / 8.5 + 1.3, 3) * .75 + fbm(x / 31 + 3.1, z / 31 + 6.2, 2) * .25;   // 草一片一片：高的地方成丛，低的地方露土和石
  scatter({ ds: .85, dO: .85, o0: 6.6, o1: 34, salt: 31.3 }, (x, z, s, o, k, w) => {
    const slope = slopeOf(x, z), g = grassy(x, z), far = Math.abs(o) > 17 || w < .8;
    if (onRock(x, z) || slope > .82) return;
    const y = surfaceAt(x, z) - .05, pick = rnd(k * 2.9);
    if (pick < w * smooth(.3, .55, g) * (1 - .5 * smooth(.6, .82, slope)) * (far ? .35 : .72)) {
      const tall = (.75 + .5 * rnd(k * 4.1)) * (.8 + .4 * g);
      if (blocks(x, y + tall, z, .6)) return;
      put(far ? 'plumeLite' : 'plume', Math.floor(rnd(k * 5.3) * (far ? 2 : 4)), s, far ? 240 : 120, { x, y, z, yaw: DOWNWIND + (rnd(k * 6.7) - .5) * 1.1, scale: .85 + .4 * rnd(k * 7.9), tall, up: lean(x, z, .75), seed: rnd(k * 8.3) });
    } else if (pick < w * (.08 + .3 * smooth(.3, .5, g))) {
      put('tussock', Math.floor(rnd(k * 5.3) * 3), s, 110, { x, y, z, yaw: rnd(k * 6.7) * TAU, scale: .8 + .6 * rnd(k * 7.9), tall: .8 + .4 * g, up: lean(x, z, .6), seed: rnd(k * 8.3) });
    }
  });
  // 野菊、紫菀：成片地有
  scatter({ ds: 1.3, dO: 1.3, o0: 6.6, o1: 30, salt: 41.9 }, (x, z, s, o, k, w) => {
    if (onRock(x, z) || slopeOf(x, z) > .75 || rnd(k * 1.3) > w * .36 * smooth(.55, .7, fbm(x / 13 + 8.8, z / 13 + 3.4, 2))) return;
    put('asters', Math.floor(rnd(k * 2.7) * 3), s, 90, { x, y: surfaceAt(x, z) - .03, z, yaw: rnd(k * 3.9) * TAU, scale: .8 + .5 * rnd(k * 4.3), tall: 1, up: lean(x, z, .7), seed: rnd(k * 5.7) });
  });
  // 蕨和苔垫：背着日头的坡、石头根上
  const sunDir = new THREE.Vector3(...SEASONS.秋.sunDir).normalize();
  scatter({ ds: 1.5, dO: 1.5, o0: 6.6, o1: 34, salt: 53.3 }, (x, z, s, o, k, w) => {
    const n = normalAt(x, z, nrm), shade = smooth(.1, -.4, n.x * sunDir.x + n.z * sunDir.z), nearRock = rocksOut.some(r => Math.abs(Math.hypot(r.x - x, r.z - z) - r.r) < 1.2);
    if (onRock(x, z)) return;
    const y = surfaceAt(x, z) - .04, damp = fbm(x / 11 + 1.7, z / 11 + 6.9, 2) + .3 * shade + (nearRock ? .25 : 0);
    if (rnd(k * 2.1) < w * .45 * smooth(.62, .8, damp)) put('fern', Math.floor(rnd(k * 3.3) * 3), s, 100, { x, y, z, yaw: rnd(k * 4.9) * TAU, scale: .7 + .5 * rnd(k * 5.1), tall: 1, up: lean(x, z, .4), seed: rnd(k * 6.3) });
    else if (rnd(k * 7.7) < w * (nearRock ? .5 : .12) * smooth(.5, .7, damp)) put('cushion', Math.floor(rnd(k * 3.3) * 3), s, 80, { x, y: y - .02, z, yaw: rnd(k * 4.9) * TAU, scale: .35 + .5 * rnd(k * 5.1), tall: 1, up: lean(x, z, .15), seed: rnd(k * 6.3) });
  });
  // 落叶堆：被风刮到背风处、石头下风一侧、沟里
  scatter({ ds: 1.7, dO: 1.7, o0: 6.6, o1: 36, salt: 61.1 }, (x, z, s, o, k, w) => {
    const lee = rocksOut.some(r => { const dx = x - r.x, dz = z - r.z, d = Math.hypot(dx, dz); return d < r.r + 2.2 && d > r.r * .7 && (dx * WIND[0] + dz * WIND[1]) / d > .3; });
    if (onRock(x, z) || rnd(k * 1.9) > w * (lee ? .8 : .2) * smooth(.45, .6, fbm(x / 6 + 4.4, z / 6 + 2.2, 2) + (lee ? .2 : 0))) return;
    put('litter', Math.floor(rnd(k * 3.7) * 3), s, 80, { x, y: surfaceAt(x, z) + .03, z, yaw: rnd(k * 4.1) * TAU, scale: .8 + .9 * rnd(k * 5.9), tall: 1, up: lean(x, z, .05), seed: rnd(k * 6.7) });
  });
  // 石顶、石缝里：一丛丛草，偶尔一棵小松
  rocksOut.forEach((r, i) => {
    if (r.wide < 1.1) return;
    const count = 1 + Math.floor(rnd(i * 3.1) * 3);
    for (let j = 0; j < count; j++) {
      const a = rnd(i * 5.3 + j) * TAU, d = r.r * (.2 + .55 * rnd(i * 6.7 + j)), x = r.x + Math.cos(a) * d, z = r.z + Math.sin(a) * d;
      put(j === 0 ? 'plume' : 'tussock', Math.floor(rnd(i * 7.1 + j) * 3), r.s, 120, { x, y: r.top - .25 - .3 * rnd(i * 8.3 + j), z, yaw: DOWNWIND + (rnd(i * 9.9 + j) - .5), scale: .55 + .35 * rnd(i * 1.7 + j), tall: .8, seed: rnd(i * 2.9 + j) });
    }
  });

  // —— 灌木 ——
  scatter({ ds: 2.4, dO: 2.3, o0: 7, o1: 40, salt: 71.7 }, (x, z, s, o, k, w) => {
    const slope = slopeOf(x, z), patch = fbm(x / 15 + 5.5, z / 15 + 8.1, 2);
    if (onRock(x, z) || slope > .78 || rnd(k * 2.2) > w * .7 * smooth(.45, .62, patch)) return;
    const low = cameraSide(s, o) && Math.abs(o) < 34;                                                  // 机位那一侧：矮的、稀的，留出看云海的空
    if (low && rnd(k * 9.4) < .55) return;
    const kind = [FLORA.red, FLORA.amber, FLORA.wine][Math.floor(fbm(x / 26 + 9.9, z / 26 + 1.1, 2) * 3.6 + rnd(k * 3.4) * .8) % 3], scale = (.7 + .7 * rnd(k * 4.4)) * (low ? .6 : 1) * (Math.abs(o) < 13 ? .62 : 1), y = surfaceAt(x, z) - .1;   // 贴着栏杆的矮一些，不挡住栏杆外的坡
    if (blocks(x, y + 1.1 * scale, z, 1.2 * scale)) return;
    const near = Math.abs(o) < 26 && w > .55;
    put(`flora-${kind}-${near ? 'near' : 'mid'}`, Math.floor(rnd(k * 5.5) * 3), s, near ? 180 : 320, { x, y, z, yaw: DOWNWIND + (rnd(k * 6.6) - .5) * .9, scale, tall: .8 + .3 * rnd(k * 7.2), seed: rnd(k * 8.8) });
  });

  // —— 树：松（崖边朝外探、平处朝下风斜）、红枫、黄栌、枯树 ——
  scatter({ ds: 9, dO: 8, o0: 12, o1: 62, salt: 83.9 }, (x, z, s, o, k, w) => {
    const slope = slopeOf(x, z), y = surfaceAt(x, z) - .25, pick = rnd(k * 3.3);
    if (onRock(x, z) || Math.abs(o) < 15 || (cameraSide(s, o) && Math.abs(o) < 44) || rnd(k * 2.7) > w * .55 * smooth(.3, .55, fbm(x / 40 + 2.8, z / 40 + 6.6, 2) + .15)) return;
    const scale = .65 + .45 * rnd(k * 4.9), r = 3.4 * scale;
    if (blocks(x, y + 4 * scale, z, r) || blocks(x, y + 1.5, z, r * .6)) return;
    const near = Math.abs(o) < 30 && w > .55;
    if (pick < .4) {
      const form = slope > .45 ? 'crag' : 'lean';
      put(`pine-${form}-${near ? 'near' : 'mid'}`, Math.floor(rnd(k * 5.7) * 2), s, near ? 420 : 620, { x, y, z, yaw: form === 'crag' ? downhillYaw(x, z) : DOWNWIND + (rnd(k * 6.1) - .5) * .7, scale: scale * (form === 'crag' ? 1 : .85), seed: rnd(k * 7.3) });
    } else if (pick < .9 && slope < .7) {
      const kind = pick < .68 ? FLORA.maple : FLORA.smoke;
      put(`flora-${kind}-${near ? 'near' : 'mid'}`, Math.floor(rnd(k * 5.7) * 2), s, near ? 420 : 620, { x, y, z, yaw: DOWNWIND + (rnd(k * 6.1) - .5) * .6, scale, seed: rnd(k * 7.3) });
    } else put(`flora-${FLORA.snag}-${near ? 'near' : 'mid'}`, Math.floor(rnd(k * 5.7) * 2), s, near ? 420 : 620, { x, y, z, yaw: DOWNWIND + (rnd(k * 6.1) - .5), scale: scale * .9, seed: rnd(k * 7.3) });
  });
  // 石缝里的小松：大石的顶上
  rocksOut.forEach((r, i) => {
    if (r.wide < 2.4 || rnd(i * 4.7 + .3) > .3) return;
    const x = r.x + (rnd(i * 2.3) - .5) * r.r * .6, z = r.z + (rnd(i * 3.9) - .5) * r.r * .6, scale = .22 + .16 * rnd(i * 5.1);
    if (!blocks(x, r.top + 2 * scale, z, 2 * scale)) put('pine-crag-mid', i % 2, r.s, 300,{ x, y: r.top - .35, z, yaw: downhillYaw(x, z), scale, seed: rnd(i * 6.9) });
  });

  // —— 装成网格 ——
  const pines = { near: { crag: [0, 1].map(i => pine(4.1 + i * 2.7, DETAIL.near, 'crag').geometry()), lean: [0, 1].map(i => pine(6.3 + i * 2.9, DETAIL.near, 'lean').geometry()) },
    mid: { crag: [0, 1].map(i => pine(4.1 + i * 2.7, DETAIL.mid, 'crag').geometry()), lean: [0, 1].map(i => pine(6.3 + i * 2.9, DETAIL.mid, 'lean').geometry()) } };
  const HERB_COPIES = { plume: 4, plumeLite: 2, tussock: 3, asters: 3, fern: 3, cushion: 3, litter: 3 };
  for (const { kind, copy, s, reach, items } of bins.values()) {
    let mesh;
    if (kind.startsWith('rock-')) mesh = rockMesh(rockShapes(kind.slice(5), 4)[copy], items, kind !== 'rock-small');
    else if (kind.startsWith('flora-')) { const [, k, tier] = kind.split('-'); mesh = floraMesh(floraShapes(Number(k), tier, 3)[copy % 3], Number(k), items, true); }
    else if (kind.startsWith('pine-')) { const [, form, tier] = kind.split('-'); mesh = pineMesh(pines[tier][form][copy % 2], items); }
    else mesh = herbMesh(ridgeHerbShapes(kind, HERB_COPIES[kind])[copy], ridgeHerbMaterial(kind === 'plumeLite' ? 'plume' : kind), items);
    mesh.name = `山脊 ${kind}`;
    group.add(mesh);
    culled.push({ mesh, at: road.at0(Math.min(s, road.length), new THREE.Vector3()), reach: reach + 60 });
  }
  const ground = buildRidgeGround(P), stair = buildRidgeStair(P), wind = buildRidgeWind(P);
  group.add(ground.group, stair.group, wind.group);
  culled.push(...ground.culled, ...stair.culled);
  group.userData.ridge = true;
  return { group, culled, place: P };
}

// 松：用 foliage.js 的松的材质
function pineMesh(geo, items) {
  const g = new THREE.BufferGeometry(), m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  for (const [name, attribute] of Object.entries(geo.attributes)) g.setAttribute(name, attribute);
  g.boundingSphere = geo.boundingSphere;
  g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(Float32Array.from(items, t => t.seed), 1));
  const mesh = new THREE.InstancedMesh(g, treeMaterial('pine'), items.length);
  items.forEach((t, i) => mesh.setMatrixAt(i, m.compose(p.set(t.x, t.y, t.z), q.setFromAxisAngle(up, t.yaw), s.set(t.scale, t.scale * (.9 + .2 * t.seed), t.scale))));
  mesh.computeBoundingSphere();
  return shadowed(mesh, true, true);
}
