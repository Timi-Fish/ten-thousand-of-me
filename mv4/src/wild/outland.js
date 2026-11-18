// 山梁外面：这片山水的来龙去脉。只有数据和纯函数。
//   支脉——山梁上的几个结往外各伸出一道岭，一路低下去，在云海里沉下去一截，再冒出来成一道越走越高的长岭，接到远山（farrange.js）；
//         东臂外面还并排着一道外岭（两重山），两道之间夹着一条悬在半山的谷。
//   岛——支脉之间另有几道不和山梁相连的长岭，各有几个高低不一的头。云海里露出来的是一道道岭，不是一个个孤立的圆包。
//   出谷——水口外面一条往南去的谷：谷底从水口里那片平地接出去，一路往下，左右两道谷壁从两个山嘴接着往南伸，西壁半路鼓成一座朝案，谷绕着它拐弯；
//         两道谷壁沉进云里以后又各冒出一列岛，夹着云下的谷一直排到远山——从主峰上望出去，看得出这条谷往哪里去。
//   所有的岭和岛，横断面顶上都是一段圆弧（半径 round），往下才是直的坡：山头是钝的。
// 云在哪、多高也在这里（terrain.js 烤进贴图，clouds.js 读）：
//   cloudSea——云海有几成：山梁以内没有；水口外面一大片「云湾」，云面朝着水口一路低下去。云是平着漫的，所以谷里最低的那一线（溪）云伸得最远，
//             成了一条贴着谷底伸进来的云舌，两道谷壁露在外面；
//   cloudFall——贴着地面往下淌的云：几个低过云海的垭口上，云翻过脊线顺着内坡往下流，到半坡化掉。
import { vnoise, fbm, smooth, lerp, clamp } from './noise.js';
import { BOWL, D2R, RANGE, ringAt } from './ranges.js';

const smax = (a, b, k) => { const h = clamp(.5 + .5 * (a - b) / k); return lerp(b, a, h) + k * h * (1 - h); };
const hinge = (w, k) => .5 * (w + Math.sqrt(w * w + k * k));          // 圆角的 max(0, w)

// 出谷的中线：[z, 谷心的 x, 谷底多高, 谷底半宽]。头两个点在水口以内，只给古道和溪定走向
const VALE = [
  [1040, -14, 5, 64], [1130, -30, 4.6, 70], [1223, -52, 3.6, 62], [1300, -46, 1.4, 56], [1380, -12, -3.5, 60], [1470, 38, -11, 70], [1560, 60, -21, 80], [1660, 36, -33, 90],
  [1780, -22, -46, 100], [1920, -70, -58, 110], [2100, -55, -60, 120], [2320, 25, -60, 130], [2600, 120, -60, 140], [3000, 150, -60, 150], [3600, 90, -60, 160], [4800, 100, -60, 160],
];
export const MOUTH_Z = 1223;                                         // 水口那条线（脊线过谷心的地方）
// 谷在 z 处：x 谷心、y 谷底高、half 谷底半宽、lean 谷心每往南一个单位往东偏多少
const AT = { x: 0, y: 0, half: 0, lean: 0 };
export function valeAt(z) {
  const n = VALE.length, zc = clamp(z, VALE[0][0], VALE[n - 1][0] - 1e-3);
  let i = 0;
  while (VALE[i + 1][0] <= zc) i++;
  const a = VALE[i], b = VALE[i + 1], p = VALE[Math.max(0, i - 1)], q = VALE[Math.min(n - 1, i + 2)], L = b[0] - a[0], t = (zc - a[0]) / L, t2 = t * t, t3 = t2 * t;
  const curve = c => {                                               // 过四个点的三次曲线，和它的斜率
    const ma = (b[c] - p[c]) / (b[0] - p[0]) * L, mb = (q[c] - a[c]) / (q[0] - a[0]) * L;
    return [(2 * t3 - 3 * t2 + 1) * a[c] + (t3 - 2 * t2 + t) * ma + (3 * t2 - 2 * t3) * b[c] + (t3 - t2) * mb, ((6 * t2 - 6 * t) * (a[c] - b[c]) + (3 * t2 - 4 * t + 1) * ma + (3 * t2 - 2 * t) * mb) / L];
  };
  [AT.x, AT.lean] = curve(1); AT.y = curve(2)[0]; AT.half = lerp(a[3], b[3], t);
  return AT;
}
// 把谷挖出来：base 是谷底以外本来的地面。谷底平，两岸先是一段缓坡（台地），再往外陡起来
function valeCarve(x, z, base) {
  if (z < 1010) return base;
  const v = valeAt(z), w = Math.abs(x - v.x) / Math.sqrt(1 + v.lean * v.lean) - v.half;
  if (w > 700) return base;
  return -smax(-base, -(v.y + .1 * hinge(w, 12) + .8 * hinge(w - 120, 30) + 300 * smooth(1130, 1010, z)), 10);
}

