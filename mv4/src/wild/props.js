// 路边人留下的东西：石灯、路碑、歇脚的石凳、险处的栏杆（rails.js）、墙脚散落的碎石，以及灯火周围那一小团暖光。
//   石灯、路碑、石凳都立在一截从基座里探出来的石墩上（地势往外落的一侧，石墩露着；高的一侧，它埋在路肩里），不会悬在坡上。
//   石灯每隔三十来个单位一盏：墩、两层座、带节的竿、中台、四柱的灯室（窗纸夜里透暖光）、起翘的笠顶、宝珠。
//   半山以下左右交替；登山道上靠山的一侧是石壁，都摆在地势低的那一侧。都按里程排（road.miles）。
import * as THREE from 'three';
import { rnd } from '../anim.js';
import { Kit, MAT, V, place, builtMaterial } from './kit.js';
import { COMMON, U, shadowed } from './paint.js';
import { roadside, tracer, WALL_AT } from './roadside.js';
import { rockGeometry } from './pavilion.js';
import { railRuns, railGeometry } from './rails.js';

const STONE = '#ABA699', STONE_DK = '#8E897E', STONE_LT = '#BCB7AA', PAPER = '#FFC878', CARVED = '#B03A2A';
const LANTERN_GAP = 30, PIER = 3.4;
export const LIGHT_Y = 1.62;                                         // 灯心比石墩面高多少
const lathe = (profile, segments) => new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segments);
// 石墩：顶面在原点，往下 PIER 深
const pier = (kit, w, d) => kit.use(MAT.stone).box(w, PIER, d, STONE_DK, place(0, -PIER / 2, 0)).box(w + .14, .12, d + .14, STONE, place(0, 0, 0));

export function lanternGeometry() {
  const kit = pier(new Kit(), .95, .95);
  kit.box(.8, .2, .8, STONE, place(0, .16, 0)).box(.6, .14, .6, STONE_LT, place(0, .33, 0));
  kit.add(new THREE.CylinderGeometry(.17, .21, .8, 6), STONE, place(0, .8, 0)).add(new THREE.CylinderGeometry(.25, .25, .09, 6), STONE_LT, place(0, .8, 0));
  kit.add(new THREE.CylinderGeometry(.52, .3, .17, 6), STONE_LT, place(0, 1.28, 0));
  for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) kit.box(.1, .5, .1, STONE, place(x * .26, LIGHT_Y, z * .26));
  for (let k = 0; k < 4; k++) kit.box(.5, .05, .04, STONE_DK, place(Math.sin(k * Math.PI / 2) * .27, LIGHT_Y, Math.cos(k * Math.PI / 2) * .27, k * Math.PI / 2));   // 灯室四面的窗棂
  kit.use(MAT.paper).box(.42, .46, .42, PAPER, place(0, LIGHT_Y, 0), 1.5);
  kit.use(MAT.stone).add(lathe([[0, .5], [.14, .42], [.46, .14], [.76, .03], [.84, .1], [.78, 0], [0, 0]], 6), STONE_DK, place(0, LIGHT_Y + .25, 0, Math.PI / 6));
  kit.add(lathe([[0, 0], [.1, 0], [.16, .1], [.1, .22], [.03, .3], [0, .31]], 8), STONE_DK, place(0, LIGHT_Y + .74, 0));
  return kit.geometry();
}

// 路碑：座上立一块圆首的碑，碑面凹进去一条，刻着描红的字
export function steleGeometry() {
  const kit = pier(new Kit(), 1.2, .95);
  kit.box(1.05, .3, .62, STONE, place(0, .2, 0)).box(.64, 1.2, .17, STONE_LT, place(0, .95, 0)).add(new THREE.CylinderGeometry(.32, .32, .17, 14, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2), STONE_LT, place(0, 1.55, 0));
  kit.box(.34, 1, .02, STONE_DK, place(0, 1, .085));
  kit.use(MAT.paper);
  for (let k = 0; k < 4; k++) kit.box(.2, .17, .02, CARVED, place(0, 1.36 - k * .24, .095)).box(.07, .2, .025, STONE_DK, place((k % 2 - .5) * .1, 1.36 - k * .24, .1));
  return kit.geometry();
}

// 石凳：一方探出去的石台上，两只石脚托着一块长石板
function benchGeometry() {
  const kit = pier(new Kit(), 2.6, 1.15);
  kit.box(2.1, .15, .52, STONE_LT, place(0, .55, .05));
  for (const x of [-.72, .72]) kit.box(.3, .44, .44, STONE, place(x, .27, .05));
  return kit.geometry();
}

