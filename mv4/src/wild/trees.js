// 树的造型：松、阔叶树、桃、垂柳、梅、竹，外加路边的灌木，每种有几个长相（form），每个长相各有三档精细度（near 路边近看、mid 隔一段看、far 远山成片）。
// 每棵树先长出骨架（干 → 大枝 → 小枝 → 梢，带粗细、弯曲、根部的隆起），再在梢头挂上一团团叶（或花、松针的云片、柳丝）；
// 叶团之间留着空，看得见里面的枝。落叶之后露出来的是枝和梢头的细杈。造型的工具在 plant.js，叶的图案在 leaves.js。
// 这个文件是总表、阔叶树和灌木；常绿的松、竹在 evergreens.js，开花的桃、梅和垂柳在 blossoms.js。
import { rnd } from '../anim.js';
import { CELLS } from './leaves.js';
import { Plant, PART, DETAIL, V, ramify, kept, along } from './plant.js';
import { pine, bamboo } from './evergreens.js';
import { peach, plum, willow } from './blossoms.js';

// 阔叶树的三个长相用的叶：橡（卵形叶）、枫（掌状叶，秋天最红）、黄栌（小圆叶）
const LEAVES = { oak: [CELLS.ovate, CELLS.ovate, CELLS.sprig], maple: [CELLS.maple, CELLS.mapleSprig, CELLS.maple], smoke: [CELLS.round, CELLS.sprig, CELLS.round] };
// 阔叶树的骨架：直干到三分之二处分成四股大枝，往上往外张开，再分两次杈，合成一个比高还宽的圆冠
const BROAD = [
  { joints: 6, crook: .09, lift: .05, taper: 1.3, forks: 5, first: .55, thin: .5, lead: .3 },
  { joints: 4, crook: .2, lift: .07, taper: 1, forks: 3, first: .45, thin: .45, lead: .5, spread: 1, len: .68, thick: .58 },
  { joints: 3, crook: .28, lift: .07, taper: 1, forks: 3, first: .4, thin: .5, lead: .5, spread: .75, len: .5, thick: .7 },
  { joints: 2, crook: .3, lift: .04, taper: 1, tip: .02, spread: .65, len: .55, thick: .7 },
];
function broad(seed, d, form) {
  const R = k => rnd(seed * 13.7 + k * 2.3), H = 11 + 4 * R(0), t = new Plant(H), plan = { limbs: [], tips: [] }, cells = d.dabs ? [CELLS.dabs, LEAVES[form][0]] : LEAVES[form];
  ramify(plan, V(0, -1, 0), V((R(1) - .5) * .3, 1, (R(2) - .5) * .3), H * .6 + 1, .44 + .14 * R(3), 0, seed, BROAD);
  t.skeleton(plan, d, .9, seed).crownOver(plan.tips.map(tip => tip.p), 1.3);
  plan.tips.forEach((tip, i) => {
    if (!kept(i, d.keep)) return;
    const r = (1.2 + .5 * rnd(seed + i * 3.3)) * d.grow;
    t.cluster(V(tip.p.x, tip.p.y + .25, tip.p.z), V(r, r * .8, r), d.cards, cells, seed + i * .37, { size: .82, tilt: d.tilt });
  });
  if (d.fill) plan.limbs.filter(l => l.level === 2).forEach((l, i) => t.cluster(along(l.pts, .5), V(1.3, 1, 1.3), 4, cells, seed + i * .53 + 7, { size: .8 }));
  return t.twigs(plan, d, seed);
}

// 灌木：贴着地分出六七根细枝，朝四周散开，一人来高；枝头是小团的叶，春夏顶着花。种在路边，填在草和树之间那一层。
// 它总在近处，但个头小，用不着近景树那么多面：枝按中档的粗细画，叶团一个不省。
const SHRUB = [
  { joints: 2, crook: 0, lift: 0, taper: 1, forks: 6, first: .25, thin: .8, lead: 1 },
  { joints: 3, crook: .25, lift: .12, taper: 1, forks: 2, first: .55, thin: .5, lead: .5, spread: .95, len: 4.2, thick: .36 },
  { joints: 2, crook: .3, lift: .1, taper: 1, tip: .012, spread: .6, len: .55, thick: .7 },
];
function shrub(seed, d) {
  const R = k => rnd(seed * 9.1 + k * 3.3), t = new Plant(2), plan = { limbs: [], tips: [] }, fine = { ...DETAIL.mid, depth: Math.min(d.depth, 2), keep: Math.max(d.keep, .5), grow: 1, cards: Math.max(d.cards, 4) };
  ramify(plan, V(0, -.3, 0), V(0, 1, 0), .42 + .1 * R(0), .13, 0, seed, SHRUB);
  t.skeleton(plan, fine, 0, seed, 0).crownOver(plan.tips.map(tip => tip.p), .7);
  plan.tips.forEach((tip, i) => {
    if (!kept(i, fine.keep)) return;
    const r = .6 + .25 * rnd(seed + i * 3.3), c = V(tip.p.x, tip.p.y + .1, tip.p.z);
    t.cluster(c, V(r, r * .8, r), fine.cards, [CELLS.round, CELLS.ovate], seed + i * .37, { size: .85 });
    if (i % 2 === 0) t.cluster(V(c.x, c.y + r * .45, c.z), V(r * .7, r * .4, r * .7), 2, [CELLS.peach, CELLS.peachSprig], seed + i * .43 + 2, { part: PART.bloom, size: .8 });
  });
  return t.twigs(plan, fine, seed, .55);
}

// 每种树：怎么造、有哪些长相
const SPECIES = {
  pine: { make: pine, forms: ['tall', 'lean', 'crag'] },
  broad: { make: broad, forms: ['oak', 'maple', 'smoke'] },
  peach: { make: peach, forms: ['open'] },
  willow: { make: willow, forms: ['weeping'] },
  plum: { make: plum, forms: ['old'] },
  bamboo: { make: bamboo, forms: ['clump'] },
  shrub: { make: shrub, forms: ['bush'] },
};
const COPIES = 2;                                                      // 每个长相、每一档各做几棵不同的

// 返回 shapes[树种][档] = [几何体…]，每个几何体的 userData.form 是它的长相
export function buildTreeShapes() {
  const shapes = {};
  Object.entries(SPECIES).forEach(([kind, { make, forms }], ki) => {
    shapes[kind] = {};
    for (const tier of Object.keys(DETAIL)) shapes[kind][tier] = forms.flatMap((form, fi) => Array.from({ length: COPIES }, (_, i) => {
      const geo = make(1.1 + ki * 1.9 + fi * 3.7 + i * 1.37, DETAIL[tier], form).geometry();     // 三档用同一个种子：同一棵树的精、简两个版本骨架相同
      geo.userData.form = form;
      return geo;
    }));
  });
  return shapes;
}
