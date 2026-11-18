// 屏风木作的贴图：红木的木纹；眉板上的描金花卉（春兰、夏荷、秋菊、冬梅，各配一扇）；腰板和裙板上的浅浮雕纹样。
// 每张板的贴图成对：一张颜色，一张高低（给凹凸用）。
import { tfbm, pixelCanvas, makeCanvas, stream, TAU, rgba } from './util.js';

// 红木木纹，可平铺：顺纹的深浅条、细的棕眼
export function woodCanvas(size = 512) {
  const k = 1 / size;
  return pixelCanvas(size, size, (x, y, out) => {
    const streak = tfbm(x * k * 32, y * k * 2, 4), band = tfbm(x * k * 8 + 40, y * k, 3), pore = tfbm(x * k * 128 + 5, y * k * 8, 2);
    const v = Math.min(1, Math.max(0, .34 + 1.0 * (streak - .42) + .5 * (band - .5) - .3 * Math.max(0, pore - .62) * 4));
    out[0] = 52 + 78 * v; out[1] = 26 + 38 * v; out[2] = 28 + 30 * v;
  });
}

// 铜活的表面，可平铺：黄铜底色，凹处和边角发暗发绿的旧锈，细密的锤痕
export function brassCanvas(size = 256) {
  const k = 1 / size;
  return pixelCanvas(size, size, (x, y, out) => {
    const patina = Math.max(0, tfbm(x * k * 4, y * k * 4, 4) - .5) * 2, hammer = tfbm(x * k * 64 + 3, y * k * 64, 2) - .5, v = 1 + .14 * hammer - .16 * patina;
    out[0] = 188 * v - 10 * patina; out[1] = 152 * v + 3 * patina; out[2] = 90 * v + 10 * patina;
  });
}

const GOLD = '#DDB56A', GOLD_DIM = '#A8823E';
// 在一块板上画东西：先铺木纹底色，再交给 draw 画（颜色画布 g 和高低画布 hgt 各画一遍）
function board(w, h, wood, draw) {
  const color = makeCanvas(w, h), height = makeCanvas(w, h), g = color.getContext('2d'), hg = height.getContext('2d');
  g.fillStyle = g.createPattern(wood, 'repeat'); g.save(); g.translate(w / 2, h / 2); g.rotate(Math.PI / 2); g.fillRect(-h, -w, h * 2, w * 2); g.restore();   // 木纹横着走
  g.fillStyle = 'rgba(24,10,14,.45)'; g.fillRect(0, 0, w, h);
  hg.fillStyle = '#808080'; hg.fillRect(0, 0, w, h);
  draw(g, hg);
  return { color, height };
}
const line = (g, pts, width, style) => { g.strokeStyle = style; g.lineWidth = width; g.lineCap = g.lineJoin = 'round'; g.beginPath(); g.moveTo(...pts[0]); for (let i = 1; i < pts.length; i++) g.lineTo(...pts[i]); g.stroke(); };
const curve = (g, a, c, b, width, style) => { g.strokeStyle = style; g.lineWidth = width; g.lineCap = 'round'; g.beginPath(); g.moveTo(...a); g.quadraticCurveTo(...c, ...b); g.stroke(); };

