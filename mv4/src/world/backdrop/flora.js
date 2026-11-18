// 画里的草木：点叶树、垂柳、花树（桃、梅）、寒林的蟹爪枝、松、远树、芦苇、荷、苔点。
// 每个函数直接画到画绢上：S 是 Scroll，rs 是随机数序列，(x, y) 是树根的位置，h 是树高（像素）。
import { TAU, lerp } from './util.js';
import { stroke, arcPts, dab, soft, line, growTree, drawLimbs, tips, INK } from './brush.js';

const WHITE = [250, 249, 244];
// 枝段上取一点：k 从 0（枝根）到 1（枝梢）
const along = (s, k) => { const f = k * (s.pts.length - 1), i = Math.min(s.pts.length - 2, Math.floor(f)), u = f - i; return [lerp(s.pts[i][0], s.pts[i + 1][0], u), lerp(s.pts[i][1], s.pts[i + 1][1], u)]; };

// 点叶树：枝梢上一团团横点。palette：{ wash 底下的淡彩, mid 中间色的点, dark 浓墨点, accent 提神的几点（可无，盖色） }
export function leafTree(S, rs, x, y, h, { palette, lean = 0, density = 1, levels = 3, spread = .6, round = false }) {
  const g = S.ink(), segs = growTree(rs, x, y, h, { lean, levels, spread });
  drawLimbs(g, rs, segs);
  const crowns = tips(segs, levels - 1);
  for (const s of crowns) soft(g, s.tip[0], s.tip[1] - h * .02, h * .17, h * .11, palette.wash, .5);
  const dot = Math.min(4.4, Math.max(2, h * .017)), many = 24 * density * Math.max(1, h / 190);       // 树大了点子不跟着变大，而是点得更多
  for (const s of crowns) {
    const R = h * .12 * rs.range(.8, 1.25);
    for (let i = 0; i < many; i++) {
      const a = rs() * TAU, r = Math.sqrt(rs()) * R, px = s.tip[0] + Math.cos(a) * r * 1.3, py = s.tip[1] + Math.sin(a) * r * .85 - R * .15, low = py > s.tip[1] - R * .1;
      dab(g, px, py, dot * rs.range(.7, 1.3), dot * (round ? .8 : .5) * rs.range(.7, 1.3), rs.range(-.2, .2), rs() < (low ? .5 : .22) ? palette.dark : palette.mid, rs.range(.45, .8));
    }
  }
  if (palette.accent) {
    S.opaque();
    for (const s of crowns) for (let i = 0; i < many * .3; i++) { const a = rs() * TAU, r = Math.sqrt(rs()) * h * .12; dab(S.g, s.tip[0] + Math.cos(a) * r * 1.3, s.tip[1] + Math.sin(a) * r * .8 - h * .02, dot * .85, dot * (round ? .7 : .48), rs.range(-.3, .3), palette.accent, rs.range(.6, .9)); }
  }
  return segs;
}

// 垂柳：主干斜出，大枝拱起，千百条细丝垂下来，被风带着往一边偏
export function willow(S, rs, x, y, h, { lean = .18, color = [116, 150, 82], wind = .16, strands = 1 } = {}) {
  const g = S.ink(), trunk = [], limbs = [], phase = rs() * 6;
  for (let i = 0; i <= 8; i++) { const k = i / 8; trunk.push([x + lean * h * .5 * k + Math.sin(k * 4 + phase) * h * .03, y - h * .5 * k]); }
  // 大枝：从干顶一带斜着扬上去，到梢头才往外弯下来
  const n = rs.int(4, 6);
  for (let i = 0; i < n; i++) {
    const dir = lerp(-1, 1, i / (n - 1)) + rs.range(-.18, .18), reach = h * (.1 + .2 * Math.abs(dir)) * rs.range(.8, 1.2), rise = h * (.44 - .14 * Math.abs(dir)) * rs.range(.75, 1.15);
    const from = trunk[rs.int(5, 8)], end = [from[0] + dir * reach, from[1] - rise * .86];
    const pts = arcPts(from, [from[0] + dir * reach * .2, from[1] - rise * .8], end, 8).map(([px, py], j) => [px + rs.range(-2, 2) * (j > 0), py + rs.range(-2, 2) * (j > 0)]);
    pts.push([end[0] + dir * reach * .2 + wind * h * .03, end[1] + rise * .1], [end[0] + dir * reach * .3 + wind * h * .06, end[1] + rise * .3]);
    limbs.push({ pts, w0: h * .017, w1: 1, len: reach + rise, depth: 1 });
  }
  drawLimbs(g, rs, [{ pts: trunk, w0: h * .05, w1: h * .028, len: h * .5, depth: 0 }, ...limbs]);
  // 垂丝：越靠枝梢越密越长，被风带着往一边偏；丝上两边缀着细叶
  for (const s of limbs) for (let i = 0; i < 15 * strands; i++) {
    const k = rs.range(.25, 1) ** .6, [px, py] = along(s, k), len = h * rs.range(.3, .58) * (.5 + .6 * k), end = [px + wind * len + rs.range(-5, 5), py + len];
    const pts = arcPts([px, py], [px + rs.range(-4, 4) + wind * len * .15, py + len * .45], end, Math.max(6, Math.round(len / 9)));
    stroke(g, pts, 1, .4, color, .7);
    for (let j = 1; j < pts.length; j++) if (rs() < .85) dab(g, pts[j][0] + rs.range(-2, 2), pts[j][1] + rs.range(-2, 2), 2.5, .85, rs.sign() * rs.range(.7, 1.2), rs() < .3 ? [154, 176, 98] : color, .6);
  }
}

