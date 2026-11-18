// 山脊石阶一带的布景：在哪儿、多密、贴不贴得住地、挡不挡镜头。ridge*.js 各部分都按这里摆东西。
//   范围——鲫鱼背那一段山脊石阶（连上面歇脚的平台、下面松林的头一截）是一条带，两个近景机位（「山脊石阶上逆光」和秋天的第一个「红叶下的石阶」）
//         看的那一点前后 60 个单位做足，往外渐稀；山脊上其余路段留一成半的密度；红叶石阶那一处出了这一带就没有。
//   路的坐标——弧长 s、离中线 o（面朝下山方向右正左负），和 roadside.js 的 tracer 一致。
//   贴地——surfaceAt 算的是地形网格本身那张面的高度（和 heights.js、terrain.js 的切法一致：近路的格子细分成 4×4，每格沿同一条对角线切成两个三角形），
//         不是格点之间的双线性插值，所以石头、草根、贴地的那层东西在陡坡上也正好坐在地面上，不悬空、不埋没。
//   镜头——两个近景机位从镜头到它看的那一点（影片里镜头会朝小蟹挪过去，所以看的那一点前后都算上）是一条通道，高的东西不进通道。
import * as THREE from 'three';
import { rnd } from '../anim.js';
import { smooth, clamp } from './noise.js';
import { NEAR, SUB } from './heights.js';
import { roadside, tracer } from './roadside.js';

const FINE_REACH = 15;                                               // heights.js 里离路中线这么近的格子细分（同一个数，改了要两边一起改）
const FULL = 60, FADE = 55;                                          // 机位看的那一点前后多远做足；再往外多远渐稀到底
const BAND_FLOOR = .15;                                             // 山脊上离机位远的路段留几成
export const WALL = 6.4;                                             // 路的基座和护坡到离中线这么远为止（和 ground.js 一致）

