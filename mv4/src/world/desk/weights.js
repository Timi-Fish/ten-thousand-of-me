// 两条镇尺：乌木的长条压在宣纸左右两边。顶面是平的，嵌一副金字的七字联（取自歌词，右为上联）；
// 两个长侧面嵌银丝回纹，中间一排螺钿的月相，从新月到满月再到残月，月与月之间是卷云；两头包铜，铜上是浅浮雕的回纹和联珠。
import * as THREE from 'three';
import { WEIGHTS, PAL } from '../layout.js';
import { clamp, TAU } from '../../anim.js';
import { canvas2d, tex, channel, normalCanvas, fbmField, kaiFont, extend, shadowed } from './kit.js';
import { extrudeZ, capZ, arcPoints } from './geo.js';
import { grainTextures } from './wood.js';

const CAP = 1.05, R = .12, FOOT = .17, PX = 188;                   // 包铜的长度；顶边倒圆的半径；底座线脚的高度；嵌饰贴图每单位多少像素
const COUPLET = ['一万张纸回故乡', '一万个我下山去'];              // 左、右两条镇尺顶面的字
const SILVER = '#CDD3E0', GOLD = PAL.gold;

// 截面（从 +z 一侧看逆时针）：底座略宽，收一道线脚，直身，顶边倒圆。body：直身的半宽
function section(cx, top, body, foot) {
  return [[cx + foot, 0], [cx + foot, .1], [cx + body, FOOT], ...arcPoints(cx + body - R, top - R, R, 0, Math.PI / 2, 5),
    ...arcPoints(cx - body + R, top - R, R, Math.PI / 2, Math.PI, 5), [cx - body, FOOT], [cx - foot, .1], [cx - foot, 0]];
}

// 顶面的嵌饰（透明底）：银丝的双线边框，七个填金的字，字与字之间一粒银星
function topInlay(text, len, width) {
  const W = Math.round(width * PX), H = Math.round(len * PX), [c, g] = canvas2d(W, H), pitch = 1.34 * PX, f = .66 * PX;
  g.strokeStyle = SILVER; g.lineWidth = 2.4; g.strokeRect(7, 12, W - 14, H - 24);
  g.lineWidth = 1.2; g.strokeRect(13, 18, W - 26, H - 36);
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  [...text].forEach((ch, i) => {
    const y = H / 2 + (i - 3) * pitch, fill = g.createLinearGradient(0, y - f / 2, 0, y + f / 2);
    fill.addColorStop(0, '#F3D58E'); fill.addColorStop(.5, GOLD); fill.addColorStop(1, '#B98A3E');
    g.font = `bold ${f}px ${kaiFont()}`;
    g.strokeStyle = 'rgba(30,16,8,.9)'; g.lineWidth = 5; g.strokeText(ch, W / 2, y);                 // 字是刻下去再填金的，刻口留一圈深色
    g.fillStyle = fill; g.fillText(ch, W / 2, y);
    if (i < 6) { g.fillStyle = SILVER; g.save(); g.translate(W / 2, y + pitch / 2); g.rotate(Math.PI / 4); g.fillRect(-4, -4, 8, 8); g.restore(); }
  });
  for (const y of [H / 2 - 3.5 * pitch - 20, H / 2 + 3.5 * pitch + 20]) cloud(g, W / 2, y, 30, SILVER, 2.2);
  return c;
}

// 卷云：左右两个往里卷的涡，中间一道弧连起来
function cloud(g, x, y, size, color, lineWidth) {
  g.strokeStyle = color; g.lineWidth = lineWidth; g.lineCap = 'round';
  for (const side of [-1, 1]) {
    g.beginPath();
    for (let i = 0; i <= 40; i++) { const t = i / 40, a = Math.PI / 2 - side * t * 2.6 * Math.PI, r = size * .5 * (1 - .78 * t); g.lineTo(x + side * size * .62 + r * Math.cos(a), y - size * .1 + r * Math.sin(a)); }
    g.stroke();
  }
  g.beginPath(); g.moveTo(x - size * .62, y + size * .4); g.quadraticCurveTo(x, y + size * .15, x + size * .62, y + size * .4); g.stroke();
}

// 月相：f 是亮的比例，side = 1 右边亮（上弦），-1 左边亮（下弦）。螺钿是亮的那部分，整个圆用银丝勾边
function moon(g, x, y, r, f, side) {
  g.save(); g.translate(x, y); g.scale(side, 1);
  const pearl = g.createRadialGradient(-r * .3, -r * .3, 0, 0, 0, r * 1.1);
  pearl.addColorStop(0, '#FBFDF6'); pearl.addColorStop(.5, '#DDE9E4'); pearl.addColorStop(.8, '#E6D9E6'); pearl.addColorStop(1, '#C9DDD8');
  g.fillStyle = pearl; g.beginPath();
  g.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);
  g.ellipse(0, 0, r * Math.abs(1 - 2 * f), r, 0, Math.PI / 2, -Math.PI / 2, f < .5);
  g.fill();
  g.strokeStyle = SILVER; g.lineWidth = 1.6; g.beginPath(); g.arc(0, 0, r + 1.5, 0, TAU); g.stroke();
  g.restore();
}

