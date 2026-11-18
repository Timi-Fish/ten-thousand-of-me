// 大远景里的林相：山梁以内离路远的地方，林子按「林分」一片一片地长，不是一种树匀匀地铺满。
// 每片林分（一百来个单位、边界弯弯曲曲的一块）是一种林：松林、竹海、枫林、阔叶杂木、桃林、草甸（几乎没有树）、疏林。
// 选哪种看这一片在哪：高处和陡处多松，低处的缓坡多竹、桃和杂木，溪谷边多竹；同一种林里树的高矮也按林分定（老林子高、新林子矮）。
// 林分的边上树渐稀（林缘），脊上和崖上另有零星的孤松。
import { rnd } from '../anim.js';
import { vnoise, fbm, smooth } from './noise.js';

const CELL = 115;
// 林分的种类：[名字, 密度, 树种和长相…]
const STANDS = {
  pine: { density: .95, trees: [['pine', 'tall', .6], ['pine', 'lean', 1]] },
  bamboo: { density: 1, trees: [['bamboo', 'clump', 1]] },
  maple: { density: .9, trees: [['broad', 'maple', .85], ['pine', 'tall', 1]] },
  mixed: { density: .8, trees: [['broad', 'oak', .4], ['broad', 'smoke', .7], ['broad', 'maple', .85], ['pine', 'tall', 1]] },
  peach: { density: .62, trees: [['peach', 'open', 1]] },
  meadow: { density: .04, trees: [['broad', 'oak', .5], ['pine', 'lean', 1]] },
  sparse: { density: .3, trees: [['pine', 'lean', .5], ['broad', 'smoke', 1]] },
};

// (x, z) 落在哪一片林分里：cell 林分的编号（两个随机数），edge 离林分的边多远
const HIT = { a: 0, b: 0, edge: 0 };
function standCell(x, z) {
  const wx = x + 45 * (fbm(x / 160 + 2.7, z / 160 + 9.1, 2) - .5), wz = z + 45 * (fbm(x / 160 + 13.3, z / 160 + 4.4, 2) - .5);
  const px = wx / CELL, pz = wz / CELL, ix = Math.floor(px), iz = Math.floor(pz);
  let d1 = 1e9, d2 = 1e9, bi = 0, bj = 0;
  for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) {
    const gi = ix + a, gj = iz + b, fx = gi + .15 + .7 * vnoise(gi + 311, gj + 17) - px, fz = gj + .15 + .7 * vnoise(gi + 53, gj + 227) - pz, d = fx * fx + fz * fz;
    if (d < d1) { d2 = d1; d1 = d; bi = gi; bj = gj; } else if (d < d2) d2 = d;
  }
  HIT.a = vnoise(bi + 401, bj + 61); HIT.b = vnoise(bi + 97, bj + 503); HIT.edge = (Math.sqrt(d2) - Math.sqrt(d1)) * CELL;
  return HIT;
}

// 这一片是什么林：按高度、坡度、离溪多近给各种林的分量，再用林分的随机数挑一种
function standKind(h, slope, wet, home, a) {
  const w = {
    pine: .8 + 1.6 * smooth(70, 150, h) + 1.2 * smooth(.32, .5, slope),
    bamboo: .55 * smooth(150, 70, h) + 1.1 * wet + .6 * home,
    maple: .7 * smooth(25, 60, h) * smooth(170, 110, h),
    mixed: .9 * smooth(170, 90, h),
    peach: (.8 * smooth(55, 20, h) + 1.6 * home) * smooth(.3, .15, slope),
    meadow: (.95 + home) * smooth(.25, .1, slope) * smooth(90, 30, h),
    sparse: .35,
  };
  const total = Object.values(w).reduce((s, v) => s + v, 0);
  let pick = a * total;
  for (const [name, v] of Object.entries(w)) { pick -= v; if (pick <= 0) return name; }
  return 'sparse';
}

// 这一处种不种树、种什么：返回 { kind, form, scale } 或 null。seed：这个撒点自己的随机数；ridge：比周围高出多少（脊为正）；wet：离溪多近（1 贴着溪）
// home：离村子多近（1 在村边）：村子四周多桃园、竹林和草地
export function standTree(x, z, h, slope, ridge, wet, home, seed) {
  const cell = standCell(x, z), kind = standKind(h, slope, wet, home, cell.a), stand = STANDS[kind];
  // 脊上和崖上的孤松：不管哪片林，都零零星星站着
  if ((ridge > 6 || slope > .55) && rnd(seed * 3.3 + 1.1) < .12 + .2 * smooth(6, 18, ridge)) return { kind: 'pine', form: slope > .45 ? 'crag' : 'lean', scale: .9 + .5 * rnd(seed * 7.1) };
  const thin = smooth(4, 26, cell.edge);                                                           // 林缘：边上稀
  if (rnd(seed * 5.9 + 2.3) > stand.density * (.35 + .65 * thin) * smooth(.62, .5, slope)) return null;
  const roll = rnd(seed * 8.7 + .4), [tree, form] = stand.trees.find(([, , upto]) => roll <= upto).slice(0, 2);
  const age = .78 + .6 * cell.b;                                                                  // 老林子高、新林子矮
  return { kind: tree, form, scale: age * (.8 + .35 * rnd(seed * 4.1)) };
}