// 四种花卉，都用金线勾：x、y 是花丛的落点，s 是大小
const FLORA = {
  春(g, x, y, s, rs) {                                               // 兰：一丛长叶向两边披开，叶间几朵小花
    for (let i = 0; i < 11; i++) {
      const dir = (i - 5) / 5 + rs.range(-.1, .1), len = s * rs.range(.9, 1.9), tipX = x + dir * len * 1.25, tipY = y - len * (.55 - .35 * Math.abs(dir)) + s * .5 * Math.abs(dir);
      curve(g, [x + dir * s * .08, y], [x + dir * len * .5, y - len * 1.05], [tipX, tipY], s * .045 * rs.range(.7, 1.3), i % 3 ? GOLD : GOLD_DIM);
    }
    for (let i = 0; i < 4; i++) {
      const fx = x + rs.range(-.9, .9) * s, fy = y - s * rs.range(.5, 1.05);
      curve(g, [x + (fx - x) * .2, y - s * .1], [fx - s * .1, fy + s * .4], [fx, fy], s * .02, GOLD_DIM);
      for (let p = 0; p < 5; p++) { const a = p / 5 * TAU + i; g.fillStyle = GOLD; g.beginPath(); g.ellipse(fx + Math.cos(a) * s * .1, fy + Math.sin(a) * s * .07, s * .1, s * .028, a, 0, TAU); g.fill(); }
    }
  },
  夏(g, x, y, s, rs) {                                               // 荷：一张大叶、一朵花、一个苞，脚下几道水纹
    const leaf = (lx, ly, r) => {                                    // 荷叶：边缘起伏的一张圆叶，叶面扫一层淡金，叶脉从叶心放射出去
      const edge = a => r * (1 + .07 * Math.sin(a * 7 + 1) + .04 * Math.sin(a * 13));
      g.beginPath(); for (let i = 0; i <= 60; i++) { const a = i / 60 * TAU; g.lineTo(lx + Math.cos(a - .12) * edge(a), ly + Math.sin(a - .12) * edge(a) * .42); }
      g.fillStyle = rgba(GOLD, .16); g.fill(); g.strokeStyle = GOLD; g.lineWidth = s * .03; g.stroke();
      for (let i = 0; i < 14; i++) { const a = i / 14 * TAU; line(g, [[lx, ly], [lx + Math.cos(a - .12) * edge(a) * .92, ly + Math.sin(a - .12) * edge(a) * .39]], s * .014, GOLD_DIM); }
    };
    curve(g, [x - s * .9, y], [x - s * 1.0, y - s * .5], [x - s * .8, y - s * .9], s * .03, GOLD_DIM); leaf(x - s * .8, y - s * .95, s * .85);
    curve(g, [x + s * .5, y], [x + s * .7, y - s * .7], [x + s * .5, y - s * 1.25], s * .03, GOLD_DIM);
    for (let i = -3; i <= 3; i++) { const a = -Math.PI / 2 + i * .34, px = x + s * .5 + Math.cos(a) * s * .3, py = y - s * 1.3 + Math.sin(a) * s * .3; g.strokeStyle = GOLD; g.lineWidth = s * .026; g.beginPath(); g.ellipse(px, py, s * .34, s * .11, a, 0, TAU); g.stroke(); }
    curve(g, [x + s * 1.5, y], [x + s * 1.4, y - s * .4], [x + s * 1.6, y - s * .8], s * .026, GOLD_DIM);
    g.strokeStyle = GOLD; g.beginPath(); g.ellipse(x + s * 1.62, y - s * .95, s * .1, s * .2, .15, 0, TAU); g.stroke();
    for (let i = 0; i < 5; i++) line(g, [[x - s * 2 + i * s * .9 + rs() * s * .3, y + s * .08 * (i % 2)], [x - s * 1.5 + i * s * .9, y + s * .08 * (i % 2)]], s * .016, GOLD_DIM);
  },
  秋(g, x, y, s, rs) {                                               // 菊：两朵花，细长的瓣向外卷；一根斜茎几片叶
    curve(g, [x - s * .2, y], [x + s * .1, y - s * .6], [x - s * .5, y - s * 1.1], s * .035, GOLD_DIM);
    curve(g, [x - s * .05, y - s * .4], [x + s * .6, y - s * .6], [x + s * .9, y - s * .85], s * .03, GOLD_DIM);
    for (const [fx, fy, r] of [[x - s * .55, y - s * 1.15, s * .5], [x + s * .95, y - s * .9, s * .38]]) for (let ring = 0; ring < 2; ring++) for (let i = 0; i < 16; i++) {
      const a = i / 16 * TAU + ring * .2, r1 = r * (ring ? .55 : 1);
      curve(g, [fx + Math.cos(a) * r1 * .15, fy + Math.sin(a) * r1 * .15], [fx + Math.cos(a + .35) * r1 * .7, fy + Math.sin(a + .35) * r1 * .7], [fx + Math.cos(a) * r1, fy + Math.sin(a) * r1 * .8], s * .022, ring ? GOLD : GOLD_DIM);
    }
    for (const [lx, ly, a] of [[x + s * .25, y - s * .35, .5], [x - s * .5, y - s * .5, 2.4], [x + s * .5, y - s * .55, -.4]]) { g.strokeStyle = GOLD; g.lineWidth = s * .02; g.beginPath(); g.ellipse(lx, ly, s * .3, s * .12, a, 0, TAU); g.stroke(); line(g, [[lx - Math.cos(a) * s * .28, ly - Math.sin(a) * s * .28], [lx + Math.cos(a) * s * .28, ly + Math.sin(a) * s * .28]], s * .012, GOLD_DIM); }
  },
  冬(g, x, y, s, rs) {                                               // 梅：一根折枝，枝上五瓣的花和点点花苞
    const pts = [[x - s * 1.7, y - s * .1], [x - s * .9, y - s * .55], [x - s * .2, y - s * .5], [x + s * .5, y - s * 1.0], [x + s * 1.5, y - s * 1.1]];
    line(g, pts, s * .06, GOLD_DIM);
    line(g, [pts[1], [x - s * .7, y - s * 1.3]], s * .03, GOLD_DIM); line(g, [pts[3], [x + s * .8, y - s * .25]], s * .03, GOLD_DIM); line(g, [pts[2], [x - s * .1, y - s * 1.2]], s * .025, GOLD_DIM);
    for (let i = 0; i < 9; i++) {
      const base = pts[1 + (i % 4)], fx = base[0] + rs.range(-.5, .5) * s, fy = base[1] + rs.range(-.6, .3) * s, r = s * rs.range(.1, .15);
      if (i % 3 === 2) { g.fillStyle = GOLD; g.beginPath(); g.arc(fx, fy, r * .45, 0, TAU); g.fill(); continue; }
      g.strokeStyle = GOLD; g.lineWidth = s * .02;
      for (let p = 0; p < 5; p++) { const a = p / 5 * TAU + i; g.beginPath(); g.arc(fx + Math.cos(a) * r * .75, fy + Math.sin(a) * r * .75, r * .55, 0, TAU); g.stroke(); }
      g.fillStyle = GOLD; g.beginPath(); g.arc(fx, fy, r * .22, 0, TAU); g.fill();
    }
  },
};
// 眉板：深色漆地，一圈金线的委角框，框里描金的当季花卉，四角各一个回纹
export function browBoard(season, wood, w = 888, h = 396) {
  const rs = stream(season.charCodeAt(0));
  return board(w, h, wood, (g, hg) => {
    const m = h * .11, fret = (x, y, sx, sy) => { const u = h * .05; line(g, [[x, y + sy * u * 3], [x, y], [x + sx * u * 3, y], [x + sx * u * 3, y + sy * u * 2], [x + sx * u, y + sy * u * 2], [x + sx * u, y + sy * u], [x + sx * u * 2, y + sy * u]], 2.2, rgba(GOLD_DIM, .9)); };
    g.strokeStyle = rgba(GOLD, .85); g.lineWidth = 2.6; g.strokeRect(m, m, w - m * 2, h - m * 2);
    g.strokeStyle = rgba(GOLD_DIM, .7); g.lineWidth = 1.2; g.strokeRect(m + 7, m + 7, w - m * 2 - 14, h - m * 2 - 14);
    fret(m + 18, m + 18, 1, 1); fret(w - m - 18, m + 18, -1, 1); fret(m + 18, h - m - 18, 1, -1); fret(w - m - 18, h - m - 18, -1, -1);
    g.globalAlpha = .92; FLORA[season](g, w * .5, h * .80, h * .38, rs); g.globalAlpha = 1;
    hg.strokeStyle = '#B0B0B0'; hg.lineWidth = 4; hg.strokeRect(m, m, w - m * 2, h - m * 2);
  });
}
// 一个如意云头：两个向里卷的涡和中间的尖，线条画在颜色上是暗的刻线，画在高低图上是凸起
function ruyi(g, hg, x, y, s, up) {
  const k = up ? -1 : 1, path = c => {
    c.beginPath(); c.moveTo(x, y + k * s);
    c.bezierCurveTo(x + s * .9, y + k * s * .9, x + s * 1.5, y + k * s * .1, x + s * .9, y - k * s * .25);
    c.bezierCurveTo(x + s * .5, y - k * s * .45, x + s * .25, y - k * s * .1, x + s * .55, y + k * s * .1);
    c.moveTo(x, y + k * s);
    c.bezierCurveTo(x - s * .9, y + k * s * .9, x - s * 1.5, y + k * s * .1, x - s * .9, y - k * s * .25);
    c.bezierCurveTo(x - s * .5, y - k * s * .45, x - s * .25, y - k * s * .1, x - s * .55, y + k * s * .1);
  };
  hg.strokeStyle = '#D8D8D8'; hg.lineWidth = s * .26; hg.lineCap = 'round'; path(hg); hg.stroke();
  g.strokeStyle = 'rgba(150,84,70,.55)'; g.lineWidth = s * .24; g.lineCap = 'round'; path(g); g.stroke();
  g.strokeStyle = 'rgba(14,6,8,.6)'; g.lineWidth = s * .05; path(g); g.stroke();
}
// 腰板和裙板：浅浮雕。上下各一排相对的如意云头，中间一个由云头围成的团花
export function reliefBoard(wood, w, h, rows) {
  return board(w, h, wood, (g, hg) => {
    const s = w * .085;
    for (let r = 0; r < rows; r++) {
      const cy = h * (r + .5) / rows, span = h / rows * .36;
      for (let i = -1; i <= 1; i++) { ruyi(g, hg, w / 2 + i * s * 3.1, cy - span, s, true); ruyi(g, hg, w / 2 + i * s * 3.1, cy + span, s, false); }
      for (let i = 0; i < 4; i++) { g.save(); hg.save(); for (const c of [g, hg]) { c.translate(w / 2, cy); c.rotate(i * Math.PI / 2); c.translate(-w / 2, -cy); } ruyi(g, hg, w / 2, cy - s * 1.1, s * .7, true); g.restore(); hg.restore(); }
      hg.fillStyle = '#E0E0E0'; hg.beginPath(); hg.arc(w / 2, cy, s * .32, 0, TAU); hg.fill();
      g.fillStyle = 'rgba(150,84,70,.6)'; g.beginPath(); g.arc(w / 2, cy, s * .32, 0, TAU); g.fill();
    }
  });
}