// 长侧面的嵌饰（透明底）：上下各一道银丝回纹，中间九个月相和卷云
function sideInlay(len, height) {
  const W = Math.round(len * PX), H = Math.round(height * PX), [c, g] = canvas2d(W, H), unit = 26, band = 22;
  g.strokeStyle = SILVER; g.lineJoin = 'miter';
  for (const [y0, flip] of [[10, 1], [H - 10, -1]]) {
    g.lineWidth = 1.5; g.beginPath(); g.moveTo(8, y0); g.lineTo(W - 8, y0); g.moveTo(8, y0 + flip * (band + 8)); g.lineTo(W - 8, y0 + flip * (band + 8)); g.stroke();
    g.lineWidth = 2;
    for (let x = 14; x + unit < W - 10; x += unit + 5) {              // 回纹：一个个方形的涡
      g.beginPath();
      for (const [u, v] of [[0, 1], [0, 0], [1, 0], [1, .78], [.3, .78], [.3, .34], [.68, .34]]) g.lineTo(x + u * unit, y0 + flip * (4 + v * band));
      g.stroke();
    }
  }
  const phases = [.08, .26, .5, .78, 1, .78, .5, .26, .08], step = W / (phases.length + 1), y = H / 2, r = .2 * PX;
  phases.forEach((f, i) => {
    moon(g, step * (i + 1), y, i === 4 ? r * 1.15 : r, f, i < 4 ? 1 : -1);
    if (i) cloud(g, step * (i + .5), y + 4, 34, SILVER, 2);
  });
  for (const x of [step * .45, W - step * .45]) cloud(g, x, y + 4, 34, SILVER, 2);
  return c;
}

// 浮雕用的小件：一粒凸起的珠子、一个方形的回纹涡
function bead(g, x, y, r) {
  const grad = g.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, '#f0f0f0'); grad.addColorStop(.7, '#c0c0c0'); grad.addColorStop(1, '#585858');
  g.fillStyle = grad; g.fillRect(x - r, y - r, 2 * r, 2 * r);
}
function fret(g, x, y, w, h) {
  g.beginPath();
  for (const [u, v] of [[0, .96], [0, .1], [1, .1], [1, .78], [.3, .78], [.3, .38], [.7, .38]]) g.lineTo(x + u * w, y + v * h);
  g.stroke();
}
// 包铜的箍（贴图沿截面方向可平铺）：两道凸边、两列联珠、中间一圈回纹
function bandRelief(g, W, H) {
  g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, 16, H); g.fillRect(W - 16, 0, 16, H);
  g.fillStyle = '#a8a8a8'; g.fillRect(26, 0, 5, H); g.fillRect(W - 31, 0, 5, H);
  for (let y = 16; y < H; y += 32) for (const x of [50, W - 50]) bead(g, x, y, 10);
  g.strokeStyle = '#e4e4e4'; g.lineWidth = 8; g.lineJoin = 'miter';
  for (let y = 0; y < H; y += 64) fret(g, 74, y, 108, 64);
}
// 镇尺两头的端面：一圈凸边，四角各一粒珠，中间一个大的方涡（回纹）
function endRelief(g, W, H) {
  g.strokeStyle = '#d8d8d8'; g.lineWidth = 12; g.strokeRect(20, 20, W - 40, H - 40);
  g.strokeStyle = '#a0a0a0'; g.lineWidth = 4; g.strokeRect(38, 38, W - 76, H - 76);
  for (const x of [56, W - 56]) for (const y of [56, H - 56]) bead(g, x, y, 9);
  g.strokeStyle = '#e4e4e4'; g.lineWidth = 13; g.lineJoin = 'miter'; g.beginPath();
  for (const [u, v] of [[.3, .74], [.3, .26], [.74, .26], [.74, .74], [.44, .74], [.44, .4], [.6, .4], [.6, .6]]) g.lineTo(u * W, v * H);
  g.stroke();
}
// 铜的贴图：由浮雕的高度得出颜色和法线。凹处发暗、生铜绿，凸处磨得发亮
function bronzeTextures(W, H, relief, seed) {
  const [, g] = canvas2d(W, H);
  g.fillStyle = '#585858'; g.fillRect(0, 0, W, H);
  relief(g, W, H);
  g.filter = 'blur(1.6px)'; g.drawImage(g.canvas, 0, 0); g.filter = 'none';
  const h = channel(g, W, H), mott = fbmField(W, H, 4, 4 * H / W, 4, seed), rust = fbmField(W, H, 6, 6 * H / W, 5, seed + .3, .62), [color, gc] = canvas2d(W, H), img = gc.createImageData(W, H), d = img.data;
  const dark = [44, 32, 22], mid = new THREE.Color(PAL.bronze).multiplyScalar(255).toArray(), light = [196, 164, 100], green = [70, 138, 118];
  for (let i = 0; i < W * H; i++) {
    const t = clamp((h[i] - .3) * 1.5 + (mott[i] - .5) * .5), k = t < .5 ? t * 2 : (t - .5) * 2, a = t < .5 ? dark : mid, b = t < .5 ? mid : light;
    const patina = clamp((.62 - h[i]) * 3) * clamp((rust[i] - .48) * 4) * .7;
    for (let ch = 0; ch < 3; ch++) d[i * 4 + ch] = (a[ch] + (b[ch] - a[ch]) * k) * (1 - patina) + green[ch] * patina;
    d[i * 4 + 3] = 255;
    h[i] += (mott[i] - .5) * .08;
  }
  gc.putImageData(img, 0, 0);
  return { map: tex(color, { srgb: true, repeat: [1, 1] }), normalMap: tex(normalCanvas(h, W, H, 3.2), { repeat: [1, 1] }) };
}

