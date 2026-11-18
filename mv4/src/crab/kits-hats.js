// 头饰（帽子这一类）：斗笠、书生巾、荷叶。
// 都以头顶正中为原点造（y 朝上，z 朝脸的方向），会晃的部分给出摆动幅度：[慢摆（飘带、穗子）, 快摆（有弹性的梗）]。
import { clamp } from '../anim.js';
import { grid, tube, ball, lathe, torus, put, dress, blend } from './geo.js';
import { tassel, ribbon } from './parts.js';
import { CLOTH, KIT } from './palette.js';

const TAU = Math.PI * 2, FLAT = [Math.PI / 2, 0, 0];             // FLAT：把竖着的圆环放平
const hang = (y0, len, amount) => p => clamp((y0 - p[1]) / len) ** 1.4 * amount;

// 斗笠：竹篾编的尖顶笠，几道箍，沿口包边；两侧垂下系绳，绳头一颗珠子一束穗
export function douli(q) {
  const seg = Math.round(44 * q), R = 1.14, drop = -.13, tilt = { at: [0, drop, -.03], rot: [-.09, 0, 0] };
  const slope = r => .67 * (1 - r / R) ** .92;                                      // 笠面上半径 r 处的高度
  const shell = dress(lathe([[.001, .6], [.44, .37], [.8, .16], [R - .02, -.02], [R + .012, .002], [R - .03, .04], [.82, slope(.82)], [.46, slope(.46)], [.14, slope(.14)], [.03, .665], [.001, .67]], seg),
    { col: p => blend(KIT.strawDeep, KIT.straw, clamp(.35 + p[1] * 1.6)), tint: KIT.strawDeep, pat: 3, uv: ([u, v]) => [u * 24, v * 10] });
  const hoops = [.86, .58, .3].map(r => dress(put(torus(r, .013, seg, 5), { rot: FLAT, at: [0, slope(r) + .006, 0] }), { col: KIT.strawDeep, ink: .5 }));
  const rim = dress(put(torus(R, .03, seg, 6), { rot: FLAT, at: [0, .004, 0] }), { col: '#8A5A2E' });
  const knob = [dress(lathe([[.06, .64], [.075, .68], [.05, .73], [.001, .75]], 10), { col: '#8A5A2E' }), dress(put(ball(.035, 8), { at: [0, .77, 0] }), { col: CLOTH.red, ink: .6 })];
  const cords = [-1, 1].flatMap(sd => {
    const x = sd * 1.0, top = [x, .0, .12], end = [x * 1.02, -.42, .16], swing = hang(.0, .65, 1);
    return [
      dress(tube([top, [x * 1.01, -.2, .15], end], .011, { seg: 6, sides: 5 }), { col: CLOTH.red, flex: swing, ink: .6 }),
      dress(put(ball(.034, 8), { at: end }), { col: CLOTH.jade, flex: swing, ink: .7 }),
      tassel(q, { at: [end[0], end[1] - .03, end[2]], len: .13, string: .02, flex: swing }),
    ];
  });
  return [shell, hoops, rim, knob, cords].flat(Infinity).map(g => put(g, tilt));
}

