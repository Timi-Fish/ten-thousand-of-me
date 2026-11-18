// 纹样：程序画出来的四种花纹，各占一张贴图的一个通道（0 = 底，255 = 纹），四方连续。
// 部件用顶点属性里的「纹样编号」选通道：1 回纹，2 祥云，3 竹编，4 绞绳。
import * as THREE from 'three';

const S = 256;
function sheet(paint) {
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, S, S);
  g.strokeStyle = g.fillStyle = '#fff'; g.lineCap = g.lineJoin = 'round';
  paint(g);
  return g.getImageData(0, 0, S, S).data;
}
const line = (g, pts) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); };
// 画的东西会越过边界时，在四周各补画一遍，接缝才对得上
const tiled = (g, paint) => { for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) { g.save(); g.translate(dx, dy); paint(); g.restore(); } };

// 回纹：一格一个方折的回旋，底下一道通长的线把它们串起来。贴图一格宽，带子多高一格就多宽
function fret(g) {
  const u = S / 8;
  g.lineWidth = u * .62; g.lineCap = g.lineJoin = 'miter';
  line(g, [[-u, 6.6 * u], [9 * u, 6.6 * u]]);
  line(g, [[1 * u, 6.6 * u], [1 * u, 1.4 * u], [6.6 * u, 1.4 * u], [6.6 * u, 4.9 * u], [3 * u, 4.9 * u], [3 * u, 3.15 * u], [4.9 * u, 3.15 * u]]);
}
// 祥云：三个往里卷的云头，底下拖一道云脚。两朵错开排
function cloud(g) {
  const curl = (cx, cy, r, turns, dir, from) => line(g, Array.from({ length: 41 }, (_, i) => { const k = i / 40, a = from + dir * k * turns * 2 * Math.PI, rr = r * (1 - .82 * k); return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)]; }));
  const motif = (cx, cy, s) => {
    g.lineWidth = 9 * s;
    curl(cx, cy - 12 * s, 30 * s, 1.3, -1, Math.PI * .5);
    curl(cx - 40 * s, cy + 8 * s, 19 * s, 1.15, 1, Math.PI * .45);
    curl(cx + 40 * s, cy + 8 * s, 19 * s, 1.15, -1, Math.PI * .55);
    g.beginPath(); g.moveTo(cx - 62 * s, cy + 27 * s); g.quadraticCurveTo(cx - 6 * s, cy + 40 * s, cx + 62 * s, cy + 28 * s); g.quadraticCurveTo(cx + 84 * s, cy + 24 * s, cx + 96 * s, cy + 34 * s); g.stroke();
  };
  tiled(g, () => { motif(70, 66, .82); motif(198, 194, .82); });
}
// 竹编：两组斜着的篾条，一上一下交错着压
function weave(g) {
  const d = S / 4, w = 13;
  tiled(g, () => {
    g.lineCap = 'butt'; g.lineWidth = w;
    for (let m = 0; m < 8; m++) line(g, [[m * d, 0], [m * d - S, S]]);                         // 第一组：整条画
    for (let k = -4; k < 4; k++) for (let m = 0; m < 8; m++) {                                 // 第二组：轮到它在上面的交叉点才盖过去
      if ((k + m) & 1) continue;
      const x = (k + m) * d / 2, y = (m - k) * d / 2, h = d * .36;
      g.strokeStyle = '#000'; g.lineWidth = w + 9; line(g, [[x - h, y - h], [x + h, y + h]]);
      g.strokeStyle = '#fff'; g.lineWidth = w; line(g, [[x - h * 1.25, y - h * 1.25], [x + h * 1.25, y + h * 1.25]]);
    }
  });
}
// 绞绳：一道道斜纹
function twist(g) {
  g.lineCap = 'butt'; g.lineWidth = S / 9;
  for (let k = -1; k < 6; k++) line(g, [[k * S / 4, -8], [k * S / 4 + S + 16, S + 8]]);
}

let made;
export function patterns() {
  if (made) return made;
  const layers = [fret, cloud, weave, twist].map(sheet), data = new Uint8Array(S * S * 4);
  for (let i = 0; i < S * S; i++) for (let c = 0; c < 4; c++) data[i * 4 + c] = layers[c][i * 4];
  made = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
  made.wrapS = made.wrapT = THREE.RepeatWrapping;
  made.generateMipmaps = true; made.minFilter = THREE.LinearMipmapLinearFilter; made.magFilter = THREE.LinearFilter; made.anisotropy = 8;
  made.needsUpdate = true;
  return made;
}
