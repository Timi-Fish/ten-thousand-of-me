// 栏杆：只在险处有，按路段换样子。立在路缘石上，立柱沿路按里程每 POST_GAP 一根。
//   朱漆木栏（rail）——鲫鱼背两侧全程；松林里和半山以下，只在路外侧地势陡落的地方。石柱础、红柱、柱头，上下两道横档穿过柱身（柱面上露着榫头的木销），
//                     横档之间两根小立柱。漆是旧的：远看是褪了色的赭红（kit.js 的 MAT.rail）。
//   铁链桩（chain）——十八盘和崖下的台地，只在朝外（地势陡落）的一侧：方石桩、圆顶，桩间两道垂下去的铁链。靠山的一侧是石壁，不设。
//   矮石栏（stone）——山顶的天街两侧（台地的边就是崖）：望柱、栏板、扶手。
// 山门、歇脚的平台自己带栏杆（wayside.js），那两处这里不立；桥上是石栏（bridge.js）。
import * as THREE from 'three';
import { HALF, CURB } from './road.js';
import { Kit, MAT, place } from './kit.js';

export const POST_GAP = 2.6, RAIL_OFF = HALF + CURB - .25, BEAM = 1.12;   // 立柱的间距、离中线多远、上横档的高
const DROP = 3.2, PROBE = 12;                                        // 离中线 PROBE 处的地面比路缘低 DROP 以上才算险
const STONE = '#ABA699', STONE_LT = '#BCB7AA', STONE_DK = '#8E897E', RAIL = '#A8452F', RAIL_DK = '#7E2E20', IRON = '#3A3C40';
// 每个路段立什么：steep 是这一侧险不险
const RULE = {
  street: () => 'stone', ridge: () => 'rail', terrace: () => null,
  gully: steep => steep ? 'chain' : null, bench: steep => steep ? 'chain' : null,
  forest: steep => steep ? 'rail' : null, rejoin: steep => steep ? 'rail' : null, slope: steep => steep ? 'rail' : null,
};

// 栏杆立在哪：一串串连着的段 [{ kind, side, posts: [{ s, at, yaw }] }]
export function railRuns(road, T, groundAt) {
  const runs = [], out = new THREE.Vector3(), tangent = new THREE.Vector3(), gate = road.marks.gate;
  for (const side of [-1, 1]) {
    let run = null;
    for (const { s } of road.miles(3, POST_GAP, 3, road.length - 2)) {
      const at = T.point(s, side * RAIL_OFF, T.curb(s));
      T.point(s, side * PROBE, 0, out);
      const kind = T.offBridge(s, 6) && Math.abs(s - gate) > 4.5 ? RULE[road.sectionAt(s)](at.y - groundAt(out.x, out.z) > DROP) : null;
      if (!kind) { run = null; continue; }
      if (!run || run.kind !== kind) runs.push(run = { kind, side, posts: [] });
      run.posts.push({ s, at, yaw: Math.atan2(road.tangent(s, tangent).x, tangent.z) });
    }
  }
  return runs;
}

const lift = (a, b, h) => [a.clone().setY(a.y + h), b.clone().setY(b.y + h)];
const POST = {
  rail(kit, { at, yaw }) {
    kit.use(MAT.stone).box(.44, .2, .44, STONE_LT, place(at.x, at.y + .04, at.z, yaw));
    kit.use(MAT.rail).box(.24, 1.3, .24, RAIL, place(at.x, at.y + .78, at.z, yaw)).box(.32, .07, .32, RAIL_DK, place(at.x, at.y + 1.44, at.z, yaw)).add(new THREE.ConeGeometry(.2, .2, 4), RAIL_DK, place(at.x, at.y + 1.57, at.z, yaw + Math.PI / 4));
    for (const h of [.56, BEAM]) kit.use(MAT.wood).box(.34, .07, .07, '#3E2018', place(at.x, at.y + h, at.z, yaw));       // 榫头的木销，穿过柱身露在两面
  },
  chain(kit, { at, yaw }) {
    kit.use(MAT.stone).box(.34, 1.16, .34, STONE, place(at.x, at.y + .5, at.z, yaw)).add(new THREE.SphereGeometry(.2, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), STONE_LT, place(at.x, at.y + 1.08, at.z, yaw));
    kit.use(MAT.rail).box(.4, .06, .4, IRON, place(at.x, at.y + .94, at.z, yaw));                                           // 桩上箍一道铁，链环挂在上面
  },
  stone(kit, { at, yaw }) {
    kit.use(MAT.stone).box(.4, 1.2, .4, STONE_LT, place(at.x, at.y + .56, at.z, yaw)).add(new THREE.CylinderGeometry(.1, .26, .3, 8), '#D2CBBC', place(at.x, at.y + 1.3, at.z, yaw));
  },
};
const SPAN = {
  rail(kit, a, b) {
    const [p, q] = lift(a, b, .56), [c, d] = lift(a, b, BEAM);
    kit.use(MAT.rail).beam(p, q, .1, .13, RAIL).beam(c, d, .13, .13, RAIL);
    for (const k of [1 / 3, 2 / 3]) kit.beam(p.clone().lerp(q, k), c.clone().lerp(d, k), .07, .07, RAIL);
  },
  chain(kit, a, b) {
    kit.use(MAT.rail);
    for (const [h, sag] of [[.92, .2], [.5, .14]]) for (let i = 0; i < 4; i++) {
      const at = t => a.clone().lerp(b, t).setY(lerpY(a.y, b.y, t) + h - sag * 4 * t * (1 - t));
      kit.beam(at(i / 4), at((i + 1) / 4), .07, .07, IRON);
    }
  },
  stone(kit, a, b) {
    const [p, q] = lift(a, b, .12), [c, d] = lift(a, b, .52), [e, f] = lift(a, b, 1.0);
    kit.use(MAT.stone).beam(p, q, .3, .2, STONE_DK).beam(c, d, .15, .6, '#C0B9AA').beam(e, f, .26, .15, '#CEC7B8');
  },
};
const lerpY = (a, b, t) => a + (b - a) * t;

export function railGeometry(runs) {
  const kit = new Kit();
  for (const { kind, posts } of runs) posts.forEach((post, i) => {
    POST[kind](kit, post);
    if (i) SPAN[kind](kit, posts[i - 1].at, post.at);
  });
  return kit.geometry();
}
