// 山顶的六角亭，和亭边的一圈东西。原点在地基面的正中，正南（+z）是上亭的台阶，山路从那儿起步。
// 亭子从下到上：三层收放的石台基和踏跺 → 鼓形柱础、六根红柱 → 柱间的额枋、垫板、雀替 → 柱头和柱间的斗拱、挑檐枋 →
// 六面往下凹、六个角往上翘的瓦屋面（瓦垄、瓦当、底下的椽子）、六条戗脊（脊端起翘）→ 宝顶。
// 亭里一张石桌、四只石鼓凳，五面柱间是带靠背的坐凳（美人靠）。
// 亭外：崖边一圈石栏（望柱、栏板），两块立着的山石，西南角一个石头围的树池（松树由种树的人来种）。
import * as THREE from 'three';
import { rnd } from '../anim.js';
import { Kit, MAT, V, place } from './kit.js';
import { fbm, lerp } from './noise.js';
import { roofSlope, rafters } from './roof.js';

const STONE = '#B9B2A4', STONE_DK = '#8C877E', STONE_LT = '#CFC8BA', RED = '#B4442E', RED_DK = '#8A3626', TEAL = '#2E7C78', BLUE = '#2F5E8E', WOOD = '#5A3226', GOLD = '#C8A048', RIDGE = '#3C4C56';
const UP = V(0, 1, 0), TAU = Math.PI * 2;
export const PINE_SPOT = { x: -10.4, z: 6.4 };                        // 树池的位置（相对亭子的地基中心）

const FLOOR = .75, COL = 6.3, BEAM = FLOOR + 6.5, Y0 = BEAM + .15, EAVE = 10.6, RISE = 5.4, LIFT = 1.7;
const corner = i => { const a = (i + .5) * Math.PI / 3; return [Math.sin(a), Math.cos(a)]; };            // 六个角；第 5 面朝正南
const hexagon = (r0, r1, h) => new THREE.CylinderGeometry(r0, r1, h, 6).rotateY(Math.PI / 6);
const lathe = (profile, segments = 12) => new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segments);

// 一块石头：球面按噪声鼓出去、凹进来。w、h：球面分多细
export function rockGeometry(seed, w = 18, h = 14) {
  const g = new THREE.SphereGeometry(1, w, h), p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const k = .62 + .75 * fbm(v.x * 1.5 + v.y * .8 + seed * 9.1, v.z * 1.5 - v.y * .8 + seed * 3.7, 3) + .16 * Math.sin(v.y * 5 + seed * 7);
    p.setXYZ(i, v.x * k, v.y * (.75 + .5 * k), v.z * k);
  }
  g.computeVertexNormals();
  return g;
}

