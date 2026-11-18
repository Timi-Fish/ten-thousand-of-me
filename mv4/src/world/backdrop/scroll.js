// 画绢和逐像素的笔墨：一幅画是一张画布，山、雾、天、水这些大面积的晕染和皴擦逐像素叠噪声算出来，
// 勾线和点景（树、屋、舟、人）另用画布的笔触画（见 brush.js 等）。从远到近一层层画，近的盖住远的。
import { rnd } from '../../anim.js';
import { fbm, noise2, makeCanvas, clamp, smooth } from './util.js';

const SILK = [228, 213, 180];                                      // 旧绢的底色
export const SNOW = [249, 248, 243];                               // 白粉
let shared = null;
// 绢底和绢纹（经纬线的凹凸，干笔在上面会留飞白）。四幅画用同一匹绢，只算一次
function silk(w, h) {
  if (shared && shared.w === w && shared.h === h) return shared;
  const ground = new Uint8ClampedArray(w * h * 4), tooth = new Float32Array(w * h);
  for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i++) {
    const n = fbm(x * .011, y * .011, 4), fox = fbm(x * .035 + 50, y * .035 + 20, 4);
    const t = clamp(.5 + .09 * Math.sin(x * 2.4 + 5 * noise2(x * .05, y * .011)) + .09 * Math.sin(y * 2.4 + 5 * noise2(x * .011 + 7, y * .05)) + .7 * (noise2(x * .83, y * .83) - .5) + .3 * (noise2(x * .31 + 9, y * .31) - .5));
    const edge = Math.min(x, w - 1 - x, y, h - 1 - y), v = (1 - .11 * smooth(46, 0, edge)) * (1 + .07 * (n - .5) + .04 * (t - .5)) * (1 - .02 * smooth(.45, .85, fox));
    tooth[i] = t;
    ground[i * 4] = SILK[0] * v * (1 + .015 * (n - .5)); ground[i * 4 + 1] = SILK[1] * v; ground[i * 4 + 2] = SILK[2] * v * (1 - .045 * (n - .5)); ground[i * 4 + 3] = 255;
  }
  return (shared = { w, h, ground, tooth });
}

export class Scroll {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.canvas = makeCanvas(w, h);
    this.g = this.canvas.getContext('2d', { willReadFrequently: true });
    const s = silk(w, h);
    this.ground = s.ground; this.tooth = s.tooth;
    this.g.putImageData(new ImageData(new Uint8ClampedArray(s.ground), w, h), 0, 0);
  }
  // 逐像素处理第 y0 到 y1 行。fn(p)：p.x、p.y 是位置，p.tooth 是这一点的绢纹（0–1）；用 p.stain / p.lift / p.cover 上色
  pass(y0, y1, fn) {
    const w = this.w; y0 = Math.max(0, Math.floor(y0)); y1 = Math.min(this.h, Math.ceil(y1));
    if (y1 <= y0) return;
    const img = this.g.getImageData(0, y0, w, y1 - y0), d = img.data, G = this.ground, T = this.tooth;
    const p = {
      x: 0, y: 0, tooth: 0, r: 0, g: 0, b: 0, gi: 0,
      // 染：像透明的墨或颜料，叠上去只会变深。c 是颜色 [r, g, b]，a 是浓度
      stain(c, a) { if (a <= 0) return; if (a > 1) a = 1; this.r *= 1 - a * (1 - c[0] / 255); this.g *= 1 - a * (1 - c[1] / 255); this.b *= 1 - a * (1 - c[2] / 255); },
      // 留白：擦回绢底（雾、水、雪都靠它），k 是擦掉多少
      lift(k) { if (k <= 0) return; if (k > 1) k = 1; this.r += (G[this.gi] - this.r) * k; this.g += (G[this.gi + 1] - this.g) * k; this.b += (G[this.gi + 2] - this.b) * k; },
      // 盖：不透明的颜料（白粉、石色），a 是盖住多少
      cover(c, a) { if (a <= 0) return; if (a > 1) a = 1; this.r += (c[0] - this.r) * a; this.g += (c[1] - this.g) * a; this.b += (c[2] - this.b) * a; },
    };
    for (let y = y0, i = 0; y < y1; y++) for (let x = 0; x < w; x++, i += 4) {
      const ti = y * w + x;
      p.x = x; p.y = y; p.tooth = T[ti]; p.gi = ti * 4; p.r = d[i]; p.g = d[i + 1]; p.b = d[i + 2];
      fn(p);
      const dither = T[ti] - .5;
      d[i] = p.r + dither; d[i + 1] = p.g + dither; d[i + 2] = p.b + dither;
    }
    this.g.putImageData(img, 0, y0);
  }
  // 接下来用画布笔触画：墨和透明色用 'multiply'（叠深），不透明的颜料用 'source-over'
  ink() { this.g.globalCompositeOperation = 'multiply'; this.g.globalAlpha = 1; return this.g; }
  opaque() { this.g.globalCompositeOperation = 'source-over'; this.g.globalAlpha = 1; return this.g; }
}

