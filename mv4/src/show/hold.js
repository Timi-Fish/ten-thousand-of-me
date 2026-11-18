// 拿纸：小蟹抱着、捧着、举着、盖着的那张薄纸放在哪、朝哪，按它此刻的身体算出来（各段共用）。
// 纸的位置先在「身体坐标」里说（原点在身体底面正中，y 朝头顶，z 朝脸的前方，单位是没乘大小的身体尺寸），再换到世界里；
// 这样身体怎么转、俯、歪、压扁、鼓气，纸都跟着走，并且总在 body.js 的近似身体外面留一道缝，不会被薄纸的自动避让推开。
// 用法：const b = bodyNow(crab, poseAt, t); slips.put({ ...place(b, grip.hug(b, size)), size, kind });
import * as THREE from 'three';
import { D } from '../anim.js';
import { BH, FACE } from '../crab/pose.js';
import { SLIP } from './slips.js';
import { bodyOf } from './body.js';

const GAP = .16, CROWN = .45, WEAR = .12;                             // 纸离身体表面留多远（比自动避让的 0.13 稍大，世界单位）；头顶毫毛和头饰占多高（同 body.js）；袍子上的腰绳和绳结鼓出身体多少（身体坐标）
const v3 = new THREE.Vector3(), p3 = new THREE.Vector3(), q4 = new THREE.Quaternion(), qBody = new THREE.Quaternion(), s3 = new THREE.Vector3(), eu = new THREE.Euler(0, 0, 0, 'YXZ');

// 先按这一刻的姿势把小蟹摆好，再量它的身体（这一帧稍后总调度会用同一个姿势再摆一次，结果相同）
export function bodyNow(crab, poseAt, t) {
  crab.update(poseAt, t);
  return bodyOf(crab, '');
}
// 身体此刻的几个尺寸（身体坐标）：H 高、F 前脸离竖轴多远、W 半宽、gap 留缝、side 贴着身体侧面时要让开多远（留缝加上袍子：腰绳、正面的绳结、背后的蝴蝶结都比身体鼓出去一截）、
// floor 地面、eyes 眼睛那一行的下沿、crown 头顶毫毛和头饰的顶
export function dims(b) {
  const H = 2 * b.half[1], k = H / BH;
  return { H, F: b.half[2], W: b.half[0], gap: GAP / b.s, side: GAP / b.s + WEAR, floor: -(b.crab.jelly.matrix.elements[13] + b.crab.lift.position.y) + .03 / b.s, eyes: (FACE.eyeY - .15) * k, crown: H + CROWN };
}
// 身体坐标里的一张纸 { at: [x, y, z], rot: [俯仰, 转向, 侧倾]（度，同 slips.put，0 是竖着、字朝 +z） } → 世界里的 { at, rot }
export function place(b, { at, rot }) {
  const world = v3.fromArray(at).applyMatrix4(b.out).toArray();
  b.out.decompose(p3, qBody, s3);
  eu.setFromQuaternion(q4.copy(qBody).multiply(new THREE.Quaternion().setFromEuler(eu.set(rot[0] * D, rot[1] * D, rot[2] * D))), 'YXZ');
  return { at: world, rot: [eu.x / D, eu.y / D, eu.z / D] };
}
// 这只小蟹的一只手（side -1 是左手 aL，1 是右手 aR）此刻在世界里的位置（THREE.Vector3）。要在它这一帧 update 过之后调。
// 手是挂在骨头上的一个小圆球：骨头 0 是左手、1 是右手，圆球在骨头自己的坐标里 x = 0.24 处
export function handOf(crab, side) {
  return new THREE.Vector3(.24, 0, 0).applyMatrix4(new THREE.Matrix4().fromArray(crab.u.uBone, side < 0 ? 0 : 16)).applyMatrix4(crab.lift.matrixWorld);
}
const halfOf = (b, size) => [SLIP.w / 2 * size / b.s, SLIP.h / 2 * size / b.s];   // 纸的半宽、半高（身体坐标）

