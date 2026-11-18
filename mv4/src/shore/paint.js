// 上色的底子：海边所有材质共用的一套量（U）、着色器里共用的一段（噪声、空气、受光），和造材质的工具。
// 画法偏手绘：受光只有一道很软的明暗交界，背光面由天光和地面反光托住，没有高光；逆着落日看过去，轮廓上亮一线；最后都过一道霭（air.js）。
// 光用自己的量（和场景里给小蟹的那几盏灯同值）；只有投影借 three 的那一套，小蟹和松的影子才能落到礁石上。
import * as THREE from 'three';
import { tableTexture, cloudTexture } from './noise.js';
import { AIR } from './air.js';
import { sunDirAt, DUSK, TONES } from './palette.js';

const KIND = {
  color: v => new THREE.Color(v), scaled: v => new THREE.Color(v[0]).multiplyScalar(v[1]), number: v => v,
  vector: v => new [THREE.Vector2, THREE.Vector3, THREE.Vector4][v.length - 2]().fromArray(v),
};
const kindOf = v => typeof v === 'string' ? 'color' : typeof v === 'number' ? 'number' : typeof v[0] === 'string' ? 'scaled' : 'vector';
const read = v => KIND[kindOf(v)](v);

// 随日落变的量：每一项在日落开始和结束时的值
const SPANS = Object.entries(DUSK).map(([name, [from, to]]) => ({ name, from: read(from), to: read(to) }));

// 全场共用的量：时间由 shore.js 每帧写；落日的方向、uDusk（日落的进度）和 DUSK 里的量由 setDusk 写；其余是常量
export const U = {
  uTime: { value: 0 }, uTable: { value: tableTexture() }, uCloud: { value: cloudTexture() },
  uSunDir: { value: new THREE.Vector3() }, uDusk: { value: 0 },
  ...Object.fromEntries(SPANS.map(({ name, from }) => [name, { value: from.clone() }])),
  ...Object.fromEntries(Object.entries(TONES).map(([name, v]) => [name, { value: read(v) }])),
};
// 日落的进度 k（0 到 1）：落日沉下去，光、天色、云、海上的光路跟着一起变
export function setDusk(k) {
  U.uDusk.value = k;
  U.uSunDir.value.fromArray(sunDirAt(k)).normalize();
  for (const { name, from, to } of SPANS) U[name].value.copy(from).lerp(to, k);
}
setDusk(0);

export const COMMON = /* glsl */`
uniform float uTime;
uniform sampler2D uTable, uCloud;
uniform vec3 uSunDir, uSunCol, uSkyCol, uGndCol;
uniform vec4 uWind;
vec4 noise4(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return texture2D(uTable, (i + f + .5) / 256.); }
float noise1(vec2 p) { return noise4(p).r; }
float fbm(vec2 p) { float s = 0., a = .5; for (int k = 0; k < 4; k++) { s += a * noise1(p); p = mat2(1.6, 1.2, -1.2, 1.6) * p + 19.7; a *= .5; } return s / .9375; }
${AIR}
// 受光。sun：日光照不照得到（0 到 1）；ao：凹处的暗；thin：薄的东西背面透过来的光。
// 灯的亮度是按小蟹定的（平涂的角色要亮），景物按同样的灯算会发白，所以整体压到 GAIN
const float GAIN = .6;
vec3 shoreLight(vec3 albedo, vec3 N, float sun, float ao, float thin) {
  float nl = dot(N, uSunDir), lit = max(smoothstep(-.12, .62, nl), thin * .75) * sun;
  vec3 amb = mix(uGndCol, uSkyCol, .5 + .5 * N.y) * ao;
  return albedo * (amb + uSunCol * lit) * (RECIPROCAL_PI * GAIN);
}
// 逆光的轮廓：朝着落日看过去时，东西转向侧面的那一圈边上亮一线落日的颜色（影子里没有）
vec3 backRim(vec3 albedo, vec3 N, vec3 wp, float sun) {
  vec3 V = normalize(cameraPosition - wp);
  float back = max(dot(-V, uSunDir), 0.), edge = 1. - max(dot(N, V), 0.);
  return mix(albedo, vec3(1.), .3) * uSunCol * (RECIPROCAL_PI * GAIN * 1.4 * back * back * edge * edge * edge * smoothstep(-.35, .25, dot(N, uSunDir)) * sun);
}`;

