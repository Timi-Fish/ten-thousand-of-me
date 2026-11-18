// 水：山下的湖。溪、瀑布和落水处的水雾飞沫在 stream.js，这里一并装进场景。
// 湖面逐像素算：
//   水波——三层大小、方向、速度都不同的起伏叠在一起，求出水面的朝向；近处再加两层细碎的涟漪。远处的波自动抹平（水面越远越像镜子）。
//   倒影——按视线的反射方向取天色，天上的云也映在里面；再沿那个方向在高度图上走一段，碰到山就映出山影（越远的山影越淡）。
//   碎光——日月在水里的倒影被细浪打碎：每一小片水面只在它的朝向正好把光反到镜头里的时候闪一下，合起来就是一条朝着日月的、闪烁的光路；
//     再叠一层更碎、走得更快的小皱，碎光一粒粒地闪，整条光路随大的水波一阵亮一阵暗。
//   岸边——水浅的地方透出水底；一道道细浪朝岸上推，推到头留一线白沫。
//   夏天的雨点在水面上打出一圈圈涟漪（雨停了就没有）；冬天近岸和背风的湾里结冰，冰上落了雪，冰面只泛一片柔光。
import * as THREE from 'three';
import { LAKE_Y } from './land.js';
import { COMMON, U, seasonal } from './paint.js';
import { SEASONS } from './seasons.js';
import { buildStreams } from './stream.js';
import { WATER as LAKE } from './scenerymap.js';                     // 湖面那张面片的范围
const VERT = /* glsl */`
varying vec3 vWp;
void main() { vWp = (modelMatrix * vec4(position, 1.)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vWp, 1.); }`;
const FRAG = /* glsl */`
#include <common>
${COMMON}
uniform vec3 uWaterDeep, uWaterShallow, uReflLand, uDiscCol, uHiLit, uHiShade;
uniform vec3 uWaterP;       // 波浪大小、碎光强弱、雨点多少
uniform vec2 uFlow;         // 水流的急缓、结不结冰
varying vec3 vWp;

// 水面的起伏（只用来求朝向）：大的涌、中的浪、细的皱，各走各的方向
float swellAt(vec2 p) {
  vec2 w = uWind.xy * uTime;
  float a = texture2D(uCloudMap, p / 46. + w * .011).b, b = texture2D(uCloudMap, p / 19. - w.yx * .02 + a * .05).b, c = texture2D(uCloudMap, p / 7.3 + w * .033).a;
  return a * .6 + b * .5 + c * .2;
}
// 雨点打出的涟漪：水面分成小格，每格一滴，按各自的节拍落下，圈一边变大一边变淡。返回 xy：把水面朝向推歪多少；z：圈有多显
vec3 rainRings(vec2 p) {
  vec3 sum = vec3(0.);
  for (int k = 0; k < 2; k++) {
    vec2 g = p / (2.4 + 1.9 * float(k)) + 17.3 * float(k), cell = floor(g);
    vec4 h = texture2D(uNoise, (cell + .5) / 256.);
    float age = fract(uTime * (.55 + .4 * h.a) + h.r * 7.), fade = (1. - age) * (1. - age);
    vec2 d = fract(g) - .5 - (h.gb - .5) * .5; float far = length(d), off = (far - age * .47) / .03;
    float ring = exp(-off * off) * fade;
    sum += vec3(d / max(far, 1e-3) * ring * clamp(off, -1., 1.), ring);
  }
  return sum;
}
// 倒影方向上的天：天色，加上映在水里的云
vec3 mirroredSky(vec3 R) {
  float t = (HI_BASE + .3 * HI_SPAN * uHiQ.y - vWp.y) / max(R.y, .07);
  float col = hiColumn(hiCoord(vWp.xz + R.xz * t), 1.5, uHiQ.w * exp(-R.y * 5.));
  return mix(skyGradient(R), mix(uHiShade, uHiLit, .3 + .6 * smoothstep(.15, .9, col)), .85 * smoothstep(.04, .5, col) * exp(-t / 15000.));
}

void main() {
  float ground = groundAt(vWp.xz), depth = ${LAKE_Y.toFixed(1)} - ground;
  if (depth < 0.) discard;
  vec3 rd = normalize(vWp - cameraPosition); float dist = distance(vWp, cameraPosition), wave = uWaterP.x * (.6 + .7 * uWind.z);
  // 水面的朝向：大形的起伏求差分；岸边的细浪顺着水深的等高线朝岸上推；雨点的涟漪
  float e = .16 + dist * .0025, h0 = swellAt(vWp.xz);
  vec2 tilt = vec2(swellAt(vWp.xz + vec2(e, 0.)) - h0, swellAt(vWp.xz + vec2(0., e)) - h0) / e * .26 * wave;
  vec2 ashore = vec2(groundAt(vWp.xz + vec2(1.5, 0.)), groundAt(vWp.xz + vec2(0., 1.5))) - ground;      // 朝岸的方向（水底往哪边升高）
  float lapPhase = depth * 4.6 - uTime * 1.5 + 5. * noise1(vWp.xz * .27), near = smoothstep(2.6, .25, depth) * (1. - uFlow.y);
  tilt += normalize(ashore + 1e-4) * cos(lapPhase) * .13 * near;
  float rain = uWaterP.z * uWeather.x;                                                   // 雨停了，涟漪跟着没了
  vec3 rings = rain > 0. ? rainRings(vWp.xz) * rain * smoothstep(120., 20., dist) : vec3(0.);
  tilt += rings.xy * .5;
  vec3 N = normalize(vec3(-tilt.x, 1., -tilt.y));
  // 细碎的涟漪：只管碎光和近处的倒影
  vec2 w = uWind.xy * uTime, fine = ((noise4(vWp.xz * 1.3 + w * .5).rg - .5) * .2 + (noise4(vWp.xz * 3.7 - w * .9).ba - .5) * .13) * wave / (1. + dist * .012);
  vec3 Nf = normalize(N + vec3(fine.x, 0., fine.y));

  vec3 R = reflect(rd, Nf); R.y = abs(R.y) + .015; R = normalize(R);
  vec3 refl = mirroredSky(R);
  // 山影
  float t = 5., hit = 0., far = 0.;
  for (int i = 0; i < 22; i++) { vec3 q = vWp + R * t; float over = smoothstep(-4., 22., groundAt(q.xz) - q.y) * (1. - hit); far += over * t; hit += over; t *= 1.33; }
  // 映出来的是隔着雾看到的那片山：照样过一遍雾，再比岸上的山暗一层
  vec3 land = wildFog(uReflLand * (uSkyCol * .5 + uSunCol * .22) * (RECIPROCAL_PI * GAIN), vWp + R * (far / max(hit, 1e-3))) * .92;
  refl = mix(refl, land, hit * .92);
  // 碎光：日月的倒影。近处每一片细浪各闪各的，远处合成一条柔的光带
  float seen = sunSeen(vWp + vec3(0., 1., 0.)), mirror = max(dot(R, uSunDir), 0.);
  // 再叠一层很碎、走得很快的小皱，碎光才一粒粒地闪：每一粒只在小皱转到正好的那一下亮
  vec2 sparkle = ((noise4(vWp.xz * 6.1 + w * 2.3).rg - .5) * .16 + (noise4(vWp.xz * 13.7 - w.yx * 3.1).ba - .5) * .1) * wave / (1. + dist * .02);
  float mirror2 = max(dot(reflect(rd, normalize(Nf + vec3(sparkle.x, 0., sparkle.y))), uSunDir), 0.);
  float glint = pow(mirror, mix(1400., 260., smoothstep(30., 500., dist))) * 1.2 + pow(mirror2, mix(2600., 500., smoothstep(30., 500., dist))) * 2.6 + pow(mirror, 70.) * .07;
  glint *= .75 + .5 * sin(uTime * 2.3 + swellAt(vWp.xz * .5) * 9.);                    // 整条光路随大的水波一阵亮一阵暗
  refl += uDiscCol * glint * uWaterP.y * seen * (1. - hit);

  // 水体：浅处透出水底的石子和泥，深处是水色
  float bedTone = .75 + .5 * noise1(vWp.xz * 1.9 + fine * 3.);
  vec3 lightIn = (uSkyCol * .7 + uSunCol * .32 * bakedSun(vWp.xz)) * (RECIPROCAL_PI * GAIN);
  vec3 body = mix(uWaterShallow * bedTone, uWaterDeep, smoothstep(0., 3.6, depth)) * lightIn;
  float fres = .1 + .9 * pow(1. - max(dot(-rd, Nf), 0.), 4.);
  vec3 c = mix(body, refl, fres);
  // 岸边：浪头上一线白，推到岸上留一圈沫
  vec3 white = (uSkyCol * .8 + uSunCol * .45) * (RECIPROCAL_PI * GAIN);
  float crest = smoothstep(.72, .98, sin(lapPhase)) * near * (.35 + .65 * noise1(vWp.xz * 1.1 + 7.));
  float lace = smoothstep(.34, .05, depth + .12 * sin(lapPhase)) * (.5 + .5 * noise1(vWp.xz * 2.3 - w * .2));
  c = mix(c, white, clamp(crest * .5 + lace * .65, 0., 1.) * (1. - uFlow.y));
  c += white * rings.z * .22;
  // 冰：近岸和背风的湾里结着，上面落了雪，有几道裂纹；冰面只泛一片柔光
  float ice = uFlow.y * smoothstep(.42, .56, fbm(vWp.xz * .018 + 3.) + .45 * smoothstep(9., 0., depth));
  float crack = smoothstep(.012, .0, abs(fbm(vWp.xz * .07 + 4.) - .5)) * .22, drift = smoothstep(.35, .7, fbm(vWp.xz * .06 + 11.));
  vec3 frost = mix(vec3(.62, .72, .9), vec3(.9, .93, 1.), drift) * (1. - crack) * (uSkyCol + uSunCol * .75 * bakedSun(vWp.xz)) * (RECIPROCAL_PI * GAIN);
  frost += uDiscCol * pow(max(dot(reflect(rd, vec3(0., 1., 0.)), uSunDir), 0.), 40.) * .05 * seen;
  c = mix(c, mix(frost, mirroredSky(reflect(rd, vec3(0., 1., 0.))), .14), ice);
  c = wildFog(c, vWp);
  gl_FragColor = vec4(c, smoothstep(0., .5, depth));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function buildWater(creek) {
  const group = new THREE.Group(), tints = seasonal(SEASONS.春.u, 'uWaterDeep', 'uWaterShallow', 'uReflLand', 'uDiscCol', 'uHiLit', 'uHiShade', 'uWaterP', 'uFlow');
  const lake = new THREE.Mesh(new THREE.PlaneGeometry(LAKE.x1 - LAKE.x0, LAKE.z1 - LAKE.z0).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: { ...U, ...tints }, transparent: true, depthWrite: false }));
  lake.position.set((LAKE.x0 + LAKE.x1) / 2, LAKE_Y, (LAKE.z0 + LAKE.z1) / 2); lake.renderOrder = 4;
  group.add(lake, buildStreams(creek));
  return group;
}
