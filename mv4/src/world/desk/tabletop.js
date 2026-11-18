// 案面：一张攒边装板的老书案。四根边框斜接成一圈，中间嵌三块面板；边沿是冰盘沿线脚，下面束腰、牙条、四条方腿。
// 案面以下在暗处，只做出轮廓；地面是一片深色的方砖。
import * as THREE from 'three';
import { DESK } from '../layout.js';
import { woodMaterial, GRAIN, RAIL, EDGE } from './wood.js';
import { sweepRect, whiten } from './geo.js';
import { canvas2d, stream, tex, std } from './kit.js';

const T = DESK.top;

// 台面：七块板拼在同一个平面上。边框的木纹顺着各自的长边，面板的木纹顺着案子的长向；每块板取木纹贴图上不同的一段
function topGeometry() {
  const x0 = DESK.x0 + EDGE, x1 = DESK.x1 - EDGE, z0 = DESK.z0 + EDGE, z1 = DESK.z1 - EDGE, F = RAIL, plank = (z1 - z0 - 2 * F) / 3, rand = stream(71), pos = [], uv = [], index = [];
  const board = (corners, alongX) => {
    const base = pos.length / 3, ou = rand(), ov = rand();
    for (const [x, z] of corners) { pos.push(x, T, z); uv.push((alongX ? x : z) / GRAIN + ou, (alongX ? z : x) / GRAIN + ov); }
    index.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  board([[x0 + F, z1 - F], [x0, z1], [x1, z1], [x1 - F, z1 - F]], true);
  board([[x0, z0], [x0 + F, z0 + F], [x1 - F, z0 + F], [x1, z0]], true);
  board([[x0, z0], [x0, z1], [x0 + F, z1 - F], [x0 + F, z0 + F]], false);
  board([[x1 - F, z0 + F], [x1 - F, z1 - F], [x1, z1], [x1, z0]], false);
  for (let k = 0; k < 3; k++) board([[x0 + F, z0 + F + plank * k], [x0 + F, z0 + F + plank * (k + 1)], [x1 - F, z0 + F + plank * (k + 1)], [x1 - F, z0 + F + plank * k]], true);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(index);
  geo.computeVertexNormals();
  return whiten(geo);
}

// 边沿的截面，从台面往下：倒圆 → 立面 → 一道凹线 → 向里收的冰盘沿 → 一道凸线 → 束腰 → 牙条（底边起一道线）→ 底面
// 每个点的第三个数是明暗：倒圆的棱和凸线常年被摸，磨得发亮；凹线和束腰里发暗
function edgeProfile() {
  const p = [];
  for (let i = 0; i <= 8; i++) { const a = i / 8 * Math.PI / 2; p.push([-EDGE + EDGE * Math.sin(a), T - EDGE * (1 - Math.cos(a)), 1 + .9 * Math.sin(a * 2) ** 2]); }
  p.push([0, T - 1.3, 1], [-.1, T - 1.38, .45], [-.1, T - 1.5, .45], [0, T - 1.58, 1.25]);
  for (let i = 1; i <= 8; i++) { const k = i / 8; p.push([-.95 * k * k * (3 - 2 * k), T - 1.58 - 1.5 * k, 1.1 - .45 * k]); }
  p.push([-.95, T - 3.2, .55], [-.78, T - 3.3, 1.5], [-.78, T - 3.5, 1.5], [-.95, T - 3.6, .5], [-1.55, T - 3.66, .4], [-1.55, T - DESK.thick, .4]);
  p.push([-1.15, T - DESK.thick - .08, .9], [-1.15, T - 7.1, .8], [-1, T - 7.25, 1.3], [-1, T - 7.5, 1.3], [-1.2, T - 7.62, .5], [-2.4, T - 7.62, .4]);
  return p;
}

// 案腿：方料，木纹顺着腿走
function leg(x, z, size, top, bottom) {
  const geo = new THREE.BoxGeometry(size, top - bottom, size), n = geo.attributes.normal, p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getY(i) / GRAIN + x * .13, (Math.abs(n.getX(i)) > .5 ? p.getZ(i) : p.getX(i)) / GRAIN + z * .07);
  geo.translate(x, (top + bottom) / 2, z);
  return whiten(geo);
}

// 地面：深色方砖，砖缝更深，每块砖深浅不同
function floorMesh() {
  const S = 512, [c, g] = canvas2d(S, S), rand = stream(73);
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
    const v = 22 + 9 * rand();
    g.fillStyle = `rgb(${v},${v * .92},${v * 1.3})`; g.fillRect(i * S / 4, j * S / 4, S / 4, S / 4);
  }
  g.strokeStyle = 'rgba(10,9,20,.6)'; g.lineWidth = 3;
  for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * S / 4, 0); g.lineTo(i * S / 4, S); g.moveTo(0, i * S / 4); g.lineTo(S, i * S / 4); g.stroke(); }
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(520, 360), std('#ffffff', { map: tex(c, { srgb: true, repeat: [520 / 140, 360 / 140] }), roughness: .92 }));
  mesh.rotation.x = -Math.PI / 2; mesh.position.set(0, DESK.floor + .06, -20);   // 比 DESK.floor 高一线：背景模块在同一高度也铺了一片素色的地，两片重合会闪
  return mesh;
}

export function buildTabletop() {
  const group = new THREE.Group(), wood = woodMaterial();
  const top = new THREE.Mesh(topGeometry(), wood), edge = new THREE.Mesh(sweepRect(edgeProfile(), DESK.x0, DESK.x1, DESK.z0, DESK.z1, GRAIN), wood);
  top.receiveShadow = edge.receiveShadow = true;
  group.add(top, edge, floorMesh());
  const size = 3.8, inset = 1.05 + size / 2;                       // 腿比牙条略微凸出一点
  for (const x of [DESK.x0 + inset, DESK.x1 - inset]) for (const z of [DESK.z0 + inset, DESK.z1 - inset]) group.add(new THREE.Mesh(leg(x, z, size, T - DESK.thick, DESK.floor), wood));
  return group;
}
