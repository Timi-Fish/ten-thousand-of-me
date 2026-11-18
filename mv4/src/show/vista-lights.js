// 万点灯火：一万多只提灯的小蟹，一盏灯一个实例。三样东西共用同一份实例数据、同一套走法（vista-glsl.js）：
//   body   近处（两三百个单位以内）朝镜头的小贴片，画的是一只只小蟹（vista-crab.js），远了自己淡掉
//   glow   头顶那点灯火：一颗亮芯、一圈光晕、身后一小段拖尾（方向就是它走的方向）。远了退成一个光点，暗下去但不消失
//   mirror 水里的倒影：湖面上、桥下的溪水里，各按自己的水面算出倒影落在哪，拉成一道竖着的光
import * as THREE from 'three';
import { rnd } from '../anim.js';
import { COMMON, U } from '../wild/paint.js';
import { bakeRoutes, planCrowd, ROWS } from './vista-road.js';
import { MOTION, AIR_PASS, WAVE, crest } from './vista-glsl.js';
import { crabAtlas, ATLAS } from './vista-crab.js';

export const COUNT = 14000;
const LAKE_BOX = [-340, 380, 680, 640], CREEK_Y = 155;               // 水面的范围 [x0, z0, 宽, 深]（湖和桥下那段溪都在里面）；桥下溪水的水面高

// 每一季的灯：lamp 灯色，gain 亮度，halo 光晕铺多开（夏天的雨雾里晕得开一点；灯色要比雨雾暖得多、浓得多，白蒙蒙的雾里才看得出一条灯河），paper 灯笼纸的颜色和浓淡（白天光不显，看得见的是一点点纸色），
// body 小蟹贴片受的环境光，ground 照在地上、雾里那层光的颜色和强弱
export const LOOK = {
  冬: { lamp: [1, .64, .3], gain: 2.2, halo: 6, paper: [1, .7, .4, 0], body: [.5, .52, .74], ground: [1, .58, .26], groundGain: .55 },
  春: { lamp: [1, .5, .62], gain: 2.3, halo: 5, paper: [.95, .3, .45, 1], body: [1.05, 1, 1], ground: [1, .6, .7], groundGain: .15 },
  夏: { lamp: [1, .62, .26], gain: 2.8, halo: 8, paper: [.9, .3, .2, .7], body: [.86, .9, .92], ground: [1, .64, .3], groundGain: .32 },
  秋: { lamp: [1, .46, .18], gain: 2.6, halo: 6, paper: [.85, .22, .1, .8], body: [1.05, .86, .74], ground: [1, .48, .2], groundGain: .3 },
};

// 水面的范围图：r 湖，g 桥下的溪水
function waterMap(wild) {
  const [x0, z0, w, d] = LAKE_BOX, nx = 340, nz = 320, data = new Uint8Array(nx * nz * 4);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = x0 + (i + .5) / nx * w, z = z0 + (j + .5) / nz * d, h = wild.heightAt(x, z), o = (j * nx + i) * 4;
    data[o] = h < -.3 ? 255 : 0;
    data[o + 1] = x > 20 && x < 100 && z > 420 && z < 480 && h < CREEK_Y - .4 ? 255 : 0;
    data[o + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, nx, nz, THREE.RGBAFormat);
  tex.minFilter = tex.magFilter = THREE.LinearFilter; tex.needsUpdate = true;
  return tex;
}

