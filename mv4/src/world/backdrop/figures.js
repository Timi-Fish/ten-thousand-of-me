// 画里的点景：亭、茅屋、远寺、水榭、桥、舟、帆、人物、飞鸟；还有水纹、瀑布、题款和朱印。
// 都是小东西，用工整的细线和几块平涂的颜色画，尺寸以像素计。
import { fbm, smooth, lerp } from './util.js';
import { stroke, arcPts, dab, line, fillPoly, INK } from './brush.js';
import { mist } from './scroll.js';

const WHITE = [250, 249, 244], ROOF = [78, 86, 104], THATCH = [170, 134, 80], RED = [176, 58, 46];

// 一个翘角的屋顶：cx 中心，y 檐口的高度，half 檐口半宽，rise 屋顶高
function roof(S, cx, y, half, rise, color, snow) {
  const g = S.ink(), pts = [...arcPts([cx - half, y - rise * .12], [cx - half * .5, y + rise * .06], [cx, y], 5), ...arcPts([cx, y], [cx + half * .5, y + rise * .06], [cx + half, y - rise * .12], 5).slice(1),
    ...arcPts([cx + half, y - rise * .12], [cx + half * .35, y - rise * .45], [cx + half * .12, y - rise], 5).slice(1), [cx - half * .12, y - rise], ...arcPts([cx - half * .12, y - rise], [cx - half * .35, y - rise * .45], [cx - half, y - rise * .12], 5).slice(1)];
  fillPoly(g, pts, color, .82);
  line(g, [...pts, pts[0]], .9, INK, .8);
  if (snow) { S.opaque(); fillPoly(S.g, pts.slice(10), WHITE, .9); S.ink(); }
}
// 亭：四柱一顶，台基一线，顶上一个宝顶
export function pavilion(S, x, y, s, { color = ROOF, pillar = RED, snow = false } = {}) {
  const g = S.ink(), h = s * .5;
  for (const k of [-.42, -.14, .14, .42]) line(g, [[x + k * s, y], [x + k * s, y - h]], Math.max(1, s * .035), pillar, .85);
  line(g, [[x - s * .5, y], [x + s * .5, y]], 1.2, INK, .8); line(g, [[x - s * .44, y - h * .3], [x + s * .44, y - h * .3]], .8, INK, .6);
  roof(S, x, y - h, s * .68, s * .42, color, snow);
  dab(S.ink(), x, y - h - s * .46, s * .04, s * .06, 0, INK, .85);
}
// 茅屋：土墙、一扇门、茅草顶。snow：顶上积雪；lit：窗里亮着灯
export function hut(S, x, y, s, { snow = false, lit = false } = {}) {
  const g = S.ink(), h = s * .42;
  fillPoly(g, [[x - s * .42, y], [x + s * .42, y], [x + s * .42, y - h], [x - s * .42, y - h]], [206, 190, 160], .55);
  line(g, [[x - s * .42, y], [x - s * .42, y - h]], 1, INK, .75); line(g, [[x + s * .42, y], [x + s * .42, y - h]], 1, INK, .75); line(g, [[x - s * .5, y], [x + s * .5, y]], 1, INK, .7);
  fillPoly(g, [[x - s * .1, y], [x + s * .08, y], [x + s * .08, y - h * .7], [x - s * .1, y - h * .7]], INK, .6);
  const top = [[x - s * .6, y - h + s * .04], [x + s * .6, y - h + s * .04], [x + s * .3, y - h - s * .36], [x - s * .3, y - h - s * .36]];
  fillPoly(g, top, THATCH, .8); line(g, [...top, top[0]], .9, INK, .75);
  for (let i = 0; i < 9; i++) { const k = (i + .5) / 9; line(g, [[lerp(top[3][0], top[2][0], k), top[3][1]], [lerp(top[0][0], top[1][0], k), top[0][1]]], .6, INK, .35); }
  S.opaque();
  if (snow) fillPoly(S.g, [top[3], top[2], [x + s * .5, y - h - s * .05], [x - s * .5, y - h - s * .05]], WHITE, .92);
  if (lit) { fillPoly(S.g, [[x + s * .17, y - h * .3], [x + s * .33, y - h * .3], [x + s * .33, y - h * .72], [x + s * .17, y - h * .72]], [244, 150, 70], .95); line(S.g, [[x + s * .25, y - h * .3], [x + s * .25, y - h * .72]], .7, [120, 60, 30], .8); }
}
// 远寺：林梢露出来的两重屋顶
export function temple(S, x, y, s, { snow = false } = {}) {
  const g = S.ink();
  fillPoly(g, [[x - s * .36, y], [x + s * .36, y], [x + s * .36, y - s * .3], [x - s * .36, y - s * .3]], [200, 150, 130], .5);
  for (const k of [-.3, -.1, .1, .3]) line(g, [[x + k * s, y], [x + k * s, y - s * .3]], .9, RED, .7);
  roof(S, x, y - s * .3, s * .56, s * .26, ROOF, snow); roof(S, x, y - s * .62, s * .38, s * .24, ROOF, snow);
}
// 水榭：架在水上的敞轩，下面几根木桩，一侧接着栈道
export function waterside(S, x, y, s, side = -1) {
  const g = S.ink();
  for (const k of [-.4, -.13, .13, .4]) line(g, [[x + k * s, y], [x + k * s, y + s * .2]], 1, INK, .7);
  line(g, [[x - s * .5, y], [x + s * .5, y]], 1.4, INK, .8);
  line(g, [[x + side * s * .5, y], [x + side * s * 1.5, y - s * .02]], 1.2, INK, .7);
  for (let i = 1; i <= 4; i++) line(g, [[x + side * s * (.5 + i * .22), y], [x + side * s * (.5 + i * .22), y + s * .16]], .8, INK, .6);
  pavilion(S, x, y, s);
  line(S.ink(), [[x - s * .44, y - s * .13], [x + s * .44, y - s * .13]], .7, RED, .7);
}
// 桥：arch 为真是石拱桥，否则是架在木桩上的板桥
export function bridge(S, x0, y0, x1, y1, { arch = true, rise = 16 } = {}) {
  const g = S.ink(), mid = [(x0 + x1) / 2, (y0 + y1) / 2 - rise * 2];
  if (arch) {
    const top = arcPts([x0, y0], mid, [x1, y1], 12);
    stroke(g, top, 1.4, 1.4, INK, .8); stroke(g, top.map(([x, y]) => [x, y - 4]), .8, .8, INK, .6);
    for (const p of top) line(g, [p, [p[0], p[1] - 4]], .6, INK, .5);
    stroke(g, arcPts([lerp(x0, x1, .25), lerp(y0, y1, .25) + 2], [mid[0], mid[1] + rise * 1.3], [lerp(x0, x1, .75), lerp(y0, y1, .75) + 2], 8), 1, 1, INK, .6);
    return;
  }
  line(g, [[x0, y0], [x1, y1]], 1.6, INK, .8); line(g, [[x0, y0 - 5], [x1, y1 - 5]], .7, INK, .55);
  for (let i = 0; i <= 5; i++) { const k = i / 5, x = lerp(x0, x1, k), y = lerp(y0, y1, k); line(g, [[x, y - 5], [x, y + 7]], .9, INK, .65); }
}
// 人物：一个头、一件袍子。opts：robe 袍色；staff 拄杖；hat 斗笠；umbrella 打伞；seated 坐着
export function figure(S, x, y, s, { robe = [236, 232, 220], staff = false, hat = false, umbrella = false, seated = false, face = 1 } = {}) {
  const h = seated ? s * .62 : s;
  S.opaque();
  fillPoly(S.g, [[x - s * .2, y], [x + s * .22, y], [x + s * .1 * face, y - h * .72], [x - s * .08, y - h * .72]], robe, .95);
  dab(S.g, x + s * .02 * face, y - h * .82, s * .1, s * .11, 0, [226, 190, 160], .95);
  const g = S.ink();
  line(g, [[x - s * .2, y], [x - s * .08, y - h * .72]], .7, INK, .7); line(g, [[x + s * .22, y], [x + s * .1 * face, y - h * .72]], .7, INK, .7);
  dab(g, x + s * .02 * face, y - h * .9, s * .09, s * .05, 0, INK, .85);
  if (staff) line(g, [[x + s * .34 * face, y], [x + s * .26 * face, y - h * .95]], .8, INK, .8);
  if (hat) fillPoly(g, [[x - s * .26, y - h * .86], [x + s * .3, y - h * .86], [x + s * .02, y - h * 1.08]], THATCH, .9);
  if (umbrella) { line(g, [[x + s * .2 * face, y - h * .5], [x + s * .2 * face, y - h * 1.3]], .7, INK, .8); S.opaque(); fillPoly(S.g, arcPts([x - s * .25, y - h * 1.18], [x + s * .2 * face, y - h * 1.62], [x + s * .62, y - h * 1.18], 8), [196, 150, 84], .95); line(S.ink(), [[x - s * .25, y - h * 1.18], [x + s * .62, y - h * 1.18]], .7, INK, .7); }
}
// 舟：一弯船身，可带篷、带一个戴笠垂钓的人。s 是船长
export function boat(S, x, y, s, { awning = true, fisher = true, face = 1 } = {}) {
  const g = S.ink(), hull = [...arcPts([x - s * .5, y - s * .07], [x, y + s * .09], [x + s * .5, y - s * .09], 8), ...arcPts([x + s * .5, y - s * .09], [x, y + s * .02], [x - s * .5, y - s * .07], 8).slice(1)];
  fillPoly(g, hull, [70, 62, 62], .8); line(g, [...hull, hull[0]], .8, INK, .8);
  if (awning) { const a = arcPts([x - s * .2 * face, y - s * .03], [x - s * .04 * face, y - s * .3], [x + s * .12 * face, y - s * .03], 8); fillPoly(g, a, THATCH, .8); line(g, a, .8, INK, .7); }
  if (fisher) {
    const fx = x + s * .3 * face;
    figure(S, fx, y - s * .04, s * .26, { robe: [120, 112, 100], hat: true, seated: true, face });
    stroke(S.ink(), arcPts([fx + s * .04 * face, y - s * .14], [fx + s * .22 * face, y - s * .34], [fx + s * .4 * face, y - s * .26], 6), .9, .4, INK, .8);
    line(S.g, [[fx + s * .4 * face, y - s * .26], [fx + s * .41 * face, y + s * .08]], .45, INK, .4);
  }
  for (let i = 0; i < 3; i++) line(S.ink(), [[x - s * (.4 - i * .1), y + s * .1 + i * 3], [x + s * (.45 - i * .12), y + s * .1 + i * 3]], .7, INK, .28);
}
// 远帆：一点船身，一片帆
export function sail(S, x, y, s) {
  const g = S.ink();
  line(g, [[x - s * .5, y], [x + s * .5, y]], 1.3, INK, .6); line(g, [[x, y], [x, y - s * 1.2]], .6, INK, .6);
  fillPoly(g, [[x + 1, y - s * .15], [x + s * .5, y - s * .3], [x + 1, y - s * 1.15]], [190, 176, 150], .6);
}
// 燕子：两翅一剪尾。s 是翼展，turn 是飞的方向
export function swallow(S, x, y, s, turn = 0) {
  const g = S.ink(), c = Math.cos(turn), n = Math.sin(turn), at = (u, v) => [x + (u * c - v * n) * s, y + (u * n + v * c) * s];
  stroke(g, arcPts(at(0, 0), at(-.3, -.32), at(-.62, -.05), 5), 1.8, .4, INK, .9); stroke(g, arcPts(at(0, 0), at(.2, -.36), at(.56, -.2), 5), 1.8, .4, INK, .9);
  stroke(g, [at(0, 0), at(-.12, .3), at(-.3, .5)], 1.3, .3, INK, .9); stroke(g, [at(0, 0), at(-.02, .32), at(-.08, .58)], 1.3, .3, INK, .9);
  dab(g, ...at(.08, -.06), s * .1, s * .07, turn, INK, .9);
}
// 雁阵：一个「人」字。从 (x, y) 的头雁起，两翼向后排开
export function geese(S, rs, x, y, n, gap = 15, dir = -1) {
  const g = S.ink(), bird = (bx, by, s) => { stroke(g, arcPts([bx - s, by - s * .3], [bx - s * .4, by - s * .5], [bx, by], 4), .4, 1.4, INK, .85); stroke(g, arcPts([bx, by], [bx + s * .45, by - s * .55], [bx + s, by - s * .2], 4), 1.4, .4, INK, .85); dab(g, bx + dir * s * .25, by + s * .1, s * .28, s * .14, .2 * dir, INK, .85); };
  bird(x, y, 5.5);
  for (let i = 1; i <= n; i++) {
    bird(x - dir * i * gap + rs.range(-2, 2), y - i * gap * .55 + rs.range(-2, 2), 5.2 - i * .12);
    if (i <= n - 2) bird(x - dir * i * gap * .9 + rs.range(-2, 2), y + i * gap * .5 + rs.range(-2, 2), 5.2 - i * .12);
  }
}
// 白鹭：一身白，展着翅，拖着两条细腿。s 是翼展
export function egret(S, x, y, s, turn = 0) {
  const c = Math.cos(turn), n = Math.sin(turn), at = (u, v) => [x + (u * c - v * n) * s, y + (u * n + v * c) * s];
  S.opaque();
  stroke(S.g, arcPts(at(0, 0), at(-.25, -.3), at(-.5, -.08), 5), 2.4, .5, WHITE, .95); stroke(S.g, arcPts(at(0, 0), at(.22, -.34), at(.5, -.16), 5), 2.4, .5, WHITE, .95);
  stroke(S.g, [at(-.06, .02), at(.2, .06), at(.34, -.02)], 2, .8, WHITE, .95);
  line(S.ink(), [at(-.06, .04), at(-.34, .16)], .6, INK, .7); line(S.g, [at(.34, -.02), at(.42, -.01)], .7, [200, 150, 60], .9);
}
// 鸭：水面上的一小团，一个头，身后拖一道水痕
export function duck(S, x, y, s, face = 1) {
  S.opaque();
  dab(S.g, x, y, s, s * .5, 0, [226, 214, 192], .95); dab(S.g, x + face * s * .8, y - s * .5, s * .36, s * .34, 0, [70, 96, 78], .95);
  const g = S.ink();
  line(g, [[x + face * s * 1.1, y - s * .45], [x + face * s * 1.45, y - s * .4]], .9, [196, 140, 50], .9);
  line(g, [[x - face * s * 1.2, y + s * .3], [x - face * s * 3.2, y + s * .5]], .6, INK, .3); line(g, [[x - s, y + s * .5], [x + s, y + s * .5]], .6, INK, .35);
}
// 汀石：水里露出的几块小石头，石脚一线白水
export function stones(S, rs, x, y, n, s = 6) {
  for (let i = 0; i < n; i++) {
    const px = x + rs.range(-s * 4, s * 4), py = y + rs.range(-s, s), r = s * rs.range(.5, 1.2), g = S.ink();
    fillPoly(g, [[px - r, py], [px - r * .6, py - r * .7], [px + r * .2, py - r * .9], [px + r, py - r * .2], [px + r * .9, py]], [84, 82, 80], .7);
    line(g, [[px - r, py], [px - r * .6, py - r * .7], [px + r * .2, py - r * .9], [px + r, py - r * .2]], 1, INK, .8);
    S.opaque(); line(S.g, [[px - r * 1.2, py + 1], [px + r * 1.2, py + 1]], .9, WHITE, .7);
  }
}

