// 夏：「夏山如滴」。一座高峰直上，雨后的浓绿，山腰缠云，一道瀑布挂下来；山下荷塘、水榭、浓荫。主色是深绿和石青。
// 构图自上而下：淡远的峰 → 米点皴的主峰和瀑布 → 左岸林间的寺 → 水榭和荷塘 → 近岸的大树、树下纳凉的人、近处的大荷叶。
import { stream } from './util.js';
import { ridgeLine, mountain, lobes, mist } from './scroll.js';
import { leafTree, farTrees, grove, grass, moss, lotus, pine } from './flora.js';
import { temple, waterside, figure, ripples, waterfall, inscribe, egret, stones } from './figures.js';

const GREEN = { wash: [70, 112, 92], mid: [50, 96, 78], dark: [26, 46, 44] }, LIGHT = { wash: [104, 140, 96], mid: [78, 122, 82], dark: [34, 60, 50] };

export function paintSummer(S) {
  const rs = stream(202), W = S.w;
  const far = ridgeLine(W, { base: 930, peaks: [[86, 420, 92, .1], [215, 270, 80]], rough: 14, jag: 2, seed: 41 });
  mountain(S, { ridge: far, depth: 400, seed: 41, wash: [94, 126, 150], washA: .42, ink: [70, 96, 120], inkA: .22, cun: 'none', solid: 0, line: .6, span: [-100, 330, 70] });

  // 主峰：高远。石青石绿染山头，满山米点
  const main = ridgeLine(W, { base: 1190, peaks: [[335, 800, 118, .1], [492, 520, 84], [140, 410, 108]], rough: 30, jag: 6, seed: 42 });
  mountain(S, { ridge: main, depth: 800, seed: 42, wash: [58, 78, 84], washA: .34, tint: [66, 126, 110], tintA: .7, tintSpan: .8, foot: [150, 150, 108], footA: .2, inkA: .62, cun: 'mi', cunScale: 1.1, solid: .97 });
  lobes(S, main, [[335, 95, 54, 70], [300, 225, 68, 80], [380, 305, 64, 70], [318, 440, 88, 80], [492, 85, 46, 60], [470, 215, 58, 70], [140, 75, 58, 60], [172, 205, 68, 70], [96, 300, 66, 60], [250, 530, 80, 70], [425, 565, 88, 70], [524, 430, 54, 60]],
    { seed: 51, wash: [58, 78, 84], washA: .34, tint: [58, 118, 104], tintA: .55, tintSpan: .9, inkA: .62, cun: 'mi', solid: .45, line: 1 });
  farTrees(S, rs, main, 20, 570, { step: 6, h: 13, color: [40, 84, 72], fir: true });
  moss(S, rs, main, 100, 540, { n: 22 });
  mist(S, 850, 38, { seed: 7, strength: .96, wave: 44 });                                   // 山腰的云
  waterfall(S, [[356, 905], [348, 985], [362, 1065], [354, 1160]], 10, 22, 9);
  grove(S, rs, 200, 1050, 120, 50, 70, { color: [44, 90, 76], h: 16 });
  temple(S, 212, 1034, 46);
  grove(S, rs, 480, 1090, 80, 36, 36, { color: [44, 90, 76], h: 15 });
  mist(S, 1200, 46, { seed: 8 });

  // 左岸的坡和坡上的树
  const bank = ridgeLine(W, { base: 1450, peaks: [[70, 230, 120], [226, 110, 80]], rough: 10, jag: 3, seed: 43 });
  mountain(S, { ridge: bank, depth: 190, seed: 43, wash: [62, 84, 80], washA: .4, tint: [76, 132, 100], tintA: .6, foot: [160, 150, 108], footA: .25, inkA: .6, cun: 'mi', span: [-100, 330, 80], line: 1.1 });
  pine(S, rs, 46, bank[46] + 6, 150, { lean: .06 });
  leafTree(S, rs, 118, bank[118] + 6, 170, { palette: GREEN, lean: .1 }); leafTree(S, rs, 196, bank[196] + 5, 130, { palette: LIGHT, lean: -.12 });
  // 右岸伸进水里的水榭，榭里一个凭栏的人；一道板桥接到岸上
  const shore = ridgeLine(W, { base: 1420, peaks: [[560, 60, 90]], rough: 6, jag: 2, seed: 44 });
  mountain(S, { ridge: shore, depth: 70, seed: 44, wash: [62, 84, 80], washA: .4, tint: [76, 132, 100], tintA: .55, inkA: .55, cun: 'mi', span: [470, 700, 50], line: 1 });
  leafTree(S, rs, 552, shore[552] + 4, 120, { palette: GREEN });
  waterside(S, 330, 1452, 64, -1);
  figure(S, 334, 1450, 21, { robe: [196, 84, 70], seated: true });
  ripples(S, rs, 20, 540, 1470, 1700, 40, .28);
  lotus(S, rs, 250, 560, 1500, 1640, { n: 22, scale: .6, flowers: 6 });
  stones(S, rs, 356, 1196, 4, 7);                                                           // 瀑布脚下的乱石
  for (const [x, y, s, turn] of [[150, 1560, 26, -.2], [206, 1600, 22, .15], [96, 1640, 19, -.4]]) egret(S, x, y, s, turn);   // 荷塘上的白鹭

  // 近岸：右边一座石坡，坡上几棵大树遮出浓荫；左前的水面铺满荷叶
  const near = ridgeLine(W, { base: 2075, peaks: [[470, 370, 145], [120, 180, 110]], rough: 16, jag: 5, seed: 45 });
  mountain(S, { ridge: near, depth: 420, seed: 45, wash: [56, 72, 72], washA: .38, tint: [70, 128, 96], tintA: .62, tintSpan: .55, foot: [170, 150, 104], footA: .28, inkA: .72, cun: 'mi', cunScale: 1.4, line: 1.7, solid: 1 });
  lobes(S, near, [[470, 56, 70, 56], [410, 150, 70, 56], [530, 160, 60, 50], [120, 40, 60, 40], [330, 110, 60, 46]], { seed: 61, wash: [56, 72, 72], washA: .34, tint: [70, 128, 96], tintA: .45, tintSpan: .8, inkA: .7, cun: 'mi', cunScale: 1.3, solid: .5, line: 1.3 });
  moss(S, rs, near, 280, 570, { n: 20, size: 3 });
  grass(S, rs, 280, 570, x => near[Math.round(x)] + 1, 50, [44, 72, 56]);
  lotus(S, rs, 14, 330, 1730, 1930, { n: 34, scale: 1.25, flowers: 8 });
  // 几棵主要的树各用自己的随机序列，树形不随画里别处的增删而变
  leafTree(S, stream(7), 384, near[384] + 8, 200, { palette: LIGHT, lean: -.3, density: 1.2 });
  leafTree(S, stream(3), 534, near[534] + 8, 340, { palette: GREEN, lean: .04, density: 1.3 });
  leafTree(S, stream(4), 458, near[458] + 10, 290, { palette: GREEN, lean: -.16, density: 1.4 });
  figure(S, 410, near[410] + 4, 34, { robe: [238, 234, 222], seated: true, face: -1 });

  inscribe(S, rs, { title: '夏山如滴', note: '万我之一写夏', x: 528, y: 196 });
}