function body(kit) {
  // 台基：下枋、束腰、上枋；台面铺一圈压面石
  kit.use(MAT.stone).add(hexagon(10, 10.15, .28), STONE_DK, place(0, .14, 0)).add(hexagon(9.55, 9.55, .25), STONE, place(0, .4, 0)).add(hexagon(9.85, 9.85, .22), STONE_LT, place(0, .64, 0)).add(hexagon(8.7, 8.7, .04), '#A8A193', place(0, FLOOR + .02, 0));
  // 踏跺：台基南面一级台阶，下到一方和山路齐平的月台（山路的第一块石板接在月台南沿）；台阶两头各一块抱角石
  kit.box(5, .2, .5, STONE_LT, place(0, .46, 8.74)).box(7.8, .4, 2.3, STONE, place(0, .17, 9.98));
  for (const x of [-2.75, 2.75]) kit.box(.5, .52, .7, STONE_DK, place(x, .5, 8.8));
  // 石桌和石鼓凳
  kit.add(lathe([[0, 0], [.9, 0], [1, .12], [.62, .3], [.55, .9], [.75, 1.05], [1.75, 1.1], [1.8, 1.3], [0, 1.3]], 16), STONE_LT, place(0, FLOOR, 0));
  for (let k = 0; k < 4; k++) kit.add(lathe([[0, 0], [.38, 0], [.52, .2], [.54, .5], [.42, .74], [0, .76]], 10), STONE, place(Math.sin(k * TAU / 4 + .5) * 2.9, FLOOR, Math.cos(k * TAU / 4 + .5) * 2.9));

  for (let i = 0; i < 6; i++) {
    const [cx, cz] = corner(i), [nx, nz] = corner(i + 1), x = cx * COL, z = cz * COL, mx = (cx + nx) / 2, mz = (cz + nz) / 2, len = Math.hypot(mx, mz), ox = mx / len, oz = mz / len;   // (ox, oz)：这一面朝外的方向
    const yaw = Math.atan2(nx - cx, nz - cz) + Math.PI / 2, span = Math.hypot(nx - cx, nz - cz) * COL, at = (t, r, y) => V(lerp(cx, nx, t) * r, y, lerp(cz, nz, t) * r);
    // 柱础和柱
    kit.use(MAT.stone).add(lathe([[0, 0], [.74, 0], [.78, .14], [.6, .3], [.66, .46], [0, .46]], 12), STONE_DK, place(x, FLOOR, z));
    kit.use(MAT.lacquer).add(new THREE.CylinderGeometry(.37, .43, BEAM - FLOOR - .4, 12), RED, place(x, (BEAM + FLOOR + .4) / 2, z));
    // 额枋（青绿彩画，两端描金）、垫板、下枋，柱边的雀替
    kit.box(span, .6, .4, TEAL, place(mx * COL, BEAM - .3, mz * COL, yaw)).box(span - 1.2, .62, .44, BLUE, place(mx * COL, BEAM - .3, mz * COL, yaw));
    kit.use(MAT.gold).box(span, .12, .46, GOLD, place(mx * COL, BEAM - .66, mz * COL, yaw));
    for (const t of [.13, .87]) kit.box(.12, .5, .47, GOLD, place(lerp(cx, nx, t) * COL, BEAM - .3, lerp(cz, nz, t) * COL, yaw));
    kit.use(MAT.lacquer).box(span - .8, .5, .12, RED_DK, place(mx * COL, BEAM - .97, mz * COL, yaw)).box(span - .8, .28, .3, RED, place(mx * COL, BEAM - 1.36, mz * COL, yaw));
    for (const [t0, t1] of [[.06, .3], [.94, .7]]) {
      const a = at(t0, COL, BEAM - 1.5), b = at(t1, COL, BEAM - 1.5), c = at(t0, COL, BEAM - 2.5);
      kit.use(MAT.gold).tris([a, b, c, a, c, b], '#3E8E7C');
    }
    // 斗拱：柱头一攒、柱间两攒。坐斗、顺着枋的拱、朝外挑的翘、上面三只升，托着挑檐枋
    for (const t of [0, .34, .67]) {
      const p = at(t, COL, 0), put = (w, h, d, hex, out, y) => kit.box(w, h, d, hex, place(p.x + ox * out, BEAM + y, p.z + oz * out, yaw));
      kit.use(MAT.lacquer);
      put(.5, .26, .5, TEAL, 0, .13); put(1.3, .2, .2, BLUE, 0, .37); put(.22, .2, 1.5, TEAL, .45, .37); put(1.7, .2, .2, TEAL, .9, .6);
      for (const k of [-1, 0, 1]) kit.box(.26, .16, .26, BLUE, place(p.x + ox * .9 + Math.cos(yaw) * k * .7, BEAM + .78, p.z + oz * .9 - Math.sin(yaw) * k * .7, yaw));
    }
    kit.use(MAT.lacquer).beam(at(-.08, COL + 1.04, BEAM + .97), at(1.08, COL + 1.04, BEAM + .97), .26, .22, RED_DK);
    // 美人靠：除了正南那一面
    if (i !== 5) {
      kit.use(MAT.wood).box(span - .9, .16, .85, WOOD, place(mx * COL, FLOOR + 1, mz * COL, yaw));
      for (const t of [.12, .5, .88]) kit.box(.16, .96, .6, WOOD, place(lerp(cx, nx, t) * COL, FLOOR + .5, lerp(cz, nz, t) * COL, yaw));
      kit.use(MAT.lacquer).beam(at(.08, COL + .62, FLOOR + 1.95), at(.92, COL + .62, FLOOR + 1.95), .14, .14, RED);
      for (let k = 1; k < 12; k++) kit.beam(at(.08 + .07 * k, COL + .2, FLOOR + 1.08), at(.08 + .07 * k, COL + .62, FLOOR + 1.93), .07, .07, RED);
    }
    // 这一面的屋面、椽子，和它右手那条戗脊
    const sheet = (ax, az, bx, bz) => (u, v) => { const k = (u + 1) / 2, flare = EAVE * v * (1 + .08 * Math.abs(u) ** 3 * v ** 3); return V(lerp(ax, bx, k) * flare, Y0 + RISE * (1 - v) ** 1.6 + LIFT * Math.abs(u) ** 2.4 * v ** 3, lerp(az, bz, k) * flare); };
    const surf = sheet(cx, cz, nx, nz), [px, pz] = corner(i - 1), prev = sheet(px, pz, cx, cz);
    roofSlope(kit, surf, 8, 8, 10, () => V(ox, 0, oz));
    rafters(kit, surf, 9, 6);
    kit.use(MAT.tile);
    for (let j = 0; j < 10; j++) {
      const v0 = j / 10, v1 = (j + 1) / 10, top = v => surf(-1, v).add(V(0, .44 + .75 * v ** 6, 0));
      kit.face(surf(-.9, v0), surf(-.9, v1), top(v1), top(v0), RIDGE, UP); kit.face(top(v0), top(v1), prev(.9, v1), prev(.9, v0), '#34424C', UP);
    }
    // 脊端往上卷的翘角
    const tip = surf(-1, 1).add(V(0, 1.15, 0)), out = surf(-1, 1).sub(surf(-1, .9)).setY(0).normalize();
    kit.beam(tip.clone().addScaledVector(out, -.4).add(V(0, -.15, 0)), tip.clone().addScaledVector(out, .3).add(V(0, .4, 0)), .16, .2, RIDGE);
  }
  // 宝顶：瓦座上一串葫芦宝珠
  kit.use(MAT.tile).add(lathe([[0, 0], [1.1, 0], [1.2, .3], [.8, .6], [0, .6]], 12), RIDGE, place(0, Y0 + RISE - .45, 0));
  kit.use(MAT.gold).add(lathe([[0, 0], [.6, 0], [.72, .25], [.42, .55], [.3, .8], [.6, 1.2], [.64, 1.5], [.38, 1.9], [.16, 2.1], [.22, 2.5], [.1, 2.9], [0, 3.3]], 14), GOLD, place(0, Y0 + RISE + .1, 0));
}

