// 头饰共用的小零件：花、花苞、叶子、穗子、铃铛、丝带。都以自己的原点造好，再由调用方摆到位。
// 约定：会晃的零件用 sway(点) 给出「慢摆」的幅度；q 是精细程度（1 或 0.5）。
import { tube, ball, lathe, torus, put, dress, blend } from './geo.js';
import { CLOTH, KIT } from './palette.js';

const TAU = Math.PI * 2;
const still = () => 0;

// 一朵五瓣的花，正面朝 +z。r：大小；petal / heart：花瓣和花心一侧的颜色
export function blossom(q, { at, rot = [0, 0, 0], r = .09, petal = KIT.petal, heart = KIT.petalPink, flex = still }) {
  const parts = [];
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * TAU + TAU / 4, one = put(ball([r * .62, r * .56, r * .2], Math.round(10 * q + 2)), { at: [r * .62 * Math.cos(a), r * .62 * Math.sin(a), r * .06], rot: [0, 0, a] });
    parts.push(dress(one, { col: p => blend(heart, petal, Math.min(1, Math.hypot(p[0], p[1]) / (r * .8))), ink: .7 }));
  }
  parts.push(dress(put(ball([r * .3, r * .3, r * .22], 8), { at: [0, 0, r * .16] }), { col: KIT.stamen, ink: .5 }));
  if (q >= 1) for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; parts.push(dress(put(ball(r * .075, 6), { at: [r * .48 * Math.cos(a), r * .48 * Math.sin(a), r * .26] }), { col: KIT.stamen, ink: 0 })); }   // 一圈花蕊
  return parts.map(g => refit(put(g, { at, rot }), flex));
}
// 花苞：一个小圆球，底下一个花萼
export function bud(q, { at, r = .045, petal = KIT.petal, flex = still }) {
  return [dress(put(ball(r, 8), { at }), { col: petal, flex, ink: .7 }), dress(put(ball([r * .8, r * .5, r * .8], 6), { at: [at[0], at[1] - r * .6, at[2]] }), { col: KIT.wood, flex, ink: .5 })];
}
// 一片尖叶，从 at 朝 +y 长出去，再按 rot 转
export function leaf(q, { at, rot = [0, 0, 0], len = .14, col = KIT.leaf, flex = still }) {
  const g = put(lathe([[.001, 0], [len * .22, len * .3], [len * .26, len * .5], [len * .14, len * .82], [.001, len]], 8), { scale: [1, 1, .25] });
  return refit(dress(put(g, { at, rot }), { col, ink: .7 }), flex);
}
// 穗子：从 at 垂下来。一小段绳、一个金帽、一束线。len：线束的长度
export function tassel(q, { at, len = .16, col = CLOTH.red, deep = CLOTH.redDeep, string = .05, flex }) {
  const [x, y, z] = at, top = y - string;
  return [
    dress(tube([[x, y, z], [x, top + .01, z]], .008, { seg: 2, sides: 5 }), { col, flex, ink: .5 }),
    dress(put(ball([.024, .022, .024], 8), { at: [x, top, z] }), { col: CLOTH.gold, flex, ink: .7 }),
    dress(put(lathe([[.004, -len], [.03, -len + .006], [.027, -len * .5], [.018, -.012], [.007, 0]], Math.round(10 * q + 2)), { at: [x, top - .012, z] }), { col: p => blend(deep, col, Math.min(1, Math.max(0, 1 + (p[1] - top) / len))), flex }),
  ];
}
// 小铃铛：金色的球，顶上一个环，肚子上一道开口
export function bell(q, { at, r = .06, flex = still }) {
  return [
    dress(put(ball(r, Math.round(12 * q + 2)), { at }), { col: p => blend(CLOTH.goldDeep, CLOTH.gold, Math.min(1, Math.max(0, .6 + (p[1] - at[1]) / r))), flex }),
    dress(put(torus(r * .3, r * .1, 10, 5), { at: [at[0], at[1] + r * 1.05, at[2]] }), { col: CLOTH.gold, flex, ink: .5 }),
    dress(put(ball([r * .62, r * .1, r * .16], 6), { at: [at[0], at[1] - r * .42, at[2] + r * .86] }), { col: '#5A3A10', flex, ink: 0 }),
  ];
}
// 丝带：沿一串点铺开的扁带子。width 可以是数字或 s => 宽
export function ribbon(q, points, { width = .05, thick = .22, col, flex = still, wide = [1, 0, 0], ink = .8 }) {
  return dress(tube(points, typeof width === 'function' ? width : () => width, { seg: Math.round(14 * q + 2), sides: 8, flat: thick, wide }), { col, flex, ink });
}
// 上好色的零件挪了位置之后，按新位置重算一遍「慢摆」的幅度
function refit(geo, flex) {
  const P = geo.attributes.position, F = geo.attributes.aFx;
  if (F) for (let i = 0; i < P.count; i++) { const f = flex([P.getX(i), P.getY(i), P.getZ(i)]); F.setZ(i, Array.isArray(f) ? f[0] : f); if (Array.isArray(f)) F.setW(i, f[1]); }
  return geo;
}
