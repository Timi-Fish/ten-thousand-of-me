// 把一只小蟹的全部部件造出来、合成两个网格：软的（身体、衣服、头饰、毫毛，跟着身体变形）和四肢（挂在骨头上）。
// 同一种头饰、同一档精细度只造一次，所有小蟹共用。
import { clamp } from '../anim.js';
import { grid, tube, dress, join, blend } from './geo.js';
import { point, rowY, PERIM } from './shape.js';
import { limbs } from './limbs.js';
import { wear } from './wear.js';
import { KITS, HAIR_BASE } from './kits.js';
import { BH } from './pose.js';
import { SKIN } from './palette.js';

// 皮肤：整块身体。纹样坐标是 [绕身体一圈的弧长, 高度]
const skin = q => dress(grid(Math.round(96 * q), Math.round(56 * q), (a, b) => point(a, rowY(b)), (a, b) => [a * PERIM, rowY(b)]), { col: SKIN.body, id: 1 });
// 头顶三根毫毛：根粗梢细，往两边撇，梢上往回勾一点；越靠梢越跟着「快摆」弹。base：从头顶往上多高的地方长出来
const hairs = (q, base) => [[-.1, -.22], [0, .03], [.1, .24]].map(([x, dx]) => dress(
  tube([[x, base - .04, 0], [x + dx * .1, base + .17, 0], [x + dx * .75, base + .33, .01], [x + dx * 1.02, base + .4, .03], [x + dx * .98, base + .435, .06]], s => .028 * (1 - .78 * s), { seg: Math.round(14 * q), sides: 8 }),
  { col: at => blend(SKIN.hair, SKIN.hairTip, clamp((at[1] - base) / .43)), ink: .75, flex: at => [0, clamp((at[1] - base) / .43) ** 1.6] }));
// 头上的东西：头饰和毫毛，造的时候以头顶为原点，这里一起搬到头顶上
const headgear = (kit, q) => [KITS[kit](q), HAIR_BASE[kit] === null ? [] : hairs(q, HAIR_BASE[kit])].flat(Infinity).map(g => g.translate(0, BH, 0));

const made = new Map();
const once = (key, make) => { if (!made.has(key)) made.set(key, make()); return made.get(key); };
// kit：头饰名；lite：精简档（人群用）
export function assets(kit, lite) {
  const q = lite ? .5 : 1;
  return { soft: once(`${kit}/${q}`, () => join(skin(q), wear(q), headgear(kit, q))), limb: once(`limb/${q}`, () => limbs(q)) };
}
