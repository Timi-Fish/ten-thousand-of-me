// 穿戴：交领小袍（一襟压着一襟，领口滚边，衣摆镶回纹边）、腰封、绳结、玉佩。
// 每一件都贴着身体表面生成（shape.js 的 surf），有自己的厚度；之后和身体一起变形。
import { clamp } from '../anim.js';
import { grid, tube, ball, torus, lathe, put, dress, blend, rgb } from './geo.js';
import { surf, uAt, PERIM } from './shape.js';
import { CLOTH } from './palette.js';

const HEM = .07, SASH = [.29, .45], ROPE_Y = .37;                // 衣摆的高度；腰封上下沿；腰绳的高度
const NECK = { x: -.08, y: .58, rise: .8, curl: 9, top: 1 };      // 领口：两襟交点的位置；往两肩走的斜率和越走越陡的程度（绕着脸颊往上兜）；绕到身后的高度
const CLOTH_T = .032, FLARE = .05, COLLAR_T = .045, LAP = .088;   // 衣料离身体多远；衣摆往外张多少；领子离身体多远、多宽
const SASH_T = .1, ROPE_T = .124;                                 // 腰封、腰绳离身体多远（腰封要盖住插进来的衣襟）
const NECK_U = uAt(NECK.x, NECK.y);
const smooth = k => { k = clamp(k); return k * k * (3 - 2 * k); };
const wrap = u => u - Math.round(u);                              // 换算到 -0.5 到 0.5（0 是正面正中）
// 一襟的上沿：从交点往肩上走，du 是离交点绕了多远
const lapel = du => NECK.y + NECK.rise * du + NECK.curl * du * Math.abs(du);
// 领口线：正面是个偏向一侧的 V，绕过两肩后拉平
function neck(u) {
  const v = lapel(Math.abs(wrap(u - NECK_U))), r = .06, k = clamp(.5 + .5 * (NECK.top - v) / r);
  return v + (NECK.top - v) * (1 - k) - r * k * (1 - k);          // 圆滑地取两者里低的那个
}
// 一条带子的截面：从下沿内侧翻出来、贴着身体往上、再从上沿翻回去，两头是半径 r 的圆边。t(高度) 是离身体多远。返回 [[高度, 离身体多远], ...]
function rounded(y0, y1, t, r, inner) {
  const arc = (yc, from, to) => [0, 1, 2, 3].map(i => { const a = (from + (to - from) * i / 3) * Math.PI / 180; return [yc + r * Math.sin(a), t(yc) - r + r * Math.cos(a)]; });
  const rows = arc(y0 + r, -165, -15);
  for (let i = 0; i <= inner; i++) { const y = y0 + r + (y1 - y0 - 2 * r) * i / inner; rows.push([y, t(y)]); }
  return rows.concat(arc(y1 - r, 15, 165));
}
// 一根贴着身体的圆绳的截面
const cord = (y, t, r, sides = 6) => Array.from({ length: sides + 1 }, (_, i) => { const a = -Math.PI + i / sides * 2 * Math.PI; return [y + r * Math.sin(a), t + r * Math.cos(a)]; });
// 贴着身体的一圈（或一段，u0 到 u1）：rowsAt(u) 给出这一列的截面。纹样坐标 = [绕身体的比例, 高度]
function hoop(nu, rowsAt, u0 = 0, u1 = 1) {
  let col = null, rows;
  const nv = rowsAt(u0).length - 1, at = (a, b) => { const u = u0 + (u1 - u0) * a; if (u !== col) { col = u; rows = rowsAt(u); } return [u, ...rows[Math.round(b * nv)]]; };
  return grid(nu, nv, (a, b) => surf(...at(a, b)), (a, b) => at(a, b).slice(0, 2));
}