// 岭：{ steep 坡多陡, round 脊顶的圆弧半径, spur 两侧的侧脊伸出去几成（不写是 .5；谷壁朝着谷底，写小一些）, pts: [x, z, 脊线高]… }
const RIDGES = [
  // 东外岭：和东臂并排的第二重山，北头接东北的结，南头接东南的结
  { steep: 1.15, round: 24, spur: .15, pts: [[452, 470, 186], [520, 548, 160], [566, 640, 168], [580, 745, 158], [566, 850, 170], [528, 940, 150], [468, 1010, 140], [398, 1052, 160]] },
  // 东北支脉
  { steep: .8, round: 30, pts: [[470, 470, 180], [560, 455, 150], [640, 470, 104], [700, 500, 70], [790, 500, 132], [880, 455, 172], [990, 430, 152], [1100, 370, 190], [1220, 330, 170], [1360, 250, 214]] },
  // 东南支脉
  { steep: .8, round: 30, pts: [[372, 1075, 160], [440, 1140, 146], [505, 1225, 122], [570, 1310, 92], [650, 1390, 70], [750, 1465, 128], [860, 1550, 160], [980, 1660, 150], [1100, 1790, 186], [1230, 1950, 172], [1380, 2100, 220]] },
  // 出谷的东壁：从东山嘴接着往南，一路低下去沉进云里，再冒出来成一道越走越高的长岭，夹着云下的谷一直排到远山
  { steep: .7, round: 28, spur: .2, pts: [[196, 1212, 114], [228, 1300, 104], [236, 1395, 92], [240, 1485, 86], [262, 1580, 78], [300, 1690, 64], [322, 1800, 52], [330, 1900, 90], [318, 2010, 142], [352, 2150, 170], [420, 2310, 150], [470, 2480, 190], [455, 2680, 172], [520, 2900, 215], [560, 3150, 240]] },
  // 出谷的西壁：从西山嘴接着往南，半路鼓成朝案（谷绕着它拐弯），再往南同样沉下去、又冒出来成一道长岭
  { steep: .7, round: 36, spur: .2, pts: [[-262, 1200, 102], [-256, 1290, 110], [-226, 1385, 98], [-205, 1470, 104], [-196, 1555, 96], [-232, 1650, 72], [-282, 1760, 56], [-318, 1870, 86], [-372, 2000, 140], [-420, 2150, 166], [-412, 2330, 148], [-460, 2500, 186], [-438, 2700, 170], [-500, 2920, 212], [-520, 3180, 236]] },
  // 西南支脉
  { steep: .8, round: 30, pts: [[-400, 1150, 140], [-462, 1225, 128], [-530, 1300, 108], [-610, 1365, 82], [-690, 1420, 68], [-790, 1490, 130], [-900, 1590, 158], [-1030, 1700, 148], [-1150, 1840, 182], [-1290, 1990, 170], [-1440, 2130, 216]] },
  // 西支脉
  { steep: .85, round: 30, pts: [[-480, 640, 196], [-548, 622, 168], [-612, 640, 124], [-676, 668, 78], [-770, 690, 130], [-880, 655, 162], [-1000, 690, 146], [-1130, 660, 160], [-1270, 700, 148], [-1420, 690, 176]] },
  // 岛：云海里几道不和山梁相连的长岭（各有几个高低不一的头），在支脉之间一重一重地排出去
  { steep: .8, round: 34, pts: [[820, 640, 118], [870, 760, 150], [850, 900, 138], [900, 1040, 160], [980, 1150, 140]] },
  { steep: .8, round: 36, pts: [[-850, 800, 124], [-880, 920, 156], [-940, 1040, 140], [-1000, 1160, 158]] },
  { steep: .8, round: 34, pts: [[560, 1700, 100], [640, 1830, 138], [700, 1980, 156], [690, 2140, 140], [760, 2300, 170]] },
  { steep: .8, round: 36, pts: [[-560, 1700, 104], [-640, 1840, 140], [-710, 1990, 160], [-770, 2120, 146], [-820, 2300, 176]] },
  { steep: .9, round: 30, pts: [[-800, -150, 140], [-852, -70, 126]] },
  { steep: .9, round: 30, pts: [[862, 60, 122], [900, 150, 140]] },
].map(({ spur = .5, ...r }, k) => {
  const reach = Math.max(...r.pts.map(p => p[2])) * (1 + 1.4 * spur) / r.steep + r.round + 30;
  return { ...r, spur, seed: k * 3.7 + 1.3, box: [Math.min(...r.pts.map(p => p[0])) - reach, Math.max(...r.pts.map(p => p[0])) + reach, Math.min(...r.pts.map(p => p[1])) - reach, Math.max(...r.pts.map(p => p[1])) + reach] };
});

