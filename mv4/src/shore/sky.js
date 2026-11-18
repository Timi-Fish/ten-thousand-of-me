// 天：逐像素画出来的天穹，从远到近一层层叠：
//   天的底色、海平线上的亮霭、落日照亮的空气（air.js，和霭是同一套函数）→ 很淡的几道光柱 → 日面（sun.js）→
//   高处的卷云 → 低一层的云团 → 落日跟前的几道横云（sun.js）→ 海平线上的远岛。
// 云团是一层有厚度的「平面云」：先按视线找到云层，再朝落日的方向走几步，看这一点前面被多少云挡着——
//   薄的边缘、朝着落日的那一侧被逆光打透，镶一道金边；厚的云心沉成紫灰。落日贴着海平线，光几乎是横着穿过云层的，所以金边特别亮；
//   落日越低，云底被照得越红。
// 远岛是海平线上两重淡紫的剪影，近的一重浓一点，远的一重几乎化进霭里；岛脚化在海平线的亮霭里。
// 这一段着色器（SKY_GLSL）海面也用：海里映出来的天、云、远岛和这里是同一个函数，只是走的步数少一些，也不画日面、横云和光柱。
import * as THREE from 'three';
import { U, COMMON } from './paint.js';
import { SUN_GLSL } from './sun.js';