// q：精细程度（1 或 0.5）
export function wear(q) {
  const nu = Math.round(96 * q), few = Math.round(30 * q);
  const flare = (u, y) => CLOTH_T + (FLARE + .012 * Math.sin(u * 2 * Math.PI * 9)) * smooth((SASH[0] - y) / (SASH[0] - HEM));   // 衣摆往外张，带几道浅浅的褶
  const sway = at => .1 * smooth((SASH[0] - at[1]) / (SASH[0] - HEM));                                                        // 衣摆跟着晃
  // 袍身：从衣摆到领口，暗纹是祥云
  // 领子和腰封压着的地方，袍子上落一道淡淡的影：离压着它的边越近越深
  const under = (edge, y, reach) => (y < edge ? clamp(1 - (edge - y) / reach) : 0);
  const robe = dress(hoop(nu, u => rounded(HEM, neck(u) - .02, y => flare(u, y), .016, Math.round(28 * q))), {
    col: (at, [u, y]) => blend(blend(CLOTH.robeShade, CLOTH.robe, smooth((y - HEM) / .35)), CLOTH.robeDeep, Math.max(under(neck(u) + .012 - LAP, y, .12), under(SASH[0], y, .08))),
    tint: '#EBD3A4', pat: 2, uv: ([u, y]) => [u * PERIM * 1.5, -y * 1.5], flex: sway,
  });
  // 衣摆的镶边：一圈回纹，上面压一道金线
  const band = [HEM - .004, HEM + .1], units = Math.round(PERIM / (band[1] - band[0]) * .85);
  const hem = dress(hoop(nu * 2, u => rounded(band[0], band[1], y => flare(u, y) + .014, .012, 4)), { col: CLOTH.trim, tint: CLOTH.gold, pat: 1, uv: ([u, y]) => [u * units, 1 - (y - band[0]) / (band[1] - band[0])], flex: sway });
  const hemLine = dress(hoop(nu, u => cord(band[1] + .012, flare(u, band[1]) + .012, .011)), { col: CLOTH.gold, ink: .6, flex: sway });
  // 领子：绕颈一圈的滚边，底下压一道金线
  const ringTop = u => neck(u) + .012;
  const ring = dress(hoop(nu, u => rounded(ringTop(u) - LAP, ringTop(u), () => COLLAR_T, .02, 3), NECK_U, NECK_U + 1), { col: CLOTH.trim });
  const piping = dress(hoop(nu, u => cord(ringTop(u) - LAP - .004, COLLAR_T + .006, .0095), NECK_U, NECK_U + 1), { col: CLOTH.gold, ink: .6 });
  // 压在上面的那一襟：从画面右肩斜着下来，越过交点，一直插进腰封
  let tuck = -.3;                                                                                                       // 这一襟的上沿在哪儿钻到腰封上沿以下
  for (let hi = 0, i = 0; i < 30; i++) { const mid = (tuck + hi) / 2; if (lapel(mid) + .012 > SASH[1] - .012) hi = mid; else tuck = mid; }
  const lapTop = u => Math.min(lapel(u - NECK_U), neck(u)) + .012, lapEnds = [NECK_U + tuck, NECK_U + .1];
  const lapT = u => { const k = smooth((lapEnds[1] - u) / .07); return COLLAR_T - .012 * (1 - k) + .028 * k; };            // 靠肩那头沉进领子里，免得两层叠在同一个面上
  const lap = dress(hoop(few, u => rounded(lapTop(u) - LAP, lapTop(u), () => lapT(u), .02, 3), ...lapEnds), { col: CLOTH.trim });
  const lapPiping = dress(hoop(few, u => cord(lapTop(u) - LAP - .004, lapT(u) + .006, .0095), ...lapEnds), { col: CLOTH.gold, ink: .6 });
  // 腰封：黛色的宽带，暗纹也是祥云；中间一根绞着的橙绳
  const sash = dress(hoop(nu, () => rounded(SASH[0], SASH[1], () => SASH_T, .026, 5)), { col: CLOTH.sash, tint: CLOTH.sashLt, pat: 2, uv: ([u, y]) => [u * PERIM * 3.4, -y * 3.4] });
  const rope = dress(hoop(nu, () => cord(ROPE_Y, ROPE_T, .024, Math.round(6 * q + 3))), { col: CLOTH.trim, tint: CLOTH.trimDeep, pat: 4, uv: ([u, y]) => [u * 70, y * 7] });
  return [robe, hem, ring, lap, sash, rope, knot(q), pendant(q), backBow(q), q < 1 ? [] : [hemLine, piping, lapPiping]];   // 精简档省掉几道细金线：远看只会糊成一片
}

