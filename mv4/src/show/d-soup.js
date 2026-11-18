// 水盂里的那盂孟婆汤：盂口里一层深茶褐的汤面，和汤面上方的几缕热气。只给 d-sip.js 用。
// 汤面是一张圆片，放在盂口里面、比文房自带的水面高（盖住它）；半径按此刻的高度贴着盂的里壁走（里壁往下是张开的）。
// 汤面上：一直有的细碎涟漪，吸管入水处一圈贴着管子的亮边，每吸一口从吸管那里荡开的一圈圈波纹。
// 热气：几条竖着的细带子，总是转过来朝着镜头，在着色器里往上飘、左右扭、越往上越宽越淡。
import * as THREE from 'three';
import { TAU, rnd } from '../anim.js';

const RIPPLES = 6, WISPS = 5;
// 盂的里壁：口沿下面 y = 1.42 处半径 0.7，往下张开到 y = 1.0 处 1.14（文房 waterpot.js 的造型，盂底往上量）
const wallAt = y => .7 + .44 * (1.42 - y) / .42;

const SURFACE_HEAD = /* glsl */`
uniform vec3 uDip; uniform float uTime, uStraw; uniform vec4 uRing[${RIPPLES}];
varying vec3 vWorld;`;
const SURFACE_COLOR = /* glsl */`
#include <color_fragment>
vec2 d = vWorld.xz - uDip.xz; float r = length(d);
float calm = sin(vWorld.x * 23. + uTime * 2.1) * sin(vWorld.z * 19. - uTime * 1.7) + .6 * sin((vWorld.x + vWorld.z) * 31. + uTime * 2.9);
float wave = 0.;
for (int i = 0; i < ${RIPPLES}; i++) { vec4 w = uRing[i]; wave += w.z * exp(-pow((r - w.w) / .035, 2.)); }   // 一圈圈往外扩的波纹：w.w 半径，w.z 浓淡
float hug = exp(-pow((r - uStraw - .03) / .018, 2.));                                                         // 贴着吸管的一圈亮边
diffuseColor.rgb *= .9 + .08 * calm;
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.98, .86, .66), clamp(.75 * wave + .6 * hug, 0., .85));`;

const WISP_HEAD = /* glsl */`
uniform float uTime, uSeed;
varying vec2 vUv;`;
// 带子竖着从 y = 0 到 1；越往上左右扭得越厉害、越宽
const WISP_MOVE = /* glsl */`
vUv = vec2(position.x + .5, position.y);
float h = vUv.y;
vec3 transformed = position;
transformed.x *= .35 + 1.6 * h;
transformed.x += .45 * h * h * sin(h * 5.5 - uTime * 1.3 + uSeed * 6.) + .12 * h * sin(h * 11. - uTime * 2.3 + uSeed * 3.);
transformed.z += .25 * h * h * cos(h * 4. - uTime * .9 + uSeed * 5.);`;
const WISP_ALPHA = /* glsl */`
#include <color_fragment>
float h = vUv.y, across = abs(vUv.x - .5) * 2.;
float puff = .55 + .45 * sin(h * 9. - uTime * 1.6 + uSeed * 7.) * sin(h * 4.3 - uTime * .7 + uSeed * 2.);   // 一团团往上走
diffuseColor.a *= (1. - smoothstep(.15, 1., across)) * smoothstep(0., .18, h) * (1. - smoothstep(.45, 1., h)) * puff;`;

function patch(mat, uniforms, head, frag, move) {
  mat.customProgramCacheKey = () => (move ? 'soup-wisp' : 'soup-surface');
  mat.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>\n${head}`);
    shader.vertexShader = move
      ? shader.vertexShader.replace('#include <begin_vertex>', move)
      : shader.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWorld = (modelMatrix * vec4(transformed, 1.)).xyz;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\n${head}`).replace('#include <color_fragment>', frag);
  };
  return mat;
}

// pot：盂心在案面上的那一点 [x, y, z]（y 是盂底）
export function buildSoup(group, pot) {
  const su = { uDip: { value: new THREE.Vector3() }, uTime: { value: 0 }, uStraw: { value: .07 }, uRing: { value: Array.from({ length: RIPPLES }, () => new THREE.Vector4()) } };
  const surface = new THREE.Mesh(new THREE.CircleGeometry(1, 72).rotateX(-Math.PI / 2),
    patch(new THREE.MeshLambertMaterial({ color: '#4A2812', emissive: '#1A0A04' }), su, SURFACE_HEAD, SURFACE_COLOR));
  group.add(surface);

  const wisps = Array.from({ length: WISPS }, (_, i) => {
    const u = { uTime: { value: 0 }, uSeed: { value: rnd(i * 3.1 + .4) } };
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 1, 40).translate(0, .5, 0),
      patch(new THREE.MeshBasicMaterial({ color: '#FFF6EA', transparent: true, depthWrite: false, opacity: .3 }), u, WISP_HEAD, WISP_ALPHA, WISP_MOVE));
    m.renderOrder = 3; group.add(m);
    return { m, u, a: TAU * (i / WISPS + .13 * rnd(i + 9)), r: .15 + .35 * rnd(i * 5.3), tall: 1.3 + .7 * rnd(i * 2.7), wide: .3 + .14 * rnd(i * 4.4), slow: .8 + .4 * rnd(i * 6.1) };
  });

  return {
    // 汤面的高度（盂底往上量）→ 世界里的高度
    y: level => pot[1] + level,
    // level 汤面高度（盂底往上），dip 吸管插进汤里的那一点（THREE.Vector3），straw 吸管半径，rings [[扩到几成 0–1, 浓淡], ...]，
    // heat 热气浓淡（0–1），cam 镜头位置 [x, y, z]
    update(t, { level, dip, straw, rings, heat, cam }) {
      if (rings.length > RIPPLES) throw new Error(`汤面上同时的波纹超过了 ${RIPPLES} 圈`);
      const top = pot[1] + level, r = wallAt(level) + .05;            // 圆片比里壁大一点，边藏进瓷里
      surface.position.set(pot[0], top, pot[2]); surface.scale.set(r, 1, r);
      su.uDip.value.copy(dip); su.uTime.value = t; su.uStraw.value = straw;
      su.uRing.value.forEach((v, i) => (i < rings.length ? v.set(0, 0, rings[i][1] * (1 - rings[i][0]), straw + .05 + .55 * rings[i][0]) : v.set(0, 0, 0, -1)));
      const face = Math.atan2(cam[0] - pot[0], cam[2] - pot[2]);
      wisps.forEach(w => {
        const x = pot[0] + w.r * Math.cos(w.a), z = pot[2] + w.r * Math.sin(w.a);
        w.m.position.set(x, top + .02, z); w.m.rotation.y = face;
        w.m.scale.set(w.wide, w.tall, 1);
        w.u.uTime.value = t * w.slow;
        w.m.material.opacity = .22 * heat;
      });
    },
  };
}
