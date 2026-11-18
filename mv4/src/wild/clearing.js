// 放晴：下雨的季节在季节表里另有一套「雨停之后」的光和颜色（clear）。天气停到几成，就把两套值混到几成，
// 混出来的东西和季节表里的一季是同一个形状，照常交给灯和着色器。没有 clear 的季节原样返回。
import * as THREE from 'three';
import { kindOf } from './paint.js';

const A = new THREE.Color(), B = new THREE.Color();
const lerp = (a, b, c) => a + (b - a) * c;
const tint = (a, b, c) => `#${A.set(a).lerp(B.set(b), c).getHexString()}`;
// 一个量按它的写法混：'#颜色'、数字、['#颜色', 倍数]、数字数组
const MIX = {
  color: tint, number: lerp,
  scaled: (a, b, c) => [tint(a[0], b[0], c), lerp(a[1], b[1], c)],
  vector: (a, b, c) => a.map((v, i) => lerp(v, b[i], c)),
};
const blend = (from, to, c) => Object.fromEntries(Object.entries(to).map(([name, v]) => [name, MIX[kindOf(v)](from[name], v, c)]));

// 光的变化不和雨同步：雨先稀下来，云再开。k 是天气还剩几成，返回放晴了几成（0 到 1）
export const clearedBy = k => THREE.MathUtils.smootherstep(1 - k, .12, 1);

// 这一季在天气剩 k 成时的样子
export function seasonNow(S, k) {
  if (!S.clear || k >= 1) return S;
  const c = clearedBy(k), { u, ...lamps } = S.clear;
  return { ...S, ...blend(S, lamps, c), u: { ...S.u, ...blend(S.u, u, c) } };
}
