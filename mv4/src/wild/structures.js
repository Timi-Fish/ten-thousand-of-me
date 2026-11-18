// 建筑：山顶的六角亭（pavilion.js）、半山腰的小屋（hut.js，冬夜窗里亮着灯）、溪上的石拱桥（bridge.js）。
// 这里定它们的位置和地基，把造好的形状摆进场景。
import * as THREE from 'three';
import { PEAK_Y } from './land.js';
import { builtMaterial } from './kit.js';
import { shadowed } from './paint.js';
import { stoneMaterial } from './stone.js';
import { pavilionGeometry } from './pavilion.js';
import { hutGeometry } from './hut.js';
import { buildBridge } from './bridge.js';
import { railMaterial } from './railing.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// 在动工之前先定下各建筑的位置和地基（地形要按地基削平）
export function planStructures(road) {
  const s = road.locate(-50, 432).s, at = road.at0(s, V()), right = road.right(s, V());
  const hut = { x: at.x - right.x * 15.5, z: at.z - right.z * 15.5, y: at.y + .35, yaw: Math.atan2(right.x, right.z) };       // 小屋在路的上山一侧，门朝着路
  // 不种树的几块空地：峰顶亭子四周（亭子要立在天光里，不埋在树后面）、山门、歇脚的平台
  const gate = road.at0(road.marks.gate, V()), terrace = road.section('terrace'), rest = road.at0((terrace.from + terrace.to) / 2, V()).addScaledVector(road.right((terrace.from + terrace.to) / 2, V()), 12);
  const clearings = [{ x: 0, z: 6, r: 30 }, { x: gate.x, z: gate.z, r: 19 }, { x: rest.x, z: rest.z, r: 21 }];
  return { hut, pavilion: { x: 0, y: PEAK_Y - .45, z: 0 }, pads: [{ x: 0, z: 0, r: 13, y: PEAK_Y - .45, blend: 8 }, { x: hut.x, z: hut.z, r: 10.5, y: hut.y, blend: 9 }], clearings };
}

// spots：能亮的灯火的位置（小屋檐下的灯笼）
export function buildStructures(plan, road) {
  const group = new THREE.Group(), mat = builtMaterial(), spots = [];
  const put = (geo, x, y, z, yaw) => { const m = shadowed(new THREE.Mesh(geo, mat)); m.position.set(x, y, z); m.rotation.y = yaw; m.updateMatrixWorld(); group.add(m); return m; };
  put(pavilionGeometry(), plan.pavilion.x, plan.pavilion.y, plan.pavilion.z, 0);
  const cottage = hutGeometry(), house = put(cottage.geometry, plan.hut.x, plan.hut.y, plan.hut.z, plan.hut.yaw);
  spots.push(cottage.lamp.clone().applyMatrix4(house.matrixWorld));
  const bridge = buildBridge(road);
  group.add(shadowed(new THREE.Mesh(bridge.rail, railMaterial(bridge.panelHalf))));
  for (const mesh of bridge.stones.meshes(stoneMaterial())) group.add(shadowed(mesh));
  return { group, spots };
}
