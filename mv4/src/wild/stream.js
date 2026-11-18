// 溪、瀑布，和瀑布落水处的水花、水雾、飞沫。
// 溪和瀑布是顺着水道铺的带子。带子上每个点记着「水从源头流到这里要多久」，水纹按这个时间滚动：
//   溪水在石头之间一级一级跌下来——每一级一小道白的跌水，底下一汪深青的潭，潭面漂着沫，再往前水又清了；陡的地方跌水密，缓的地方几乎全是清水。水纹不会越滚越歪（各处流速不同，直接按距离滚会把纹理越扯越斜）。
// 瀑布：水从崖口抛出去越落越快，一股股粗细不等的半透的白在下落中拉长、散开，边是虚的，股与股之间是水汽和细水丝，越往下越化成一片白；三层水帘错开，有厚度。
// 落水处：潭面上一圈圈往外推的水花；一团团往上翻、随风飘散的水雾；四溅的飞沫。
// 冬天全都冻住：水纹不动，颜色发青白，没有水雾和飞沫。
import * as THREE from 'three';
import { rnd } from '../anim.js';
import { COMMON, U, seasonal } from './paint.js';
import { SEASONS } from './seasons.js';

const FLOW = { base: 2.6, steep: 15 };                                // 溪水的流速：平处每秒几个单位、每陡一分再快多少
const FALL = { launch: 4, pull: 16 };                                 // 瀑布：出崖口的速度、往下加速的快慢
const MIST = 30, DROPS = 260, HAZE = 26;                             // 往上翻的水雾几团、飞沫几粒、贴着潭面的水雾几团

