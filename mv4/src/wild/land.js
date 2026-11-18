// 地貌：这片山水「天然」的形状（还没修路、没挖溪之前）。只有纯函数和常数。
// 布局（x 向东，z 向南，y 向上）：
//   主峰在原点，顶高 440，是一座花岗岩的山（peak.js）：峰顶一小片台地，东西各一座矮一截的山肩，几道支脊往南、东南、西南伸下去，
//   脊与脊之间是沟，北面和西面是绝壁；登山道（climb.js）顺着山沟、崖下的台地、山肩和一小段山脊折返着下来，路过的地方山让着路。
//   半山（高 240 上下）以下是一面渐缓的长坡（这里的 massif），一直铺到湖边。
//   主峰往东南、西南各伸出一臂山梁，把一个湖抱在怀里（水面 y = 0），到南面让出水口（ranges.js）。
//   山梁外面是云海淹着的谷地：主峰周围立着一丛丛石峰；山梁往外伸出支脉，云海里露出一串岛，水口外一条谷往南去（outland.js）；
//   再往外是一重重远山（farrange.js）。
// 山梁有两种量法（ranges.js）：RANGE 是它真的样子；ROUND 是修路时照着的那一圈规整的山梁，只给路边一带用。
// 石头山的结构（国画里山石的画法）：
//   块面——平面上按不规则的多边形分块，每块整体往外凸一点或往里收一点，崖壁于是成了一根根高矮进退不一的石柱，块与块之间是竖直的节理；
//   平台——每根石柱各自隔几十个单位收一道台，台的高度柱柱不同，连不成一圈圈的等高线；
//   裂隙——大块的交界处往里凹一道缝。
// 块面的分法（facet）地形的着色器里照样算一遍，墨线正好画在石柱的棱上。
import { rnd } from '../anim.js';
import { vnoise, fbm, ridged, smooth, lerp, clamp } from './noise.js';
import { farRange } from './farrange.js';
import { ringAt, ROUND, RANGE } from './ranges.js';
import { outland } from './outland.js';
import { peakHeight, peakWeight, climbAway, giveWay } from './peak.js';

export const PEAK_Y = 440, CLOUD_TOP = 105, LAKE_Y = 0;
export const FACET_BIG = { size: 40, ox: 3.3, oz: 7.1 }, FACET_SMALL = { size: 16, ox: 11.7, oz: 2.9 };   // 大小两层块面：格子的尺寸和错开的相位

// 南坡顺着坡顶的脊线往下的剖面：[离峰顶的水平距离, 高度]（半山以上的主峰另由 peak.js 给出）
const SPINE = [[0, 440], [12, 440], [30, 428], [60, 402], [95, 372], [130, 342], [170, 316], [215, 288], [262, 258], [300, 238], [360, 212], [430, 176], [500, 142], [570, 108], [640, 74], [710, 42], [770, 14], [800, 0], [870, -9], [1050, -13], [1e6, -13]];
function spineAt(d) {
  let i = 1;
  while (SPINE[i][0] < d) i++;
  const [d0, h0] = SPINE[i - 1], [d1, h1] = SPINE[i];
  return lerp(h0, h1, (d - d0) / (d1 - d0));
}
export const spineY = d => (spineAt(Math.max(0, d - 9)) + 2 * spineAt(d) + spineAt(d + 9)) / 4;    // 折线的拐角磨圆
// 山脊线在平面上不是直的：往南走的时候左右摆一个 S 形
export const spineX = z => 30 * Math.sin(z / 62) * smooth(10, 60, z) * smooth(390, 290, z);

// 两个高度取大的，交界处圆滑过渡（k：过渡带的宽窄）
const smax = (a, b, k) => { const h = clamp(.5 + .5 * (a - b) / k); return lerp(b, a, h) + k * h * (1 - h); };

