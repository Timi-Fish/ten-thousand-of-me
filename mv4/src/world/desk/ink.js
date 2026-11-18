// 纸上的墨迹：整首歌词用楷体竖排、从右到左写满一张宣纸，右首是题目，左尾是落款和两方朱印。
// 产出一张数据贴图（不是颜色）：R 墨的浓度，G 朱砂的浓度，B 纸色的深浅（陈旧、折痕、水渍）。宣纸的着色器按这三样上色。
// 「像人写的」靠四样东西：字的大小、位置、歪斜各不相同；笔蘸一次墨写几个字，墨色从浓湿走到淡枯；
// 枯笔处顺着笔画方向拉出飞白；湿笔处笔画边缘积墨、向纸里洇开一圈。
import { PAPER } from '../layout.js';
import { clamp } from '../../anim.js';
import { canvas2d, stream, smooth, pointNoise, fbmField, kaiFont } from './kit.js';
import { stampSeals } from './stamp.js';

const SECTIONS = [
  ['拔下毫毛 吹一口气', '一万个我 落向四方', '各看各的 春秋冬夏', '回来只交 薄纸一张'],
  ['纸上的字 我都看见', '路上的风 吹不到脸'],
  ['一万个我 下山去', '一万张纸 回故乡', '一生只换 一页纸', '哪个是我 问月光'],
  ['天一亮就 全都忘记', '像喝过了 孟婆的汤', '只有枕边 昨夜的字', '一笔一画 替我收藏'],
  ['昨夜的我 今晨的我', '隔一场梦 是不是我'],
  ['一万个我 下山去', '一万张纸 回故乡', '一夜只剩 几个字', '哪个是我 问月光'],
  ['旧柴烧尽 化成灰', '新柴接过 这团火', '名字没换 柴已换', '这团火 是不是我'],
  ['低头一看 我手里', '也攥着 白纸一张'],
  ['一万个我 下山去', '一万张纸 回故乡', '出发时候 一个样', '回来各带 各的光', '我也是谁 一口气', '这首歌 是我那张'],
  ['柴换过了 火还亮', '哪个是我 问月光'],
];
const TITLE = '一万个我', SIGN = '月夜灯下小蟹自书';

const W = 4096, H = 4096, PW = PAPER.x1 - PAPER.x0, PD = PAPER.z1 - PAPER.z0, SX = W / PW, SZ = H / PD;   // 贴图尺寸，每单位多少像素
const TOP = PAPER.z0 + 1.9, BOTTOM = PAPER.z1 - 2.1;              // 正文一列的上下界（z）
const X_TITLE = 9.2, X_FIRST = 7.7, X_LAST = -7.6, X_SIGN = -9.05; // 题目、正文首列、正文末列、落款各在哪条竖线上（x）
const SIZE = .8, GAP = { char: .1, phrase: .42, line: .8, section: 1.45 };   // 正文字的大小；字、句、行、段之间的空

// 排版：把字一个个排进竖列，算出每个字的位置、大小、歪斜和这一笔的含墨量
function layout(g, kai) {
  const rand = stream(41), glyphs = [];
  g.font = `200px ${kai}`; g.textBaseline = 'alphabetic'; g.textAlign = 'center';
  const metric = ch => { const m = g.measureText(ch); return { asc: m.actualBoundingBoxAscent / 200, h: (m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) / 200, w: (m.actualBoundingBoxLeft + m.actualBoundingBoxRight) / 200 }; };
  // 一列字：从 z 往下写。fit 为真时写不下就换列。返回写到了第几列
  let load = 1;
  const write = (chars, { size, col0 = 0, z0, fit = false, dipAt = .42, jitter = 1 }) => {
    let col = col0, z = z0;
    for (const { ch, gap, phrase } of chars) {
      if ((phrase && load < dipAt + .22 * rand()) || load < .1) load = .9 + .1 * rand();   // 句首墨不够了就蘸一次墨
      const s = size * (.87 + .28 * rand() ** 1.5), m = metric(ch), slot = Math.max(m.h, .42) * s;
      let top = z === z0 ? z : z + gap;
      if (fit && top + slot > BOTTOM) { col++; top = z0; }
      glyphs.push({ ch, col, size: s, zBase: top + (slot - m.h * s) / 2 + m.asc * s, zMid: top + slot / 2, load,
        dx: (rand() - .5) * .13 * jitter, rot: (rand() - .5) * .11 * jitter - .012, wide: .94 + .1 * rand(), tone: (rand() - .5) * .08, heavy: rand() });
      z = top + slot + GAP.char * (size / SIZE);
      load -= .045 + .15 * m.h * m.w + .03 * rand();               // 笔画多的字吃墨多
    }
    return col;
  };
  const body = [];
  SECTIONS.forEach((lines, si) => lines.forEach((line, li) => line.split(' ').forEach((part, pi) => [...part].forEach((ch, ci) =>
    body.push({ ch, phrase: ci === 0, gap: ci ? GAP.char : pi ? GAP.phrase : li ? GAP.line : si ? GAP.section : 0 })))));
  const lastCol = write(body, { size: SIZE, z0: TOP, fit: true });
  const pitch = (X_FIRST - X_LAST) / lastCol;
  glyphs.forEach(q => { q.x = X_FIRST - q.col * pitch + .07 * Math.sin(q.zMid * .33 + q.col * 1.9); });   // 每列的中线微微摆动，不是尺子画的
  const n = glyphs.length;
  load = 1;
  write([...TITLE].map((ch, i) => ({ ch, gap: .16, phrase: i === 0 })), { size: 1.3, z0: TOP - .5, dipAt: .7, jitter: .7 });
  write([...SIGN].map((ch, i) => ({ ch, gap: i === 4 ? .34 : .06, phrase: i % 4 === 0 })), { size: .5, z0: TOP + 4.6, dipAt: .3, jitter: .8 });
  glyphs.slice(n).forEach((q, i) => { q.x = (i < TITLE.length ? X_TITLE : X_SIGN) + .03 * Math.sin(q.zMid * .9); });
  return { glyphs, signEnd: glyphs[glyphs.length - 1].zMid, columns: lastCol + 1, pitch };
}

