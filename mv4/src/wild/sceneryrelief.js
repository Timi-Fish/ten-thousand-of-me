// 大远景里的山形：在天然地貌（land.js）上把抱湖的两臂山梁、谷底和湖再雕一遍，从山上往下看时群山一层层分得开。
//   支脊——山梁上伸下来一道道山脊，疏密、长短都不匀（有的地方挤着两三道短的，有的地方一道长脊一直探到湖边，把后面的侧谷挡成第二重），
//         脊线有起伏、有鞍部，脊头收成一截陡的山嘴；主脊半腰再分出一两道小支脊；脊的两肋顺坡排着一道道冲沟。脊与脊之间自然是侧谷。
//   山梁——梁上的结那里各拔起一丛石峰（主柱带副柱，四壁直上直下，顶是钝的），成组地长，组与组之间空着；几处塌下去一个垭口，
//         其中三个低过云海，云从那里翻进来（outland.js 的 cloudFall）；梁内侧的长坡上满是顺坡而下的冲沟。
//   谷底——几座孤山（一座顶上立塔），缓处起伏；湖往南、往西撑开，岸线一进一出，西南拐进去一道湖汊，岸边一圈浅滩，湖里几个小洲。
//   台地——谷底缓坡上一片片梯田：地面一级一级地收成台，台面平、台壁陡（着色器按同一个函数画田埂和水面）。
//   溪——从几条侧谷的谷头起，顺着地势流到湖里，沿路往下挖出一道浅的水道；湖水从南面的水口流出去（sceneryexit.js）。
//   古道——沿出水的溪往山外去的石板路，路基压平（sceneryexit.js）。
// 只改离路、溪、建筑和近景机位都远的地方：离路中线 KEEP.road[0] 以内一丝不动（山梁按修路时那一圈规整的算，见 ranges.js 的 ROUND），
// 到 KEEP.road[1] 才完全按新的山形。主峰和山脊石阶那一带（z < 340）不动。
import { vnoise, fbm, ridged, smooth, lerp, clamp } from './noise.js';
import { landHeight } from './land.js';
import { ROUND } from './ranges.js';
import { buildKeep, nearSummit } from './scenerykeep.js';
import { traceStreams } from './scenerystreams.js';
import { traceOutlet, planExitRoad } from './sceneryexit.js';
import { D2R, polar, fromPolar, southOf, crestR, crestH, crestWidth, mouthOpen, KNOLLS, ISLES, TERRACE, fieldMask, lakeDepth } from './scenerymap.js';

const smax = (a, b, k) => { const h = clamp(.5 + .5 * (a - b) / k); return lerp(b, a, h) + k * h * (1 - h); };
const smin = (a, b, k) => -smax(-a, -b, k);
// 支脊：[方位°, 伸进来多长, 一路往哪边弯（°）, 脊头多高, 两肋多陡, 鞍部在哪（0 到 1）, 分出的小支脊 [从哪, 朝哪边偏（°）, 多长（占主脊几成）]…]
const SPURS = [
  [52, 120, -12, 70, .55, .5, []],
  [66, 230, 14, 44, .46, .58, [[.35, -58, .4], [.62, 64, .32]]],
  [88, 150, -10, 58, .52, .4, [[.45, 62, .42]]],
  [104, 185, 12, 48, .48, .55, [[.4, -60, .4]]],
  [128, 200, -14, 40, .45, .62, [[.32, 60, .4], [.6, -56, .34]]],
  [144, 140, 10, 54, .52, .45, [[.5, -62, .4]]],
  [158, 100, 8, 42, .55, .5, []],
  [205, 110, -8, 44, .55, .5, []],
  [218, 240, -12, 36, .44, .6, [[.34, 62, .4], [.6, -58, .32]]],
  [236, 150, 12, 56, .5, .42, [[.45, -64, .42]]],
  [250, 100, -10, 52, .55, .5, []],
  [266, 250, 6, 60, .45, .64, [[.36, 60, .38], [.62, -60, .3]]],
  [284, 140, -14, 56, .52, .45, [[.42, 62, .4]]],
  [300, 190, 10, 46, .48, .5, [[.4, -60, .44]]],
  [318, 125, -10, 66, .54, .5, []],
  [334, 110, 8, 72, .55, .5, []],
];
// 山梁上的石峰：[方位°, 比脊线往外多远, 比脊线高多少, 主柱半径, 顶收多少（0 平顶，1 钝的圆顶）]。一个结上一高一矮两丛挨着，结与结之间没有
//   东面 60° 到 125° 只有矮的：「整座山」那个机位从东面越过山梁看主峰，高的会挡在镜头前；
//   西北 295° 到 335° 不立石峰：春天「纸绕着整座山」的镜头越过西臂的根朝主峰看，石峰会挡在镜头前
const PEAKS = [[54, 4, 40, 46, .8], [62, -14, 16, 32, .6], [97, 6, 16, 36, .5], [133, 0, 50, 52, .9], [140, 22, 20, 34, .6], [158, 4, 22, 30, .6],
  [217, 6, 56, 54, .95], [225, -18, 24, 36, .7], [276, 2, 42, 48, .85], [284, 20, 14, 30, .5], [291, 8, 46, 44, .85]];
