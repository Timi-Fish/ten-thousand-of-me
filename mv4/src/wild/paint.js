// 上色：外景里所有东西共用的着色器底子，和全场共用的一套量（U）。
// 画法偏手绘：受光只有一道很软的明暗交界，背光面由天光和地面反光托住，没有高光；
// 雾是逐像素算的（air.js）——远处的东西先染上天色、再化进天边；云海面上浮着一层云气，低处贴着水面和山脚有薄雾；山挡住光的地方雾是暗的。
// 光用的是自己的量（和场景里那几盏灯同值），只有投影借用 three 的那一套，这样小蟹和树的影子能落到路上；天上流云的影子也落在地上。
import * as THREE from 'three';
import { noiseTexture } from './noise.js';
import { cloudMapTexture } from './cloudnoise.js';
import { AIR } from './air.js';

export const VILLAGE_LIGHTS = 48;                                                // 着色器最多认几处村子的灯光
const v3 = () => ({ value: new THREE.Vector3() }), v4 = () => ({ value: new THREE.Vector4() }), col = () => ({ value: new THREE.Color() }), num = (x = 0) => ({ value: x });
// 全场共用的量。季节一换，seasons.js 把新值写进来；时间由 wild.js 每帧写
export const U = {
  uTime: num(), uNoise: { value: noiseTexture() },
  uSunDir: v3(), uSunCol: col(), uSkyCol: col(), uGndCol: col(),                 // 日（月）的方向和颜色，天光，地面反光
  uZenith: col(), uSkyMid: col(), uHorizon: col(), uHorizonSun: col(),           // 天顶、半空、天边、朝着日月那一侧的天边
  uFogP: v4(), uMistCol: col(),                                                  // 远霭的浓度、低雾的浓度、低雾顶面的高度、低雾往上变淡的快慢；低雾的颜色
  uWind: v4(),                                                                   // 风向（x、z）、风力、阵风掠过的快慢
  uPick: v4(),                                                                   // 四个季节各占贴图一个通道，这里是当季那一个
  uSnow: num(), uWet: num(), uLamp: num(),                                       // 积雪、雨后的湿、灯火亮不亮
  uLand: { value: null }, uLand2: { value: null }, uBake: { value: null }, uLandRect: v4(),   // 近处地形的贴图：高度等、路和溪的远近、四季的山影；以及它盖住的范围
  uFar: { value: null }, uFarRect: v4(),                                         // 远处地形的高度贴图和范围
  uCloudMap: { value: cloudMapTexture() },                                       // 云和雾的形状用的噪声贴图（cloudnoise.js）
  uShadeTop: { value: null }, uShadeFar: { value: null },                        // 四季的山影顶（近处、远处），shade.js 在地形建好后算出来
  uSkyGlow: col(), uAntiSun: col(), uAirP: v4(), uVale: v4(), uHiP: v4(), uHiQ: v4(),   // 空气和高空云随季节换的量（含义见 air.js）
  uRayCol: col(), uLightFx: v4(),                                                // 光柱的颜色；光效的分寸（含义见 air.js）
  uWeather: { value: new THREE.Vector4(1, 0, 0, 0) },                            // 天气停没停（weather.js 的 setWeather 写；含义见 air.js）
  uVillages: { value: Array.from({ length: VILLAGE_LIGHTS }, () => new THREE.Vector4(0, 0, 1, 0)) },   // 谷里村子的灯光：x、z、照多远、多亮（scenery.js 写，地形和雾的着色器读）
};