// 把字画到画布上。颜色不是颜色而是这一笔的参数：R 墨色深浅，G 枯的程度，B 湿的程度；透明度是笔画的覆盖
function drawGlyphs(g, glyphs, kai) {
  const rand = stream(77);
  g.textBaseline = 'alphabetic'; g.textAlign = 'center'; g.lineJoin = 'round';
  for (const q of glyphs) {
    const f = q.size * SZ, dark = clamp(.42 + .5 * q.load ** .7 + q.tone), dry = clamp((.62 - q.load) / .42), wet = clamp((q.load - .55) / .4);
    g.save();
    g.translate((q.x + q.dx - PAPER.x0) * SX, (q.zBase - PAPER.z0) * SZ);
    g.rotate(q.rot); g.scale(SX / SZ * q.wide, 1);
    // 一个字之内也是先浓后淡：起笔在左上，收笔在右下
    const grad = g.createLinearGradient(-f * .4, -f * .8, f * .4, f * .1), rgb = (d, k) => `rgb(${Math.round(255 * d)},${Math.round(255 * k)},${Math.round(255 * wet)})`;
    grad.addColorStop(0, rgb(clamp(dark + .05), dry * .7)); grad.addColorStop(1, rgb(dark * .88, clamp(dry * 1.25 + .04)));
    g.fillStyle = g.strokeStyle = grad;
    g.font = `${f}px ${kai}`;
    g.lineWidth = f * (.002 + .016 * q.load + .012 * q.heavy);                     // 墨饱的时候笔画也肥
    g.strokeText(q.ch, 0, 0); g.fillText(q.ch, 0, 0);
    g.restore();
  }
  // 几点溅出来的墨星
  for (let i = 0; i < 14; i++) {
    const q = glyphs[Math.floor(rand() * glyphs.length)], r = (.012 + .03 * rand() ** 2) * SZ;
    g.fillStyle = `rgb(${200 + Math.round(55 * rand())},0,${Math.round(255 * rand())})`;
    g.beginPath(); g.ellipse((q.x - PAPER.x0 + (rand() - .5) * 1.1) * SX, (q.zMid - PAPER.z0 + (rand() - .5) * 1.1) * SZ, r, r * (.7 + .5 * rand()), rand() * 3, 0, 7); g.fill();
  }
}