const VERT_HEAD = /* glsl */`
#include <common>
${COMMON}
${AIR_PASS}
${MOTION}
uniform vec2 uRes;
uniform vec3 uLampCol;
uniform vec4 uLampGain;       // 亮度、光点最小几个像素、最大几个像素、光晕是亮芯的几倍
uniform vec4 uBodyOn;         // 小蟹贴片：x 1 画 / 0 不画，y 高过几个像素才画，z 高过几个像素完全显出来；w 离镜头这么近以内什么都不画（往外渐渐显出来）
`;
// 头顶的灯火、灯笼纸、水里的倒影共用的一段：给出这一盏在屏幕上的头（亮芯）和尾（拖尾的末端），算出这一片四个角的位置。
// mode：glow 叠加上去的光；paper 灯笼本身（白天看得见的那一点纸色，正常盖上去）；mirror 倒影
const GLOW_VERT = mode => /* glsl */`
${VERT_HEAD}
uniform sampler2D uWater, uDens;
uniform vec4 uWaterBox, uPaper;
varying vec2 vQ; varying float vR, vTail, vA; varying vec3 vCol;
void hide() { gl_Position = vec4(2., 2., 2., 1.); vCol = vec3(0.); vA = 0.; }
void main() {
  Lamp l = lampAt(uClock);
  float away = distance(l.lamp, cameraPosition);
  if (distance(l.foot, uHole.xyz) < uHole.w || away < uBodyOn.w * .6) { hide(); return; }
  vec3 head = l.lamp, tail = l.lamp - l.dir * aRun.z * .16;
  if (uForm.w > .5) tail = lampAt(uClock - .07).lamp;
  float gain = uLampGain.x * (.55 + 1.5 * l.crest) * l.edge * (.7 + .6 * aLook.z) * smoothstep(uBodyOn.w * .6, uBodyOn.w, away);
  // 挤在一起的灯在画面上叠成一片：按这一段路上灯的疏密和它在画面上有多大，把每一盏压暗一点——稀的地方一盏盏亮着，密的地方是金黄的一片而不是一条白带
  float perUnit0 = projectionMatrix[1][1] * .5 * uRes.y / max((viewMatrix * vec4(head, 1.)).z * -1., 1.);
  float crowd = texture2D(uDens, vec2(l.at.x, (l.at.y + .5) / ${ROWS.toFixed(1)})).r;
  gain /= 1. + (1. - l.form) * crowd * .1 / max(perUnit0, .4);
  // 升空聚字：在半空里交错穿过时暗一点，聚齐了亮起来
  if (uForm.w > .5) gain *= .42 * mix(1., 1.5, smoothstep(.35, .9, l.burst));   // 字上的光一盏挨一盏，每盏暗一点才不糊成白块；炸开以后散得稀了，一点点亮回来
  ${mode === 'mirror' ? /* glsl */`
  // 倒影：把灯沿水面翻下去，从镜头看过去，视线和水面的交点就是倒影在水面上的位置；再朝镜头拉出一道
  float plane = head.y < 30. ? 0. : ${CREEK_Y.toFixed(1)};
  float above = head.y - plane;
  if (above < 0. || cameraPosition.y < plane + 1.) { hide(); return; }
  vec3 flip = vec3(head.x, plane - above, head.z);
  vec3 q = cameraPosition + (flip - cameraPosition) * ((cameraPosition.y - plane) / (cameraPosition.y - flip.y));
  vec2 wuv = (q.xz - uWaterBox.xy) / uWaterBox.zw;
  vec4 wet = texture2D(uWater, wuv);
  float on = (wuv.x > 0. && wuv.x < 1. && wuv.y > 0. && wuv.y < 1.) ? (plane < 1. ? wet.r : wet.g) : 0.;
  if (on < .05) { hide(); return; }
  // 从高处往下看时倒影是一点，贴着水面斜看过去才拉成一道
  vec3 near = normalize(vec3(cameraPosition.x - q.x, 0., cameraPosition.z - q.z));
  float graze = 1. - smoothstep(.15, .55, (cameraPosition.y - plane) / distance(cameraPosition, q));
  head = q + vec3(0., .05, 0.); tail = head + near * (.3 + above * .6 * graze);
  gain *= .13 * on * (.75 + .25 * sin(uClock * 7. + aLook.w * 60.));
  ` : ''}
  vec4 ch = projectionMatrix * viewMatrix * vec4(head, 1.), ct = projectionMatrix * viewMatrix * vec4(tail, 1.);
  if (ch.w < 1. || ct.w < 1.) { hide(); return; }
  float perUnit = projectionMatrix[1][1] * .5 * uRes.y / ch.w, r = .32 * aLook.x * perUnit, cover = 1.;
  if (r < uLampGain.y) { cover = pow(r / uLampGain.y, 1.4); gain *= cover; r = uLampGain.y; }
  r = min(r, uLampGain.z * mix(1., .3, step(.5, uForm.w)));          // 聚字、涌过来的时候一盏盏都是小小的亮点，不长成大光团
  gain *= smoothstep(3., 14., ch.w) * airPass(head);
  if (uForm.w > .5) gain *= .45 + .55 * smoothstep(40., 240., ch.w);  // 冲到镜头跟前时一盏盏收着点，留给最后那一下白
  vec2 hp = ch.xy / ch.w * .5 * uRes, tp = ct.xy / ct.w * .5 * uRes, along = hp - tp;
  float len = ${mode === 'paper' ? '0.' : 'min(length(along), uForm.w > .5 ? 3. + 22. * smoothstep(0., .08, l.burst) + 150. * smoothstep(.3, 1., l.burst) : min(2. * r + 4., 24.))'};
  vec2 dir = len > .01 ? normalize(along) : vec2(1., 0.), perp = vec2(-dir.y, dir.x);
  float e = ${mode === 'paper' ? 'r * 1.25' : 'clamp(r * uLampGain.w, 2.5, 46.)'};
  vec2 local = vec2(position.x > 0. ? e : -(len + e), position.y * e);
  vec2 px = hp + dir * local.x + perp * local.y;
  gl_Position = vec4(px / (.5 * uRes) * ch.w, ch.z, ch.w);
  vQ = local; vR = r; vTail = len; vCol = uLampCol * gain;
  if (uForm.w > .5) vCol /= 1. + len / (7. * r);                     // 光点飞起来拉成一道，同样的光摊在整道上
  ${mode === 'paper' ? 'vCol = wildFog(uPaper.rgb, head); vA = uPaper.a * cover * l.edge * (1. - l.form) * smoothstep(uBodyOn.w * .6, uBodyOn.w, away);' : ''}
}`;
const PAPER_FRAG = /* glsl */`
varying vec2 vQ; varying float vR, vTail, vA; varying vec3 vCol;
void main() {
  float d = length(vQ) / vR, a = vA * smoothstep(1.05, .55, d);
  if (a < .01) discard;
  gl_FragColor = vec4(vCol * (1.05 - .3 * d), a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const GLOW_FRAG = /* glsl */`
