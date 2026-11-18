// 小蟹的身体占了哪块地方：给「薄纸自动避让」和「穿模检查」用的近似。
// 身体当成一个圆角方块（鼓气时趋向球），按它此刻的压扁、拉长、鼓气算；头顶再加一块毫毛和头饰占的地方。手和腿不算。
import * as THREE from 'three';
import { lerp } from '../anim.js';
import { BW, BH, BD } from '../crab/pose.js';

const CROWN = .45, v = new THREE.Vector3();                           // 头顶上毫毛和头饰大约占多高

// crab 这一帧已经 update 过。返回它的身体：half 三个方向的半长（身体自己的尺寸，没乘大小），e 圆角的指数（越小越圆），
// out / inv 身体坐标和世界坐标互转（身体坐标的原点在身体底面正中），s 大小，at 身体中心在世界里的位置
export function bodyOf(crab, name) {
  const S = crab.shape.sq, wide = S[1] * (1 + .5 * S[2]), half = [BW / 2 * wide, BH * S[0] / 2, BD / 2 * wide];
  const out = crab.jelly.matrixWorld, inv = new THREE.Matrix4().copy(out).invert();
  return { name, crab, s: crab.root.scale.x, half, e: lerp(4, 2.3, S[3]), out, inv, at: new THREE.Vector3(0, half[1], 0).applyMatrix4(out) };
}
// 世界里的一点 p（THREE.Vector3）陷进这个身体多深（世界单位；不大于 0 就是在外面）。pad：把身体往外胀多少再量
export function sunk(body, p, pad = 0) {
  const [hx, hy, hz] = body.half, k = pad / body.s, l = v.copy(p).applyMatrix4(body.inv);
  const f = (Math.abs(l.x) / (hx + k)) ** body.e + (Math.abs(l.y - hy) / (hy + k)) ** body.e + (Math.abs(l.z) / (hz + k)) ** body.e;
  const inBody = (1 - f ** (1 / body.e)) * Math.min(hx, hy, hz) * body.s;
  // 头顶那一块：一个矮柱子
  const up = l.y - 2 * hy, inCrown = up >= 0 && up < CROWN + k && Math.abs(l.x) < .8 * hx + k && Math.abs(l.z) < .7 * hz + k ? (CROWN + k - up) * body.s : 0;
  return Math.max(inBody, inCrown);
}
// 从这个身体里把一样东西推出去该朝哪个方向（世界里的单位向量）：东西的中心在头顶上方就往上推，否则沿水平方向从身体的竖轴往外推
export function wayOut(body, center, fallback) {
  const l = v.copy(center).applyMatrix4(body.inv), flat = Math.hypot(l.x, l.z);
  const dir = l.y > 2 * body.half[1] - .1 ? new THREE.Vector3(0, 1, 0) : flat > .05 ? new THREE.Vector3(l.x / flat, 0, l.z / flat) : fallback.clone().applyMatrix4(new THREE.Matrix4().extractRotation(body.inv));
  return dir.transformDirection(body.out);
}
