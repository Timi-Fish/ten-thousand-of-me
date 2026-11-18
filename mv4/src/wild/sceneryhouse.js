// 谷里人家的房子：三种样子，每种几个大小不一的版本，每个版本各有三档精细度。原点在地面正中，门朝 +z。
//   白墙黛瓦——石台基、粉墙、墙角露着木柱和腰枋、对开的板门、两扇糊纸的棂格窗；两坡瓦顶，正脊两头起翘；
//   马头墙——两层高的粉墙，山墙一级一级跌下来、每级压一道瓦檐（徽州的房子那样），屋檐下一溜小窗；
//   木屋——山里高处的板屋：木板墙一块块竖着拼，屋顶是压着石块的木瓦，门前一截小檐廊。
// 三档：near 看得出瓦垄、门窗的棂格、墙角的柱子；mid 门窗、屋脊、檐口的厚度都在，瓦面是一整片；far 只剩墙和两坡屋顶的大形。
// 冬夜里窗纸是亮的（aGlow，跟季节表里的 uLamp 走）；朝上的面落雪由材质（kit.js 的 builtMaterial）管。
// 另有院墙：一道矮的白墙从屋前两角伸出去围成一个院子，墙头压一溜瓦，正中开一个门洞。
import * as THREE from 'three';
import { rnd } from '../anim.js';
import { Kit, MAT, V, place } from './kit.js';
import { roofSlope } from './roof.js';

const PLASTER = '#E8DFCB', PLASTER_DK = '#CFC5AE', STONE = '#A9A397', STONE_DK = '#857F74', WOOD = '#5A3226', WOOD_LT = '#8A6240', DOOR = '#4A2A20', PAPER = '#FFC878';
const TILE = '#56707A', RIDGE = '#33424A', SHINGLE = '#7A6A58', PLANK = '#8E6A46', PLANK_DK = '#6E5034', RED = '#B8402C';
export const LODS = ['near', 'mid', 'far'];
export const STYLES = ['white', 'horse', 'timber'];
const PLINTH = .5;

// 一扇窗：纸（夜里亮）、窗框；near 再加棂格。m：窗子正中的摆放矩阵（窗面朝 +z）
function window_(kit, m, w, h, lod) {
  const put = (bw, bh, bd, hex, x, y, z, lit = 0) => kit.box(bw, bh, bd, hex, m.clone().multiply(place(x, y, z)), lit);
  kit.use(MAT.paper); put(w, h, .06, PAPER, 0, 0, .02, 1);
  if (lod === 'far') return;
  kit.use(MAT.wood);
  for (const x of [-1, 1]) put(.16, h + .3, .2, WOOD, x * (w / 2 + .08), 0, .06);
  for (const y of [-1, 1]) put(w + .3, .16, .2, WOOD, 0, y * (h / 2 + .08), .06);
  if (lod !== 'near') return;
  const nx = Math.max(2, Math.round(w / .42)), ny = Math.max(2, Math.round(h / .45));
  for (let k = 1; k < nx; k++) put(.06, h, .1, WOOD, -w / 2 + w * k / nx, 0, .08);
  for (let k = 1; k < ny; k++) put(w, .06, .1, WOOD, 0, -h / 2 + h * k / ny, .08);
}

// 两坡的屋顶。y0：檐口所在的墙顶高，rise：起脊多高，ov：出檐多远，lift：檐角起翘多少
function gableRoof(kit, w, d, y0, rise, ov, lift, lod, tile = TILE) {
  const half = w / 2 + ov;
  for (const side of [1, -1]) {
    const surf = (u, v) => V(u * half * (1 + .03 * v), y0 + rise * (1 - v) ** 1.4 + lift * u * u * (.5 + .5 * v) - .05, side * (d / 2 + ov) * v);
    if (lod === 'near') roofSlope(kit, surf, 8, 4, Math.round(w * 1.15), () => V(0, 0, side));
    else {
      const nu = lod === 'mid' ? 4 : 1, nv = lod === 'mid' ? 3 : 1, drop = V(0, -.3, 0);
      kit.use(MAT.tile);
      for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
        const u0 = -1 + 2 * i / nu, u1 = -1 + 2 * (i + 1) / nu, v0 = j / nv, v1 = (j + 1) / nv;
        kit.face(surf(u0, v0), surf(u0, v1), surf(u1, v1), surf(u1, v0), tile, V(0, 1, 0));
        if (j === nv - 1) kit.face(surf(u0, v1), surf(u1, v1), surf(u1, v1).add(drop), surf(u0, v1).add(drop), RIDGE, V(0, 0, side));
      }
      if (lod === 'mid') for (let r = 0; r < 5; r++) { const u = -.8 + .4 * r; kit.beam(surf(u, 0).add(V(0, .1, 0)), surf(u, .97).add(V(0, .1, 0)), .16, .12, '#4A5E68'); }   // 远看瓦面上几道深一点的瓦垄
    }
  }
  // 正脊：一道深色的脊，两头翘起
  kit.use(MAT.tile).box(w + ov * 1.4, .45, .5, RIDGE, place(0, y0 + rise + .12, 0));
  if (lod !== 'far') for (const x of [-1, 1]) kit.box(.5, .8, .45, RIDGE, place(x * (half - .2), y0 + rise + .5, 0, 0, 0, -x * .45));
}

