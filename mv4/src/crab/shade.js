// 上色和描边。卡通着色：光只分暗、中、亮三档，档与档之间留一点柔和的过渡；暗部往偏紫红的方向走；
// 背着光的轮廓上有一圈柔和的边缘光；没有高光。描边：把形状沿法线在画面上胀开固定的几个像素，只画背面。
// 所有小蟹共用这几个材质。每只小蟹自己的量（变形、表情、骨头）在画它之前临时写进材质（见 bind）。
import * as THREE from 'three';
import { SOFT_GLSL } from './deform.js';
import { FACE_GLSL } from './face.js';
import { patterns } from './patterns.js';
import { BH, PULL } from './pose.js';

export const BONES = 10;                                           // 四肢的骨头数：两只手、四条腿、四只脚
const VERT = /* glsl */`
#include <common>
#include <fog_pars_vertex>
attribute vec3 aCol, aTint, aHull;
attribute vec4 aFx;
attribute float aId;
uniform vec2 uView;        // 画面的像素尺寸
uniform vec3 uLine;        // 描边：[在世界里多粗, 最细几个像素, 最粗几个像素]
uniform vec3 uInk;
uniform float uGhost;      // 虚影：描边也换成月光色
varying vec3 vCol, vTint, vNormal, vViewPos, vAt;
varying vec2 vUv, vSel;
#ifdef SOFT
${SOFT_GLSL}
uniform vec3 uSwayA, uSwayB;   // 慢摆（飘带、穗子）和快摆（毫毛）此刻偏了多少
uniform float uTime;
#endif
#ifdef BONES
uniform mat4 uBone[${BONES}];
#endif
void main() {
  vec3 p = position;
  #ifdef HULL
  vec3 n = aHull;
  #else
  vec3 n = normal;
  #endif
  #ifdef SOFT
  pullGain = aId > 0.5 ? 1.0 : ${PULL.cloth};
  vec3 moved = deform(p);
  n = deformNormal(p, n, moved);
  float breeze = sin(uTime * 2.6 + p.y * 3.0 + p.x * 2.0);          // 飘带自己还有一点微风
  p = moved + uSwayA * aFx.z + uSwayB * aFx.w + vec3(0.02, 0.0, 0.03) * breeze * aFx.z;
  #endif
  #ifdef BONES
  mat4 bone = uBone[int(aId + 0.5)];
  p = (bone * vec4(p, 1.0)).xyz;
  n = normalize(mat3(bone) * n);
  #endif
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  vec3 nv = normalize(normalMatrix * n);
  #ifdef HULL
  float ppu = projectionMatrix[1][1] * uView.y * 0.5 / max(0.1, -mvPosition.z);   // 这个距离上，一个单位长度占多少像素
  float px = clamp(uLine.x * ppu, uLine.y, uLine.z) * aFx.y;
  mvPosition.xyz += normalize(mvPosition.xyz) * (px / ppu) * 2.0;                 // 往远处退一点：贴在表面上的小东西不会被邻居的描边盖住
  gl_Position = projectionMatrix * mvPosition;
  float flatness = length(nv.xy);
  gl_Position.xy += nv.xy / max(flatness, 1e-4) * smoothstep(0.0, 0.3, flatness) * px * 2.0 / uView * gl_Position.w;
  vCol = mix(mix(uInk, aCol * 0.16, 0.3), vec3(0.42, 0.58, 1.2), uGhost);         // 线的颜色带一点所描部件自己的色相
  #else
  gl_Position = projectionMatrix * mvPosition;
  vCol = aCol; vTint = aTint; vNormal = nv; vViewPos = mvPosition.xyz; vAt = position; vUv = uv; vSel = vec2(aFx.x, aId);
  #endif
  #include <fog_vertex>
}`;

