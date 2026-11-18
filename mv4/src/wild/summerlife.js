// 夏天桥上的小动静：雨点在石板上溅起的水花、栏杆和桥沿往下滴的水、雨停后飞出来的蜻蜓。只在夏天画（别的季节在着色器里整个收掉）。
//   水花——雨点落在桥面上溅起一小簇，三五道细丝朝上散开，一眨眼就没了；雨小了水花也跟着稀。
//   滴水——水珠在寻杖底下、望柱的莲瓣尖上、桥沿的仰天石下面慢慢鼓起来，鼓到挂不住就掉下去，越落越快、越拉越长。
//         雨停之后还在滴，只是慢了。
//   蜻蜓——放晴到一多半才出来：停在半空轻轻晃，忽然横着窜出去一截又停住；翅膀扇得快，是半透的一片虚影，迎着日头闪一下。
// 位置只由（各自的随机数、时间、天气放晴到几成）算出，同一时刻永远是同一帧。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rnd } from '../anim.js';
import { COMMON, U } from './paint.js';
import { HALF, CURB } from './road.js';

const SPLASHES = 520, DRIPS = 260, FLIES = 8;

const SPLASH_VERT = /* glsl */`
#include <common>
${COMMON}
attribute vec4 aSeed; attribute vec3 aAt;
varying vec2 vUv; varying vec3 vWp; varying float vAge, vSeed;
void main() {
  float beat = .45 + .9 * aSeed.w, k = fract(uTime / beat + aSeed.x), age = k * beat / .16;
  if (uPick.y < .5 || age > 1. || aSeed.y > uWeather.x) { gl_Position = vec4(2., 2., 2., 1.); return; }   // 每一处隔一阵溅一下；雨小了，只有一部分地方还在溅
  vec3 toCam = normalize(cameraPosition - aAt), right = normalize(cross(vec3(0., 1., 0.), toCam));
  float size = (.05 + .06 * aSeed.z) * (.5 + .8 * age);
  vec3 wp = aAt + right * position.x * size * 1.3 + vec3(0., (position.y + 1.) * size, 0.);
  vUv = position.xy; vWp = wp; vAge = age; vSeed = aSeed.z;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.);
}`;
const SPLASH_FRAG = /* glsl */`
#include <common>
${COMMON}
varying vec2 vUv; varying vec3 vWp; varying float vAge, vSeed;
void main() {
  vec2 p = vec2(vUv.x, vUv.y + 1.);                                                  // 落点在片子的底边正中
  float r = length(p) / 2., ang = atan(p.x, p.y), fan = ang * 2.4 + vSeed * 9.;
  float spoke = smoothstep(.34, .08, abs(fract(fan) - .5)) * step(abs(ang), 1.25);    // 几道朝上散开的细丝
  float reach = smoothstep(vAge * .9 + .12, vAge * .9, r) * smoothstep(vAge * .35 - .05, vAge * .35 + .1, r);
  float base = smoothstep(.2, .0, length(p * vec2(1., 3.))) * (1. - vAge);            // 落点上一小团白
  float alpha = max(spoke * reach, base) * (1. - vAge) * .75;
  if (alpha < .02) discard;
  vec3 c = (uSkyCol * 1.1 + uSunCol * .3) * (RECIPROCAL_PI * GAIN) * 1.3;
  gl_FragColor = vec4(wildFog(c, vWp), alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const DRIP_VERT = /* glsl */`
