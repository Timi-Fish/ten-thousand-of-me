// 夏天溪谷里的空气：雨雾、放晴时的光束、桥面和坡上升起来的水汽。只在夏天画（别的季节在着色器里整个收掉）。
//   雨雾——一带带横着的、很虚的雾挂在溪谷里和两岸的树之间，顺着风慢慢飘；树一层、雾一层，远近就拉开了。
//         雨里是清冷的白；放晴后变薄、被斜阳照成暖色，一边飘一边往上升，就是「地上的水汽升起来」。
//   光束——云开之后，斜阳从树冠和云的缝里一束束打进溪谷。每一束是顺着日光方向的一条长片，里面有粗细不匀的光丝，各自慢慢地明暗。
//   水汽——桥面和岸边被晒到的湿石头上冒起来的一缕缕白气，升到一人多高散掉。
// （虹不在这里：它是空气本身的颜色，画在 air.js 的雾里。）
// 这些东西的位置只由（各自的随机数、时间、天气放晴到几成）算出，同一时刻永远是同一帧。
import * as THREE from 'three';
import { rnd } from '../anim.js';
import { COMMON, U } from './paint.js';
import { HALF } from './road.js';

const MIST = 110, BEAMS = 20, VAPOR = 70;                            // 雨雾几团、光束几道、水汽几缕

const HEAD = /* glsl */`
#include <common>
${COMMON}
attribute vec4 aSeed; attribute vec3 aAt;
uniform float uKind;
varying vec2 vUv; varying vec3 vWp; varying float vFade, vSeed;`;

// 雾和水汽：朝着镜头的片
const PUFF_VERT = /* glsl */`${HEAD}
void main() {
  if (uPick.y < .5) { gl_Position = vec4(2., 2., 2., 1.); return; }
  vec3 wind = normalize(vec3(uWind.x, 0., uWind.y)), c; float size, cleared = uWeather.y; vec2 shape;
  if (uKind < .5) {
    // 雨雾：横着的一带，顺风飘一程（两头淡入淡出），放晴后一边飘一边升
    float life = fract(uTime * (.011 + .008 * aSeed.w) + aSeed.x);
    c = aAt + wind * (life - .5) * (50. + 40. * aSeed.y) + vec3(0., cleared * (3. + 16. * life) * (.4 + .6 * aSeed.z), 0.);
    size = (11. + 17. * aSeed.y) * (.8 + .4 * life); shape = vec2(2.3, .78);
    c.y = max(c.y, groundAt(c.xz) + size * .3);
    vFade = smoothstep(0., .22, life) * smoothstep(1., .7, life) * mix(.115, .075, cleared) * (.55 + .45 * aSeed.z);
  } else {
    // 水汽：从湿石头上冒起来的一缕，升到一人多高散掉；放晴了才有
    float life = fract(uTime * (.1 + .09 * aSeed.w) + aSeed.x);
    c = aAt + vec3(0., .2 + 3.2 * life * (.6 + .5 * aSeed.z), 0.) + wind * 1.4 * life * life + vec3(sin(uTime * .7 + aSeed.y * 30.), 0., cos(uTime * .6 + aSeed.z * 30.)) * .22 * life;
    size = (.55 + .8 * aSeed.y) * (.5 + 1.1 * life); shape = vec2(.75, 1.45);
    vFade = smoothstep(0., .2, life) * smoothstep(1., .3, life) * .15 * smoothstep(.45, 1., cleared);
  }
  vec3 toCam = cameraPosition - c; float dist = length(toCam); toCam /= dist;
  vec3 right = normalize(cross(vec3(0., 1., 0.), toCam)), up = cross(toCam, right);
  vFade *= smoothstep(size * .8, size * 2.6, dist);                                   // 镜头钻进雾里时淡掉，不糊成一片白
  vec3 wp = c + (right * position.x * shape.x + up * position.y * shape.y) * size;
  vUv = position.xy; vWp = wp; vSeed = aSeed.x;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.);
}`;
const PUFF_FRAG = /* glsl */`
#include <common>
${COMMON}
uniform float uKind;
varying vec2 vUv; varying vec3 vWp; varying float vFade, vSeed;
void main() {
  if (vFade < .003) discard;
  float r2 = dot(vUv, vUv);
  float wisp = fbm(vUv * vec2(2.2, 1.3) + vec2(uTime * .02, 0.) + vSeed * 37.) * .7 + fbm(vUv * vec2(5.5, 2.6) - vec2(uTime * .035, uTime * .01) + vSeed * 11.) * .3;
  float body = exp(-r2 * 4.2) * smoothstep(1., .4, sqrt(r2)) * smoothstep(-1., 0., vUv.y + (wisp - .5) * .6);   // 底下是平的、虚的，不在地上切出一道线
  float alpha = body * (.3 + .7 * smoothstep(.15, .85, wisp)) * 1.4 * vFade;
  if (alpha < .003) discard;
  vec3 rd = normalize(vWp - cameraPosition);
  float toward = .5 + .5 * dot(rd, uSunDir), lit = sunSeen(vWp) * mix(.35, 1., hiShade(vWp));
  vec3 c = (uSkyCol * 1.25 + uSunCol * (.6 + .4 * toward * toward) * lit) * (RECIPROCAL_PI * GAIN) * 1.3;
  c = mix(c, c * uMistCol / max(max(uMistCol.r, uMistCol.g), uMistCol.b), .6);
  gl_FragColor = vec4(wildFog(c, vWp), alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// 光束：顺着日光方向的长片，绕着自己的轴转过来朝着镜头
const BEAM_VERT = /* glsl */`${HEAD}
void main() {
  float shine = smoothstep(.3, .9, uWeather.y);
  if (uPick.y < .5 || shine <= 0.) { gl_Position = vec4(2., 2., 2., 1.); return; }
  float len = 60. + 70. * aSeed.y, along = position.y * .5 + .5, wide = (1.1 + 2.6 * aSeed.x * aSeed.x) * (1. + .5 * along);
  vec3 axis = uSunDir, c = aAt + axis * len * along, side = normalize(cross(axis, cameraPosition - c));
  vec3 wp = c + side * position.x * wide;
  // 云在走：每一束各自慢慢地亮起来、暗下去
  float breathe = .6 + .4 * sin(uTime * (.5 + .4 * aSeed.w) + aSeed.z * 40.);
  vFade = shine * breathe * (.5 + .5 * aSeed.z);
  vUv = vec2(position.x, along); vWp = wp; vSeed = aSeed.w;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.);
}`;
const BEAM_FRAG = /* glsl */`
#include <common>
${COMMON}
varying vec2 vUv; varying vec3 vWp; varying float vFade, vSeed;
void main() {
  float x = vUv.x, v = vUv.y;
  float strands = noise1(vec2(x * 2.6 + vSeed * 31., uTime * .05 + vSeed * 7.)) * .6 + noise1(vec2(x * 7.3 + vSeed * 13., uTime * .09)) * .4;   // 一束里粗细不匀的光丝
  float motes = .8 + .4 * noise1(vec2(x * 9. + vSeed * 5., v * 26. + uTime * .5));                                                     // 光里飘着的水汽
  float shape = exp(-x * x * 2.8) * smoothstep(1., .7, abs(x)) * smoothstep(.3, .75, strands + .2) * smoothstep(1., .45, v) * smoothstep(0., .1, v);
  float alpha = shape * motes * vFade * smoothstep(3., 14., distance(vWp, cameraPosition));
  if (alpha < .003) discard;
  gl_FragColor = vec4(uRayCol * alpha * .28, 1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// 一批朝着镜头的片：at(i) 给出第 i 片的位置
function sprites(count, at, salt, vertexShader, fragmentShader, uniforms, blending = THREE.NormalBlending) {
  const geo = new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry(2, 2)), seeds = new Float32Array(count * 4), spots = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) { for (let j = 0; j < 4; j++) seeds[i * 4 + j] = rnd(i * 4.171 + j * 1.618 + salt); at(i).toArray(spots, i * 3); }
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4)); geo.setAttribute('aAt', new THREE.InstancedBufferAttribute(spots, 3)); geo.instanceCount = count;
  const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms: { ...U, ...uniforms }, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending }));
  mesh.frustumCulled = false;
  return mesh;
}

