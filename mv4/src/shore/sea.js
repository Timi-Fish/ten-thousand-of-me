// 海：画面的主角。一整张以矶头为圆心、一圈圈往外铺到天边的网格（近处密、远处疏），逐像素算光：
//   起伏——八道 Gerstner 涌浪真的推动网格（waves.js），浪峰尖、浪谷缓；网格太疏、画不出的短波在那一带自动抹掉。
//   朝向——片元里再叠二十道小波和随风跑的细纹；一个像素盖住的水面越大，越细的波越早抹平，抹掉的那部分坡度记下来，
//           让远处的水面「毛」一点：落日的倒影因此拉成一条从脚下一直铺到天边的光路，近处碎成一片片跳动的金鳞。
//   倒影——按反射方向取天（sky.js 的同一个函数：天色、落日照亮的空气、云、远岛），菲涅耳决定映多少：脚下看得进水里，远处整片映着天，在海平线上和天接成一片。
//   光路——落日自己的倒影另算：从落日脚下铺到近处，远处窄而连续，近处碎成金鳞；颜色跟着落日变红变暗。
//   水色——深处靛紫，近岸的浅水透出青绿；浪头迎着落日的那一面被照透，泛一层青绿的光。
//   浪沫——浪尖收得最紧的地方起沫，随浪生灭；近岸、礁石脚下水浅浪碎，一圈圈白沫随涌浪漫上来又散开；外海上有几缕被风拉长的残沫。
//   最后过一道霭，远处化进海平线上的那条亮霭里。
import * as THREE from 'three';
import { U, COMMON } from './paint.js';
import { SKY_GLSL } from './sky.js';
import { WAVES_GLSL } from './waves.js';

export const SEA_CENTER = [1, -5];
const SEGMENTS = 320, REACH = 9000;
const spacingAt = r => .2 + .028 * r;                                            // 这一圈到下一圈有多远（着色器里同一个式子）

const BED = /* glsl */`
uniform sampler2D uBed;
uniform vec4 uBedRect;
// 海底的高度（出了烘焙的范围就是外海的深水）
float bedAt(vec2 xz) {
  vec2 uv = (xz - uBedRect.xy) * uBedRect.zw;
  return (uv.x < 0. || uv.y < 0. || uv.x > 1. || uv.y > 1.) ? -9. : texture2D(uBed, uv).r;
}
// 浅水把浪压低：水深 0 时剩三成，三个单位深就是全幅
float dampAt(float depth) { return mix(.3, 1., smoothstep(.1, 3.2, depth)); }`;

const VERT = /* glsl */`
#include <common>
${COMMON}
${WAVES_GLSL}
${BED}
uniform vec2 uCenter;
varying vec3 vWp;
varying vec2 vXZ;
void main() {
  vec2 xz = position.xz;
  float r = length(xz - uCenter), damp = dampAt(-bedAt(xz));
  vec3 off = swellOffset(xz, uTime, ${spacingAt(0)} + ${(.028).toFixed(3)} * r, damp);
  vWp = vec3(xz.x + off.x, off.y, xz.y + off.z); vXZ = xz;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWp, 1.);
}`;

