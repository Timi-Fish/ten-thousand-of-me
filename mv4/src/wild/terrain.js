// 地形：把高度场（heights.js）做成网格，烘出给着色器用的贴图（terrainbake.js），着色在 terrainpaint.js。
// 三层网格：近处每 3 个单位一个点，切成小块好让镜头外的不画；路两旁细分到 0.75 个单位，和近处的粗格严丝合缝；
// 远处云海下的谷地每 37.5 个单位一个点；再往外的远山是一张越远越疏的极坐标网（farland.js），山脊线才有细的起伏。
import * as THREE from 'three';
import { CLOUD_TOP } from './land.js';
import { cloudSea, cloudFall } from './outland.js';
import { lerp, clamp } from './noise.js';
import { U } from './paint.js';
import { buildHeights, NEAR, FARG, SUB, CREEK_REACH } from './heights.js';
import { cavity, bakeShadows, floatTexture } from './terrainbake.js';
import { terrainMaterials } from './terrainpaint.js';
import { buildFarRing, RING } from './farland.js';
import { planSkin } from './sceneryskin.js';

const CHUNK = 64;                                                    // 近处网格每块的格数
const ROAD_FADE = 26;                                                // 贴图里「离路多远」记到这么远为止

export function buildTerrain(road, creek, pads, relief) {
  const g = NEAR, f = FARG, heights = buildHeights(road, creek, pads, relief),{ H, HF, roadD, creekD, slot, F, FD, FW, groundAt } = heights;

  // 贴图：一个粗格点一个像素
  // uLand：高度、小的凹凸、云海有几成、大的凹凸（整道山脊、整条侧谷）；uLand2：离路多近、离溪多近、梯田几成、贴地的云（垭口的云瀑、谷口的云舌）
  // uFar：高度、云海有几成
  const count = g.nx * g.nz, cav = cavity(g, H), macro = cavity(g, H, 17, 30), land = new Float32Array(count * 4), land2 = new Uint8Array(count * 4);
  for (let k = 0; k < count; k++) {
    const x = g.x0 + (k % g.nx) * g.cell, z = g.z0 + Math.floor(k / g.nx) * g.cell;
    land[k * 4] = H[k]; land[k * 4 + 1] = cav[k]; land[k * 4 + 2] = cloudSea(x, z); land[k * 4 + 3] = macro[k];
    land2[k * 4] = 255 * clamp(1 - roadD[k] / ROAD_FADE); land2[k * 4 + 1] = 255 * clamp(1 - creekD[k] / CREEK_REACH); land2[k * 4 + 2] = 255 * relief.field(x, z, H[k]); land2[k * 4 + 3] = 255 * cloudFall(x, z);
  }
  U.uLand.value = floatTexture(land, g.nx, g.nz, 4);
  U.uLand2.value = new THREE.DataTexture(land2, g.nx, g.nz, THREE.RGBAFormat);
  U.uLand2.value.magFilter = U.uLand2.value.minFilter = THREE.LinearFilter; U.uLand2.value.needsUpdate = true;
  const far = new Float32Array(f.nx * f.nz * 2);
  for (let k = 0; k < f.nx * f.nz; k++) { far[k * 2] = HF[k]; far[k * 2 + 1] = cloudSea(f.x0 + (k % f.nx) * f.cell, f.z0 + Math.floor(k / f.nx) * f.cell); }
  U.uFar.value = floatTexture(far, f.nx, f.nz, 2);
  U.uBake.value = bakeShadows(g, groundAt);
  // 贴图坐标：像素中心对着格点
  U.uLandRect.value.set(g.x0 - g.cell / 2, g.z0 - g.cell / 2, 1 / (g.nx * g.cell), 1 / (g.nz * g.cell));
  U.uFarRect.value.set(f.x0 - f.cell / 2, f.z0 - f.cell / 2, 1 / (f.nx * f.cell), 1 / (f.nz * f.cell));

  const mats = terrainMaterials(), group = new THREE.Group();
  const mesh = (pos, nor, idx, mat, extra = {}) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setIndex(idx);
    for (const name in extra) geo.setAttribute(name, new THREE.BufferAttribute(extra[name], 1));
    const m = new THREE.Mesh(geo, mat);
    group.add(m);
    return m;
  };
  // 粗格点的法线：取相邻点的高差
  const NC = new Float32Array(count * 3);
  for (let j = 0; j < g.nz; j++) for (let i = 0; i < g.nx; i++) {
    const a = H[j * g.nx + Math.max(0, i - 1)], b = H[j * g.nx + Math.min(g.nx - 1, i + 1)], c = H[Math.max(0, j - 1) * g.nx + i], d = H[Math.min(g.nz - 1, j + 1) * g.nx + i];
    const nx = a - b, nz = c - d, ny = 2 * g.cell, len = Math.hypot(nx, ny, nz), at = (j * g.nx + i) * 3;
    NC[at] = nx / len; NC[at + 1] = ny / len; NC[at + 2] = nz / len;
  }

  const cw = g.nx - 1, P = SUB + 1, e = g.cell / SUB, skin = planSkin(g, H, slot, relief.keep);
  for (let cj = 0; cj < g.nz - 1; cj += CHUNK) for (let ci = 0; ci < g.nx - 1; ci += CHUNK) {
    const w = Math.min(CHUNK, g.nx - 1 - ci), h = Math.min(CHUNK, g.nz - 1 - cj);
    // 这一块里没细分的格子
    {
      const pos = new Float32Array((w + 1) * (h + 1) * 3), nor = new Float32Array(pos.length), away = new Float32Array((w + 1) * (h + 1)), idx = [];
      for (let j = 0; j <= h; j++) for (let i = 0; i <= w; i++) {
        const v = j * (w + 1) + i, k = (cj + j) * g.nx + ci + i;
        pos[v * 3] = g.x0 + (ci + i) * g.cell; pos[v * 3 + 1] = H[k]; pos[v * 3 + 2] = g.z0 + (cj + j) * g.cell;
        nor.set(NC.subarray(k * 3, k * 3 + 3), v * 3); away[v] = Math.min(roadD[k], 99);
      }
      // 深埋在云海底下的格子（镜头看不到）每 2×2 并成一格画，省下三角形
      const sunk = (i, j) => { const k = (cj + j) * g.nx + ci + i; return i < w && j < h && slot[(cj + j) * cw + ci + i] < 0 && !skin.on[(cj + j) * cw + ci + i] && [k, k + 1, k + g.nx, k + g.nx + 1].every(v => H[v] < CLOUD_TOP - 27 && land[v * 4 + 2] > .98); };
      const merged = (i, j) => sunk(i, j) && sunk(i + 1, j) && sunk(i, j + 1) && sunk(i + 1, j + 1);
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        if (slot[(cj + j) * cw + ci + i] >= 0 || skin.on[(cj + j) * cw + ci + i]) continue;
        const a = j * (w + 1) + i, b = a + w + 1, i0 = i - i % 2, j0 = j - j % 2;
        if (!merged(i0, j0)) idx.push(a, b, a + 1, a + 1, b, b + 1);
        else if (i === i0 && j === j0) idx.push(a, a + 2 * (w + 1), a + 2, a + 2, a + 2 * (w + 1), a + 2 * (w + 1) + 2);
      }
      if (idx.length) { const m = mesh(pos, nor, idx, mats.near, { aRoad: away }); m.geometry.computeBoundingSphere(); m.receiveShadow = true; }
    }
    // 这一块里细分了的格子：每格 P×P 个点。法线取细点的高差，靠近粗格的地方渐渐换成粗格的法线，明暗在交界处也接得上
    {
      const pos = [], nor = [], away = [], idx = [];
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const c = slot[(cj + j) * cw + ci + i], k = (cj + j) * g.nx + ci + i, base = pos.length / 3;
        if (c < 0) continue;
        for (let b = 0; b <= SUB; b++) for (let a = 0; a <= SUB; a++) {
          const o = c * P * P + b * P + a, x = g.x0 + ((ci + i) * SUB + a) * e, z = g.z0 + ((cj + j) * SUB + b) * e, u = a / SUB, v = b / SUB, own = FW[o];
          pos.push(x, F[o], z); away.push(Math.min(FD[o], 99));
          const fx = groundAt(x - e, z) - groundAt(x + e, z), fz = groundAt(x, z - e) - groundAt(x, z + e), fl = Math.hypot(fx, 2 * e, fz), n = [0, 0, 0];
          for (let q = 0; q < 3; q++) n[q] = lerp(lerp(lerp(NC[k * 3 + q], NC[(k + 1) * 3 + q], u), lerp(NC[(k + g.nx) * 3 + q], NC[(k + g.nx + 1) * 3 + q], u), v), [fx, 2 * e, fz][q] / fl, own);
          const len = Math.hypot(...n);
          nor.push(n[0] / len, n[1] / len, n[2] / len);
        }
        for (let b = 0; b < SUB; b++) for (let a = 0; a < SUB; a++) { const p = base + b * P + a, q = p + P; idx.push(p, q, p + 1, p + 1, q, q + 1); }
      }
      if (idx.length) { const m = mesh(new Float32Array(pos), new Float32Array(nor), idx, mats.near, { aRoad: new Float32Array(away) }); m.geometry.computeBoundingSphere(); m.receiveShadow = true; }
    }
    // 这一块里离路远的崖壁：细格（sceneryskin.js）
    {
      const c = skin.chunk(ci, cj, w, h);
      if (c) { const m = mesh(c.pos, c.nor, c.idx, mats.near, { aRoad: c.away }); m.geometry.computeBoundingSphere(); m.receiveShadow = true; }
    }
  }

  // 近处网格四周垂下一道裙边，盖住和远处网格之间的缝（那一带在云海底下）
  {
    const ring = [];
    for (let i = 0; i < g.nx; i++) ring.push([i, 0]);
    for (let j = 1; j < g.nz; j++) ring.push([g.nx - 1, j]);
    for (let i = g.nx - 2; i >= 0; i--) ring.push([i, g.nz - 1]);
    for (let j = g.nz - 2; j >= 0; j--) ring.push([0, j]);
    const pos = [], nor = [], idx = [];
    ring.forEach(([i, j], k) => {
      const x = g.x0 + i * g.cell, z = g.z0 + j * g.cell, y = H[j * g.nx + i];
      pos.push(x, y, z, x, y - 70, z); nor.push(0, 1, 0, 0, 1, 0);
      const a = k * 2, b = ((k + 1) % ring.length) * 2;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    });
    mesh(new Float32Array(pos), new Float32Array(nor), idx, mats.far, { aCav: new Float32Array(pos.length / 3) }).frustumCulled = false;
  }

  // 远处：粗网只铺远山那张极坐标网（farland.js）的内圈以里，和它在云海底下叠一圈；挖掉被近处网格完全盖住的格子；压在近处网格底下的点往下沉，不和它抢
  {
    const pos = new Float32Array(f.nx * f.nz * 3), nor = new Float32Array(pos.length), idx = [], sunk = new Uint8Array(f.nx * f.nz);
    const beyond = k => Math.hypot(pos[k * 3] - RING.x, pos[k * 3 + 2] - RING.z) > RING.inner + 75;
    const within = (x, z) => x >= g.x0 && z >= g.z0 && x <= g.x0 + (g.nx - 1) * g.cell && z <= g.z0 + (g.nz - 1) * g.cell;
    for (let j = 0; j < f.nz; j++) for (let i = 0; i < f.nx; i++) {
      const k = j * f.nx + i, x = f.x0 + i * f.cell, z = f.z0 + j * f.cell;
      sunk[k] = within(x, z) ? 1 : 0;
      pos[k * 3] = x; pos[k * 3 + 1] = HF[k] - 30 * sunk[k]; pos[k * 3 + 2] = z;
      const a = HF[j * f.nx + Math.max(0, i - 1)], b = HF[j * f.nx + Math.min(f.nx - 1, i + 1)], c = HF[Math.max(0, j - 1) * f.nx + i], d = HF[Math.min(f.nz - 1, j + 1) * f.nx + i];
      const nx = a - b, nz = c - d, ny = 2 * f.cell, len = Math.hypot(nx, ny, nz);
      nor[k * 3] = nx / len; nor[k * 3 + 1] = ny / len; nor[k * 3 + 2] = nz / len;
    }
    for (let j = 0; j < f.nz - 1; j++) for (let i = 0; i < f.nx - 1; i++) {
      const a = j * f.nx + i, b = a + f.nx;
      if (sunk[a] && sunk[a + 1] && sunk[b] && sunk[b + 1] || beyond(a) && beyond(a + 1) && beyond(b) && beyond(b + 1)) continue;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
    mesh(pos, nor, idx, mats.far, { aCav: new Float32Array(f.nx * f.nz) }).frustumCulled = false;
  }
  group.add(buildFarRing(f, g, mats.far));

  // 坡度：0 平地，越大越陡（1 - 法线的 y 分量）
  const slopeAt = (x, z) => { const d = 2, dx = groundAt(x + d, z) - groundAt(x - d, z), dz = groundAt(x, z + d) - groundAt(x, z - d); return 1 - 2 * d / Math.hypot(dx, 2 * d, dz); };
  return { group, groundAt, slopeAt };
}
