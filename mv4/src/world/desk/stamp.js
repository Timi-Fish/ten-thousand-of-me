// 朱印：落款下面钤两方印。上面一方白文（红底白字）「小蟹」，两个字各占半边、拉得瘦长；下面一方朱文（白底红字、带边框）「问月」。
// 印泥不是平涂的：受力不匀、有没沾上的小白点、边缘毛糙。结果写进墨迹贴图的 G 通道。
import { canvas2d, pointNoise, smooth } from './kit.js';

const SEALS = [
  { text: '小蟹', cols: 2, w: 1.3, h: 1.3, carved: true, tilt: -.03, seed: 11 },
  { text: '问月', cols: 1, w: .78, h: 1.24, carved: false, tilt: .04, seed: 12 },
];

// 印面的黑白图：白 = 沾印泥的地方。字从右列往左列、每列从上往下排
function sealFace(seal, kai, w, h) {
  const pad = 8, [, g] = canvas2d(w + pad * 2, h + pad * 2), rows = seal.text.length / seal.cols, cw = w / seal.cols, chh = h / rows, edge = w * .075;
  g.fillStyle = '#000'; g.fillRect(0, 0, w + pad * 2, h + pad * 2);
  g.translate(pad + w / 2, pad + h / 2); g.rotate(seal.tilt); g.translate(-w / 2, -h / 2);
  g.fillStyle = g.strokeStyle = '#fff'; g.lineJoin = 'round';
  if (seal.carved) { g.beginPath(); g.roundRect(0, 0, w, h, w * .06); g.fill(); g.fillStyle = g.strokeStyle = '#000'; }
  else { g.lineWidth = edge; g.beginPath(); g.roundRect(edge / 2, edge / 2, w - edge, h - edge, w * .05); g.stroke(); }
  const inner = seal.carved ? .07 : .13, f = chh * (1 - inner * 2) * .9;
  g.font = `bold ${f}px ${kai}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = f * (seal.carved ? .03 : .05);
  [...seal.text].forEach((ch, i) => {
    const col = Math.floor(i / rows), row = i % rows;
    g.save();
    g.translate(w - (col + .5) * cw + (seal.cols > 1 ? (col ? 1 : -1) * w * .02 : 0), (row + .5) * chh + (rows > 1 ? (row ? -1 : 1) * h * .02 : 0));
    g.scale(Math.min(1.15, cw * (1 - inner * 1.6) / f), 1);
    g.strokeText(ch, 0, f * .04); g.fillText(ch, 0, f * .04);
    g.restore();
  });
  g.setTransform(1, 0, 0, 1, 0, 0); g.filter = 'blur(1.3px)'; g.drawImage(g.canvas, 0, 0);            // 抹一下，后面按噪声切边，边缘才毛
  return { data: g.getImageData(0, 0, w + pad * 2, h + pad * 2).data, pad };
}

// g：墨迹贴图的画布；cx、top：第一方印的中线和上沿（像素）；SX、SZ：每单位多少像素
export function stampSeals(g, kai, cx, top, SX, SZ) {
  for (const seal of SEALS) {
    const w = Math.round(seal.w * SX), h = Math.round(seal.h * SZ), { data, pad } = sealFace(seal, kai, w, h), W = w + pad * 2, Hh = h + pad * 2;
    const x0 = Math.round(cx - W / 2), y0 = Math.round(top - pad), out = g.getImageData(x0, y0, W, Hh), o = out.data;
    const grit = pointNoise(seal.seed), patch = pointNoise(seal.seed + .5), speck = pointNoise(seal.seed + .9);
    for (let y = 0, p = 0; y < Hh; y++) for (let x = 0; x < W; x++, p += 4) {
      const press = .8 + .2 * smooth(-.2, .9, (x / W) * .6 + (1 - y / Hh) * .5);                        // 盖的时候右上用力重，左下轻
      const paste = smooth(.38, .6, data[p] / 255 + (grit(x / 2.2, y / 2.2) - .5) * .28) * (.76 + .24 * patch(x / 15, y / 15)) * press;
      o[p + 1] = Math.max(o[p + 1], 255 * paste * (speck(x / 2.4, y / 2.4) > .84 ? .35 : 1));
    }
    g.putImageData(out, x0, y0);
    top += h + .3 * SZ;
  }
}
