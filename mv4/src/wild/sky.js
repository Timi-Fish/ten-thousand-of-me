// 天：逐像素画出来的天穹。一层一层从远到近叠上去：
//   天的底色（air.js 的 skyBase，和雾用的是同一个函数）→ 日月周围那团被照亮的空气（被山挡住的方向暗下去，就是光柱）→
//   云缝里漏下来的光柱（air.js 的 rayFan，光柱之间的暗缝把那团光也压暗）→ 雨停后背着日头的彩虹 →
//   冬夜的星和银河（stars.js）→ 日或月的圆面和几圈光晕（随薄云一明一暗，带几缕很淡的光芒）→ 卷云 → 有体积的云团（skyclouds.js）→
//   云前面那段空气里的光柱 → 贴着地平线的低雾和云气。
// 每个季节一个固定的时辰，全部差别来自 seasons.js 里那一季的颜色和云的参数。
// 最后加一点点逐像素的细噪，免得大片平缓的渐变在 8 位色里断成一条条色阶。
// 天排在所有不透明的东西之后画（只画没被山和树挡住的像素），因为云是逐像素走出来的，贵。
import * as THREE from 'three';
import { COMMON, seasonal } from './paint.js';
import { SEASONS } from './seasons.js';
import { SKY_CLOUDS } from './skyclouds.js';
import { STARS } from './stars.js';
import { bakeShadeTops } from './shade.js';

const VERT = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.);      // 只跟着镜头转，不跟着镜头走：天在无穷远
  gl_Position.z = gl_Position.w;
}`;
const FRAG = /* glsl */`
#include <common>
${COMMON}
${SKY_CLOUDS}
${STARS}
uniform vec3 uDiscCol;
uniform vec4 uDiscP;      // 日月：半径（弧度）、内圈光晕、外圈光晕、是不是月亮
uniform float uStars;
varying vec3 vDir;

// 每个像素一个 0 到 1 的数，相邻像素错得很开（拿来错开取样点、打散色阶）
float pixelNoise(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(.06711056, .00583715)))); }

// 光柱：这个方向上的空气有几成照得到日月。近处取样密，远处疏；高处空气稀，算得轻
float shafts(vec3 ro, vec3 rd, float jitter) {
  float sum = 0., total = 0.;
  for (int i = 0; i < 30; i++) {
    float f = (float(i) + jitter) / 30., t = 40. + 3000. * f * f;
    vec3 p = ro + rd * t;
    float w = (.25 + f) * exp(-max(p.y - 105., 0.) / 460.);
    sum += w * sunSeen(p); total += w;
  }
  return sum / total;
}

