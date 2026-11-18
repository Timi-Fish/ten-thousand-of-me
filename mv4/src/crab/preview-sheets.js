// 检查表的内容：每张表是一组摆好姿势的小蟹和一个机位。
// 每项是一个函数，返回 { name, cam: { p, q }, cast: [{ kit, steps, at(t) → 姿势 }] }。
import { rnd, ease, prog, pulse, lerp } from '../anim.js';
import { Bond } from '../crab.js';

const UP = { aL: [55, .3, .1], aR: [55, .3, .1] };
// 把一排姿势从左到右摆开；每项是姿势（可带 kit、steps），或 t => 姿势
const row = (pose, items, gap, z = 0, s = 1) => items.map((item, i) => {
  const x = (i - (items.length - 1) / 2) * gap, { kit, steps, ...rest } = item, f = typeof item === 'function' ? item : () => rest;
  return { kit, steps, at: t => { const q = { x: 0, z: 0, ...f(t) }; return pose({ s }, q, { x: x + q.x, z: z + q.z }); } };
});
const wide = (n, gap, y = 1.3) => { const d = Math.max(4, (n * gap + .6) / 1.1); return { p: [0, y + d * .08, d], q: [0, y - .2, 0] }; };
const hop = t => { const k = ((t % .6) + .6) % .6; return 1.5 * Math.sin(Math.PI * k / .6); };       // 每 0.6 秒落一次地的蹦跳
const closeup = (kit, yaw, name) => ({ pose }) => ({ name, cam: { p: [.9, 2.2, 4.6], q: [0, 1.5, 0] }, cast: [{ kit, at: () => pose({ s: 1.15, yaw }) }] });

export const SHEETS = [
  ({ pose, MOOD }) => ({                                                                             // 0
    name: '近景：镜头离主角 5 个单位', cam: { p: [1.3, 1.7, 4.9], q: [0, 1.2, 0] },
    cast: [{ at: t => pose({ s: 1.15, yaw: -8, mood: MOOD.open, sq: .02 * Math.sin(t * 3) }) }],
  }),
  ({ pose, MOOD }) => ({                                                                             // 1
    name: '极限姿势：站着、压扁、拉长、鼓气、瘪、歪、仰、被往右牵、左右猛晃', cam: wide(9, 2.7),
    cast: row(pose, [
      {}, { sq: -.4 }, { sq: .4 }, { ...UP, puff: 1.75, pucker: 1, mouth: .25, mood: MOOD.calm }, { puff: -.8 }, { lean: 25 }, { pitch: -15 }, { pull: [.5, 0, 0], mood: MOOD.wow },
      t => ({ x: 3 * Math.sin(t * 6), mood: MOOD.joy, mouth: .6 }),
    ], 2.7),
  }),
  ({ pose, KIT_NAMES }) => ({ name: '七种头饰', cam: wide(7, 2.5, 1.5), cast: row(pose, KIT_NAMES.map(kit => ({ kit })), 2.5) }),   // 2
  ({ pose, MOOD }) => ({                                                                             // 3
    name: '眼神：睁眼、笑眼、闭眼、挤眼、吃惊、星星眼', cam: wide(6, 2.3),
    cast: row(pose, [{ mood: MOOD.open }, { mood: MOOD.joy, mouth: .6 }, { mood: MOOD.calm }, { mood: MOOD.ouch, mouth: .3 }, { mood: MOOD.wow, pucker: 1, mouth: .4 }, { mood: MOOD.star, mouth: .8, laugh: 1 }], 2.3),
  }),
  ({ pose, MOOD }) => ({                                                                             // 4
    name: '嘴型和别的：微笑、张嘴、噘嘴、猫嘴、大笑、半眨、单眨、看左上、皱眉', cam: wide(9, 2.3),
    cast: row(pose, [
      {}, { mouth: .6 }, { pucker: 1 }, { cat: 1 }, { mouth: 1, laugh: 1, mood: MOOD.joy }, { blink: .6 }, { wink: 1, mouth: .5 }, { look: [-1, .8] }, { brow: 1, mouth: .2 },
    ], 2.3),
  }),
  ({ pose }) => ({ name: '背面和侧面', cam: wide(5, 2.6), cast: row(pose, [{ yaw: 180 }, { yaw: 135 }, { yaw: 90 }, { yaw: 40 }, { yaw: -60, kit: 'cap' }], 2.6) }),   // 5
  ({ pose, MOOD, KIT_NAMES }) => ({                                                                  // 6
    name: '人群：56 只', cam: { p: [0, 4.6, 18.5], q: [0, 1.2, -1.5] },
    cast: Array.from({ length: 56 }, (_, i) => {
      const lead = i < 16, x = lead ? (i % 8 - 3.5) * 1.4 : 20 * (rnd(i * 2.3) - .5), z = lead ? (i < 8 ? 2.5 : -1) : -9 * rnd(i * 4.9) + 1, s = lead ? .56 : .4 + .1 * rnd(i * 6.1);
      return { kit: KIT_NAMES[i % 7], steps: lead ? 42 : 24, at: t => pose(UP, { x, z, s, yaw: 20 * (rnd(i * 7.3) - .5), mood: MOOD.joy, mouth: .5, y: .34 * Math.abs(Math.sin(Math.PI * (t + rnd(i) * .3) / .6)) }) };
    }),
  }),
  ({ pose, MOOD }) => ({                                                                             // 7
    name: '落地前后（每只晚 0.035 秒）', cam: wide(9, 2.4, 1.6),
    cast: row(pose, Array.from({ length: 9 }, (_, i) => t => ({ y: hop(t + .5 + i * .035), mood: MOOD.joy, mouth: .5, ...UP })), 2.4),
  }),
  ({ pose, MOOD }) => ({                                                                             // 8
    name: '换眼神的过程：睁眼 → 笑眼（每只晚 0.03 秒）', cam: wide(8, 2.3),
    cast: row(pose, Array.from({ length: 8 }, (_, i) => t => ({ mood: t + i * .03 > 1 ? MOOD.joy : MOOD.open, mouth: t + i * .03 > 1 ? .6 : 0 })), 2.3),
  }),
  ({ pose, KIT_NAMES }) => ({ name: '头饰近看（前四种）', cam: { p: [0, 2.6, 7.2], q: [0, 1.7, 0] }, cast: row(pose, KIT_NAMES.slice(0, 4).map(kit => ({ kit, yaw: -12 })), 2.5) }),   // 9
  ({ pose, KIT_NAMES }) => ({ name: '头饰近看（后三种）', cam: { p: [0, 2.6, 6.2], q: [0, 1.7, 0] }, cast: row(pose, KIT_NAMES.slice(4).map(kit => ({ kit, yaw: 12 })), 2.6) }),     // 10
  closeup('pin', 150, '主角背面近看'),                                                                // 11
  split('分裂的连续帧：分开后 0.03 / 0.07 / 0.10 / 0.13 秒', [.03, .07, .1, .13], { p: [0, 3.2, 21], q: [0, 1, 0] }),   // 12
  split('分裂的连续帧：分开后 0.17 / 0.21 / 0.25 / 0.33 秒', [.17, .21, .25, .33], { p: [0, 3.2, 21], q: [0, 1, 0] }),  // 13
  split('分裂近看：刚拉开、拉成丝', [.06, .15], { p: [0, 2.2, 10.5], q: [0, 1.1, 0] }, 8.4),           // 14
  split('分裂近看：刚断、回弹', [.215, .27], { p: [0, 2.2, 10.5], q: [0, 1.1, 0] }, 8.4),             // 15
  () => ({ name: '空场（量耗时用的对照）', cam: { p: [0, 4.6, 18.5], q: [0, 1.2, -1.5] }, cast: [] }),   // 16
  ({ pose, KIT_NAMES }) => ({                                                                         // 17
    name: '摆动：七种头饰，左右猛晃、带转身', cam: wide(7, 3, 1.5),
    cast: row(pose, KIT_NAMES.map((kit, i) => Object.assign(t => ({ x: .9 * Math.sin(t * 8 + i), yaw: 35 * Math.sin(t * 6 + i * 2) }), { kit })), 3),
  }),
  ({ pose }) => ({                                                                                    // 18
    name: '走路循环：一圈八个相位', cam: wide(8, 2.4),
    cast: row(pose, Array.from({ length: 8 }, (_, i) => () => ({ walk: i / 8, stride: .3, yaw: 30 })), 2.4),
  }),
];

