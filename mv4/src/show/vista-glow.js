// 灯火照亮山：沿每一条路铺一层贴地的网格（路面、路边的雪地草地、湖边的水面），再在路的上空撒一串雾团。
// 两样都是叠加上去的暖光，亮多少查这一帧沿路的疏密（vista-road.js 的 density）：灯多的地方亮、少的地方暗，
// 灯火流过去，明暗跟着动；「蹦起来的波」盖到的那一段再亮一点。
import * as THREE from 'three';
import { rnd } from '../anim.js';
import { COMMON, U } from '../wild/paint.js';
import { AIR_PASS } from './vista-glsl.js';
import { ROWS } from './vista-road.js';

const LAT = [-1, -.7, -.45, -.26, -.12, 0, .12, .26, .45, .7, 1];    // 横着的几道（按半宽的倍数，中间密）
const RIBBON_FRAG = /* glsl */`
#include <common>
${COMMON}
${AIR_PASS}
uniform sampler2D uDens;
uniform vec3 uGroundCol;
uniform float uGroundGain;
varying vec4 vCoord; varying vec3 vWp;
void main() {
  vec4 dn = texture2D(uDens, vec2(vCoord.x, (vCoord.y + .5) / ${ROWS.toFixed(1)}));
  // 灯撒得越开（散向四方的那几股），同样多的灯照亮的地方越大、每一处越淡
  float lat = vCoord.w, w = vCoord.z, lit = 1. - exp(-dn.r * .05 * 7. / w);
  float pool = exp(-lat * lat / (w * w)) + .3 * exp(-lat * lat / (w * w * 7.));
  vec3 c = uGroundCol * uGroundGain * lit * pool * (1. + .9 * dn.g) * airPass(vWp);
  gl_FragColor = vec4(c, 1.);
}`;
const RIBBON_VERT = /* glsl */`
attribute vec4 aCoord;        // 沿路几成、第几条路、光铺开的宽、离中线多远
varying vec4 vCoord; varying vec3 vWp;
void main() { vCoord = aCoord; vWp = (modelMatrix * vec4(position, 1.)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vWp, 1.); }`;

const PUFF_VERT = /* glsl */`
#include <common>
${COMMON}
${AIR_PASS}
uniform sampler2D uDens;
uniform vec3 uGroundCol;
uniform float uGroundGain;
attribute vec4 aPuff;         // 沿路几成、第几条路、大小、随机数
varying vec2 vP; varying vec3 vCol;
void main() {
  vec4 dn = texture2D(uDens, vec2(aPuff.x, (aPuff.y + .5) / ${ROWS.toFixed(1)}));
  float lit = 1. - exp(-dn.r * .07), size = aPuff.z * (1. + .5 * lit);
  vec4 mv = viewMatrix * vec4(instanceMatrix[3].xyz + vec3(0., size * .45, 0.), 1.);
  mv.xy += position.xy * size;
  vP = position.xy;
  vCol = uGroundCol * uGroundGain * lit * (1. + .7 * dn.g) * .16 * airPass(instanceMatrix[3].xyz) * smoothstep(size * .6, size * 2.5, -mv.z) * (.7 + .3 * sin(uTime * .8 + aPuff.w * 30.));
  gl_Position = projectionMatrix * mv;
}`;
const PUFF_FRAG = /* glsl */`
varying vec2 vP; varying vec3 vCol;
void main() { float r2 = dot(vP, vP); gl_FragColor = vec4(vCol * exp(-r2 * 3.2) * (1. - smoothstep(.75, 1., r2)), 1.); }`;

