// 飞沫：浪拍上礁石溅起的水花，和风里飘着的几点浮沫。全部在着色器里按时间算位置（画面是时间的纯函数）。
// 拍岸：礁石脚下迎着浪的那几处陡壁各是一个「溅点」。最大那道涌浪的浪峰每一次推到溅点，那里就溅一次——
//   水珠先往上、往外冲，再被重力拉回来、被海风往岸上带；水雾一团团鼓开、变淡。
//   每一次溅多高，看那一刻几道浪叠起来有多高（浪群里的大浪溅得高），所以不是机械的一下一下。
//   迎着落日看过去，水花被逆光打透，亮得发金（超过 1 的部分会泛光）。
// 浮沫：几十点很小的白沫，在矶头周围顺着海风飘，飘出一圈就从上风头再进来。
import * as THREE from 'three';
import { rnd } from '../anim.js';
import { U, COMMON } from './paint.js';
import { WAVES, MAIN } from './waves.js';
import { FINE } from './land.js';

const DROPS = 26, MIST = 7, MOTES = 28;                                         // 每个溅点的水珠、水雾团数；浮沫的点数
const f = x => x.toFixed(5);

// 找溅点：水边（地面在海面上下一点）、很陡、朝着浪来的方向（浪往 +z 推，所以面朝 -z）的地方，彼此隔开至少 2.4
function findSplashes(heightAt) {
  const found = [], e = .3;
  for (let z = FINE.z0 + 2; z < 4; z += .5) for (let x = FINE.x0 + 2; x < FINE.x1 - 2; x += .5) {
    const h = heightAt(x, z);
    if (h < -.35 || h > .5) continue;
    const gx = (heightAt(x + e, z) - heightAt(x - e, z)) / (2 * e), gz = (heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e), g = Math.hypot(gx, gz);
    if (g < 1.3 || gz < g * .35) continue;                                       // 地面往 +z 升高：这面石壁朝着 -z，迎着浪
    if (found.some(s => Math.hypot(s.x - x, s.z - z) < 2.4)) continue;
    found.push({ x, z, nx: -gx / g, nz: -gz / g });
  }
  return found;
}

const VERT = /* glsl */`
#include <common>
${COMMON}
attribute vec4 aFrom;      // 溅点（x、y、z）、这一粒的种子
attribute vec4 aSeed;      // 朝外的方向（x、z）、两个随机数
attribute float aKind;     // 0 水珠，1 水雾，2 浮沫
varying vec2 vUv;
varying float vFade, vKind, vSunward;
float seaAt(vec2 xz, float t) {
  float y = 0.;
  ${WAVES.map(v => `y += ${f(v.A)} * sin(${f(v.k)} * dot(vec2(${f(v.dx)}, ${f(v.dz)}), xz) - ${f(v.w)} * t + ${f(v.phase)});`).join('\n  ')}
  return y;
}
float hash(float n) { return fract(sin(n * 91.345 + 47.123) * 43758.5453); }
void main() {
  vec3 at; float size, fade;
  if (aKind < 1.5) {
    // 这一粒属于最近一次浪峰。浪峰到达溅点的时刻：主浪的相位走到 π/2
    float T = 6.2832 / ${f(MAIN.w)}, th = ${f(MAIN.w)} * uTime - ${f(MAIN.k)} * dot(vec2(${f(MAIN.dx)}, ${f(MAIN.dz)}), aFrom.xz) - ${f(MAIN.phase)} + 1.5708;
    float cycle = floor(th / 6.2832), age = fract(th / 6.2832) * T - .15 - aSeed.z * .25;
    float hitTime = uTime - age;
    float power = smoothstep(.15, .95, seaAt(aFrom.xz, hitTime)) * (.6 + .5 * hash(cycle * 7.1 + aFrom.w * .37 + aFrom.x));
    float life = aKind < .5 ? .9 + .7 * aSeed.w : 1.6 + .8 * aSeed.w;
    float k = age / life;
    vec2 out2 = aSeed.xy;
    float r1 = hash(aFrom.w + cycle * 3.3), r2 = hash(aFrom.w * 1.7 + cycle * 5.1 + 2.), r3 = hash(aFrom.w * 2.3 + cycle * 1.9 + 4.);
    vec3 v0 = vec3(out2.x, 0., out2.y) * (1. + 2.4 * r1) + vec3(r3 - .5, 0., r1 - .5) * 1.6 + vec3(0., 3. + 5.5 * r2, 0.);
    v0 *= power * (aKind < .5 ? 1. : .4);
    float g = aKind < .5 ? 11.5 : 4.;                                             // 水雾往下落得慢，被风带走
    // 水雾从溅点外面一点、高一点的地方鼓起来，免得一半埋在水面和石壁里（被切成一条一条的）
    vec3 start = aFrom.xyz + (aKind < .5 ? vec3(0.) : vec3(out2.x * .9, .7, out2.y * .9));
    at = start + v0 * age + vec3(0., -.5 * g * age * age, 0.) + vec3(uWind.x, 0., uWind.y) * age * age * .9;
    at.y = max(at.y, aFrom.y + (aKind < .5 ? -.3 : .4));
    size = aKind < .5 ? (.05 + .09 * r3) * (1. + k) : (.35 + .5 * r1) * (.5 + 1.6 * k);
    fade = step(0., age) * step(age, life) * smoothstep(1., .55, k) * smoothstep(.02, .3, power) * (aKind < .5 ? 1. : .2 * smoothstep(0., .15, k));
  } else {
    // 浮沫：在矶头周围一个 40×20×40 的盒子里顺风飘，出了盒子从上风头再进来
    vec3 box = vec3(40., 9., 40.), drift = vec3(uWind.x, .06, uWind.y) * (1.2 + aSeed.z) * uTime;
    vec3 p = aFrom.xyz + drift + vec3(sin(uTime * (.7 + aSeed.w) + aFrom.w), sin(uTime * 1.3 + aFrom.w * 2.), cos(uTime * .9 + aFrom.w)) * .35;
    at = mod(p - vec3(-20., .6, -24.), box) + vec3(-20., .6, -24.);
    size = .022 + .03 * aSeed.w;
    vec3 rel = mod(p - vec3(-20., .6, -24.), box) / box;
    fade = smoothstep(0., .08, min(min(rel.x, 1. - rel.x), min(rel.z, 1. - rel.z))) * .55;
  }
  vec3 toCam = normalize(cameraPosition - at);
  vSunward = max(dot(-toCam, uSunDir), 0.);
  vec4 mv = viewMatrix * vec4(at, 1.);
  mv.xy += position.xy * size;
  gl_Position = projectionMatrix * mv;
  vUv = position.xy; vFade = fade; vKind = aKind;
}`;

