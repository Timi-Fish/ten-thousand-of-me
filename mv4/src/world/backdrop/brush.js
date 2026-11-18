// 画布上的笔触：有粗细变化的一笔、点子、柔边的色团，以及一棵树的枝干怎么长。
// 颜色用 [r, g, b]；调用前由 Scroll.ink()（叠深）或 Scroll.opaque()（盖色）定好叠加方式。
import { lerp, TAU } from './util.js';

export const INK = [30, 28, 36], INK_SOFT = [70, 66, 78];
const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

// 一笔：沿折线 pts 画，粗细从 w0 变到 w1（中间可以鼓一点）。belly > 0 时中段更粗，像提按
export function stroke(g, pts, w0, w1, color, alpha = 1, belly = 0) {
  const n = pts.length, L = [], R = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1, k = i / (n - 1);
    const hw = Math.max(.25, (lerp(w0, w1, k) + belly * Math.sin(k * Math.PI)) / 2), nx = -dy / len * hw, ny = dx / len * hw;
    L.push([pts[i][0] + nx, pts[i][1] + ny]); R.push([pts[i][0] - nx, pts[i][1] - ny]);
  }
  g.fillStyle = css(color, alpha);
  g.beginPath(); g.moveTo(...L[0]);
  for (let i = 1; i < n; i++) g.lineTo(...L[i]);
  for (let i = n - 1; i >= 0; i--) g.lineTo(...R[i]);
  g.closePath(); g.fill();
  if (w0 > 1.6) { g.beginPath(); g.arc(pts[0][0], pts[0][1], w0 / 2, 0, TAU); g.fill(); }
}
// 二次曲线上取 n+1 个点
export function arcPts(a, c, b, n = 8) {
  const out = [];
  for (let i = 0; i <= n; i++) { const k = i / n, u = 1 - k; out.push([u * u * a[0] + 2 * u * k * c[0] + k * k * b[0], u * u * a[1] + 2 * u * k * c[1] + k * k * b[1]]); }
  return out;
}
// 一个点子：椭圆，rot 是倾角
export function dab(g, x, y, rx, ry, rot, color, alpha = 1) {
  g.fillStyle = css(color, alpha);
  g.beginPath(); g.ellipse(x, y, Math.max(.3, rx), Math.max(.3, ry), rot, 0, TAU); g.fill();
}
// 一团柔边的颜色（中间浓、边上化开），用来铺树冠、花团底下的淡彩
export function soft(g, x, y, rx, ry, color, alpha = 1) {
  g.save(); g.translate(x, y); g.scale(1, ry / rx);
  const grad = g.createRadialGradient(0, 0, 0, 0, 0, rx);
  grad.addColorStop(0, css(color, alpha)); grad.addColorStop(.55, css(color, alpha * .6)); grad.addColorStop(1, css(color, 0));
  g.fillStyle = grad; g.fillRect(-rx, -rx, rx * 2, rx * 2);
  g.restore();
}
// 细线（不变粗细），用于屋宇、舟楫这类工整的东西
export function line(g, pts, width, color, alpha = 1) {
  g.strokeStyle = css(color, alpha); g.lineWidth = width; g.lineCap = g.lineJoin = 'round';
  g.beginPath(); g.moveTo(...pts[0]);
  for (let i = 1; i < pts.length; i++) g.lineTo(...pts[i]);
  g.stroke();
}
export function fillPoly(g, pts, color, alpha = 1) {
  g.fillStyle = css(color, alpha);
  g.beginPath(); g.moveTo(...pts[0]);
  for (let i = 1; i < pts.length; i++) g.lineTo(...pts[i]);
  g.closePath(); g.fill();
}

