// 半山的小屋：三间的小瓦房。原点在地基面正中，门朝 +z（朝着山路）。
// 石台基、门前两级石阶 → 下碱（墙根一截灰石）、白粉墙、露在墙面上的木柱和枋 → 当中一间是对开的板门（门框、门槛、门环、两边贴着对联），
// 两边各一扇糊纸的棂格窗，西山墙上还有一扇小窗 → 檐下的椽子、两坡瓦屋面、两头的博风板和悬鱼、起翘的正脊、后坡一截烟囱。
// 过日子的痕迹：东山墙下码着柴垛，旁边一个劈柴的木墩；门左一口水缸；窗下一条长凳；墙上挂着斗笠和一串红辣椒；檐下一盏灯笼；门前几块踏脚石。
// 冬夜里窗纸和灯笼是亮的（aGlow）。
import * as THREE from 'three';
import { rnd } from '../anim.js';
import { Kit, MAT, V, place } from './kit.js';
import { roofSlope, rafters } from './roof.js';

const STONE = '#B9B2A4', STONE_DK = '#8C877E', GREY = '#9C968A', PLASTER = '#E4DAC6', WOOD = '#5A3226', WOOD_LT = '#8A6240', DOOR = '#4A2A20', RED = '#B8402C', PAPER = '#FFC878', GOLD = '#C8A048', RIDGE = '#3C4C56', STRAW = '#C8A862';
const W = 10.4, D = 6.8, BASE = .5, WALL = 4.3, Y0 = BASE + WALL, RISE = 3, FRONT = D / 2, BAY = W / 6;
const lathe = (profile, segments = 12) => new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segments);

// 一扇棂格窗：窗框、窗纸（亮）、竖横的棂条、窗台。m：窗子正中的摆放矩阵（窗面朝 +z）
function lattice(kit, m, w, h, glow) {
  const put = (bw, bh, bd, hex, x, y, z, lit = 0) => kit.box(bw, bh, bd, hex, m.clone().multiply(place(x, y, z)), lit);
  kit.use(MAT.paper); put(w, h, .04, PAPER, 0, 0, .02, glow);
  kit.use(MAT.wood);
  for (const x of [-1, 1]) put(.14, h + .28, .2, WOOD, x * (w / 2 + .07), 0, .06);
  for (const y of [-1, 1]) put(w + .28, .14, .2, WOOD, 0, y * (h / 2 + .07), .06);
  put(w + .5, .1, .34, WOOD_LT, 0, -h / 2 - .19, .12);
  const nx = Math.round(w / .4), ny = Math.round(h / .45);
  for (let k = 1; k < nx; k++) put(.06, h, .1, WOOD, -w / 2 + w * k / nx, 0, .08);
  for (let k = 1; k < ny; k++) put(w, .06, .1, WOOD, 0, -h / 2 + h * k / ny, .08);
  put(w * .5, .07, .12, WOOD, 0, 0, .1); put(.07, h * .5, .12, WOOD, 0, 0, .1);                           // 当中再叠一个十字，棂格有疏有密
}

