// 溪上的石拱桥。桥面就是路面（石板和路缘石由 roadmesh.js 铺过去），这里是桥面以下和桥面以上的部分：
//   桥身——两侧的桥墙是一层层平垒的条石，贴着拱洞的一圈是楔形的拱券石，正中一块龙门石略微凸出；桥面两沿各一道挑出来的仰天石；拱洞里面是券顶和两壁；
//   栏杆——每隔两步一根望柱（莲苞柱头），柱间从下到上是地栿、浮雕的栏板、净瓶、寻杖，随着桥面拱起；桥的四个头各一块抱鼓石。
// 桥身的石头用路上石作的材质（和基座是同一种石头），栏杆用雕工的材质（railing.js：浮雕、水渍、青苔）。
import * as THREE from 'three';
import { HALF, CURB } from './road.js';
import { place } from './kit.js';
import { Carve, FACE } from './railing.js';
import { StoneSet, KIND } from './stone.js';
import { tracer } from './roadside.js';
import { courses } from './roadwalls.js';

const EDGE = HALF + CURB + .55, RAIL = HALF + .25, LEAD = 4;             // 桥墙的外皮、栏杆各离中线多远；桥身比桥面两头各多出多少
const POST = '#C4BEAE', PANEL = '#BAB4A4', HAND = '#CAC4B4', BUD = '#CCC6B6', PETAL = '#BEB8A8';   // 旧石头的颜色：暖灰，不是新凿的白
const PANEL_H = .64;                                                                    // 栏板的高
const ROD = new THREE.CylinderGeometry(.5, .5, 1, 10).rotateX(Math.PI / 2);             // 寻杖的截面：圆的
const VASE = new THREE.LatheGeometry([[0, 0], [.075, 0], [.09, .025], [.06, .06], [.045, .1], [.078, .16], [.088, .2], [.06, .235], [.075, .25], [0, .25]].map(([r, y]) => new THREE.Vector2(r, y)), 14);   // 净瓶
const DRUM = new THREE.CylinderGeometry(.56, .56, .26, 28).rotateZ(Math.PI / 2);        // 石鼓：鼓面朝着桥的两侧

// 一圈旋转出来的石雕：profile 是 [半径, 高] 的剖面，lobes 圈上起伏几瓣，depth 起伏多深（瓣尖往外、瓣间往里），twist 错开半瓣
function carved(profile, lobes, depth, twist = 0) {
  const geo = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 48), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x), k = 1 + depth * (Math.abs(Math.cos(lobes * a / 2 + twist)) ** .6 * 2 - 1);
    p.setX(i, x * k).setZ(i, z * k);
  }
  geo.computeVertexNormals();
  return geo;
}
// 望柱头：细颈上一圈仰莲（两层莲瓣错开），莲座上托一个起棱的莲苞
const CAP = [
  [new THREE.CylinderGeometry(.19, .22, .07, 24).translate(0, .035, 0), HAND],
  [carved([[0, .06], [.2, .06], [.27, .1], [.3, .16], [.27, .2], [0, .2]], 8, .13), PETAL],
  [carved([[0, .14], [.18, .14], [.25, .19], [.26, .25], [.2, .27], [0, .27]], 8, .14, Math.PI / 8), PETAL],
  [carved([[0, .25], [.16, .25], [.2, .31], [.2, .39], [.15, .47], [.08, .53], [.02, .57], [0, .58]], 8, .035), BUD],
];