// 花树：桃或梅。枝干多折，枝上缀着成簇的花。petals：花瓣的两三种颜色（盖色）；heart：花心的颜色；leaves：嫩叶的颜色（可无）
export function blossomTree(S, rs, x, y, h, { lean = 0, petals, heart = [150, 40, 50], leaves = null, count = 1, levels = 3, droop = 0, size = 1, glow = .28 }) {
  const g = S.ink(), segs = growTree(rs, x, y, h, { lean, levels, spread: .7, wiggle: .5, width: .04, droop });
  drawLimbs(g, rs, segs);
  const blooms = [];
  for (const s of segs) {
    if (s.depth < 1) continue;
    for (let i = 0; i < Math.max(1, s.len / 9) * count; i++) { const [px, py] = along(s, rs.range(.15, 1)); blooms.push([px + rs.range(-5, 5), py + rs.range(-5, 5)]); }
  }
  if (glow) for (const [px, py] of blooms) if (rs() < .5) soft(g, px, py, h * .05, h * .04, petals[0], glow);        // 花团底下晕一层淡彩
  if (leaves) for (const [px, py] of blooms) if (rs() < .35) dab(g, px + rs.range(-4, 4), py + rs.range(-4, 4), h * .013, h * .005, rs.range(0, TAU), leaves, .7);
  S.opaque();
  const r = Math.max(1.3, h * .0105 * size);
  for (const [px, py] of blooms) {
    if (rs() < .3) { dab(S.g, px, py, r * .8, r * .8, 0, heart, .85); continue; }                       // 花苞：一点深色
    const c = rs.pick(petals), turn = rs() * TAU;
    for (let k = 0; k < 5; k++) dab(S.g, px + Math.cos(turn + k * TAU / 5) * r, py + Math.sin(turn + k * TAU / 5) * r, r * .82, r * .82, 0, c, .92);
    dab(S.g, px, py, r * .42, r * .42, 0, heart, .8);
  }
  return segs;
}

// 寒林：落尽叶子的树，枝梢像蟹爪一样往下勾。snow 为真时，枝的上沿压着一层雪
export function bareTree(S, rs, x, y, h, { lean = 0, snow = false, levels = 4, spread = .6 } = {}) {
  const g = S.ink(), segs = growTree(rs, x, y, h, { lean, levels, spread, droop: .85, wiggle: .45, shrink: .66, width: .042 });
  drawLimbs(g, rs, segs);
  for (const s of tips(segs, levels)) for (let i = 0; i < 3; i++) {
    const [px, py] = along(s, rs.range(.4, 1)), side = Math.cos(s.ang) >= 0 ? 1 : -1, len = h * rs.range(.03, .06);
    stroke(g, arcPts([px, py], [px + side * len * .8, py - len * .1], [px + side * len, py + len * .8], 5), 1, .4, INK, .8);
  }
  if (snow) {
    S.opaque();
    for (const s of segs) {
      if (s.depth > 2 || Math.abs(Math.sin(s.ang)) > .93) continue;
      stroke(S.g, s.pts.map(([px, py]) => [px, py - s.w0 * .45 - .6]), Math.max(1.4, s.w0 * .55), Math.max(1, s.w1 * .5), WHITE, .92);
    }
  }
  return segs;
}

