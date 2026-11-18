// 梅瓶：小口、短颈、丰肩、往下收到一圈足的青花瓷瓶，坐在一只矮矮的红木座上。
// 釉下的青花从下到上是：足上一圈仰莲瓣、腹部的缠枝莲、肩上一圈如意云头，各段之间用双线隔开。
import * as THREE from 'three';
import { PROPS } from '../layout.js';
import { TAU } from '../../anim.js';
import { TOP, stream, pick, turn, turnEven, mesh, soft, canvasTex } from './kit.js';

const SEAT = .5;                                                    // 木座的高度
export const MOUTH = { y: SEAT + 12.42, r: .62 };                   // 瓶口：高度（从案面算）和内半径。梅枝从这里出来
// 瓶身的轮廓（半径、高度）：从足往上到颈根
const BODY = [[1.78, .14], [1.72, .9], [1.78, 2.4], [2.08, 4.3], [2.62, 6.5], [3.04, 8.4], [3.08, 9.4], [2.74, 10.45], [1.9, 11.2], [1.08, 11.56], [.84, 11.8]];

// 青花。画布横向绕瓶一圈，纵向从足（下）到颈（上），按沿瓶身走过的长度均匀展开
function paint(g, w, h) {
  const rand = stream(88), Y = v => h * (1 - v);
  g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, w, h);
  g.lineCap = 'round'; g.lineJoin = 'round';
  const blue = a => `rgba(${36 + Math.round(rand() * 14)},${58 + Math.round(rand() * 16)},${138 + Math.round(rand() * 20)},${a})`;
  g.shadowColor = 'rgba(40,62,140,.6)'; g.shadowBlur = 3;            // 青料在釉下微微晕开
  const rule = (v, lw) => { g.strokeStyle = blue(.9); g.lineWidth = lw; g.beginPath(); g.moveTo(0, Y(v)); g.lineTo(w, Y(v)); g.stroke(); };
  [[.035, 5], [.05, 2.5], [.16, 2.5], [.175, 5], [.665, 5], [.68, 2.5], [.87, 2.5], [.885, 5], [.965, 4]].forEach(([v, lw]) => rule(v, lw));
  // 足上的仰莲瓣：一圈尖头朝上的瓣，瓣里再套一层
  const N1 = 22;
  for (let i = 0; i < N1; i++) {
    const cx = (i + .5) / N1 * w, hw = w / N1 * .44, y0 = Y(.055), y1 = Y(.152);
    for (const k of [1, .58]) {
      g.strokeStyle = blue(.92); g.fillStyle = blue(k === 1 ? .12 : .3); g.lineWidth = k === 1 ? 4 : 2.5;
      g.beginPath(); g.moveTo(cx - hw * k, y0); g.bezierCurveTo(cx - hw * k, y0 + (y1 - y0) * .6, cx - hw * k * .5, y1 - (y1 - y0) * .15 * k, cx, y1 + (y0 - y1) * (1 - k) * .5);
      g.bezierCurveTo(cx + hw * k * .5, y1 - (y1 - y0) * .15 * k, cx + hw * k, y0 + (y1 - y0) * .6, cx + hw * k, y0); g.fill(); g.stroke();
    }
    g.fillStyle = blue(.5); g.beginPath(); g.ellipse(cx, y0 + (y1 - y0) * .3, hw * .22, (y0 - y1) * .16, 0, 0, TAU); g.fill();
  }
  // 腹部的缠枝莲：两根藤一上一下交错着走，围出一个个「眼」，每个眼里开一朵莲；藤的外侧长着卷叶和卷须，把上下的空处填满
  const mid = Y(.42), amp = h * .088, P = 6, cell = w / (P * 2), wave = x => Math.sin(x / w * TAU * P) * amp;
  for (const s of [1, -1]) {
    g.strokeStyle = blue(.95); g.lineWidth = 5.5; g.beginPath();
    for (let x = 0; x <= w; x += 5) g.lineTo(x, mid + s * wave(x));
    g.stroke();
  }
  const lotus = (cx, cy, s) => {
    for (let ring = 0; ring < 2; ring++) for (let i = 0; i < (ring ? 7 : 11); i++) {
      const a = i / (ring ? 7 : 11) * TAU + ring * .3, len = s * (ring ? .55 : 1);
      g.save(); g.translate(cx, cy); g.rotate(a);
      g.fillStyle = blue(ring ? .85 : .55); g.strokeStyle = blue(.95); g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(len * .22, 0); g.quadraticCurveTo(len * .6, -len * .3, len, 0); g.quadraticCurveTo(len * .6, len * .3, len * .22, 0); g.fill(); g.stroke();
      g.restore();
    }
    g.fillStyle = blue(.95); g.beginPath(); g.arc(cx, cy, s * .2, 0, TAU); g.fill();
  };
  const leafOn = (x, y, a, s) => {
    g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = blue(.8);
    g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(s * .3, -s * .42, s * .8, -s * .3, s, 0); g.bezierCurveTo(s * .8, s * .2, s * .3, s * .3, 0, 0); g.fill();
    g.strokeStyle = blue(.9); g.lineWidth = 2.5; g.beginPath(); g.moveTo(s, 0); g.quadraticCurveTo(s * 1.25, -s * .1, s * 1.3, -s * .32); g.stroke();   // 叶尖带出一小段卷须
    g.restore();
  };
  const tendril = (x, y, r, dir, flip) => {
    g.strokeStyle = blue(.9); g.lineWidth = 3; g.beginPath();
    for (let t = 0; t <= 1; t += .04) { const a = t * 5 * dir, rr = r * (1 - t * .82); g.lineTo(x + Math.cos(a) * rr - r, y + Math.sin(a) * rr * flip); }
    g.stroke();
  };
  for (let i = 0; i < P * 2; i++) {
    const x = (i + .5) * cell;
    lotus(x, mid, h * (i % 2 ? .05 : .058));
    g.fillStyle = blue(.9); g.beginPath(); g.arc(i * cell, mid, 9, 0, TAU); g.fill();   // 两根藤交叉的地方结一个小花苞
    for (const s of [1, -1]) {                                         // s = 1 是眼的下沿外面，-1 是上沿外面
      const top = mid + s * Math.abs(wave(x));
      for (let k = 0; k < 3; k++) {
        const lx = x + (k - 1) * cell * .36, ly = mid + s * Math.abs(wave(lx)), a = s * (Math.PI / 2 + (k - 1) * pick(rand, .5, .8));
        leafOn(lx, ly, a, pick(rand, 62, 92) * (k === 1 ? 1.15 : 1));
      }
      tendril(x + cell * .5, top + s * h * .075, h * .034, i % 2 ? 1 : -1, s);
      tendril(x + cell * .1, top + s * h * .118, h * .026, i % 2 ? -1 : 1, s);
      for (let k = 0; k < 2; k++) leafOn(x + cell * (.5 + (k - .5) * .5), mid + s * (amp * .25 + h * .01), s * (Math.PI / 2) + (k ? .9 : -.9) * s, pick(rand, 40, 56));
    }
  }
  // 肩上的如意云头：一圈朝下垂的云头，里面点一朵小花
  const N2 = 9;
  for (let i = 0; i < N2; i++) {
    const cx = (i + .5) / N2 * w, s = w / N2 * .43, y0 = Y(.868), dy = (Y(.69) - y0) * .9;
    g.strokeStyle = blue(.95);
    for (const k of [1, .72]) {
      g.fillStyle = blue(k === 1 ? .16 : .2);                          // 云头里淡淡地罩一层青
      g.lineWidth = k === 1 ? 4.5 : 2.5; g.beginPath(); g.moveTo(cx - s * k, y0);
      g.bezierCurveTo(cx - s * k, y0 + dy * .45, cx - s * k * 1.1, y0 + dy * .75 * k, cx - s * .38 * k, y0 + dy * .72 * k);
      g.bezierCurveTo(cx - s * .1 * k, y0 + dy * .7 * k, cx - s * .12 * k, y0 + dy * .95 * k, cx, y0 + dy * k);
      g.bezierCurveTo(cx + s * .12 * k, y0 + dy * .95 * k, cx + s * .1 * k, y0 + dy * .7 * k, cx + s * .38 * k, y0 + dy * .72 * k);
      g.bezierCurveTo(cx + s * k * 1.1, y0 + dy * .75 * k, cx + s * k, y0 + dy * .45, cx + s * k, y0); g.fill(); g.stroke();
    }
    lotus(cx, y0 + dy * .36, s * .26);
  }
  for (let i = 0; i < 60; i++) { g.fillStyle = blue(.5); g.beginPath(); g.arc((i + .5) / 60 * w, Y(.925), 5, 0, TAU); g.fill(); }   // 颈根一圈小点
}