export const SKY_GLSL = /* glsl */`
uniform vec3 uHiLit, uHiShade, uHiRim, uIsle;
const float CLOUD_H = 1500., CIRRUS_H = 5200.;

// 每个像素一个 0 到 1 的数，相邻像素错得很开（打散色阶）
float pixelNoise(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(.06711056, .00583715)))); }

// 云团的浓度，0 到 1。p：云层上的位置（世界 xz）
float cloudDensity(vec2 p, float lod) {
  // 云随风整片地走（比真的云快：几秒的镜头里要看得出在走），一层流动的扭曲推着云团的形状一直在变，边上的细絮流得更快；
  // 两道走向、快慢不同的波（sin / cos）从云团上推过去，云头一鼓一落
  vec2 q = vec2(dot(p, vec2(.94, .34)), dot(p, vec2(-.34, .94)) * 1.9) / 9000. + uWind.xy * uTime * .006;
  q += (textureLod(uCloud, q * .7 + uTime * vec2(.011, -.008), lod - .5).ba - .5) * .05;
  float big = textureLod(uCloud, q * .31 + vec2(.21, .63), lod - 1.6).b, puff = textureLod(uCloud, q, lod).r, fine = textureLod(uCloud, q * 4.1 + vec2(.5, .1) + uTime * vec2(.02, .013), lod + 1.).g;
  float billow = .07 * sin(dot(q, vec2(21., 8.)) - uTime * 1.1) + .05 * cos(dot(q, vec2(-10., 25.)) + uTime * .8);
  float d = puff * .62 + big * .7 - .6 - (1. - fine) * .2 + billow;
  return clamp(d * 3.2, 0., 1.);
}
// 云层。返回 rgb：云的颜色（已乘不透明度）；a：还剩几成能看到后面。steps：朝落日走几步（海里的倒影少走几步）
vec4 cloudLayer(vec3 ro, vec3 rd, int steps) {
  if (rd.y < .003) return vec4(0., 0., 0., 1.);
  float t = (CLOUD_H - ro.y) / rd.y, lod = log2(max(t, 1.) / 2600.);
  vec2 p = ro.xz + rd.xz * t;
  float d = cloudDensity(p, lod);
  if (d <= .002) return vec4(0., 0., 0., 1.);
  vec2 toSun = normalize(uSunDir.xz);
  float tau = 0., reach = 0., seg = 150.;
  for (int j = 0; j < 5; j++) {
    if (j >= steps) break;
    reach += seg; tau += cloudDensity(p + toSun * reach, lod + 1.) * seg; seg *= 1.75;
  }
  tau *= .0016 * 5. / float(steps);
  float s = max(dot(rd, uSunDir), 0.), s2 = s * s, fwd = s2 * s2 * s2 * s2;
  float lit = .7 * exp(-tau * .9) + .3 * exp(-tau * .15);
  vec3 c = mix(uHiShade, uHiLit, lit);
  c += uHiRim * (.25 + 1.6 * fwd) * exp(-tau * 1.4) * (1. - .7 * d);                    // 逆光的亮边：薄的地方、朝着落日的地方
  c += uHiLit * (.18 + .2 * uDusk) * smoothstep(.2, 0., rd.y);                            // 落日在云层下面，低处的云底被照暖；落日越低照得越红
  c = mix(c, hazeColor(rd), 1. - exp(-t / 26000.));                                       // 远处的云化进霭里
  float a = d * smoothstep(.003, .05, rd.y) * (1. - .6 * smoothstep(.5, .99, s) * (1. - d));   // 落日跟前的云稀一点，不把它盖死
  return vec4(c * a, 1. - a);
}
// 卷云：很高很薄的丝缕，顺着一个方向拉得很长，只染上落日的颜色
vec4 cirrus(vec3 ro, vec3 rd) {
  if (rd.y < .01) return vec4(0.);
  float t = (CIRRUS_H - ro.y) / rd.y;
  vec2 p = ro.xz + rd.xz * t + uWind.xy * uTime * 110.;
  vec2 q = vec2(dot(p, vec2(.8, .6)) * .28, dot(p, vec2(-.6, .8))) / 7000.;
  float lod = log2(max(t, 1.) / 9000.);
  q += (textureLod(uCloud, q * .6 + .3 + uTime * vec2(.006, .004), lod).bb - .5) * .2;   // 丝缕的弯法慢慢在变
  float sheet = textureLod(uCloud, q * .27 + vec2(.4, .7), lod - 1.5).b, comb = textureLod(uCloud, q * vec2(1., 2.6), lod).b;
  float d = smoothstep(.5, .85, sheet * .55 + comb * .5) * smoothstep(.01, .12, rd.y) * exp(-t / 40000.);
  float s = max(dot(rd, uSunDir), 0.), s4 = s * s * s * s;
  return vec4(mix(uHiShade, uHiLit, .85) * 1.1 + uHiRim * (.15 + .4 * s4 * s4), clamp(d, 0., 1.) * .35);
}

// 海平线上的远岛。rel：这个方向偏离落日的方位角（弧度）。返回这个方位上岛的轮廓有多高（弧度，0 是没有岛）
float isleRidge(float rel, float seed, float lo, float hi, float tall) {
  float span = smoothstep(lo, lo + .07, rel) * smoothstep(hi, hi - .1, rel);
  float x = (rel - lo) / (hi - lo);
  float shape = .55 * exp(-pow((x - .3) / .2, 2.)) + .9 * exp(-pow((x - .62) / .13, 2.)) + .35 * exp(-pow((x - .85) / .1, 2.));
  float detail = noise1(vec2(rel * 90. + seed, seed)) * .22 + noise1(vec2(rel * 260. + seed, seed * 3.)) * .08;
  return tall * span * (shape + detail);
}
// 远岛：返回 rgb 颜色，a 盖住多少
vec4 isles(vec3 rd) {
  float rel = sunAzimuth(rd), y = rd.y;
  float nearTop = isleRidge(rel, 3.1, .2, .62, .016) + isleRidge(rel, 8.4, -.75, -.42, .011);
  float farTop = isleRidge(rel, 5.7, -.46, -.1, .009) * .9 + isleRidge(rel, 1.9, .55, 1.1, .012);   // 落日正下方不放岛：它沉进去的是海
  float px = .0006;                                                                   // 轮廓边上一两个像素的过渡
  float nearA = smoothstep(nearTop, nearTop - px, y) * step(.0003, nearTop), farA = smoothstep(farTop, farTop - px, y) * step(.0003, farTop);
  vec3 air = hazeColor(rd);
  float foot = exp(-max(y, 0.) * 260.);                                               // 岛脚化在亮霭里
  vec3 nearC = mix(uIsle * (uSkyCol * .35 + .25), air, mix(.5, .92, foot)), farC = mix(uIsle * (uSkyCol * .4 + .3), air, mix(.74, .96, foot));
  vec3 c = mix(farC, nearC, nearA);
  return vec4(c, max(nearA, farA));
}

${SUN_GLSL}

// 天在 rd 方向上的颜色（rd.y 不小于 0）。steps：云朝落日走几步；direct：是不是直接看天（海里的倒影不画日面、横云和光柱，落日的倒影另算）
vec3 skyColor(vec3 ro, vec3 rd, int steps, bool direct) {
  vec3 c = skyGradient(rd);
  float ang = acos(clamp(dot(rd, uSunDir), -1., 1.)), az = sunAzimuth(rd), el = asin(clamp(rd.y, 0., 1.)), cover = 0.;
  if (direct) {
    // 光柱里亮一点，两道光柱之间的暗缝把那一带的天压暗一点
    vec2 fan = rayFan(rd);
    c = c * (1. - .06 * fan.y * (1. - fan.x)) + uRayCol * (fan.x * fan.y * smoothstep(0., .06, el));
    vec3 face = sunDisc(az, el, cover);
    c = mix(c, face, cover * (1. - .8 * exp(-el / .008)));                                 // 日面最底下化进海平线的亮霭里
  }
  // 卷云和云团远在日面那个方向上只剩霭色的细丝，盖在日面上是几道发白的横纹，所以日面前面不画它们（挡日面的是下面那几道横云）
  vec4 ci = cirrus(ro, rd);
  c = mix(c, ci.rgb, ci.a * (1. - cover));
  vec4 cl = cloudLayer(ro, rd, steps);
  c = mix(c * cl.a + cl.rgb, c, cover);
  if (direct) c = barsOver(c, rd, az, el, ang, cover);
  vec4 is = isles(rd);
  return mix(c, is.rgb, is.a);
}`;

const VERT = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.);
  gl_Position.z = gl_Position.w;
}`;
const FRAG = /* glsl */`
#include <common>
${COMMON}
${SKY_GLSL}
varying vec3 vDir;
void main() {
  vec3 rd = normalize(vDir), ro = cameraPosition;
  vec3 c = rd.y < 0. ? hazeColor(rd) : skyColor(ro, rd, 5, true);
  c += (pixelNoise(gl_FragCoord.xy + 17.) - .5) * .009 * pow(max(c, vec3(1e-4)), vec3(.55));
  gl_FragColor = vec4(c, 1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function buildSky() {
  const sky = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 3), new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: U, side: THREE.BackSide, depthWrite: false }));
  sky.frustumCulled = false; sky.renderOrder = 900;
  return sky;
}