// 松：直干，层层平伸的枝，枝上一把把扇形的松针
export function pine(S, rs, x, y, h, { lean = 0, color = [58, 98, 86], snow = false } = {}) {
  const g = S.ink(), trunk = [];
  for (let i = 0; i <= 7; i++) { const k = i / 7; trunk.push([x + lean * h * k + Math.sin(k * 5 + x) * h * .025, y - h * k]); }
  drawLimbs(g, rs, [{ pts: trunk, w0: h * .06, w1: h * .018, len: h }]);
  const fans = [];
  for (let i = 0; i < 6; i++) {
    const k = .34 + .66 * i / 5, side = i % 2 ? 1 : -1, j = k * 7, p = [lerp(trunk[Math.floor(j)][0], trunk[Math.min(7, Math.ceil(j))][0], j % 1), y - h * k], L = h * (.42 - .26 * k) * rs.range(.8, 1.2);
    const pts = i === 5 ? [p, [p[0], p[1] - L * .4]] : arcPts(p, [p[0] + side * L * .5, p[1] - L * .16], [p[0] + side * L, p[1] + L * .04], 6);
    stroke(g, pts, 2.2, .8, INK, .85);
    for (const f of [.45, .75, 1]) { const q = pts[Math.round(f * (pts.length - 1))]; fans.push([q[0], q[1], L * .3]); }
  }
  for (const [fx, fy, r] of fans) soft(g, fx, fy - r * .3, r * 1.25, r * .7, color, .55);
  for (const [fx, fy, r] of fans) for (let n = 0; n < 13; n++) { const a = -Math.PI + .2 + (Math.PI - .4) * n / 12 + rs.range(-.05, .05); line(g, [[fx, fy], [fx + Math.cos(a) * r, fy + Math.sin(a) * r * .85]], .9, [34, 52, 50], .8); }
  if (snow) { S.opaque(); for (const [fx, fy, r] of fans) dab(S.g, fx, fy - r * .55, r * .8, r * .24, 0, WHITE, .88); }
}

// 远树：沿一道山脊点一排小树，一竖加两三个横点。远看只是山头上的一圈绒毛
export function farTrees(S, rs, ridge, x0, x1, { step = 8, h = 11, color = [70, 96, 84], chance = .65, sink = 2, alpha = .7, fir = false } = {}) {
  const g = S.ink();
  for (let x = x0; x < x1; x += step) {
    if (rs() > chance) continue;
    const tx = Math.max(0, Math.min(S.w - 1, Math.round(x + rs.range(-3, 3)))), ty = ridge[tx] + sink, th = h * rs.range(.6, 1.3);
    line(g, [[tx, ty], [tx + rs.range(-1, 1), ty - th]], .9, INK, alpha * .8);
    if (fir) { for (let k = 0; k < 3; k++) dab(g, tx, ty - th * (.4 + .3 * k), th * (.3 - .08 * k), th * .14, 0, color, alpha); continue; }
    for (let k = 0; k < 3; k++) dab(g, tx + rs.range(-th * .3, th * .3), ty - th * rs.range(.6, 1.1), th * .36, th * .17, 0, color, alpha * rs.range(.6, 1));
  }
}

// 一片林子：椭圆范围里撒许多小树（一竖几点），远的先画。用在山腰、谷口。accent：夹在林间的另一种颜色（盖色，如桃花、红叶）
export function grove(S, rs, cx, cy, rx, ry, n, { color = [64, 98, 80], h = 12, accent = null, accentShare = .3, bare = false } = {}) {
  const trees = Array.from({ length: n }, () => { const a = rs() * TAU, r = Math.sqrt(rs()); return [cx + Math.cos(a) * r * rx, cy + Math.sin(a) * r * ry, h * rs.range(.7, 1.3), accent && rs() < accentShare]; }).sort((a, b) => a[1] - b[1]);
  for (const [x, y, th, special] of trees) {
    const g = S.ink();
    line(g, [[x, y], [x + rs.range(-1, 1), y - th]], Math.max(.8, th * .07), INK, .7);
    if (bare) { for (const k of [-1, 1]) stroke(g, arcPts([x, y - th * .6], [x + k * th * .3, y - th * .9], [x + k * th * .45, y - th * .7], 4), .8, .3, INK, .7); continue; }
    if (special) { S.opaque(); for (let k = 0; k < 4; k++) dab(S.g, x + rs.range(-th * .35, th * .35), y - th * rs.range(.55, 1.1), th * .26, th * .17, 0, accent, .9); continue; }
    for (let k = 0; k < 4; k++) dab(g, x + rs.range(-th * .35, th * .35), y - th * rs.range(.55, 1.1), th * .34, th * .17, 0, color, rs.range(.5, .8));
  }
}

// 芦苇：一丛斜出的细秆，顶上带着白穗
export function reeds(S, rs, x0, x1, y, { h = 40, n = 20, color = [140, 112, 66], tuft = [238, 228, 204], lean = .3 } = {}) {
  const g = S.ink(), heads = [];
  for (let i = 0; i < n; i++) {
    const bx = lerp(x0, x1, rs()), hh = h * rs.range(.55, 1), top = [bx + lean * hh * rs.range(.4, 1.4), y - hh + rs.range(-2, 2)];
    stroke(g, arcPts([bx, y + rs.range(-2, 3)], [bx + lean * hh * .2, y - hh * .6], top, 6), 1.1, .5, color, .8);
    if (rs() < .6) heads.push(top);
    if (rs() < .5) stroke(g, arcPts([bx, y], [bx - 4, y - hh * .35], [bx - lean * hh * .6 - 5, y - hh * .3], 5), 1, .4, color, .6);   // 一片折下来的叶
  }
  S.opaque();
  for (const [tx, ty] of heads) dab(S.g, tx + 2, ty + 1, h * .11, h * .035, .5, tuft, .85);
}

