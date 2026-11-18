// 大远景的布景（入口）：谷里的人烟、山上流下来的溪和瀑布、湖边的芦苇、一层层的薄雾。从山上往下看时山里有东西可看。
//   摆在哪——scenerysites.js；房子——sceneryhouse.js；塔、寺、牌坊、桥、码头和船——scenerylandmarks.js；溪和瀑布、芦苇——scenerywater.js；雾——scenerymist.js。
// 房子按地块（TILE 见方）分组实例化，每块按镜头离它多远换精细度（sceneryhouse.js 的三档），镜头外的块整块不画。
// 夜里：窗纸、塔的券门、石灯亮着（材质跟 uLamp 走）；每个村子上空一团暖光映在雾里，村子四周的地面（雪）由地形的着色器按 VILLAGE_LIGHTS 染暖。
import * as THREE from 'three';
import { builtMaterial } from './kit.js';
import { COMMON, U, shadowed, VILLAGE_LIGHTS } from './paint.js';
import { pavilionGeometry } from './pavilion.js';
import { lanternGeometry } from './props.js';
import { buildHouseShapes, yardGeometry, LODS } from './sceneryhouse.js';
import { pagodaGeometry, hallGeometry, templeWall, paifangGeometry, archBridgeGeometry, pierGeometry, boatGeometry } from './scenerylandmarks.js';
import { planSites, villageWarmth } from './scenerysites.js';
import { exitRoadMesh } from './sceneryexit.js';
import { buildPeak } from './scenerypeak.js';
import { buildStreamWater } from './scenerywater.js';
import { buildMist } from './scenerymist.js';

const TILE = 240, NEAR_LOD = 320, MID_LOD = 1050;                    // 地块多大；离镜头多近用精细档、中档