// 块面：每个格子里一个随机点，(x, z) 离哪个点最近就归哪一块。out.a、out.b 是这一块的两个随机数，out.edge 是离块的边界多远。
// 随机数直接取噪声表里的格点值（vnoise 在整数坐标上就是表里的数），着色器查同一张表，两边分出来的块一模一样
function facet(x, z, { size, ox, oz }, out) {
  const px = x / size + ox, pz = z / size + oz, ix = Math.floor(px), iz = Math.floor(pz);
  let d1 = 1e9, d2 = 1e9, bi = 0, bj = 0;
  for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) {
    const gi = ix + a, gj = iz + b, fx = gi + .15 + .7 * vnoise(gi, gj) - px, fz = gj + .15 + .7 * vnoise(gi - 37, gj - 17) - pz, d = fx * fx + fz * fz;
    if (d < d1) { d2 = d1; d1 = d; bi = gi; bj = gj; } else if (d < d2) d2 = d;
  }
  out.a = vnoise(bi + 59, bj + 83); out.b = vnoise(bi + 101, bj + 29); out.edge = (Math.sqrt(d2) - Math.sqrt(d1)) * size;
  return out;
}

// 半山以下的南坡（只在主峰的范围 peakWeight 以外用得上）：坡顶一条脊线，往南一路低下去，横向渐渐放开成宽阔的坡面。
// shift：这一块石柱往外凸（负）还是往里收（正）多少。脊线附近不动
function massif(x, z, shift) {
  const k = lerp(3.2, .75, smooth(250, 400, z)), lat = x - spineX(Math.max(z, 0)), side = Math.abs(lat), free = smooth(4, 26, Math.hypot(side, Math.min(z, 0)));
  const rib = 26 * (1 - Math.abs(Math.sin(Math.PI * (z + (lat > 0 ? 31 : 0)) / 82)) ** .8) * smooth(18, 90, side) * smooth(340, 240, z);
  // along：顺着山脊走了多远；over：因为偏离山脊线而多出来的那一截。进退最多吃掉 over 的一半多一点，所以再怎么凸也高不过身边的山脊
  const along = z < 0 ? -3.4 * z : z, over = Math.hypot(along, k * side) - along;
  return spineY(along + Math.max(over + (shift - rib) * free, .45 * over));
}

// 主峰周围的石峰：[x, z, 顶高, 半径]。每一处是一丛：一根主柱，旁边挨着一两根矮一截的副柱
const SPIRES = [
  [-150, -40, 330, 40], [135, -85, 318, 36], [-55, -175, 300, 42], [75, -220, 270, 36], [250, -10, 286, 40], [-265, 50, 270, 42], [-195, -195, 246, 46],
  [220, -205, 232, 42], [-365, -90, 214, 36], [365, -135, 208, 34], [175, 150, 250, 30], [-185, 185, 236, 32], [-470, 60, 186, 34], [480, 20, 178, 32],
];
// 每根石柱：[x, z, 顶高, 半径, 顶收多少（0 平顶，1 钝的圆顶）]
const PILLARS = SPIRES.flatMap(([x, z, top, r], i) => {
  const turn = rnd(i * 3.1 + .7) * Math.PI * 2, list = [[x, z, top, r * .8, .25 + .6 * rnd(i * 5.3 + 2)]];
  list.push([x + Math.cos(turn) * r * .7, z + Math.sin(turn) * r * .7, top * (.7 + .16 * rnd(i * 7.7 + 1)), r * .5, .2 + .7 * rnd(i * 2.9 + 4)]);
  if (rnd(i * 9.1 + 3) < .6) list.push([x - Math.cos(turn + .9) * r * .78, z - Math.sin(turn + .9) * r * .78, top * (.46 + .2 * rnd(i * 4.3 + 6)), r * .44, .5 + .5 * rnd(i * 6.1 + 8)]);
  return list;
});
// 瀑布口那块凸出的崖：溪水从它顶上跌下来
const CRAG = { x: 98, z: 338, r: 42, h: 45 };