const FRAG = /* glsl */`
#include <common>
${COMMON}
uniform vec3 uFoam;
varying vec2 vUv;
varying float vFade, vKind, vSunward;
void main() {
  float r = length(vUv);
  if (vFade <= .002 || r > 1.) discard;
  float a = vKind > .5 && vKind < 1.5 ? smoothstep(1., 0., r) * smoothstep(1., .2, r) : smoothstep(1., .55, r);
  vec3 lit = uFoam * (uSkyCol * .9 + uSunCol * .6) * (RECIPROCAL_PI * GAIN) * 2.;
  // 逆光：迎着落日看过去，水被打透，亮得发金
  float s2 = vSunward * vSunward, back = s2 * s2 * s2;
  lit += uSunCol * (RECIPROCAL_PI * GAIN) * back * (vKind < .5 ? 3.5 : 1.2);
  gl_FragColor = vec4(lit, a * vFade);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function buildSpray(heightAt) {
  const spots = findSplashes(heightAt), per = DROPS + MIST, count = spots.length * per + MOTES;
  const from = new Float32Array(count * 4), seed = new Float32Array(count * 4), kind = new Float32Array(count);
  spots.forEach((s, i) => {
    for (let j = 0; j < per; j++) {
      const k = i * per + j, n = k * 1.37 + 3;
      from.set([s.x + s.nx * .25 + (rnd(n) - .5) * .8, Math.max(heightAt(s.x, s.z), 0) + .1, s.z + s.nz * .25 + (rnd(n + .5) - .5) * .8, rnd(n + 1) * 100], k * 4);
      seed.set([s.nx, s.nz, rnd(n + 2), rnd(n + 3)], k * 4);
      kind[k] = j < DROPS ? 0 : 1;
    }
  });
  for (let j = 0; j < MOTES; j++) {
    const k = spots.length * per + j, n = j * 2.71 + 900;
    from.set([rnd(n) * 40 - 20, .6 + rnd(n + 1) * 9, rnd(n + 2) * 40 - 24, rnd(n + 3) * 100], k * 4);
    seed.set([0, 0, rnd(n + 4), rnd(n + 5)], k * 4);
    kind[k] = 2;
  }
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  geo.setAttribute('aFrom', new THREE.InstancedBufferAttribute(from, 4));
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 4));
  geo.setAttribute('aKind', new THREE.InstancedBufferAttribute(kind, 1));
  geo.instanceCount = count;
  const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: U, transparent: true, depthWrite: false }));
  mesh.frustumCulled = false; mesh.renderOrder = 10;
  return { mesh, spots };
}