const VERT = (o, depth) => /* glsl */`
#include <common>
${depth ? '' : '#include <shadowmap_pars_vertex>'}
${COMMON}
varying vec3 vWp, vN, vViewPos;
${o.vertexPars}
void main() {
  vec3 p = position, n = normal;
  #ifdef USE_INSTANCING
  mat4 M = modelMatrix * instanceMatrix;
  #else
  mat4 M = modelMatrix;
  #endif
  ${o.vertex}
  vec3 wp = (M * vec4(p, 1.)).xyz, wn = normalize(mat3(M) * n);
  ${o.world}
  vec4 worldPosition = vec4(wp, 1.), mvPosition = viewMatrix * worldPosition;
  gl_Position = projectionMatrix * mvPosition;
  vWp = wp; vN = wn; vViewPos = mvPosition.xyz;
  ${depth ? '' : 'vec3 transformedNormal = mat3(viewMatrix) * wn;\n  #include <shadowmap_vertex>'}
}`;

const FRAG = o => /* glsl */`
#include <common>
#include <packing>
#include <lights_pars_begin>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
${COMMON}
varying vec3 vWp, vN, vViewPos;
${o.fragmentPars}
void main() {
  vec3 N = normalize(vN) * (gl_FrontFacing ? 1. : -1.), albedo = vec3(.5), glow = vec3(0.);
  float alpha = 1., sun = 1., ao = 1., thin = 0.;
  ${o.fragment}
  // 小蟹和松的影子：落日太低，平的石面本来就只受一点点光，光挡掉了也看不出来；所以影子里连天光也压暗一些，影子才清楚
  float mask = getShadowMask();
  sun *= mask; ao *= mix(.58, 1., mask);
  vec3 c = shoreLight(albedo, N, sun, ao, thin) + backRim(albedo, N, vWp, sun) + glow;
  ${o.after}
  gl_FragColor = vec4(shoreFog(c, vWp), alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const DEPTH_FRAG = o => /* glsl */`
#include <common>
${COMMON}
varying vec3 vWp, vN, vViewPos;
${o.fragmentPars}
void main() { ${o.depthFragment} gl_FragColor = vec4(1.); }`;

// 造一个材质。o 里是几段着色器代码：
//   vertex：在物体坐标里改 p、n；world：在世界坐标里改 wp、wn（风吹的摆动写在这里）；
//   fragment：定出 albedo，还可以改 N、alpha、sun、ao、thin、glow；after：受光之后、过雾之前再改 c（水膜、浪沫这类不按漫射算的东西）。
// 返回的材质带一个 .depth：投影时用的同形材质
export function paint({ vertexPars = '', vertex = '', world = '', fragmentPars = '', fragment, after = '', depthFragment = '', uniforms = {}, defines = {}, side = THREE.FrontSide, ...opts }) {
  const o = { vertexPars, vertex, world, fragmentPars, fragment, after, depthFragment };
  const all = { ...THREE.UniformsUtils.merge([THREE.UniformsLib.lights]), ...U, ...uniforms };
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT(o, false), fragmentShader: FRAG(o), uniforms: all, defines, lights: true, side, ...opts });
  mat.depth = new THREE.ShaderMaterial({ vertexShader: VERT(o, true), fragmentShader: DEPTH_FRAG(o), uniforms: { ...U, ...uniforms }, defines: { ...defines, DEPTH: '' }, side });
  return mat;
}

// 挂上投影用的材质
export function shadowed(mesh, cast = true, receive = true) {
  mesh.castShadow = cast; mesh.receiveShadow = receive;
  if (cast) mesh.customDepthMaterial = mesh.material.depth;
  return mesh;
}

// 风：草木随风摆动的位移（世界坐标）。at：根在哪；bend：这个顶点跟着摆多少（根部 0，梢上大）；phase：各自的相位
export const WIND = /* glsl */`
vec3 windSway(vec3 at, float bend, float phase) {
  float gust = noise1(at.xz * .05 - uWind.xy * uTime * uWind.w * 6.) - .3;
  float push = uWind.z * bend * (.35 + 2.2 * max(gust, 0.) + .4 * sin(uTime * 2.1 + phase * 6.283 + at.x * .4)) * .5;
  return vec3(uWind.x * push, -.2 * abs(push), uWind.y * push) + vec3(sin(uTime * 4.1 + phase * 40.), 0., cos(uTime * 3.4 + phase * 23.)) * .035 * uWind.z * bend;
}`;
