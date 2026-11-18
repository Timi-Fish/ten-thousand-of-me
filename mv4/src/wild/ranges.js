// 抱湖的山梁：主峰往东南、西南各伸出一臂，把湖抱在怀里；两臂一路往南低下去，到南面各收成一个山嘴，中间让出水口（谷口）。
// 脊线是一条绕着湖心的线，用极坐标写：φ 从正北顺时针量（正东 90°），R(φ) 离湖心多远，H(φ) 多高。
//   两臂不对称：东臂在东北、东南各隆起一个结（脊线往外鼓、抬高），中间一段收进来、塌成鞍部；西臂西南鼓出去一大块，正西收进来、低成一个垭口（云从那里漫进来）。
//   脊顶是圆的：内坡、外坡两个面在脊上磨圆了接起来，没有刀刃一样的棱。
//   水口（方位 177° 到 195°）：脊线降到地面，里面是一片高出湖面几个单位的平地，一直接到谷口外的谷底（outland.js）。
// ROUND 是修路时照着量的那一圈规整的山梁（没有结、没有鞍、没有水口）：路边一带的地形按它算（heights.js 里离路近的地方、roadside.js 的路基），
// 所以路边的地面和路基严丝合缝；两者在北面主峰那一侧（方位 ±45° 以内）脊线的位置和高度相同，只差脊顶磨没磨圆。
import { fbm, smooth, lerp, clamp } from './noise.js';

export const BOWL = { x: 0, z: 690 };                                // 湖心：山梁的极坐标原点
export const D2R = Math.PI / 180;
export const ROUND = 'round', RANGE = 'range';
export const SILL = 5;                                               // 水口里那片平地的高度
// 脊线上的结：[方位°, 脊线往外挪多少, 抬高多少, 内坡多宽, 外坡多陡]。两个结之间平滑过渡；头尾两个结以北和 ROUND 一样
const KNOTS = [
  [45, 0, 0, 215, 1.05], [58, 28, 20, 205, 1.1], [76, -42, -34, 180, .9], [96, -30, 6, 205, 1.05], [117, -25, -6, 215, .85], [136, -30, 34, 190, 1.1], [152, 16, -4, 215, .9],
  [166, -6, -24, 200, .8], [186, -24, 0, 215, .7], [204, 22, -28, 205, .8], [221, 44, 12, 235, 1], [240, -10, -14, 210, .85], [257, -52, -52, 170, .7], [276, 10, 26, 205, 1.1],
  [296, -34, -12, 185, .95], [315, 0, 0, 215, 1.05],
];
const MOUTH = [162, 177, 195, 209];                                  // 水口：脊线从 162° 起降，177° 到 195° 完全敞开，到 209° 升回去

const southOf = phi => (1 - Math.cos(phi)) / 2;                       // 0 正北 → 1 正南
const roundR = south => 410 + 150 * south ** 1.5, roundH = south => 196 - 62 * smooth(.2, .9, south), northFade = south => smooth(.015, .1, south);

// 方位 phi 处的结：dR、dH、width 内坡宽、steep 外坡陡、open 水口敞开几成
const KNOT = { dR: 0, dH: 0, width: 215, steep: 1.05, open: 0 };
function knotAt(phi) {
  const deg = ((phi / D2R) % 360 + 360) % 360, last = KNOTS.length - 1;
  let i = deg >= KNOTS[last][0] ? last : 0;
  if (i === 0 && deg > KNOTS[0][0]) while (KNOTS[i + 1][0] < deg) i++;
  const a = KNOTS[i], b = KNOTS[Math.min(last, i + 1)], k = a === b ? 0 : smooth(a[0], b[0], deg);
  KNOT.dR = lerp(a[1], b[1], k); KNOT.dH = lerp(a[2], b[2], k); KNOT.width = lerp(a[3], b[3], k); KNOT.steep = lerp(a[4], b[4], k);
  KNOT.open = smooth(MOUTH[0], MOUTH[1], deg) * smooth(MOUTH[3], MOUTH[2], deg);
  return KNOT;
}
// 脊线离湖心多远、多高、内坡多宽、水口敞开几成（都不含地貌里那层小起伏）
export const crestR = phi => roundR(southOf(phi)) + knotAt(phi).dR;
export const crestH = phi => { const k = knotAt(phi), south = southOf(phi); return (roundH(south) + k.dH) * northFade(south) * (1 - k.open); };
export const crestWidth = phi => knotAt(phi).width;
export const mouthOpen = phi => knotAt(phi).open;

const smin = (a, b, k) => { const h = clamp(.5 + .5 * (b - a) / k); return lerp(b, a, h) - k * h * (1 - h); };

// 山梁在 (x, z) 的样子：{ h 高度, off 离脊线多远（脊线以内为负）}。shift：这一块石柱进退多少（外坡的陡壁分块进退）
export function ringAt(x, z, shift, plan) {
  const dx = x - BOWL.x, dz = z - BOWL.z, rho = Math.hypot(dx, dz), c = rho > 1e-6 ? -dz / rho : 1, s = rho > 1e-6 ? dx / rho : 0;
  const south = (1 - c) / 2;
  const R = roundR(south) + 44 * (fbm(2.1 * c + 5.3, 2.1 * s + 9.1, 3) - .5);
  const crest = (roundH(south) + 34 * (fbm(3.3 * c + 21.7, 3.3 * s + 2.9, 3) - .5)) * northFade(south);
  if (plan === ROUND) {
    const off = rho - R, t = -off / 215, out = off + shift * .7 * smooth(4, 40, off);
    return { h: off >= 0 ? crest - 1.05 * out : t < 1 ? crest * (1 - t) ** 1.7 : -13 * smooth(1, 1.3, t), off };   // 圈外陡，圈内先陡后缓，一直缓到湖底
  }
  const k = knotAt(Math.atan2(dx, -dz)), top = Math.max(0, crest + k.dH * northFade(south)) * (1 - k.open);
  const off = rho - (R + k.dR), t = -off / k.width, out = off + shift * .7 * smooth(4, 40, off);
  // 内坡先陡后缓，一直缓到湖底；外坡陡；两个面在脊上磨圆
  const arm = t < 1 ? smin(top * (1 - t) ** 1.7, top - k.steep * out, 16) : -13 * smooth(1, 1.3, t);
  // 水口：里面一片平地，出了脊线缓缓低下去
  return { h: k.open > 0 ? lerp(arm, SILL - .08 * Math.max(0, off), k.open * smooth(1.15, .92, t) * smooth(110, 40, off)) : arm, off };
}