function house(kit) {
  kit.use(MAT.stone).box(W + 1.7, BASE - .12, D + 1.7, STONE, place(0, (BASE - .12) / 2, 0)).box(W + 1.9, .12, D + 1.9, '#C8C1B2', place(0, BASE - .06, 0));
  kit.box(3, .26, 1.3, STONE_DK, place(0, .13, FRONT + 1.45)).box(2.6, .25, .6, STONE, place(0, .375, FRONT + 1.15));
  kit.box(W + .04, .95, D + .04, GREY, place(0, BASE + .475, 0));
  kit.use(MAT.plaster).box(W, WALL, D, PLASTER, place(0, BASE + WALL / 2, 0));
  kit.tris([V(W / 2, Y0, FRONT), V(W / 2, Y0, -FRONT), V(W / 2, Y0 + RISE - .3, 0), V(-W / 2, Y0, -FRONT), V(-W / 2, Y0, FRONT), V(-W / 2, Y0 + RISE - .3, 0)], PLASTER);   // 两头山墙的三角
  // 木构架：柱、檐枋、腰枋
  kit.use(MAT.wood);
  for (const x of [-3, -1, 1, 3]) for (const z of [-FRONT, FRONT]) kit.box(.36, WALL, .36, WOOD, place(x * BAY, BASE + WALL / 2, z));
  for (const z of [-FRONT, FRONT]) kit.box(W + .3, .34, .34, WOOD, place(0, Y0 - .17, z)).box(W + .2, .14, .44, WOOD, place(0, BASE + 1.02, z));
  for (const x of [-W / 2, W / 2]) kit.box(.4, .3, D, WOOD, place(x, Y0 - .15, 0)).box(.4, .22, D, WOOD, place(x, BASE + 2.6, 0));
  // 板门：门框、门槛、两扇门板（一条条竖板）、门环；柱上贴对联，门楣上贴横批
  kit.box(.2, 3.5, .3, DOOR, place(-1.2, BASE + 1.75, FRONT + .08)).box(.2, 3.5, .3, DOOR, place(1.2, BASE + 1.75, FRONT + .08)).box(2.8, .26, .32, DOOR, place(0, BASE + 3.5, FRONT + .08)).box(2.6, .24, .36, WOOD, place(0, BASE + .12, FRONT + .1));
  for (const x of [-.55, .55]) {
    kit.use(MAT.wood).box(1.08, 3.2, .1, '#6A3C2A', place(x, BASE + 1.82, FRONT + .04));
    for (const k of [-.27, 0, .27]) kit.box(.03, 3.2, .12, DOOR, place(x + k, BASE + 1.82, FRONT + .04));
    kit.use(MAT.gold).add(new THREE.TorusGeometry(.11, .025, 6, 12), GOLD, place(x * .36, BASE + 1.8, FRONT + .12));
  }
  kit.use(MAT.paper);
  for (const x of [-1, 1]) kit.box(.3, 2.3, .02, RED, place(x * BAY, BASE + 2.2, FRONT + .19));
  kit.box(1.5, .36, .02, RED, place(0, BASE + 3.95, FRONT + .16));
  // 窗
  lattice(kit, place(2 * BAY, BASE + 2.45, FRONT), 2.2, 1.7, 1); lattice(kit, place(-2 * BAY, BASE + 2.6, FRONT), 1.5, 1.2, .9);
  lattice(kit, place(-W / 2, BASE + 2.6, .6, -Math.PI / 2), 1.5, 1.2, .8);
  // 屋面、椽子、博风板、悬鱼
  for (const side of [1, -1]) {
    const surf = (u, v) => V(u * (W / 2 + 1.3) * (1 + .03 * v), Y0 + RISE * (1 - v) ** 1.45 + .42 * u * u * (.5 + .5 * v) - .1, side * (FRONT + 1.5) * v);
    roofSlope(kit, surf, 10, 6, 14, () => V(0, 0, side));
    rafters(kit, surf, 17, 5);
    kit.use(MAT.wood);
    for (const u of [-1, 1]) for (let j = 0; j < 4; j++) kit.beam(surf(u * .985, j / 4).add(V(0, -.3, 0)), surf(u * .985, (j + 1) / 4).add(V(0, -.3, 0)), .1, .42, WOOD);
  }
  const HALF_RIDGE = W / 2 + 1.3;
  kit.use(MAT.tile);
  for (let i = 0; i < 10; i++) {                                                                                                // 正脊，两头翘
    const x = -.9 + .2 * i;
    kit.box(HALF_RIDGE * .21, .5, .5, RIDGE, place(x * HALF_RIDGE, Y0 + RISE + .21 * x * x + .1, 0, 0, 0, Math.atan(.42 * x / HALF_RIDGE)));
  }
  for (const x of [-1, 1]) {
    kit.use(MAT.tile).box(.5, .7, .4, RIDGE, place(x * (HALF_RIDGE - .1), Y0 + RISE + .62, 0, 0, 0, -x * .35));
    kit.use(MAT.wood).box(.08, .7, .4, WOOD, place(x * (W / 2 + 1.28), Y0 + RISE - .55, 0));
  }
  kit.use(MAT.plaster).box(.7, 1.5, .7, '#CFC4B0', place(-3, Y0 + 1.9, -1.9)).use(MAT.tile).box(.95, .14, .95, RIDGE, place(-3, Y0 + 2.7, -1.9));
}

