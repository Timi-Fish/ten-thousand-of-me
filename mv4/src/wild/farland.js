// 远山的网格：以湖北面那一点为圆心铺一张极坐标的网，从云海底下（RING_IN）一直铺到远处格网的边。
// 一圈切 SPOKES 份，向外按等比加宽（越远越疏，投到画面上的格子大小差不多），山脊线的大小几级起伏都立得住。
// 按方位切成 SECTORS 块，镜头外的块不画。每个顶点带 aCav（比周围高出多少：脊为正、沟为负），远山的着色靠它分出沟壑和山脊。
// 脊上高处零星站着几株松（国画远山上点的松），只是剪影，用不着细。
import * as THREE from 'three';
import { rnd } from '../anim.js';
import { landHeight, CLOUD_TOP } from './land.js';
import { smooth } from './noise.js';
import { paint, seasonal, shadowed } from './paint.js';
import { SEASONS } from './seasons.js';

export const RING = { x: 0, z: 500, inner: 900 };                     // 圆心、内圈半径（再往里是 terrain.js 里那张粗的远处格网）
const SPOKES = 1600, RINGS = 170, SECTORS = 64, SINK = 30;

// far：远处格网 { x0, z0, cell, nx, nz }；near：近处格网（压在它底下的点往下沉 SINK，整格都在底下的不画）
export function buildFarRing(far, near, material) {
  const x1 = far.x0 + (far.nx - 1) * far.cell, z1 = far.z0 + (far.nz - 1) * far.cell;
  const under = (x, z) => x >= near.x0 && z >= near.z0 && x <= near.x0 + (near.nx - 1) * near.cell && z <= near.z0 + (near.nz - 1) * near.cell;
  const W = SPOKES, R = RINGS + 1, P = new Float32Array(W * R * 3), sunk = new Uint8Array(W * R), H = new Float32Array(W * R);
  for (let i = 0; i < W; i++) {
    const a = i / W * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    // 这条射线到远处格网的边有多远
    const edge = Math.min(c > 0 ? (x1 - RING.x) / c : c < 0 ? (far.x0 - RING.x) / c : Infinity, s > 0 ? (z1 - RING.z) / s : s < 0 ? (far.z0 - RING.z) / s : Infinity);
    for (let j = 0; j < R; j++) {
      const r = RING.inner * (edge / RING.inner) ** (j / RINGS), x = RING.x + c * r, z = RING.z + s * r, v = j * W + i;
      H[v] = landHeight(x, z); sunk[v] = under(x, z) ? 1 : 0;
      P[v * 3] = x; P[v * 3 + 1] = H[v] - SINK * sunk[v]; P[v * 3 + 2] = z;
    }
  }
  const at = (i, j) => ((Math.min(R - 1, Math.max(0, j)) * W) + ((i + W) % W));
  // 法线：前后左右四个邻点；凹凸：比周围一圈（方位上 ±6 格、径向上 ±4 圈）的平均高多少
  const N = new Float32Array(W * R * 3), cav = new Float32Array(W * R), e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), q = new THREE.Vector3();
  for (let j = 0; j < R; j++) for (let i = 0; i < W; i++) {
    const v = at(i, j), a = at(i + 1, j), b = at(i - 1, j), c = at(i, j + 1), d = at(i, j - 1);
    e1.set(P[a * 3] - P[b * 3], H[a] - H[b], P[a * 3 + 2] - P[b * 3 + 2]); e2.set(P[c * 3] - P[d * 3], H[c] - H[d], P[c * 3 + 2] - P[d * 3 + 2]);
    q.crossVectors(e2, e1).normalize();
    if (q.y < 0) q.negate();
    N.set([q.x, q.y, q.z], v * 3);
    let sum = 0;
    for (let dj = -4; dj <= 4; dj += 2) for (let di = -6; di <= 6; di += 3) sum += H[at(i + di, j + dj)];
    cav[v] = Math.max(-1, Math.min(1, (H[v] - sum / 25) / 30));
  }

  const group = new THREE.Group(), per = W / SECTORS, crests = [];
  for (let k = 0; k < SECTORS; k++) {
    const i0 = k * per, cols = per + 1, pos = new Float32Array(cols * R * 3), nor = new Float32Array(pos.length), cv = new Float32Array(cols * R), idx = [];
    for (let j = 0; j < R; j++) for (let c = 0; c < cols; c++) {
      const v = at(i0 + c, j), o = j * cols + c;
      pos.set(P.subarray(v * 3, v * 3 + 3), o * 3); nor.set(N.subarray(v * 3, v * 3 + 3), o * 3); cv[o] = cav[v];
    }
    for (let j = 0; j < R - 1; j++) for (let c = 0; c < per; c++) {
      const a = j * cols + c, b = a + cols;
      if (sunk[at(i0 + c, j)] && sunk[at(i0 + c + 1, j)] && sunk[at(i0 + c, j + 1)] && sunk[at(i0 + c + 1, j + 1)]) continue;
      idx.push(a, a + 1, b, a + 1, b + 1, b);                                                     // 朝上的面是正面
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('aCav', new THREE.BufferAttribute(cv, 1));
    geo.setIndex(idx); geo.computeBoundingSphere();
    group.add(new THREE.Mesh(geo, material));
  }
  // 松：脊上、高出云海的地方，隔一段站一两株
  for (let j = 6; j < R - 4; j += 2) for (let i = 0; i < W; i += 2) {
    const v = at(i, j), seed = v * .618 + .37;
    if (sunk[v] || cav[v] < .18 || H[v] < CLOUD_TOP + 60 || N[v * 3 + 1] < .45 || rnd(seed) > .2 * smooth(.18, .5, cav[v])) continue;
    crests.push({ x: P[v * 3], y: H[v], z: P[v * 3 + 2], seed: rnd(seed * 3.1), sector: Math.floor(i / per / 8) });
  }
  group.add(...farPines(crests));
  return group;
}