// 笔画的走向：在 1/4 分辨率上由覆盖度的梯度算结构张量，取与梯度垂直的方向。返回一个查询函数
function strokeDirection(glyphCanvas) {
  const Q = W / 4, [, g] = canvas2d(Q, Q);
  g.drawImage(glyphCanvas, 0, 0, Q, Q);
  const d = g.getImageData(0, 0, Q, Q).data, a = new Float32Array(Q * Q);
  for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3] / 255;
  let xx = new Float32Array(Q * Q), xy = new Float32Array(Q * Q), yy = new Float32Array(Q * Q);
  for (let y = 1; y < Q - 1; y++) for (let x = 1, i = y * Q + 1; x < Q - 1; x++, i++) {
    const gx = a[i + 1] - a[i - 1], gy = a[i + Q] - a[i - Q];
    xx[i] = gx * gx; xy[i] = gx * gy; yy[i] = gy * gy;
  }
  const blur = src => {                                            // 3×3 的均值抹三遍，让一段笔画内的方向一致
    for (let pass = 0; pass < 3; pass++) {
      const out = new Float32Array(Q * Q);
      for (let y = 1; y < Q - 1; y++) for (let x = 1, i = y * Q + 1; x < Q - 1; x++, i++)
        out[i] = src[i - Q - 1] + src[i - Q] + src[i - Q + 1] + src[i - 1] + src[i] + src[i + 1] + src[i + Q - 1] + src[i + Q] + src[i + Q + 1];
      src = out;
    }
    return src;
  };
  xx = blur(xx); xy = blur(xy); yy = blur(yy);
  // 存成两倍角的 cos、sin：方向没有正反之分，这样存才能在格子之间平滑插值
  const c2 = new Float32Array(Q * Q), s2 = new Float32Array(Q * Q);
  for (let i = 0; i < c2.length; i++) {
    const twice = Math.atan2(2 * xy[i], xx[i] - yy[i]) + Math.PI;
    c2[i] = Math.cos(twice); s2[i] = Math.sin(twice);
  }
  // (x, y) 处（整张图的像素坐标）笔画走向的 [cos, sin]
  const at = (x, y) => {
    const fx = Math.min(Q - 1.001, Math.max(0, x / 4 - .5)), fy = Math.min(Q - 1.001, Math.max(0, y / 4 - .5)), ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy, i = iy * Q + ix;
    const mix = f => (f[i] * (1 - tx) + f[i + 1] * tx) * (1 - ty) + (f[i + Q] * (1 - tx) + f[i + Q + 1] * tx) * ty, along = .5 * Math.atan2(mix(s2), mix(c2));
    return [Math.cos(along), Math.sin(along)];
  };
  return at;
}

// 折痕的位置：正文每两列之间一道，首列右边和末列左边各一道
const foldLines = (columns, pitch) => Array.from({ length: columns + 1 }, (_, i) => X_FIRST + (.5 - i) * pitch);