const shared = new WeakMap();
function prepare(wild, routes) {
  if (shared.has(wild)) return shared.get(wild);
  const uniforms = { ...U, uDens: { value: null }, uGroundCol: { value: new THREE.Color() }, uGroundGain: { value: 1 } };
  // 贴地的网格：每条路一条带子，顶点贴着地面（湖上贴着水面）抬起一点
  const pos = [], coord = [], index = [];
  routes.rows.forEach((row, r) => {
    const segs = r === 0 ? 1100 : 180, base = pos.length / 3, fan = r > routes.tribs.length;
    for (let i = 0; i <= segs; i++) {
      const k = i / segs, d = k * row.len, c = routes.pointAt(r, d), ahead = routes.pointAt(r, Math.min(row.len, d + 1)), back = routes.pointAt(r, Math.max(0, d - 1));
      const dx = ahead.x - back.x, dz = ahead.z - back.z, h = Math.hypot(dx, dz) || 1, rx = -dz / h, rz = dx / h, half = routes.halfAt(r, d);
      const reach = (fan ? half * 1.6 + 20 : 30), pool = fan ? Math.max(7, half * .75) : 7;
      for (const l of LAT) {
        const x = c.x + rx * l * reach, z = c.z + rz * l * reach;
        const ground = wild.heightAt(x, z);
        pos.push(x, Math.max(1.8, ground + .45), z);                 // 湖面有浪，贴在水面上方高一点，不被浪头切成一道道
        coord.push(k, r, pool, l * reach);
      }
      if (i < segs) for (let j = 0; j + 1 < LAT.length; j++) {
        const a = base + i * LAT.length + j, b = a + LAT.length;
        index.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('aCoord', new THREE.Float32BufferAttribute(coord, 4)); geo.setIndex(index);
  const ribbonMat = new THREE.ShaderMaterial({ vertexShader: RIBBON_VERT, fragmentShader: RIBBON_FRAG, uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4, side: THREE.DoubleSide });
  // 雾团：沿每条路每隔十来个单位一团，浮在路的上空
  const spots = [];
  routes.rows.forEach((row, r) => { for (let d = 4; d < row.len; d += 9 + 6 * rnd(spots.length * 1.7)) spots.push([r, d]); });
  const puffGeo = new THREE.PlaneGeometry(2, 2), puffMat = new THREE.ShaderMaterial({ vertexShader: PUFF_VERT, fragmentShader: PUFF_FRAG, uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const puffAttr = new Float32Array(spots.length * 4), m4 = new THREE.Matrix4();
  const puffs = { geo: puffGeo, mat: puffMat, matrices: spots.map(([r, d], i) => {
    const c = routes.pointAt(r, d), side = (rnd(i * 3.3) - .5) * 14;
    puffAttr.set([d / routes.rows[r].len, r, 11 + 9 * rnd(i * 5.7), rnd(i * 9.1)], i * 4);
    return m4.clone().makeTranslation(c.x + side, c.y + 3 + 6 * rnd(i * 2.2), c.z + side * .6);
  }) };
  puffGeo.setAttribute('aPuff', new THREE.InstancedBufferAttribute(puffAttr, 4));
  const it = { uniforms, geo, ribbonMat, puffs };
  shared.set(wild, it);
  return it;
}

// 一段表演用的那层光：frame(densTex, look, { gain }) 每帧调（look 是 vista-lights.js 的 LOOK 里那一季；gain 整体再乘多少，0 就不画）
export function vistaGlow(kit, group, routes) {
  const { uniforms: u, geo, ribbonMat, puffs } = prepare(kit.wild, routes);
  const ribbon = new THREE.Mesh(geo, ribbonMat); ribbon.frustumCulled = false; ribbon.renderOrder = 16;
  const cloud = new THREE.InstancedMesh(puffs.geo, puffs.mat, puffs.matrices.length); cloud.frustumCulled = false; cloud.renderOrder = 17;
  puffs.matrices.forEach((m, i) => cloud.setMatrixAt(i, m));
  group.add(ribbon, cloud);
  return {
    frame(densTex, look, { gain = 1 } = {}) {
      u.uDens.value = densTex; u.uGroundCol.value.setRGB(...look.ground); u.uGroundGain.value = look.groundGain * gain;
      ribbon.visible = cloud.visible = gain > 0;
    },
  };
}
