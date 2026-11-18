// 天气和飞鸟：春天飘花瓣，夏天山里一场骤雨（细而斜的雨丝），秋天落叶，冬天下雪；秋天的黄昏天边一行雁。
// 天气可以停（setWeather）：飘落的东西越来越稀直到没有，雨丝还一起变短变淡；下雨的季节同时放晴、出虹（放晴到几成写进 uWeather，
// 天、雾、水、石头、溪谷里的雨雾和光束都读它；光和颜色本身由 clearing.js 在季节表的两套值之间混）。
// 飘落的东西住在镜头周围的盒子里：每一片的位置只由（它的随机数、时间、镜头位置）算出，飘出盒子的从另一头回来，
// 所以镜头走到哪儿身边都有，同一时刻同一机位永远是同一帧。
// 每种天气分近、中、远几层盒子：近处的少而大（从镜头跟前掠过），远处的多而小（山谷上空细细密密的一片），画面里才有纵深。
// 风是一阵一阵的：顺风的位移是「风速对时间的积分」（写成解析式），所有的片子一起快、一起慢。
// 花瓣和叶子左右荡着往下掉，一边荡一边翻面；迎光的一面亮，逆光时薄薄地透光。雪是虚的圆点，近处的又大又虚。雨是顺着去向拉长的丝，朝着日头的方向发亮。
import * as THREE from 'three';
import { rnd } from '../anim.js';
import { COMMON, U, seasonal } from './paint.js';
import { SEASONS } from './seasons.js';
import { clearedBy } from './clearing.js';

