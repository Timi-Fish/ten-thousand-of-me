// 几卷卷轴：一卷斜搁在书摞上，两卷躺在书摞前面的案上。
// 每卷的外面裹着织锦的包首，两头露出卷起来的纸边和车出来的轴头，中间系着丝带（绕三圈、打一个结、两条带尾垂到案上），包首上贴着签条。
import * as THREE from 'three';
import { DESK, PAL } from '../layout.js';
import { D, TAU } from '../../anim.js';
import { canvas2d, stream, tex, kaiFont, extend, shadowed } from './kit.js';
import { lathe, ribbon, blob } from './geo.js';
import { STACK } from './books.js';

const SCROLLS = [
  { at: [STACK.x - .9, STACK.top, STACK.z + .5], yaw: 22, r: .56, len: 9.2, ground: '#2C3A68', figure: '#C7A562', knob: '#2A1C22', tie: PAL.vermilion, label: '月光帖', seed: 91 },
  { at: [STACK.x - 1.1, DESK.top, STACK.z + 4.9], yaw: -6, r: .62, len: 9.6, ground: '#6C3832', figure: '#D9BE86', knob: PAL.celadon, tie: '#D8C9A0', label: '下山图', seed: 92 },
  { at: [STACK.x - .8, DESK.top, STACK.z + 6.25], yaw: 4, r: .5, len: 8.8, ground: '#7C8B88', figure: '#E6E2D2', knob: PAL.rosewood, tie: '#3B4A6B', label: '四时屏稿', seed: 93 },
];
const TILE = 1.2;                                                  // 织锦的花一格多大

// 织锦：斜格子，格子的交点上一朵四瓣小花，格心一点；底上有经纬的细纹
function brocade(ground, figure, seed) {
  const S = 256, [c, g] = canvas2d(S, S), rand = stream(seed);
  g.fillStyle = ground; g.fillRect(0, 0, S, S);
  for (let i = 0; i < S; i += 2) { g.fillStyle = `rgba(255,255,255,${.02 + .05 * rand()})`; g.fillRect(0, i, S, 1); g.fillStyle = `rgba(0,0,0,${.03 + .06 * rand()})`; g.fillRect(i, 0, 1, S); }
  g.strokeStyle = figure; g.fillStyle = figure; g.lineWidth = 2.2; g.globalAlpha = .7;
  for (let k = -4; k <= 8; k++) { g.beginPath(); g.moveTo(k * 64, 0); g.lineTo(k * 64 + S, S); g.moveTo(k * 64, 0); g.lineTo(k * 64 - S, S); g.stroke(); }
  g.globalAlpha = .9;
  for (let j = 0; j <= 8; j++) for (let i = 0; i <= 4; i++) {
    const x = i * 64 + (j % 2) * 32, y = j * 32;
    for (let p = 0; p < 4; p++) { g.beginPath(); g.ellipse(x + 7 * Math.cos(p * TAU / 4), y + 7 * Math.sin(p * TAU / 4), 6, 3.2, p * TAU / 4, 0, TAU); g.fill(); }
    g.beginPath(); g.arc(x + 32, y, 2.6, 0, TAU); g.fill();
  }
  return c;
}
// 卷轴的端面：纸一圈圈卷起来的螺线，中心是轴杆
function rollEnd() {
  const S = 128, [c, g] = canvas2d(S, S), m = S / 2;
  g.fillStyle = '#D9CDB2'; g.fillRect(0, 0, S, S);
  g.strokeStyle = 'rgba(90,70,45,.55)'; g.lineWidth = 1.1; g.beginPath();
  for (let i = 0; i <= 900; i++) { const t = i / 900, a = t * 17 * TAU, r = m * (.2 + .78 * t); g.lineTo(m + r * Math.cos(a), m + r * Math.sin(a)); }
  g.stroke();
  g.fillStyle = '#3A2620'; g.beginPath(); g.arc(m, m, m * .2, 0, TAU); g.fill();
  return c;
}
// 签条：一小条旧纸，上面竖着写这一卷的名字。卷轴立起来时字是正的，躺着时字头朝着轴的一端
function slip(text) {
  const W = 72, H = 320, [c, g] = canvas2d(W, H);
  g.fillStyle = '#E6DBC2'; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(50,36,30,.7)'; g.lineWidth = 2; g.strokeRect(5, 5, W - 10, H - 10);
  g.fillStyle = PAL.ink; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `${W * .66}px ${kaiFont()}`;
  [...text].forEach((ch, i, all) => g.fillText(ch, W / 2, H * (.1 + (i + .5) / all.length * .8)));
  return c;
}