// 几种拿法：给身体和纸的大小（世界单位），返回身体坐标里的纸
export const grip = {
  // 竖着贴在身体的某一面，字朝外：face 是方位（度；0 正前方，90 它的右侧 +x，180 背后，-90 左侧），y 是纸中心的高度。
  // 斜着贴在两面之间时，方块的棱角更靠外，纸要多让开一点
  around(b, face, y) {
    const d = dims(b), a = face * D, more = .3 * Math.abs(Math.sin(2 * a));
    return { at: [(d.W + d.side + more) * Math.sin(a), y, (d.F + d.side + more) * Math.cos(a)], rot: [0, face, 0] };
  },
  // 一只手拿着、竖在身体旁边，字朝外：side -1 在它左边（aL 那只手），1 在右边；y 是纸中心的高度；face 是纸面朝哪（度，0 朝它的正前方）。
  // 纸靠身体的那条边贴着身体侧面（让开袍子），手就在那条边上
  beside(b, size, side, y, face = 0) {
    const d = dims(b), [w] = halfOf(b, size), a = face * D;
    return { at: [side * (d.W + d.side + w * Math.cos(a)), y, -side * w * Math.sin(a)], rot: [0, face, 0] };
  },
  // 抱在胸前，字朝外：两手按着纸的两边，纸的上沿在眼睛下面（纸大时会盖住嘴），下沿不碰地
  hug(b, size, face = 0) {
    const d = dims(b), [, h] = halfOf(b, size);
    return grip.around(b, face, Math.max(d.floor + h, Math.min(d.eyes, FACE.mouthY * d.H / BH + .06) - h));
  },
  // 捧在身前读，字朝着它自己：两手捏着靠身体的那条边，纸往前斜着伸出去。tilt 是俯仰（-90 平躺，越接近 0 越竖）；
  // hands 是手捏的那条边有多高（没压扁时的身体坐标）；out 是再往前递出去多远（举远了端详）
  read(b, size, tilt = -76, hands = .5, out = 0) {
    const d = dims(b), [, h] = halfOf(b, size), a = tilt * D, top = [0, Math.cos(a), -Math.sin(a)];       // 纸的上沿朝哪（身体坐标）
    const near = [0, hands * d.H / BH, d.F + d.side + out];
    return { at: near.map((v, i) => v + h * top[i]), rot: [tilt, 180, 0] };
  },
  // 举在脸的上前方，字朝着它自己（从它背后能读到）：两手捏着纸的下沿，下沿在头顶那么高；lean 是上沿往后仰多少度
  lift(b, size, lean = 8) {
    const d = dims(b), [, h] = halfOf(b, size), a = lean * D;
    return { at: [0, .92 * d.H + h * Math.cos(a), d.F + d.side - h * Math.sin(a)], rot: [lean, 180, 0] };
  },
  // 平盖在头顶上（搭在毫毛和头饰上），字朝上，纸的上沿朝背后；turn 是绕竖轴再转多少度（90 就是横着盖：纸的宽沿着身体前后）。
  // curl 小于 0 时纸的两边往下垂：垂下去的部分要在头饰占的那块地方之外，所以整张纸再抬高一点
  over(b, size, turn = 0, curl = 0) {
    const d = dims(b), [w] = halfOf(b, size), across = Math.abs(Math.sin(turn * D)) > .5 ? .7 * d.F : .8 * d.W;   // 纸的宽这个方向上，头饰占的那块地方有多宽（同 body.js）
    const u = SLIP.w / 2 * Math.min(1, across / w), droop = Math.abs(curl) * (1.1 * u * u + .1) * size / b.s;   // 卷曲里还带一道沿纸长方向的小波纹（0.1）
    return { at: [0, d.crown + d.gap + .02 + droop, 0], rot: [-90, turn, 0] };
  },
};
// 几种拿法配的两只手：[角度, 长度, 往前伸多少]（同姿势里的 aL / aR）
export const HANDS = {
  hug: [-160, .44, .86],                                              // 两手往中间合，按在纸的两边
  read: [-157, .49, .74],                                             // 两手在身前捏着纸靠身体的那条边
  lift: [123, .85, .86],                                              // 两手举到头顶那么高，捏着纸的下沿
};
// 两种拿法之间过渡：位置直接插值，朝向走四元数球面插值（欧拉角直接插值会绕远路）。
// 身体坐标里过渡时给 body：中途沿「身体中心 → 纸」的方向再往外让 bump，免得直线插值抄近路穿过身体的棱角
export function blend(a, c, k, body = null, bump = 0) {
  const qa = new THREE.Quaternion().setFromEuler(eu.set(a.rot[0] * D, a.rot[1] * D, a.rot[2] * D)), qc = new THREE.Quaternion().setFromEuler(eu.set(c.rot[0] * D, c.rot[1] * D, c.rot[2] * D));
  eu.setFromQuaternion(qa.slerp(qc, k), 'YXZ');
  const at = a.at.map((v, i) => v + (c.at[i] - v) * k);
  if (body) {
    const out = v3.set(at[0], at[1] - body.half[1], at[2]).normalize().multiplyScalar(bump * Math.sin(Math.PI * k));
    at[0] += out.x; at[1] += out.y; at[2] += out.z;
  }
  return { at, rot: [eu.x / D, eu.y / D, eu.z / D] };
}
// 按时刻走一串拿法：keys 是 [[时刻, 拿法], ...]，相邻两个之间按 io 缓动过渡（身体坐标里，带 bump 往外让）
export function along(t, keys, body, bump = .25) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, s1] = keys[i], [t0, s0] = keys[i - 1];
    if (t <= t1) { const k = t1 > t0 ? (t - t0) / (t1 - t0) : 1; return blend(s0, s1, k * k * (3 - 2 * k), body, bump); }
  }
  return keys[keys.length - 1][1];
}
