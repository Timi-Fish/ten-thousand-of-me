// 冬：「冬山如睡」。天和水罩着冷灰，把雪山烘成白的；寒林、压雪的茅屋里亮着一点灯，江上一叶独钓的舟，近处一株老梅开着红花。
// 主色是冷灰蓝和雪白，只有梅花、灯火、行人的斗篷是暖的。
import { stream, fbm, smooth } from './util.js';
import { ridgeLine, mountain, lobes, mist, SNOW } from './scroll.js';
import { blossomTree, bareTree, farTrees, grove, moss, pine } from './flora.js';
import { hut, temple, boat, figure, inscribe, ripples } from './figures.js';
import { dab } from './brush.js';

const SKY = [92, 104, 130], SHADE = [104, 116, 142];

export function paintWinter(S) {
  const rs = stream(404), W = S.w, H = S.h;
  // 先把整幅天和水罩一层冷灰，江面那一段更深一些；之后画的雪山是从这层灰里「留」出来的白
  S.pass(0, H, p => p.stain(SKY, (.2 + .16 * smooth(120, 700, p.y) + .14 * smooth(1300, 1420, p.y) * smooth(1760, 1640, p.y)) * (.72 + .56 * fbm(p.x * .008, p.y * .008, 3))));

  const snowy = { wash: SHADE, cun: 'axe', solid: 1, light: -1 };
  const far = ridgeLine(W, { base: 830, peaks: [[168, 370, 100, .1], [372, 240, 88], [530, 170, 70]], rough: 16, jag: 3, seed: 111 });
  mountain(S, { ...snowy, ridge: far, depth: 330, seed: 111, washA: .34, inkA: .13, snow: .5, line: .7, cunScale: 2 });
  mist(S, 880, 40, { seed: 2, strength: .5 });

  // 主山：雪压着，只有背光的石面和山缝里露出墨色
  const main = ridgeLine(W, { base: 1270, peaks: [[392, 500, 128, -.1], [150, 330, 108], [566, 270, 70]], rough: 26, jag: 6, seed: 112 });
  mountain(S, { ...snowy, ridge: main, depth: 500, seed: 112, washA: .42, inkA: .4, snow: .8, line: 1.2, cunScale: 1.2 });
  lobes(S, main, [[392, 80, 58, 66], [350, 190, 70, 70], [440, 270, 66, 60], [150, 66, 56, 50], [190, 180, 70, 60], [100, 260, 60, 50], [300, 360, 90, 60], [500, 380, 70, 56], [566, 70, 40, 50]],
    { ...snowy, seed: 121, washA: .38, inkA: .42, snow: .85, solid: .7, line: 1 });
  farTrees(S, rs, main, 20, 570, { step: 9, h: 13, color: [44, 60, 66], fir: true, chance: .5 });
  grove(S, rs, 250, 1150, 120, 40, 46, { h: 17, bare: true });
  temple(S, 262, 1132, 46, { snow: true });
  grove(S, rs, 480, 1190, 70, 26, 22, { h: 15, bare: true });
  mist(S, 1290, 40, { seed: 3, strength: .6 });

  // 左岸：雪坡上的茅屋，窗里亮着灯；屋后几棵挂雪的寒树，一个打伞的人正往屋里走
  const bank = ridgeLine(W, { base: 1650, peaks: [[112, 210, 128], [250, 90, 70]], rough: 8, jag: 3, seed: 113 });
  mountain(S, { ...snowy, ridge: bank, depth: 170, seed: 113, washA: .4, inkA: .55, snow: .9, span: [-100, 350, 80], line: 1.2 });
  bareTree(S, rs, 50, bank[50] + 4, 190, { snow: true, lean: .1 }); bareTree(S, rs, 196, bank[196] + 4, 150, { snow: true, lean: -.15 });
  pine(S, rs, 22, bank[22] + 4, 130, { snow: true, color: [50, 74, 76] });
  hut(S, 124, bank[124] + 14, 78, { snow: true, lit: true });
  figure(S, 258, bank[258] + 6, 30, { robe: [190, 60, 50], umbrella: true, face: -1 });
  for (let i = 0; i < 9; i++) dab(S.ink(), 270 + i * 8 + (i % 2) * 2, bank[Math.min(W - 1, 270 + i * 8)] + 8 + (i % 2) * 2.5, 1.5, .9, .3, [70, 78, 96], .6);   // 雪地上来时的一行脚印
  ripples(S, rs, 280, 560, 1400, 1700, 26, .32);
  boat(S, 352, 1668, 80, { face: 1 });

  // 近岸：右边的雪坡上一株老梅斜出去，红花开在雪里；左下几棵寒树
  const near = ridgeLine(W, { base: 2075, peaks: [[456, 380, 142], [130, 240, 120]], rough: 16, jag: 6, seed: 114 });
  mountain(S, { ...snowy, ridge: near, depth: 420, seed: 114, washA: .46, inkA: .7, snow: .95, line: 1.8, cunScale: 1.3 });
  lobes(S, near, [[456, 60, 70, 56], [400, 160, 66, 50], [524, 170, 56, 50], [130, 46, 60, 44], [200, 130, 60, 40]], { ...snowy, seed: 131, washA: .4, inkA: .7, snow: .95, solid: .7, line: 1.3, cunScale: 1.2 });
  moss(S, rs, near, 10, 570, { n: 16, size: 3 });
  // 几棵主要的树各用自己的随机序列，树形不随画里别处的增删而变
  bareTree(S, stream(4), 96, near[96] + 8, 330, { snow: true, lean: .1 }); bareTree(S, stream(8), 180, near[180] + 6, 220, { snow: true, lean: -.2 });
  blossomTree(S, stream(4), 486, near[486] + 10, 330, { petals: [[196, 48, 44], [214, 78, 62], [176, 36, 42]], heart: [104, 20, 26], lean: -.24, count: .55, size: .9, glow: 0 });

  // 雪还在下：满幅细碎的白点
  S.opaque();
  for (let i = 0; i < 420; i++) { const r = rs.range(.7, 1.9); dab(S.g, rs() * W, rs() * H, r, r, 0, SNOW, rs.range(.5, .9)); }

  inscribe(S, rs, { title: '冬山如睡', note: '万我之一写冬', x: 528, y: 190 });
}
