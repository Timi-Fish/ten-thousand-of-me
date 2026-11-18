// 分裂时连着两只小蟹的那团软东西：一只「啵」地分成两只时，两边的脸颊被扯出一个尖，中间连着一段越拉越细的丝，
// 到点断开，两截各自缩回去，脸颊回弹着抖几下，断口甩出一小滴。
// 全部只取决于「分开后过了多久」和两只小蟹此刻的位置，所以仍是时间的纯函数。
import * as THREE from 'three';
import { clamp } from '../anim.js';
import { grid, ball, dress, join } from './geo.js';
import { layers } from './shade.js';
import { warp } from './deform.js';
import { BW, BH, BD, PULL } from './pose.js';
import { SKIN } from './palette.js';

const SNAP = .2, RECOIL = .5;                                     // 分开后多久拉断；断了以后脸颊还要抖多久
const RETRACT = .09, DROP = .22;                                  // 断了以后丝多久缩完；那一小滴多久消失
const NS = 16, NR = 12;                                           // 每半截丝：沿长度几段、绕一圈几段
const ROOT = .32, ROOT_R = .3;                                  // 丝的根埋进身体多深、根上多粗（按身体的尺寸算）
const V = () => new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
const A = V(), B = V(), dir = V(), back = V(), e1 = V(), e2 = V(), at = V(), n = V(), tmp = V(), inv = new THREE.Matrix4();
const smooth = k => { k = clamp(k); return k * k * (3 - 2 * k); };

// 从一只小蟹的身体中心朝 toward（世界方向）看出去：s 这只的大小，r 身体表面离中心多远，local 这个方向在它自己坐标里是哪边
function reach(crab, toward) {
  const S = crab.shape, s = crab.root.scale.x, l = tmp.copy(toward).transformDirection(inv.copy(crab.jelly.matrixWorld).invert());
  const r = (Math.abs(l.x / (BW / 2 * S.sq[1])) ** 3.5 + Math.abs(l.y / (BH * .45 * S.sq[0])) ** 3.5 + Math.abs(l.z / (BD / 2 * S.sq[1])) ** 3.5) ** (-1 / 3.5);
  return { s, r: r * s, local: [l.x, l.y, l.z] };
}
const cheek = (crab, out) => out.fromArray(warp([0, PULL.y, 0], crab.shape)).applyMatrix4(crab.jelly.matrixWorld);   // 被扯的那个高度上，身体的中心

export class Bond {
  constructor() {
    this.root = new THREE.Group();                                   // 加进场景，不用摆位置：里面的东西直接按世界坐标算
    const half = () => dress(grid(NR, NS, () => [0, 0, 0]), { col: SKIN.body }), drop = dress(ball(1, 10), { col: SKIN.body, ink: .8 });
    this.ball = Float32Array.from(drop.attributes.position.array);   // 那一小滴：单位球，每帧缩放、挪位置
    this.geo = join(half(), half(), drop);
    this.u = { uLine: V() };
    layers(this.geo, 'plain', this.root, this.u);
    this.root.visible = false;
  }

