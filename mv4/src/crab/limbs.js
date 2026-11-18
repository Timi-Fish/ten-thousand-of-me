// 两只小短手、四条小腿：圆滚滚的，没有手指。每一截挂在一根「骨头」上（一个变换矩阵），画的时候由骨头摆到位。
// 骨头编号：0、1 左右手；2–5 四条腿；6–9 四只脚。
import * as THREE from 'three';
import { TAU, D } from '../anim.js';
import { dress, lathe, ball, put, join, blend } from './geo.js';
import { SKIN, CLOTH } from './palette.js';

export const ARM = [.88, .64, .26];                              // 小短手长在身体上的位置：[横向, 离身体底的高度, 向前]
export const HIPS = [[-.6, .34], [-.6, -.34], [.6, .34], [.6, -.34]];   // 四条腿在身体底下的位置 [x, z]
const REACH = .35, ANKLE = .08;                                  // 造型时小短手从肩到手尖的长度；脚踝离脚底多高
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), X = V(1), Y = V(0, 1);
const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), dir = V(), from = V(), tip = V(), size = V();

// 四肢的网格。q：精细程度（1 或 0.5）
export function limbs(q) {
  const seg = Math.round(20 * q), sideways = { rot: [0, 0, -Math.PI / 2] };          // 旋出来的形状竖着，放倒成沿手臂的方向
  const arm = id => [
    // 袖子：从肩往袖口渐渐张开，袖口往里翻一圈
    put(dress(lathe([[.07, -.08], [.1, 0], [.118, .1], [.14, .185], [.147, .2], [.14, .212], [.118, .205], [.09, .17]], seg), { col: CLOTH.robe, id }), sideways),
    // 袖口的镶边：一圈回纹
    put(dress(lathe([[.128, .128], [.146, .132], [.156, .198], [.15, .214], [.138, .216]], seg), { col: CLOTH.trim, tint: CLOTH.gold, pat: 1, id, uv: ([u, v]) => [u * 8, v] }), sideways),
    put(dress(ball([.118, .11, .11], Math.round(16 * q)), { col: SKIN.body, id }), { at: [.24, 0, 0] }),       // 圆圆的小手
  ];
  // 腿：造型时从脚踝（y = 0）到胯（y = 1），骨头把它拉到实际长度；往下颜色深一点
  const leg = id => dress(lathe([[.092, -.1], [.098, .3], [.108, .8], [.112, 1.15]], Math.round(14 * q)), { col: at => blend(SKIN.deep, SKIN.body, Math.min(1, at[1] * 1.4 + .2)), id });
  const foot = id => put(dress(ball([.14, .095, .165], Math.round(16 * q)), { col: SKIN.body, id }), { at: [0, .085, .035] });
  return join([0, 1].map(arm), [2, 3, 4, 5].map(leg), [6, 7, 8, 9].map(foot));
}

// 算出四肢的骨头，写进 bones（一串 4×4 矩阵，在「离地」那一层的坐标里）。
//   p 姿势；jelly 身体整体的转动和抬高；anchor(点) 把身体上没变形的一点搬到变形后的位置；lag 上半截的落后量；spread 身体底部横向胀了多少
export function poseLimbs(bones, p, { jelly, anchor, lag, spread }) {
  const ph = TAU * p.walk, swing = 12 * p.stride / .3 * Math.sin(ph);
  [p.aL, p.aR].forEach(([ang, len, fwd], i) => {
    const sd = i ? 1 : -1, a = (ang - sd * swing) * D;
    from.fromArray(anchor([sd * ARM[0], ARM[1], ARM[2]]));
    tip.set(from.x + sd * Math.cos(a) * len - lag[0] * .25, from.y + Math.sin(a) * len - lag[1] * .25, from.z + fwd - lag[2] * .25);
    const reach = dir.subVectors(tip, from).length();
    m4.compose(from, q4.setFromUnitVectors(X, dir.divideScalar(reach)), size.set((reach + .11) / REACH, 1, 1)).premultiply(jelly).toArray(bones, i * 16);
  });
  const hang = Math.min(1, p.y / .2);                               // 腾空时四条腿垂下来，跟着身体甩
  HIPS.forEach(([x, z], i) => {
    const a = ph + (i % 2) * Math.PI;
    tip.set(x * spread + p.stride * Math.sin(a) - lag[0] * .4 * hang, Math.max(0, Math.cos(a)) * p.stride * .4 + hang * .06, z * spread - lag[2] * .4 * hang);   // 脚底
    m4.makeRotationY(Math.sign(x) * .22).setPosition(tip).toArray(bones, (6 + i) * 16);
    tip.y += ANKLE;
    from.fromArray(anchor([x * .9, .1, z * .9])).applyMatrix4(jelly);                                                                                           // 胯
    const len = Math.max(.02, dir.subVectors(from, tip).length());
    m4.compose(tip, q4.setFromUnitVectors(Y, dir.divideScalar(len)), size.set(1, len, 1)).toArray(bones, (2 + i) * 16);
  });
}