// 一道山脊线：每一列的山顶高度（画布坐标，越小越高）。peaks：[x, 高, 半宽, 偏斜]；rough：大起伏；jag：细碎的锯齿
export function ridgeLine(w, { base, tilt = 0, peaks = [], rough = 18, jag = 4, freq = .008, seed = 1 }) {
  const out = new Float32Array(w), top = Math.max(1, ...peaks.map(p => p[1]));
  for (let x = 0; x < w; x++) {
    let h = 0;
    for (const [px, ph, pw, skew = 0] of peaks) { const u = (x - px) / (pw * (x < px ? 1 + skew : 1 - skew)); h = Math.max(h, ph * Math.exp(-u * u * 1.5)); }
    out[x] = base + tilt * x - h - rough * 2 * (fbm(x * freq + seed * 7.3, seed, 4) - .5) * (.35 + .65 * h / top) - jag * 2 * (fbm(x * .07 + seed, 3.3, 3) - .5);
  }
  return out;
}

// 米点：一排排横卧的椭圆墨点，两层大小错开。返回这一点落在墨点里的程度
function miDots(x, _depth, y, s, seed) {
  let v = 0;
  for (let layer = 0; layer < 3; layer++) {
    const size = s * (1 + layer * .4), sx = 12 * size, sy = 6.4 * size, wave = 16 * size * (noise2(x * .017 + layer * 9, y * .017 + seed) - .5);     // 一排排点子随山势略有起伏，不排成直线
    const fy0 = (y + wave) / sy + layer * .37, gy = Math.floor(fy0), fx0 = x / sx + rnd(gy * 7.13 + seed + layer) + layer * .3, gx = Math.floor(fx0);
    const h = rnd(gx * 12.9898 + gy * 78.233 + seed + layer * 31), h2 = rnd(gx * 39.3468 + gy * 11.135 + seed + layer * 17);
    if (h2 < .42) continue;
    const big = .65 + .7 * rnd(gx * 3.7 + gy * 5.9 + layer), fx = (fx0 - gx - .5 - (h - .5) * .7) / big, fy = (fy0 - gy - .5 - (h2 - .7) * .9) / big, q = fx * fx * 5 + fy * fy * 9;
    if (q < 1) v = Math.max(v, Math.sqrt(1 - q) * (.5 + .5 * h));
  }
  return v;
}
// 三种皴法，各返回这一点的墨量（0–1）。x、y 是画面上的位置，d 是离山脊多深，s 是粗细，side 是受光的方向，slope 是山脊在这一列的斜率
const CUN = {
  // 披麻皴：顺着山势往下披的一根根长线，时断时续，略带弯，像麻的纤维
  hemp(x, d, y, s, seed, side, slope) {
    // 线顺着山坡往两边披开：靠近山脊的一段斜着走，再往下就直直垂下去
    const sw = 4.2 * s, u = (x - 44 * (1 - Math.exp(-d / 44)) * (.36 * slope - .08 * side) + 28 * fbm(x * .0045 + seed, d * .0065, 2)) / sw, col = Math.floor(u), f = u - col - .5;
    const on = smooth(.46, .62, noise2(col * 3.137 + seed * 2, d * .014 / s + col * 5.13));
    if (on <= 0) return 0;
    const wob = .5 * (noise2(col * 7.7 + seed, d * .022 / s) - .5), thick = .09 + .1 * noise2(col * 1.9, d * .05 + seed);
    return on * smooth(thick + .12, thick - .03, Math.abs(f - wob));
  },
  // 斧劈皴：斜着劈下去的短促墨块，边缘硬，像斧子砍出的石面
  axe(x, d, y, s, seed, side) {
    const a = x * .57 - side * y * .82, b = side * x * .82 + y * .57, n = noise2(a * .034 / s + seed, b * .15 / s), m = noise2(a * .1 / s, b * .42 / s + seed);
    return smooth(.56, .63, n * .68 + m * .32);
  },
  mi: miDots,
  none: () => 0,
};

