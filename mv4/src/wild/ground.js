// 地被：路两旁的草木和水边的东西。全是实例化，造型和材质在 herbs.js、rocks.js。
// 路两旁：紧贴路缘是密密的一排矮草（把路缘的直线遮掉一些），往外是长草、蕨、大叶草、两种野花，一片一片地各有偏重——
//   背阴潮湿的地方多蕨和大叶草，敞亮的地方多花和长草；越往外越稀，路是从草木里穿过去的。山脊上两边是绝壁，只有窄窄的两行。
//   路上和路边散着一小堆一小堆的落花（春）、落叶（秋）。石头成组：一块大的带两三块小的，脚下围着草、垫着暗影。
// 湖岸的浅滩上一丛丛芦苇；路尽头的湖湾里是荷：贴水的叶、挺出水的叶、开着的花和花苞（秋天叶枯了垂下来）。
// 路边的草、花、落叶沿路按 SPAN 一段分组，镜头离得远的段不画（wild.js 每帧按镜头位置开关），大远景里不费工夫。
import * as THREE from 'three';
import { rnd } from '../anim.js';
import { fbm } from './noise.js';
import { HALF, CURB, RIDGE_END } from './road.js';
import { herbKit, instanced, item, slopeNormal } from './herbs.js';
import { rockGeometry, rockMaterial } from './rocks.js';
import { shadeDecals } from './roots.js';

const SPAN = 70, STEP = 1.15, VERGE = HALF + CURB + .4, WALL = 6.4;   // 分组的段长；沿路撒点的间距；第一排草离中线多远；路的基座和护坡到多远为止
const UP = new THREE.Vector3(0, 1, 0);
// 路边的每种草本：用哪个材质、大小（最小、浮动）、是不是贴着坡面长（否则竖直长）、离多远不画
const SORTS = {
  tuft: { mat: 'grass', size: [.6, .65], flat: false, reach: 330 }, sedge: { mat: 'sedge', size: [.65, .5], flat: false, reach: 330 },
  daisy: { mat: 'flowers', size: [.9, .5], flat: false, reach: 330 }, bells: { mat: 'flowers', size: [.8, .5], flat: false, reach: 330 },
  fern: { mat: 'fern', size: [.8, .7], flat: true, reach: 330 }, docks: { mat: 'docks', size: [.8, .6], flat: true, reach: 330 },
  litter: { mat: 'litter', size: [.7, .6], flat: true, reach: 260 },
};

