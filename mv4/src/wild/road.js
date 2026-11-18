// 山路的走向和路面的高度（只有数据和算法，网格在 roadmesh.js）。
// 路从山顶小亭前出发，分两大段：
//   上半段（登山道，climb.js）：山顶的天街、山门、十八盘、崖下的台地、歇脚的平台、鲫鱼背、松林里的折返，下到小屋上方的接点 JOIN；
//   下半段：从 JOIN 起在山坡上折一个弯，过一座桥到溪的东岸，绕几个弯到湖边，沿湖岸走到尽头。
// 陡的路段做成石阶：每级高 RISER，把平滑的坡面量化成一级一级；缓的路段是坡道；两者之间渐变。
// 里程：路边成排的东西（石灯、路碑、栏杆柱、灌木…）按里程 mile 排，JOIN 的里程定死在 MILE_AT_JOIN，
//   所以下半段每样东西的位置不随上半段的长短变；上半段的里程从 JOIN 往上山倒着数。
import * as THREE from 'three';
import { smooth, lerp, clamp } from './noise.js';
import { climbRoute, JOIN } from './climb.js';

export const HALF = 3.4, CURB = .5, RISER = .36;                     // 路面半宽（铺石的部分，全宽 6.8）、路缘石宽、石阶每级的高
const STEP = .5;                                                     // 中线取样的间距
const MILE_AT_JOIN = 521.9;
export const RIDGE_END = 285;                                        // 主峰的石头山到 z = 285 为止（鲫鱼背的下端），往南是长林子的山坡
// 下半段的控制点 [x, z, y]，从 JOIN 到山脚。LEAD 在 JOIN 的上山一侧，只用来定 JOIN 以下那一段曲线的弯法（路不经过它）
const BRIDGE_A = [40, 446, 167], BRIDGE_B = [80, 450, 167];          // 桥的两头
const LEAD = [-94, 372, 201];
const WAY = [
  LEAD, [JOIN.x, JOIN.z, JOIN.y], [-92, 420, 178], [-50, 432, 174], [0, 440, 171], BRIDGE_A, BRIDGE_B,
  [112, 462, 158], [140, 488, 142], [150, 522, 126], [140, 556, 110], [116, 584, 98], [100, 616, 84], [108, 650, 67], [134, 676, 54], [170, 694, 44], [200, 718, 31],
  [202, 746, 18], [180, 766, 10], [144, 778, 7], [104, 786, 4.8], [62, 794, 3.4], [22, 802, 3.1], [-10, 812, 3],
];
// 溪：从崖顶的瀑布口跌进潭里，穿过桥下，向西南流进湖。[x, z, 水面高]
export const CREEK = [[98, 330, 238], [88, 350, 232], [82, 378, 180], [72, 410, 170], [60, 448, 155], [48, 480, 146], [28, 522, 126], [0, 570, 104], [-28, 628, 76], [-48, 690, 48], [-58, 750, 21], [-56, 790, 3], [-52, 826, -.6]];
export const FALL = { lip: 1, pool: 2 };                             // CREEK 里瀑布口和潭的下标