const GLOW_VERT = /* glsl */`
attribute vec4 aSpot;       // 灯火的位置和这团光的大小
varying vec2 vUv; varying vec3 vWp;
void main() {
  vUv = position.xy; vWp = aSpot.xyz;
  vec4 mv = viewMatrix * vec4(aSpot.xyz, 1.);
  mv.xy += position.xy * aSpot.w;
  gl_Position = projectionMatrix * mv;
}`;
const GLOW_FRAG = /* glsl */`
#include <common>
${COMMON}
varying vec2 vUv; varying vec3 vWp;
void main() {
  float r = length(vUv), halo = exp(-r * r * 6.) * .22 + exp(-r * r * 45.) * .6;
  float flicker = .9 + .1 * sin(uTime * 7. + vWp.x * 3.) * sin(uTime * 4.3 + vWp.z * 2.);
  float veil = exp(-uFogP.x * 3. * distance(vWp, cameraPosition));
  gl_FragColor = vec4(vec3(1., .62, .26) * halo * uLamp * flicker * veil * smoothstep(1., .7, r), 1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function buildProps(road, groundAt, extraSpots) {
  const group = new THREE.Group(), mat = builtMaterial(), T = tracer(road), side = roadside(road), tangent = new THREE.Vector3(), spots = [], out = new THREE.Vector3();
  // 石墩上的东西：在弧长 s、哪一侧，墩面和路缘石齐平，正面朝着路
  const stand = (s, sign, off) => {
    const at = T.point(s, sign * (WALL_AT + off), T.curb(s) - .06), yaw = Math.atan2(road.tangent(s, tangent).x, tangent.z) + sign * Math.PI / 2;
    return { at, matrix: place(at.x, at.y, at.z, yaw) };
  };
  const set = (geometry, stands) => { const mesh = shadowed(new THREE.InstancedMesh(geometry, mat, stands.length)); stands.forEach((st, i) => mesh.setMatrixAt(i, st.matrix)); mesh.computeBoundingSphere(); group.add(mesh); };
  // 摆在哪一侧：半山以下按排好的（prefer）；登山道上靠山的一侧是石壁，摆在地势低的那一侧，两侧差不多（山脊、平台）才按排好的
  const low = (s, sign) => groundAt(T.point(s, sign * 7, 0, out).x, out.z);
  const sideAt = (s, prefer) => { const gap = low(s, -1) - low(s, 1); return s >= road.upper || Math.abs(gap) < 2 ? prefer : gap < 0 ? -1 : 1; };
  // 山门跟前、歇脚的平台上不摆（那里另有大石灯和碑，wayside.js）
  const free = (s, margin) => T.offBridge(s, margin) && Math.abs(s - road.marks.gate) > 9 && road.sectionAt(s) !== 'terrace';
  const lamps = [], steles = [], benches = [];
  for (const { s, k } of road.miles(14, LANTERN_GAP, 6, road.length - 4)) if (free(s, 6)) lamps.push(stand(s, sideAt(s, k % 2 ? 1 : -1), .5));
  for (const { s } of road.miles(59, 150, 6, road.length - 4)) if (free(s, 8)) steles.push(stand(s, sideAt(s, 1), .5));
  for (const { s } of road.miles(119, 150, 6, road.length - 4)) if (free(s, 8)) benches.push(stand(s, sideAt(s, -1), .6));
  set(lanternGeometry(), lamps); set(steleGeometry(), steles); set(benchGeometry(), benches);
  lamps.forEach(({ at }) => spots.push(at.clone().setY(at.y + LIGHT_Y)));
  group.add(shadowed(new THREE.Mesh(railGeometry(railRuns(road, T, groundAt)), mat)));

  // 墙脚的碎石：贴着基座的墙根、护坡的墙根，三三两两大小不一，半埋在土里
  const rocks = [], e = {}, m = new THREE.Matrix4();
  for (let s = 1, k = 0; s < road.length - 1; s += .9 + 1.4 * rnd(k * 3.3), k++) {
    const q = k % 2, sign = q ? 1 : -1, { bank } = side.edge(s, q, e), off = (bank > 0 && rnd(k * 5.1) < .5 ? 4.75 : WALL_AT + .3) + .5 * rnd(k * 7.7), p = T.point(s, sign * off, 0), size = .1 + .28 * rnd(k * 9.3) ** 2;
    if (!T.offBridge(s, 5)) continue;
    rocks.push(m.compose(p.setY(groundAt(p.x, p.z) + size * .15), new THREE.Quaternion().setFromEuler(new THREE.Euler(k * 1.3, k * 2.9, k * .7)), V(size * 1.3, size * .8, size)).clone());
  }
  const scree = shadowed(new THREE.InstancedMesh(new Kit().add(rockGeometry(2.6, 7, 5), '#9C988C').geometry(), mat, rocks.length), false, true);
  rocks.forEach((matrix, i) => scree.setMatrixAt(i, matrix));
  scree.computeBoundingSphere();
  group.add(scree);

  // 灯火的光晕：每处灯火一张朝着镜头的小片，叠加上去
  const all = [...spots, ...extraSpots], quad = new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry(2, 2)), data = new Float32Array(all.length * 4);
  all.forEach((v, i) => data.set([v.x, v.y, v.z, i < spots.length ? 1.7 : 3.6], i * 4));
  quad.setAttribute('aSpot', new THREE.InstancedBufferAttribute(data, 4)); quad.instanceCount = all.length;
  const halo = new THREE.Mesh(quad, new THREE.ShaderMaterial({ vertexShader: GLOW_VERT, fragmentShader: GLOW_FRAG, uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.frustumCulled = false; halo.renderOrder = 30;
  group.add(halo);
  return { group, spots: all };
}