// 每一层：count 多少片；box 盒子的大小；move：下落的速度、顺风飘的速度、左右荡的幅度、翻转的快慢；size：最小、最大、拉长几倍；
// look：0 花瓣，1 叶子，2 雪，3 雨；alpha 有多实
const KINDS = {
  petal: [
    { count: 420, box: [36, 26, 36], move: [1.1, 4.2, 1.1, 1.9], size: [.055, .1, 1], look: 0, alpha: 1 },
    { count: 2400, box: [130, 72, 130], move: [1.4, 5.4, 1.7, 2.2], size: [.11, .2, 1], look: 0, alpha: 1 },
    { count: 3600, box: [460, 190, 460], move: [1.7, 6.5, 3, 2], size: [.16, .28, 1], look: 0, alpha: .9 },
  ],
  rain: [
    { count: 1400, box: [34, 30, 34], move: [24, 9, 0, 0], size: [.006, .01, 70], look: 3, alpha: .3 },
    { count: 5200, box: [120, 76, 120], move: [28, 10.5, 0, 0], size: [.012, .02, 70], look: 3, alpha: .2 },
    { count: 5200, box: [420, 180, 420], move: [32, 12, 0, 0], size: [.04, .07, 60], look: 3, alpha: .07 },
  ],
  leaf: [
    { count: 320, box: [38, 28, 38], move: [1.7, 5.5, 1.5, 2.3], size: [.07, .13, 1], look: 1, alpha: 1 },
    { count: 1800, box: [130, 80, 130], move: [2.2, 7, 2.3, 2.6], size: [.16, .3, 1], look: 1, alpha: 1 },
    { count: 2600, box: [460, 200, 460], move: [2.6, 8.5, 3.6, 2.4], size: [.2, .36, 1], look: 1, alpha: .9 },
  ],
  snow: [
    { count: 1300, box: [30, 26, 30], move: [1.6, 1.8, .5, 0], size: [.045, .1, 1], look: 2, alpha: .75 },
    { count: 8200, box: [110, 80, 110], move: [2.2, 2.4, .9, 0], size: [.07, .19, 1], look: 2, alpha: .95 },
    { count: 9000, box: [400, 180, 400], move: [2.6, 3, 1.6, 0], size: [.11, .24, 1], look: 2, alpha: .6 },
  ],
};
const VERT = /* glsl */`
#include <common>
${COMMON}
attribute vec4 aSeed;
uniform vec3 uBox, uSize; uniform vec4 uMove; uniform float uLook, uCount;
varying vec2 vUv; varying vec3 vWp; varying float vFace, vSun, vFade, vSeed;
void main() {
  // 天气停到几成（uWeather.x）：排在后面的片子先淡掉，留下的越来越稀；雨丝还一起变短、变淡
  float amount = uWeather.x, keep = clamp((amount * 1.1 - (float(gl_InstanceID) + .5) / uCount) / .1, 0., 1.);
  if (keep <= 0.) { gl_Position = vec4(2., 2., 2., 1.); return; }
  float t = uTime, speed = .7 + .6 * aSeed.w;
  // 风一阵一阵的：blown 是风速的积分，gust 是这一刻的风速
  float blown = t + .55 * sin(t * .37 + 1.) / .37 + .25 * sin(t * .91) / .91, gust = 1. + .55 * cos(t * .37 + 1.) + .25 * cos(t * .91);
  vec3 wind = vec3(uWind.x, 0., uWind.y) * uWind.z * uMove.y * speed;
  vec3 q = aSeed.xyz * uBox + wind * blown - vec3(0., uMove.x * speed * t, 0.);
  // 左右荡着往下掉
  float swing = t * (.9 + .8 * aSeed.w) + aSeed.x * 40.;
  q.xz += uMove.z * vec2(sin(swing), cos(swing * .83 + aSeed.z * 20.));
  q.y += uMove.z * .35 * cos(swing * 2.);
  vec3 c = cameraPosition + mod(q - cameraPosition + uBox * .5, uBox) - uBox * .5;
  vec3 toCam = normalize(cameraPosition - c), e1, e2;
  float size = mix(uSize.x, uSize.y, aSeed.y), faint = 1.;
  if (uLook < 1.5) {
    // 薄片：跟着荡的节拍侧倾，同时慢慢打转，片子就翻飞起来
    float a = t * uMove.w * speed + aSeed.x * 40., b = .9 * sin(swing) + t * uMove.w * .4 + aSeed.z * 40.;
    e1 = normalize(vec3(cos(a), sin(a) * cos(b), sin(a) * sin(b))); e2 = normalize(cross(e1, vec3(sin(b), .3, cos(b))));
    vec3 n = cross(e1, e2);
    float toSun = dot(n, uSunDir) * sign(dot(n, toCam));                                    // 朝着镜头的这一面迎不迎光
    vFace = toSun > 0. ? .45 + .55 * toSun : .3 + .5 * -toSun * max(dot(-toCam, uSunDir), 0.);   // 背光的一面：逆着光看时透亮
  } else if (uLook < 2.5) {
    e2 = normalize(cross(toCam, vec3(0., 1., 0.))); e1 = cross(e2, toCam); vFace = 1.;
  } else {
    vec3 vel = wind * gust - vec3(0., uMove.x * speed, 0.);
    e1 = normalize(vel) * uSize.z * (.15 + .85 * amount); e2 = normalize(cross(e1, toCam));
    faint = .35 + .65 * amount;
    vFace = .5 + 1.6 * pow(max(dot(-toCam, uSunDir), 0.), 3.);                              // 雨丝朝着日头的方向发亮
  }
  vec3 wp = c + (e1 * position.x + e2 * position.y) * size;
  float dist = distance(c, cameraPosition);
  vFade = smoothstep(uBox.x * .05 + 1.8, uBox.x * .12 + 3.5, dist) * smoothstep(uBox.x * .5, uBox.x * .34, dist);   // 贴着镜头的不画（会糊成一大块），盒子边上的淡出
  vFade *= keep * faint;
  vSun = sunSeen(c);
  vUv = position.xy; vWp = wp; vSeed = aSeed.w;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.);
}`;
const FRAG = /* glsl */`
#include <common>
${COMMON}
uniform vec3 uLitterA, uLitterB; uniform float uLook, uAlpha;
varying vec2 vUv; varying vec3 vWp; varying float vFace, vSun, vFade, vSeed;
void main() {
  vec2 p = vUv; float shape, tone = fract(vSeed * 13.);
  vec3 albedo;
  if (uLook < .5) {
    // 花瓣：一头圆一头尖，尖上有个小缺口；瓣根颜色深，瓣缘淡
    float r = length(p * vec2(1.25 + .5 * p.y, 1.)) + .22 * smoothstep(.25, 0., abs(p.x)) * smoothstep(.55, 1., p.y);
    shape = smoothstep(1., .82, r);
    albedo = mix(uLitterA, uLitterB, clamp(.25 + .7 * (p.y * .5 + .5) + (tone - .5) * .5, 0., 1.));
  } else if (uLook < 1.5) {
    // 叶：两头尖，边上有浅浅的齿，中间一道叶脉；一片一个颜色，叶尖偏焦
    float halfW = (1. - p.y * p.y) * (.5 + .1 * sin(p.y * 15.));
    shape = smoothstep(halfW, halfW - .12, abs(p.x));
    albedo = mix(uLitterA, uLitterB, tone) * (.72 + .28 * smoothstep(.0, .09, abs(p.x))) * mix(1., .72, smoothstep(.4, 1., abs(p.y)));
  } else if (uLook < 2.5) {
    float r2 = dot(p, p);
    shape = exp(-r2 * 3.4) * smoothstep(1., .6, r2);
    albedo = vec3(.94, .96, 1.);
  } else {
    shape = smoothstep(1., .2, abs(p.y)) * smoothstep(1., .55, abs(p.x)) * (.35 + .65 * smoothstep(-1., 1., p.x));   // 丝：头实尾虚
    albedo = vec3(.86, .92, 1.);
  }
  float alpha = shape * vFade * uAlpha;
  if (alpha < .01) discard;
  vec3 c = albedo * (uSkyCol * .8 + uGndCol * .3 + uSunCol * (.2 + .8 * vFace * vSun)) * RECIPROCAL_PI;        // 薄的东西在背阴处也被周围的光托着，不发乌
  gl_FragColor = vec4(wildFog(c, vWp), alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const BIRD_VERT = /* glsl */`
