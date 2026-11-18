// 身体的造型：一块设计过的软方块。横截面是圆角方，纵向是圆润的底、微拱的顶，最宽处偏低，肚子略往前鼓。
// 这里只管「没变形时长什么样」；衣服、腰封都贴着这个表面生成（surf），所以身体改造型它们会跟着走。
import { clamp } from '../anim.js';
import { BW, BH, BD } from './pose.js';

const NX = 3.5;                                    // 横截面有多方：2 是椭圆，越大越方
const YC = .62, MB = 2.8, MT = 3.9;                // 最宽处的高度；底、顶的圆润程度（越小越圆）
const TAPER = .045, BELLY = .05, BELLY_Y = .45;    // 顶比底窄多少；肚子往前多鼓多少、鼓在哪个高度
const sp = (v, e) => Math.sign(v) * Math.abs(v) ** e;
const smooth = k => { k = clamp(k); return k * k * (3 - 2 * k); };

// 一条曲线按弧长查表：at(i/N) 给出曲线上的点，返回 find(k)：走到全长的 k 处时参数是多少
function byLength(N, at) {
  const len = [0];
  for (let i = 1; i <= N; i++) { const p = at((i - 1) / N), q = at(i / N); len.push(len[i - 1] + Math.hypot(q[0] - p[0], q[1] - p[1])); }
  const find = k => {
    const want = clamp(k) * len[N];
    let lo = 0, hi = N;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (len[mid] <= want) lo = mid; else hi = mid; }
    return (lo + (want - len[lo]) / (len[hi] - len[lo])) / N;
  };
  return { find, total: len[N] };
}

// 横截面的一圈：u 从 0 到 1 按弧长均匀走，0 在正面正中，先往 +x（画面右）绕
const loop = a => [BW / 2 * sp(Math.sin(a * 2 * Math.PI), 2 / NX), BD / 2 * sp(Math.cos(a * 2 * Math.PI), 2 / NX)];
const RING = byLength(4096, loop);
export const PERIM = RING.total;                   // 最宽处一圈的周长
const ring = u => loop(RING.find(u - Math.floor(u)));

// 高度 y 处的横向比例：最宽处是 1，往底和顶收到 0
function girth(y) {
  const up = y > YC, k = clamp(up ? (y - YC) / (BH - YC) : (YC - y) / YC), m = up ? MT : MB;
  return (1 - k ** m) ** (1 / m) * (1 - TAPER * (up ? smooth(k) : 0));
}
// 纵向轮廓按弧长均匀走：v 从 0（底的正中）到 1（顶的正中），返回高度
const side = a => { const s = Math.sin((a - .5) * Math.PI), k = Math.abs(s) ** (2 / (s > 0 ? MT : MB)), y = s > 0 ? YC + (BH - YC) * k : YC - YC * k; return [girth(y) * (BW + BD) / 4, y]; };
const SPINE = byLength(4096, side);
export const rowY = v => side(SPINE.find(v))[1];

// 身体表面上的点：绕到 u、高度 y
export function point(u, y) {
  const [x, z] = ring(u), g = girth(y), belly = 1 + BELLY * Math.max(0, z / (BD / 2)) * Math.exp(-(((y - BELLY_Y) / .38) ** 2));
  return [x * g, y, z * g * belly];
}
// 表面上的点再沿法线往外抬 t：衣服、绳子用它贴在身上。返回 [x, y, z]
export function surf(u, y, t = 0) {
  const p = point(u, y);
  if (!t) return p;
  const e = 2e-3, y0 = clamp(y - e, 1e-3, BH - 1e-3), y1 = clamp(y + e, 1e-3, BH - 1e-3);
  const a = point(u - e, y), b = point(u + e, y), c = point(u, y0), d = point(u, y1);
  const du = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], dv = [d[0] - c[0], d[1] - c[1], d[2] - c[2]];
  const n = [du[1] * dv[2] - du[2] * dv[1], du[2] * dv[0] - du[0] * dv[2], du[0] * dv[1] - du[1] * dv[0]], len = Math.hypot(...n);
  return [p[0] + n[0] / len * t, p[1] + n[1] / len * t, p[2] + n[2] / len * t];
}
// 头顶在 (x, z) 处比正中矮多少（头饰贴着头顶摆时用；不算肚子和收窄，差不了多少）
export function dip(x, z) {
  const g = (Math.abs(x / (BW / 2)) ** NX + Math.abs(z / (BD / 2)) ** NX) ** (1 / NX);
  return (BH - YC) * (1 - (1 - clamp(g) ** MT) ** (1 / MT));
}
// 正面上横坐标 x 对应的 u（只在正面那一段有意义）
export function uAt(x, y) {
  let lo = -.25, hi = .25;
  for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (point(mid, y)[0] < x) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}