// 亭外：崖边的石栏、山石、树池
function yard(kit) {
  const R = 12.25, FROM = 52, TO = 282, STEP = 12.8, at = (deg, r, y) => V(Math.sin(deg * Math.PI / 180) * r, y, Math.cos(deg * Math.PI / 180) * r);
  kit.use(MAT.stone);
  for (let deg = FROM; deg <= TO + .1; deg += STEP) {
    const p = at(deg, R, 0), yaw = deg * Math.PI / 180;
    kit.box(.4, 1.3, .4, STONE_LT, place(p.x, .6, p.z, yaw)).add(lathe([[0, 0], [.2, 0], [.27, .14], [.2, .34], [.07, .44], [0, .46]], 8), '#DAD3C4', place(p.x, 1.25, p.z));
    if (deg + STEP > TO + .1) continue;
    const a = at(deg + .9, R, 0), b = at(deg + STEP - .9, R, 0);                                           // 栏板：地栿、镂空处两根横档、扶手
    kit.beam(a.clone().setY(.1), b.clone().setY(.1), .3, .2, STONE).beam(a.clone().setY(.5), b.clone().setY(.5), .16, .5, '#C4BDAE').beam(a.clone().setY(1.02), b.clone().setY(1.02), .28, .16, '#D6CFC0');
  }
  // 两块山石，底下垫一圈碎石
  for (const [deg, r, tall, seed] of [[118, 11, 2.1, 1.3], [232, 11.1, 1.5, 4.7], [246, 10.6, .7, 8.2]]) {
    const p = at(deg, r, 0);
    kit.add(rockGeometry(seed), '#9A978C', place(p.x, tall * .8, p.z, seed, 0, .12, .85, tall, .7));
    for (let k = 0; k < 5; k++) kit.add(rockGeometry(seed + k), '#A8A498', place(p.x + Math.sin(k * 1.9 + seed) * 1.1, .05, p.z + Math.cos(k * 1.9 + seed) * 1.1, k, 0, 0, .28 + .2 * rnd(seed + k), .2, .3));
  }
  // 树池：一圈矮石头围着一方土
  kit.add(new THREE.CylinderGeometry(1.25, 1.3, .12, 10), '#6E5A44', place(PINE_SPOT.x, .02, PINE_SPOT.z));
  for (let k = 0; k < 10; k++) kit.add(rockGeometry(k * 2.3 + .4), STONE, place(PINE_SPOT.x + Math.sin(k * TAU / 10) * 1.35, .1, PINE_SPOT.z + Math.cos(k * TAU / 10) * 1.35, k * 1.7, 0, 0, .3, .22 + .1 * rnd(k * 3.1), .24));
}

export function pavilionGeometry() {
  const kit = new Kit();
  body(kit); yard(kit);
  return kit.geometry();
}
