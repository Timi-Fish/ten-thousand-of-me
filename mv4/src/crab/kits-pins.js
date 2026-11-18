// 头饰（簪、冠、花、绳这一类）：金簪梅花、小发冠、梅枝、红头绳。
// 都以头顶正中为原点造（y 朝上，z 朝脸的方向），会晃的部分给出摆动幅度：[慢摆（穗子、丝带）, 快摆（有弹性的枝子）]。
import { clamp } from '../anim.js';
import { tube, ball, lathe, put, dress, blend } from './geo.js';
import { blossom, bud, leaf, tassel, bell, ribbon } from './parts.js';
import { dip } from './shape.js';
import { SKIN, CLOTH, KIT } from './palette.js';

const onHead = (x, z, up = 0) => [x, up - dip(x, z), z];          // 头顶上 (x, z) 处、再抬高 up 的点
const hang = (y0, len, amount) => p => clamp((y0 - p[1]) / len) ** 1.4 * amount;   // 垂着的东西：越往下摆得越多

// 金簪梅花（主角）：一根金簪斜搭在头顶，簪头是如意云头、垂一束红穗；簪尾那边别着一小簇白梅
export function pin(q) {
  const tail = [-.62, .0, .3], head = [.5, .3, .2], swing = hang(head[1] - .04, .32, .9);
  const rod = dress(tube([tail, [-.05, .13, .27], head], s => .012 + .018 * s, { seg: Math.round(12 * q), sides: 6 }), { col: p => blend(CLOTH.goldDeep, CLOTH.gold, clamp(.4 + p[1] * 2)) });
  const cloud = [[0, 0, 0, .062], [-.055, .035, .0, .042], [.05, .045, .0, .042], [0, .075, 0, .034]].map(([x, y, z, r]) => dress(put(ball([r, r, r * .7], Math.round(10 * q + 2)), { at: [head[0] + x, head[1] + y, head[2] + z] }), { col: CLOTH.gold }));
  const gem = dress(put(ball(.03, 8), { at: [head[0], head[1] + .012, head[2] + .045] }), { col: CLOTH.red, ink: .5 });
  const flowers = [
    blossom(q, { at: [-.42, .12, .42], rot: [-.55, -.3, .2], r: .11 }), blossom(q, { at: [-.63, .06, .34], rot: [-.5, -.8, .9], r: .075 }),
    bud(q, { at: [-.27, .16, .4], r: .042, petal: KIT.petalPink }), bud(q, { at: [-.52, .2, .3], r: .034 }),
    leaf(q, { at: [-.36, .05, .44], rot: [.9, 0, 1.9], len: .15 }), leaf(q, { at: [-.5, .03, .4], rot: [1.1, 0, -2.4], len: .12, col: KIT.leafDeep }),
  ];
  return [rod, cloud, gem, tassel(q, { at: [head[0] + .01, head[1] - .04, head[2] + .01], len: .2, flex: swing }), flowers];
}

// 小发冠：头顶一个小揪揪，套一只莲瓣金冠，一根簪子横穿过去，两头各垂一颗红珠
export function crown(q) {
  const seg = Math.round(20 * q);
  const tuft = dress(put(ball([.2, .2, .19], Math.round(14 * q)), { at: [0, .1, 0] }), { col: SKIN.body });
  const base = dress(lathe([[.2, -.01], [.235, .0], [.25, .05], [.245, .1], [.215, .12]], seg), { col: CLOTH.gold, tint: CLOTH.goldDeep, pat: 1, uv: ([u, v]) => [u * 10, v] });
  const petals = [-2, -1, 0, 1, 2].map(i => {
    const a = i * .62, tall = i === 0 ? .36 : Math.abs(i) === 1 ? .29 : .22;
    const one = put(lathe([[.03, 0], [.085, tall * .3], [.075, tall * .62], [.03, tall * .9], [.001, tall]], 10), { scale: [1, 1, .32] });
    return dress(put(one, { at: [.235 * Math.sin(a), .07, .235 * Math.cos(a)], rot: [.16, a, 0] }), { col: p => blend(CLOTH.goldDeep, CLOTH.gold, clamp(p[1] * 4)) });
  });
  const gems = [[0, .2, .27, .036, CLOTH.red], [-.14, .14, .215, .022, CLOTH.jade], [.14, .14, .215, .022, CLOTH.jade]].map(([x, y, z, r, col]) => dress(put(ball(r, 8), { at: [x, y, z] }), { col, ink: .5 }));
  const stick = dress(tube([[-.46, .12, -.02], [.46, .15, -.02]], s => .02 - .008 * s, { seg: 4, sides: 6 }), { col: CLOTH.gold });
  const ends = [[-.47, .12], [.47, .15]].flatMap(([x, y]) => [
    dress(put(ball(.036, 8), { at: [x, y, -.02] }), { col: CLOTH.gold }),
    tassel(q, { at: [x, y - .03, -.02], len: .1, string: .07, flex: hang(y - .03, .2, .7) }),
  ]);
  return [tuft, base, petals, gems, stick, ends];
}

