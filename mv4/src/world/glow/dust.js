// 浮尘：书案上空几千粒缓缓游移的微尘。镜头是微距，近处的尘离镜头很近，会虚成一个个柔和的圆斑；远处的是细小的亮点。
// 每一粒的位置只由时间算出（匀速漂移后在盒子里绕回，再叠上各自的游移），亮度看它在不在月光的光柱里、离灯火多近，
// 逆着月光看最亮；微粒翻转时一闪一闪。
import * as THREE from 'three';
import { rnd } from '../../anim.js';
import { BEAM, NOISE, OUTPUT, MOON_TINT, FLAME_TINT, TOP } from './shared.js';

const COUNT = 5200, BOX_MIN = [-15, TOP + .12, -19], BOX_MAX = [17, 11.5, 17];    // 浮尘活动的范围：表演区和镜头周围
const FOCUS = 9.5, BOKEH = 105;                                                    // 镜头对焦的距离；离焦时圆斑的大小（像素）
const vec3 = a => `vec3(${a.map(x => x.toFixed(3)).join(', ')})`;
const VERT = /* glsl */`
${NOISE}
${BEAM}
attribute vec4 aSeed;
uniform float uTime, uViewH, uWarm; uniform vec3 uFlame, uMoon, uFire;
varying vec3 vColor; varying float vBlur;
void main() {
  vec3 lo = ${vec3(BOX_MIN)}, size = ${vec3(BOX_MAX)} - lo, drift = vec3(.035, -.022, .05) + (aSeed.xyz - .5) * .06;
  vec3 p = lo + mod(position * size + drift * uTime, size);
  float ph = aSeed.w * 6.2832;
  vec3 e = min(p - lo, lo + size - p);
  float edge = smoothstep(0., 1.5, min(e.x, min(e.y * 4., e.z)));                  // 快漂出盒子的先淡掉，绕回另一头时看不出跳变
  p += vec3(sin(uTime * (.19 + aSeed.x * .2) + ph), .6 * sin(uTime * (.14 + aSeed.y * .18) + ph * 1.7), cos(uTime * (.17 + aSeed.z * .2) + ph * 2.3)) * (.3 + aSeed.w * .5);
  vec4 mv = viewMatrix * vec4(p, 1.);
  float dist = -mv.z, px = projectionMatrix[1][1] * uViewH * .5 / max(dist, .1);   // 这个距离上 1 个单位占多少像素
  gl_Position = projectionMatrix * mv;
  float sharp = (.007 + .026 * aSeed.x * aSeed.x) * px;                            // 对上焦时这粒尘的大小
  float blur = ${BOKEH.toFixed(1)} * abs(1. / max(dist, .1) - ${(1 / FOCUS).toFixed(4)}) * (dist < ${FOCUS.toFixed(1)} ? 1. : .3);
  float sizePx = clamp(sharp + blur, 1.4, 110.);
  gl_PointSize = sizePx;
  vBlur = clamp(blur / sizePx * 1.4, 0., 1.);
  vec3 rd = normalize(p - cameraPosition);
  float moon = beamMask(p) * mix(.1, 1., beamStreak(p, uTime)), toward = max(dot(rd, MOON_DIR), 0.);
  vec3 toFire = p - uFlame;
  vec3 light = uMoon * moon * (.22 + 1.2 * pow(toward, 6.) + .3 * toward * toward) + uFire * uWarm * 1.3 / (1. + dot(toFire, toFire) * .1) + vec3(.012, .014, .025);
  float glint = .3 + .7 * pow(.5 + .5 * sin(uTime * (.6 + 2.2 * aSeed.y) + ph * 3.), 3.);
  float spread = pow(clamp(max(sharp, 1.4) / sizePx, 0., 1.), 1.25) * min(1., sharp * sharp / 1.96);   // 虚开的圆斑把光摊薄；不足一个像素的按面积减暗
  vColor = min(light, vec3(1.)) * glint * edge * max(spread, .04) * smoothstep(.7, 1.8, dist) / (1. + dist * .07);
}`;
const FRAG = /* glsl */`
varying vec3 vColor; varying float vBlur;
void main() {
  float r = length(gl_PointCoord * 2. - 1.);
  float grain = exp(-r * r * 3.6), disc = (1. - smoothstep(.72, 1., r)) * (.78 + .22 * smoothstep(.4, .9, r));   // 实的一粒；虚开的圆斑，边上略亮
  gl_FragColor = vec4(vColor * mix(grain, disc, vBlur), 1.);
  ${OUTPUT}
}`;

export function buildDust(parent, flame, warm) {
  const pos = new Float32Array(COUNT * 3), seed = new Float32Array(COUNT * 4);
  for (let i = 0; i < COUNT; i++) {
    for (let k = 0; k < 3; k++) pos[i * 3 + k] = rnd(i * 3.17 + k * 71.3 + 5);
    for (let k = 0; k < 4; k++) seed[i * 4 + k] = rnd(i * 5.03 + k * 37.9 + 11);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  const uniforms = { uTime: { value: 0 }, uViewH: { value: 1080 }, uWarm: warm, uFlame: { value: flame }, uMoon: { value: MOON_TINT }, uFire: { value: FLAME_TINT } };
  const dust = new THREE.Points(geo, new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  const view = new THREE.Vector4();
  dust.onBeforeRender = renderer => { uniforms.uViewH.value = renderer.getCurrentViewport(view).w; };   // 画面有多少像素高，换算微粒大小用
  dust.frustumCulled = false; dust.renderOrder = 15;
  parent.add(dust);
  return { update(t) { uniforms.uTime.value = t; } };
}