// 纸色的深浅：四边发旧、云状的不匀、对着列线折出来的折痕、几点霉斑、一圈水渍。画在 1024 的画布上，白 = 干净
function paperTone(columns, pitch) {
  const S = 1024, [c, g] = canvas2d(S, S), rand = stream(53), ux = S / PW, uz = S / PD;
  const cloud = fbmField(S, S, 3, 3, 4, 5.1), img = g.createImageData(S, S), d = img.data;
  for (let i = 0; i < S * S; i++) { const v = 222 + 34 * (cloud[i] - .5) * 2; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; }
  g.putImageData(img, 0, 0);
  for (const [x0, y0, x1, y1] of [[0, 0, 0, 1], [0, S, 0, S - 1], [0, 0, 1, 0], [S, 0, S - 1, 0]]) {   // 四边旧一些
    const k = 150, grad = g.createLinearGradient(x0, y0, x0 + (x1 - x0) * k, y0 + (y1 - y0) * k);
    grad.addColorStop(0, 'rgba(120,120,120,.46)'); grad.addColorStop(.35, 'rgba(120,120,120,.13)'); grad.addColorStop(1, 'rgba(120,120,120,0)');
    g.fillStyle = grad; g.fillRect(0, 0, S, S);
  }
  // 折痕：写字前把纸按列折过，每两列之间一道；横着对折过一次。折痕是一明一暗两条细线
  const crease = (xa, ya, xb, yb, alpha) => {
    for (const [off, tone] of [[-.8, 255], [.8, 90]]) {
      g.strokeStyle = `rgba(${tone},${tone},${tone},${alpha})`; g.lineWidth = 1.3;
      g.beginPath(); g.moveTo(xa + (ya === yb ? 0 : off), ya + (ya === yb ? off : 0)); g.lineTo(xb + (ya === yb ? 0 : off), yb + (ya === yb ? off : 0)); g.stroke();
    }
  };
  for (const fold of foldLines(columns, pitch)) { const x = (fold - PAPER.x0) * ux; crease(x, 0, x + (rand() - .5) * 3, S, .1 + .1 * rand()); }
  crease(0, S * .5, S, S * .5 + 3, .22);
  for (let i = 0; i < 46; i++) {                                    // 霉斑
    const x = rand() * S, y = rand() * S, r = 2 + 9 * rand() ** 2, spot = g.createRadialGradient(x, y, 0, x, y, r);
    spot.addColorStop(0, `rgba(96,96,96,${.1 + .2 * rand()})`); spot.addColorStop(1, 'rgba(96,96,96,0)');
    g.fillStyle = spot; g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  // 水渍：近处右角溅过水，干了留下一圈深色的边
  g.save(); g.translate((8.6 - PAPER.x0) * ux, (9.6 - PAPER.z0) * uz);
  g.beginPath();
  for (let i = 0; i <= 40; i++) { const a = i / 40 * 6.2832, r = (1.25 + .22 * Math.sin(a * 3 + 1) + .12 * Math.sin(a * 7)) * ux; g.lineTo(r * Math.cos(a), r * .8 * Math.sin(a)); }
  g.fillStyle = 'rgba(255,255,255,.1)'; g.fill(); g.strokeStyle = 'rgba(105,105,105,.28)'; g.lineWidth = 2.2; g.filter = 'blur(1px)'; g.stroke();
  g.restore();
  return c;
}

// 逐像素把笔画变成墨：浓淡、飞白、积墨、洇。分带处理，免得一次把三张 4096 的图都读进内存
function inkPass(gGlyph, gSoft, gOut, dir) {
  const streakA = pointNoise(3), streakB = pointNoise(4), pool = pointNoise(5), fuzz = pointNoise(6), BAND = 256;
  for (let y0 = 0; y0 < H; y0 += BAND) {
    const sharp = gGlyph.getImageData(0, y0, W, BAND).data, soft = gSoft.getImageData(0, y0, W, BAND).data, out = gOut.getImageData(0, y0, W, BAND), o = out.data;
    for (let y = 0, p = 0; y < BAND; y++) {
      const Y = y0 + y;
      for (let x = 0; x < W; x++, p += 4) {
        o[p + 1] = 0;
        const ab = soft[p + 3] / 255;
        if (ab === 0) { o[p] = 0; continue; }
        const a = sharp[p + 3] / 255, dark = soft[p] / 255, dry = soft[p + 1] / 255, wet = soft[p + 2] / 255;
        let hair = 1;                                                                                    // 飞白：枯笔时笔毛分叉，顺着笔画露出一丝丝的白
        if (dry > .03 && a > 0) {
          const [cs, sn] = dir(x, Y), u = x * cs + Y * sn, v = Y * cs - x * sn;                          // 顺着笔画、横着笔画的坐标
          const streak = .6 * streakA(u / 70, v / 3.6) + .4 * streakB(u / 26, v / 1.9), cut = dry * .7 - .14;
          hair = .16 + .84 * smooth(cut - .18, cut + .18, streak);
        }
        const body = a * dark * (.8 + .4 * pool(x / 46, Y / 46)) * hair;
        const rim = wet * .32 * a * Math.max(0, a - ab) * 2;                                             // 积墨：湿笔的笔画边缘更深
        const bleed = wet * .5 * ab * (1 - a) * (.35 + 1.1 * fuzz(x / 2.6, Y / 2.6));                    // 洇：湿笔向纸里渗出一圈淡墨
        o[p] = 255 * clamp(body + rim + bleed);
      }
    }
    gOut.putImageData(out, 0, y0);
  }
}

// 画出整张墨迹贴图。返回 { canvas, folds }：画布，以及写字前按列折出来的那些折痕各在哪条竖线上（x，从右到左）
export function inkCanvas() {
  const kai = kaiFont(), [glyphCanvas, gGlyph] = canvas2d(W, H), [softCanvas, gSoft] = canvas2d(W, H), [outCanvas, gOut] = canvas2d(W, H);
  const { glyphs, signEnd, columns, pitch } = layout(gGlyph, kai);
  drawGlyphs(gGlyph, glyphs, kai);
  gSoft.filter = 'blur(2.6px)'; gSoft.drawImage(glyphCanvas, 0, 0);
  gOut.imageSmoothingQuality = 'high'; gOut.drawImage(paperTone(columns, pitch), 0, 0, W, H);
  inkPass(gGlyph, gSoft, gOut, strokeDirection(glyphCanvas));
  stampSeals(gOut, kai, (X_SIGN - PAPER.x0) * SX, (signEnd + .75 - PAPER.z0) * SZ, SX, SZ);
  glyphCanvas.width = glyphCanvas.height = softCanvas.width = softCanvas.height = 1;                     // 两张中间画布用完就放掉
  return { canvas: outCanvas, folds: foldLines(columns, pitch) };
}