const GLOW_VERT = /* glsl */`
attribute vec4 aSpot;       // 光的位置、这团光多大
attribute float aPower;     // 多亮
varying vec2 vUv; varying vec3 vWp; varying float vPower;
void main() {
  vUv = position.xy; vWp = aSpot.xyz; vPower = aPower;
  vec4 mv = viewMatrix * vec4(aSpot.xyz, 1.);
  mv.xy += position.xy * aSpot.w;
  gl_Position = projectionMatrix * mv;
}`;
const GLOW_FRAG = /* glsl */`
#include <common>
${COMMON}
varying vec2 vUv; varying vec3 vWp; varying float vPower;
void main() {
  bool pool = vPower > 1.5;                                                   // 村子上空映在雾里的那一大团：只有外晕
  float r = length(vUv), halo = exp(-r * r * 5.) * .3 + (pool ? 0. : exp(-r * r * 40.) * .7), power = pool ? vPower - 1.5 : vPower;
  float veil = exp(-uFogP.x * 2.2 * distance(vWp, cameraPosition));
  float flicker = .92 + .08 * sin(uTime * 6.1 + vWp.x * 2.7) * sin(uTime * 3.9 + vWp.z * 1.9);
  gl_FragColor = vec4(vec3(1., .64, .3) * halo * uLamp * veil * flicker * power * smoothstep(1., .6, r), 1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
// 一组朝着镜头的光晕：spots 每项 [x, y, z, 大小, 亮度]；亮度大于 1.5 的是一大团只有外晕的暖光（村子上空映在雾里的），亮度按 power - 1.5 算
function glows(spots) {
  const quad = new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry(2, 2)), at = new Float32Array(spots.length * 4), power = new Float32Array(spots.length);
  spots.forEach(([x, y, z, size, p], i) => { at.set([x, y, z, size], i * 4); power[i] = p; });
  quad.setAttribute('aSpot', new THREE.InstancedBufferAttribute(at, 4)); quad.setAttribute('aPower', new THREE.InstancedBufferAttribute(power, 1)); quad.instanceCount = spots.length;
  const mesh = new THREE.Mesh(quad, new THREE.ShaderMaterial({ vertexShader: GLOW_VERT, fragmentShader: GLOW_FRAG, uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  mesh.frustumCulled = false; mesh.renderOrder = 30;
  return mesh;
}

// plan：建筑的位置（主峰的亭子）；lampSpots：props.js 那些石灯灯心的位置
export function buildScenery(road, terrain, relief, shots, plan, lampSpots) {
  const group = new THREE.Group(), mat = builtMaterial(), { shapes, sizes } = buildHouseShapes(), sites = planSites(road, terrain, relief, shots, sizes);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
  const matrixOf = (x, y, z, yaw, s = 1) => m.compose(p.set(x, y, z), q.setFromAxisAngle(up, yaw), one.set(s, s, s)).clone();
  // 一组同形的东西实例化成一个网格
  const instanced = (geo, matrices, cast = true) => { const mesh = shadowed(new THREE.InstancedMesh(geo, mat, matrices.length), cast, true); matrices.forEach((mx, i) => mesh.setMatrixAt(i, mx)); mesh.computeBoundingSphere(); return mesh; };

  // 房子和院墙：按地块、样子、版本分组，每组三档各一个网格，渲染前按镜头远近只留一档
  const tiles = new Map();
  const tileOf = (x, z) => { const key = `${Math.floor(x / TILE)},${Math.floor(z / TILE)}`; if (!tiles.has(key)) tiles.set(key, { center: new THREE.Vector3((Math.floor(x / TILE) + .5) * TILE, 0, (Math.floor(z / TILE) + .5) * TILE), sets: new Map(), lods: { near: [], mid: [], far: [] } }); return tiles.get(key); };
  for (const h of sites.houses) { const t = tileOf(h.x, h.z), key = `h|${h.style}|${h.variant}`; if (!t.sets.has(key)) t.sets.set(key, []); t.sets.get(key).push(matrixOf(h.x, h.y, h.z, h.yaw)); }
  const yardShapes = new Map();
  for (const y of sites.yards) { const t = tileOf(y.x, y.z), key = `y|${Math.round(y.w)}`; if (!t.sets.has(key)) t.sets.set(key, []); t.sets.get(key).push(matrixOf(y.x, y.y, y.z, y.yaw)); }
  for (const t of tiles.values()) {
    for (const [key, list] of t.sets) {
      const [kind, a, b] = key.split('|');
      for (const lod of LODS) {
        let geo;
        if (kind === 'h') geo = shapes[a][lod][+b];
        else { const k = `${a}|${lod}`; if (!yardShapes.has(k)) yardShapes.set(k, yardGeometry(+a, 7, lod)); geo = yardShapes.get(k); }
        const mesh = instanced(geo, list, lod === 'near');
        t.lods[lod].push(mesh); group.add(mesh);
      }
    }
    t.center.y = Math.max(...[...t.sets.values()].flat().map(mx => mx.elements[13]));
  }

  // 地标
  const add = mesh => { group.add(mesh); return mesh; };
  const one_ = (geo, x, y, z, yaw) => add(instanced(geo, [matrixOf(x, y, z, yaw)]));
  { const { x, y, z, yaw } = sites.pagoda; one_(pagodaGeometry(), x, y, z, yaw); }
  {
    const { x, y, z, yaw } = sites.temple, c = Math.cos(yaw), s = Math.sin(yaw), at = (a, b) => [x + a * c + b * s, z - a * s + b * c];
    const [hx, hz] = at(0, -4), [gx, gz] = at(0, 15);
    one_(hallGeometry(15, 10, 6), hx, terrain.groundAt(hx, hz) - .4, hz, yaw);
    one_(hallGeometry(8, 5.5, 4.2, true), gx, terrain.groundAt(gx, gz) - .4, gz, yaw);
    one_(templeWall(34, 34, 9), x, y - .3, z, yaw);
  }
  add(instanced(paifangGeometry(), sites.paifangs.map(f => matrixOf(f.x, f.y, f.z, f.yaw, f.scale))));
  if (sites.pavilions.length) add(instanced(pavilionGeometry(), sites.pavilions.map(f => matrixOf(f.x, f.y, f.z, f.yaw, .72))));
  if (sites.bridges.length) add(instanced(archBridgeGeometry(9, 3.4), sites.bridges.map(b => matrixOf(b.x, b.y, b.z, b.yaw))));
  for (const pier of sites.piers) one_(pierGeometry(pier.len), pier.x, -.1, pier.z, pier.yaw);
  if (sites.boats.length) add(instanced(boatGeometry(), sites.boats.map(b => matrixOf(b.x, -.15, b.z, b.yaw)), false));
  if (sites.lamps.length) add(instanced(lanternGeometry(), sites.lamps.map(l => matrixOf(l.x, l.y, l.z, l.yaw))));
  // 古道：石板路面，路边的石灯（比山路上的大一号，远看才成一串）
  add(exitRoadMesh(relief.exit, terrain.groundAt));
  add(instanced(lanternGeometry(), sites.exitLamps.map(l => matrixOf(l.x, l.y, l.z, l.yaw, 1.5))));

  // 夜里的光：路边添的石灯各一小团；古道边的石灯；塔的每层券门；每个村子上空一大团映在雾里的暖光；每户窗前一小点
  const LIGHT_Y = 1.62, spots = [];
  for (const l of sites.lamps) spots.push([l.x, l.y + LIGHT_Y, l.z, 1.7, 1]);
  for (const l of sites.exitLamps) spots.push([l.x, l.y + LIGHT_Y * 1.5, l.z, 3, 1]);
  for (const h of sites.houses) spots.push([h.x + Math.sin(h.yaw) * (h.d / 2 + .6), h.y + 2.6, h.z + Math.cos(h.yaw) * (h.d / 2 + .6), 3.2, .6]);
  for (const v of sites.villages) spots.push([v.x, v.y + 10, v.z, v.reach * 1.5, 1.5 + .22 * villageWarmth(v.x, v.z) * Math.min(1, v.houses / 6)]);
  { const { x, y, z } = sites.pagoda; for (let k = 0; k < 4; k++) spots.push([x, y + 5 + k * 4.2, z, 4, .5]); }
  group.add(glows(spots));
  // 村子的灯光照在四周的地上（地形的着色器读 U.uVillages）
  // 主峰顶上的岩角、石笋、冰凌、崖沿的松（交给种树的人）、亭的灯笼，山脊石灯远看的柔光
  const roadLamps = sites.lamps.map(l => new THREE.Vector3(l.x, l.y + LIGHT_Y, l.z)), peak = buildPeak(road, terrain.groundAt, shots, plan, [...lampSpots, ...roadLamps]);
  sites.trees.push(...peak.trees);
  group.add(peak.group);
  // 地上的暖光：主峰的亭子和山脊的石灯在前，村子按户数排在后面
  const lights = [...peak.pools, ...sites.villages.slice().sort((a, b) => b.houses - a.houses).map(v => ({ x: v.x, z: v.z, reach: v.reach, power: villageWarmth(v.x, v.z) * Math.min(1, v.houses / 5) }))].slice(0, VILLAGE_LIGHTS);
  U.uVillages.value = Array.from({ length: VILLAGE_LIGHTS }, (_, i) => lights[i] ? new THREE.Vector4(lights[i].x, lights[i].z, lights[i].reach, lights[i].power) : new THREE.Vector4(0, 0, 1, 0));

  // 溪和瀑布、芦苇；雾
  const water = buildStreamWater(relief, terrain), mist = buildMist();
  group.add(water.group, mist.group);

  // 每次渲染前：房子按地块换精细度
  const lodOf = d => d < NEAR_LOD ? 'near' : d < MID_LOD ? 'mid' : 'far', tileList = [...tiles.values()];
  const choose = camera => {
    for (const t of tileList) {
      const pick = lodOf(camera.position.distanceTo(t.center));
      for (const lod of LODS) for (const mesh of t.lods[lod]) mesh.visible = lod === pick;
    }
  };
  // 给灯火用的位置：所有路边石灯（props.js 的和这里添的）以及每户的窗前
  const windows = sites.houses.map(h => new THREE.Vector3(h.x + Math.sin(h.yaw) * (h.d / 2 + .6), h.y + 2.6, h.z + Math.cos(h.yaw) * (h.d / 2 + .6)));
  return { group, sites, choose, roadLamps, windows, peak: { ...peak.count, lanterns: peak.lanterns.length, pools: peak.pools.length } };
}