export function buildRoad() {
  // 整条中线的折线：上半段照登山道，下半段是过控制点的曲线（从 JOIN 那个控制点起）；再按路程等距重新取样
  const climb = climbRoute(), lower = new THREE.CatmullRomCurve3(WAY.map(([x, z, y]) => new THREE.Vector3(x, y, z)), false, 'centripetal');
  const line = climb.pts.map(p => new THREE.Vector3(p.x, p.y, p.z)), t0 = 1 / (WAY.length - 1), FINE = 12000;
  for (let i = 1; i <= FINE; i++) line.push(lower.getPoint(t0 + (1 - t0) * i / FINE));
  const run = new Float64Array(line.length);
  for (let i = 1; i < line.length; i++) run[i] = run[i - 1] + line[i].distanceTo(line[i - 1]);
  const length = run[line.length - 1], n = Math.ceil(length / STEP), ds = length / n, pts = [];
  for (let i = 0, j = 0; i <= n; i++) {
    const s = Math.min(i * ds, length);
    while (j < line.length - 2 && run[j + 1] < s) j++;
    pts.push(new THREE.Vector3().lerpVectors(line[j], line[j + 1], (s - run[j]) / (run[j + 1] - run[j])));
  }
  for (let i = 1; i <= n; i++) pts[i].y = Math.min(pts[i].y, pts[i - 1].y);                 // 一路只下不上
  // 上半段各段的起止、山门和歇脚处的位置（路程），上半段到哪里为止，里程和路程差多少
  const upper = run[climb.pts.length - 1], sections = climb.sections.map(({ name, from, to }) => ({ name, from, to })), marks = { ...climb.marks }, mileShift = upper - MILE_AT_JOIN;
  const sectionAt = s => s >= upper ? 'slope' : (sections.find(sec => s < sec.to) ?? sections[sections.length - 1]).name;
  // 桥的起止（弧长）：离两个控制点最近的取样点
  const nearest = ([x, z]) => { let best = 0; pts.forEach((p, i) => { if (Math.hypot(p.x - x, p.z - z) < Math.hypot(pts[best].x - x, pts[best].z - z)) best = i; }); return best * ds; };
  const bridge = { s0: nearest(BRIDGE_A), s1: nearest(BRIDGE_B), hump: 2.4 };
  // 每个取样点的坡度（前后各看 3 个单位），和「有几成是石阶」
  const span = Math.round(3 / ds), steps = new Float32Array(n + 1);
  for (let i = 0; i <= n; i++) {
    const a = pts[Math.max(0, i - span)], b = pts[Math.min(n, i + span)], grade = (a.y - b.y) / Math.hypot(b.x - a.x, b.z - a.z);
    steps[i] = smooth(.1, .17, grade);
  }

  // 平滑的中线：位置、切向
  const at0 = (s, out) => { const f = clamp(s / ds, 0, n - 1e-6), i = Math.floor(f); return out.lerpVectors(pts[i], pts[i + 1], f - i); };
  const tangent = (s, out) => { const i = Math.min(n - 1, Math.floor(clamp(s / ds, 0, n))); return out.subVectors(pts[Math.min(n, i + 2)], pts[Math.max(0, i - 1)]).normalize(); };
  const right = (s, out) => { tangent(s, out); const len = Math.hypot(out.x, out.z); return out.set(-out.z / len, 0, out.x / len); };   // 面朝下山方向时的右手边（水平）
  const stepsAt = s => { const f = clamp(s / ds, 0, n - 1e-6), i = Math.floor(f); return lerp(steps[i], steps[i + 1], f - i); };
  const onBridge = s => smooth(bridge.s0 - 1, bridge.s0 + 1, s) * smooth(bridge.s1 + 1, bridge.s1 - 1, s);
  const humpAt = s => bridge.hump * Math.sin(Math.PI * clamp((s - bridge.s0 + 3) / (bridge.s1 - bridge.s0 + 6))) ** 2;   // 拱桥中间高起一点
  const tmp = new THREE.Vector3();
  // 路面的真实高度：坡道处就是中线高度，石阶处量化成一级一级
  const surface = s => {
    const y = at0(s, tmp).y, k = stepsAt(s);
    return lerp(y, RISER * Math.round(y / RISER), k) + humpAt(s);
  };

  // 找离 (x, z) 最近的中线点。取样点按 12 个单位的格子分桶，只查周围九格
  const CELL = 12, buckets = new Map(), key = (cx, cz) => cx * 4096 + cz;
  for (let i = 0; i <= n; i += 2) {
    const k = key(Math.floor(pts[i].x / CELL), Math.floor(pts[i].z / CELL));
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(i);
  }
  // 返回 { s 弧长, d 离中线的水平距离, side 在下山方向的左(-1)还是右(+1) }；周围九格里没有路就返回 null
  function locate(x, z) {
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    let best = -1, bd = Infinity;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const list = buckets.get(key(cx + a, cz + b));
      if (list) for (const i of list) { const d = (pts[i].x - x) ** 2 + (pts[i].z - z) ** 2; if (d < bd) { bd = d; best = i; } }
    }
    if (best < 0) return null;
    // 在最近取样点前后的折线段上求垂足
    let s = best * ds, d = Math.sqrt(bd), side = 1;
    for (let i = Math.max(0, best - 2); i < Math.min(n, best + 2); i++) {
      const p = pts[i], q = pts[i + 1], ex = q.x - p.x, ez = q.z - p.z, k = clamp(((x - p.x) * ex + (z - p.z) * ez) / (ex * ex + ez * ez));
      const px = p.x + ex * k, pz = p.z + ez * k, dist = Math.hypot(x - px, z - pz);
      if (dist <= d) { d = dist; s = (i + k) * ds; side = ex * (z - pz) - ez * (x - px) > 0 ? 1 : -1; }
    }
    return { s, d, side };
  }

  return {
    length, ds, n, pts, bridge, CELL,
    // 上半段（登山道）：upper 到哪里为止（路程）；sections 各段 [{ name, from, to }]；sectionAt(s) 这一处是哪一段（下半段一律是 'slope'）；marks 山门（gate）、歇脚处（rest）的路程
    upper, sections, sectionAt, marks,
    section: name => sections.find(sec => sec.name === name),
    // 里程和路程互换；miles(first, step, from, to)：里程 first + k·step（k 取遍整数）落在路程 [from, to) 里的那些，依次给出 { s, k }
    mile: s => s - mileShift, fromMile: m => m + mileShift,
    miles(first, step, from = 0, to = length) {
      const out = [];
      for (let k = Math.ceil((from - mileShift - first) / step - 1e-9); first + k * step + mileShift < to; k++) out.push({ s: first + k * step + mileShift, k });
      return out;
    },
    at0, tangent, right, stepsAt, onBridge, humpAt, surface, locate,
    // 对外的接口：u 从 0（山顶小亭）到 1（山脚）
    at(u) { const s = clamp(u) * length, p = at0(s, new THREE.Vector3()); p.y = surface(s); return p; },
    dir(u) { return tangent(clamp(u) * length, new THREE.Vector3()); },
  };
}

// 溪的中线：加密成折线。每个点带上水面高度，以及这一段是不是瀑布
export function buildCreek() {
  const curve = new THREE.CatmullRomCurve3(CREEK.map(([x, z, y]) => new THREE.Vector3(x, y, z)), false, 'centripetal');
  curve.arcLengthDivisions = 2000;
  const n = Math.ceil(curve.getLength() / 1.5), pts = curve.getSpacedPoints(n);
  for (let i = 1; i <= n; i++) pts[i].y = Math.min(pts[i].y, pts[i - 1].y);
  const lip = CREEK[FALL.lip], pool = CREEK[FALL.pool];
  const near = ([x, z]) => { let best = 0; pts.forEach((p, i) => { if (Math.hypot(p.x - x, p.z - z) < Math.hypot(pts[best].x - x, pts[best].z - z)) best = i; }); return best; };
  return { pts, n, lip: near(lip), pool: near(pool) };
}
