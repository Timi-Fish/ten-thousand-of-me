// 叶的图谱：一张 2048 的贴图，4×4 共 16 格，每格画着一簇东西——阔叶、枫叶、松针、竹叶、柳丝、桃花、梅花、枯枝梢。
// 树冠上的每一张「叶片」都是贴着其中一格的小卡片，所以近看是一片片有形状的叶，不是色块。全是用画布现画的，不读任何图片。
// 四个通道各管一件事：
//   R 笔触的浓淡（叶根深、叶尖浅，压在下面的叶深）；G 在这种树的两种叶色之间偏哪一边（一片一个样）；
//   B 这个像素是什么：0 叶，0.5 枝梗，1 花瓣（在枯枝那一格里是枝上的积雪）；A 形状。
import * as THREE from 'three';
import { rnd } from '../anim.js';

const GRID = 4, CELL = 512, SIZE = GRID * CELL, PAD = 8, TAU = Math.PI * 2, PX = 2 / CELL;   // PX：格内坐标（-1 到 1）里一个像素有多大
export const CELLS = { ovate: 0, maple: 1, sprig: 2, round: 3, needleTop: 4, needleSide: 5, lance: 6, bamboo: 7, strand: 8, peach: 9, peachSprig: 10, plum: 11, twig: 12, needleSparse: 13, mapleSprig: 14, dabs: 15 };
export const STRANDS = 4;                                             // 柳丝那一格里并排画了几条
const LEAF = 0, STEM = .5, PETAL = 1;

// 一格在贴图上的范围 [u0, v0, 宽, 高]；column 不为负时取柳丝格里的第几条
export function cellRect(cell, column = -1) {
  const u0 = (cell % GRID) / GRID, v0 = Math.floor(cell / GRID) / GRID, w = 1 / GRID;
  return column < 0 ? [u0, v0, w, w] : [u0 + w * column / STRANDS, v0, w / STRANDS, w];
}

const ink = (tone, hue, kind) => `rgb(${Math.round(255 * Math.min(1, Math.max(0, tone)))},${Math.round(255 * hue)},${Math.round(255 * kind)})`;
const lerp = (a, b, k) => a + (b - a) * k;

// 画笔：同一笔同时落在两张画布上——一张记形状（A），一张记浓淡、偏色、是什么（RGB）。
// 记颜色的那张每一笔都多描一圈边，贴图缩小、边缘插值的时候不会混进背景的值
class Pen {
  constructor() {
    const make = () => { const c = document.createElement('canvas'); c.width = c.height = SIZE; return c.getContext('2d', { willReadFrequently: true }); };
    this.data = make(); this.mask = make();
    this.mask.fillStyle = '#000'; this.mask.fillRect(0, 0, SIZE, SIZE);
  }
  // 开始画一格：坐标换成格心为原点、格边为 ±1（y 向下）；ground 是这一格背景记成什么
  cell(index, ground, draw) {
    const x0 = (index % GRID) * CELL, y0 = Math.floor(index / GRID) * CELL;
    this.data.fillStyle = ink(.5, .5, ground); this.data.fillRect(x0, y0, CELL, CELL);
    for (const c of [this.data, this.mask]) { c.save(); c.beginPath(); c.rect(x0 + PAD, y0 + PAD, CELL - 2 * PAD, CELL - 2 * PAD); c.clip(); c.translate(x0 + CELL / 2, y0 + CELL / 2); c.scale(CELL / 2, CELL / 2); }
    draw(k => rnd(index * 17.31 + k * .7319 + 3.1));
    this.data.restore(); this.mask.restore();
  }
  // 在 (x, y) 处转过 rot 画一个填实的形状。trace 在局部坐标里描路径（形状从原点朝 +x 伸出去 len）；浓淡从根部的 t0 过渡到尖上的 t1
  shape(x, y, rot, trace, len, t0, t1, hue, kind = LEAF) {
    for (const c of [this.data, this.mask]) { c.save(); c.translate(x, y); c.rotate(rot); trace(c); }
    const grad = this.data.createLinearGradient(0, 0, len, 0);
    grad.addColorStop(0, ink(t0, hue, kind)); grad.addColorStop(1, ink(t1, hue, kind));
    this.data.strokeStyle = this.data.fillStyle = grad; this.data.lineWidth = 5 * PX; this.data.lineJoin = 'round'; this.data.stroke(); this.data.fill();
    this.mask.fillStyle = '#fff'; this.mask.fill();
    this.data.restore(); this.mask.restore();
  }
  // 一条线（枝梗、松针）
  line(x0, y0, x1, y1, width, tone, hue, kind = STEM) {
    for (const c of [this.data, this.mask]) { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.lineCap = 'round'; }
    this.data.strokeStyle = ink(tone, hue, kind); this.data.lineWidth = width + 4 * PX; this.data.stroke();
    this.mask.strokeStyle = '#fff'; this.mask.lineWidth = width; this.mask.stroke();
  }
  // 只改浓淡、不改形状的一笔（叶脉、花心的晕染）
  tint(x0, y0, x1, y1, width, tone, hue, kind) {
    const c = this.data;
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.lineCap = 'round'; c.strokeStyle = ink(tone, hue, kind); c.lineWidth = width; c.stroke();
  }
  texture() {
    const rgb = this.data.getImageData(0, 0, SIZE, SIZE).data, a = this.mask.getImageData(0, 0, SIZE, SIZE).data;
    for (let i = 0; i < rgb.length; i += 4) rgb[i + 3] = a[i];
    const tex = new THREE.DataTexture(new Uint8Array(rgb.buffer), SIZE, SIZE, THREE.RGBAFormat);
    tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter; tex.anisotropy = 4; tex.needsUpdate = true;
    return tex;
  }
}

