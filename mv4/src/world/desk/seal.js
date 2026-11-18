// 印泥盒和一方印。盒是青花瓷的小圆盒，盖子往后推开一半、斜搭在盒口上，露出堆得冒尖的朱砂印泥；盖面画一只螃蟹。
// 印是一方寿山石，印钮雕成一只趴着的小蟹，印脚沾着没擦净的印泥。
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PROPS, DESK, PAL } from '../layout.js';
import { clamp, TAU } from '../../anim.js';
import { canvas2d, tex, normalCanvas, fbmField, noiseField, extend, shadowed } from './kit.js';
import { lathe, rod, blob } from './geo.js';

const BOX_R = .9, COBALT = '#2F4E96';
const glaze = map => extend(new THREE.MeshStandardMaterial({ map, color: PAL.porcelain, roughness: .36, side: THREE.DoubleSide }), { gloss: '.55' });

// 用毛笔画一笔青花：一条粗细有变化的线，中间浓、两头淡
function stroke(g, pts, width, alpha = .85) {
  g.strokeStyle = COBALT; g.lineCap = 'round'; g.lineJoin = 'round';
  for (const [k, a] of [[1, alpha * .5], [.55, alpha]]) {
    g.lineWidth = width * k; g.globalAlpha = a; g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.stroke();
  }
  g.globalAlpha = 1;
}
// 釉面的底色：白里带一点青，有极淡的不匀
function glazeBase(g, W, H, seed) {
  const n = fbmField(W, H, 4, Math.max(1, Math.round(4 * H / W)), 3, seed), img = g.createImageData(W, H), d = img.data;
  for (let i = 0; i < W * H; i++) { const v = 238 + 14 * (n[i] - .5); d[i * 4] = v - 4; d[i * 4 + 1] = v; d[i * 4 + 2] = v + 2; d[i * 4 + 3] = 255; }
  g.putImageData(img, 0, 0);
}
// 盖面（从上往下看）：两道弦纹围着一只螃蟹，外圈一周如意云头
function lidTexture() {
  const S = 512, [c, g] = canvas2d(S, S), m = S / 2;
  glazeBase(g, S, S, 4.1);
  g.strokeStyle = COBALT; g.globalAlpha = .8;
  for (const [r, w] of [[.6, 4], [.655, 2], [.93, 5]]) { g.lineWidth = w; g.beginPath(); g.arc(m, m, m * r, 0, TAU); g.stroke(); }
  g.globalAlpha = 1;
  for (let i = 0; i < 16; i++) {                                   // 如意云头：一个个小拱，拱里一点
    const a = i / 16 * TAU, x = m + m * .79 * Math.cos(a), y = m + m * .79 * Math.sin(a);
    g.save(); g.translate(x, y); g.rotate(a + Math.PI / 2);
    stroke(g, [[-17, 12], [-15, -4], [-6, -13], [0, -8], [6, -13], [15, -4], [17, 12]], 5);
    g.fillStyle = COBALT; g.globalAlpha = .8; g.beginPath(); g.arc(0, 3, 3.4, 0, TAU); g.fill(); g.globalAlpha = 1;
    g.restore();
  }
  // 螃蟹：甲壳一团浓淡相叠的青，八条腿各两节，两只大螯
  g.save(); g.translate(m, m + 6); g.rotate(-.35);
  for (const [rx, ry, a] of [[66, 46, .45], [56, 37, .5], [36, 22, .6]]) { g.fillStyle = COBALT; g.globalAlpha = a; g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, TAU); g.fill(); }
  g.globalAlpha = 1;
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) { const y = -18 + i * 15, reach = 44 + (i === 1 || i === 2 ? 12 : 0); stroke(g, [[side * 56, y], [side * (56 + reach), y - 22 + i * 11], [side * (62 + reach * 1.5), y + 14 + i * 6]], 9); }
    stroke(g, [[side * 40, -36], [side * 70, -76], [side * 46, -104]], 13);
    stroke(g, [[side * 46, -104], [side * 24, -126], [side * 14, -108]], 15); stroke(g, [[side * 46, -104], [side * 40, -132]], 8);
    stroke(g, [[side * 14, -44], [side * 17, -62]], 5); g.fillStyle = COBALT; g.beginPath(); g.arc(side * 17, -64, 5, 0, TAU); g.fill();
  }
  g.restore();
  return c;
}
// 盒身（绕一周展开）：上下弦纹，中间一圈卷草
function bodyTexture() {
  const W = 1024, H = 128, [c, g] = canvas2d(W, H);
  glazeBase(g, W, H, 4.5);
  g.strokeStyle = COBALT; g.globalAlpha = .8;
  for (const [y, w] of [[H * .48, 3], [H * .56, 2], [H * .9, 3]]) { g.lineWidth = w; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  g.globalAlpha = 1;
  for (let i = 0; i < 16; i++) { const x = i * 64, y = H * .73, s = i % 2 ? -1 : 1; stroke(g, [[x, y], [x + 16, y - s * 13], [x + 34, y - s * 9], [x + 30, y + s * 2], [x + 22, y - s * 2]], 5); stroke(g, [[x + 32, y], [x + 48, y + s * 12], [x + 64, y]], 5); }
  return c;
}
// 印泥：朱砂和艾绒揉成的一团，表面是细碎的绒，中间有一块刚钤过印留下的方印子
function pasteTextures() {
  const S = 256, fluff = noiseField(S, S, 128, 128, 4.7), lump = fbmField(S, S, 5, 5, 3, 4.8), h = new Float32Array(S * S), [c, g] = canvas2d(S, S), img = g.createImageData(S, S), d = img.data, base = new THREE.Color(PAL.cinnabar);
  for (let y = 0, i = 0; y < S; y++) for (let x = 0; x < S; x++, i++) {
    const dent = Math.max(Math.abs(x - S * .56) / 34, Math.abs(y - S * .47) / 34) < 1 ? 1 : 0;                // 印子：方的，压平了，颜色也深一点
    h[i] = (fluff[i] - .5) * (dent ? .08 : .28) + (lump[i] - .5) * .6 - dent * .3;
    const k = (1.12 + .3 * (lump[i] - .5) + .2 * (fluff[i] - .5)) * (dent ? .82 : 1);
    d[i * 4] = clamp(base.r * 255 * k, 0, 255); d[i * 4 + 1] = clamp(base.g * 255 * k, 0, 255); d[i * 4 + 2] = clamp(base.b * 255 * k, 0, 255); d[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return { map: tex(c, { srgb: true }), normalMap: tex(normalCanvas(h, S, S, 2.2, false)) };
}
// 寿山石：蜜色的底，带几丝红褐的筋和云状的深浅；每个面刻一道边线
function stoneTexture() {
  const S = 256, [c, g] = canvas2d(S, S), vein = fbmField(S, S, 3, 3, 4, 5.3), cloudy = fbmField(S, S, 2, 2, 3, 5.6), img = g.createImageData(S, S), d = img.data;
  const honey = [222, 186, 120], amber = [176, 120, 66], red = [142, 62, 44];
  for (let y = 0, i = 0; y < S; y++) for (let x = 0; x < S; x++, i++) {
    const t = clamp((cloudy[i] - .35) * 1.1), v = clamp(1 - Math.abs(vein[i] - .55) * 30) * .3;
    for (let ch = 0; ch < 3; ch++) d[i * 4 + ch] = (honey[ch] + (amber[ch] - honey[ch]) * t) * (1 - v) + red[ch] * v;
    d[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  g.strokeStyle = 'rgba(70,40,20,.5)'; g.lineWidth = 2; g.strokeRect(16, 16, S - 32, S - 32);
  return c;
}

// 印钮：一只趴着的小蟹。坐标以印顶的中心为原点
function crabKnob() {
  const parts = [blob([0, .15, 0], [.3, .135, .235]), blob([0, .2, -.02], [.2, .1, .15])];
  for (const s of [-1, 1]) {
    parts.push(rod([s * .08, .24, .19], [s * .09, .31, .23], .016), blob([s * .09, .32, .235], [.032, .032, .032]));       // 眼柄和眼
    parts.push(rod([s * .2, .13, .16], [s * .3, .12, .3], .045), blob([s * .26, .11, .37], [.1, .06, .075], s * .5));        // 螯臂和螯
    parts.push(blob([s * .17, .1, .41], [.06, .035, .03], s * 1.1));                                                        // 螯的小指
    for (let i = 0; i < 3; i++) { const z = .08 - i * .13; parts.push(rod([s * .24, .13, z], [s * .38, .15, z - .03], .03), rod([s * .38, .15, z - .03], [s * .46, .02, z - .06], .024)); }   // 三对步足，各两节
  }
  parts.push(new RoundedBoxGeometry(.66, .1, .66, 3, .04).translate(0, .03, 0));                                           // 蟹趴着的小台
  return mergeGeometries(parts.map(p => (p.index ? p.toNonIndexed() : p)));
}

export function buildSeal() {
  const group = new THREE.Group(), [cx, cz] = PROPS.seal.c, k = BOX_R / 1.08, pt = p => p.map(([r, y]) => [r * k, y * k]);
  // 印泥盒：圈足、鼓腹、子口；里面是一个浅膛
  const box = new THREE.Group();
  box.add(new THREE.Mesh(lathe(pt([[0, .04], [.7, .04], [.78, 0], [.81, 0], [.84, .07], [.98, .15], [1.08, .31], [1.07, .45], [1, .53], [.94, .54], [.94, .63], [.89, .63], [.88, .32], [0, .3]]), 56), glaze(tex(bodyTexture(), { srgb: true }))));
  const paste = new THREE.Mesh(lathe(pt([[.88, .5], [.8, .58], [.62, .68], [.36, .75], [0, .78]]), 40, BOX_R), extend(new THREE.MeshStandardMaterial({ ...pasteTextures(), roughness: .7 }), { gloss: '.5' }));
  box.add(paste);
  // 盒盖：往左后方推开，后沿落在盒口外，前沿搭在印泥上，所以是斜的
  const lid = new THREE.Group(), lidMat = glaze(tex(lidTexture(), { srgb: true }));
  lid.add(new THREE.Mesh(lathe(pt([[1.07, 0], [1.085, .1], [1.04, .26], [.84, .38], [.44, .45], [0, .47]]), 56, BOX_R * 1.02), lidMat));
  lid.add(new THREE.Mesh(lathe(pt([[0, .39], [.42, .37], [.8, .31], [.97, .2], [.98, 0], [1.07, 0]]), 56), glaze(null)));
  const slide = new THREE.Vector3(-.5, 0, -.6), tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0).cross(slide).normalize(), .13);
  lid.position.set(slide.x, .5, slide.z); lid.quaternion.copy(tilt).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), .5));
  box.add(lid);
  box.position.set(cx - .35, DESK.top, cz - .3);
  // 印：方柱，棱角磨圆；上面是蟹钮
  const stone = extend(new THREE.MeshStandardMaterial({ map: tex(stoneTexture(), { srgb: true }), roughness: .5 }), {
    gloss: '.5',
    afterMap: `diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.55, .05, .03), .9 * smoothstep(.34, .02, vWorld.y - (${DESK.top.toFixed(3)})));`,   // 印脚沾着没擦净的印泥，越靠近印面越红
  }), seal = new THREE.Group();
  seal.add(new THREE.Mesh(new RoundedBoxGeometry(.8, 1.5, .8, 4, .07).translate(0, .75, 0), stone), new THREE.Mesh(crabKnob().translate(0, 1.5, 0), stone));
  seal.position.set(cx + 1.2, DESK.top, cz - .2); seal.rotation.y = -.3;
  group.add(box, seal);
  return shadowed(group);
}