// 梅枝：头上别一枝开着的梅，枝子有弹性；根上系一个小红结
export function twig(q) {
  const spring = p => [0, clamp(p[1] / .6) ** 2 * .8], bark = { col: KIT.wood, flex: spring, ink: .8 };
  const limb = (pts, r0, r1) => dress(tube(pts, s => r0 + (r1 - r0) * s, { seg: Math.round(10 * q), sides: 6 }), bark);
  const wood = [
    limb([[-.08, -.03, .1], [.0, .2, .1], [.17, .42, .1], [.3, .58, .07]], .042, .014),
    limb([[.09, .3, .1], [.3, .37, .14], [.5, .43, .16]], .026, .011),
    limb([[-.01, .15, .1], [-.14, .3, .1], [-.25, .44, .06]], .024, .01),
  ];
  const plum = { petal: KIT.plum, heart: KIT.plumDeep, flex: spring };
  const flowers = [
    blossom(q, { at: [.31, .6, .1], rot: [-.5, .2, 0], r: .09, ...plum }), blossom(q, { at: [.52, .44, .19], rot: [-.2, .5, .4], r: .08, ...plum }),
    blossom(q, { at: [-.26, .46, .09], rot: [-.3, -.5, 1], r: .08, ...plum }), blossom(q, { at: [.16, .4, .17], rot: [-.1, 0, 2], r: .07, ...plum }),
    blossom(q, { at: [.36, .36, .21], rot: [.1, .2, .7], r: .06, ...plum }),
    bud(q, { at: [.43, .52, .13], petal: KIT.plum, flex: spring }), bud(q, { at: [-.13, .33, .14], petal: KIT.plum, flex: spring }), bud(q, { at: [.21, .52, .08], r: .036, petal: KIT.plumDeep, flex: spring }),
  ];
  const tie = [-1, 1].map(sd => ribbon(q, [[-.07, .02, .15], [-.07 + sd * .09, .08, .17], [-.07 + sd * .16, .02, .16], [-.07 + sd * .08, -.02, .17], [-.07, .02, .15]], { width: .026, thick: .5, col: CLOTH.red, wide: [0, 0, 1] }));
  const tieKnot = dress(put(ball([.04, .045, .035], 8), { at: [-.07, .02, .17] }), { col: CLOTH.red });
  return [wood, flowers, tie, tieKnot];
}

// 红头绳：头顶打一个大蝴蝶结，两条绳尾搭下来，各坠一只小金铃
export function bow(q) {
  const c = [0, .12, .1], red = p => blend(CLOTH.redDeep, CLOTH.red, clamp(.25 + p[1] * 2.6));
  // 两个结环：从结心往两边鼓出去的两瓣，根上收紧、梢上圆鼓，略往上翘
  const lobe = [[.022, 0], [.05, .05], [.105, .17], [.14, .29], [.132, .37], [.08, .425], [.001, .44]];
  const loops = [-1, 1].map(sd => dress(put(put(lathe(lobe, Math.round(16 * q)), { scale: [1, 1, .5] }), { at: c, rot: [0, 0, -sd * 1.2] }), { col: red }));
  const folds = [-1, 1].map(sd => ribbon(q, [[sd * .07, .15, .17], [sd * .17, .19, .185], [sd * .27, .22, .17]], { col: CLOTH.redDeep, wide: [0, 1, 0], thick: .6, width: s => .013 * (1 - s), ink: 0 }));   // 结环上的一道褶
  const knot = dress(put(ball([.07, .08, .075], Math.round(12 * q)), { at: [c[0], c[1], c[2] + .02] }), { col: CLOTH.red });
  // 两条绳尾顺着头顶搭到额角，各坠一只小金铃
  const ends = [-1, 1].flatMap(sd => {
    const tip = onHead(sd * .46, .6, .012), swing = p => clamp((Math.abs(p[0]) - .12) / .36) ** 1.5 * .4;
    return [
      ribbon(q, [[sd * .03, c[1] - .04, c[2] + .05], onHead(sd * .2, .38, .03), tip, [tip[0] + sd * .01, tip[1] - .09, tip[2] + .035]], { col: red, wide: [1, 0, -sd], thick: .3, width: s => .05 - .014 * s, flex: swing }),
      bell(q, { at: [tip[0] + sd * .01, tip[1] - .15, tip[2] + .04], r: .064, flex: () => .45 }),
    ];
  });
  return [loops, folds, knot, ends];
}
