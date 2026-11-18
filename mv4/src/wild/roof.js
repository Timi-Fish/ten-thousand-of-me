// 瓦屋面：亭和屋共用。屋面是一张曲面 surf(u, v)（u 沿檐口 -1 到 1，v 从屋脊 0 到檐口 1），
// 铺上瓦面、望板（底面）、檐口的厚度、一道道瓦垄和垄头的瓦当；底下可以再架一排椽子。
import * as THREE from 'three';
import { MAT, V } from './kit.js';

const UP = V(0, 1, 0), DOWN = V(0, -1, 0);
const TILE = '#5C7880', TILE_LT = '#6C888E', TILE_DK = '#4C6872', EDGE = '#3E4A50', BOARD = '#7A5238', RAFTER = '#5A3226';

// ribs：瓦垄的道数；out(u)：檐口那一段朝外的方向
export function roofSlope(kit, surf, nu, nv, ribs, out) {
  const drop = V(0, -.26, 0);
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    const u0 = -1 + 2 * i / nu, u1 = -1 + 2 * (i + 1) / nu, v0 = j / nv, v1 = (j + 1) / nv, a = surf(u0, v0), b = surf(u0, v1), c = surf(u1, v1), d = surf(u1, v0);
    kit.use(MAT.tile).face(a, b, c, d, TILE, UP);
    kit.use(MAT.wood).face(a.clone().add(drop), b.clone().add(drop), c.clone().add(drop), d.clone().add(drop), BOARD, DOWN);
    if (j === nv - 1) kit.use(MAT.tile).face(b, c, c.clone().add(drop), b.clone().add(drop), EDGE, out(u0));
  }
  kit.use(MAT.tile);
  for (let r = 0; r < ribs; r++) {
    const u = -1 + 2 * (r + .5) / ribs, w = .3 / ribs, lift = V(0, .17, 0);
    for (let j = 0; j < nv; j++) {
      const v0 = j / nv, v1 = (j + 1) / nv, l0 = surf(u - w, v0), l1 = surf(u - w, v1), r0 = surf(u + w, v0), r1 = surf(u + w, v1), t0 = surf(u, v0).add(lift), t1 = surf(u, v1).add(lift);
      kit.face(l0, l1, t1, t0, TILE_LT, UP); kit.face(t0, t1, r1, r0, TILE_DK, UP);
    }
    // 垄头：一枚圆瓦当，朝外
    const end = surf(u, 1), dir = out(u).clone().normalize(), m = new THREE.Matrix4().lookAt(dir, V(0, 0, 0), UP).setPosition(end.x + dir.x * .03, end.y - .02, end.z + dir.z * .03);
    kit.add(new THREE.CylinderGeometry(.15, .15, .1, 8).rotateX(Math.PI / 2), TILE_LT, m);
  }
}

// 椽子：屋面底下从脊到檐的一排细木，仰看檐下时看得见
export function rafters(kit, surf, count, nv, reach = 1) {
  kit.use(MAT.wood);
  for (let r = 0; r < count; r++) {
    const u = -1 + 2 * (r + .5) / count;
    for (let j = Math.floor(nv * .35); j < nv; j++) {
      const a = surf(u, j / nv * reach).add(V(0, -.36, 0)), b = surf(u, (j + 1) / nv * reach).add(V(0, -.36, 0));
      kit.beam(a, b, .15, .17, RAFTER);
    }
  }
}