// 随季节换的量。季节表（seasons.js）里每一季的 u 给出它们的值：'#十六进制' 是颜色，['#十六进制', 倍数] 是带亮度的颜色，数字数组是向量，数字就是数字。
// 各模块用 seasonal() 领自己要的那几个；setSeasonUniforms() 换季时把整张表写进去，表里缺了谁就报错
const SEASONAL = new Map(['uZenith', 'uSkyMid', 'uHorizon', 'uHorizonSun', 'uFogP', 'uMistCol', 'uWind', 'uSnow', 'uWet', 'uLamp', 'uSkyGlow', 'uAntiSun', 'uAirP', 'uVale', 'uHiP', 'uHiQ', 'uRayCol', 'uLightFx'].map(name => [name, U[name]]));   // U 里随季节换的那几个先登记上
const WRITE = {
  color: (u, v) => u.value.set(v), scaled: (u, v) => u.value.set(v[0]).multiplyScalar(v[1]),
  vector: (u, v) => u.value.fromArray(v), number: (u, v) => { u.value = v; },
};
export const kindOf = v => typeof v === 'string' ? 'color' : typeof v === 'number' ? 'number' : typeof v[0] === 'string' ? 'scaled' : 'vector';
const BLANK = { color: () => new THREE.Color(), scaled: () => new THREE.Color(), number: () => 0, vector: v => v.length === 3 ? new THREE.Vector3() : v.length === 2 ? new THREE.Vector2() : new THREE.Vector4() };
export function seasonal(sample, ...names) {
  const out = {};
  for (const name of names) {
    if (!SEASONAL.has(name)) SEASONAL.set(name, name in U ? U[name] : { value: BLANK[kindOf(sample[name])](sample[name]) });
    out[name] = SEASONAL.get(name);
  }
  return out;
}
export function setSeasonUniforms(table) {
  for (const [name, u] of SEASONAL) {
    if (!(name in table)) throw new Error(`季节表里缺 ${name}`);
    WRITE[kindOf(table[name])](u, table[name]);
  }
}