// 各种叶形：都是从原点朝 +x 长出去的路径
const ovate = (L, W) => c => { c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(L * .22, -W, L * .68, -W * .85, L, 0); c.bezierCurveTo(L * .68, W * .85, L * .22, W, 0, 0); };
const lance = (L, W) => c => { c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(L * .32, -W, L, 0); c.quadraticCurveTo(L * .32, W, 0, 0); };
const disc = (r, squash = 1) => c => { c.beginPath(); c.ellipse(r, 0, r, r * squash, 0, 0, TAU); };
const LOBES = [[-1.3, .5], [-.66, .84], [0, 1], [.66, .84], [1.3, .5]];                              // 枫叶的五个裂片：朝向、长短
const maple = L => c => {
  c.beginPath(); c.moveTo(0, 0);
  LOBES.forEach(([a, len], i) => {
    if (i > 0) { const m = (a + LOBES[i - 1][0]) / 2; c.lineTo(Math.cos(m) * L * .34 + L * .1, Math.sin(m) * L * .34); }
    c.lineTo(Math.cos(a) * L * len + L * .1, Math.sin(a) * L * len);
  });
  c.closePath();
};

// 一片叶：填色（根深尖浅）再提一道主脉
function leaf(pen, x, y, rot, trace, L, tone, hue, vein = .1) {
  pen.shape(x, y, rot, trace, L, tone * .62, tone * 1.12, hue);
  pen.tint(x + Math.cos(rot) * L * .08, y + Math.sin(rot) * L * .08, x + Math.cos(rot) * L * .8, y + Math.sin(rot) * L * .8, 1.6 * PX, tone * (1.12 + vein), hue, LEAF);
}
// 一簇叶：count 片从里往外转着排开，叶尖朝外；外圈先画、压在下面的偏深，里圈后画、偏亮。droop：叶尖往下（+y）垂多少
function whorl(pen, R, count, radius, make, { droop = 0, spread = 1.3, dark = .36, bright = .98 } = {}) {
  for (let i = count - 1; i >= 0; i--) {
    const k = (i + .5) / count, rr = radius * Math.sqrt(k), a = i * 2.39996 + R(i * 3 + 1) * .9, dir = a + (R(i * 3 + 2) - .5) * spread;
    const rot = Math.atan2(Math.sin(dir) + droop, Math.cos(dir)), tone = lerp(dark, bright, .55 * R(i * 3 + 3) + .45 * (1 - k));
    make(Math.cos(a) * rr, Math.sin(a) * rr, rot, tone, R(i * 3 + 4), i);
  }
}
// 一根带分叉的枝梗，从 (x, y) 朝 rot 长 len；每个梢头和沿途调用 tip(x, y, 朝向, 第几层)
function twig(pen, R, x, y, rot, len, width, depth, tone, tip, seed = 1) {
  const bend = (R(seed * 7.7) - .5) * .5, mx = x + Math.cos(rot + bend) * len * .55, my = y + Math.sin(rot + bend) * len * .55, ex = mx + Math.cos(rot - bend) * len * .45, ey = my + Math.sin(rot - bend) * len * .45;
  pen.line(x, y, mx, my, width, tone, .5); pen.line(mx, my, ex, ey, width * .75, tone, .5);
  tip(mx, my, rot + bend, depth); tip(ex, ey, rot - bend, depth);
  if (depth <= 0) return;
  twig(pen, R, mx, my, rot + bend + .55 + .4 * R(seed * 3.3), len * .62, width * .7, depth - 1, tone, tip, seed * 2 + 1);
  twig(pen, R, ex, ey, rot - bend - .3 - .5 * R(seed * 5.1), len * .66, width * .7, depth - 1, tone, tip, seed * 2 + 2);
  if (R(seed * 9.9) < .6) twig(pen, R, ex, ey, rot - bend + .5, len * .5, width * .6, depth - 1, tone, tip, seed * 2 + 3);
}
// 一轮松针：从一点朝四周（或只朝上半边）射出去，底下垫一块深色，远看是实的一团、边上是针
function needles(pen, R, x, y, len, from, sweep, count, tone, seed) {
  const fan = sweep < 4;                                                                             // 只朝上半边的一把：垫色也只垫上半边
  pen.shape(x - len * .5, fan ? y - len * .24 : y, 0, disc(len * .5, fan ? .5 : 1), len, tone * .42, tone * .5, .3);
  for (let i = 0; i < count; i++) {
    const a = from + sweep * (i + R(seed + i * 1.7)) / count, l = len * (.72 + .3 * R(seed + i * 2.9));
    pen.line(x, y, x + Math.cos(a) * l, y + Math.sin(a) * l, 4.2 * PX, tone * (.62 + .46 * R(seed + i * 4.3)), R(seed + i * 5.9), LEAF);
  }
}
// 一朵五瓣的花：瓣尖浅、瓣根深，中间一点花心
function blossom(pen, R, x, y, r, tone, hue, seed) {
  const turn = R(seed) * TAU;
  for (let i = 0; i < 5; i++) { const a = turn + i * TAU / 5; pen.shape(x + Math.cos(a) * r * .12, y + Math.sin(a) * r * .12, a, disc(r * .46, .92), r * .9, tone * .7, tone * 1.08, hue, PETAL); }
  pen.tint(x, y, x, y, r * .5, tone * .5, 0, PETAL);
  for (let i = 0; i < 5; i++) { const a = turn + .6 + i * TAU / 5; pen.tint(x, y, x + Math.cos(a) * r * .34, y + Math.sin(a) * r * .34, 1.3 * PX, tone * .42, 0, PETAL); }
}

