// 山脊上的风：看得见的那一部分。
//   落叶流——成群的叶子顺着风横着掠过去：近处的少而大、快，翻着面；远处的多而小，连成一缕缕。不是往下飘，是被风裹着走，一阵猛的时候一起加速、往上卷。
//            春天是花瓣，夏天是零星撕碎的绿叶，秋天红橙黄褐的叶，冬天是被风卷起的雪粉（细细一道道）。
//   草屑和尘——细小的、顺风拉长的一道道，贴着坡面那一层多。
//   薄云——从谷里漫上来、贴着山坡往下风走的一层层薄雾，丝缕在动；镜头跟前的淡掉，不糊住画面。
// 另有几股定在山脊上的叶流：从上风的坡上卷起来，顺着风越过石阶，一路散开（镜头在哪儿都一样，是地上的风景的一部分）。
// 风里的东西只在镜头看着两个机位那段路（山脊石阶、红叶石阶）时才有，看向别处就淡到没有；多少跟季节和天气走。
// 落叶流和草屑住在镜头周围的盒子里（和 weather.js 一个办法：位置只由随机数、时间、镜头位置算出）。
// 镜头正前方、离得近的那几片淡掉，不挡住画面中间的小蟹。
import * as THREE from 'three';
import { rnd } from '../anim.js';
import { COMMON, U, paint } from './paint.js';
import { smooth } from './noise.js';
import { SEASONS } from './seasons.js';
import { pal, num, RIDGE_WIND } from './ridgeshade.js';

// 每一层：count 多少；box 盒子大小；speed 顺风的速度（最小、浮动）；size 大小（最小、最大、顺着走向拉长几倍）；look 0 叶 1 草屑尘；alpha；low 贴地的那一层（盒子压扁、贴着镜头下方）
const STREAMS = 10, PER_STREAM = 160, STREAM_LEN = 64;                 // 每个机位几股叶流、每股多少片、一股多长
// swarm：分成几群（0 不分群，各飞各的），每群在多大的一团里（顺风方向再拉长）
const LAYERS = [
  { count: 170, box: [26, 14, 26], speed: [9, 6], size: [.06, .1, 1], look: 0, alpha: 1, swarm: 0, spread: 0 },
  { count: 1100, box: [70, 36, 70], speed: [8, 6], size: [.09, .15, 1], look: 0, alpha: 1, swarm: 14, spread: 4 },
  { count: 2200, box: [300, 120, 300], speed: [10, 7], size: [.18, .3, 1], look: 0, alpha: .85, swarm: 30, spread: 12 },
  { count: 650, box: [50, 16, 50], speed: [9, 8], size: [.018, .034, 6], look: 1, alpha: .75, low: true, swarm: 0, spread: 0 },
];