// 马头墙：山墙从屋脊往两边一级一级跌到檐口，每级压一道瓦檐
function horseWalls(kit, w, d, y0, rise, lod) {
  const steps = 3;
  for (const x of [-1, 1]) for (let k = 0; k < steps; k++) {
    const z0 = (k / steps) * (d / 2 + .4), z1 = ((k + 1) / steps) * (d / 2 + .4), top = y0 + rise + .9 - k * (rise + .6) / steps, mid = (z0 + z1) / 2;
    for (const s of [1, -1]) {
      kit.use(MAT.plaster).box(.5, top - y0 + .3, z1 - z0, PLASTER, place(x * (w / 2), (top + y0) / 2 - .15, s * mid));
      kit.use(MAT.tile).box(.95, .3, z1 - z0 + .3, RIDGE, place(x * (w / 2), top + .1, s * mid));
      if (lod !== 'far' && k === 0) kit.box(.6, .55, .45, RIDGE, place(x * (w / 2), top + .4, s * (z1 + .05), 0, s * .5));   // 墙头最高那一级的翘角
    }
  }
}

function house(kit, style, w, d, h, lod, seed) {
  const R = k => rnd(seed * 7.3 + k * 2.9), timber = style === 'timber';
  const y0 = PLINTH + h, rise = (timber ? .42 : .36) * d, front = d / 2;
  // 台基：往下埋得深，坡地上也不悬空
  kit.use(MAT.stone).box(w + 1.1, PLINTH + 3, d + 1.1, STONE, place(0, PLINTH - (PLINTH + 3) / 2, 0));
  if (lod !== 'far') kit.box(w + 1.3, .14, d + 1.3, '#BDB6A6', place(0, PLINTH - .07, 0)).box(2.4, .3, 1, STONE_DK, place(0, .15, front + 1.05));
  // 墙
  const wallCol = timber ? PLANK : R(1) < .5 ? PLASTER : PLASTER_DK;
  kit.use(timber ? MAT.wood : MAT.plaster).box(w, h, d, wallCol, place(0, PLINTH + h / 2, 0));
  if (!timber) kit.use(MAT.stone).box(w + .04, .9, d + .04, '#9C968A', place(0, PLINTH + .45, 0));       // 墙根一截灰石
  if (style !== 'horse') kit.use(timber ? MAT.wood : MAT.plaster).tris([V(w / 2, y0, front), V(w / 2, y0, -front), V(w / 2, y0 + rise - .2, 0), V(-w / 2, y0, -front), V(-w / 2, y0, front), V(-w / 2, y0 + rise - .2, 0)], wallCol);
  if (lod !== 'far') {
    kit.use(MAT.wood);
    if (timber && lod === 'near') for (let k = -Math.floor(w / 1.1); k <= Math.floor(w / 1.1); k++) kit.box(.07, h, .08, PLANK_DK, place(k * .55, PLINTH + h / 2, front + .02));   // 木板的拼缝
    for (const x of [-1, 1]) for (const z of [-1, 1]) kit.box(.34, h, .34, WOOD, place(x * w / 2, PLINTH + h / 2, z * front));
    kit.box(w + .2, .3, .36, WOOD, place(0, y0 - .15, front)).box(w + .2, .3, .36, WOOD, place(0, y0 - .15, -front));
    // 门：对开的板门，门框，门楣上一条红纸
    kit.box(1.9, 2.7, .14, DOOR, place(0, PLINTH + 1.35, front + .05)).box(2.3, .22, .2, WOOD, place(0, PLINTH + 2.75, front + .07));
    if (lod === 'near') kit.box(.04, 2.6, .16, '#2E1A14', place(0, PLINTH + 1.33, front + .1)).use(MAT.paper).box(1.3, .3, .02, RED, place(0, PLINTH + 3.1, front + .1));
  }
  // 窗
  const wy = PLINTH + h * .58;
  window_(kit, place(-w * .3, wy, front), 1.5, 1.1, lod); window_(kit, place(w * .3, wy, front), 1.5, 1.1, lod);
  if (style === 'horse') for (const x of [-.3, 0, .3]) window_(kit, place(x * w, PLINTH + h * .86, front), .9, .55, lod);
  if (lod === 'near') window_(kit, place(w / 2, wy, 0, Math.PI / 2), 1, .9, lod);
  // 屋顶
  if (timber) {
    gableRoof(kit, w, d, y0, rise, .9, .15, lod, SHINGLE);
    if (lod !== 'far') {
      kit.use(MAT.stone);
      for (let k = 0; k < (lod === 'near' ? 5 : 2); k++) kit.box(.5 + .3 * R(k), .3, .45, '#6E6A62', place((R(k + 9) - .5) * w * .8, y0 + rise * .55, (R(k + 3) < .5 ? 1 : -1) * front * .45, R(k) * 3));   // 压瓦的石块
      kit.use(MAT.wood).box(w * .6, .18, 1.6, WOOD_LT, place(0, y0 - .5, front + .8)).box(.22, h - .5, .22, WOOD, place(-w * .28, PLINTH + (h - .5) / 2, front + 1.5)).box(.22, h - .5, .22, WOOD, place(w * .28, PLINTH + (h - .5) / 2, front + 1.5));   // 檐廊
    }
  } else gableRoof(kit, w, d, y0, rise, .85, style === 'horse' ? .1 : .4, lod);
  if (style === 'horse') horseWalls(kit, w, d, y0, rise, lod);
  // 烟囱
  if (lod !== 'far' && R(5) < .6) kit.use(MAT.plaster).box(.6, 1.6, .6, '#CFC4B0', place(w * (R(6) - .5) * .6, y0 + rise * .5 + .5, -front * .45)).use(MAT.tile).box(.85, .14, .85, RIDGE, place(w * (R(6) - .5) * .6, y0 + rise * .5 + 1.35, -front * .45));
}