const BAND_VERT = /* glsl */`
attribute vec3 aInfo;       // 顺流的距离、这一处有多陡、瀑布落到第几成
varying vec3 vWp, vInfo; varying vec2 vUv;
void main() { vWp = (modelMatrix * vec4(position, 1.)).xyz; vUv = uv; vInfo = aInfo; gl_Position = projectionMatrix * viewMatrix * vec4(vWp, 1.); }`;
const BAND_FRAG = /* glsl */`
#include <common>
${COMMON}
uniform vec3 uWaterDeep, uWaterShallow, uDiscCol;
uniform vec2 uFlow;         // 水量、结不结冰
uniform float uFall;        // 0 溪，1 瀑布
uniform vec2 uVeil;         // 瀑布的这一层：x 种子，y 是不是后面那层（后面的暗一些、薄一些）
varying vec3 vWp, vInfo; varying vec2 vUv;
void main() {
  float across = vUv.x, mid = 1. - across * across, when = vUv.y - uTime * (1. - uFlow.y), steep = vInfo.y, fell = vInfo.z;
  float sunlit = bakedSun(vWp.xz) * hiShade(vWp);
  vec3 light = (uSkyCol * .8 + uSunCol * .55 * sunlit) * (RECIPROCAL_PI * GAIN), white = mix(light, vec3(dot(light, vec3(.3333))), .35) * 1.25;
  vec3 rd = normalize(vWp - cameraPosition);
  float sunward = max(dot(rd, uSunDir), 0.);
  vec3 c; float alpha;
  if (uFall < .5) {
    // 溪：水在石头之间一级一级跌下来。每一级是一小道白的跌水（顺流拉成丝），跌下去是一汪深青的潭，潭面上漂着一片片散开的沫，
    // 再往前水又清了、看得见底，细细的流线顺着水走；陡的地方跌水密而长，缓的地方几乎全是清水。岸边水浅，颜色淡，参差着咬进石头和草里。
    float sway = noise1(vec2(when * .5, 3.7)) - .5, rapid = smoothstep(.04, .45, steep), along = vInfo.x;
    float stepAt = along / mix(9., 4.2, rapid) + .35 * noise1(vec2(across * 1.3, along * .11)) + .2 * across * (noise1(vec2(along * .07, 5.)) - .5);
    float f = fract(stepAt), sid = floor(stepAt);
    vec4 hs = texture2D(uNoise, (vec2(sid, 23.) + .5) / 256.);
    float drop = smoothstep(.0, .05, f) * smoothstep(mix(.16, .5, rapid) * (.6 + .8 * hs.r), .06, f) * (.35 + .65 * rapid) * step(.25 - .5 * rapid, hs.g);   // 这一级的跌水
    float threads = noise1(vec2(across * 9. + sid * 3.1, when * 1.1)) * .6 + noise1(vec2(across * 23. + sid * 7.7, when * 2.3)) * .4;
    float churn = fbm(vec2(across * 3.1 + sway, when * .5) + sid * 1.7);
    float scum = smoothstep(.55, .78, churn + .3 * (1. - f) - .25) * smoothstep(.95, .3, f) * (.3 + .7 * rapid);                                             // 潭面上散开的沫
    float foam = clamp(drop * smoothstep(.2, .7, threads + .25 * drop) + scum * .75, 0., 1.);
    float bank = abs(across) + .22 * (noise1(vec2(along * .23, across * 2.)) - .5);
    foam = max(foam, smoothstep(.78, .95, bank + .12 * churn) * smoothstep(.45, .7, noise1(vec2(along * .5, 9.))) * .6);                                     // 岸边断断续续的一线沫
    float deep = smoothstep(1., .25, bank) * (.45 + .55 * smoothstep(.2, .7, f));
    vec3 bed = mix(uWaterShallow * (.75 + .5 * noise1(vWp.xz * 1.7)), uWaterDeep, deep) * light;
    float lines = smoothstep(.62, .8, noise1(vec2(across * 17. + sway * 3., when * .9))) * (1. - foam) * .12;                                                // 清水上细细的流线
    vec3 up = vec3(0., 1., 0.), mirror = skyBase(reflect(rd, up)) * .5;
    bed = mix(bed, mirror, .12 + .5 * pow(1. - max(dot(-rd, up), 0.), 4.)) + white * lines;
    float glitter = pow(noise1(vec2(across * 11., when * 4.6)), 7.) * (.4 + 3. * sunward * sunward) * sunlit;
    c = mix(bed, white * (.8 + .25 * threads), foam) + uDiscCol * glitter * .2;
    alpha = smoothstep(1., .7, bank) * mix(.8, .96, foam);
  } else {
    // 瀑布：一股一股的水束。每股有自己的位置、粗细和快慢，一路左右摆、粗细变；束里一团团的水往下赶，越往下越碎成水丝和水珠。
    // 束与束之间是缝，只隔着一层薄薄的水汽，透出后面湿黑的石壁。崖口还是整片的一层水，顺着石沿弯下去，弯处亮一道天光。
    // 冬天：中间冻成几根粗的冰柱，两边的水束冻成长短不一的冰挂
    float x = across * 3.1 + uVeil.x * 13.1 + .22 * (noise1(vec2(vUv.y * .25, uVeil.x * 9.)) - .5), base = floor(x), frozen = uFlow.y, run = uTime * (1. - frozen);
    float body = 0., core = 0., thread = 0.;
    for (int j = -1; j <= 1; j++) {
      float id = base + float(j);
      vec4 h = texture2D(uNoise, (vec2(id, uVeil.x * 37.) + .5) / 256.);
      float q = vUv.y - run * (.72 + .6 * h.z);                                                   // 这一股水的快慢
      float c0 = id + .5 + (h.x - .5) * .55 + (noise1(vec2(q * .3, id * 3.1)) - .5) * (.25 + .7 * fell);
      float side = smoothstep(.4, .7, abs(across)), icicle = .12 + .6 * h.w;                       // 冬天两边的冰挂垂到多长
      float w = (.1 + .42 * h.y * h.y) * (1. + 1.2 * fell) * (.7 + .6 * noise1(vec2(q * .7, id * 5.7))) * mix(1., smoothstep(icicle, icicle - .3, fell), frozen * side);
      float d = abs(x - c0) / max(w, .02);
      float lump = noise1(vec2(q * 1.5, id * 7.3 + x * .7)) * .6 + noise1(vec2(q * 4.4, id * 2.9 + x * 2.6)) * .4;
      float b = smoothstep(1., mix(.1, .4, frozen), d) * smoothstep(.2 + .5 * fell, .45 + .4 * fell, lump + .4 * (1. - fell) * (1. - .5 * h.w));   // 水束的边是虚的（结了冰才是实的）
      body = max(body, b); core = max(core, b * smoothstep(.65, 0., d));
      thread = max(thread, b * pow(noise1(vec2(x * 7.5 + id, q * .35)), 3.));
    }
    float sheet = smoothstep(.09, .02, fell);                                                     // 崖口整片的一层
    float spray = (.1 + .34 * fell) * (fbm(vec2(x * .9, (vUv.y - run) * 1.3)) + .25) * (1. - frozen);   // 束间是一层半透的水汽，越往下越浓，到底下化成一片白
    float fine = pow(noise1(vec2(x * 15. + uVeil.x * 7., (vUv.y - run * 1.3) * .5)), 2.) * (.25 + .45 * fell) * (1. - frozen);   // 水汽里更细的水丝
    float edge = smoothstep(1., .5, abs(across) + .16 * (noise1(vec2(vUv.y * 1.7 - run, across * 3. + uVeil.x * 5.)) - .5));   // 两边散成水雾，没有齐的边
    alpha = max(max(body * (.62 + .3 * core), spray + fine * .5), sheet * .8) * edge * mix(1., .62, uVeil.y);
    c = mix(uWaterShallow * .8 * light, mix(uWaterShallow, vec3(1.), .55) * light, smoothstep(.1, .6, body + sheet + spray));
    c = mix(c, white * 1.15, clamp(core * (.4 + .6 * fell) + thread * .6 + fine * .5, 0., 1.));
    c += white * .55 * smoothstep(.05, .0, abs(fell - .035)) * (1. - frozen);                    // 崖口弯处的一道亮
    c *= mix(1., .72, uVeil.y);
    c += uDiscCol * pow(noise1(vec2(x * 3., vUv.y * 5. - run * 5.)), 8.) * .25 * sunlit * body;
  }
  // 冻住的时候发青白，不透
  c = mix(c, vec3(.74, .84, .98) * dot(light, vec3(.3333)) * 1.25 * (.85 + .3 * noise1(vec2(across * 6., vInfo.x * .3))), uFlow.y * .75);
  alpha = mix(alpha, mix(max(alpha, .9 * smoothstep(1., .6, abs(across))), min(1., alpha * 1.7), uFall), uFlow.y);   // 溪冻成整片，瀑布冻成一根根冰柱
  c = wildFog(c, vWp);
  gl_FragColor = vec4(c, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// 潭面上的水花：从落水点一圈圈往外推的白沫，中心翻腾
const POOL_FRAG = /* glsl */`
#include <common>
${COMMON}
uniform vec2 uFlow;
varying vec3 vWp, vInfo; varying vec2 vUv;
void main() {
  float r = length(vUv), spin = atan(vUv.y, vUv.x), run = uTime * (1. - uFlow.y);
  float lumpy = noise1(vec2(spin * 2.2, r * 3. - run * .9)) * .6 + noise1(vec2(spin * 5. + 3., r * 7. - run * 1.7)) * .4;
  // 一圈圈往外推的波：波峰是一道细亮线，波谷暗一点；越往外越稀、越淡，被碎浪打断成一段段的弧
  float wave = sin(r * 30. - run * 4.6 + lumpy * 4.), broken = smoothstep(.3, .6, noise1(vec2(spin * 4. + r * 9., r * 5. - run * .6)));
  float crest = smoothstep(.8, .98, wave) * broken * smoothstep(1., .3, r), trough = smoothstep(-.7, -.98, wave) * smoothstep(1., .2, r);
  float rings = smoothstep(.35, .9, sin(r * 21. - run * 5.2 + lumpy * 5.)) * smoothstep(.6, .15, r);
  float churn = smoothstep(.36, .03, r - .16 * lumpy);
  float still = (1. - uFlow.y) * (.5 + .5 * uFlow.x);
  float foam = clamp(churn * (.5 + .5 * lumpy) + rings * (.15 + .6 * lumpy), 0., 1.) * still;
  vec3 lit = (uSkyCol * .85 + uSunCol * .5 * bakedSun(vWp.xz)) * (RECIPROCAL_PI * GAIN) * 1.15;
  vec3 c = mix(lit * .35, lit, max(foam, crest) / max(.001, max(foam, crest) + trough * .5));
  gl_FragColor = vec4(wildFog(c, vWp), max(max(foam * .9, crest * .55 * still), trough * .22 * still));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// 水雾和飞沫：都是朝着镜头的小片，位置只由（各自的随机数、时间）算出
const SPRAY_VERT = /* glsl */`
#include <common>
${COMMON}
attribute vec4 aSeed;
uniform vec3 uFoot; uniform vec2 uFlow; uniform float uDrop;         // 落水点；水量、结不结冰；0 水雾，1 飞沫
varying vec2 vUv; varying vec3 vWp; varying float vFade, vSeed;
void main() {
  vec3 toCam = normalize(cameraPosition - uFoot), right = normalize(cross(vec3(0., 1., 0.), toCam)), up = cross(toCam, right), c, e1 = right, e2 = up;
  float size;
  if (uDrop < .5) {
    // 水雾：一团团从落水处往上翻，一边升一边散开、随风飘走
    float k = fract(uTime * (.11 + .07 * aSeed.w) + aSeed.x), spin = aSeed.y * 6.2832;
    c = uFoot + vec3(cos(spin), 0., sin(spin)) * (1.2 + 5.5 * aSeed.z) * (.35 + k) + vec3(uWind.x, 0., uWind.y) * uWind.z * 7. * k * k + vec3(0., 1. + 12. * k * (1.2 - .5 * k) * (.5 + aSeed.w), 0.);
    size = (3.2 + 4. * aSeed.z) * (.5 + 1.5 * k);
    vFade = smoothstep(0., .18, k) * smoothstep(1., .35, k) * .34;
  } else if (uDrop > 1.5) {
    // 潭面上的水雾：贴着水面从落水处慢慢铺开，顺风飘
    float k = fract(uTime * (.035 + .03 * aSeed.w) + aSeed.x), spin = aSeed.y * 6.2832;
    c = uFoot + vec3(cos(spin), 0., sin(spin)) * (1.5 + 10. * k * (.6 + .6 * aSeed.z)) + vec3(uWind.x, 0., uWind.y) * uWind.z * 6. * k + vec3(0., .4 + 1.6 * k * aSeed.w, 0.);
    size = (2.6 + 3. * aSeed.z) * (.7 + .8 * k);
    vFade = smoothstep(0., .2, k) * smoothstep(1., .5, k) * .26;
  } else {
    // 飞沫：从落水点四面溅起来，划一道弧落回去；顺着去向拉长一点
    float life = .7 + .8 * aSeed.w, k = fract(uTime / life + aSeed.x), tau = k * life, spin = aSeed.y * 6.2832;
    vec3 v0 = vec3(cos(spin) * (1.5 + 5. * aSeed.z), 5. + 7. * aSeed.w * aSeed.z, sin(spin) * (1.5 + 5. * aSeed.z)), vel = v0 - vec3(0., 15. * tau, 0.);
    c = uFoot + v0 * tau - vec3(0., 7.5 * tau * tau, 0.);
    size = .07 + .1 * aSeed.z;
    e2 = normalize(vel) * (1. + .12 * length(vel)); e1 = normalize(cross(e2, toCam));
    vFade = smoothstep(0., .08, k) * smoothstep(1., .6, k) * .9;
  }
  vFade *= (1. - uFlow.y) * (.45 + .55 * uFlow.x);
  vec3 wp = c + (e1 * position.x + e2 * position.y) * size;
  vUv = position.xy; vWp = wp; vSeed = aSeed.x;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.);
}`;
const SPRAY_FRAG = /* glsl */`
#include <common>
${COMMON}
uniform float uDrop;
varying vec2 vUv; varying vec3 vWp; varying float vFade, vSeed;
void main() {
  float r2 = dot(vUv, vUv);
  float puff = exp(-r2 * 3.2) * smoothstep(1., .7, sqrt(r2)) * (.55 + .7 * fbm(vUv * 1.7 + vSeed * 37.));
  float alpha = (abs(uDrop - 1.) < .5 ? smoothstep(1., .5, r2) : puff) * vFade;
  if (alpha < .004) discard;
  float sunward = max(dot(normalize(vWp - cameraPosition), uSunDir), 0.);
  vec3 c = (uSkyCol * .85 + uSunCol * (.4 + .5 * sunward * sunward) * bakedSun(vWp.xz)) * (RECIPROCAL_PI * GAIN) * 1.1;
  gl_FragColor = vec4(wildFog(c, vWp), alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// 顺着一串点铺一条带子。half(i)：第 i 个点处的半宽；speedAt(i, 陡度, 已经落下多高)：水在这一点的流速。
// uv：x 横向 -1 到 1，y 水从头流到这里用的时间；aInfo：顺流的距离、陡度、落下的高度占全程几成
function ribbon(pts, half, speedAt) {
  const pos = [], uv = [], info = [], idx = [], side = new THREE.Vector3(), drop = pts[0].y - pts.at(-1).y;
  let run = 0, travel = 0;
  pts.forEach((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], steep = Math.max(0, (a.y - b.y) / Math.hypot(b.x - a.x, b.z - a.z, 1e-3));
    side.set(-(b.z - a.z), 0, b.x - a.x).normalize().multiplyScalar(half(i));
    if (i > 0) { const step = p.distanceTo(pts[i - 1]); run += step; travel += step / speedAt(i, steep, pts[0].y - p.y); }
    const fell = drop > 0 ? (pts[0].y - p.y) / drop : 0;
    pos.push(p.x - side.x, p.y, p.z - side.z, p.x + side.x, p.y, p.z + side.z); uv.push(-1, travel, 1, travel); info.push(run, steep, fell, run, steep, fell);
    if (i > 0) { const k = i * 2; idx.push(k - 2, k, k - 1, k - 1, k, k + 1); }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('aInfo', new THREE.Float32BufferAttribute(info, 3)); geo.setIndex(idx);
  return geo;
}

function spray(count, foot, flow, drop, salt) {
  const geo = new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry(2, 2)), seeds = new Float32Array(count * 4);
  for (let i = 0; i < seeds.length; i++) seeds[i] = rnd(i * 2.399 + salt);
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4)); geo.instanceCount = count;
  const uniforms = { ...U, uFlow: flow, uFoot: { value: foot }, uDrop: { value: drop } };
  const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({ vertexShader: SPRAY_VERT, fragmentShader: SPRAY_FRAG, uniforms, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  mesh.frustumCulled = false;
  return mesh;
}

export function buildStreams(creek) {
  const group = new THREE.Group(), tints = seasonal(SEASONS.春.u, 'uWaterDeep', 'uWaterShallow', 'uDiscCol', 'uFlow');
  const band = (fall, veil = new THREE.Vector2()) => new THREE.ShaderMaterial({ vertexShader: BAND_VERT, fragmentShader: BAND_FRAG, uniforms: { ...U, ...tints, uFall: { value: fall }, uVeil: { value: veil } }, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const creekSpeed = (_i, steep) => FLOW.base + FLOW.steep * Math.min(steep, 1.2), fallSpeed = (_i, _steep, fell) => Math.sqrt(FALL.launch ** 2 + 2 * FALL.pull * fell);
  // 溪：瀑布口以上一小段、潭、潭以下一直到湖。潭那里放宽
  const { pts, lip, pool } = creek, wide = i => 2.7 + 6.5 * Math.exp(-(((i - pool - 1) / 2.2) ** 2));
  const upper = new THREE.Mesh(ribbon(pts.slice(0, lip + 1), () => 2.4, creekSpeed), band(0)), lower = new THREE.Mesh(ribbon(pts.slice(pool), i => wide(i + pool), creekSpeed), band(0));
  // 瀑布：水先平着漫到崖口（BACK 那一小段在口内），越过石沿弯下去，越落越快，落进潭里。三层前后错开，水帘有厚度，后面那层暗一些
  const top = pts[lip], foot = pts[pool + 1], N = 60, BACK = .1, splashAt = fallFoot(creek);
  const arc = lift => Array.from({ length: N + 1 }, (_, i) => {
    const k = -BACK + (1 + BACK) * i / N, fall = Math.max(k, 0);
    return new THREE.Vector3(THREE.MathUtils.lerp(top.x, foot.x, k * .82), top.y + lift - (top.y - foot.y + lift) * fall ** 1.9, THREE.MathUtils.lerp(top.z, foot.z, k * .82));
  });
  const veils = [[.4, 1, 0], [1.2, .86, 0], [2.1, .72, 1]].map(([lift, wide, back], j) =>
    new THREE.Mesh(ribbon(arc(lift), i => (2.4 + 3 * Math.max(0, i / N - BACK) ** .8) * wide, fallSpeed), band(1, new THREE.Vector2(j * .37 + .11, back))));
  // 落水处：潭面的水花、往上翻的水雾、贴着潭面铺开的水雾、飞沫
  const ringGeo = new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2);
  ringGeo.setAttribute('uv', new THREE.Float32BufferAttribute(Array.from(ringGeo.attributes.position.array).flatMap((v, i, all) => i % 3 === 0 ? [v, all[i + 2]] : []), 2));
  ringGeo.setAttribute('aInfo', new THREE.Float32BufferAttribute(new Float32Array(ringGeo.attributes.position.count * 3), 3));
  const rings = new THREE.Mesh(ringGeo, new THREE.ShaderMaterial({ vertexShader: BAND_VERT, fragmentShader: POOL_FRAG, uniforms: { ...U, ...tints }, transparent: true, depthWrite: false }));
  rings.position.copy(splashAt); rings.scale.setScalar(9);
  const mist = spray(MIST, splashAt, tints.uFlow, 0, 11.7), drops = spray(DROPS, splashAt, tints.uFlow, 1, 53.1), haze = spray(HAZE, splashAt, tints.uFlow, 2, 27.3);
  [upper, lower, rings, ...veils.reverse(), drops, haze, mist].forEach((m, i) => { m.renderOrder = 5 + i * .1; group.add(m); });
  return group;
}

// 瀑布落进潭里的那一点（水面上）
export function fallFoot(creek) {
  const top = creek.pts[creek.lip], foot = creek.pts[creek.pool + 1];
  return new THREE.Vector3(THREE.MathUtils.lerp(top.x, foot.x, .82), foot.y + .25, THREE.MathUtils.lerp(top.z, foot.z, .82));
}