export function buildBridge(road) {
  const T = tracer(road), { s0, s1 } = road.bridge, from = s0 - LEAD, to = s1 + LEAD, sc = (s0 + s1) / 2, A = .37 * (s1 - s0), B = 10.2, set = new StoneSet(road.length, road.length), rail = new Carve();
  const springY = s => T.mid(s) - 13.5, deck = s => T.curb(s);
  // 拱洞的顶在弧长 s 处多高；拱洞以外（桥墩）一直垒到溪谷底下
  const under = s => { const q = (s - sc) / A; return Math.abs(q) < 1 ? springY(s) + B * Math.sqrt(1 - q * q) : T.mid(s) - 24; };
  const ring = (phi, grow) => { const s = sc + (A + grow) * Math.cos(phi); return [s, springY(s) + (B + grow) * Math.sin(phi)]; };   // 拱券上的点：[弧长, 高度]
  const stones = set.at(sc), flat = new THREE.Vector3(), N = 23;

  for (const side of [-1, 1]) {
    // 桥墙
    courses(road, T, set, from, to, { side, top: s => deck(s) - .42, bottom: under, h: .5, bury: 0, rough: 0, lens: [1.3, 2.7], face: depth => EDGE + .012 * depth, back: EDGE - .5, jut: .035, kind: KIND.wall, bevel: .035, salt: 71.3 + side });
    for (let s = from; s < to; s += 1) {                                                                   // 桥墙的石头后面衬一层暗的
      const a = s, b = Math.min(to, s + 1), d = side * (EDGE - .42);
      T.right(a, flat).multiplyScalar(side);
      stones.quad([T.point(a, d, deck(a)), T.point(b, d, deck(b)), T.point(b, d, under(b) - .6), T.point(a, d, under(a) - .6)], [flat, flat, flat, flat], [.45, .45, .45, .45], .5, KIND.bed, [1, 1, 1, 1], flat);
    }
    // 仰天石：桥面沿上挑出来的一道
    for (let s = from, k = 0; s < to - .01; k++) {
      const e = Math.min(to, s + 1.5 + .5 * ((k * 7) % 3) / 2), d = side * (EDGE + .16);
      T.right((s + e) / 2, flat).multiplyScalar(side * (HALF + CURB - .1) - d);
      stones.block([T.point(s + .01, d, deck(s) - .46), T.point(e - .01, d, deck(e) - .46), T.point(e - .01, d, deck(e) + .02), T.point(s + .01, d, deck(s) + .02)], flat.clone(), { seed: (k * .37 + .2) % 1, kind: KIND.curb, bevel: .04, hide: [.7, .7, 1, 1] });
      s = e;
    }
    // 拱券石：一圈楔形的石头，龙门石（正中那块）凸出来一点
    for (let j = 0; j < N; j++) {
      const p0 = Math.PI * j / N, p1 = Math.PI * (j + 1) / N, key = j === (N - 1) / 2, d = side * (EDGE + (key ? .2 : .09)), grow = key ? 1.25 : 1;
      const [a, ay] = ring(p0, 0), [b, by] = ring(p1, 0), [c, cy] = ring(p1, grow), [e, ey] = ring(p0, grow);
      T.right(sc, flat).multiplyScalar(-side * .7);
      stones.block([T.point(a, d, ay), T.point(b, d, by), T.point(c, d, cy), T.point(e, d, ey)], flat.clone(), { seed: (j * .618 + .1) % 1, kind: KIND.curb, bevel: .05, hide: [.7, .7, 1, 1] });
    }
  }
  // 拱洞里面：券顶一条条石头，两壁直落到溪底
  const heart = T.point(sc, 0, springY(sc));                                                               // 拱洞的圆心：券顶的石面都朝着它
  for (let j = 0; j < N; j++) {
    const [a, ay] = ring(Math.PI * j / N, 0), [b, by] = ring(Math.PI * (j + 1) / N, 0), tone = (j * .618 + .4) % 1;
    const inward = heart.clone().sub(T.point((a + b) / 2, 0, (ay + by) / 2)).normalize();
    stones.quad([T.point(a, -EDGE, ay), T.point(a, EDGE, ay), T.point(b, EDGE, by), T.point(b, -EDGE, by)], [inward, inward, inward, inward], [.62, .62, .62, .62], tone, KIND.wall, [1, 1, 1, 1], inward);
  }
  for (const end of [-1, 1]) {
    const s = sc + end * A, inward = road.tangent(s, new THREE.Vector3()).multiplyScalar(-end).setY(0).normalize();
    stones.quad([T.point(s, -EDGE, springY(s) + .05), T.point(s, EDGE, springY(s) + .05), T.point(s, EDGE, springY(s) - 11), T.point(s, -EDGE, springY(s) - 11)], [inward, inward, inward, inward], [.7, .7, .5, .5], .4, KIND.wall, [1, 1, 1, 1], inward);
  }

  // 栏杆：望柱之间从下到上是地栿、栏板（两面浮雕）、三只净瓶（当中一只两边带荷叶）、寻杖
  const bays = Math.round((to - from) / 2.3), step = (to - from) / bays, tangent = new THREE.Vector3(), panelLen = step - .4;
  for (const side of [-1, 1]) for (let k = 0; k <= bays; k++) {
    const s = from + k * step, p = T.point(s, side * RAIL, deck(s)), yaw = Math.atan2(road.tangent(s, tangent).x, tangent.z);
    rail.box(.54, .16, .54, PANEL, place(p.x, p.y + .08, p.z, yaw), p.y).box(.42, 1.36, .42, POST, place(p.x, p.y + .82, p.z, yaw), p.y, FACE.post).box(.5, .1, .5, HAND, place(p.x, p.y + 1.5, p.z, yaw), p.y);
    for (const [geo, hex] of CAP) rail.add(geo, hex, place(p.x, p.y + 1.55, p.z, yaw), p.y);
    if (k === bays) continue;
    const e = s + step, a = T.point(s + .2, side * RAIL, deck(s + .2)), b = T.point(e - .2, side * RAIL, deck(e - .2)), floor = (a.y + b.y) / 2, lift = y => [a.clone().setY(a.y + y), b.clone().setY(b.y + y)];
    rail.beam(...lift(.09), .34, .18, PANEL, floor).beam(...lift(.5), .17, PANEL_H, PANEL, floor, FACE.panel).beam(...lift(1.17), .23, .2, HAND, floor, FACE.plain, ROD);
    const [va, vb] = lift(.82);
    for (const [at, leaves] of [[.2, 0], [.5, 1], [.8, 0]]) {
      const v = va.clone().lerp(vb, at);
      rail.add(VASE, POST, place(v.x, v.y, v.z, yaw), floor);
      if (leaves) rail.beam(va.clone().lerp(vb, at - .09).setY(v.y + .13), va.clone().lerp(vb, at + .09).setY(v.y + .13), .07, .13, PANEL, floor);
    }
  }
  // 抱鼓石：桥的四个头，望柱外面一只石鼓坐在须弥座上，鼓面是旋纹
  for (const side of [-1, 1]) for (const [s, out] of [[from - .85, -1], [to + .85, 1]]) {
    const p = T.point(s, side * RAIL, deck(s)), yaw = Math.atan2(road.tangent(s, tangent).x, tangent.z);
    rail.box(.44, .32, 1.3, PANEL, place(p.x, p.y + .16, p.z, yaw), p.y).add(DRUM, POST, place(p.x, p.y + .84, p.z, yaw), p.y, FACE.drum);
    rail.box(.3, .5, .5, PANEL, place(p.x - tangent.x * out * .55, p.y + .5, p.z - tangent.z * out * .55, yaw, out * .5), p.y);
  }
  return { stones: set, rail: rail.geometry(), panelHalf: [panelLen / 2, PANEL_H / 2] };
}