// 各样子的几个版本：[宽, 深, 墙高]
const SIZES = { white: [[10, 6.6, 5], [8.4, 6, 4.6], [12.4, 7, 5.2]], horse: [[9.4, 7.4, 8], [11, 8, 8.6]], timber: [[8, 6, 4.2], [9.6, 6.4, 4.4]] };
// 返回 shapes[样子][档] = [几何体…]（下标是版本），以及每个版本的 [宽, 深]
export function buildHouseShapes() {
  const shapes = {}, sizes = {};
  for (const style of STYLES) {
    shapes[style] = {}; sizes[style] = SIZES[style].map(([w, d]) => [w, d]);
    for (const lod of LODS) shapes[style][lod] = SIZES[style].map(([w, d, h], i) => { const kit = new Kit(); house(kit, style, w, d, h, lod, i + STYLES.indexOf(style) * 3); return kit.geometry(); });
  }
  return { shapes, sizes };
}

// 院墙：从屋前两角伸出去 depth，围成一个院子，正中开门洞。w：院子宽
export function yardGeometry(w, depth, lod) {
  const kit = new Kit(), H = 2.1, T = .45, front = depth, gate = 2.4;
  const wall = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0), yaw = Math.atan2(x1 - x0, z1 - z0), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    kit.use(MAT.plaster).box(T, H + 2, len, PLASTER, place(cx, H / 2 - 1, cz, yaw));
    kit.use(MAT.tile).box(T + .5, .3, len + .3, RIDGE, place(cx, H + .1, cz, yaw));
    if (lod === 'near') kit.box(T + .2, .22, len + .1, TILE, place(cx, H + .3, cz, yaw));
  };
  wall(-w / 2, 0, -w / 2, front); wall(w / 2, 0, w / 2, front);
  wall(-w / 2, front, -gate / 2, front); wall(gate / 2, front, w / 2, front);
  if (lod !== 'far') kit.use(MAT.tile).box(gate + 1.2, .35, 1.1, RIDGE, place(0, H + .9, front)).use(MAT.wood).box(.3, H + .6, .3, WOOD, place(-gate / 2, (H + .6) / 2, front)).box(.3, H + .6, .3, WOOD, place(gate / 2, (H + .6) / 2, front));
  return kit.geometry();
}
