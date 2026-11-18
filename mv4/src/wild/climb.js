// 登山道：从山顶小亭前下到小屋上方（JOIN）的这一段怎么走。只有数据和算法；地貌（land.js）照着它留出山沟和台地，路（road.js）拿它当上半段的中线。
// 走法照真山上的石阶路（泰山十八盘、华山苍龙岭、黄山的蹬道）：
//   路顺着山的弱处走——山沟、崖下的台地、山肩；陡坡上折返，把一条陡路换成几条缓路；
//   台阶一段一段的，一段十几二十级，段与段之间是平台；转向都在平台上，弯的中线半径不小于 TURN（内侧留得出 6 个单位）；
//   越靠近山顶越陡（十八盘的「紧十八」在最上面），最陡的梯段不过四十度。
// 从上到下七段（SECTIONS 里的名字）：
//   street  天街：山顶台地上一小段平街，尽头是山门（南天门）
//   gully   十八盘：门下最陡的一段，夹在两道石壁之间的山沟里，四折之字
//   bench   崖下的台地：贴着石壁脚横着走，几级一歇
//   terrace 歇脚的平台：西山肩伸出来的一块台地，有亭、有碑
//   ridge   鲫鱼背：一小段走在刀背山脊上的险路，直的、连着的台阶，两边是往下的崖
//   forest  松林里的折返：山脊的鼻子上，林子里折三折下去
//   rejoin  接回旧路
// 画法：像海龟一样一笔笔走——直走一截（多长、多陡），或者沿圆弧拐一个弯（拐多少度、半径、多陡）。朝向从正南（+z）起算，往东（+x）拐为正。
const D2R = Math.PI / 180;
export const TURN = 10;                                              // 折返的弯：中线的半径
export const START = { x: 0, z: 11, y: 440 };                        // 山顶小亭的月台南沿
export const JOIN = { x: -108, z: 398, y: 188, heading: 5.1, grade: .476 };   // 接回旧路的那一点：位置、朝向（度）、坡度都和旧路在这一点一致

// 一条腿上的梯段：n 段台阶（每段 run 长、坡度 grade），中间隔着 rest 长的平台
const flights = (n, run, grade, rest = 4.5) => Array.from({ length: 2 * n - 1 }, (_, i) => i % 2 ? ['go', rest, .02] : ['go', run, grade]);
const PLAN = [
  ['section', 'street'],
  ['go', 37, .035], ['mark', 'gate'], ['go', 5, 0],
  ['section', 'gully'],
  ['go', 12, .8], ['turn', 70, TURN, .05],
  ...flights(3, 9.5, .8), ['turn', -140, TURN, .06],
  ...flights(3, 9.5, .8), ['turn', 140, TURN, .06],
  ...flights(3, 9.5, .8), ['turn', -140, TURN, .06],
  ...flights(3, 9.5, .8),
  ['section', 'bench'],
  ['go', 16, .03], ...flights(4, 11, .7, 6), ['go', 5, .03],
  ['section', 'terrace'],
  ['mark', 'rest'], ['turn', 72, 14, 0], ['go', 4, 0],
  ['section', 'ridge'],
  ['go', 46, .76], ['go', 8, .03],
  ['section', 'forest'],
  ['turn', 62, 12, .05], ...flights(4, 10, .62), ['turn', -124, 11, .06], ...flights(5, 10, .66), ['turn', 30, 14, .05],
  ['section', 'rejoin'],
];

