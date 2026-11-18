// 分裂：一只小蟹「啵」地分成两只，再 2 → 4 → 8 → 16。每次分裂，老的往一边让，新的从它身体里挤出来落到另一边，一代比一代小；
// 每一对之间有一根拉丝。多段表演都用它，各段自己决定分裂前怎么演、分完以后去哪。
import { lerp, prog, pulse, ease } from '../anim.js';
import { pose, MOOD } from '../crab.js';
import { bounce, throb, hop, UP } from './beat.js';

export const SIZE = [1.15, .95, .8, .68, .56];                        // 每一代的个头
// 第 i 只在第 g 代站哪里（相对分裂的中心）：HOMES[g][i]
const HOMES = [
  [[0, 0]],
  [[-1.5, 0], [1.5, 0]],
  [[-2.7, .9], [2.7, .9], [-1.4, -2.1], [1.4, -2.1]],
  [[-4.2, 1.6], [4.2, 1.6], [-1.5, -2.6], [1.5, -2.6], [-1.4, 1.6], [1.4, 1.6], [-4.4, -2.6], [4.4, -2.6]],
  [[-4.9, 1.9], [4.9, 1.9], [-2.1, -2.9], [2.1, -2.9], [-2.1, 1.9], [2.1, 1.9], [-4.9, -2.9], [4.9, -2.9], [-3.5, 1.9], [3.5, 1.9], [-.7, -2.9], [.7, -2.9], [-.7, 1.9], [.7, 1.9], [-3.5, -2.9], [3.5, -2.9]],
];
const part = u => (u < .12 ? .16 * (u / .12) ** 2 : .16 + .84 * ease.back(prog(u, .12, .46)));   // 分开的进度：先慢慢拉开一点（看得清拉丝），断了以后弹到位

// at：四次分裂的时刻（最好都在拍点上）；origin：分裂的中心 [x, z]；solo(t)：分裂之前那一只的姿势
export function makeSplit({ at, origin = [0, .6], solo }) {
  const LAST = at.length, COUNT = 2 ** LAST;
  const gen = t => at.filter(s => t >= s).length;
  const home = (i, g = LAST) => { const [x, z] = HOMES[g][i < 2 ** g ? i : i - 2 ** g]; return [origin[0] + x, origin[1] + z]; };   // 还没出生的那一代，取它「妈妈」的位置
  return {
    count: COUNT, gen, home,
    // 第 i 只在 t 时刻的姿势（还没出生的大小为 0）。分完以后大家留在原地踩着拍子蹦
    pose(i, t) {
      const g = gen(t);
      if (i >= 2 ** g) return pose({ s: 0 });
      if (g === 0) return solo(t);
      const u = t - at[g - 1], k = part(u), a = home(i, g - 1), b = home(i, g), newborn = i >= 2 ** (g - 1);
      const brace = g < LAST ? pulse(t, at[g] - .09, .15) : 0, fresh = u < .45, party = g === LAST;      // brace：下一次分裂前先压扁蓄力
      return pose(fresh || (party && bounce(t) > .5) ? UP : {}, {
        x: lerp(a[0], b[0], k), z: lerp(a[1], b[1], k) - (newborn ? .1 * (1 - prog(u, 0, .12)) : 0),         // 新的那只刚挤出来时略靠后、略小，免得和老的叠在一起打架
        s: lerp(SIZE[g - 1] * (newborn ? .9 : 1), SIZE[g], prog(u, 0, .3)),
        y: .5 * hop(u, 0, .36) + (party ? .3 : .14) * bounce(t) * prog(u, .4, .6) * (1 - brace),
        sq: -.3 * brace + .22 * pulse(u, .1, .12) + throb(t), lean: Math.sign(b[0] - a[0]) * 10 * (1 - prog(u, 0, .4)),
        yaw: party ? 16 * Math.sin(t * 2.2 + i * 1.7) * prog(u, .5, 1) : 0, mood: fresh || party ? MOOD.joy : MOOD.open, mouth: fresh ? .7 : party ? .45 : 0,
        blink: pulse(t, at[0] + .9 + .31 * i, .09),
      });
    },
    // t 时刻正在拉丝的每一对：[老的编号, 新的编号, 分开后的秒数]
    pairs(t) {
      return at.flatMap((s, g) => (t >= s && t - s < .8 ? HOMES[g].map((_, i) => [i, i + 2 ** g, t - s]) : []));
    },
    // 每次分裂的每一处：{ at 时刻, x, z, size }，给「啵」的特效用
    pops: at.flatMap((s, g) => HOMES[g].map(([x, z]) => ({ at: s, x: origin[0] + x, z: origin[1] + z, size: SIZE[g] }))),
  };
}
