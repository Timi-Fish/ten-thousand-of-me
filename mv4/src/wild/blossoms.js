// 开花的两种和垂柳。
// 桃：矮，干很短就分成几股斜着往上的枝，枝条细而多；春天花一小簇一小簇缀满枝条（枝看得见），只有零星的嫩叶；夏秋是披针形的叶。
// 梅：老干墨黑、歪着长，枝子折来折去，折角上挺出笔直的新条；冬天花疏疏地贴在枝上，其余季节是叶。
// 垂柳：斜干，几股大枝往上再朝外拱出去，拱出去的枝上垂下一条条柳丝，快要够到地面；冬天叶落了，丝还垂着。
// 花和叶是两批卡片，各听季节表里的「开了几成花」「还剩几成叶」。
import { rnd } from '../anim.js';
import { CELLS } from './leaves.js';
import { Plant, PART, V, ramify, kept, along, heading, sideways, TAU } from './plant.js';

const DOWN = V(0, -1, 0);
const PEACH = [
  { joints: 3, crook: .12, lift: .03, taper: 1.2, forks: 4, first: .7, thin: .62, lead: .6 },
  { joints: 4, crook: .22, lift: .17, taper: 1, forks: 3, first: .4, thin: .4, lead: .5, spread: 1.05, len: 1.5, thick: .6 },
  { joints: 3, crook: .28, lift: .12, taper: 1, forks: 2, first: .5, thin: .5, lead: .5, spread: .65, len: .55, thick: .65 },
  { joints: 2, crook: .25, lift: .08, taper: 1, tip: .015, spread: .5, len: .6, thick: .7 },
];
export function peach(seed, d) {
  const R = k => rnd(seed * 11.9 + k * 2.9), H = 6 + 1.6 * R(0), t = new Plant(H), plan = { limbs: [], tips: [] }, few = Math.max(2, Math.round(d.cards / 2));
  const bloom = [CELLS.peach, CELLS.peachSprig, CELLS.peach], leaves = d.dabs ? [CELLS.dabs, CELLS.lance] : [CELLS.lance];
  ramify(plan, V(0, -.8, 0), V((R(1) - .5) * .4, 1, (R(2) - .5) * .4), H * .3 + .8, .27 + .08 * R(3), 0, seed, PEACH);
  t.skeleton(plan, d, .7, seed).crownOver(plan.tips.map(tip => tip.p), 1);
  plan.tips.forEach((tip, i) => {
    if (!kept(i, d.keep)) return;
    const r = (.8 + .3 * rnd(seed + i * 3.3)) * d.grow;
    t.cluster(tip.p, V(r, r * .8, r), Math.max(2, d.cards - 2), bloom, seed + i * .37, { part: PART.bloom, size: .82, tilt: d.tilt });
    t.cluster(V(tip.p.x, tip.p.y + .1, tip.p.z), V(r * 1.1, r * .85, r * 1.1), few, leaves, seed + i * .41 + 3, { size: .85, tilt: d.tilt });
  });
  // 枝的中段也缀着花和叶，花不只在梢上
  if (d.depth >= 2) plan.limbs.filter(l => l.level === 1 || l.level === 2).forEach((l, i) => {
    for (const k of l.level === 1 ? [.5, .8] : [.55]) {
      t.cluster(along(l.pts, k), V(.65, .5, .65), few, bloom, seed + i * .61 + k, { part: PART.bloom, size: .85 });
      if (l.level === 2) t.cluster(along(l.pts, k), V(.9, .7, .9), few, leaves, seed + i * .67 + k + 5, { size: .85 });
    }
  });
  return t.twigs(plan, d, seed, .75);
}