// 水纹：几十道细的横波
export function ripples(S, rs, x0, x1, y0, y1, n, alpha = .3) {
  const g = S.ink();
  for (let i = 0; i < n; i++) {
    const x = lerp(x0, x1, rs()), y = lerp(y0, y1, rs()), len = rs.range(18, 60), pts = [];
    for (let k = 0; k <= 8; k++) pts.push([x + len * k / 8, y + Math.sin(k * 1.6 + i) * 1.1]);
    stroke(g, pts, .5, .5, INK, alpha * rs.range(.5, 1), .7);
  }
}
// 瀑布：沿一条折线从山间挂下来的一道白，两边是墨线，中间几丝水纹，落脚处一团水雾
export function waterfall(S, path, w0, w1, seed = 1) {
  const [top, bottom] = [path[0][1], path[path.length - 1][1]];
  const at = y => { let i = 0; while (i < path.length - 2 && path[i + 1][1] < y) i++; const k = (y - path[i][1]) / (path[i + 1][1] - path[i][1]); return lerp(path[i][0], path[i + 1][0], k); };
  S.pass(top, bottom, p => {
    const k = (p.y - top) / (bottom - top), half = lerp(w0, w1, k) / 2 * (.85 + .3 * fbm(p.y * .03, seed, 2)), u = Math.abs(p.x - at(p.y) - 3 * (fbm(p.y * .05, seed + 3, 2) - .5));
    if (u > half + 2.5) return;
    p.lift(smooth(half + 1, half - 1, u));
    p.cover(WHITE, .5 * smooth(half, half * .3, u));
    p.stain(INK, .55 * smooth(1.6, .2, Math.abs(u - half)) * (.5 + .5 * p.tooth));
    p.stain([90, 100, 120], .3 * Math.pow(1 - Math.abs(2 * fbm((p.x - at(p.y)) * .5 + seed, p.y * .02, 2) - 1), 6) * smooth(half, half * .5, u));
  });
  mist(S, bottom + 6, 16, { strength: .95, seed: seed + 5, wave: 6, x0: path[path.length - 1][0] - w1 * 1.6, x1: path[path.length - 1][0] + w1 * 1.6, soft: w1 });
}