const FRAG = /* glsl */`
#include <common>
#include <bsdfs>
#include <fog_pars_fragment>
#include <lights_pars_begin>
uniform sampler2D uPat;
uniform vec3 uShade;       // 暗部的色偏
uniform float uRim, uGhost;
varying vec3 vCol, vTint, vNormal, vViewPos, vAt;
varying vec2 vUv, vSel;
#ifdef SOFT
${FACE_GLSL}
#endif
// 三档明暗：背光、侧光、迎光
const float DARK = 0.18;
float band(float d) { return DARK + (0.6 - DARK) * smoothstep(-0.08, 0.02, d) + 0.4 * smoothstep(0.4, 0.54, d); }
void main() {
  #if defined(DEPTH)
  gl_FragColor = vec4(1.0);
  #elif defined(HULL)
  gl_FragColor = vec4(vCol, 1.0);
  #else
  vec4 sel = max(vec4(0.0), 1.0 - abs(vSel.x - vec4(1.0, 2.0, 3.0, 4.0)));
  vec3 albedo = mix(vCol, vTint, dot(texture2D(uPat, vUv), sel));
  #ifdef SOFT
  if (vSel.y > 0.5) {
    float h = vAt.y / ${BH.toFixed(2)};
    albedo *= mix(vec3(0.9, 0.82, 0.86), vec3(1.06, 1.08, 1.02), smoothstep(0.0, 1.0, h));   // 果冻的通透感：底下颜色沉一点，往上透亮
    albedo = paintFace(albedo, vAt);
  }
  #endif
  vec3 N = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0), V = normalize(-vViewPos);
  vec3 amb = ambientLightColor, direct = vec3(0.0), rim = vec3(0.0);
  float lit = 0.0;
  IncidentLight light;
  #if NUM_HEMI_LIGHTS > 0
  for (int i = 0; i < NUM_HEMI_LIGHTS; i++) amb += getHemisphereLightIrradiance(hemisphereLights[i], N);
  #endif
  #if NUM_DIR_LIGHTS > 0
  for (int i = 0; i < NUM_DIR_LIGHTS; i++) {
    getDirectionalLightInfo(directionalLights[i], light);
    float facing = dot(N, light.direction), b = band(facing);
    direct += light.color * b; lit = max(lit, (b - DARK) / (1.0 - DARK));
    rim += light.color * smoothstep(0.1, 0.7, -dot(V, light.direction)) * smoothstep(-0.15, 0.45, facing);   // 光从对面来时，朝着它的轮廓亮一圈
  }
  #endif
  #if NUM_POINT_LIGHTS > 0
  for (int i = 0; i < NUM_POINT_LIGHTS; i++) {
    getPointLightInfo(pointLights[i], vViewPos, light);
    light.color /= max(1.0, max(light.color.r, max(light.color.g, light.color.b)) / 2.4);   // 点光封顶：凑到油灯跟前也只是被照得暖而亮，不会曝成一片白
    float b = band(dot(N, light.direction));
    direct += light.color * b; lit = max(lit, (b - DARK) / (1.0 - DARK) * min(1.0, dot(light.color, vec3(0.4))));
  }
  #endif
  float edge = 1.0 - clamp(dot(N, V), 0.0, 1.0);                     // 夹在 0 到 1 之间：正对镜头的像素点积会略大于 1，负数再去开方就不是数了
  #ifdef SOFT
  if (vSel.y > 0.5) albedo *= mix(vec3(1.0), vec3(0.94, 0.8, 0.82), 0.7 * smoothstep(0.35, 1.0, edge));   // 皮肤转向侧面的地方颜色沉一点，软方块才有厚度
  #endif
  vec3 col = mix(albedo * uShade, albedo, lit) * (amb + direct) * RECIPROCAL_PI;
  col += rim * smoothstep(0.45, 0.95, edge) * uRim * mix(albedo, vec3(1.0), 0.35) * RECIPROCAL_PI;
  // 受光再强也压在泛光的门槛以下（保持色相，越亮压得越多）：烈日下的白袍是白的，不会像自己在发光
  float peak = max(col.r, max(col.g, col.b));
  if (peak > 0.8) col *= (0.8 + 0.18 * (1.0 - exp(-(peak - 0.8) / 0.18))) / peak;
  // 虚影：不再受光，自己发月光色的光；轮廓最亮，中间留着原来的明暗（看得出五官和衣服）
  col = mix(col, vec3(0.30, 0.44, 0.95) * (0.5 + 1.5 * pow(edge, 1.6)) + dot(albedo, vec3(0.33)) * vec3(0.30, 0.38, 0.62), uGhost);
  gl_FragColor = vec4(col, 1.0);
  #endif
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

const V4 = () => new THREE.Vector4();
// 每只小蟹自己的量。own 里的名字是「每画一只都要换」的那些
const perCrab = () => ({
  uSq: { value: new THREE.Vector4(1, 1, 0, 0) }, uWave: { value: V4() }, uBend: { value: V4() }, uPull: { value: new THREE.Vector4(0, 0, 0, 1) }, uPullAt: { value: new THREE.Vector3() },
  uSwayA: { value: new THREE.Vector3() }, uSwayB: { value: new THREE.Vector3() }, uTime: { value: 0 },
  uEye: { value: new THREE.Vector4(0, 0, 1, 1) }, uGaze: { value: V4() }, uMouth: { value: V4() }, uFace: { value: new THREE.Vector4(0, 1, 0, 0) },
  uBone: { value: new Float32Array(16 * BONES) }, uLine: { value: new THREE.Vector3(.016, 1.5, 4.6) }, uGhost: { value: 0 },
});
export const OWN = Object.keys(perCrab());
function make(defines, o = {}) {
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.lights, THREE.UniformsLib.fog, {
    uView: { value: new THREE.Vector2(1920, 1080) }, uInk: { value: new THREE.Color('#3A0F0C') }, uShade: { value: new THREE.Color(.86, .7, .84) }, uRim: { value: .55 },
  }, perCrab()]);
  uniforms.uPat = { value: patterns() };
  return new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, defines, lights: !defines.DEPTH, fog: !defines.DEPTH, ...o });
}
const hull = { side: THREE.BackSide }, paint = { shadowSide: THREE.FrontSide };   // 投影用朝着光的那一面：脚底和地面之间不留一道亮缝
export const MAT = {
  soft: make({ SOFT: '' }, paint), softLine: make({ SOFT: '', HULL: '' }, hull), softDepth: make({ SOFT: '', DEPTH: '' }),
  limb: make({ BONES: '' }, paint), limbLine: make({ BONES: '', HULL: '' }, hull), limbDepth: make({ BONES: '', DEPTH: '' }),
  plain: make({}, paint), plainLine: make({ HULL: '' }, hull),
};

const size = new THREE.Vector2();
// 画这个网格之前，把这只小蟹自己的量写进（共用的）材质。u：{ 名字: 值 }
export function bind(mesh, u) {
  const load = (renderer, material) => {
    const U = material.uniforms, target = renderer.getRenderTarget();
    if (!U) return;                                                 // 没有自己的投影材质的部件（拉丝）投影时用的是 three 自带的，没什么可写
    for (const k of OWN) if (k in u) U[k].value = u[k];
    if (target) U.uView.value.set(target.width, target.height); else U.uView.value.copy(renderer.getDrawingBufferSize(size));
    material.uniformsNeedUpdate = true;
  };
  mesh.onBeforeRender = (renderer, scene, camera, geometry, material) => load(renderer, material);
  mesh.onBeforeShadow = (renderer, object, camera, shadowCamera, geometry, depthMaterial) => load(renderer, depthMaterial);
  mesh.frustumCulled = false;                                       // 形状在显卡上才变形，这边的包围盒不作数
  return mesh;
}
// 一组部件：上色的一层、描边的一层，都加到 parent 下。kind：'soft'、'limb' 或 'plain'
export function layers(geo, kind, parent, u) {
  const paint = bind(new THREE.Mesh(geo, MAT[kind]), u), line = bind(new THREE.Mesh(geo, MAT[kind + 'Line']), u);
  paint.castShadow = true;
  if (MAT[kind + 'Depth']) paint.customDepthMaterial = MAT[kind + 'Depth'];
  parent.add(paint, line);
  return { paint, line };
}