// 后腰的大蝴蝶结：腰绳在身后系的，两瓣结环、两条垂到衣摆下面的绳尾，走动时跟着甩
function backBow(q) {
  const c = surf(.5, ROPE_Y, ROPE_T + .03), at = (x, y, z) => [c[0] + x, c[1] + y, c[2] - z], shade = p => blend(CLOTH.trimDeep, CLOTH.trim, clamp(.4 + (p[1] - c[1]) * 4));
  const lobe = [[.02, 0], [.045, .04], [.088, .13], [.115, .22], [.105, .285], [.06, .325], [.001, .34]];
  const loops = [-1, 1].map(sd => dress(put(put(lathe(lobe, Math.round(16 * q)), { scale: [1, 1, .45] }), { at: at(0, 0, .02), rot: [0, 0, -sd * 1.3] }), { col: shade }));
  const knot = dress(put(ball([.055, .065, .05], Math.round(12 * q)), { at: at(0, 0, .04) }), { col: CLOTH.trim });
  const droop = p => clamp((c[1] - p[1]) / .36) ** 1.4 * .6;
  const tails = [-1, 1].map(sd => dress(
    tube([at(sd * .02, -.03, .03), at(sd * .075, -.17, .05), at(sd * .1, -.34, .03)], s => .03 + .012 * s, { seg: Math.round(10 * q), sides: 8, flat: .3, wide: [1, 0, 0] }),
    { col: p => (p[1] < c[1] - .29 ? rgb(CLOTH.gold) : shade(p)), flex: droop }));
  return [loops, knot, tails];
}

// 绳结：腰绳在正面打的蝴蝶结，两个环、一颗金珠、两条垂下来的穗头
function knot(q) {
  const c = surf(0, ROPE_Y, ROPE_T + .022), seg = Math.round(18 * q), at = (x, y, z) => [c[0] + x, c[1] + y, c[2] + z];
  const droop = p => clamp((c[1] - p[1]) / .2) ** 2 * .35;
  const loops = [-1, 1].map(sd => dress(tube([at(0, 0, 0), at(sd * .075, .05, .012), at(sd * .15, .012, -.01), at(sd * .08, -.042, .008), at(0, 0, 0)], .02, { seg, sides: 6, wide: [0, 0, 1] }), { col: CLOTH.trim, tint: CLOTH.trimDeep, pat: 4, uv: ([s, a]) => [s * 8, a + s * 8] }));
  const bead = dress(put(ball([.04, .044, .034], 12), { at: at(0, 0, .01) }), { col: CLOTH.gold });
  const tails = [-1, 1].map(sd => {
    const pts = [at(sd * .012, -.02, .012), at(sd * .04, -.1, .022), at(sd * .052, -.19, .018)];
    return [
      dress(tube(pts, .014, { seg: 8, sides: 6 }), { col: CLOTH.trim, flex: droop, ink: .8 }),
      dress(put(lathe([[.002, -.09], [.03, -.085], [.026, -.05], [.022, -.01], [.004, 0]], 10), { at: pts[2] }), { col: CLOTH.gold, flex: droop, ink: .8 }),
    ];
  });
  return [loops, bead, tails];
}

// 玉佩：从腰绳垂下来的一枚玉环，底下一束穗子。挂在画面右侧，会跟着晃
function pendant(q) {
  const top = surf(uAt(.36, ROPE_Y), ROPE_Y, ROPE_T), x = top[0], ringY = top[1] - .15, z = top[2] + .012;
  const swing = p => clamp((top[1] - p[1]) / .34) ** 1.5 * .55;
  return [
    dress(tube([[x, top[1], z - .01], [x, ringY + .06, z]], .009, { seg: 4, sides: 5 }), { col: CLOTH.red, flex: swing, ink: .6 }),
    dress(put(torus(.058, .024, Math.round(22 * q), 8), { at: [x, ringY, z] }), { col: p => blend(CLOTH.jadeDeep, CLOTH.jade, clamp(.5 + (p[1] - ringY) * 8)), flex: swing }),
    dress(put(ball([.024, .02, .024], 10), { at: [x, ringY - .078, z] }), { col: CLOTH.gold, flex: swing }),
    dress(put(lathe([[.003, -.115], [.03, -.11], [.027, -.06], [.017, -.012], [.006, 0]], 12), { at: [x, ringY - .088, z] }), { col: p => blend(CLOTH.redDeep, CLOTH.red, clamp(1 + (p[1] - ringY + .088) * 9)), flex: swing }),
  ];
}