const BIG = {}, SMALL = {};
// 天然地形在 (x, z) 的高度。plan：山梁按哪种量法（不给就是它真的样子）
export function landHeight(x, z, plan = RANGE) {
  // 整体轻轻扭一下，山的轮廓不那么规整（路附近不扭）。peak：这一处有几成算主峰（peak.js），其余是半山以下的南坡；
  // spine：离路多远——主峰上是登山道（climb.js），南坡上是坡顶那条脊线
  const peak = peakWeight(x, z), spine = lerp(Math.hypot(x - spineX(clamp(z, 0, 400)), Math.min(z, 0), Math.max(z - 330, 0)), climbAway(x, z), peak), twist = 30 * smooth(60, 200, spine);
  const wx = x + twist * (fbm(x / 180 + 3.1, z / 180 + 7.7, 3) - .5), wz = z + twist * (fbm(x / 180 + 41.3, z / 180 + 17.9, 3) - .5);
  facet(x, z, FACET_BIG, BIG); facet(x, z, FACET_SMALL, SMALL);
  const shift = 32 * (2 * BIG.a - 1) + 11 * (2 * SMALL.a - 1);                                   // 这一块石柱进退多少
  const ring = ringAt(wx, wz, shift, plan), inside = smooth(20, -70, ring.off) * smooth(250, 340, z);     // 在不在山梁以内的南坡上（那里是树林和山路，地势要平顺）
  const slope = peak < 1 ? massif(wx, wz, shift * (1 - inside)) : 0, mount = peak > 0 ? lerp(slope, peakHeight(wx, wz, shift), peak) : slope;
  let h = smax(giveWay(x, z, mount), ring.h, 18);                                                 // 登山道经过的地方，山让着路
  for (const [px, pz, top, r, sharp] of PILLARS) {
    const d = Math.hypot(wx - px, wz - pz);
    if (d > r * 3.6) continue;
    const girth = r * (.72 + .6 * fbm(x / 30 + px, z / 30 + pz, 2));                              // 柱身不是圆的：有的面鼓出去，有的面削进来
    const q = Math.max(0, d + shift * .5 * smooth(.2, .7, d / r)) / girth, wall = 1 - smooth(.56, 1.14, q);
    // 顶上是平的或者一个钝的圆顶（不收成尖），四壁直上直下，柱脚拖一圈缓下去的碎石坡
    h = smax(h, 30 + (top - 30) * (.86 * wall * (1 - .36 * sharp * smooth(.1, 1.05, q)) + .14 * Math.exp(-q * q / 2.4)), 9);
  }
  h += CRAG.h * Math.exp(-(((x - CRAG.x) ** 2 + (z - CRAG.z) ** 2) / CRAG.r ** 2));

  // 山梁以外：谷底和远山（远山的山形在 farrange.js 里分几遍做出来：山系、棱线、崩塌、冲沟），加上支脉、岛和出谷（outland.js）
  const outside = smooth(-60, 30, ring.off), valley = 38 + 24 * (fbm(x / 260 + 1.7, z / 260 + 4.1, 3) - .5);
  h = smax(h, lerp(-40, plan === ROUND ? valley + farRange(x, z) : outside > 0 ? outland(x, z, valley + farRange(x, z)) : 0, outside), 14);

  // 细节：平缓的起伏到处都有；嶙峋的棱只长在石头山上
  //     路上和路边不长；主峰是整块的花岗岩，棱比四周的石峰钝（大的形体由 peak.js 的几道脊给出）
  const crag = lerp(1, .16, inside) * lerp(1, .45, peak), rocky = crag * smooth(50, 130, h) * smooth(7, 46, spine);
  h += (fbm(x / 58 + 13.1, z / 58 + 5.9, 4) - .5) * lerp(9, 5, inside) * smooth(-4, 12, h) * smooth(5, 30, spine);
  h += ((ridged(x / 150 + 11.3, z / 150 + 5.1, 4) - .42) * 20 + (ridged(x / 44 + 3.7, z / 44 + 9.9, 3) - .4) * 8) * rocky;
  // 平台：每根石柱按自己的相位收台
  const STEP = 44, v = h / STEP + BIG.b + .8 * SMALL.b, f = v - Math.floor(v);
  h += (smooth(.2, .8, f) - f) * STEP * .58 * rocky;
  // 裂隙：大块之间往里凹一道缝
  h -= 11 * smooth(6.5, 0, BIG.edge) * rocky;
  return Math.max(h, plan === ROUND ? -14 : -64);                                                  // 出谷的谷底一路低到云海底下
}