// 长一棵树的枝干：从 (x, y) 往上长一段主干，再一层层分叉。返回所有枝段 { pts, w0, w1, depth, tip, ang, len }。
// h 树高的量级；lean 主干歪多少（弧度）；spread 分叉张开多少；levels 分几层；droop 枝梢往下垂多少（蟹爪枝、垂柳用）
export function growTree(rs, x, y, h, { lean = 0, spread = .55, levels = 3, trunk = .42, droop = 0, shrink = .68, width = .05, wiggle = .3 } = {}) {
  const segs = [];
  // from：母枝末端的方向。新枝先顺着它出去，再弯向自己的方向 ang，分叉处才不生硬
  const grow = (x0, y0, from, ang, len, w, depth) => {
    const pts = [[x0, y0]], bend = rs.range(-wiggle, wiggle), n = 9, phase = rs() * 6, sway = rs.range(.08, .2);
    let a = from, px = x0, py = y0;
    for (let i = 1; i <= n; i++) {
      a += (ang + bend * i / n - a) * .5 + rs.range(-.1, .1) + sway * Math.sin(i * 1.25 + phase) + droop * depth * .04 * (Math.cos(a) >= 0 ? 1 : -1);
      px += Math.cos(a) * len / n; py += Math.sin(a) * len / n; pts.push([px, py]);
    }
    const w1 = w * (depth >= levels ? .3 : .64);
    segs.push({ pts, w0: w, w1, depth, tip: [px, py], ang: a, len });
    if (depth >= levels) return;
    const kids = depth === 0 ? rs.int(2, 3) : rs.int(1, 2) + (rs() < .45 ? 1 : 0);
    for (let k = 0; k < kids; k++) grow(px, py, a, a + (kids === 1 ? rs.range(-.4, .4) : lerp(-spread, spread, k / (kids - 1)) + rs.range(-.16, .16)), len * shrink * rs.range(.8, 1.15), w1 * (kids > 1 ? .86 : 1), depth + 1);
    if (depth > 0 && rs() < .6) { const j = rs.int(3, 6), m = pts[j], side = rs.sign(); grow(m[0], m[1], a + side * .3, a + side * rs.range(.5, .95), len * .5, lerp(w, w1, j / n) * .6, depth + 1); }
  };
  grow(x, y, -Math.PI / 2 + lean, -Math.PI / 2 + lean, h * trunk, h * width, 0);
  return segs;
}
// 把枝干画出来：粗的先铺一层淡墨再勾两边的浓线、点几笔树皮；细的一笔带过
export function drawLimbs(g, rs, segs, ink = INK, body = INK_SOFT) {
  for (const s of segs) {
    if (s.w0 < 3.2) { stroke(g, s.pts, s.w0, s.w1, ink, .88); continue; }
    stroke(g, s.pts, s.w0, s.w1, body, .32);
    const last = s.pts.length - 1, edgeAt = (i, side, inset = 1) => { const p = s.pts[i], a = s.pts[Math.max(0, i - 1)], b = s.pts[Math.min(last, i + 1)], len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, hw = lerp(s.w0, s.w1, i / last) / 2 * side * inset; return [p[0] - (b[1] - a[1]) / len * hw, p[1] + (b[0] - a[0]) / len * hw]; };
    for (const side of [-1, 1]) {
      stroke(g, s.pts.map((_, i) => edgeAt(i, side, .62)), s.w0 * .3, s.w1 * .3, body, side < 0 ? .5 : .22);             // 背光一侧染深一点，树干才圆
      stroke(g, s.pts.map((_, i) => edgeAt(i, side)), side < 0 ? 2 : 1.2, .9, ink, .9, .9);
    }
    for (let i = 0; i < s.len / 5; i++) {                              // 树皮：短的弧形鳞纹，偶尔一个节疤
      const j = rs.int(0, last - 1), f = rs(), k = rs.range(-.7, .7), a = edgeAt(j, k), b = edgeAt(j + 1, k), cx = lerp(a[0], b[0], f), cy = lerp(a[1], b[1], f), r = lerp(s.w0, s.w1, j / last) * .2;
      const dx = s.pts[j + 1][0] - s.pts[j][0], dy = s.pts[j + 1][1] - s.pts[j][1], len = Math.hypot(dx, dy) || 1, tx = dx / len, ty = dy / len;
      if (rs() < .12 && r > 2) { g.strokeStyle = 'rgba(30,28,36,.6)'; g.lineWidth = 1; g.beginPath(); g.ellipse(cx, cy, r * .9, r * 1.3, Math.atan2(ty, tx) + Math.PI / 2, 0, TAU); g.stroke(); continue; }
      stroke(g, arcPts([cx - ty * r, cy + tx * r], [cx + tx * r * 1.2, cy + ty * r * 1.2], [cx + ty * r, cy - tx * r], 4), 1, .45, ink, .5);
    }
  }
}
// 枝梢：最末几层枝段的端点，树叶和花都长在这里
export const tips = (segs, fromDepth) => segs.filter(s => s.depth >= fromDepth);