// 画一座山（或一道坡、一块岸石）。从山脊往下：轮廓线、墨的淡染、山头的颜色、山脚的赭色、皴法，到 depth 深处化进留白里。
// o：ridge 山脊线；depth 山体多深；wash/washA 淡染的墨色和浓度；tint/tintA/tintSpan 山头的颜色；foot/footA 山脚的颜色；
//    ink/inkA 勾皴的墨；cun 皴法；cunScale 皴的粗细；solid 盖住后面的程度；light 受光在哪边（-1 左，1 右）；line 轮廓线粗细的倍数；
//    snow 积雪的厚薄；span 只画哪一段；fold 明暗起伏的疏密
export function mountain(S, o) {
  const { ridge, depth, seed = 1, wash, washA = .3, ink = [30, 28, 36], inkA = .6, cunScale = 1, solid = .9, light = -1, line = 1, fold = 1 } = o, w = S.w;
  const cun = CUN[o.cun ?? 'hemp'], deep = new Float32Array(w), lineW = new Float32Array(w), gap = new Float32Array(w), mask = new Float32Array(w), slope = new Float32Array(w);
  const [m0, m1, ms] = o.span ?? [-1e6, 1e6, 1];                                       // span：[x0, x1, 渐隐宽度]，只画这一段
  let top = Infinity, bottom = -Infinity;
  for (let x = 0; x < w; x++) {
    mask[x] = smooth(m0, m0 + ms, x) * smooth(m1, m1 - ms, x);
    if (mask[x] > 0) { top = Math.min(top, ridge[x]); bottom = Math.max(bottom, ridge[x]); }
    deep[x] = depth * (.72 + .56 * fbm(x * .009 + seed * 2.1, seed, 3)) * (.3 + .7 * mask[x]);
    lineW[x] = line * (1 + 2.6 * fbm(x * .045 + seed, seed * 3, 3));
    gap[x] = smooth(.3, .42, fbm(x * .024 + seed * 9, seed, 2)) * mask[x];             // 轮廓线时断时续
  }
  for (let x = 0; x < w; x++) {                                                          // 山脊在这一列往哪边斜：取前后各一段的平均高度相减，细碎的锯齿不算
    let a = 0, b = 0;
    for (let k = 1; k <= 24; k++) { a += ridge[Math.max(0, x - k)]; b += ridge[Math.min(w - 1, x + k)]; }
    slope[x] = clamp((b - a) / 24 / 25, -1.4, 1.4);
  }
  const fs = .011 * fold;
  S.pass(top - 5, bottom + depth * 1.4, p => {
    const x = p.x, d = p.y - ridge[x];
    if (d < -lineW[x] || mask[x] <= 0) return;
    const t = d / deep[x];
    if (t > 1.3) return;
    const fade = mask[x] * (1 - smooth(.5, 1.05, t + .4 * (fbm(x * .02 + seed, p.y * .02, 3) - .5)));
    if (d >= 0) p.lift(solid * Math.min(1, fade * 1.7));
    const shade = smooth(.32, .72, fbm((x + light * d * .55) * fs + seed * 3.1, d * fs * .45 + seed, 3));      // 背光的坡面
    const mott = fbm(x * .035 + seed * 5, p.y * .035, 3);
    if (d >= 0) {
      if (o.snow) p.cover(SNOW, o.snow * Math.min(1, fade * 1.5) * (1 - .75 * shade));                  // 雪：受光的坡面盖一层白粉，背光处露出底下的淡墨
      p.stain(wash, washA * fade * ((.3 + .7 * shade) * (.7 + .6 * mott) + .55 * Math.exp(-d / (deep[x] * .09))));
      if (o.tint) p.stain(o.tint, o.tintA * (1 - smooth(0, o.tintSpan ?? .7, t)) * (.5 + mott) * Math.min(1, fade * 1.5));
      if (o.foot) p.stain(o.foot, o.footA * smooth(.12, .5, t) * fade * (.55 + .9 * mott));
      const amount = cun(x, d, p.y, cunScale, seed, light, slope[x]);
      if (amount > 0) p.stain(ink, inkA * amount * (.22 + .78 * shade) * fade * (1 - smooth(.5, 1, t)) * smooth(.2, .58, p.tooth + .45 * shade));
    }
    if (d < lineW[x]) p.stain(ink, inkA * 1.25 * gap[x] * Math.sqrt(1 - Math.abs(d) / lineW[x]) * (.55 + .45 * p.tooth));
  });
}

// 山体里层层叠叠的小山头（矾头）：在母山的脊线下面鼓起一个个圆包，各有自己的轮廓和皴，从上往下画，下面的压着上面的。
// spots：[x, 离母山脊线多深, 半宽, 高]；style 是传给 mountain 的画法
export function lobes(S, parent, spots, style) {
  spots.forEach(([px, drop, pw, ph], j) => {
    const r = new Float32Array(S.w), topY = parent[Math.max(0, Math.min(S.w - 1, Math.round(px)))] + drop, seed = (style.seed ?? 1) + j * 7.7;
    for (let x = 0; x < S.w; x++) { const u = (x - px) / pw; r[x] = topY + ph * (1 - Math.exp(-u * u * 1.5)) + 8 * (fbm(x * .03 + seed, seed, 3) - .5); }
    mountain(S, { depth: ph + 70, ...style, ridge: r, seed, span: [px - pw * 1.3, px + pw * 1.3, pw * .55] });
  });
}

// 一带雾：把这一带擦回绢底。yc 中线，th 厚薄，wave 中线起伏多大，x0…x1 只擦这一段（两头渐隐）
export function mist(S, yc, th, { strength = 1, seed = 1, wave = 36, x0 = -1e6, x1 = 1e6, soft = 90 } = {}) {
  S.pass(yc - th * 2.3 - wave, yc + th * 2.3 + wave, p => {
    const u = (p.y - yc - wave * 2 * (fbm(p.x * .006 + seed, seed * 2, 3) - .5)) / th;
    p.lift(strength * Math.exp(-u * u) * (.62 + .5 * fbm(p.x * .014 + seed, p.y * .028, 3)) * smooth(x0 - soft, x0 + soft, p.x) * smooth(x1 + soft, x1 - soft, p.x));
  });
}
