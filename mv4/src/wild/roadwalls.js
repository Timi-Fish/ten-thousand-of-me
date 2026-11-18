// 路两侧垒起来的石头：路缘石底下的条石基座，和地势高的一侧的毛石护坡。
// 都是水平的一层层（石阶再陡，每层石头也是平着垒的）：一层的顶不高过墙顶线、底不低过墙脚线（埋进土里一层），
// 所以顺着斜下去的路缘看，基座的顶是一级一级跌下去的，像砌出来的，不是一条贴上去的带子。
// 越往下的层往外多探一点（基座有收分）；每块石头长短、进出各不相同。
import * as THREE from 'three';
import { rnd } from '../anim.js';
import { lerp } from './noise.js';
import { KIND } from './stone.js';
import { roadside, tracer, WALL_AT, BANK_AT, BANK_BACK, GUTTER } from './roadside.js';

const STEP = .25;                                                    // 沿路每隔多远量一次墙顶和墙脚

// 在弧长 from 到 to 之间垒一道墙。o：
//   side 哪一侧；top(s)、bottom(s) 墙顶线和墙脚线的高度（顶低于脚的地方没有墙）；h 每层多高；bury 最底下一层可以低过墙脚线多少；lens 石头最短最长；
//   face(depth) 墙面离中线多远（depth：这一层的顶比墙顶线低多少）；back 石头里端离中线多远；jut 各块进出差多少；kind、bevel、salt
export function courses(road, T, set, from, to, o) {
  const n = Math.floor((to - from) / STEP), top = new Float32Array(n + 1), bottom = new Float32Array(n + 1), r = new THREE.Vector3();
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i <= n; i++) {
    const s = from + i * STEP;
    top[i] = o.top(s); bottom[i] = o.bottom(s);
    if (top[i] > bottom[i]) { lo = Math.min(lo, bottom[i]); hi = Math.max(hi, top[i]); }
  }
  // 一块石头：从 sa 到 sb，在第 c 层。first、last：是不是这一层的头一块、末一块（齐整的墙只有两头的石头露着端面）
  const stone = (sa, sb, c, seed, first, last) => {
    const sm = (sa + sb) / 2, y0 = c * o.h, y1 = y0 + o.h - .008 - o.rough * rnd(seed * 43.1), d = o.side * (o.face(Math.max(0, o.top(sm) - y1)) + (rnd(seed * 13.3) - .5) * o.jut);
    T.right(sm, r).multiplyScalar(o.side * o.back - d);
    set.at(sm).block([T.point(sa + .008, d, y0), T.point(sb - .008, d, y0), T.point(sb - .008, d, y1), T.point(sa + .008, d, y1)], r, { seed, kind: o.kind, bevel: o.bevel, sides: [false, last || o.rough > 0, true, first || o.rough > 0], hide: [.74, .74, 1, 1], deep: .5 });
  };
  for (let c = Math.floor(lo / o.h) - 1; (c + 1) * o.h <= hi; c++) {
    let start = -1;
    for (let i = 0; i <= n + 1; i++) {
      const here = i <= n && top[i] > bottom[i] && (c + 1) * o.h <= top[i] && c * o.h >= bottom[i] - o.bury;
      if (here && start < 0) start = i;
      if (here || start < 0) continue;
      // 这一层从 start 连到 i - 1（两头各多占半格：量的点之间也有墙），切成一块块。石阶陡的地方一层只有一两格长，也要垒上一块，不留黑洞
      const end = Math.min(to, from + (i - .5) * STEP);
      for (let s = Math.max(from, from + (start - .5) * STEP), j = 0; end - s > .1; j++) {
        const seed = rnd(c * 3.3 + j * 5.7 + start * .37 + o.salt);
        let e = s + lerp(o.lens[0], o.lens[1], rnd(seed * 29.1));
        if (end - e < o.lens[0] * .7) e = end;
        stone(s, e, c, seed, j === 0, e === end);
        s = e;
      }
      start = -1;
    }
  }
}

export function buildWalls(road, set) {
  const T = tracer(road), side = roadside(road), e = {}, bridge = road.bridge, MARGIN = 2.5, flat = new THREE.Vector3();
  const spans = [[0, bridge.s0 - MARGIN], [bridge.s1 + MARGIN, road.length]];                 // 桥上没有基座和护坡（桥身自己托着路）
  [-1, 1].forEach((sign, q) => {
    const drop = s => side.edge(s, q, e).drop, bank = s => side.edge(s, q, e).bank;
    for (const [from, to] of spans) {
      // 基座：从路缘石底下垒到墙脚的地面以下
      courses(road, T, set, from, to, {
        side: sign, top: s => T.curb(s) - .38, bottom: s => T.mid(s) - drop(s) - .4, h: .36, bury: .36, lens: [1.2, 2.6], rough: 0, face: depth => WALL_AT + .05 + .09 * depth, back: WALL_AT - .06, jut: .03, kind: KIND.wall, bevel: .03, salt: 11.3 + q,
      });
      // 基座的石头后面衬一层同样的石头、压暗一些：石头之间、一级级跌下去的层顶和斜着的路缘石之间，看进去是阴影里的石头，不是黑洞
      for (let s = from; s < to; s += 1) {
        const a = s, b = Math.min(to, s + 1), d = sign * (WALL_AT - .04);
        T.right(a, flat).multiplyScalar(sign);
        set.at(a).quad([T.point(a, d, T.curb(a) - .3), T.point(b, d, T.curb(b) - .3), T.point(b, d, T.mid(b) - drop(b) - .7), T.point(a, d, T.mid(a) - drop(a) - .7)], [flat, flat, flat, flat], [.62, .62, .62, .62], .5, KIND.wall, [1, 1, 1, 1], flat);
      }
      // 护坡：毛石垒的矮墙，墙面朝着路，往上略往后仰；墙顶宽，后半截压在土里
      courses(road, T, set, from, to, {
        side: sign, top: s => bank(s) > 0 ? T.mid(s) - GUTTER + bank(s) : -1e9, bottom: s => T.mid(s) - GUTTER - .45, h: .43, bury: .43, lens: [.5, 1.5], rough: .09, face: depth => BANK_AT + .28 - .12 * depth, back: BANK_BACK + .6, jut: .16, kind: KIND.rubble, bevel: .055, salt: 47.9 + q,
      });
    }
  });
}
