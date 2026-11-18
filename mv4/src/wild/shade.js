// 山影的顶：对地面上每一点，记下「它的正上方要高到多少才晒得到日（月）」。
// 有了这张图，空中任何一点照不照得到光只要查一次、比一下高度——雾里的光柱、云海上的山影、云海自己的受光都靠它。
// 算法：山影的顶沿着日光方向一格一格往后传，每传一格降下「这一格的水平距离 × 日光的坡度」，再和当地的地面高度取大的。
//   所以只要从朝着日月的那一边开始、一列一列（或一行一行）往背光的方向推一遍就算完了。
// 四个季节的日月方向不同，各占贴图的一个通道。近处、远处各一张，范围和格距跟地形的两张高度贴图完全一样（直接从那两张贴图里读高度）。
import * as THREE from 'three';
import { SEASONS, SEASON_NAMES } from './seasons.js';

// 从高度贴图读出格网（起点、格距、点数）和高度。stride：每个像素几个数，高度在第一个
function gridOf(texture, rect, stride) {
  const { data, width: nx, height: nz } = texture.image, cell = 1 / (rect.z * nx), H = new Float32Array(nx * nz);
  for (let k = 0; k < H.length; k++) H[k] = THREE.DataUtils.fromHalfFloat(data[k * stride]);
  return { nx, nz, cell, x0: rect.x + cell / 2, z0: rect.y + cell / 2, H };
}
function sample(g, values, x, z) {
  const fx = THREE.MathUtils.clamp((x - g.x0) / g.cell, 0, g.nx - 1.0001), fz = THREE.MathUtils.clamp((z - g.z0) / g.cell, 0, g.nz - 1.0001);
  const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, k = j * g.nx + i;
  return (values[k] * (1 - u) + values[k + 1] * u) * (1 - v) + (values[k + g.nx] * (1 - u) + values[k + g.nx + 1] * u) * v;
}

// 一张格网上的山影顶。dir：指向日月的单位向量；outer(x, z)：格网外面那一点的山影顶（传进来的起点）；
// shorten：影子缩短到几分之一（山影顶每传一格多降几倍）
function ceiling(g, dir, outer, shorten) {
  const [lx, ly, lz] = dir, flat = Math.hypot(lx, lz), S = new Float32Array(g.H.length);
  const alongX = Math.abs(lx) >= Math.abs(lz), main = alongX ? lx : lz, toSun = Math.sign(main), shift = (alongX ? lz : lx) / Math.abs(main);
  const n1 = alongX ? g.nx : g.nz, n2 = alongX ? g.nz : g.nx, drop = g.cell * Math.hypot(1, shift) * ly / flat * shorten;
  const at = alongX ? (a, b) => b * g.nx + a : (a, b) => a * g.nx + b;                    // a：推进方向上的下标，b：横向的下标
  const world = alongX ? (a, b) => [g.x0 + a * g.cell, g.z0 + b * g.cell] : (a, b) => [g.x0 + b * g.cell, g.z0 + a * g.cell];
  for (let step = 0; step < n1; step++) {
    const a = toSun > 0 ? n1 - 1 - step : step, up = a + toSun;                           // up：朝着日月的上一列
    for (let b = 0; b < n2; b++) {
      const fb = b + shift, b0 = Math.floor(fb), k = fb - b0;
      const above = up < 0 || up >= n1 || b0 < 0 || b0 + 1 >= n2 ? outer(...world(up, fb)) : S[at(up, b0)] * (1 - k) + S[at(up, b0 + 1)] * k;
      S[at(a, b)] = Math.max(g.H[at(a, b)], above - drop);
    }
  }
  return S;
}

function texture(layers, g) {
  const half = new Uint16Array(g.nx * g.nz * 4);
  layers.forEach((S, c) => { for (let k = 0; k < S.length; k++) half[k * 4 + c] = THREE.DataUtils.toHalfFloat(S[k]); });
  const tex = new THREE.DataTexture(half, g.nx, g.nz, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
  return tex;
}

// 算出四季的山影顶，写进 U.uShadeTop（近处）和 U.uShadeFar（远处）。要在地形建好（U.uLand、U.uFar 有了）之后调
export function bakeShadeTops(U) {
  const near = gridOf(U.uLand.value, U.uLandRect.value, 4), far = gridOf(U.uFar.value, U.uFarRect.value, 2);
  // 远处那张格网上的山分两拨：近处范围里的（主峰、石峰、抱湖的山梁）和外面的远山
  const inner = { ...far, H: new Float32Array(far.H.length) }, outer = { ...far, H: new Float32Array(far.H.length) };
  for (let k = 0; k < far.H.length; k++) {
    const x = far.x0 + (k % far.nx) * far.cell, z = far.z0 + Math.floor(k / far.nx) * far.cell;
    const inside = x >= near.x0 && z >= near.z0 && x <= near.x0 + (near.nx - 1) * near.cell && z <= near.z0 + (near.nz - 1) * near.cell;
    inner.H[k] = inside ? far.H[k] : -1e4; outer.H[k] = inside ? -1e4 : far.H[k];
  }
  const nearLayers = [], farLayers = [];
  for (const name of SEASON_NAMES) {
    const dir = new THREE.Vector3(...SEASONS[name].sunDir).normalize().toArray();
    // 远山的影子只留四分之一长：照实算的话，日头一低，天边那一重重山会把整片云海和主峰都罩进影子里，落日就照不到云上了。
    // 主峰那一拨的影子照实算，一直拖到远处的云海上
    const fromFar = ceiling(outer, dir, () => -1e4, 4), fromNear = ceiling(inner, dir, () => -1e4, 1), farTop = fromFar.map((v, k) => Math.max(v, fromNear[k]));
    farLayers.push(farTop);
    nearLayers.push(ceiling(near, dir, (x, z) => sample(far, fromFar, x, z), 1));
  }
  U.uShadeTop.value = texture(nearLayers, near);
  U.uShadeFar.value = texture(farLayers, far);
}