varying vec2 vQ; varying float vR, vTail; varying vec3 vCol;
void main() {
  float x = vQ.x, y = vQ.y, tailK = vTail > .5 ? clamp(-x / vTail, 0., 1.) : 0.;
  float dx = x > 0. ? x : (x < -vTail ? x + vTail : 0.), w = vR * (1. - .55 * tailK);
  float d2 = (dx * dx + y * y) / (w * w), head = (x * x + y * y) / (vR * vR);
  float core = exp(-1.6 * d2) * (1. - .72 * tailK), halo = .085 * exp(-.9 * sqrt(head)) + .01 * exp(-.35 * sqrt(head));
  gl_FragColor = vec4(vCol * (core + halo), 1.);
}`;

// 小蟹贴片：竖着朝向镜头（只绕竖轴转），脚踩在路上；按它走的方向和镜头的方向挑正面、背面、侧面
const BODY_VERT = /* glsl */`
${VERT_HEAD}
varying vec2 vUv; varying vec3 vWp; varying float vFade, vLit;
void main() {
  Lamp l = lampAt(uClock);
  vec4 cf = projectionMatrix * viewMatrix * vec4(l.foot, 1.);
  float h = CRAB_H * aLook.x, px = h * projectionMatrix[1][1] * .5 * uRes.y / max(cf.w, 1e-3);
  if (uBodyOn.x < .5 || l.form > 0. || cf.w < max(uBodyOn.w, 9.) || px < uBodyOn.y || distance(l.foot, uHole.xyz) < uHole.w) { gl_Position = vec4(2., 2., 2., 1.); return; }
  vec3 toCam = cameraPosition - l.foot; toCam.y = 0.; toCam = normalize(toCam + vec3(1e-4, 0., 0.));
  vec3 right = normalize(cross(vec3(0., 1., 0.), toCam));
  float facing = dot(l.dir, toCam), sideways = dot(l.dir, right);
  float view = facing > .42 ? 0. : facing < -.42 ? 1. : 2., flip = view == 2. && sideways < 0. ? -1. : 1.;
  if (view == 0. && l.crest > .55) view = 3.;                        // 波盖到的时候正面的那些举起手来
  float sy = 1. - .2 * l.squash + .14 * l.stretch, sx = 1. / sqrt(sy);
  float hat = floor(fract(aLook.w * 13.7) * 4.);
  vec2 corner = position.xy * .5 + .5;
  vec3 wp = l.foot + right * (corner.x - .5) * h * 1.16 * sx + vec3(0., corner.y * h * 1.1 * sy, 0.);
  vUv = (vec2(view + (flip > 0. ? corner.x : 1. - corner.x), ${(ATLAS - 1).toFixed(1)} - hat + corner.y)) / ${ATLAS.toFixed(1)};
  vWp = wp; vFade = smoothstep(uBodyOn.y, uBodyOn.z, px) * l.edge; vLit = .6 + .8 * l.crest;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.);
}`;
const BODY_FRAG = /* glsl */`
#include <common>
${COMMON}
uniform sampler2D uAtlas;
uniform vec3 uBodyLight, uLampCol;
varying vec2 vUv; varying vec3 vWp; varying float vFade, vLit;
void main() {
  vec4 tex = texture2D(uAtlas, vUv);
  float local = fract(vUv.y * ${ATLAS.toFixed(1)});
  vec3 c = tex.rgb * uBodyLight + tex.rgb * uLampCol * .32 * vLit * smoothstep(.35, 1., local);   // 头顶的灯照在身子上半截
  gl_FragColor = vec4(wildFog(c, vWp), tex.a * vFade);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// 各段共用的那一份：路、灯的走法、拼图、实例数据、材质。各段只各自挂一份网格
const shared = new WeakMap();
function prepare(wild) {
  if (shared.has(wild)) return shared.get(wild);
  const routes = bakeRoutes(wild), crowd = planCrowd(routes, COUNT);
  const geo = new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry(2, 2));
  geo.setAttribute('aRoute', new THREE.InstancedBufferAttribute(crowd.aRoute, 4));
  geo.setAttribute('aRun', new THREE.InstancedBufferAttribute(crowd.aRun, 4));
  geo.setAttribute('aLook', new THREE.InstancedBufferAttribute(crowd.aLook, 4));
  geo.setAttribute('aGlyph', new THREE.InstancedBufferAttribute(new Float32Array(COUNT * 3), 3));
  geo.instanceCount = COUNT;
  const uniforms = {
    ...U,
    uPath: { value: routes.pathTex }, uSide: { value: routes.sideTex }, uClock: { value: 0 }, uMainLen: { value: routes.L },
    uWave: { value: new THREE.Vector3(WAVE.speed, WAVE.gap, WAVE.width) }, uHole: { value: new THREE.Vector4(0, -1e4, 0, 0) }, uForm: { value: new THREE.Vector4() },
    uBurstFrom: { value: new THREE.Vector4() }, uBurstTo: { value: new THREE.Vector4() },
    uRes: { value: new THREE.Vector2(1920, 1080) }, uLampCol: { value: new THREE.Color() }, uLampGain: { value: new THREE.Vector4(1, 1.25, 26, 6) },
    uBodyOn: { value: new THREE.Vector4(1, 4, 9, 7) }, uBodyLight: { value: new THREE.Color() }, uAtlas: { value: crabAtlas() },
    uWater: { value: waterMap(wild) }, uWaterBox: { value: new THREE.Vector4(...LAKE_BOX) }, uDens: { value: crowd.densTex }, uPaper: { value: new THREE.Vector4() },
  };
  const glow = mode => new THREE.ShaderMaterial({ vertexShader: GLOW_VERT(mode), fragmentShader: GLOW_FRAG, uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const mats = {
    body: new THREE.ShaderMaterial({ vertexShader: BODY_VERT, fragmentShader: BODY_FRAG, uniforms, transparent: false, alphaToCoverage: true, side: THREE.DoubleSide }),
    paper: new THREE.ShaderMaterial({ vertexShader: GLOW_VERT('paper'), fragmentShader: PAPER_FRAG, uniforms, transparent: true, depthWrite: false }),
    glow: glow('glow'), mirror: glow('mirror'),
  };
  const it = { routes, crowd, geo, uniforms, mats };
  shared.set(wild, it);
  return it;
}

// 把「我」字画到画布上取点：n 个点，字立在 center，朝着 eye，字高 height。salt 换一套取点。
// 返回 points（世界里的点，每 3 个一组）和 uv（这一点在字形画布里的位置，0 到 1，从左上量；拼字时按它排笔画先后）
export function glyphPoints(n, center, eye, height, salt = 0) {
  const S = 360, canvas = document.createElement('canvas'), g = canvas.getContext('2d');
  canvas.width = canvas.height = S;
  g.fillStyle = '#fff'; g.font = `bold ${S * .9}px "Kaiti SC", "STKaiti", "KaiTi", serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('我', S / 2, S * .53);
  const img = g.getImageData(0, 0, S, S).data, inside = [];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (img[(y * S + x) * 4 + 3] > 128) inside.push([x, y]);
  if (inside.length < 1000) throw new Error('楷体没有画出「我」字（系统里找不到楷体）');
  const fwd = center.clone().sub(eye).normalize(), right = fwd.clone().cross(new THREE.Vector3(0, 1, 0)).normalize(), up = right.clone().cross(fwd).normalize();
  const points = new Float32Array(n * 3), uv = new Float32Array(n * 2), k = height / S;
  for (let i = 0; i < n; i++) {
    const [x, y] = inside[Math.floor(rnd(i * 3.913 + .37 + salt) * inside.length)], px = x + rnd(i * 5.11 + salt), py = y + rnd(i * 7.3 + salt);
    const p = center.clone().addScaledVector(right, (px - S / 2) * k).addScaledVector(up, (S / 2 - py) * k).addScaledVector(fwd, (rnd(i * 2.9 + salt) - .5) * height * .05);
    p.toArray(points, i * 3); uv[i * 2] = px / S; uv[i * 2 + 1] = py / S;
  }
  return { points, uv };
}

// 一段表演用的万点灯火：网格挂进这一段自己的组。frame(t, opts) 每帧调：
//   season 季节；hole 不画的那个球 [x, y, z, r]（真的小蟹在那里）；form 化光成字 [亮起来, 炸开, 一点光冲到镜头多久]（不给就照常沿路走），
//   burst 炸开 { from: [字心 x, y, z, 字高], to: [镜头 x, y, z, 掠过镜头时散开多宽] }（给了 form 才要）；
//   bodies 画不画小蟹贴片；gain 整体亮度再乘多少；near 离镜头这么近以内不画
export function vistaLights(kit, group) {
  const it = prepare(kit.wild), { uniforms: u, mats, geo, crowd } = it;
  const mesh = (mat, order) => { const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; m.renderOrder = order; group.add(m); return m; };
  mesh(mats.body, 18); mesh(mats.paper, 18.5); mesh(mats.mirror, 19); mesh(mats.glow, 22);
  return {
    ...it,
    setGlyph(center, eye, height) { geo.attributes.aGlyph.array.set(glyphPoints(COUNT, center, eye, height).points); geo.attributes.aGlyph.needsUpdate = true; },
    frame(t, { season, hole = [0, -1e4, 0, 0], form = null, burst = null, bodies = true, gain = 1, near = 7 }) {
      const look = LOOK[season];
      u.uClock.value = t;
      u.uLampCol.value.setRGB(...look.lamp); u.uPaper.value.set(...look.paper); u.uLampGain.value.set(look.gain * gain, 1.5, 9, look.halo);
      u.uBodyLight.value.setRGB(...look.body); u.uBodyOn.value.x = bodies ? 1 : 0; u.uBodyOn.value.w = near;
      u.uHole.value.set(...hole);
      if (form) { u.uForm.value.set(...form, 1); u.uBurstFrom.value.set(...burst.from); u.uBurstTo.value.set(...burst.to); } else u.uForm.value.set(0, 0, 0, 0);
      return crowd.density(t, crest);
    },
  };
}
