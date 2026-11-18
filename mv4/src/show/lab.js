// 检查用的一段（排在整首歌之后的 300 – 310 秒，成片里不会出现）：主角和它的虚影并排站着，旁边一摞纸，
// 用来看天色（月夜 → 清晨）、油灯（亮 → 灭）和虚影的效果。
//   300 – 304：全景，天色从月夜过渡到清晨；304 – 308：近景，油灯从亮到灭；308 – 310：俯拍
import { prog, key } from '../anim.js';
import { pose, MOOD } from '../crab.js';
import { drawPile } from './slips.js';
import { bounce } from './beat.js';

export const span = [300, 310];
export function build(kit) {
  const CAM = [
    [300, { p: [0, 4.6, 18.5], q: [0, 1.2, -1.5], f: 20 }], [304, { p: [0, 4.6, 18.5], q: [0, 1.2, -1.5], f: 20 }],
    [304, { p: [1.2, 2, 7.6], q: [.2, 1.3, .8], f: 7 }], [308, { p: [1.2, 2, 7.6], q: [.2, 1.3, .8], f: 7 }],
    [308, { p: [0, 30, 6], q: [0, 0, -1], f: 30 }],
  ];
  return {
    frame(t) {
      kit.act(kit.hero, u => pose({ x: -1.4, z: .9, s: 1.15, y: .2 * bounce(u), mood: MOOD.joy }));
      kit.act(kit.twin, u => pose({ x: 1.2, z: .9, s: 1.15, ghost: 1, yaw: -20, mood: MOOD.calm }));
      drawPile(kit.slips, 90);
      return { cam: key(t, CAM), dawn: prog(t, 300, 304) * (1 - prog(t, 307.9, 308)) , lamp: 1 - prog(t, 304, 308) };
    },
  };
}