  // a、b：分开的两只小蟹（这一帧都已经 update 过）；u：分开后过了多少秒。不在分裂过程中时自己藏起来
  update(a, b, u) {
    this.root.visible = false;
    if (u < 0 || u > SNAP + RECOIL || !a.root.visible || !b.root.visible) return;
    const D = dir.subVectors(cheek(b, B), cheek(a, A)).length();
    if (D < 1e-3) return;
    dir.divideScalar(D); back.copy(dir).negate();
    const ra = reach(a, dir), rb = reach(b, back), s = (ra.s + rb.s) / 2;
    const gap = (D - ra.r - rb.r) / s, tau = u - SNAP, joined = tau < 0;               // gap：两个身体表面之间隔多远（按身体的尺寸算）
    // 脸颊被扯出多远：连着的时候越分开扯得越远；断了以后回弹着抖几下
    const held = .14 + .36 * smooth(gap / .9 + .3), swing = Math.cos(40 * tau), pull = joined ? held : held * Math.exp(-13 * tau) * (swing > 0 ? swing : .5 * swing);   // 往回瘪的那半下轻一点
    a.tug(ra.local.map(c => c * pull)); b.tug(rb.local.map(c => c * pull));
    if (tau > DROP) return;

    // 丝：两个半截，各从身体里面伸出来。连着时在正中接上，越拉越细、微微下垂；断了以后各自缩回去，梢上带一个小疙瘩
    e1.copy(UP).addScaledVector(dir, -UP.dot(dir)).normalize(); e2.crossVectors(dir, e1);
    const P = this.geo.attributes.position, N = this.geo.attributes.normal, H = this.geo.attributes.aHull, row = NR + 1;
    const mid = (ra.r + D - rb.r) / 2, thin = s * (.5 - .44 * smooth((gap + .5) / 1.4)) * (1 - .6 * clamp(u / SNAP) ** 3);
    const bead = joined ? .055 * s * smooth((gap - .35) / .5) : 0;                         // 丝拉长以后，正中鼓起一颗小珠
    const sag = joined ? .1 * s * clamp(gap) : 0, left = joined ? 1 : 1 - smooth(tau / RETRACT), power = 2 + 2.5 * clamp(gap);
    [[ra, 1, A, mid], [rb, -1, B, D - mid]].forEach(([me, sign, origin, tip], k) => {
      const x0 = me.r - ROOT * me.s, len = Math.max(1e-3, (tip - x0) * left), R0 = ROOT_R * me.s;
      const radius = m => (joined ? thin + (R0 - thin) * (1 - m) ** power + bead * Math.exp(-(((1 - m) / .1) ** 2))
        : R0 * (1 - m) ** 2.4 + .06 * me.s * left * Math.sqrt(Math.max(0, 1 - ((m - .86) / .14) ** 2)));
      for (let j = 0; j <= NS; j++) {
        const m = j / NS, x = x0 + m * len, r = radius(m), slope = (radius(Math.min(1, m + .02)) - radius(Math.max(0, m - .02))) / (.04 * len);
        at.copy(origin).addScaledVector(dir, sign * x).addScaledVector(UP, -sag * Math.sin(Math.PI * (sign > 0 ? x : D - x) / D));
        for (let i = 0; i <= NR; i++) {
          const ang = sign * i / NR * 2 * Math.PI, v = k * row * (NS + 1) + j * row + i;
          n.set(0, 0, 0).addScaledVector(e1, Math.cos(ang) * 1.1).addScaledVector(e2, Math.sin(ang));
          P.setXYZ(v, at.x + n.x * r, at.y + n.y * r, at.z + n.z * r);
          n.normalize().addScaledVector(dir, -sign * slope).normalize();
          N.setXYZ(v, n.x, n.y, n.z); H.setXYZ(v, n.x, n.y, n.z);
        }
      }
    });
    // 断口甩出的一小滴：往上一跳，落下去，越来越小
    const first = 2 * row * (NS + 1), size = joined ? 0 : .075 * s * (1 - tau / DROP) ** .7;
    at.copy(A).addScaledVector(dir, mid).addScaledVector(UP, joined ? 0 : s * (1.6 * tau - 9 * tau * tau));
    for (let i = 0; i < this.ball.length / 3; i++) {
      const x = this.ball[i * 3], y = this.ball[i * 3 + 1], z = this.ball[i * 3 + 2];
      P.setXYZ(first + i, at.x + x * size, at.y + y * size, at.z + z * size); N.setXYZ(first + i, x, y, z); H.setXYZ(first + i, x, y, z);
    }
    P.needsUpdate = N.needsUpdate = H.needsUpdate = true;
    this.u.uLine.set(.016 * s, 1.5, 4.6);
    this.root.visible = true;
  }
}