export function buildGround(road, terrain) {
  const { groundAt, slopeAt } = terrain, { mats, geos } = herbKit(), group = new THREE.Group(), culled = [], p = new THREE.Vector3(), r = new THREE.Vector3(), n = new THREE.Vector3();
  const offBridge = s => s < road.bridge.s0 - 2 || s > road.bridge.s1 + 2;
  const rocks = { big: [[], []], small: [[], []] }, shades = [];
  let k = 0;
  for (let s0 = 0; s0 < road.length; s0 += SPAN) {
    const bins = Object.fromEntries(Object.keys(SORTS).map(name => [name, geos[name].map(() => [])]));
    // 种一株：name 是哪种，其余是位置、种子、这片地的肥瘦（肥的地方长得高）
    const plant = (name, x, y, z, seed, lush) => {
      const S = SORTS[name], it = item(x, y, z, seed, S.size[0] + S.size[1] * rnd(seed * 8.9), .8 + .5 * lush, S.flat ? slopeNormal(groundAt, x, z, n).clone() : UP);
      bins[name][Math.floor(it.seed * 97) % bins[name].length].push(it);
    };
    for (let s = s0 + .5; s < Math.min(s0 + SPAN, road.length); s += STEP) {
      road.at0(s, p); road.right(s, r);
      const ridge = p.z < RIDGE_END, rows = ridge ? 2 : 6;
      if (!offBridge(s)) continue;
      for (const side of [-1, 1]) for (let j = 0; j < rows; j++) {
        k++;
        const off = VERGE + (j + rnd(k * 1.7)) * (ridge ? .7 : 1.9), x = p.x + r.x * side * off + (rnd(k * 2.9) - .5), z = p.z + r.z * side * off + (rnd(k * 4.3) - .5), y = groundAt(x, z);
        if (y < .4 || slopeAt(x, z) > .6) continue;
        const lush = fbm(x / 9 + 3.3, z / 9 + 8.1, 2), damp = fbm(x / 23 + 7.7, z / 23 + 1.9, 2), sort = rnd(k * 9.7);
        if (rnd(k * 6.1) > 1.25 - j * .13 - (lush < .4 ? .4 : 0)) continue;
        const name = j === 0 || sort < .38 ? 'tuft' : damp > .57 && sort < .7 ? 'fern' : damp > .5 && sort < .78 ? 'docks' : lush > .55 && sort < .9 ? (fbm(x / 31 + 5.5, z / 31 + 2.2, 2) > .5 ? 'daisy' : 'bells') : 'sedge';
        plant(name, x, y - .05, z, k, lush);
        // 石头：离路远一点的地方偶尔一组——一块大的，旁边两三块小的，脚下围一圈草
        if (ridge || j < 3 || rnd(k * 5.3) > .022) continue;
        const size = 1.1 + 1.9 * rnd(k * 2.1) ** 1.6;
        rocks.big[k % 2].push(item(x, y - .08 * size, z, k, size, .65 + .45 * rnd(k * 4.4), slopeNormal(groundAt, x, z, n).clone().lerp(UP, .5).normalize()));
        shades.push({ x, y, z, r: size * 1.7 });
        for (let i = 0; i < 6; i++) {
          const a = i * 1.05 + rnd(k * 3.7 + i), d = size * (.95 + .5 * rnd(k * 7.1 + i)), ex = x + Math.cos(a) * d, ez = z + Math.sin(a) * d, on = road.locate(ex, ez);
          if (on && on.d < WALL) continue;
          if (i < 3) rocks.small[i % 2].push(item(ex, groundAt(ex, ez) - .04, ez, k * 7 + i, .3 + .5 * rnd(k * 9.1 + i), .45 + .3 * rnd(k * 1.3 + i)));
          else plant(i === 3 ? 'sedge' : 'tuft', ex, groundAt(ex, ez) - .05, ez, k * 11 + i, lush);
        }
      }
    }
    // 落在路上和路边的花瓣、叶子：一小堆一小堆，成片地有、成片地没有；石阶上的堆小（不然悬在台阶外）
    for (let s = s0 + 1; s < Math.min(s0 + SPAN, road.length); s += 1.6) {
      k++;
      road.at0(s, p); road.right(s, r);
      const off = (rnd(k * 2.3) * 2 - 1) * (p.z < RIDGE_END ? HALF : 10.5), x = p.x + r.x * off, z = p.z + r.z * off, onRoad = Math.abs(off) < HALF - .5;
      if (!offBridge(s) || (!onRoad && Math.abs(off) < WALL) || fbm(x / 6 + 1.1, z / 6 + 5.7, 2) < .47) continue;
      const it = item(x, onRoad ? road.surface(s) + .02 : groundAt(x, z) + .04, z, k, onRoad ? (road.stepsAt(s) > .3 ? .42 : .8) + .3 * rnd(k * 6.7) : .9 + .6 * rnd(k * 6.7), 1, onRoad ? UP : slopeNormal(groundAt, x, z, n).clone());
      bins.litter[k % bins.litter.length].push(it);
    }
    const mid = road.at0(Math.min(s0 + SPAN / 2, road.length), new THREE.Vector3());
    for (const [name, lists] of Object.entries(bins)) lists.forEach((items, i) => {
      if (!items.length) return;
      const mesh = instanced(geos[name][i], mats[SORTS[name].mat], items);
      culled.push({ mesh, at: mid, reach: SORTS[name].reach });
      group.add(mesh);
    });
  }
  for (const [kind, detail] of [['big', 2], ['small', 1]]) rocks[kind].forEach((items, i) => { if (items.length) group.add(instanced(rockGeometry(3.1 + i * 5.7 + detail, detail), rockMaterial(), items, true)); });
  group.add(shadeDecals(shades, 2));

  // 湖岸的芦苇：水边浅滩上一丛丛
  const shore = geos.reed.map(() => []), lily = geos.lotusLeaf.map(() => []), blooms = [], buds = [], end = road.pts[road.n];
  for (let z = 770; z < 1070; z += 3.4) for (let x = -300; x < 300; x += 3.4) {
    k++;
    const px = x + 3 * rnd(k * 1.3), pz = z + 3 * rnd(k * 2.1), h = groundAt(px, pz), on = road.locate(px, pz);
    if (h > -.8 && h < 1.2 && fbm(px / 26 + 4.4, pz / 26 + 9.2, 2) > .5 && rnd(k * 3.3) < .55 && !(on && on.d < HALF + 2.5)) shore[k % shore.length].push(item(px, Math.min(h, .1) - .15, pz, k, .8 + .5 * rnd(k * 5.5)));
    // 路尽头那片湖湾里的荷：有的叶贴着水面，有的挺出水、歪着；花和花苞挺得比叶高
    const bay = Math.hypot(px - end.x - 30, (pz - end.z - 24) * 1.6);
    if (h < -.25 && h > -5 && bay < 85 && fbm(px / 14 + 2.2, pz / 14 + 6.6, 2) > .43 && rnd(k * 4.7) < .5) {
      const tall = rnd(k * 6.9) < .45 ? .4 + 1.1 * rnd(k * 8.3) : .06, a = rnd(k * 9.9) * 6.283, tip = tall > .1 ? .3 + .25 * rnd(k * 1.1) : 0;
      lily[k % lily.length].push(item(px, tall, pz, k, .9 + .9 * rnd(k * 2.7), 1, new THREE.Vector3(Math.cos(a) * tip, 1, Math.sin(a) * tip).normalize()));
      if (rnd(k * 7.3) < .2) (rnd(k * 5.9) < .62 ? blooms : buds).push(item(px + .8, 1 + .9 * rnd(k * 1.9), pz + .6, k + .3, .8 + .4 * rnd(k * 3.9)));
    }
  }
  shore.forEach((items, i) => group.add(instanced(geos.reed[i], mats.reeds, items)));
  lily.forEach((items, i) => group.add(instanced(geos.lotusLeaf[i], mats.pads, items)));
  group.add(instanced(geos.lotusFlower[0], mats.blooms, blooms), instanced(geos.lotusBud[0], mats.blooms, buds));
  group.userData.ground = true;                                                                      // 自查页（preview-tree.js）靠它认出这一组
  return { group, culled };
}