// 垭口：[方位°, 塌下去多深, 多宽, 最低到多高]。76°、112°、257° 三个低过云海的顶，外面又正对着完整的云海，是云瀑的口子
const NOTCHES = [[76, 46, 40, 104], [112, 44, 36, 104], [146, 30, 40, 118], [238, 30, 36, 118], [257, 12, 46, 96], [300, 42, 38, 134]];

// 方位 phi 处于两道支脊之间的哪里：谷心 1，脊上 0。两道支脊隔得太远（北面主峰那一侧）就没有侧谷
const ROOTS = SPURS.map(s => s[0]).sort((a, b) => a - b);
function spurValley(phi) {
  const deg = ((phi / D2R) % 360 + 360) % 360;
  for (let i = 0; i < ROOTS.length - 1; i++) {
    const a = ROOTS[i], b = ROOTS[i + 1];
    if (deg >= a && deg < b) return b - a > 45 ? 0 : Math.sin(Math.PI * (deg - a) / (b - a)) ** 2 * (.7 + .6 * vnoise(i * 3.7, 1.3));
  }
  return 0;
}

// 一道脊的中线：一串点 { x, z, top 脊线高, t 走了几成 }
function ridgeLine(x0, z0, dir, len, bend, hs, he, saddle, seed, n = 16) {
  const pts = [];
  let a = dir, x = x0, z = z0;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const top = he + (hs - he) * (1 - t) ** 1.25 + 14 * (vnoise(t * 4.3 + seed * 7.1, seed * 3.3) - .5) - 18 * Math.exp(-(((t - saddle) / .06) ** 2));
    pts.push({ x, z, top, t });
    a += bend / n; x += Math.sin(a) * len / n; z -= Math.cos(a) * len / n;
  }
  return pts;
}
function makeSpurs() {
  const list = [];
  SPURS.forEach(([deg, len, bend, nose, steep, saddle, subs], k) => {
    const phi = deg * D2R, R = crestR(phi) + 2, [x0, z0] = fromPolar(phi, R), hs = crestH(phi) + 4;
    const main = ridgeLine(x0, z0, phi + Math.PI, len, bend * D2R, hs, nose, saddle, k + 1);
    list.push({ pts: main, steep, seed: k * 3.7 + .4, len });
    for (const [at, turn, frac] of subs) {
      const i = Math.round(at * 16), p = main[i], q = main[Math.min(16, i + 1)], heading = Math.atan2(q.x - p.x, -(q.z - p.z)) + turn * D2R;
      list.push({ pts: ridgeLine(p.x, p.z, heading, len * frac, -turn * .25 * D2R, p.top - 4, nose * .7, .5, k * 5.1 + at, 8), steep: steep * 1.15, seed: k * 7.3 + at * 3, len: len * frac });
    }
  });
  for (const s of list) {
    const reach = (s.pts[0].top / (s.steep * .5)) ** .8 + 10;
    s.box = s.pts.reduce((b, p) => [Math.min(b[0], p.x - reach), Math.max(b[1], p.x + reach), Math.min(b[2], p.z - reach), Math.max(b[3], p.z + reach)], [Infinity, -Infinity, Infinity, -Infinity]);
  }
  return list;
}

// 离一道脊的中线多远：d 水平距离，top 那一处的脊线高，t 走了几成，cap 是不是已经出了脊头
const NEAREST = { d: 0, top: 0, t: 0, cap: 0 };
function nearest(pts, x, z) {
  let bd = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], ex = b.x - a.x, ez = b.z - a.z, L = ex * ex + ez * ez, k = clamp(((x - a.x) * ex + (z - a.z) * ez) / L);
    const d = (x - a.x - ex * k) ** 2 + (z - a.z - ez * k) ** 2;
    if (d < bd) { bd = d; NEAREST.top = lerp(a.top, b.top, k); NEAREST.t = lerp(a.t, b.t, k); NEAREST.cap = i === pts.length - 2 && k >= 1 ? 1 : 0; }
  }
  NEAREST.d = Math.sqrt(bd);
  return NEAREST;
}