// 草：几笔短的撇
export function grass(S, rs, x0, x1, yAt, n, color = [60, 70, 58]) {
  const g = S.ink();
  for (let i = 0; i < n; i++) { const x = lerp(x0, x1, rs()), y = yAt(x); for (let k = -1; k <= 1; k++) stroke(g, [[x + k * 1.5, y], [x + k * 4 + rs.range(-1, 1), y - rs.range(4, 9)]], 1, .4, color, .7); }
}

// 苔点：沿山脊撒几簇浓墨点，提一提山石的精神
export function moss(S, rs, ridge, x0, x1, { n = 14, size = 2.4, color = INK, alpha = .75, sink = 6 } = {}) {
  const g = S.ink();
  for (let i = 0; i < n; i++) {
    const x = lerp(x0, x1, rs()), y = ridge[Math.max(0, Math.min(S.w - 1, Math.round(x)))] + rs.range(-1, sink);
    for (let k = 0; k < rs.int(3, 6); k++) dab(g, x + rs.range(-7, 7), y + rs.range(-3, 5), size * rs.range(.5, 1), size * rs.range(.9, 1.6), rs.range(-.3, .3), color, alpha * rs.range(.6, 1));
  }
}

// 荷塘：远小近大的荷叶，叶间几朵荷花和花苞。范围 x0…x1、y0…y1（y1 是近处）
export function lotus(S, rs, x0, x1, y0, y1, { n = 14, scale = 1, flowers = 4 } = {}) {
  const items = Array.from({ length: n }, () => ({ x: lerp(x0, x1, rs()), y: lerp(y0, y1, rs() ** .8), kind: 'leaf' }));
  for (let i = 0; i < flowers; i++) items.push({ x: lerp(x0, x1, rs()), y: lerp(y0, y1, rs()), kind: rs() < .5 ? 'bud' : 'flower' });
  items.sort((a, b) => a.y - b.y);
  for (const it of items) {
    const s = scale * lerp(11, 30, (it.y - y0) / Math.max(1, y1 - y0)) * rs.range(.8, 1.2), g = S.ink();
    if (it.kind === 'leaf') {
      const up = rs() < .4 ? s * rs.range(.5, 1.2) : 0, cy = it.y - up, rot = rs.range(-.22, .22);
      if (up) stroke(g, arcPts([it.x + rs.range(-3, 3), it.y + s * .2], [it.x + 3, it.y - up * .5], [it.x, cy], 5), 1.3, .9, [70, 100, 80], .8);
      dab(g, it.x, cy, s, s * .4, rot, [124, 164, 126], .74);
      dab(g, it.x + s * .14, cy + s * .1, s * .72, s * .22, rot, [70, 112, 96], .36);
      for (let k = 0; k < 9; k++) { const a = k / 9 * TAU; line(g, [[it.x, cy], [it.x + Math.cos(a + rot) * s * .92, cy + Math.sin(a + rot) * s * .36]], .7, [40, 66, 60], .5); }
      g.strokeStyle = 'rgba(34,48,48,.6)'; g.lineWidth = .9; g.beginPath(); g.ellipse(it.x, cy, s, s * .4, rot, .25, TAU - .1); g.stroke();
      continue;
    }
    const top = it.y - s * rs.range(1.3, 2.1), cx = it.x + rs.range(-4, 4);
    stroke(g, arcPts([it.x, it.y + s * .2], [it.x + rs.range(-5, 5), (it.y + top) / 2], [cx, top], 5), 1.2, .8, [70, 100, 80], .8);
    S.opaque();
    if (it.kind === 'bud') { dab(S.g, cx, top - s * .22, s * .14, s * .3, rs.range(-.2, .2), [236, 150, 166], .95); dab(S.g, cx, top - s * .4, s * .07, s * .12, 0, [214, 96, 120], .9); continue; }
    for (let k = -3; k <= 3; k++) { const a = -Math.PI / 2 + k * .36; dab(S.g, cx + Math.cos(a) * s * .26, top + Math.sin(a) * s * .26 - s * .05, s * .32, s * .11, a, k % 2 ? [246, 206, 212] : [238, 160, 176], .95); }
    dab(S.g, cx, top + s * .02, s * .1, s * .06, 0, [228, 190, 96], .95);
  }
}