// 十六格各画什么。R(k) 是这一格自己的一串随机数
const DRAW = {
  // 卵形叶的一大簇：最常用的阔叶
  ovate: [LEAF, (pen, R) => whorl(pen, R, 70, .7, (x, y, rot, tone, hue, i) => { const L = .21 + .11 * R(i * 3 + 700); leaf(pen, x, y, rot, ovate(L, L * .34), L, tone, hue); })],
  // 枫叶的一簇
  maple: [LEAF, (pen, R) => whorl(pen, R, 44, .64, (x, y, rot, tone, hue, i) => { const L = .24 + .1 * R(i * 3 + 700); leaf(pen, x, y, rot, maple(L), L, tone, hue, .06); })],
  // 一根小枝，叶子互生：放在树冠边上，轮廓里看得见枝
  sprig: [LEAF, (pen, R) => twig(pen, R, 0, .86, -TAU / 4, .95, 5 * PX, 2, .16, (x, y, rot) => {
    for (const side of [-1, 1]) { const L = .3 + .1 * R(x * 31 + y * 17 + side); leaf(pen, x, y, rot + side * (.6 + .5 * R(x * 13 + side * 3)), ovate(L, L * .36), L, .5 + .5 * R(y * 23 + side), R(x * 7 + y * 3 + side)); }
  })],
  // 小圆叶的一簇（黄栌）
  round: [LEAF, (pen, R) => whorl(pen, R, 64, .68, (x, y, rot, tone, hue, i) => { const r = .085 + .04 * R(i * 3 + 700); pen.shape(x, y, rot, disc(r, .88), r * 2, tone * .66, tone * 1.1, hue); })],
  // 松针，从上往下看：一轮轮的针挤成一片云
  needleTop: [LEAF, (pen, R) => whorl(pen, R, 12, .58, (x, y, rot, tone, hue, i) => needles(pen, R, x, y, .25 + .09 * R(i + 400), 0, TAU, 30, tone, i * 50 + 800), { dark: .5 })],
  // 松针，从侧面看：一把把朝上的扇子排成一行，底是平的（国画里画松的「扇形针」）
  needleSide: [LEAF, (pen, R) => {
    for (let row = 0; row < 2; row++) for (let i = 0; i < 6 - row; i++) {
      const x = -.74 + (i + .5 * row + .3 * R(i + row * 9)) * .29, y = .5 - row * .05 - .16 * R(i * 3 + row * 7 + 2);
      needles(pen, R, x, y, .36 + .14 * R(i * 5 + row * 11), -TAU / 2 + .12, TAU / 2 - .24, 22, row ? .88 : .56, i * 40 + row * 300 + 900);
    }
  }],
  // 披针形叶的一簇，叶尖往下垂（桃、梅、柳的叶）
  lance: [LEAF, (pen, R) => whorl(pen, R, 54, .62, (x, y, rot, tone, hue, i) => { const L = .27 + .13 * R(i * 3 + 700); leaf(pen, x, y, rot, lance(L, L * .19), L, tone, hue); }, { droop: .8 })],
  // 竹叶：一节小枝上三五片叶像「个」字、「介」字那样垂着
  bamboo: [LEAF, (pen, R) => {
    for (let i = 0; i < 11; i++) {
      const x = (R(i * 3) - .5) * 1.2, y = -.62 + 1.05 * R(i * 3 + 1), count = 3 + Math.floor(R(i * 3 + 2) * 3), tone = .45 + .5 * (i / 10);
      pen.line(x, y, x - (x * .6 + .1), y - .28, 2.4 * PX, .2, .5);
      for (let j = 0; j < count; j++) { const L = .34 + .2 * R(i * 9 + j), rot = TAU / 4 + (j - (count - 1) / 2) * .5 + (R(i * 5 + j) - .5) * .3; leaf(pen, x, y, rot, lance(L, L * .13), L, tone * (.8 + .3 * R(i + j * 7)), R(i * 2 + j)); }
    }
  }],
  // 柳丝：并排四条，每条一根细梗、两边互生着窄叶，叶尖朝下
  strand: [LEAF, (pen, R) => {
    for (let s = 0; s < STRANDS; s++) {
      const cx = -1 + (s + .5) * 2 / STRANDS, wob = k => cx + .05 * Math.sin(k * 5 + s * 2.1) * k;
      for (let i = 0; i < 20; i++) pen.line(wob(i / 20), -1 + i * .1, wob((i + 1) / 20), -.9 + i * .1, 2.6 * PX, .22, .5);
      for (let i = 0; i < 44; i++) {
        const k = (i + .5) / 44, side = i % 2 ? 1 : -1, L = (.15 + .07 * R(s * 100 + i)) * (1 - .35 * k), rot = TAU / 4 + side * (.42 + .3 * R(s * 200 + i));
        leaf(pen, wob(k), -1 + 2 * k * .93, rot, lance(L, .034), L, .5 + .5 * R(s * 300 + i), R(s * 400 + i));
      }
    }
  }],
  // 桃花，开满的一簇
  peach: [PETAL, (pen, R) => whorl(pen, R, 26, .66, (x, y, rot, tone, hue, i) => {
    if (i % 6 === 5) pen.shape(x, y, rot, disc(.05), .1, .5, .7, .1, PETAL);                         // 花苞
    else blossom(pen, R, x, y, .14 + .05 * R(i + 500), .74 + .26 * tone, hue, i * 3 + 600);
  }, { dark: .3 })],
  // 桃花，疏疏地缀在一根小枝上
  peachSprig: [PETAL, (pen, R) => twig(pen, R, 0, .88, -TAU / 4, 1, 5.5 * PX, 2, .2, (x, y, rot, depth) => {
    for (let j = 0; j < 2; j++) { const a = rot + (j ? 1 : -1) * (1.1 + .5 * R(x * 9 + j)), d = .12 + .06 * j; blossom(pen, R, x + Math.cos(a) * d, y + Math.sin(a) * d, .13 + .05 * R(y * 11 + j), .8 + .2 * R(x * 5 + j), R(y * 7 + j * 3), x * 40 + y * 60 + j); }
    if (depth === 0) pen.shape(x + Math.cos(rot) * .07, y + Math.sin(rot) * .07, rot, disc(.04), .08, .5, .7, .1, PETAL);
  })],
  // 梅花：折来折去的细枝上疏疏几朵、几个花苞
  plum: [PETAL, (pen, R) => twig(pen, R, -.1, .88, -TAU / 4 + .2, 1.05, 6 * PX, 2, .14, (x, y, rot, depth) => {
    if (R(x * 37 + y * 11) < .78) blossom(pen, R, x + .04, y - .03, .085 + .035 * R(x * 5 + y), .78 + .22 * R(x + y * 9), R(x * 3 + y * 5), x * 50 + y * 70);
    if (depth < 2) pen.shape(x - Math.sin(rot) * .06, y + Math.cos(rot) * .06, rot, disc(.034), .07, .55, .75, .05, PETAL);
  })],
  // 枯枝梢：叶落之后树冠外缘的细杈。每一段枝的上面压着一小条雪（只在积雪的季节显出来）
  twig: [STEM, (pen, R) => {
    const segs = [];
    twig(pen, R, 0, .92, -TAU / 4, .92, 5 * PX, 3, .2, (x, y, rot, depth) => { if (depth < 3) segs.push([x, y, rot]); });
    for (const [x, y, rot] of segs) pen.shape(x - Math.cos(rot) * .07, y - Math.sin(rot) * .07 - .02, rot, disc(.07, .2), .14, .8, 1, .5, PETAL);
  }],
  // 疏的几轮松针：放在云片边上，轮廓不是一刀切的
  needleSparse: [LEAF, (pen, R) => {
    for (let i = 0; i < 6; i++) { const a = i * 2.4 + R(i), rr = .2 + .36 * R(i + 20); needles(pen, R, Math.cos(a) * rr, Math.sin(a) * rr, .24 + .1 * R(i + 40), 0, TAU, 26, .6 + .4 * R(i + 60), i * 50 + 100); }
  }],
  // 一根小枝上的枫叶
  mapleSprig: [LEAF, (pen, R) => twig(pen, R, 0, .86, -TAU / 4, .92, 5 * PX, 1, .16, (x, y, rot) => {
    for (const side of [-1, 0, 1]) { const L = .3 + .1 * R(x * 31 + y * 17 + side); leaf(pen, x, y, rot + side * (.8 + .3 * R(x * 13 + side * 3)), maple(L), L, .5 + .5 * R(y * 23 + side), R(x * 7 + y * 3 + side), .06); }
  })],
  // 碎点子：远处的林冠用，一大团参差的墨点（点叶）
  dabs: [LEAF, (pen, R) => whorl(pen, R, 120, .8, (x, y, rot, tone, hue, i) => { const L = .13 + .1 * R(i * 3 + 700); pen.shape(x, y, rot, ovate(L, L * .45), L, tone * .7, tone * 1.1, hue); }, { dark: .3 })],
};

let atlas = null;
// 整张图谱（只画一次，所有树共用）
export function leafAtlas() {
  if (atlas) return atlas;
  const pen = new Pen();
  for (const [name, [ground, draw]] of Object.entries(DRAW)) pen.cell(CELLS[name], ground, R => draw(pen, R));
  atlas = pen.texture();
  return atlas;
}