const VERT = /* glsl */`
#include <common>
${COMMON}
${RIDGE_WIND}
attribute vec4 aSeed, aStart;
uniform vec3 uBox, uSize; uniform vec2 uSpeed; uniform float uLook, uActive, uLow, uSwarm, uSpread, uStream;
const float STREAM_LEN = ${STREAM_LEN.toFixed(1)};
varying vec2 vUv; varying vec3 vWp; varying float vFace, vSun, vFade, vSeed;
void main() {
  if (uActive <= 0.) { gl_Position = vec4(2., 2., 2., 1.); return; }
  float t = uTime, speed = uSpeed.x + uSpeed.y * aSeed.w;
  vec2 wd = ridgeWindDir();
  // 风一阵一阵：blown 是风速对时间的积分（大家一起快、一起慢），gust 是这一刻的风速
  float blown = t + .5 * sin(t * .53 + 1.) / .53 + .3 * sin(t * 1.27 + aSeed.x) / 1.27, gust = 1. + .5 * cos(t * .53 + 1.) + .3 * cos(t * 1.27 + aSeed.x);
  vec3 side = vec3(-wd.y, 0., wd.x), base = aSeed.xyz * uBox;
  // 分群：同一群的叶子挤在一团里一起走（一团顺风拉长），群的快慢一样
  if (uSwarm > 0.) {
    float g = floor(aSeed.x * uSwarm);
    vec3 h = fract(sin(vec3(g * 12.9898, g * 78.233, g * 37.719)) * 43758.5453), l = fract(aSeed.yzw * 7.31 + .17) - .5;
    base = h * uBox + (l.x * vec3(wd.x, 0., wd.y) * 2.8 + l.y * vec3(0., .8, 0.) + l.z * side) * uSpread;
    speed = uSpeed.x + uSpeed.y * h.y + .8 * (aSeed.w - .5);
  }
  vec3 q = base + vec3(wd.x, 0., wd.y) * speed * blown * uWind.z;
  // 被风裹着打旋：绕着顺风的方向转圈，一阵猛的时候往上卷
  float swirl = t * (1.3 + aSeed.w) + aSeed.z * 30.;
  q += side * sin(swirl) * (1.2 + 1.6 * aSeed.y) + vec3(0., 1., 0.) * (cos(swirl * .8) * 1.1 + .9 * sin(t * .53 + 1. + aSeed.y * 2.));
  vec3 c = cameraPosition + mod(q - cameraPosition + uBox * .5, uBox) - uBox * .5;
  if (uLow > .5) c.y = cameraPosition.y - 2.5 + (aSeed.y - .5) * uBox.y + .6 * sin(swirl);
  // 定在山脊上的一股股叶流：从上风的坡上被卷起来，顺着风越过石阶，一路散开、拱起、落下；每片沿着这股流走完一程再从头来
  float stream = 1.;
  if (uStream > .5) {
    float u = fract(aSeed.x + blown * speed * uWind.z / STREAM_LEN), spread = .3 + 2.4 * u;
    c = aStart.xyz + vec3(wd.x, 0., wd.y) * STREAM_LEN * u + side * sin(u * 4.4 + aStart.w * 6.283) * 5. * u
      + vec3(0., 1., 0.) * sin(u * 3.1416) * (3. + 4. * aStart.w)
      + (side * (aSeed.y - .5) * 2.2 + vec3(0., .8, 0.) * (aSeed.z - .5) + vec3(wd.x, 0., wd.y) * (aSeed.w - .5) * 3.) * spread
      + side * sin(swirl) * .5 + vec3(0., .4, 0.) * cos(swirl * .8);
    stream = smoothstep(0., .1, u) * smoothstep(1., .82, u);
  }
  vec3 toCam = normalize(cameraPosition - c), e1, e2;
  float size = mix(uSize.x, uSize.y, aSeed.y);
  if (uLook < .5) {
    // 叶：翻着面打转
    float a = t * (3. + 3. * aSeed.w) * gust + aSeed.x * 40., b = t * 2.1 + aSeed.z * 40.;
    e1 = normalize(vec3(cos(a), sin(a) * cos(b), sin(a) * sin(b))); e2 = normalize(cross(e1, vec3(sin(b), .3, cos(b))));
    vec3 n = cross(e1, e2);
    float toSun = dot(n, uSunDir) * sign(dot(n, toCam));
    vFace = toSun > 0. ? .45 + .55 * toSun : .3 + .6 * -toSun * max(dot(-toCam, uSunDir), 0.);
  } else {
    vec3 vel = normalize(vec3(wd.x, .08 * cos(swirl), wd.y));
    e1 = vel * uSize.z; e2 = normalize(cross(vel, toCam)); vFace = .45 + 1.6 * pow(max(dot(-toCam, uSunDir), 0.), 3.);
  }
  vec3 wp = c + (e1 * position.x + e2 * position.y) * size;
  float dist = distance(c, cameraPosition);
  vFade = (uStream > .5 ? smoothstep(1.5, 4., dist) * smoothstep(260., 160., dist) : smoothstep(uBox.x * .03 + 1.2, uBox.x * .08 + 2.5, dist) * smoothstep(uBox.x * .5, uBox.x * .32, dist)) * uActive * stream;
  vec4 clip = projectionMatrix * viewMatrix * vec4(wp, 1.);
  vec2 ndc = clip.xy / max(clip.w, .01);
  vFade *= mix(1., smoothstep(.16, .42, length((ndc - vec2(0., -.1)) * vec2(1.4, 1.))), smoothstep(16., 6., dist));   // 镜头正前方、近的让开画面中间
  vSun = sunSeen(c);
  vUv = position.xy; vWp = wp; vSeed = aSeed.w;
  gl_Position = clip;
}`;
const FRAG = /* glsl */`
#include <common>
${COMMON}
uniform float uLook, uAlpha;
varying vec2 vUv; varying vec3 vWp; varying float vFace, vSun, vFade, vSeed;
void main() {
  vec2 p = vUv; float shape, tone = fract(vSeed * 13.), tone2 = fract(vSeed * 31.7);
  vec3 albedo;
  if (uLook < .5) {
    // 叶：秋天是掌状的枫叶（五裂、带齿、一根短柄）和卵形叶（中间一道主脉、边上细齿）混着；春天花瓣；夏天绿叶；冬天雪粉（虚的一小团）
    // 枫叶：五个尖裂片朝上方扇形张开（中间的最长、最下面两片最短），叶基平，边上细齿，一根短柄
    vec2 q = p - vec2(0., -.38);
    float ang = atan(q.x, q.y), r = length(q);
    float lobe = max(max(.66 * pow(max(cos(ang * 2.8), 0.), 3.), .56 * pow(max(cos((abs(ang) - .98) * 2.8), 0.), 3.)), .38 * pow(max(cos((abs(ang) - 1.9) * 2.8), 0.), 3.));
    float edge = .2 + lobe + .025 * sin(ang * 31.) * smoothstep(.0, .2, lobe);
    float maple = smoothstep(edge, edge - .06, r) * step(abs(ang), 2.45) + smoothstep(.045, .02, abs(p.x)) * step(p.y, -.38) * step(-.95, p.y);
    float y01 = p.y * .5 + .5, halfW = .5 * sin(3.1416 * clamp(y01, 0., 1.)) * (1. - .2 * y01) + .025 * sin(y01 * 44.);
    float ovate = smoothstep(halfW, halfW - .07, abs(p.x));
    float veins = mix(smoothstep(.05, .0, min(abs(ang), min(abs(abs(ang) - .98), abs(abs(ang) - 1.9))) * r) * step(r, edge), smoothstep(.035, .0, abs(p.x)), step(tone2, .5));
    float leaf = mix(maple, ovate, step(tone2, .5) + uPick.y);
    float petal = smoothstep(1., .82, length(p * vec2(1.25 + .5 * p.y, 1.))) * (1. - smoothstep(.2, 0., abs(p.x)) * smoothstep(.6, .95, p.y));
    float flake = exp(-dot(p, p) * 3.) * smoothstep(1., .6, dot(p, p));
    shape = leaf * (uPick.z + uPick.y) + petal * uPick.x + flake * uPick.w;
    vec3 a = tone < .3 ? ${pal('#F2A8BE', '#4E8A3E', '#B4261A', '#E8EEFF')} : tone < .58 ? ${pal('#FBD8E0', '#6E9E48', '#D8641E', '#F4F6FF')} : tone < .82 ? ${pal('#FFFFFF', '#88B05A', '#E8AE3A', '#FFFFFF')} : ${pal('#F6C4D0', '#5E8E44', '#8A4424', '#EEF2FF')};
    albedo = mix(a, a * .62, step(.86, tone2) * uPick.z) * (1. - .25 * veins * (uPick.z + uPick.y)) * mix(1., .78, smoothstep(.3, 1., r) * uPick.z);
    shape *= step(fract(vSeed * 91.), ${num(.3, 0, 1, .6)} * uWeather.x);                 // 多少跟季节走：秋天满天，冬天是雪粒，春天零星花瓣，夏天下雨不刮叶；天气停了跟着停
  } else {
    // 被风卷起的草絮（芒草的种毛）：一点亮的头，后面拖一道虚的尾；逆着光亮得发白
    float head = exp(-dot((p - vec2(.7, 0.)) * vec2(3., 1.), (p - vec2(.7, 0.)) * vec2(3., 1.)) * 2.);
    shape = max(head, smoothstep(1., .1, abs(p.y)) * smoothstep(1., -.6, -p.x) * smoothstep(-1., .7, p.x) * .45);
    albedo = ${pal('#F4EEDC', '#D8E0C4', '#FFE6B8', '#F4F8FF')} * 1.3;
    shape *= step(fract(vSeed * 91.), ${num(.25, 0, 1, .8)} * uWeather.x);                  // 冬天是被风卷起的雪粉，夏天没有
  }
  float alpha = shape * vFade * uAlpha;
  if (alpha < .01) discard;
  vec3 c = albedo * (uSkyCol * .8 + uGndCol * .3 + uSunCol * (.2 + .9 * vFace * vSun)) * RECIPROCAL_PI;
  gl_FragColor = vec4(wildFog(c, vWp), alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// 薄云：贴着坡面的薄网，丝缕顺风流动；镜头近的地方、网的边上淡掉
let mistMat = null;
function mistMaterial() {
  if (mistMat) return mistMat;
  mistMat = paint({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexPars: `attribute float aFade; varying float vFade; ${RIDGE_WIND}`,
    vertex: 'vFade = aFade;',
    fragmentPars: `varying float vFade; ${RIDGE_WIND}`,
    fragment: /* glsl */`
      vec2 wd = ridgeWindDir(), xz = vWp.xz - wd * uTime * 3.2;
      float a = fbm(xz * .045 + vec2(vWp.y * .02, 0.)), b = fbm(vec2(dot(xz, wd) * .03, dot(xz, vec2(-wd.y, wd.x)) * .11) + uTime * .02);
      float wisp = smoothstep(.4, .7, a * .55 + b * .45);
      float near = smoothstep(14., 40., distance(vWp, cameraPosition));
      N = vec3(0., 1., 0.);
      albedo = mix(uMistCol, vec3(1.), .35) * 1.1; thin = 1.; ao = 1.;
      alpha = wisp * vFade * near * ${num(.7, .65, .75, .55)};
      sun *= sunSeen(vWp);`,
  });
  return mistMat;
}

export function buildRidgeWind(P) {
  const { road, spans, weight, surfaceAt, focus } = P, group = new THREE.Group();
  // 镜头离山脊这一带多近：路上每隔几个单位取一点
  const marks = [], p = new THREE.Vector3();
  for (const [a, b] of spans) for (let s = Math.max(0, a); s < Math.min(road.length, b); s += 6) if (weight(s) > 0) marks.push(Object.assign(road.at0(s, p).clone(), { s }));
  // 风里的叶只在两个机位看的那段路上有：镜头前方十来个单位那一点离这段路多近
  const hot = [];
  for (const f of focus) for (let s = f.s - 50; s <= f.s + 40; s += 3) hot.push(road.at0(s, new THREE.Vector3()));
  const ahead = new THREE.Vector3();
  const uActive = { value: 0 };
  const near = camera => {
    camera.getWorldDirection(ahead).multiplyScalar(10).add(camera.position);
    let d = Infinity;
    for (const m of hot) d = Math.min(d, ahead.distanceToSquared(m));
    return smooth(32, 14, Math.sqrt(d));
  };

  // 叶流的起点。风横着吹过画面的机位：几股从上风的坡上起，越过它看的那段路，流到路上空时离路面一两个单位；
  // 风正对着镜头吹的机位（山脊那个：风从小蟹背后来）：几股从小蟹身后远处来，擦着镜头两边飞过去——远处的聚成一线，近了散开从画面四边掠出去
  const wind = SEASONS.秋.u.uWind, wd = new THREE.Vector2(wind[0], wind[1]).normalize(), side = new THREE.Vector2(-wd.y, wd.x), starts = [];
  for (const f of focus) {
    const eye = f.shot.p.map((v, i) => v + (f.shot.q[i] - v) * .5), look = new THREE.Vector2(f.shot.q[0] - f.shot.p[0], f.shot.q[2] - f.shot.p[2]).normalize(), toward = -look.dot(wd) > .7;
    for (let i = 0; i < STREAMS; i++) {
      const R = k => rnd(i * 3.7 + k * 1.3 + f.s * .01);
      let x, y, z;
      if (toward) {
        // 小蟹往下山蹦，镜头跟着往下挪：各股沿着下山的方向错开一点，整个镜头里都有
        const off = (i % 2 ? 1 : -1) * (3.5 + 1.6 * Math.floor(i / 2) + 1.5 * R(1)), along = road.dir(f.s / road.length).multiplyScalar(12 * i / STREAMS);
        x = eye[0] + along.x + side.x * off - wd.x * STREAM_LEN * .8; z = eye[2] + along.z + side.y * off - wd.y * STREAM_LEN * .8; y = eye[1] + along.y - 3.5 + 5 * R(2);
      } else {
        road.at0(f.s + (i - (STREAMS - 1) / 2) * 6.5 + 3 * (R(1) - .5), p);
        x = p.x - wd.x * STREAM_LEN * .35; z = p.z - wd.y * STREAM_LEN * .35; y = Math.max(road.surface(f.s) + .8 + 1.2 * (i % 3), surfaceAt(x, z) + 1.2);
      }
      starts.push([x, y, z, R(3)]);
    }
  }

  [...LAYERS, { count: starts.length * PER_STREAM, box: [60, 60, 60], speed: [7, 5], size: [.08, .14, 1], look: 0, alpha: 1, swarm: 0, spread: 0, stream: true }].forEach((L, li) => {
    const geo = new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry(2, 2)), seeds = new Float32Array(L.count * 4), from = new Float32Array(L.count * 4);
    for (let i = 0; i < seeds.length; i++) seeds[i] = rnd(i * 1.618 + li * 517.3 + 3.3);
    if (L.stream) for (let i = 0; i < L.count; i++) from.set(starts[Math.floor(i / PER_STREAM)], i * 4);
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4)); geo.setAttribute('aStart', new THREE.InstancedBufferAttribute(from, 4)); geo.instanceCount = L.count;
    const uniforms = { ...U, uBox: { value: new THREE.Vector3(...L.box) }, uSpeed: { value: new THREE.Vector2(...L.speed) }, uSize: { value: new THREE.Vector3(...L.size) }, uLook: { value: L.look }, uAlpha: { value: L.alpha }, uLow: { value: L.low ? 1 : 0 }, uSwarm: { value: L.swarm }, uSpread: { value: L.spread }, uStream: { value: L.stream ? 1 : 0 }, uActive };
    const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    mesh.frustumCulled = false; mesh.renderOrder = 24 + li; mesh.name = '山脊 风里的叶';
    if (li === 0) mesh.onBeforeRender = (_r, _s, camera) => { uActive.value = near(camera); };
    group.add(mesh);
  });

  // 薄云：两侧坡上离路 12 到 70 个单位、比路低 6 到 40 的那一带，贴着坡面往上抬几个单位
  const CELL = 2.5, pos = [], fade = [], box = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity };
  for (const m of marks) { box.x0 = Math.min(box.x0, m.x - 80); box.x1 = Math.max(box.x1, m.x + 80); box.z0 = Math.min(box.z0, m.z - 80); box.z1 = Math.max(box.z1, m.z + 80); }
  const nearest = (x, z) => { let best = null, bd = Infinity; for (const m of marks) { const d = (m.x - x) ** 2 + (m.z - z) ** 2; if (d < bd) { bd = d; best = m; } } return { s: best.s, d: Math.sqrt(bd), y: best.y }; };
  const corner = (x, z) => {
    const on = nearest(x, z), g = surfaceAt(x, z), below = on.y - g;
    if (weight(on.s) <= 0) return null;
    const lift = 2.5 + 4 * smooth(10, 40, below);
    return [x, g + lift, z, weight(on.s) * smooth(12, 22, on.d) * smooth(80, 60, on.d) * smooth(5, 14, below) * smooth(60, 40, below)];
  };
  for (let z = box.z0; z < box.z1; z += CELL) for (let x = box.x0; x < box.x1; x += CELL) {
    const q = [corner(x, z), corner(x + CELL, z), corner(x, z + CELL), corner(x + CELL, z + CELL)];
    if (q.some(v => !v) || q.every(v => v[3] <= 0)) continue;
    for (const t of [0, 2, 1, 1, 2, 3]) { pos.push(q[t][0], q[t][1], q[t][2]); fade.push(q[t][3]); }
  }
  if (pos.length) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aFade', new THREE.Float32BufferAttribute(fade, 1));
    g.computeVertexNormals(); g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, mistMaterial());
    mesh.renderOrder = 22; mesh.name = '山脊 贴坡的薄云';
    group.add(mesh);
  }
  return { group };
}