// 分裂：照 main.js 里 clonePose 的走法摆一对小蟹（老的往左让，新的从它身上挤出来往右），times 里每个时刻摆一对
function split(name, times, cam, gap = 6.2) {
  const spots = times.map((u, i) => [(i - (times.length - 1) / 2) * gap, 0]);
  return ({ pose, MOOD }) => ({
    name, cam,
    cast: times.flatMap((u0, i) => [-1, 1].map(sd => ({
      kit: sd < 0 ? 'pin' : 'douli',
      at: t => {
        const u = u0 + t - 1, k = ease.back(prog(u, 0, .36)), born = sd > 0;                          // 时间 1 秒时正好是表上标的时刻，回看的那段历史是真实的
        if (u < 0) return born ? pose({ s: 0 }) : pose({ x: spots[i][0], z: spots[i][1], s: 1.15, sq: -.32 * prog(u, -.09, 0) });
        return pose(u < .45 ? UP : {}, {
          x: spots[i][0] + sd * 1.5 * k, z: spots[i][1] - (born ? .1 * (1 - prog(u, 0, .12)) : 0), s: lerp(1.15 * (born ? .9 : 1), .95, prog(u, 0, .3)),
          y: .5 * Math.sin(Math.PI * prog(u, 0, .36)), sq: .22 * pulse(u, .1, .12), lean: sd * 10 * (1 - prog(u, 0, .4)), mood: MOOD.joy, mouth: .7,
        });
      },
    }))),
    extra: (group, crabs) => {
      const bonds = times.map(() => { const b = new Bond(); group.add(b.root); return b; });
      return t => bonds.forEach((b, i) => b.update(crabs[i * 2], crabs[i * 2 + 1], times[i] + t - 1));
    },
  });
}