// 岭和岛在 (x, z) 的高度（没有的地方是很低的负数）
function outliers(x, z) {
  let h = -1e3;
  for (const r of RIDGES) {
    if (x < r.box[0] || x > r.box[1] || z < r.box[2] || z > r.box[3]) continue;
    let best = Infinity, top = 0, along = 0, run = 0, side = 1;
    for (let i = 0; i < r.pts.length - 1; i++) {
      const a = r.pts[i], b = r.pts[i + 1], ex = b[0] - a[0], ez = b[1] - a[1], len = Math.hypot(ex, ez), k = clamp(((x - a[0]) * ex + (z - a[1]) * ez) / (len * len));
      const d = (x - a[0] - ex * k) ** 2 + (z - a[1] - ez * k) ** 2;
      if (d < best) { best = d; top = lerp(a[2], b[2], k * k * (3 - 2 * k)); along = run + k * len; side = ex * (z - a[1]) - ez * (x - a[0]) > 0 ? 1 : -1; }
      run += len;
    }
    const d = Math.sqrt(best);
    // 两肋顺坡往下的冲沟：疏密、深浅都不匀（有的坡面一道挨一道，有的整片是平的）；脊线有一点起伏
    const lane = along / 30 + 1.6 * fbm(x / 95 + r.seed, z / 95, 2), gully = (1 - Math.abs(2 * vnoise(lane, r.seed * 7.7 + d / 240) - 1)) ** 2.5;
    const rib = 10 * gully * smooth(12, 50, d) * smooth(.3, .62, fbm(x / 150 + r.seed * 3.1, z / 150 + 4.4, 2));
    // 侧脊：两侧隔一段各探出去一道扶壁一样的小脊（这一侧、这一段坡放缓，山脚就伸得远），两侧错开；之间的坡收得陡。岭的平面形状像一条有枝杈的脉，不是一根等宽的棍
    const lobe = vnoise(along / 85 + r.seed * 2.3, side * 5.7 + r.seed), girth = d * (.85 + .3 * fbm(x / 110 + r.seed * 1.7, z / 110 + 8.8, 2)) / (1 - .6 * r.spur + 2 * r.spur * lobe * lobe);
    const ridge = top + 9 * (fbm(along / 70 + r.seed * 5.1, r.seed, 2) - .5) - r.steep * (Math.sqrt(girth * girth + r.round * r.round) - r.round) - rib;
    h = h < -500 ? ridge : smax(h, ridge, 12);
  }
  return h;
}

// 山梁以外的地面：base 是云海底下的谷地加远山；先挖出谷，再立起岭和岛
export function outland(x, z, base) {
  const h = valeCarve(x, z, base), out = outliers(x, z);
  return out > h - 40 ? smax(h, out, 16) : h;
}

// 云海有几成（0 没有，1 完整的云海）。云面的高度按它往下降（clouds.js）
// 云湾：以水口为心的一个椭圆（沿谷长 along、横里宽 across）。椭圆的 pool 成以内云面是平的、很低（云海的 level 成：比出谷的谷底在水口外两百来个单位处还低）——
// 像一池积在谷里的冷雾：谷底低过它的地方才有云，所以云贴着溪伸进来一条舌头，越往外越宽、越厚；pool 成以外云面一路升回云海
const BAY = { along: 800, across: 560, pool: .5, level: .25 };
export function cloudSea(x, z) {
  const ring = smooth(-55, 15, ringAt(x, z, 0, RANGE).off);
  if (ring <= 0) return 0;
  const e = Math.hypot((z - MOUTH_Z) / BAY.along, (x - valeAt(z).x) / BAY.across);
  return ring * lerp(BAY.level, 1, smooth(BAY.pool, 1, e));
}

// 垭口上的云瀑：[方位°, 半宽, 顺着内坡往下淌多远]
const FALLS = [[76, 46, 135], [112, 42, 125], [257, 54, 150]];
// 贴地的云：0 到 0.5 是快到了（clouds.js 在这一带迈小步），0.5 到 1 是云层的厚薄（0.5 没有，1 最厚）
export function cloudFall(x, z) {
  const dx = x - BOWL.x, dz = z - BOWL.z, rho = Math.hypot(dx, dz), phi = Math.atan2(dx, -dz), r = -ringAt(x, z, 0, RANGE).off;
  let thick = 0, zone = 0;
  for (const [deg, w0, reach] of FALLS) {
    let da = Math.abs(phi - deg * D2R); da = Math.min(da, 2 * Math.PI - da);
    const a = da * rho;
    if (a > w0 * 1.5 + 70 || r > reach + 70 || r < -200) continue;
    const w = w0 * (1 - .35 * clamp(r / reach)) * (.8 + .5 * fbm(x / 60 + deg, z / 60, 2)), side = clamp(1 - (a / w) ** 2), along = r < 0 ? smooth(-130, -50, r) : clamp(1 - r / reach) ** 1.3;
    thick = Math.max(thick, side * side * along);
    zone = Math.max(zone, smooth(w + 70, w, a) * (r < 0 ? smooth(-200, -130, r) : smooth(reach + 70, reach, r)));
  }
  return .5 * zone + .5 * thick;
}