const FRAG = /* glsl */`
#include <common>
${COMMON}
${SKY_GLSL}
${WAVES_GLSL}
${BED}
uniform vec3 uSeaDeep, uSeaMid, uSeaShallow, uSeaGlow, uFoam, uGlint;
varying vec3 vWp;
varying vec2 vXZ;
const float GLINT_MAX = 1.45;               // 光路上最亮的碎金是 uGlint 的几倍

// 浪沫的纹：蜂窝的网眼加絮，顺着浪推的方向慢慢走，自己也在变
float foamPattern(vec2 xz, float scale) {
  vec2 drift = vec2(.12, .9) * uTime * .35;
  float net = texture2D(uCloud, xz * scale - drift * scale).a, net2 = texture2D(uCloud, xz * scale * 2.3 + drift * scale * .7 + .37).a;
  float fluff = texture2D(uCloud, xz * scale * 1.7 + vec2(uTime * .01, 0.)).g;
  return clamp(max(net, net2 * .8) * .9 + fluff * .55 - .25, 0., 1.);
}

void main() {
  vec2 xz = vXZ;
  vec3 toEye = cameraPosition - vWp; float dist = length(toEye); vec3 rd = -toEye / dist;
  float bed = bedAt(xz), depth0 = -bed, damp = dampAt(depth0), depth = vWp.y - bed;
  // 一个像素盖住多大的水面：斜着看时纵向拉得很长、横向还很细，取两个方向的几何平均（只按长的那边抹，远处的浪会被抹得太早）
  float footprint = max(sqrt(length(dFdx(xz)) * length(dFdy(xz))), 1e-4);
  vec4 g = seaSlope(xz, uTime, footprint, damp);
  // 随风跑的细纹：只在看得清的近处加
  vec2 w = uWind.xy * uTime;
  float near = smoothstep(.14, .02, footprint);
  vec2 ripple = ((noise4(xz * 2.2 + w * .55).rg - .5) * .11 + (noise4(xz * 5.3 - w * .9 + 3.).ba - .5) * .06) * near;
  g.w += (1. - near) * .0025;
  vec3 N = normalize(vec3(-g.x - ripple.x, 1. - g.z * .7, -g.y - ripple.y));

  // 倒影
  vec3 R = reflect(rd, N);
  R.y = abs(R.y) + .002; R = normalize(R);
  vec3 refl = skyColor(vWp, R, 2, false) * .88;
  float F = .02 + .98 * pow(1. - max(dot(-rd, N), 0.), 5.);
  // 落日的倒影：坡度的方差越大，倒影散得越开（光路越宽），亮度按散开的面积摊薄。
  // 远处一个像素里有无数个小浪面，合起来是窄而连续的一条；近处看得清一个个浪面，只有正好把落日映进眼里的那几片亮，碎成跳动的金鳞。
  // 外面再套一圈宽得多、淡得多的光：浪朝着落日的那一面染上一层橘红，背面留在暗里
  vec3 Hv = normalize(uSunDir - rd);
  float ch = max(dot(N, Hv), 1e-3), tan2 = (1. - ch * ch) / (ch * ch), s2 = (.00018 + g.w * 1.6) * (1. - .35 * uDusk), wide = s2 * 7. + .004;   // 落日越低光路越窄
  // 近处的金鳞一闪一闪：两层朝相反方向滑过去的细浓淡，叠到一起的那几点格外亮
  float twinkle = smoothstep(.3, .62, noise1(xz * 6.5 + w * .6) * noise1(xz * 15. - w + 9.));
  float spec = exp(-tan2 / (2. * s2)) * min(.0041 * 26. / (6.2832 * s2), 7.) * mix(1., .5 + 5. * twinkle, near) + .05 * exp(-tan2 / (2. * wide));
  float Fs = .02 + .98 * pow(1. - max(dot(-rd, Hv), 0.), 5.);
  // 亮度封顶，颜色不封：再亮也还是金的，不泛白；暗的地方偏红，最亮的几点偏黄
  float shine = 1. - exp(-spec * (.25 + Fs * 2.5) / GLINT_MAX);
  vec3 glitter = uGlint * (GLINT_MAX * shine) * mix(vec3(1., .7, .55), vec3(1., 1.2, 1.3), shine * shine);

  // 水体：浅处透青绿，深处靛紫；浪头迎着落日被照透
  vec3 lightIn = (uSkyCol * .55 + uSunCol * .22) * (RECIPROCAL_PI * GAIN);
  vec3 body = mix(mix(uSeaShallow, uSeaMid, smoothstep(.2, 2.6, depth)), uSeaDeep, smoothstep(2.4, 7., depth0)) * lightIn;
  float s = max(dot(rd, uSunDir), 0.);
  vec3 through = uSeaGlow * uSunCol * (RECIPROCAL_PI * GAIN) * .2 * smoothstep(0., 1., vWp.y) * (.15 + s * s * s) * smoothstep(60., 5., dist);
  vec3 c = mix(body + through, refl, F) + glitter;

  // 浪沫
  vec3 foamLit = uFoam * (uSkyCol * .9 + uSunCol * (.35 + .6 * max(dot(N, uSunDir), 0.))) * (RECIPROCAL_PI * GAIN) * 2.;
  float pat = foamPattern(xz, .11), patFine = foamPattern(xz + 3.1, .29);
  float crest = smoothstep(.2, .36, g.z + .14 * (pat - .5)) * (.3 + .7 * pat) * smoothstep(500., 60., dist);                               // 浪尖上的沫：浪收紧时起，散开就灭
  // 近岸：四周的海底有多高（礁石脚下一圈都算），水越浅沫越多；浪涌上来时沫铺得更开
  float rim = max(max(bedAt(xz + vec2(1.6, 0.)), bedAt(xz - vec2(1.6, 0.))), max(bedAt(xz + vec2(0., 1.6)), bedAt(xz - vec2(0., 1.6))));
  float surge = smoothstep(-.6, .7, vWp.y);
  float shore = smoothstep(-1.4 - 1.2 * surge, .2, rim) * smoothstep(.25, .9, pat * .6 + patFine * .6 - .15 + .35 * surge);
  float edge = smoothstep(.35, .04, depth + .25 * (patFine - .5)) * smoothstep(.15, .55, patFine + .3 * surge);   // 贴着水边的一线白，断断续续
  // 贴着陡壁：石壁在水里只占薄薄一条，水深量不出来，改看身边一小圈里有没有石头；浪涌上来时这一圈白翻得最厉害
  float wall = max(max(bedAt(xz + vec2(.7, 0.)), bedAt(xz - vec2(.7, 0.))), max(bedAt(xz + vec2(0., .7)), bedAt(xz - vec2(0., .7))));
  edge = max(edge, smoothstep(-1.2, .4, wall - vWp.y) * smoothstep(.2, .6, patFine * .8 + pat * .4 + .35 * surge - .1));
  float streak = smoothstep(.62, .9, texture2D(uCloud, vec2(dot(xz, vec2(.94, -.34)) * .006, dot(xz, vec2(.34, .94)) * .05) + w * .002).g) * .35 * smoothstep(400., 40., dist);
  float foam = clamp(max(max(crest, shore), max(edge, streak * patFine)), 0., 1.) * smoothstep(1400., 150., dist);
  c = mix(c, foamLit, foam * .92);

  c = shoreFog(c, vWp);
  c += (pixelNoise(gl_FragCoord.xy + 5.) - .5) * .008 * pow(max(c, vec3(1e-4)), vec3(.55));
  gl_FragColor = vec4(c, 1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// 一圈一圈的网格：圈距随半径变大
function rings() {
  const radii = [0];
  while (radii[radii.length - 1] < REACH) { const r = radii[radii.length - 1]; radii.push(r + spacingAt(r)); }
  const W = SEGMENTS + 1, pos = new Float32Array(radii.length * W * 3);
  radii.forEach((r, j) => {
    for (let i = 0; i <= SEGMENTS; i++) {
      const a = i / SEGMENTS * Math.PI * 2, k = (j * W + i) * 3;
      pos[k] = SEA_CENTER[0] + r * Math.cos(a); pos[k + 2] = SEA_CENTER[1] + r * Math.sin(a);
    }
  });
  const index = [];
  for (let j = 0; j < radii.length - 1; j++) for (let i = 0; i < SEGMENTS; i++) {
    const a = j * W + i, b = a + W;
    index.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(index);
  return geo;
}

export function buildSea(bedTex, bedRect) {
  const uniforms = { ...U, uBed: { value: bedTex }, uBedRect: { value: bedRect }, uCenter: { value: new THREE.Vector2(...SEA_CENTER) } };
  const sea = new THREE.Mesh(rings(), new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms }));
  sea.frustumCulled = false;
  return sea;
}
