// 桥边的溪谷：从桥上望得见的那一带（瀑布、潭、崖、两岸的坡）的小东西。全是实例化，造型和材质借 rocks.js、herbs.js。
//   崖壁——陡的地方贴着一块块扁平的石块，一层层大致平着垒（和地形着色器里的层理一个意思），各自往外探出一截，崖面有了真的凹凸和棱；
//         石块之间、上沿挂着草和蕨，斜着朝崖外探出去。
//   水里——瀑布落水处围着几块大石（水砸在上面溅开），潭以下的溪里两边散着石头，水从石头之间穿过。
//   两岸的坡——草丛、长草、蕨、大叶草、野花一片片地各有偏重，夹着成组的石头和地上的落花落叶；离桥越远越稀。
//   桥墙——石缝里长着蕨和草。
//   夏天另有溪谷里的雨雾、光束、水汽（summerair.js）和桥上的水花、滴水、蜻蜓（summerlife.js），也从这里装进场景。
// 这一带的东西只在镜头离桥不远时才画（和路边的草一样，wild.js 每帧按镜头位置开关）。
import * as THREE from 'three';
import { rnd } from '../anim.js';
import { fbm, smooth } from './noise.js';
import { HALF, CURB } from './road.js';
import { herbKit, instanced, item, slopeNormal } from './herbs.js';
import { rockGeometry, rockMaterial } from './rocks.js';
import { shadowed } from './paint.js';
import { fallFoot } from './stream.js';
import { buildSummerAir } from './summerair.js';
import { buildSummerLife } from './summerlife.js';

const CENTER = { x: 66, z: 432 }, REACH = 120, SEE = 340;             // 这一带的中心、范围；镜头离中心多远以内才画
const UP = new THREE.Vector3(0, 1, 0);
const SORTS = { tuft: [.6, .6], sedge: [.7, .5], daisy: [.85, .5], bells: [.75, .5], fern: [.8, .8], docks: [.8, .6], litter: [.7, .6] };   // 各种草本的大小（最小、浮动）
const MAT = { tuft: 'grass', sedge: 'sedge', daisy: 'flowers', bells: 'flowers', fern: 'fern', docks: 'docks', litter: 'litter' };

// 一批任意形状（不等比缩放、任意朝向）的石块
function slabs(geo, matrices) {
  const mesh = new THREE.InstancedMesh(geo, rockMaterial(), matrices.length);
  matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
  mesh.computeBoundingSphere();
  return shadowed(mesh, true, true);
}