// 远处的松：一根干，上面三四层平展的松针团（国画里点的松的样子）。按方位分 8 组，镜头外的组不画
function pineShape() {
  const parts = [new THREE.CylinderGeometry(.06, .1, 1, 5).translate(0, .5, 0)];
  [[.5, .12, .42], [.68, .14, .32], [.86, .12, .2]].forEach(([y, h, r], k) => parts.push(new THREE.CylinderGeometry(r * .7, r, h, 7).translate((k % 2 ? .08 : -.06), y, 0)));
  const pos = [], nor = [];
  for (const g of parts) { const n = g.toNonIndexed(); pos.push(...n.attributes.position.array); nor.push(...n.attributes.normal.array); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return geo;
}
let pineMat = null;
function farPines(crests) {
  pineMat ??= paint({
    uniforms: seasonal(SEASONS.春.u, 'uPineA', 'uTint'),
    fragmentPars: 'uniform vec3 uPineA, uTint;',
    fragment: /* glsl */`
      albedo = mix(uPineA, uTint * .5, .35) * .8;
      albedo = mix(albedo, vec3(.88, .92, 1.), uSnow * smoothstep(.2, .7, N.y));`,
  });
  const geo = pineShape(), m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  return Array.from({ length: 8 }, (_, g) => crests.filter(c => c.sector === g)).filter(list => list.length).map(list => {
    const mesh = new THREE.InstancedMesh(geo, pineMat, list.length);
    list.forEach((c, i) => { const size = 8 + 10 * c.seed; mesh.setMatrixAt(i, m.compose(p.set(c.x, c.y - 1, c.z), q.setFromAxisAngle(up, c.seed * 40), s.set(size * (1.1 + .4 * c.seed), size, size * (1 + .3 * c.seed)))); });
    mesh.computeBoundingSphere();
    return shadowed(mesh, false, false);
  });
}