// 一丛石柱（山梁上的石峰、孤山的崖）：主柱加一两根矮一截的副柱。返回这丛柱子在 (x, z) 的高度
function pillarCluster(cx, cz, top, r, sharp, seed, x, z) {
  let h = 0;
  const turn = seed * 2.3;
  const cols = [[cx, cz, top, r, sharp], [cx + Math.cos(turn) * r * .85, cz + Math.sin(turn) * r * .85, top * .8, r * .6, Math.min(1, sharp + .2)], [cx - Math.cos(turn + .9) * r * .95, cz - Math.sin(turn + .9) * r * .95, top * .66, r * .5, .9], [cx + Math.cos(turn + 2.4) * r * 1.2, cz + Math.sin(turn + 2.4) * r * 1.2, top * .55, r * .42, .6]];
  for (const [px, pz, pt, pr, ps] of cols) {
    const d = Math.hypot(x - px, z - pz);
    if (d > pr * 3.4) continue;
    const girth = pr * (.75 + .55 * fbm(x / 26 + px, z / 26 + pz, 2)), q = d / girth, wall = 1 - smooth(.56, 1.14, q);
    h = Math.max(h, pt * (.86 * wall * (1 - .36 * ps * smooth(.1, 1.05, q)) + .14 * Math.exp(-q * q / 2.4)));   // 顶是钝的圆顶，不收成尖
  }
  return h;
}

