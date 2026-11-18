// 春：「春山如笑」。青绿的缓山、桃花、垂柳、一江春水。主色是嫩绿和桃红。
// 构图自上而下：淡远的峰 → 披麻皴的主山，山腰桃林里露出寺顶 → 江面和对岸的沙渚 → 近岸的大柳树、桃树和看花的人。
import { stream } from './util.js';
import { ridgeLine, mountain, lobes, mist } from './scroll.js';
import { willow, blossomTree, farTrees, grove, grass, moss } from './flora.js';
import { pavilion, temple, boat, figure, swallow, ripples, inscribe, sail, duck, stones, bridge } from './figures.js';

const PEACH = [[240, 168, 178], [246, 200, 204], [232, 138, 156]];

export function paintSpring(S) {
  const rs = stream(101), W = S.w;
  // 远峰两重：只用花青淡淡染出来
  const far2 = ridgeLine(W, { base: 720, peaks: [[430, 310, 115, .2], [270, 200, 100]], rough: 14, jag: 2, seed: 11 });
  mountain(S, { ridge: far2, depth: 280, seed: 11, wash: [110, 146, 164], washA: .36, ink: [80, 104, 124], inkA: .2, cun: 'none', solid: 0, line: .6 });
  const far1 = ridgeLine(W, { base: 830, peaks: [[110, 180, 125], [540, 170, 90]], rough: 14, jag: 3, seed: 12 });
  mountain(S, { ridge: far1, depth: 230, seed: 12, wash: [100, 138, 140], washA: .42, tint: [122, 168, 132], tintA: .3, ink: [70, 92, 100], inkA: .3, cunScale: 1.2, solid: .85, line: .7 });
  mist(S, 905, 44, { seed: 3 });

  // 主山：上青下赭，披麻皴
  const main = ridgeLine(W, { base: 1140, peaks: [[405, 470, 150, -.15], [200, 300, 118], [25, 160, 90]], rough: 26, jag: 5, seed: 13 });
  mountain(S, { ridge: main, depth: 480, seed: 13, wash: [84, 98, 92], washA: .3, tint: [108, 160, 100], tintA: .55, tintSpan: .62, foot: [198, 156, 104], footA: .3, inkA: .5, solid: .96 });
  lobes(S, main, [[405, 70, 62, 60], [345, 150, 76, 70], [468, 185, 66, 60], [200, 56, 56, 50], [246, 150, 76, 60], [128, 215, 70, 55], [390, 275, 92, 60], [522, 300, 60, 50], [60, 120, 50, 40]],
    { seed: 21, wash: [84, 98, 92], washA: .3, tint: [108, 160, 100], tintA: .4, tintSpan: .8, inkA: .5, solid: .5, line: .9, cunScale: .9 });
  farTrees(S, rs, main, 20, 570, { step: 7, h: 12, color: [72, 112, 84] });
  moss(S, rs, main, 150, 520, { n: 16 });
  grove(S, rs, 300, 1010, 130, 46, 60, { color: [78, 122, 88], h: 15, accent: PEACH[0], accentShare: .45 });      // 山腰的桃林
  temple(S, 318, 992, 44);
  grove(S, rs, 500, 1060, 70, 30, 26, { color: [78, 122, 88], h: 14, accent: PEACH[1], accentShare: .5 });
  mist(S, 1165, 50, { seed: 5, strength: 1 });

  // 江面，对岸一道沙渚伸进水里
  const spit = ridgeLine(W, { base: 1338, peaks: [[480, 66, 150], [330, 30, 80]], rough: 6, jag: 2, seed: 14 });
  mountain(S, { ridge: spit, depth: 64, seed: 14, wash: [92, 110, 96], washA: .4, tint: [124, 168, 110], tintA: .5, foot: [196, 160, 110], footA: .3, inkA: .5, cunScale: .8, span: [215, 700, 70], line: .9 });
  willow(S, stream(6), 392, spit[392] + 4, 110, { lean: -.2, wind: .14 }); willow(S, stream(8), 512, spit[512] + 4, 128, { lean: .12, wind: .14 });
  blossomTree(S, rs, 452, spit[452] + 3, 70, { petals: PEACH, lean: .2 }); blossomTree(S, rs, 560, spit[560] + 3, 64, { petals: PEACH });
  pavilion(S, 300, spit[300] + 8, 46, { color: [150, 118, 76] });
  sail(S, 96, 1236, 15); sail(S, 150, 1222, 11);
  ripples(S, rs, 20, 520, 1200, 1580, 60, .3);
  boat(S, 205, 1462, 70, { face: -1 });
  for (const [x, y, s, face] of [[330, 1516, 5, 1], [352, 1530, 4.4, 1], [372, 1512, 4, 1], [300, 1548, 4.6, -1]]) duck(S, x, y, s, face);      // 春江水暖
  stones(S, rs, 470, 1600, 5, 6);
  bridge(S, 236, spit[250] + 16, 286, spit[290] + 12, { rise: 7 });
  for (const [x, y, s, turn] of [[250, 1250, 15, .3], [300, 1225, 12, -.2], [196, 1290, 11, .7], [420, 1425, 13, -.5], [360, 1392, 10, .2]]) swallow(S, x, y, s, turn);

  // 近岸：左边一座土坡上的大柳树，右边桃花，树下看花的人
  const near = ridgeLine(W, { base: 2075, peaks: [[125, 440, 150], [450, 250, 135], [300, 150, 80]], rough: 16, jag: 5, seed: 15 });
  mountain(S, { ridge: near, depth: 470, seed: 15, wash: [70, 80, 72], washA: .36, tint: [104, 150, 90], tintA: .6, tintSpan: .5, foot: [190, 150, 100], footA: .32, inkA: .7, cunScale: 1.4, line: 1.7, solid: 1 });
  lobes(S, near, [[125, 60, 70, 60], [70, 170, 76, 60], [196, 180, 70, 60], [450, 46, 70, 50], [396, 130, 66, 50], [524, 120, 60, 50], [300, 60, 50, 40]],
    { seed: 31, wash: [70, 80, 72], washA: .34, tint: [104, 150, 90], tintA: .4, tintSpan: .8, inkA: .7, solid: .5, line: 1.3, cunScale: 1.3 });
  moss(S, rs, near, 10, 570, { n: 26, size: 3 });
  grass(S, rs, 10, 570, x => near[Math.round(x)] + 1, 70, [58, 84, 60]);
  // 几棵主要的树各用自己的随机序列，树形不随画里别处的增删而变
  blossomTree(S, stream(4), 428, near[428] + 8, 250, { petals: PEACH, lean: -.16, leaves: [120, 160, 96], count: 1.2 });
  blossomTree(S, stream(1), 524, near[524] + 8, 200, { petals: PEACH, lean: .12, leaves: [120, 160, 96] });
  blossomTree(S, stream(5), 310, near[310] + 6, 150, { petals: PEACH, lean: -.3 });
  willow(S, stream(4), 140, near[140] + 12, 560, { lean: .2, wind: .17, strands: 1.6 });
  figure(S, 368, near[368] + 3, 34, { robe: [238, 234, 222], staff: true });
  figure(S, 392, near[392] + 3, 26, { robe: [196, 84, 70], face: -1 });

  inscribe(S, rs, { title: '春山如笑', note: '万我之一写春', x: 92, y: 372 });
}