export function ridgePlace(road, groundAt, shots) {
  const T = tracer(road), side = roadside(road), g = NEAR, e = g.cell / SUB;
  const ridgeShot = shots.find(s => s.name.includes('山脊')), mapleShot = shots.find(s => s.season === '秋');
  const sOf = q => road.locate(q[0], q[2]).s;
  const ridgeEnd = road.section('ridge').to + 30, ridgeStart = road.section('terrace').from - 25;
  const focus = [{ s: sOf(ridgeShot.q), shot: ridgeShot, band: [ridgeStart, ridgeEnd] }, { s: sOf(mapleShot.q), shot: mapleShot, band: null }];

  // 红叶石阶那一处往上山就是桥（桥和桥边的溪谷另有人布置），桥头往下十几个单位以内不放东西
  const clearOfBridge = s => smooth(road.bridge.s1 + 12, road.bridge.s1 + 30, s) + smooth(road.bridge.s0 - 12, road.bridge.s0 - 30, s);
  // 这一段路上布景有几成（0 没有，1 做足）
  const weight = s => {
    let w = 0;
    for (const f of focus) {
      const near = smooth(FULL + FADE, FULL, Math.abs(s - f.s));
      w = Math.max(w, f.band && s >= f.band[0] && s <= f.band[1] ? BAND_FLOOR + (1 - BAND_FLOOR) * near : near);
    }
    return w * Math.min(1, clearOfBridge(s));
  };
  // 布景沿路的范围：[起, 止] 的几段
  const spans = [[ridgeStart, ridgeEnd + 20], [Math.max(focus[1].s - FULL - FADE, road.bridge.s1 + 12), focus[1].s + FULL + FADE]];

  // 路边的格子细不细分：和 heights.js 一样看格子四个角离路中线有多近
  const away = (x, z) => { const on = side.locate(x, z); return on ? on.d : Infinity; };
  const fineMemo = new Map();
  const isFine = (i, j) => {
    const key = i * 4096 + j;
    if (!fineMemo.has(key)) {
      const x = g.x0 + i * g.cell, z = g.z0 + j * g.cell;
      fineMemo.set(key, Math.min(away(x, z), away(x + g.cell, z), away(x, z + g.cell), away(x + g.cell, z + g.cell)) < FINE_REACH);
    }
    return fineMemo.get(key);
  };
  // 地形网格那张面在 (x, z) 的高度
  function surfaceAt(x, z) {
    const fx = (x - g.x0) / g.cell, fz = (z - g.z0) / g.cell;
    if (fx < 0 || fz < 0 || fx >= g.nx - 1 || fz >= g.nz - 1) return groundAt(x, z);
    const i = Math.floor(fx), j = Math.floor(fz), fine = isFine(i, j), step = fine ? e : g.cell;
    const ox = g.x0 + i * g.cell, oz = g.z0 + j * g.cell, a = fine ? Math.min(SUB - 1, Math.floor((x - ox) / e)) : 0, b = fine ? Math.min(SUB - 1, Math.floor((z - oz) / e)) : 0;
    const x0 = ox + a * step, z0 = oz + b * step, u = (x - x0) / step, v = (z - z0) / step;
    const h00 = groundAt(x0, z0), h10 = groundAt(x0 + step, z0), h01 = groundAt(x0, z0 + step), h11 = groundAt(x0 + step, z0 + step);
    return u + v <= 1 ? h00 + u * (h10 - h00) + v * (h01 - h00) : h11 + (1 - u) * (h01 - h11) + (1 - v) * (h10 - h11);
  }
  // 这一处坡面的法线（量一个单位见方）
  const normalAt = (x, z, out = new THREE.Vector3()) => out.set(surfaceAt(x - .5, z) - surfaceAt(x + .5, z), 1, surfaceAt(x, z - .5) - surfaceAt(x, z + .5)).normalize();

  // 镜头的通道：从机位到它看的那段路（看的那一点往上山 8、往下山 16 个单位，影片里小蟹从上往下蹦，镜头跟着摇）
  const lanes = [];
  for (const f of focus) {
    const p = new THREE.Vector3(...f.shot.p), q = new THREE.Vector3();
    for (let ds = -8; ds <= 16; ds += 2) { road.at0(f.s + ds, q); lanes.push({ p, q: q.clone().setY(road.surface(f.s + ds) + 1.6) }); }
  }
  const seg = new THREE.Vector3(), rel = new THREE.Vector3();
  // (x, y, z) 处一个半径 r 的东西挡不挡镜头
  const blocks = (x, y, z, r) => lanes.some(({ p, q }) => {
    if (Math.hypot(x - p.x, z - p.z) < 5 + r) return true;                                                // 镜头脚下一圈什么都不长（贴着镜头的草会糊成一大片）
    seg.subVectors(q, p); rel.set(x - p.x, y - p.y, z - p.z);
    const k = clamp(rel.dot(seg) / seg.lengthSq(), 0, 1.04);
    return rel.addScaledVector(seg, -k).length() < r + .8 + 1.2 * k;
  });

  // 在不在机位那一侧的坡上（机位前后 70 个单位以内）：那一侧的坡是从镜头脚下落下去的，上面长高的东西会把画面左边的云海和远山遮掉
  for (const f of focus) f.side = road.locate(f.shot.p[0], f.shot.p[2]).side;
  const cameraSide = (s, o) => focus.some(f => Math.abs(s - f.s) < 70 && Math.sign(o) === f.side);

  // 撒点：沿路每隔 ds、离中线从 o0 到 o1 每隔 dO 一个候选点（两侧都撒），各自抖开。visit(x, z, s, o, k, w) 里决定种不种：
  // w 是这一段的密度，k 是这个点自己的随机种子
  function scatter({ ds, dO, o0, o1, salt, clear = WALL + .2 }, visit) {
    const p = new THREE.Vector3(), r = new THREE.Vector3();
    let k = 0;
    for (const [a, b] of spans) for (let s = Math.max(0, a); s < Math.min(road.length, b); s += ds) {
      const w = weight(s);
      if (w <= 0) continue;
      for (const sign of [-1, 1]) for (let o = o0; o < o1; o += dO) {
        k++;
        const key = salt + k * .618, ss = s + (rnd(key * 3.1) - .5) * ds, oo = sign * (o + rnd(key * 5.7) * dO);
        road.at0(ss, p); road.right(ss, r);
        const x = p.x + r.x * oo, z = p.z + r.z * oo, on = road.locate(x, z);
        if (on && on.d < clear) continue;                                                // 路面、路缘石、基座和护坡上不长
        if (focus.some(f => Math.hypot(x - f.shot.p[0], z - f.shot.p[2]) < 5)) continue;   // 镜头脚下一圈不长
        visit(x, z, ss, oo, key, w);
      }
    }
  }

  return { T, road, groundAt, focus, spans, weight, surfaceAt, normalAt, blocks, cameraSide, scatter, away, ridgeEnd, locate: side.locate };
}