#include <common>
${COMMON}
attribute vec3 aSlot;        // 这只雁在队里的位置（右、上、后）和拍翅的相位
uniform vec3 uFrom, uTo;
varying vec3 vWp; varying float vFade;
void main() {
  float k = fract(uTime / 150. + .37);                                   // 150 秒飞完全程，再从头来
  vec3 dir = normalize(uTo - uFrom), right = normalize(cross(dir, vec3(0., 1., 0.)));
  vec3 lead = mix(uFrom, uTo, k) + vec3(0., 6. * sin(uTime * .21), 0.);
  float flap = sin(uTime * 5.2 + aSlot.z * 2.1), wing = abs(position.x);
  vec3 p = position; p.y += wing * (.55 * flap - .12 * wing * flap * flap) ;
  vec3 wp = lead + right * (aSlot.x + p.x) + vec3(0., aSlot.y + p.y + .5 * sin(uTime * 1.1 + aSlot.z), 0.) - dir * (abs(aSlot.x) * 1.15 + p.z);
  vWp = wp; vFade = smoothstep(0., .06, k) * smoothstep(1., .94, k);
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.);
}`;
const BIRD_FRAG = /* glsl */`
#include <common>
${COMMON}
varying vec3 vWp; varying float vFade;
void main() {
  vec3 rd = normalize(vWp - cameraPosition);
  vec3 c = mix(vec3(.05, .045, .06), airColor(rd) + sunWash(rd), (1. - exp(-uFogP.x * distance(vWp, cameraPosition))) * .8);
  gl_FragColor = vec4(c, vFade);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

function buildGeese() {
  // 一只雁：细长的身子和脖子，两片翅膀；翅尖在着色器里上下拍
  const pos = [-.25, 0, 1.3, .25, 0, 1.3, 0, .1, -3.2, -.25, 0, 1.3, 0, 0, 2.6, .25, 0, 1.3, 0, 0, -.6, -5.2, 0, .9, 0, 0, 1.1, 0, 0, -.6, 0, 0, 1.1, 5.2, 0, .9];
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const COUNT = 9, slots = new Float32Array(COUNT * 3);                    // 人字形：头雁在前，两翼各四只，一边长一边短
  for (let i = 0; i < COUNT; i++) { const rank = Math.ceil(i / 2), side = i % 2 ? 1 : -1.25; slots.set([side * rank * 9.5, rnd(i * 3.3) * 3 - 1.5, rnd(i * 7.1) * 6], i * 3); }
  geo.setAttribute('aSlot', new THREE.InstancedBufferAttribute(slots, 3)); geo.instanceCount = COUNT;
  const uniforms = { ...U, uFrom: { value: new THREE.Vector3(-150, 395, -520) }, uTo: { value: new THREE.Vector3(-900, 330, 620) } };
  const flock = new THREE.Mesh(geo, new THREE.ShaderMaterial({ vertexShader: BIRD_VERT, fragmentShader: BIRD_FRAG, uniforms, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  flock.frustumCulled = false; flock.renderOrder = 12;
  return flock;
}

export function buildWeather() {
  const group = new THREE.Group(), tints = seasonal(SEASONS.春.u, 'uLitterA', 'uLitterB'), falls = {};
  for (const [name, layers] of Object.entries(KINDS)) {
    falls[name] = layers.map((K, layer) => {
      const geo = new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry(2, 2)), seeds = new Float32Array(K.count * 4);
      for (let i = 0; i < seeds.length; i++) seeds[i] = rnd(i * 1.618 + name.length * 31.7 + layer * 977.3);
      geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4)); geo.instanceCount = K.count;
      const uniforms = { ...U, ...tints, uBox: { value: new THREE.Vector3(...K.box) }, uMove: { value: new THREE.Vector4(...K.move) }, uSize: { value: new THREE.Vector3(...K.size) }, uLook: { value: K.look }, uAlpha: { value: K.alpha }, uCount: { value: K.count } };
      const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
      mesh.frustumCulled = false; mesh.renderOrder = 20 + layer; mesh.userData.count = K.count;
      group.add(mesh);
      return mesh;
    });
  }
  const geese = buildGeese();
  group.add(geese);
  // 天气停到几成：k 从 1（这一季照常）到 0（停了）。飘落的东西按 k 留下前面那几成（着色器里让刚要消失的那几片先淡掉），
  // 不画的就不交给显卡。下雨的季节，k 越小天越放晴（uWeather.y，雨先稀下来、云再开），放晴过半以后虹慢慢显出来（uWeather.z）
  let season = null, k = 1;
  const apply = () => {
    const cleared = season.weather === 'rain' ? clearedBy(k) : 0;
    U.uWeather.value.set(k, cleared, THREE.MathUtils.smoothstep(cleared, .5, 1), 0);
    for (const [name, meshes] of Object.entries(falls)) meshes.forEach(mesh => {
      mesh.visible = name === season.weather && k > 0;
      mesh.geometry.instanceCount = Math.ceil(mesh.userData.count * Math.min(1, k * 1.1));
    });
  };
  return {
    group,
    setSeason(S) {
      season = S; apply();
      geese.visible = S.geese;
    },
    setWeather(next) {
      if (next === k) return;
      if (!(next >= 0 && next <= 1)) throw new Error(`天气要在 0 到 1 之间：${next}`);
      k = next; apply();
    },
  };
}
