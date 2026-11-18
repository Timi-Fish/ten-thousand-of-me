// 秋：「秋山如妆」。平远的一江秋水，右边一壁斧劈皴的断崖，满树红叶，天边一行雁、一轮将落的日头。主色是赭石和朱红。
// 构图自上而下：晚霞、落日、雁阵 → 淡远的山 → 断崖和崖下红树间的茅屋 → 江面、渔舟、对岸的芦渚 → 近岸的大枫树和树下的人。
import { stream, fbm, lerp } from './util.js';
import { ridgeLine, mountain, lobes, mist } from './scroll.js';
import { leafTree, farTrees, grove, grass, moss, reeds, bareTree } from './flora.js';
import { hut, boat, figure, geese, ripples, inscribe, sail } from './figures.js';
import { dab, soft } from './brush.js';

const MAPLE = { wash: [226, 126, 74], mid: [204, 82, 48], dark: [118, 40, 34], accent: [240, 176, 66] }, AMBER = { wash: [224, 160, 80], mid: [200, 128, 52], dark: [110, 62, 36], accent: [214, 84, 48] };

export function paintAutumn(S) {
  const rs = stream(303), W = S.w;
  // 晚霞：天的下半截淡淡一抹暖色；霞里一轮落日
  S.pass(380, 1000, p => p.stain([232, 150, 112], .26 * Math.exp(-(((p.y - 700) / 170) ** 2)) * (.5 + .9 * fbm(p.x * .007, p.y * .018, 3))));
  const g = S.ink();
  soft(g, 176, 668, 74, 60, [236, 140, 96], .3); dab(g, 176, 668, 27, 27, 0, [214, 92, 62], .62);
  geese(S, rs, 318, 500, 5, 16, -1);

  // 远山两重，淡紫灰
  const far2 = ridgeLine(W, { base: 950, peaks: [[452, 230, 118], [250, 130, 110], [66, 180, 88]], rough: 12, jag: 2, seed: 71 });
  mountain(S, { ridge: far2, depth: 220, seed: 71, wash: [122, 122, 158], washA: .38, ink: [90, 90, 120], inkA: .2, cun: 'none', solid: .5, line: .6 });
  const far1 = ridgeLine(W, { base: 1010, peaks: [[330, 110, 140], [30, 130, 90]], rough: 10, jag: 3, seed: 72 });
  mountain(S, { ridge: far1, depth: 150, seed: 72, wash: [128, 112, 118], washA: .4, tint: [200, 150, 96], tintA: .3, ink: [90, 80, 90], inkA: .16, cunScale: 1.2, solid: .85, line: .7 });
  mist(S, 1050, 40, { seed: 4 });

  // 断崖：斧劈皴，赭石设色；崖顶和石缝里是红树
  const cliff = ridgeLine(W, { base: 1420, peaks: [[512, 470, 96, .5], [392, 160, 66]], rough: 22, jag: 7, seed: 73 });
  mountain(S, { ridge: cliff, depth: 370, seed: 73, wash: [98, 84, 78], washA: .38, tint: [200, 132, 70], tintA: .55, tintSpan: .8, foot: [168, 128, 100], footA: .25, inkA: .72, cun: 'axe', solid: .97, span: [290, 700, 70], line: 1.3 });
  lobes(S, cliff, [[520, 90, 50, 70], [470, 210, 56, 70], [540, 300, 50, 60], [400, 60, 44, 50], [440, 330, 70, 60]], { seed: 81, wash: [98, 84, 78], washA: .34, tint: [200, 132, 70], tintA: .4, tintSpan: .9, inkA: .7, cun: 'axe', solid: .5, line: 1.2 });
  farTrees(S, rs, cliff, 340, 580, { step: 7, h: 14, color: [206, 96, 54] });
  moss(S, rs, cliff, 340, 580, { n: 14 });
  grove(S, rs, 450, 1340, 96, 34, 44, { color: [150, 104, 60], h: 17, accent: [212, 78, 48], accentShare: .55 });
  hut(S, 398, 1384, 64);
  S.opaque();
  for (let i = 0; i < 16; i++) dab(S.g, lerp(356, 446, rs()), 1388 + rs.range(-2, 5), 1.7, 1.5, 0, rs() < .7 ? [236, 190, 60] : [240, 232, 210], .9);   // 篱下的菊
  leafTree(S, rs, 340, 1392, 110, { palette: MAPLE, lean: -.15 }); leafTree(S, rs, 468, 1394, 120, { palette: AMBER, lean: .12 });
  mist(S, 1446, 44, { seed: 6, x0: 300, x1: 700, strength: 1, wave: 14 });

  // 对岸的芦渚、远帆、江心的渔舟
  const shoal = ridgeLine(W, { base: 1222, peaks: [[100, 34, 120]], rough: 5, jag: 2, seed: 74 });
  mountain(S, { ridge: shoal, depth: 46, seed: 74, wash: [120, 104, 90], washA: .36, tint: [206, 160, 100], tintA: .45, inkA: .45, cunScale: .8, span: [-100, 290, 70], line: .8 });
  reeds(S, rs, 20, 250, shoal[120] + 6, { h: 34, n: 34 });
  for (const x of [60, 150, 205]) bareTree(S, rs, x, shoal[x] + 3, 60, { levels: 3 });
  sail(S, 300, 1150, 13); sail(S, 250, 1160, 9);
  ripples(S, rs, 20, 540, 1250, 1620, 70, .3);
  boat(S, 430, 1612, 84, { face: -1 });

  // 近岸：左边一座石坡，两三棵大枫树，一棵斜向江面；树下坐着看水的人；右下一丛芦苇
  const near = ridgeLine(W, { base: 2075, peaks: [[118, 450, 140], [450, 190, 120]], rough: 18, jag: 7, seed: 75 });
  mountain(S, { ridge: near, depth: 460, seed: 75, wash: [92, 80, 74], washA: .38, tint: [196, 132, 72], tintA: .5, tintSpan: .55, foot: [160, 124, 98], footA: .28, inkA: .78, cun: 'axe', cunScale: 1.3, line: 1.8, solid: 1 });
  lobes(S, near, [[118, 60, 70, 60], [60, 180, 70, 56], [190, 170, 66, 56], [450, 40, 66, 44], [330, 120, 60, 44]], { seed: 91, wash: [92, 80, 74], washA: .34, tint: [196, 132, 72], tintA: .4, tintSpan: .8, inkA: .74, cun: 'axe', cunScale: 1.2, solid: .5, line: 1.3 });
  moss(S, rs, near, 10, 570, { n: 22, size: 3 });
  grass(S, rs, 10, 570, x => near[Math.round(x)] + 1, 46, [110, 84, 50]);
  reeds(S, rs, 380, 566, near[470] + 10, { h: 76, n: 30, lean: -.25 });
  // 几棵主要的树各用自己的随机序列，树形不随画里别处的增删而变
  leafTree(S, stream(8), 262, near[262] + 8, 230, { palette: AMBER, lean: .3 });
  leafTree(S, stream(6), 70, near[70] + 10, 360, { palette: AMBER, lean: -.05, density: 1.1 });
  leafTree(S, stream(4), 168, near[168] + 10, 420, { palette: MAPLE, lean: .2, density: 1.15 });
  figure(S, 322, near[322] + 4, 34, { robe: [238, 234, 222], seated: true });
  S.opaque();
  for (let i = 0; i < 26; i++) dab(S.g, lerp(240, 520, rs()), lerp(1500, 1900, rs()), 2.6, 1.5, rs() * 3, rs() < .6 ? MAPLE.mid : MAPLE.accent, .85);   // 飘落的红叶

  inscribe(S, rs, { title: '秋山如妆', note: '万我之一写秋', x: 96, y: 196 });
}