const PLUM = [
  { joints: 4, crook: .32, lift: .02, taper: 1.1, forks: 3, first: .5, thin: .6, lead: .7 },
  { joints: 4, crook: .42, lift: .06, taper: 1, forks: 3, first: .35, thin: .4, lead: .6, spread: 1.15, len: 1.25, thick: .55 },
  { joints: 3, crook: .45, lift: .1, taper: 1, forks: 2, first: .5, thin: .5, lead: .4, spread: .9, len: .6, thick: .6 },
  { joints: 2, crook: .08, lift: .22, taper: 1, tip: .012, spread: .7, len: .95, thick: .6 },          // 末一级是朝上直挺的新条
];
export function plum(seed, d) {
  const R = k => rnd(seed * 23.3 + k * 4.1), H = 6.2, t = new Plant(H), plan = { limbs: [], tips: [] }, few = Math.max(2, Math.round(d.cards / 2));
  ramify(plan, V(0, -.8, 0), V(.3 + .2 * R(1), 1, (R(2) - .5) * .4), H * .36 + .8, .3 + .08 * R(3), 0, seed, PLUM);
  t.skeleton(plan, d, .8, seed).crownOver(plan.tips.map(tip => tip.p), .8);
  // 花：沿着每一根枝隔一段贴一小枝
  let n = 0;
  for (const l of plan.limbs) if (l.level > 0) for (let j = 0; j < (l.level === 1 ? 4 : 3); j++) {
    n++;
    if (!kept(n, d.keep)) continue;
    const k = .25 + .75 * (j + rnd(seed + n * 1.3)) / (l.level === 1 ? 4 : 3), at = along(l.pts, k), dir = heading(l.pts, k), s = (.5 + .22 * rnd(seed + n * 2.7)) * d.grow;
    const up = dir.clone().add(V((rnd(n * 3.1) - .5) * .9, .5, (rnd(n * 4.3) - .5) * .9)).normalize(), right = sideways(up, rnd(n * 5.9) * TAU), c = at.clone().addScaledVector(up, s * .75);
    t.card(c, right, up, s, s, CELLS.plum, PART.bloom, { cluster: at, spread: s, rand: rnd(n * 7.7) });
    if (d.cross) t.card(c, V().crossVectors(up, right), up, s, s, CELLS.plum, PART.bloom, { cluster: at, spread: s, rand: rnd(n * 8.9) });
  }
  plan.tips.forEach((tip, i) => { if (kept(i, d.keep)) t.cluster(tip.p.clone().addScaledVector(tip.dir, -.4), V(.8, .65, .8).multiplyScalar(d.grow), few, d.dabs ? [CELLS.dabs] : [CELLS.round, CELLS.lance], seed + i * .43, { size: .85, tilt: d.tilt }); });
  return t.twigs(plan, d, seed, .6);
}

const WILLOW = [
  { joints: 5, crook: .14, lift: .04, taper: 1.2, forks: 5, first: .6, thin: .5, lead: .5 },
  { joints: 4, crook: .2, lift: .1, taper: 1, forks: 3, first: .45, thin: .4, lead: .6, spread: .8, len: .75, thick: .6 },
  { joints: 4, crook: .2, lift: .2, pull: DOWN, taper: 1, tip: .03, spread: 1, len: .8, thick: .6 },    // 拱出去再垂下来的枝
];
export function willow(seed, d) {
  const R = k => rnd(seed * 19.1 + k * 3.7), H = 10.5 + 2 * R(0), t = new Plant(H), plan = { limbs: [], tips: [] }, [share, wide, segs] = d.strands;
  ramify(plan, V(0, -1, 0), V((R(1) - .5) * .5, 1, (R(2) - .5) * .5), H * .5 + 1, .5 + .12 * R(3), 0, seed, WILLOW);
  t.skeleton(plan, d, .9, seed).within(V(0, H * .72, 0), V(6.5, H * .45, 6.5));
  let n = 0;
  for (const l of plan.limbs) if (l.level > 0) {
    const count = Math.max(1, Math.round((l.level === 1 ? 5 : 9) * share)), k0 = l.level === 1 ? .5 : .15;
    for (let j = 0; j < count; j++) {
      n++;
      const Q = k => rnd(seed * 3.3 + n * 1.9 + k * 2.3), top = along(l.pts, k0 + (1 - k0) * (j + Q(0)) / count), flat = Math.hypot(top.x, top.z) + 1e-3;
      top.x += (Q(1) - .5) * .8; top.z += (Q(2) - .5) * .8;
      t.strand(top, Math.min(top.y - 1.2 - 1.6 * Q(3), 3.5 + 4.5 * Q(4)), .26 * wide, V(top.x / flat * .7, 0, top.z / flat * .7), seed + n * .017, segs);
    }
  }
  // 冠顶：拱出去的枝上（枝根和半中腰）各有一团叶，枝不是光杆，从上面看也不是秃的
  const few = Math.max(2, Math.round(d.cards / 2)), cells = d.dabs ? [CELLS.dabs] : [CELLS.lance];
  plan.limbs.filter(l => l.level === 2).forEach((l, i) => {
    if (!kept(i, d.keep)) return;
    t.cluster(l.pts[0], V(1.3, .9, 1.3).multiplyScalar(d.grow), few, cells, seed + i * .47, { size: .85, tilt: d.tilt });
    if (d.fill) t.cluster(along(l.pts, .55).add(V(0, .2, 0)), V(1.1, .7, 1.1), few, cells, seed + i * .59 + 4, { size: .85 });
  });
  return t;
}