const STEP = .5;                                                     // 中线取样的间距（水平）
let route = null;
// 整条上半段：pts 中线的点 [{ x, y, z }]（水平间距约 STEP）；cum 每个点到起点的路程（立体的长度）；
// sections [{ name, from, to }] 各段的起止路程；marks { gate, rest } 山门、歇脚处在路程的哪里；length 全长
export function climbRoute() {
  if (route) return route;
  const pts = [{ ...START }], sections = [], marks = {};
  let x = START.x, z = START.z, y = START.y, heading = 0;
  const push = () => pts.push({ x, y, z });
  for (const [op, a, b, c] of PLAN) {
    if (op === 'section') sections.push({ name: a, i0: pts.length - 1 });
    else if (op === 'mark') marks[a] = pts.length - 1;
    else if (op === 'go') {
      const n = Math.max(1, Math.round(a / STEP)), d = a / n, sx = Math.sin(heading * D2R), sz = Math.cos(heading * D2R);
      for (let i = 0; i < n; i++) { x += sx * d; z += sz * d; y -= b * d; push(); }
    } else {
      const sign = Math.sign(a), arc = Math.abs(a) * D2R * b, n = Math.max(2, Math.round(arc / STEP)), cx = x + b * sign * Math.cos(heading * D2R), cz = z - b * sign * Math.sin(heading * D2R), h0 = heading;
      for (let i = 1; i <= n; i++) {
        heading = h0 + a * i / n;
        x = cx - b * sign * Math.cos(heading * D2R); z = cz + b * sign * Math.sin(heading * D2R); y -= c * arc / n; push();
      }
    }
  }
  // 接回旧路：一条三次曲线，两头的朝向分别是这里的朝向和旧路在 JOIN 的朝向；高度匀着降到 JOIN，末了的坡度和旧路一致
  {
    const gap = Math.hypot(JOIN.x - x, JOIN.z - z), pull = gap * .4, hx = Math.sin(heading * D2R), hz = Math.cos(heading * D2R), jx = Math.sin(JOIN.heading * D2R), jz = Math.cos(JOIN.heading * D2R);
    const P = [[x, z], [x + hx * pull, z + hz * pull], [JOIN.x - jx * pull, JOIN.z - jz * pull], [JOIN.x, JOIN.z]], n = Math.round(gap * 1.15 / STEP), y0 = y;
    for (let i = 1; i <= n; i++) {
      const t = i / n, u = 1 - t, w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
      x = P.reduce((s, p, k) => s + p[0] * w[k], 0); z = P.reduce((s, p, k) => s + p[1] * w[k], 0);
      y = y0 + (JOIN.y - y0) * t; push();
    }
  }
  const cum = new Float64Array(pts.length);
  for (let i = 1; i < pts.length; i++) cum[i] = cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y, pts[i].z - pts[i - 1].z);
  sections.forEach((s, k) => { s.from = cum[s.i0]; s.to = k + 1 < sections.length ? cum[sections[k + 1].i0] : cum[pts.length - 1]; });
  for (const name in marks) marks[name] = cum[marks[name]];
  // 找最近的点用的格子（每 COARSE 个取样点登记一个，找到以后再在它前后细找）
  const buckets = new Map();
  for (let i = 0; i < pts.length; i += COARSE) { const k = Math.floor(pts[i].x / CELL) * 4096 + Math.floor(pts[i].z / CELL); if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push(i); }
  route = { pts, cum, sections, marks, length: cum[pts.length - 1], buckets };
  return route;
}

// 某一段的起止路程
export function climbSection(name) { return climbRoute().sections.find(s => s.name === name); }
// 路程 s 处在哪一段
export function climbSectionAt(s) { const { sections } = climbRoute(); return sections.find(sec => s < sec.to) ?? sections[sections.length - 1]; }

const CELL = 24, COARSE = 4;
export const CLIMB_REACH = 2 * CELL;                                 // climbNear 最远能找到这么远
// 离 (x, z) 最近的登山道中线点，写进 out：d 水平距离，y 那一点的高度，s 路程。reach（不超过 CLIMB_REACH）以外没有就返回 null。
// apart：只找路程和它相差 APART 以上的点（折返处另一条腿上最近的点）
const APART = 45;
export function climbNear(x, z, out, reach = CLIMB_REACH, apart = -1) {
  const { pts, cum, buckets } = climbRoute(), cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
  let best = -1, bd = reach * reach;
  for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) {
    const list = buckets.get((cx + a) * 4096 + cz + b);
    if (list) for (const i of list) {
      if (apart >= 0 && Math.abs(cum[i] - apart) < APART) continue;
      const d = (pts[i].x - x) ** 2 + (pts[i].z - z) ** 2;
      if (d < bd + 8 * Math.sqrt(bd) + 16) for (let j = Math.max(0, i - COARSE + 1); j < Math.min(pts.length, i + COARSE); j++) { const e = (pts[j].x - x) ** 2 + (pts[j].z - z) ** 2; if (e < bd) { bd = e; best = j; } }
    }
  }
  if (best < 0) return null;
  out.d = Math.sqrt(bd); out.y = pts[best].y; out.s = cum[best];
  return out;
}