export function buildSummerAir(road, terrain, creek) {
  const { groundAt } = terrain, group = new THREE.Group(), V = (x, y, z) => new THREE.Vector3(x, y, z);
  const { s0, s1 } = road.bridge, tmp = new THREE.Vector3(), side = new THREE.Vector3(), last = creek.pts.findIndex(p => p.z > 492);
  // 溪谷里的一点：顺着溪（从瀑布口到桥下游）取一处，再往两岸偏出去
  const inGorge = (i, salt, spread) => {
    const f = creek.lip + rnd(i * 2.9 + salt) * (last - creek.lip), k = Math.floor(f), a = creek.pts[k], b = creek.pts[k + 1];
    const x = THREE.MathUtils.lerp(a.x, b.x, f - k) + (rnd(i * 5.3 + salt) - .5) * spread, z = THREE.MathUtils.lerp(a.z, b.z, f - k) + (rnd(i * 7.7 + salt) - .5) * spread * .6;
    return V(x, groundAt(x, z), z);
  };
  // 桥面上和两头路面上的一点
  const onDeck = (i, salt) => {
    const s = s0 - 10 + rnd(i * 3.3 + salt) * (s1 - s0 + 20), d = (rnd(i * 6.1 + salt) * 2 - 1) * (HALF - .3);
    road.at0(s, tmp); road.right(s, side);
    return V(tmp.x + side.x * d, road.surface(s), tmp.z + side.z * d);
  };
  const mist = sprites(MIST, i => { const p = inGorge(i, 3.1, i % 3 ? 80 : 170); p.y += 4 + 26 * rnd(i * 9.1) ** 1.5; return p; }, 17.3, PUFF_VERT, PUFF_FRAG, { uKind: { value: 0 } });
  const vapor = sprites(VAPOR, i => i % 3 ? onDeck(i, 5.7) : inGorge(i, 8.3, 36), 41.9, PUFF_VERT, PUFF_FRAG, { uKind: { value: 1 } });
  // 光束落在哪：一半散在整条溪谷里，一半集中在桥上游那一段（从桥上回头看，正在小蟹背后）
  const upstream = creek.pts.findIndex(p => p.z > 400), under = creek.pts.findIndex(p => p.z > 446);
  const beams = sprites(BEAMS, i => {
    if (i % 2) return inGorge(i, 12.7, 64);
    const p = creek.pts[upstream + Math.floor(rnd(i * 3.7) * (under - upstream))], x = p.x + (rnd(i * 5.1) - .5) * 44, z = p.z + (rnd(i * 8.9) - .5) * 16;
    return V(x, groundAt(x, z), z);
  }, 29.1, BEAM_VERT, BEAM_FRAG, {}, THREE.AdditiveBlending);
  [mist, beams, vapor].forEach((m, i) => { m.renderOrder = 14 + i * .1; group.add(m); });
  return group;
}