function scroll(spec, endMap) {
  const group = new THREE.Group(), { r, len } = spec, soft = (o, gloss = '.45') => extend(new THREE.MeshStandardMaterial({ roughness: .8, ...o }), { gloss });
  const wrapMap = tex(brocade(spec.ground, spec.figure, spec.seed), { srgb: true, repeat: [Math.round(TAU * r / TILE), len / TILE] });
  group.add(new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 44, 1, true).rotateZ(Math.PI / 2), soft({ map: wrapMap, roughness: .72 })));
  const knobMat = soft({ color: spec.knob, roughness: .45 }, '.6'), endMat = soft({ map: endMap, roughness: .9 }), k = r / .6;
  for (const s of [-1, 1]) {
    const end = new THREE.Mesh(new THREE.CircleGeometry(r * .985, 40), endMat);
    end.rotation.y = s * Math.PI / 2; end.position.x = s * len / 2;
    const knob = new THREE.Mesh(lathe([[.17, -.05], [.19, .08], [.33, .15], [.4, .27], [.37, .42], [.24, .52], [.1, .56], [0, .57]].map(([a, b]) => [a * k, b * k]), 28), knobMat);
    knob.rotation.z = -s * Math.PI / 2; knob.position.x = s * len / 2;
    group.add(end, knob);
  }
  // 包首收口的地方压着一根细木条（天杆），在朝上偏镜头的一侧
  const stave = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, len * .995, 8).rotateZ(Math.PI / 2), soft({ color: '#4A3026' }));
  stave.position.set(0, r * Math.cos(.9), r * Math.sin(.9));
  // 丝带：绕三圈，结打在天杆旁边，两条带尾顺着卷轴垂到案上再拖出去
  const tieMat = soft({ color: spec.tie, roughness: .65, side: THREE.DoubleSide }), knotAt = [0, (r + .05) * Math.cos(1.15), (r + .05) * Math.sin(1.15)];
  for (const x of [-.13, 0, .13]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(r + .018, .03, 6, 44).scale(1, 1, 2.6).rotateY(Math.PI / 2), tieMat);
    band.position.x = x; band.rotation.y = x * .5;
    group.add(band);
  }
  group.add(stave, new THREE.Mesh(blob(knotAt, [.13, .07, .1]), tieMat));
  for (const [s, reach] of [[-1, 2.5], [1, 1.9]]) {
    const pts = [knotAt, [s * .16, r * .32, r * 1.04], [s * .3, -r * .55, r * 1.2], [s * .5, -r + .03, r * 1.55], [s * .85, -r + .025, r * reach], [s * .8, -r + .02, r * (reach + .7)]];
    group.add(new THREE.Mesh(ribbon(pts, .15), tieMat));
  }
  // 签条贴在靠近画面中间那一头的包首上
  const tag = new THREE.Mesh(new THREE.CylinderGeometry(r + .008, r + .008, 2, 10, 1, true, 0, .42 / r).rotateZ(Math.PI / 2), soft({ map: tex(slip(spec.label), { srgb: true }), roughness: .9 }));
  tag.rotation.x = -.82; tag.position.x = -len / 2 + 1.9;
  group.add(tag);
  group.position.set(spec.at[0], spec.at[1] + r, spec.at[2]); group.rotation.y = spec.yaw * D;
  return group;
}

export function buildScrolls() {
  const group = new THREE.Group(), endMap = tex(rollEnd(), { srgb: true });
  for (const spec of SCROLLS) group.add(scroll(spec, endMap));
  return shadowed(group);
}