#include <common>
${COMMON}
attribute vec4 aSeed; attribute vec4 aAt;         // 位置，和最多能落多远
varying vec2 vUv; varying vec3 vWp; varying float vFade;
void main() {
  if (uPick.y < .5) { gl_Position = vec4(2., 2., 2., 1.); return; }
  float beat = (1.1 + 2.6 * aSeed.w) * (1. + 1.3 * uWeather.y), k = fract(uTime / beat + aSeed.x), hang = .55;   // 雨停之后滴得慢
  float swell = smoothstep(0., hang, k), tau = max(k - hang, 0.) * beat, fell = 5.5 * tau * tau, speed = 11. * tau;
  vec3 c = aAt.xyz - vec3(0., .03 * swell + fell, 0.);
  vec3 toCam = normalize(cameraPosition - c), right = normalize(cross(vec3(0., 1., 0.), toCam));
  float size = .034 * (.4 + .6 * swell) * (.8 + .5 * aSeed.z);
  vec3 wp = c + right * position.x * size + vec3(0., position.y * size * (1.25 + .5 * speed), 0.);
  vFade = (1. - smoothstep(aAt.w * .8, aAt.w, fell)) * smoothstep(0., .12, k);
  vUv = position.xy; vWp = wp;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.);
}`;
const DRIP_FRAG = /* glsl */`
#include <common>
${COMMON}
varying vec2 vUv; varying vec3 vWp; varying float vFade;
void main() {
  float r = length(vUv * vec2(1., .9) + vec2(0., .1 * (1. - vUv.y)));
  float bead = smoothstep(1., .75, r), rim = smoothstep(.35, .95, r), spark = smoothstep(.3, .0, length(vUv - vec2(-.3, .35)));   // 水珠：边上亮，当中透，左上一点高光
  float alpha = bead * (.25 + .55 * rim + .6 * spark) * vFade;
  if (alpha < .02) discard;
  vec3 c = (uSkyCol * 1.2 + uSunCol * (.25 + .9 * spark)) * (RECIPROCAL_PI * GAIN) * 1.3;
  gl_FragColor = vec4(wildFog(c, vWp), alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const FLY_VERT = /* glsl */`
#include <common>
${COMMON}
attribute vec4 aSeed; attribute vec3 aAt; attribute float aPart;      // aPart：0 身子，±1 左右的前翅，±2 左右的后翅
varying vec3 vWp, vN; varying float vPart, vSeed;
// 这只蜻蜓此刻在哪：停在半空轻轻晃，隔一阵横着窜出去一截
vec3 flight(float t) {
  float ph = aSeed.x * 40., dart = t * (.32 + .2 * aSeed.w) + aSeed.y * 9., i = floor(dart), f = smoothstep(.0, .16, fract(dart));
  vec4 a = texture2D(uNoise, (vec2(i, aSeed.z * 200.) + .5) / 256.), b = texture2D(uNoise, (vec2(i + 1., aSeed.z * 200.) + .5) / 256.);
  vec3 hop = mix(a.rgb, b.rgb, f) - .5;
  return aAt + hop * vec3(2.6, 1., 2.6) + vec3(sin(t * 1.3 + ph), .5 * sin(t * 2.1 + ph * 1.7), cos(t * 1.1 + ph * 2.3)) * .22;
}
void main() {
  float out_ = smoothstep(.55, .95, uWeather.y);
  if (uPick.y < .5 || out_ <= 0.) { gl_Position = vec4(2., 2., 2., 1.); return; }
  vec3 at = flight(uTime), ahead = flight(uTime + .25) - flight(uTime - .25);
  float yaw = atan(ahead.x, ahead.z + 1e-4), cy = cos(yaw), sy = sin(yaw);
  vec3 p = position, n = normal;
  if (abs(aPart) > .5) {                                                               // 翅：绕着身子的轴上下扇，后翅比前翅慢半拍
    float beat = .55 * sin(uTime * 47. + aSeed.x * 60. + step(1.5, abs(aPart)) * 1.3) + .12, c = cos(beat), s = sin(beat);
    n = normalize(vec3(-sign(p.x) * s, c, 0.)); p.y += abs(p.x) * s; p.x *= c;
  }
  p *= out_ * (1.3 + .5 * aSeed.w);
  vec3 wp = at + vec3(p.x * cy + p.z * sy, p.y, -p.x * sy + p.z * cy) + vec3(0., (1. - out_) * 5., 0.);
  vWp = wp; vN = vec3(n.x * cy + n.z * sy, n.y, -n.x * sy + n.z * cy); vPart = aPart; vSeed = aSeed.z;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.);
}`;
const FLY_FRAG = /* glsl */`
#include <common>
${COMMON}
varying vec3 vWp, vN; varying float vPart, vSeed;
void main() {
  vec3 N = normalize(vN) * (gl_FrontFacing ? 1. : -1.), rd = normalize(vWp - cameraPosition);
  bool wing = abs(vPart) > .5;
  vec3 body = vSeed < .5 ? vec3(.78, .16, .1) : vec3(.1, .46, .5);                    // 红蜻蜓和碧蜻蜓
  vec3 albedo = wing ? vec3(.8, .9, .93) : body;
  float glint = pow(max(dot(reflect(rd, N), uSunDir), 0.), 18.);
  vec3 c = albedo * (mix(uGndCol, uSkyCol, .5 + .5 * N.y) + uSunCol * (.3 + .7 * max(dot(N, uSunDir), 0.))) * (RECIPROCAL_PI * GAIN) + uSunCol * glint * (wing ? .35 : .12);
  gl_FragColor = vec4(wildFog(c, vWp), wing ? .55 + .4 * glint : 1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// 一只蜻蜓：细长的身子（头、胸、一节节收细的腹）和前后两对翅，头朝 +z
function flyGeometry() {
  const tag = (g, part) => g.setAttribute('aPart', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count).fill(part), 1));
  const wing = (side, z, span, chord, pair) => {
    const g = new THREE.BufferGeometry(), x = side * span;
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, z, x, 0, z + chord * .5, x, 0, z - chord * .6, 0, 0, z, x, 0, z - chord * .6, x * .25, 0, z - chord], 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(Array.from({ length: 6 }, () => [0, 1, 0]).flat(), 3));
    return tag(g, side * pair);
  };
  const part = g => tag(g.toNonIndexed().deleteAttribute('uv'), 0);
  return mergeGeometries([
    part(new THREE.SphereGeometry(.034, 8, 6).translate(0, 0, .1)), part(new THREE.SphereGeometry(.03, 8, 6).scale(1, 1, 1.8).translate(0, 0, .04)),
    part(new THREE.CylinderGeometry(.008, .017, .34, 6).rotateX(Math.PI / 2).translate(0, 0, -.17)),
    wing(1, .06, .27, .07, 1), wing(-1, .06, .27, .07, 1), wing(1, .0, .25, .08, 2), wing(-1, .0, .25, .08, 2),
  ]);
}

function instances(base, count, salt, at, width) {
  const geo = new THREE.InstancedBufferGeometry().copy(base), seeds = new Float32Array(count * 4), spots = new Float32Array(count * width);
  for (let i = 0; i < count; i++) { for (let j = 0; j < 4; j++) seeds[i * 4 + j] = rnd(i * 3.713 + j * 1.618 + salt); spots.set(at(i), i * width); }
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4)); geo.setAttribute('aAt', new THREE.InstancedBufferAttribute(spots, width)); geo.instanceCount = count;
  return geo;
}

export function buildSummerLife(road) {
  const group = new THREE.Group(), { s0, s1 } = road.bridge, tmp = new THREE.Vector3(), side = new THREE.Vector3(), quad = new THREE.PlaneGeometry(2, 2);
  // 桥上的一点：弧长 s、离中线 d、离桥面多高
  const spot = (s, d, up) => { road.at0(s, tmp); road.right(s, side); return [tmp.x + side.x * d, road.surface(s) + up, tmp.z + side.z * d]; };
  const material = (vertexShader, fragmentShader) => new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms: U, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const splashes = new THREE.Mesh(instances(quad, SPLASHES, 7.7, i => spot(s0 - 12 + rnd(i * 2.3) * (s1 - s0 + 24), (rnd(i * 5.9) * 2 - 1) * HALF, .02), 3), material(SPLASH_VERT, SPLASH_FRAG));
  // 滴水的地方：寻杖底下（落到栏板顶上）、望柱的莲瓣尖（落到地栿）、桥沿的仰天石下面（落进溪谷）
  const RAIL = HALF + .25, EDGE = HALF + CURB + .7, PLACES = [[RAIL, 1.06, .24], [RAIL + .27, 1.72, 1.6], [EDGE, -.5, 9]];
  const drips = new THREE.Mesh(instances(quad, DRIPS, 13.9, i => {
    const [d, up, fall] = PLACES[i % 3], s = s0 - 3 + rnd(i * 4.1) * (s1 - s0 + 6), flank = i % 2 ? 1 : -1;
    return [...spot(s, flank * d, .2 + up), fall * (.7 + .3 * rnd(i * 8.3))];
  }, 4), material(DRIP_VERT, DRIP_FRAG));
  // 蜻蜓：三只在桥中间小蟹停下来的那一带，其余在桥两侧的溪谷上空
  const mid = (s0 + s1) / 2 - 3;
  const flies = new THREE.Mesh(instances(flyGeometry(), FLIES, 21.3, i => i < 3 ? spot(mid + (i - 1) * 3.6, (i % 2 ? -1 : 1) * 2.7, 2.1 + .45 * i) : spot(mid + (rnd(i * 6.7) - .5) * 30, (i % 2 ? -1 : 1) * (7 + 6 * rnd(i * 9.1)), 1 + 3 * rnd(i * 2.9)), 3), material(FLY_VERT, FLY_FRAG));
  [splashes, drips, flies].forEach((m, i) => { m.frustumCulled = false; m.renderOrder = 15 + i * .1; group.add(m); });
  return group;
}
