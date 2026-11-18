// 山脊布景共用的着色器片段：按季节取色、风。
//   取色——季节表（seasons.js）里没有山脊布景要的那些颜色（灌木的红橙紫、草穗、绸带……），这里不往表里添，
//         而是每样东西把四季的颜色直接写进着色器，用 uPick（当季那一个通道是 1）挑出当季的。
//   风——风向、风力、阵风掠过的快慢都取季节表里的 uWind（和 paint.js 的 windSway 同一个风）。
//         山脊上风大：大的一阵和 windSway 同源，上面再叠一层更碎、更快的；一阵压过去，草木被压弯，风头一过往回弹一下再摆几摆。
import * as THREE from 'three';

const vec = hex => { const c = new THREE.Color(hex); return `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`; };
// 四季各一个颜色 → 着色器里的表达式（春、夏、秋、冬）
export const pal = (spring, summer, autumn, winter) => `(${vec(spring)} * uPick.x + ${vec(summer)} * uPick.y + ${vec(autumn)} * uPick.z + ${vec(winter)} * uPick.w)`;
// 四季各一个数 → 表达式
export const num = (spring, summer, autumn, winter) => `dot(vec4(${[spring, summer, autumn, winter].map(v => v.toFixed(3)).join(', ')}), uPick)`;

export const RIDGE_WIND = /* glsl */`
vec2 ridgeWindDir() { return normalize(uWind.xy + 1e-4); }
// 这一处、这一刻的风有多猛：0 是风停的间隙，1 上下是一阵正猛的时候
float ridgeGust(vec2 xz, float t) {
  float big = noise1(xz * .013 - uWind.xy * t * uWind.w) - .32;
  float fast = noise1(xz * .052 - uWind.xy * t * .62 + 7.3) * .65 + noise1(xz * .13 - uWind.xy * t * 1.4 + 3.1) * .35;
  return clamp(max(big, 0.) * 1.5 + smoothstep(.42, .8, fast) * .95, 0., 1.5);
}
// 顺风推多少：常风压着一点，一阵来了压得深；风头过去（这一刻比片刻前弱）的时候往回弹，弹回去再摆几摆
float ridgePress(vec2 xz, float phase) {
  float g = ridgeGust(xz, uTime), before = ridgeGust(xz, uTime - .4);
  float rebound = max(before - g, 0.) * sin(uTime * 8.3 + phase * 6.283) * 1.4;
  float flutter = .1 * sin(uTime * 3.1 + phase * 6.283 + xz.x * .3) + .06 * sin(uTime * 5.7 + phase * 17.);
  return uWind.z * (.4 + g - rebound + flutter);
}
// 一个随风弯的点：root 根在哪；reach 这一点离根多远；len 整株多高（梢头 reach = len）；give 梢头最多顺风偏出去几成 len；phase 各自的相位。
// 越往梢弯得越多（按 reach / len 的平方）；往下风推出去的同时梢头往下落一点（长度大体不变）
vec3 ridgeBend(vec3 root, float reach, float len, float give, float phase) {
  float k = clamp(reach / max(len, .05), 0., 1.3), push = ridgePress(root.xz, phase) * give * len * k * k;
  vec2 d = ridgeWindDir();
  return vec3(d.x * push, -.5 * push * push / max(reach, .2), d.y * push);
}`;