const KAI = '"Kaiti SC", "STKaiti", "KaiTi_GB2312", "HYKaiTiJ", "KaiTi", "Songti SC", serif';
// 题款：竖写的四字题名，左边一行小字落款，款下一方朱印，题名右上角一枚引首章
export function inscribe(S, rs, { title, note, x, y, size = 46, seal = '小蟹', lead = '问月' }) {
  const g = S.ink();
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const column = (text, cx, top, px, alpha) => {
    g.font = `${px}px ${KAI}`;
    [...text].forEach((ch, i) => { g.save(); g.translate(cx + rs.range(-1, 1) * px * .03, top + i * px * 1.08); g.rotate(rs.range(-.03, .03)); g.fillStyle = `rgba(30,28,36,${alpha * rs.range(.88, 1)})`; g.fillText(ch, 0, 0); g.restore(); });
    return top + text.length * px * 1.08;
  };
  column(title, x, y, size, .92);
  const small = size * .42, nx = x - size * .92, end = column(note, nx, y + size * .5, small, .88);
  // 印：朱红的方块，白文两字；边角磨损，露出几点绢色
  const s = size * .6, sx = nx - s / 2, sy = end + small * .2;
  S.opaque();
  g.fillStyle = 'rgba(190,52,40,.9)'; g.beginPath(); g.roundRect(sx, sy, s, s, s * .08); g.fill();
  g.font = `bold ${s * .44}px ${KAI}`; g.fillStyle = 'rgba(244,232,210,.95)';
  [...seal].forEach((ch, i) => g.fillText(ch, sx + s / 2, sy + s * (.28 + .46 * i)));
  for (let i = 0; i < 22; i++) dab(g, sx + rs() * s, sy + rs() * s, rs.range(.5, 1.6), rs.range(.5, 1.3), 0, [226, 210, 178], .75);
  // 引首章：朱文，一个长圆的框
  const lw = size * .34, lh = size * .7, lx = x + size * .62, ly = y - size * .4;
  g.strokeStyle = 'rgba(190,52,40,.85)'; g.lineWidth = 1.5; g.beginPath(); g.roundRect(lx, ly, lw, lh, lw * .45); g.stroke();
  g.font = `bold ${lw * .72}px ${KAI}`; g.fillStyle = 'rgba(190,52,40,.9)';
  [...lead].forEach((ch, i) => g.fillText(ch, lx + lw / 2, ly + lh * (.29 + .42 * i)));
}
