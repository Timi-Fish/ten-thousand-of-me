// Claude 小蟹（3D 卡通）：一块会弹的软方块，穿着交领小袍，两只小短手、四条小腿、头顶三根毫毛，外加七种古风头饰。平涂上色，深色描边。
// 这里是入口：对外的接口，以及每一帧把「姿势」变成画面的那一步。各部件在 crab/ 目录下：
//   pose 姿势参数 · shape 身体造型 · deform 软体变形 · spring 弹性 · face 表情 · shade 上色和描边 · patterns 纹样 · palette 配色
//   geo 造型工具 · build 组装 · wear 衣服 · limbs 四肢 · kits（kits-pins、kits-hats、parts）头饰 · bond 分裂时的拉丝
//   preview.html、preview.js、preview-sheets.js 是出静帧自查用的检查表，影片不加载它们
import * as THREE from 'three';
import { TAU, D, clamp } from './anim.js';
import { REST, MOOD, pose, BH, BD, LEG, FACE, PULL } from './crab/pose.js';
import { warp } from './crab/deform.js';
import { replay } from './crab/spring.js';
import { express } from './crab/face.js';
import { layers, BONES } from './crab/shade.js';
import { assets } from './crab/build.js';
import { KIT_NAMES } from './crab/kits.js';
import { poseLimbs } from './crab/limbs.js';

export { REST, MOOD, pose, KIT_NAMES };
export { Bond } from './crab/bond.js';

const LITE_BELOW = 30;                                             // 回看步数不到这个数的（人群）用精简档的网格
const euler = new THREE.Euler(), V4 = (...v) => new THREE.Vector4(...v), V3 = () => new THREE.Vector3();

export class Crab {
  // kit：头饰（KIT_NAMES 里的名字）；steps：弹性回看多少步（人群用少一点，同时换成精简档）
  constructor(kit = 'pin', steps = 42) {
    this.steps = steps;
    this.root = new THREE.Group();                                 // 位置、朝向、大小
    this.lift = new THREE.Group();                                 // 离地高度
    this.jelly = new THREE.Group();                                // 身体整体的歪、俯，和身体底面离脚底的高度
    this.jelly.matrixAutoUpdate = false;
    this.root.add(this.lift); this.lift.add(this.jelly);
    // 这只小蟹自己的量：shape 是这边算位置用的，u 是画的时候交给材质的
    this.shape = { sq: [1, 1, 0, 0], wave: [0, 0, 0, 0], bend: [0, 0, 0, 0], pull: [0, 0, 0, PULL.reach], pullAt: [0, 0, 0] };
    this.u = {
      uSq: V4(), uWave: V4(), uBend: V4(), uPull: V4(), uPullAt: V3(), uSwayA: V3(), uSwayB: V3(), uTime: 0,
      uEye: V4(0, 0, 1, 1), uGaze: V4(), uMouth: V4(), uFace: V4(0, 1, 0, 0), uBone: new Float32Array(16 * BONES), uLine: V3(), uGhost: 0,
    };
    const { soft, limb } = assets(kit, steps < LITE_BELOW);
    layers(soft, 'soft', this.jelly, this.u);
    layers(limb, 'limb', this.lift, this.u);
    this.lips = V3();                                              // 每帧更新：嘴在世界里的位置
  }

  // 朝 dir（身体自己的坐标）把身体扯出一个尖。Crab.update 每帧按姿势里的 pull 设一次；拉丝部件会在之后改写它
  tug(dir) {
    const len = Math.hypot(...dir), S = this.shape;
    S.pull = [dir[0], dir[1], dir[2], PULL.reach];
    S.pullAt = len > 1e-4 ? [dir[0] / len * .86, PULL.y + dir[1] / len * .3, dir[2] / len * .66] : [0, 0, 0];
    this.u.uPull.fromArray(S.pull); this.u.uPullAt.fromArray(S.pullAt);
  }

  // poseAt(时刻) 返回姿势；t 是当前时刻
  update(poseAt, t) {
    const p = poseAt(t), dyn = p.s > .01 ? replay(poseAt, t, this.steps) : null, S = this.shape, u = this.u;
    this.root.visible = dyn !== null;
    if (!dyn) return;
    this.root.position.set(p.x, 0, p.z); this.root.scale.setScalar(p.s); this.root.rotation.y = p.yaw * D;
    this.lift.position.y = p.y / p.s;

    // —— 软体：姿势里的压扁拉长、鼓气，加上弹簧给的落后和回弹 ——
    const lag = dyn.lag, puff = p.puff + .5 * dyn.puff, size = 1 + .2 * puff;
    const tall = clamp((1 + p.sq + .6 * dyn.sq) * (1 - 1.1 * lag[1] / BH), .45, 1.7);
    S.sq = [tall * size, size / Math.sqrt(tall), tall < 1 ? .9 * (1 - tall) : .35 * (tall - 1), clamp(.55 * puff, 0, .9)];   // 高了就瘦，矮了就胖，体积不变；矮的时候胖在底下
    S.wave = [.45 * dyn.ripple, -.3 * dyn.ripple, dyn.twist, .25 * clamp(-puff)];
    S.bend = [lag[0], lag[2], .3 * dyn.hair[0], .3 * dyn.hair[2]];
    u.uSq.fromArray(S.sq); u.uWave.fromArray(S.wave); u.uBend.fromArray(S.bend);
    const c = Math.cos(p.yaw * D), s = Math.sin(p.yaw * D), [px, py, pz] = p.pull;
    this.tug([(px * c - pz * s) / p.s, py / p.s, (px * s + pz * c) / p.s]);
    const hb = LEG * clamp(1 + 1.2 * Math.min(0, tall - 1), .35, 1) + .03 * p.stride / .3 * Math.abs(Math.cos(TAU * p.walk));
    this.jelly.matrix.makeRotationFromEuler(euler.set(p.pitch * D, 0, -p.lean * D)).setPosition(0, hb, 0);

    poseLimbs(u.uBone, p, { jelly: this.jelly.matrix, anchor: q => warp(q, S), lag, spread: S.sq[1] * (1 + S.sq[2] * .6) });
    u.uSwayA.fromArray(dyn.dangle).multiplyScalar(.5); u.uSwayB.fromArray(dyn.hair).multiplyScalar(.6);
    u.uTime = t; u.uLine.set(.016 * p.s, 1.5, 4.6); u.uGhost = p.ghost;
    express(u, p, dyn, t);

    this.root.updateWorldMatrix(true, true);
    this.lips.fromArray(warp([0, FACE.mouthY, BD / 2], S)).applyMatrix4(this.jelly.matrixWorld);
  }
}