export function buildVase() {
  const group = new THREE.Group();
  const porcelain = extra => soft({
    color: '#F1F4F2', roughness: .58, rim: .4, rimColor: '#D2E0FF', rimPow: 2.3, emissive: '#262E3C', emissiveIntensity: .28,
    albedo: 'col *= .95 + .08 * fbm(p * .9);', ...extra,
  });
  const body = turnEven(BODY, 96, 110);
  group.add(mesh(body.geo, porcelain({ map: canvasTex(2048, 1536, paint) })));
  // 足和口：足底一圈露胎，颈上是外翻的厚唇，往里是瓶口
  group.add(mesh(turn([[[1.6, 0], [1.74, 0], [1.8, .05]], [[1.8, .05], [1.78, .14]]], 96), soft({ color: '#CDBFA6', roughness: .9, rim: .1 })));
  group.add(mesh(turn([[[.84, 11.8], [.8, 12.02], [.98, 12.24], [1.06, 12.36], [.98, 12.44], [.8, 12.42]], [[.8, 12.42], [.66, 12.2], [MOUTH.r, 11.6], [MOUTH.r, 10.6]], [[MOUTH.r, 10.6], [0, 10.6]]], 64), porcelain({ color: '#E9EEF0' })));
  group.children.forEach(m => { m.position.y = SEAT; });
  // 木座：束腰的小圆座
  const wood = soft({ color: '#4A2226', roughness: .6, rim: .22, rimColor: '#C9B6E8', albedo: 'float g = fbm(vec3(p.x * 2., p.y * 9., p.z * 2.)); col *= .6 + .8 * g;' });
  group.add(mesh(turn([[[0, 0], [2.2, 0], [2.3, .05]], [[2.3, .05], [2.3, .13], [2.12, .2], [2.05, .3], [2.2, .38]], [[2.2, .38], [2.26, .44], [2.2, SEAT], [0, SEAT]]], 96), wood));
  const [cx, cz] = PROPS.vase.c;
  group.position.set(cx, TOP, cz);
  return { group, update() {}, mouth: new THREE.Vector3(cx, TOP + MOUTH.y, cz) };
}