// 过日子的痕迹。返回檐下灯笼的位置
function living(kit) {
  // 柴垛：东山墙下，圆木码成四层，露着一圈圈的截面；旁边一个木墩，靠着两根劈开的柴
  kit.use(MAT.wood);
  for (let row = 0; row < 4; row++) for (let k = 0; k < 8 - row; k++) {
    const r = .13 + .04 * rnd(row * 7.1 + k * 3.3), z = -2.1 + (k + row * .5) * .36 + (rnd(row * 5 + k) - .5) * .05;
    kit.add(new THREE.CylinderGeometry(r, r, .95 + .1 * rnd(k * 9.1 + row), 8).rotateZ(Math.PI / 2), rnd(row * 2.7 + k * 5.9) < .5 ? '#8A6844' : '#74563A', place(W / 2 + .58, BASE + .16 + row * .3, z));
  }
  kit.add(new THREE.CylinderGeometry(.34, .38, .5, 10), '#6E5238', place(W / 2 + 1.2, .25, 1.7)).box(.12, .12, .8, '#9A7850', place(W / 2 + .85, .32, 1.75, .4, 1.1)).box(.12, .1, .8, '#8A6844', place(W / 2 + 1.55, .3, 1.5, -.5, 1.15));
  // 水缸：门左，釉色深，缸里有水
  kit.use(MAT.stone).add(lathe([[0, 0], [.42, 0], [.62, .3], [.7, .7], [.6, 1.05], [.64, 1.12], [.54, 1.12], [.5, 1.02], [0, 1.02]], 14), '#5A4636', place(-2.75, .02, FRONT + 1.15));
  kit.add(new THREE.CircleGeometry(.5, 14).rotateX(-Math.PI / 2), '#3A5460', place(-2.75, .98, FRONT + 1.15));
  // 长凳：窗下
  kit.use(MAT.wood).box(2, .1, .42, WOOD_LT, place(2 * BAY, BASE + .52, FRONT + .62));
  for (const x of [-.75, .75]) kit.box(.1, .5, .36, WOOD, place(2 * BAY + x, BASE + .25, FRONT + .62));
  // 斗笠和辣椒串：挂在门和小窗之间的墙上
  kit.use(MAT.paper).add(new THREE.ConeGeometry(.55, .22, 14), STRAW, place(-1.95, BASE + 2.7, FRONT + .33, 0, Math.PI / 2 - .12));
  for (let k = 0; k < 11; k++) kit.add(new THREE.ConeGeometry(.045, .2, 5), k % 4 === 3 ? '#E8662E' : '#C8281E', place(1.95 + Math.sin(k * 2.4) * .06, BASE + 3.1 - k * .11, FRONT + .28 + Math.cos(k * 2.4) * .05, 0, Math.PI + Math.sin(k * 2.4) * .5, Math.cos(k * 2.4) * .5));
  // 门前的踏脚石
  kit.use(MAT.stone);
  for (let k = 0; k < 4; k++) kit.add(new THREE.CylinderGeometry(.55 + .2 * rnd(k * 3.7), .6 + .2 * rnd(k * 3.7), .14, 9), k % 2 ? '#A49E90' : '#B0AA9C', place((rnd(k * 5.3) - .5) * .7, .03, FRONT + 2.9 + k * 1.45, k * 1.3));
  // 檐下的灯笼：一根细绳吊着，上下两个木盖，底下垂着穗
  const lamp = V(BAY, Y0 - 1.15, FRONT + 1.1);
  kit.use(MAT.wood).box(.04, .8, .04, WOOD, place(lamp.x, lamp.y + .65, lamp.z)).add(new THREE.CylinderGeometry(.2, .2, .1, 8), WOOD, place(lamp.x, lamp.y + .53, lamp.z)).add(new THREE.CylinderGeometry(.2, .2, .1, 8), WOOD, place(lamp.x, lamp.y - .53, lamp.z));
  kit.use(MAT.paper).add(new THREE.SphereGeometry(.42, 12, 10), '#FF9A4A', place(lamp.x, lamp.y, lamp.z, 0, 0, 0, 1, 1.25, 1), 1.6).box(.05, .4, .05, RED, place(lamp.x, lamp.y - .8, lamp.z));
  return lamp;
}

export function hutGeometry() {
  const kit = new Kit();
  house(kit);
  return { lamp: living(kit), geometry: kit.geometry() };
}
