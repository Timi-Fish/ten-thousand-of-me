// 弹性。一切都得是时间的纯函数，所以不存上一帧的状态：每次把最近一小段时间的姿势从头重演一遍，
// 让几根弹簧跟着跑，跑到当前时刻时它们落后、冲过头的量就是这一帧的弹性。
// 同一趟重演里顺便做两件也要「回看过去」的事：把嘴型和视线抹平一点；找出眼神是什么时候换的。
import { D, clamp } from '../anim.js';
import { BH, LEG } from './pose.js';

const STEP = 1 / 60;
// 每根弹簧：[硬度, 阻尼]。硬度越大抖得越快，阻尼越大停得越快
const BODY = [260, 9], RIPPLE = [1500, 13], DANGLE = [110, 6], HAIR = [620, 8], TWIST = [200, 9], SHAPE = [420, 9];
const EASE = 1 - Math.exp(-STEP / .045);                         // 嘴型、视线每一步向目标靠多少
const SMOOTHED = ['mouth', 'pucker', 'cat', 'laugh', 'brow', 'blush'];

// 一根弹簧拴着 q 追 target（都是数组）
function chase(s, target, [stiff, damp]) {
  for (let k = 0; k < target.length; k++) { s.v[k] += (stiff * (target[k] - s.q[k]) - damp * s.v[k]) * STEP; s.q[k] += s.v[k] * STEP; }
}
const spring = at => ({ q: [...at], v: at.map(() => 0) });
const rest = (s, at, k) => { for (let i = 0; i < at.length; i++) { s.q[i] = at[i] + (s.q[i] - at[i]) * k; s.v[i] *= k; } };
// 脚底和头顶在世界里的位置（头顶跟着歪、俯走）
function points(p) {
  const H = (BH + LEG) * p.s, c = Math.cos(p.yaw * D), s = Math.sin(p.yaw * D), lean = Math.sin(p.lean * D) * H, nod = Math.sin(p.pitch * D) * H;
  return { foot: [p.x, p.y, p.z], head: [p.x + lean * c + nod * s, p.y + H * Math.cos(p.lean * D), p.z - lean * s + nod * c] };
}
const local = (w, p, lim) => { const c = Math.cos(p.yaw * D), s = Math.sin(p.yaw * D), k = 1 / p.s; return [clamp((w[0] * c - w[2] * s) * k, -lim, lim), clamp(w[1] * k, -lim, lim), clamp((w[0] * s + w[2] * c) * k, -lim, lim)]; };
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

// poseAt(时刻) 返回姿势；steps：回看多少步。返回这一刻的各种弹性量（都换算到身体自己的坐标、身体自己的尺寸）
export function replay(poseAt, t, steps) {
  let body, ripple, dangle, hair, twist, shape, face, seen = false, mood = 0, moodFrom = 0, changedAt = -1e9, p, at;
  for (let i = steps; i >= 0; i--) {
    p = poseAt(t - i * STEP);
    if (p.s <= .01) { seen = false; continue; }
    at = points(p);
    const now = Math.round(p.mood);
    if (!seen) {                                                  // 刚出现（或回看的起点）：所有弹簧从静止开始
      body = spring(at.foot); ripple = spring([p.y]); dangle = spring(at.head); hair = spring(at.head); twist = spring([p.yaw]); shape = spring([p.sq, p.puff]);
      face = { look: [...p.look] };
      for (const k of SMOOTHED) face[k] = p[k];
      mood = moodFrom = now; changedAt = -1e9; seen = true;
      continue;
    }
    chase(body, at.foot, BODY); chase(ripple, [p.y], RIPPLE); chase(dangle, at.head, DANGLE); chase(hair, at.head, HAIR); chase(twist, [p.yaw], TWIST); chase(shape, [p.sq, p.puff], SHAPE);
    const k = clamp((steps - i) / (steps * .3));                  // 回看窗口最早的那一段只算一部分，免得很久以前的一次落地在窗口边上突然消失
    if (k < 1) { rest(body, at.foot, k); rest(ripple, [p.y], k); rest(dangle, at.head, k); rest(hair, at.head, k); rest(twist, [p.yaw], k); rest(shape, [p.sq, p.puff], k); }
    for (const key of SMOOTHED) face[key] += (p[key] - face[key]) * EASE;
    face.look[0] += (p.look[0] - face.look[0]) * EASE; face.look[1] += (p.look[1] - face.look[1]) * EASE;
    if (now !== mood) { moodFrom = mood; mood = now; changedAt = t - i * STEP; }
  }
  if (!seen) return null;
  return {
    lag: local(sub(body.q, at.foot), p, .55),                     // 上半截落后脚底多少
    ripple: clamp((ripple.q[0] - p.y) / p.s, -.3, .3),            // 落地后沿身体跑的波纹
    dangle: local(sub(dangle.q, at.head), p, .9), hair: local(sub(hair.q, at.head), p, .5),   // 飘带穗子、毫毛落后头顶多少
    twist: clamp((twist.q[0] - p.yaw) * D, -.7, .7),              // 上半截比脚底少转了多少
    sq: p.sq - shape.q[0], puff: p.puff - shape.q[1],             // 压扁、鼓气变得太快时冲过头的量
    face, moodFrom, moodAge: t - changedAt,
  };
}