// 日或月的圆面。cover：这个像素在不在圆面里（边上有一两个像素的过渡）
vec3 disc(vec3 rd, out float cover) {
  vec3 e1 = normalize(cross(uSunDir, vec3(0., 1., 0.))), e2 = cross(e1, uSunDir);
  vec2 q = vec2(dot(rd, e1), dot(rd, e2)) / uDiscP.x;                                      // 圆面上的坐标：边上是 1，q.y 朝上
  float r2 = dot(q, q);
  cover = smoothstep(1.04, .95, sqrt(r2)) * step(0., dot(rd, uSunDir));
  // 太阳：中间亮、边上略暗；落到天边附近时，下半边被霭染红
  vec3 sun = uDiscCol * (1. - .2 * r2) * mix(vec3(1.), vec3(1., .56, .34), smoothstep(.5, -1., q.y) * smoothstep(.36, .1, uSunDir.y));
  // 月亮：大片的月海，零星的小坑，边上暗下去
  float seas = .62 * smoothstep(.38, .62, fbm(q * 1.6 + 3.3)) + .22 * smoothstep(.5, .72, fbm(q * 4.3 + 9.1));
  vec3 moon = uDiscCol * mix(vec3(1.), vec3(.6, .66, .78), seas) * (1. - .16 * r2 * r2);
  return mix(sun, moon, uDiscP.w);
}
// 光晕：紧贴圆面的一圈、稍大的一圈、漫开的一大片；月亮外面还有一道很淡的月晕。
// 日月跟前有一层看不出形状的薄云飘过：内两圈随它一明一暗（呼吸），再加几缕很淡的光芒，跟着薄云慢慢转、慢慢变
vec3 halo(vec3 rd, float ang) {
  vec3 e1 = normalize(cross(uSunDir, vec3(0., 1., 0.))), e2 = cross(e1, uSunDir);
  vec2 q = vec2(dot(rd, e1), dot(rd, e2));
  float veil = textureLod(uCloudMap, q * 1.4 + uTime * vec2(.011, .006) + vec2(.3, .7), 0.).b;
  float breathe = sunBreath() * (1. + uLightFx.w * (veil - .5) * .5);
  vec3 c = uDiscCol * (uDiscP.y * (.2 * exp(-ang / .03) + .07 * exp(-ang / .1)) * breathe + uDiscP.z * .032 * exp(-ang / .32));
  float spin = atan(q.y, q.x), spokes = textureLod(uCloudMap, vec2(spin * .477 + uTime * .0035, uTime * .004 + .21), 0.).b;
  c += uDiscCol * uLightFx.w * .035 * pow(smoothstep(.45, .85, spokes), 2.) * exp(-ang / .09) * breathe;
  float ring = (ang - .385) / .034;
  return c + uDiscP.w * uDiscCol * .012 * exp(-ring * ring) * mix(vec3(1., .84, .66), vec3(.78, .9, 1.), smoothstep(-1., 1., ring));
}
// 彩虹：背着日头的那一边，以反日点为心、半径约 42° 的一道弧；外面一道更淡的副虹，颜色反过来，两道之间的天略暗。
// 和山前空气里的那一段（air.js 的 bowInAir）是同一道虹，这里画的是它伸到天上的部分；整体压得很淡，贴地的两脚最显，往上淡下去
vec3 rainbow(vec3 rd, out float dim) {
  dim = 1.;
  if (uWeather.z <= 0. || rd.y < -.01) return vec3(0.);
  float a = degrees(acos(clamp(dot(rd, -uSunDir), -1., 1.)));
  vec3 bow = bowBands((a - 39.8) / 2.8) + .3 * bowBands((54. - a) / 3.6);
  dim = 1. - .07 * uWeather.z * smoothstep(42.6, 43.6, a) * smoothstep(51.2, 50.2, a);
  float fade = smoothstep(-.01, .04, rd.y) * (.55 + .45 * smoothstep(.42, .03, rd.y));
  return mix(bow, vec3(dot(bow, vec3(.333))), .25) * fade * uWeather.z;
}

void main() {
  vec3 rd = normalize(vDir), ro = cameraPosition;
  float jitter = pixelNoise(gl_FragCoord.xy), ang = acos(clamp(dot(rd, uSunDir), -1., 1.));
  float lit = 1.;
  if (uAirP.z > 0.) lit = mix(1., shafts(ro, rd, jitter), uAirP.z);
  // 云缝里漏下来的光柱：光柱里亮，两道光柱之间的暗缝把日月周围那团光也压暗一些
  vec2 fan = rayFan(rd, 12);
  vec3 rays = rayLight(fan) * lit;
  float dim;
  vec3 bow = rainbow(rd, dim);
  vec3 c = skyBase(rd) * dim + sunWash(rd) * lit * (1. - .45 * uLightFx.x * sqrt(fan.y) * (1. - fan.x)) + rays * .7;
  c += bow * dot(c, vec3(.3, .5, .2)) * .8;
  if (uStars > 0.) c += starSky(rd, ang) * uStars;

  float cover;
  vec3 face = disc(rd, cover);
  c = mix(c + halo(rd, ang) * (.45 + .55 * lit), face, cover);

  vec4 cirrus = hiCirrus(ro, rd);
  c = mix(c, cirrus.rgb, cirrus.a * (1. - .7 * cover));                                    // 卷云薄，盖不住日月
  float dist;
  vec4 clouds = hiClouds(ro, rd, jitter, dist);
  vec3 body = mix(clouds.rgb, (airColor(rd) + sunWash(rd) * lit) * (1. - clouds.a), 1. - exp(-dist * 8.5e-5));   // 远处的云融进霭里
  c = c * clouds.a + body + rays * .3;                                                       // 光柱有一部分在云前面的空气里

  c = lowAirOver(c, ro, rd, 7000., lit, 1.);
  c += (pixelNoise(gl_FragCoord.xy + 17.) - .5) * .0086 * pow(max(c, vec3(1e-4)), vec3(.545));
  gl_FragColor = vec4(c, 1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function buildSky(U) {
  bakeShadeTops(U);
  const uniforms = { ...U, ...seasonal(SEASONS.春.u, 'uDiscCol', 'uDiscP', 'uHiLit', 'uHiShade', 'uHiRim', 'uStars') };
  const sky = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 3), new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, side: THREE.BackSide, depthWrite: false }));
  sky.frustumCulled = false; sky.renderOrder = 900;
  return sky;
}