export function buildGorge(road, terrain, creek) {
  const { groundAt, slopeAt } = terrain, { mats, geos } = herbKit(), group = new THREE.Group(), culled = [], n = new THREE.Vector3();
  const foot = fallFoot(creek), lip = creek.pts[creek.lip];
  const bins = Object.fromEntries(Object.keys(SORTS).map(name => [name, geos[name].map(() => [])]));
  const plant = (name, x, y, z, k, size, up) => bins[name][k % bins[name].length].push(item(x, y, z, k, SORTS[name][0] + SORTS[name][1] * size, .8 + .4 * rnd(k * 4.9), up));
  // 离溪多远（水平）、那一处的水面多高
  const creekAt = (x, z) => { let d = Infinity, y = 0; for (const p of creek.pts) { const e = Math.hypot(p.x - x, p.z - z); if (e < d) { d = e; y = p.y; } } return { d, y }; };
  // 离瀑布的水帘多远（水平）
  const fallGap = (x, z) => { const ax = foot.x - lip.x, az = foot.z - lip.z, k = Math.min(1, Math.max(0, ((x - lip.x) * ax + (z - lip.z) * az) / (ax * ax + az * az))); return Math.hypot(x - lip.x - ax * k, z - lip.z - az * k); };
  const offRoad = (x, z, gap) => { const on = road.locate(x, z); return !on || on.d > HALF + CURB + gap; };

  // 崖壁上的石块：每块的长、高、厚各不同，长的一边顺着崖面，高度凑到一层层的层线上；大的用细一档的造型
  const blocks = [[], [], [], []], hang = [], m = new THREE.Matrix4(), t = new THREE.Vector3(), out = new THREE.Vector3(), at = new THREE.Vector3();
  let k = 0;
  for (let gz = CENTER.z - REACH; gz < CENTER.z + REACH * .3; gz += 2.1) for (let gx = CENTER.x - REACH * .55; gx < CENTER.x + REACH * .75; gx += 2.1) {
    k++;
    const x = gx + 1.6 * rnd(k * 1.37), z = gz + 1.6 * rnd(k * 2.71), slope = slopeAt(x, z);
    if (slope < .42 || fallGap(x, z) < 6.5 || !offRoad(x, z, 2.5) || creekAt(x, z).d < 4) continue;
    slopeNormal(groundAt, x, z, n);
    out.set(n.x, 0, n.z).normalize(); t.set(-out.z, 0, out.x);
    const y = groundAt(x, z), clump = fbm(x / 14 + 3.3, z / 14 + 7.1, 2);
    if (rnd(k * 3.9) < .62 - .5 * (clump - .5)) {
      const big = rnd(k * 5.3) ** 1.4, len = 2.2 + 4.2 * big, high = (.8 + 1.3 * rnd(k * 6.1)) * (.7 + .5 * big), deep = 1.4 + 1.6 * rnd(k * 7.7);
      const layer = Math.round(y / 2.7) * 2.7 + (rnd(k * 8.3) - .5) * .5;                     // 凑到层线上
      at.set(x, Math.min(layer, y + .6), z).addScaledVector(out, -deep * (.25 + .3 * rnd(k * 9.1)));
      m.makeBasis(t.clone().multiplyScalar(len), UP.clone().multiplyScalar(high), out.clone().multiplyScalar(deep)).setPosition(at);
      m.multiply(new THREE.Matrix4().makeRotationY((rnd(k * 2.3) - .5) * .5));
      blocks[(big > .5 ? 2 : 0) + k % 2].push(m.clone());
    }
    // 崖上挂的草：从石缝里斜着朝外探出去
    if (slope < .86 && rnd(k * 4.4) < .3 + .25 * clump) {
      const up = out.clone().multiplyScalar(.75).add(UP).normalize(), pick = rnd(k * 6.6);
      hang.push([pick < .45 ? 'tuft' : pick < .75 ? 'fern' : 'sedge', x - out.x * .3, y - .1, z - out.z * .3, k, rnd(k * 7.2), up]);
    }
  }
  blocks.forEach((list, i) => { if (list.length) group.add(slabs(rockGeometry(7.3 + i * 3.1, i < 2 ? 1 : 2), list)); });
  for (const [name, x, y, z, kk, size, up] of hang) plant(name, x, y, z, kk, size, up);
  // 桥墙的石缝里长出来的蕨和草：贴着桥面底下那几层石头，斜着朝外探（桥是有年头的）
  const { s0, s1 } = road.bridge, wallAt = new THREE.Vector3(), wallOut = new THREE.Vector3();
  for (let i = 0; i < 150; i++) {
    const s = s0 - 3 + rnd(i * 3.7 + 900) * (s1 - s0 + 6), pick = rnd(i * 5.9 + 900), d = HALF + CURB + .62;
    road.at0(s, wallAt); road.right(s, wallOut).multiplyScalar(i % 2 ? 1 : -1);
    plant(pick < .5 ? 'fern' : pick < .8 ? 'tuft' : 'sedge', wallAt.x + wallOut.x * d, road.surface(s) - .5 - 2.4 * rnd(i * 8.1 + 900) ** 1.5, wallAt.z + wallOut.z * d, i + 9000, .5 * rnd(i * 2.7 + 900), wallOut.clone().multiplyScalar(.8).add(UP).normalize());
  }

  // 水里的石头：落水处围一圈大石，潭以下的溪两边散着大大小小的
  const boulders = [[], []];
  for (let i = 0; i < 9; i++) {
    const a = i * 2.39 + rnd(i * 3.3), r = 3.6 + 5.5 * rnd(i * 4.7), x = foot.x + Math.cos(a) * r, z = foot.z + Math.sin(a) * r, size = 1.6 + 2.2 * rnd(i * 5.9);
    boulders[1].push(item(x, Math.max(groundAt(x, z), foot.y - 2.4) - .1 * size, z, i + 300, size, 1 + .5 * rnd(i * 6.3)));
  }
  for (let i = creek.pool + 3; i < creek.pts.length - 1 && creek.pts[i].z < CENTER.z + 40; i++) for (const side of [-1, 1]) {
    const kk = i * 2 + (side > 0 ? 1 : 0) + 500, p = creek.pts[i], q = creek.pts[i + 1];
    if (rnd(kk * 1.7) < .62) continue;
    const dx = q.x - p.x, dz = q.z - p.z, len = Math.hypot(dx, dz), off = side * (2.2 + 2.4 * rnd(kk * 2.9)), x = p.x - dz / len * off, z = p.z + dx / len * off, size = .9 + 1.6 * rnd(kk * 3.7) ** 1.5;
    if (!offRoad(x, z, 1.5)) continue;
    boulders[size > 1.5 ? 1 : 0].push(item(x, Math.min(groundAt(x, z), p.y - .2) - .1 * size, z, kk, size, .75 + .35 * rnd(kk * 4.1)));
  }
  boulders.forEach((items, i) => { if (items.length) group.add(instanced(rockGeometry(11.9 + i * 2.2, i + 1), rockMaterial(), items, true)); });

  // 两岸的坡：越靠近桥越密
  const stones = [[], []];
  for (let gz = CENTER.z - REACH; gz < CENTER.z + REACH; gz += 1.55) for (let gx = CENTER.x - REACH; gx < CENTER.x + REACH; gx += 1.55) {
    k++;
    const x = gx + 1.5 * rnd(k * 1.13), z = gz + 1.5 * rnd(k * 2.41), away = Math.hypot(x - CENTER.x, z - CENTER.z);
    if (rnd(k * 3.17) > .9 * smooth(REACH, 35, away)) continue;
    const slope = slopeAt(x, z), water = creekAt(x, z), y = groundAt(x, z);
    if (slope > .58 || !offRoad(x, z, 1.1) || water.d < 3.2 || y < water.y + .3 && water.d < 9) continue;
    const lush = fbm(x / 9 + 3.3, z / 9 + 8.1, 2), damp = fbm(x / 23 + 7.7, z / 23 + 1.9, 2) + .25 * smooth(16, 4, water.d), sort = rnd(k * 9.7), bloom = fbm(x / 17 + 5.5, z / 17 + 2.2, 2);
    if (lush < .36 && rnd(k * 6.1) < .5) continue;
    const name = sort < .3 ? 'tuft' : damp > .58 && sort < .62 ? 'fern' : damp > .52 && sort < .74 ? 'docks' : bloom > .54 && sort < .9 ? (bloom > .6 ? 'daisy' : 'bells') : sort < .93 ? 'sedge' : 'litter';
    plant(name, x, y - .05, z, k, rnd(k * 8.9), name === 'fern' || name === 'docks' || name === 'litter' ? slopeNormal(groundAt, x, z, n).clone() : UP);
    if (rnd(k * 5.3) < .012) {                                                                     // 偶尔一组石头：一块大的带两三块小的
      const size = .9 + 1.6 * rnd(k * 2.1) ** 1.6;
      stones[1].push(item(x, y - .12 * size, z, k, size, .6 + .4 * rnd(k * 4.4), slopeNormal(groundAt, x, z, n).clone().lerp(UP, .5).normalize()));
      for (let i = 0; i < 3; i++) { const a = i * 2.1 + rnd(k * 3.7 + i), d = size * (1 + .5 * rnd(k * 7.1 + i)), ex = x + Math.cos(a) * d, ez = z + Math.sin(a) * d; stones[0].push(item(ex, groundAt(ex, ez) - .05, ez, k * 7 + i, .3 + .45 * rnd(k * 9.1 + i), .5 + .3 * rnd(k * 1.3 + i))); }
    }
  }
  stones.forEach((items, i) => { if (items.length) group.add(instanced(rockGeometry(17.7 + i * 4.3, i + 1), rockMaterial(), items, i === 1)); });

  const middle = new THREE.Vector3(CENTER.x, groundAt(CENTER.x, CENTER.z), CENTER.z);
  for (const [name, lists] of Object.entries(bins)) lists.forEach((items, i) => {
    if (!items.length) return;
    const mesh = instanced(geos[name][i], mats[MAT[name]], items);
    culled.push({ mesh, at: middle, reach: SEE });
    group.add(mesh);
  });
  group.add(buildSummerAir(road, terrain, creek), buildSummerLife(road));                            // 夏天溪谷里的雨雾、光束和水汽；桥上的水花、滴水和蜻蜓
  for (const mesh of group.children) if (!culled.some(c => c.mesh === mesh)) culled.push({ mesh, at: middle, reach: SEE + 200 });
  return { group, culled };
}