// 着色器里共用的一段：噪声、地形的贴图、空气（天的底色、雾、山影、高空云的分布，在 air.js 里）、受光
export const COMMON = /* glsl */`
uniform float uTime, uSnow, uWet, uLamp;
uniform sampler2D uNoise, uLand, uLand2, uBake, uFar;
uniform vec3 uSunDir, uSunCol, uSkyCol, uGndCol, uZenith, uSkyMid, uHorizon, uHorizonSun, uMistCol;
uniform vec4 uFogP, uWind, uPick, uLandRect, uFarRect;
vec4 noise4(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return texture2D(uNoise, (i + f + .5) / 256.); }
float noise1(vec2 p) { return noise4(p).r; }
float noise3(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3. - 2. * f);
  vec2 rg = texture2D(uNoise, (i.xy + vec2(37., 17.) * i.z + f.xy + .5) / 256.).gr;
  return mix(rg.x, rg.y, f.z);
}
float fbm(vec2 p) { float s = 0., a = .5; for (int k = 0; k < 4; k++) { s += a * noise1(p); p = mat2(1.6, 1.2, -1.2, 1.6) * p + 19.7; a *= .5; } return s / .9375; }
float fbm2(vec2 p) { return (noise1(p) * .5 + noise1(mat2(1.6, 1.2, -1.2, 1.6) * p + 19.7) * .25) / .75; }
vec2 landUv(vec2 xz) { return (xz - uLandRect.xy) * uLandRect.zw; }
// 这一处的地面高度：近处查细的那张，出了范围查粗的
float groundAt(vec2 xz) {
  vec2 uv = landUv(xz), e = min(uv, 1. - uv);
  return min(e.x, e.y) > .004 ? texture2D(uLand, uv).r : texture2D(uFar, (xz - uFarRect.xy) * uFarRect.zw).r;
}
// 山挡没挡住日月（按季节预先算好的大尺度山影）。出了近处的范围一律算没挡
float bakedSun(vec2 xz) {
  vec2 uv = landUv(xz), e = min(uv, 1. - uv);
  return mix(1., dot(texture2D(uBake, uv), uPick), smoothstep(0., .02, min(e.x, e.y)));
}
${AIR}
// 湿：颜色沉下去、更润（深的地方更深），不起反光
vec3 soak(vec3 c, float wet) { return mix(c, pow(c, vec3(1.45)) * 1.08, wet); }
// 雨后的水光：放晴之后，被日头照到的湿东西上挂着一粒粒水珠，各朝各的方向，转到正好的那几粒亮一下。
// 是一粒粒的碎光，不是一整片高光。grain：一粒有多大（世界里的尺寸）
float dewGlint(vec3 wp, vec3 N, float grain) {
  if (uWeather.y <= 0.) return 0.;
  vec3 g = wp / grain, cell = floor(g);
  vec4 h = texture2D(uNoise, (cell.xz + vec2(37., 17.) * cell.y + .5) / 256.);
  vec3 tilt = normalize(N + (h.rgb - .5) * 1.5);
  float aim = max(dot(reflect(normalize(wp - cameraPosition), tilt), uSunDir), 0.), dot2 = length(fract(g) - .5 - (h.gbr - .5) * .5);
  return pow(aim, 40.) * smoothstep(.34, .1, dot2) * (.6 + .4 * sin(uTime * (2. + 3. * h.a) + h.r * 40.)) * uWeather.y;
}
// 受光。sun：日光照不照得到（0 到 1）；ao：凹处的暗；thin：薄的东西（叶、花瓣）背面透过来的光。
// 灯的亮度是按小蟹定的（平涂的角色要亮）；景物按同样的灯算出来会发白，所以整体压到 GAIN，颜色才沉得住
const float GAIN = .6;
vec3 wildLight(vec3 albedo, vec3 N, float sun, float ao, float thin) {
  float nl = dot(N, uSunDir), lit = max(smoothstep(-.12, .62, nl), thin * .75) * sun;
  vec3 amb = mix(uGndCol, uSkyCol, .5 + .5 * N.y) * ao;
  return albedo * (amb + uSunCol * lit) * (RECIPROCAL_PI * GAIN);
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
  float alpha = 1., sun = 1., ao = 1., thin = 0., fogged = 1.;
  ${o.fragment}
  sun *= getShadowMask() * hiShade(vWp);                                         // 小蟹和树的影子、天上流云的影子
  vec3 c = wildLight(albedo, N, sun, ao, thin);
  #if NUM_POINT_LIGHTS > 0
  IncidentLight lamp; vec3 Nv = normalize(mat3(viewMatrix) * N);
  for (int i = 0; i < NUM_POINT_LIGHTS; i++) {
    getPointLightInfo(pointLights[i], vViewPos, lamp);
    c += albedo * min(lamp.color, vec3(5.)) * (.3 + .7 * max(dot(Nv, lamp.direction), 0.)) * (RECIPROCAL_PI * GAIN);   // 贴着灯的地方不让它亮到发白
  }
  #endif
  c = mix(c + glow, wildFog(c + glow, vWp), fogged);
  gl_FragColor = vec4(c, alpha);
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
//   fragment：定出 albedo（固有色），还可以改 N、alpha、sun、ao、thin、glow（自发光）、fogged（受不受雾）。
// 返回的材质带一个 .depth：投影时用的同形材质（摆动的树，影子也跟着摆）
export function paint({ vertexPars = '', vertex = '', world = '', fragmentPars = '', fragment, depthFragment = '', uniforms = {}, defines = {}, side = THREE.FrontSide, ...opts }) {
  const o = { vertexPars, vertex, world, fragmentPars, fragment, depthFragment };
  const all = { ...THREE.UniformsUtils.merge([THREE.UniformsLib.lights]), ...U, ...uniforms };
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT(o, false), fragmentShader: FRAG(o), uniforms: all, defines, lights: true, side, ...opts });
  mat.depth = new THREE.ShaderMaterial({ vertexShader: VERT(o, true), fragmentShader: DEPTH_FRAG(o), uniforms: { ...U, ...uniforms }, defines: { ...defines, DEPTH: '' }, side });
  return mat;
}

// 把网格挂上投影用的材质
export function shadowed(mesh, cast = true, receive = true) {
  mesh.castShadow = cast; mesh.receiveShadow = receive;
  if (cast) mesh.customDepthMaterial = mesh.material.depth;
  return mesh;
}

// 风：树、草、花随风摆动的位移（世界坐标）。at：这东西的根在哪；bend：这个顶点跟着摆多少（根部 0，梢上大）；phase：各自的相位
export const WIND = /* glsl */`
vec3 windSway(vec3 at, float bend, float phase) {
  float gust = noise1(at.xz * .013 - uWind.xy * uTime * uWind.w) - .32;            // 一阵一阵掠过山坡的风
  float push = uWind.z * bend * (.3 + 2.4 * max(gust, 0.) + .45 * sin(uTime * 1.9 + phase * 6.283 + at.x * .13));
  float patter = pow(max(sin(uTime * (5. + 4. * phase) + phase * 50.), 0.), 8.);   // 下雨的时候（只有夏天湿）：叶和草被雨压得垂下去一点，雨点打上去一下一下地颤
  return vec3(uWind.x * push, -.18 * abs(push) - uWeather.x * uWet * bend * (.14 + .1 * patter), uWind.y * push) + vec3(sin(uTime * 3.7 + phase * 40.), 0., cos(uTime * 3.1 + phase * 23.)) * .03 * uWind.z * bend;
}`;