// 书生巾：黛色的软帽，顶上一道折出来的脊，帽箍上一圈回纹、正中一块玉；脑后两条长飘带
export function cap(q) {
  const seg = Math.round(30 * q), oval = { scale: [1, 1, .92] }, ink = p => blend(KIT.ink, KIT.inkLt, clamp(p[1] * 1.6));
  const crown = dress(put(lathe([[.66, -.17], [.69, .04], [.675, .2], [.6, .33], [.42, .43], [.2, .47], [.001, .48]], seg), oval), { col: ink });
  const ridge = dress(tube([[-.5, .33, -.03], [-.25, .47, -.03], [0, .52, -.03], [.25, .47, -.03], [.5, .33, -.03]], s => .05 + .05 * Math.sin(Math.PI * s), { seg: Math.round(12 * q), sides: 8, flat: .34, wide: [0, 1, 0] }), { col: KIT.inkLt });
  const band = dress(put(lathe([[.688, -.07], [.71, -.045], [.715, .1], [.695, .125]], seg), oval), { col: '#3C3560', tint: CLOTH.goldDeep, pat: 1, uv: ([u, v]) => [u * 18, 1 - (v - .2) / .6] });
  const lines = [-.05, .11].map(y => dress(put(torus(.712, .009, seg, 5), { rot: FLAT, at: [0, y, 0], scale: [1, 1, .92] }), { col: CLOTH.gold, ink: .5 }));
  const jade = [
    dress(put(ball([.075, .075, .036], 10), { at: [0, .03, .665] }), { col: p => blend(CLOTH.jadeDeep, CLOTH.jade, clamp(.5 + (p[1] - .03) * 7)) }),
    dress(put(torus(.08, .013, 14, 5), { at: [0, .03, .665] }), { col: CLOTH.gold, ink: .6 }),
  ];
  const tails = [-1, 1].map(sd => ribbon(q, [[sd * .2, .08, -.6], [sd * .23, -.16, -.74], [sd * .26, -.4, -.76], [sd * .31, -.62, -.72]], {
    width: s => .05 + .022 * s, thick: .2, wide: [1, 0, 0], flex: hang(.05, .7, 1.1), col: p => (p[1] < -.52 && p[1] > -.57 ? [.9, .62, .22] : blend(KIT.inkLt, KIT.ink, clamp(-p[1] * 1.5))),
  }));
  return [crown, ridge, band, lines, jade, tails];
}

// 荷叶：一片倒扣的荷叶当帽子，叶缘起伏，叶脉从中心散开，叶面上滚着几颗露珠；后面探出一枝花苞
export function lotus(q) {
  const R = 1.08, nu = Math.round(54 * q), nr = Math.round(10 * q) + 2, drop = -.085;
  const at = (a, r, up = 0) => {
    const th = a * TAU, rr = r * R * (1 + r * (.045 * Math.sin(th * 9 + 1) + .03 * Math.sin(th * 4)));
    return [rr * Math.cos(th), .13 - .2 * r * r + .055 * r ** 3 * Math.sin(th * 9 + 2.2) + up + drop, rr * Math.sin(th)];
  };
  const face = dress(grid(nu, nr, (a, b) => at(a, b)), { col: (p, [a, b]) => blend(KIT.leafDeep, KIT.leaf, clamp(b * 1.15)) });
  const back = dress(grid(nu, nr, (a, b) => at(1 - a, b, -.045 * (1 - b * b))), { col: KIT.leafLt });
  const veins = Array.from({ length: 16 }, (_, i) => dress(tube([.07, .4, .72, .96].map(r => at(i / 16 + .01, r, .004)), s => .013 - .008 * s, { seg: Math.round(6 * q + 2), sides: 5 }), { col: KIT.leafLt, ink: 0 }));
  const heart = dress(put(ball([.085, .03, .085], 10), { at: at(0, 0, .012) }), { col: KIT.leafLt, ink: .4 });
  const dew = [[.09, .52, .05], [.42, .7, .034], [.63, .38, .028], [.8, .78, .04]].map(([a, r, size]) => {
    const c = at(a, r, size * .7);
    return dress(put(ball([size, size * .82, size], 10), { at: c }), { col: p => blend('#9FD8E8', KIT.dew, clamp(.5 + (p[1] - c[1]) / size)), ink: .45 });
  });
  const spring = p => [0, clamp((p[1] + .1) / .7) ** 2 * .9], tip = [.66, .56, -.5];
  const stem = dress(tube([[.42, -.1, -.4], [.56, .2, -.5], tip], .022, { seg: Math.round(8 * q), sides: 6 }), { col: KIT.leafDeep, flex: spring, ink: .8 });
  const budShape = put(lathe([[.018, 0], [.085, .06], [.095, .13], [.06, .21], [.001, .26]], Math.round(12 * q)), { at: tip, rot: [0, 0, -.25] });
  const flower = dress(budShape, { col: p => blend('#FFB8B0', '#F0647A', clamp((p[1] - tip[1]) / .26)), flex: spring });
  return [face, back, veins, heart, dew, stem, flower];
}