// 嵌饰是贴在木头表面上的一层透明底的薄片
const overlay = canvas => extend(new THREE.MeshStandardMaterial({ map: tex(canvas, { srgb: true }), transparent: true, depthWrite: false, roughness: .6, metalness: .1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), { gloss: '.4' });

// 返回 { group, perches }：perches 是两条镇尺顶面上的落脚点，每条 12 个，沿长边均匀排开
export function buildWeights() {
  const group = new THREE.Group(), inlays = new THREE.Group(), perches = [];
  const ebony = extend(new THREE.MeshStandardMaterial({ ...grainTextures([2.4, .8]), color: '#8C7E9C', roughness: .64, normalScale: new THREE.Vector2(.22, .22) }), { gloss: '.35' });
  const metal = (t, bump) => extend(new THREE.MeshStandardMaterial({ ...t, roughness: .6, metalness: .25, normalScale: new THREE.Vector2(bump, bump) }), { gloss: '.5' });
  const bronze = metal(bronzeTextures(256, 1024, bandRelief, 9.1), .9), plaque = metal(bronzeTextures(256, 256, endRelief, 9.6), 1.1);
  const sideCanvas = sideInlay(WEIGHTS[0].z1 - WEIGHTS[0].z0 - 2 * CAP, WEIGHTS[0].top - R - FOOT - .1), sideMat = overlay(sideCanvas);
  WEIGHTS.forEach((w, k) => {
    const body = w.w / 2 - .08, len = w.z1 - w.z0 - 2 * CAP, zMid = (w.z0 + w.z1) / 2, sideH = w.top - R - FOOT - .1, hoop = section(w.x, w.top, w.w / 2 - .035, w.w / 2);
    group.add(new THREE.Mesh(extrudeZ(section(w.x, w.top, body, w.w / 2 - .02), w.z0 + CAP, w.z1 - CAP), ebony));
    for (const z of [w.z0, w.z1 - CAP]) {
      group.add(new THREE.Mesh(extrudeZ(hoop, z, z + CAP), bronze), new THREE.Mesh(capZ(hoop, z, -1), plaque), new THREE.Mesh(capZ(hoop, z + CAP, 1), plaque));
    }
    const top = new THREE.Mesh(new THREE.PlaneGeometry((body - R) * 2 - .04, len), overlay(topInlay(COUPLET[k], len, (body - R) * 2 - .04)));
    top.rotation.x = -Math.PI / 2; top.position.set(w.x, w.top + .002, zMid);
    inlays.add(top);
    for (const side of [-1, 1]) {
      const face = new THREE.Mesh(new THREE.PlaneGeometry(len, sideH), sideMat);
      face.rotation.y = side * Math.PI / 2; face.position.set(w.x + side * (body + .002), (FOOT + .05 + w.top - R - .05) / 2, zMid);
      inlays.add(face);
    }
    for (let i = 0; i < 12; i++) perches.push(new THREE.Vector3(w.x, w.top, w.z0 + (i + .5) / 12 * (w.z1 - w.z0)));
  });
  shadowed(group); shadowed(inlays, false, true);                  // 嵌饰贴在木头表面上，只接收投影
  group.add(inlays);
  return { group, perches };
}
