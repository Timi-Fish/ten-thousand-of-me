// 主峰的山形：一座花岗岩的山。只有纯函数和常数；land.js 拿它当主峰（半山以下仍是那面宽阔的南坡）。
// 照黄山、华山这类花岗岩山的样子：山体是几道顶上浑圆的脊拼起来的，脊的两肋是近乎直立的崖（顺着竖的节理劈下去），崖脚拖着碎石坡；
// 脊与脊之间是沟；所有的顶都是钝的——先是一小片平顶或圆顶，往外渐渐变陡（片状剥落的光面），再成崖。
//   main        峰顶：一小片南北向的台地（亭子和天街在上面），四面是崖，北面、西面最高
//   west rib、east rib   从台地南沿伸下去的两道石壁，夹着十八盘那条山沟；东边那道一直伸成正南的支脊
//   west shoulder        西山肩：矮一截的副峰，往南伸出一道支脊——歇脚的平台和鲫鱼背在它的脊上，脊的鼻子上是松林
//   east shoulder        东山肩：另一座副峰，往东南伸一道支脊
//   north-west、north-east buttress   北面崖壁上的两道扶壁
// 登山道（climb.js）经过的地方，山让着路：路两旁一小圈削平、垫平成路基，往外是能站住的坡，不让路悬在半空或埋进山里。
import { climbRoute, climbNear, climbSectionAt, CLIMB_REACH } from './climb.js';
import { smooth, lerp, clamp } from './noise.js';

const TALUS = .72;                                                   // 崖脚碎石坡的坡度
// 每道脊：顶线 [x, z, 高]；crown 顶上平的半宽；round 从平顶到崖之间那一圈浑圆的肩有多宽；steep 崖的坡度；wall 崖有多高（再往下是碎石坡）；
// give 崖面一块块进退的幅度（乘在 land.js 给的石柱进退上）
const SPURS = [
  { name: 'main', crown: 15, round: 9, steep: 3.1, wall: 250, give: .16, line: [[0, -8, 440], [0, 40, 440]] },
  { name: 'west rib', crown: 4.5, round: 5, steep: 2.6, wall: 70, give: .08, line: [[-17, 46, 439], [-24, 80, 436], [-28, 115, 418], [-30, 150, 392], [-28, 172, 366]] },
  { name: 'east rib', crown: 6, round: 6, steep: 2.4, wall: 80, give: .1, line: [[20, 44, 439], [58, 62, 434], [72, 100, 418], [76, 140, 388], [72, 180, 352], [62, 220, 318], [52, 260, 286], [44, 300, 254], [40, 325, 234]] },
  { name: 'gully bed', crown: 24, round: 10, steep: 1.5, wall: 400, give: 0, line: [[6, 62, 430], [18, 85, 416], [22, 108, 398], [24, 125, 383], [22, 145, 368], [16, 165, 352], [8, 184, 333]] },
  { name: 'west shoulder', crown: 9, round: 7, steep: 2.7, wall: 130, give: .14, line: [[-46, 34, 398], [-86, 66, 406], [-92, 118, 372], [-88, 165, 338], [-80, 205, 304]] },
  { name: 'west spur', crown: 4.2, round: 4, steep: 2.5, wall: 90, give: .06, line: [[-80, 205, 304], [-80, 228, 300.6], [-79.2, 274, 265.9], [-79, 283, 265.5], [-82, 320, 236], [-92, 368, 206]] },
  { name: 'pine slope', crown: 34, round: 14, steep: 1.3, wall: 400, give: 0, line: [[-48, 285, 268], [-52, 330, 233.5], [-60, 372, 201.5]] },
  { name: 'east shoulder', crown: 10, round: 8, steep: 2.6, wall: 120, give: .14, line: [[50, 26, 394], [100, 60, 393], [117, 118, 353], [127, 180, 308], [127, 240, 262], [121, 292, 224]] },
  { name: 'north-west buttress', crown: 5, round: 6, steep: 2.4, wall: 150, give: .12, line: [[-9, -16, 436], [-42, -62, 348], [-72, -112, 246]] },
  { name: 'north-east buttress', crown: 5, round: 6, steep: 2.4, wall: 150, give: .12, line: [[11, -16, 436], [46, -56, 342], [82, -102, 238]] },
];
const BOX = SPURS.map(s => ({ x0: Math.min(...s.line.map(p => p[0])), x1: Math.max(...s.line.map(p => p[0])), z0: Math.min(...s.line.map(p => p[1])), z1: Math.max(...s.line.map(p => p[1])) }));
const smax = (a, b, k) => { const h = clamp(.5 + .5 * (a - b) / k); return lerp(b, a, h) + k * h * (1 - h); };