export function buildRelief(road, creek, pads, shots) {
  const spurs = makeSpurs(), keep = buildKeep(road, creek, pads, shots);
  // 新的山形（还没挖溪）。h0：天然地貌的高度
  function shape(x, z, h0) {
    const { phi, rho } = polar(x, z), R = crestR(phi), away = rho - R, south = southOf(phi);
    const off = away < 0 ? away * 215 / crestWidth(phi) : away;                              // 内坡宽窄不一：按「内坡宽 215」折算，下面的分带才对得上
    let h = h0;
    const slopeZone = smooth(-235, -170, off) * smooth(10, -25, off) * smooth(.02, .12, south) * (1 - mouthOpen(phi));
    if (slopeZone > 0) {
      // 侧谷：两道支脊之间，梁内侧的坡整片往下沉，谷心最深，往上收到脊线、往下收到谷底
      // 冲沟：顺坡往下、一路分叉的沟（脊状噪声的反面），沟的走向被扭得弯弯曲曲
      const k = spurValley(phi), u = phi * R, wu = u + 40 * (fbm(u / 120 + 3.3, off / 120 + 1.1, 3) - .5), wv = off + 25 * (fbm(u / 90 + 7.1, off / 90 + 4.4, 2) - .5);
      const net = ridged(wu / 70 + 7.7, wv / 150 + 2.9, 4), fine = 1 - Math.abs(2 * vnoise(wu / 16 + 1.3, wv / 70 + 5.1) - 1);
      const cut = 46 * k * smooth(-5, -60, off) * smooth(-250, -170, off) * smooth(.02, .12, south) + (14 * net ** 2.2 + 3.5 * fine ** 4) * slopeZone;
      h = Math.max(h - cut, Math.min(h, 9 + .1 * Math.max(0, off + 260)));                 // 谷挖不到谷底以下（谷底不积水）
    }
    // 垭口（各有各的最低高度）
    for (const [deg, depth, w, low] of NOTCHES) {
      let da = Math.abs(phi - deg * D2R); da = Math.min(da, 2 * Math.PI - da);
      const arc = da * rho;
      if (arc < w * 3) h = Math.max(h - depth * Math.exp(-((arc / w) ** 2)) * Math.exp(-((away / 95) ** 2)), Math.min(h, low));
    }
    // 谷底缓缓地起伏
    const floor = smooth(-185, -240, off) * smooth(560, 640, z);
    h += 9 * (fbm(x / 95 + 21.3, z / 95 + 5.7, 3) - .45) * floor * smooth(2, 10, h);
    // 支脊
    for (const s of spurs) {
      if (x < s.box[0] || x > s.box[1] || z < s.box[2] || z > s.box[3]) continue;
      const n = nearest(s.pts, x, z), nose = n.cap ? 1 : smooth(.82, 1, n.t), along = n.t * s.len;
      const rib = 8 * (1 - Math.abs(Math.sin(Math.PI * (along / 31 + .5 * fbm(x / 40 + s.seed, z / 40, 2) + s.seed)))) ** 3 * smooth(6, 26, n.d);
      const ridge = n.top - s.steep * (1 + 1.5 * nose) * (Math.sqrt(n.d * n.d + 64) - 8) ** 1.25 - rib + 6 * (fbm(x / 22 + s.seed, z / 22 - s.seed, 2) - .5) * smooth(4, 20, n.d);   // 脊顶是圆的
      h = smax(h, ridge, 12);
    }
    // 山梁上的石峰
    for (const [deg, out, extra, r, sharp] of PEAKS) {
      const p = deg * D2R, [cx, cz] = fromPolar(p, crestR(p) + out);
      if (Math.abs(x - cx) > r * 3.6 || Math.abs(z - cz) > r * 3.6) continue;
      h = smax(h, pillarCluster(cx, cz, crestH(p) + extra, r, sharp, deg, x, z), 9);
    }
    // 孤山：一面是崖，三面是缓坡
    for (const [kx, kz, r, top, cliff] of KNOLLS) {
      const d = Math.hypot(x - kx, z - kz);
      if (d > r * 3.2) continue;
      const toward = Math.cos(Math.atan2(x - kx, -(z - kz)) - cliff * D2R), q = d / (r * (1 + .25 * (fbm(x / 20 + kx, z / 20 + kz, 2) - .5)));
      const soft = top * Math.max(0, 1 - q * q / 4) ** 1.6, hard = top * (1 - smooth(.7, 1.05, q)) * (.92 + .08 * Math.cos(q * 6));
      h = smax(h, lerp(soft, Math.max(soft * .6, hard), smooth(.1, .7, toward)), 8);
    }
    // 湖：往南往西撑开，岸边一圈浅滩，中间深
    const s = lakeDepth(x, z);
    if (s > -.4) {
      // 岸上：离岸越远，地面让出来的越少（到 s = -0.4 完全不动）
      const shelf = .1 + .08 * fbm(x / 60 + 9.1, z / 60 + 3.7, 2), bed = s > 0 ? lerp(-1.3, -13, smooth(shelf, shelf + .25, s)) : 1.1 - s * 30 + 600 * smooth(-.15, -.4, s);
      h = smin(h, bed, 3);
    }
    // 小洲
    for (const [ix, iz, r, top] of ISLES) {
      const d = Math.hypot(x - ix, z - iz) / (r * (1 + .3 * (fbm(x / 9 + ix, z / 9, 2) - .5)));
      if (d < 2.5) h = smax(h, top * Math.max(0, 1 - d * d / 2.2) ** 1.4 - 2.5 * smooth(.6, 1.6, d), 3);
    }
    // 梯田：一级一级收成台
    const field = fieldMask(x, z, h);
    if (field > 0) { const v = h / TERRACE, f = v - Math.floor(v); h = lerp(h, (Math.floor(v) + smooth(.78, 1, f)) * TERRACE, field); }
    return h;
  }
  // 一处的高度：离路近按修路时的地貌，离路远按新的山形，之间渐变。made：新的山形在这一处怎么算
  const blend = (x, z, made) => { const w = keep.weight(x, z); return w <= 0 ? landHeight(x, z, ROUND) : w >= 1 ? made(x, z) : lerp(landHeight(x, z, ROUND), made(x, z), w); };
  const bare = (x, z) => shape(x, z, landHeight(x, z));
  const outlet = traceOutlet((x, z) => blend(x, z, bare)), streams = traceStreams((x, z) => blend(x, z, bare), keep, road, outlet);
  const cut = (x, z) => streams.carve(x, z, bare(x, z)), exit = planExitRoad((x, z) => blend(x, z, cut));
  const made = (x, z) => exit.grade(x, z, cut(x, z));
  return {
    spurs, keep, streams, exit: exit.pts,
    // 崖壁上的竖槽：陡处（坡度过了四十来度）按水平面上的脊状噪声往里刻——在直立的崖面上，水平面上的花纹就成了一根根竖的石柱和石缝，
    // 山的轮廓线跟着一进一出。直接改格网上的高度（g：格网的起点、格距、点数），陡不陡按改之前相邻格点的高差算
    flute(H, g) {
      const src = H.slice();
      for (let j = 1; j < g.nz - 1; j++) for (let i = 1; i < g.nx - 1; i++) {
        const k = j * g.nx + i, grade = Math.hypot(src[k + 1] - src[k - 1], src[k + g.nx] - src[k - g.nx]) / (2 * g.cell), steep = smooth(.9, 2.2, grade);
        if (steep <= 0 || src[k] < 25) continue;
        const x = g.x0 + i * g.cell, z = g.z0 + j * g.cell, c = keep.cliff(x, z);
        if (c <= 0) continue;
        const col = ridged(x / 23 + 4.1, z / 23 + 8.3, 3), chip = vnoise(x / 7.5 + 2.2, z / 7.5 + 6.6);
        H[k] -= (11 * col * col + 3.5 * chip) * steep * c * smooth(25, 60, src[k]) * (1 + .9 * nearSummit(x, z));   // 主峰顶上的绝壁刻得更深

      }
    },
    // 这一处有几成是梯田（着色器画田埂、田面用）
    field: (x, z, h) => fieldMask(x, z, h) * keep.weight(x, z),
    // 最终的高度：新的山形，挖出溪的水道，压平古道的路基
    at: (x, z) => blend(x, z, made),
  };
}