// 一道脊在 (x, z) 的高度。shift：这一块石柱的进退（负的往外凸）
function spur(s, x, z, shift) {
  let best = Infinity, top = 0;
  for (let i = 0; i + 1 < s.line.length; i++) {
    const [ax, az, ay] = s.line[i], [bx, bz, by] = s.line[i + 1], ex = bx - ax, ez = bz - az, k = clamp(((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez));
    const d = (x - ax - ex * k) ** 2 + (z - az - ez * k) ** 2;
    if (d < best) { best = d; top = lerp(ay, by, k); }
  }
  const out = Math.sqrt(best) - s.crown, d = Math.max(0, out + shift * s.give * smooth(0, 14, out));
  const fall = d < s.round ? s.steep * d * d / (2 * s.round) : s.steep * (d - s.round / 2);
  return top - (fall < s.wall ? fall : s.wall + (fall - s.wall) * TALUS / s.steep);
}

// 主峰（还没让路之前）在 (x, z) 的高度
export function peakHeight(x, z, shift) {
  let h = -1e3;
  SPURS.forEach((s, i) => {
    const b = BOX[i], reach = s.crown + s.round + (s.wall + 260) / s.steep + 60;
    if (x < b.x0 - reach || x > b.x1 + reach || z < b.z0 - reach || z > b.z1 + reach) return;
    h = smax(h, spur(s, x, z, shift), 12);
  });
  return h;
}

// 这一处算主峰的有几成（1 整个按主峰，0 整个按半山以下的南坡）。分界在西边靠南（松林里的折返还在主峰上），东边靠北（瀑布口那块崖和溪不动）
export function peakWeight(x, z) {
  const edge = lerp(372, 292, smooth(-10, 70, x));
  return smooth(edge + 24, edge - 24, z);
}

// 山怎样让着路。每一段：flat 路中线两旁这么宽以内削平、垫平到路基；ease 到这么远渐渐放回山自己的样子；
// fill 路基外侧往下垫出来的坡有多陡（山比路低的一侧不会比这个坡更低：山脊上是崖，折返的几条腿之间是陡坎）
const GIVE = {
  street: { flat: 9, ease: 20, fill: 1.1 }, gully: { flat: 6, ease: 14, fill: 1.5 }, bench: { flat: 6.5, ease: 16, fill: 2.2 }, terrace: { flat: 23, ease: 33, fill: 2 },
  ridge: { flat: 4.4, ease: 8.5, fill: 2.7 }, forest: { flat: 7, ease: 20, fill: .85 }, rejoin: { flat: 7, ease: 20, fill: .85 },
};
const BED = .8;                                                      // 路基比路面的中线低多少（路面和路缘的石头压在上面）
const A = { d: 0, y: 0, s: 0 }, B = { d: 0, y: 0, s: 0 };
// 离登山道多远（CLIMB_REACH 以外一律算 CLIMB_REACH）
export function climbAway(x, z) { return climbNear(x, z, A) ? A.d : CLIMB_REACH; }
// 把高度 h 按登山道修一遍
export function giveWay(x, z, h) {
  if (!climbNear(x, z, A, 34)) return h;
  const { length } = climbRoute(), g = GIVE[climbSectionAt(A.s).name], bed = A.y - BED, fade = smooth(length, length - 30, A.s);   // 接回旧路之前渐渐收住：往下的路两旁本来就修好了
  let floor = bed - g.fill * Math.max(0, A.d - g.flat);
  if (climbNear(x, z, B, 34, A.s)) { const q = GIVE[climbSectionAt(B.s).name]; floor = Math.max(floor, B.y - BED - q.fill * Math.max(0, B.d - q.flat)); }
  const shaped = smax(lerp(h, bed, smooth(g.ease, g.flat, A.d)), floor, 2.5);
  return lerp(h, shaped, fade);
}
