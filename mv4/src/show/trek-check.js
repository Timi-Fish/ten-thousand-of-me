// 赶路的检查：只装外景，沿整条路放一批 walker，量落点、弧线和速度，打印到 console；再从侧面拍山脊石阶上蹦过去的几只小蟹。
// 出静帧自查用，影片不加载。window.renderFrame(t)：t 是场景时间（秒），镜头固定在山脊石阶的侧面。
// 数值的标准：落点脚底 − 路面 = 0；石阶上的落点离踏面前后沿都有余量；空中脚底不低于路面；20 秒平均速度贴着 speed。
import * as THREE from 'three';
import { buildWild } from '../wild.js';
import { Crab, MOOD, KIT_NAMES } from '../crab.js';
import { replay } from '../crab/spring.js';
import { BH } from '../crab/pose.js';
import { rnd } from '../anim.js';
import { makeTrek } from './trek.js';

const W = 1920, H = 1080, canvas = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;

const wild = buildWild(renderer), { road } = wild, L = road.length;
const trek = makeTrek({ wild });
const EDGE = .04, T0 = 100, SPAN = 20;

// 路上离 (x, z) 最近的那一点的路程（和 trek 内部的路程各算各的）：先粗找再细找
function along(x, z, guess) {
  let best = guess, gap = Infinity;
  for (let d = guess - 6; d <= guess + 6; d += .05) { const p = road.at(d / L), g = (p.x - x) ** 2 + (p.z - z) ** 2; if (g < gap) { gap = g; best = d; } }
  for (let d = best - .05; d <= best + .05; d += .001) { const p = road.at(d / L), g = (p.x - x) ** 2 + (p.z - z) ** 2; if (g < gap) { gap = g; best = d; } }
  return best;
}
// 从 (x, z) 沿 (dx, dz) 走，第一次碰到路面高度跳变（台阶的棱）有多远；1.6 以内没有就返回 Infinity
function edgeAhead(x, z, dx, dz) {
  const h0 = wild.heightAt(x, z);
  for (let r = .001; r < 1.6; r += .001) if (Math.abs(wild.heightAt(x + dx * r, z + dz * r) - h0) > EDGE) return r;
  return Infinity;
}

// 一批 walker：铺满整条路，各种 side、speed、s、lag
const CASES = [];
for (let j = 0; j < 16; j++) {
  CASES.push({ u0: .006 + .052 * j, t0: T0, speed: [5.2, 5.5, 6.5, 7, 8.5][j % 5], side: [0, 1.3, -1.6, 2.1, -2.1, .7][j % 6], s: [1, .9, .8, 1.15][j % 4], lag: rnd(j * 2.9) });
}
const started = performance.now();
const walkers = CASES.map(c => ({ c, poseAt: trek.walker(c) }));
const build = (performance.now() - started) / walkers.length;

let fall = 0, landErr = 0, landN = 0, treadN = 0, minBack = Infinity, minFront = Infinity, minAir = Infinity, airN = 0, speedErr = 0, startErr = 0, worst = '';
for (const { c, poseAt } of walkers) {
  // 1、2：每一个落点
  const lands = [];
  for (let t = T0; ; ) {
    const A = poseAt.landing(t);
    if (A.t > T0 + SPAN) break;
    const p = poseAt(A.t + 1e-4);
    landErr = Math.max(landErr, Math.abs(p.y - wild.heightAt(p.x, p.z))); landN++;
    const dir = road.dir(A.d / L), len = Math.hypot(dir.x, dir.z), fx = dir.x / len, fz = dir.z / len;
    const front = edgeAhead(p.x, p.z, fx, fz), back = edgeAhead(p.x, p.z, -fx, -fz);
    if (front < Infinity && back < Infinity && front + back < 1.6) {   // 前后都有棱：落在一级踏面上
      treadN++;
      minBack = Math.min(minBack, back); minFront = Math.min(minFront, front);
      if (back < .15 || front < .12) console.log(`  余量不够：u0=${c.u0.toFixed(3)} side=${c.side} d=${A.d.toFixed(2)} 后 ${back.toFixed(3)} 前 ${front.toFixed(3)}`);
    }
    lands.push({ t: A.t, d: along(p.x, p.z, A.d) });
    t = A.t + .01;
  }
  // 3：空中每一帧
  for (let t = T0; t <= T0 + SPAN; t += 1 / 60) {
    const p = poseAt(t), gap = p.y - wild.heightAt(p.x, p.z);
    fall = Math.max(fall, (p.y - poseAt(t + 1 / 60).y) * 60);
    let A = poseAt.landing(t - .4);                                   // t 之前最近的那次落地；脚还在那一点上就是在地上
    for (let B = poseAt.landing(A.t + 1e-3); B.t <= t; B = poseAt.landing(A.t + 1e-3)) A = B;
    if (p.x === A.x && p.z === A.z) continue;
    airN++;
    if (gap < minAir) { const B = poseAt.landing(t); minAir = gap; worst = `u0=${c.u0.toFixed(3)} side=${c.side} t=${t.toFixed(3)}，这一蹦 ${A.t.toFixed(3)}→${B.t.toFixed(3)}，高 ${A.y.toFixed(3)}→${B.y.toFixed(3)}，脚底 ${p.y.toFixed(3)}`; }
  }
  // 4：20 秒窗口里的平均速度（按落点沿中线的路程，落点的时刻）
  const a = lands[0], b = lands[lands.length - 1], v = (b.d - a.d) / (b.t - a.t);
  speedErr = Math.max(speedErr, Math.abs(v - c.speed));
  const p = poseAt(T0);
  startErr = Math.max(startErr, Math.abs(along(p.x, p.z, c.u0 * L) - c.u0 * L));
  console.log(`walker u0=${c.u0.toFixed(3)} speed=${c.speed} side=${c.side} s=${c.s} lag=${c.lag.toFixed(2)}：${lands.length} 个落点，平均速度 ${v.toFixed(3)}`);
}
// 性能：一帧 24 只小蟹、每只回看 43 次
const many = walkers.slice(0, 12), t1 = performance.now();
for (let f = 0; f < 60; f++) for (let r = 0; r < 2; r++) for (const { poseAt } of many) for (let i = 0; i <= 42; i++) poseAt(T0 + f / 60 - i / 60);
const perFrame = (performance.now() - t1) / 60;

console.log(`检查一 落点：${landN} 个，脚底 − 路面 的最大绝对值 ${landErr.toExponential(2)}`);
console.log(`检查二 石阶：${treadN} 个落点在踏面上，离后沿最近 ${minBack.toFixed(3)}，离前沿最近 ${minFront.toFixed(3)}`);
console.log(`检查三 空中：${airN} 帧离地，脚底高出路面的最小值 ${minAir.toExponential(2)}（${worst}）；最快下落 ${fall.toFixed(1)} 单位/秒`);
console.log(`检查四 速度：20 秒平均速度和 speed 的最大偏差 ${speedErr.toFixed(4)}；t0 时刻离 u0 最远 ${startErr.toFixed(3)}`);
console.log(`性能：建一个 walker ${build.toFixed(1)} 毫秒；24 只小蟹一帧的 poseAt 共 ${perFrame.toFixed(2)} 毫秒`);

// —— 侧面看山脊的石阶 ——
const ridge = wild.SHOTS.find(s => s.name.includes('山脊')), uR = along(ridge.q[0], ridge.q[2], .12 * L) / L;

// 身体实际有多高（和 Crab.update 同一个算法：姿势的压扁拉长，加上弹簧的落后和冲过头）。在山脊石阶上逐帧打印两蹦，| 是落地
for (const [speed, t0] of [[5.5, T0], [8.5, 34.4]]) {
  const poseAt = trek.walker({ u0: uR - 8 / L, t0, speed }), rows = [];
  let lo = Infinity, hi = 0;
  for (let f = 0; f < 38; f++) {
    const t = t0 + .2 + f / 60, p = poseAt(t), dyn = replay(poseAt, t, 42);
    const tall = Math.min(1.7, Math.max(.45, (1 + p.sq + .6 * dyn.sq) * (1 - 1.1 * dyn.lag[1] / BH)));
    lo = Math.min(lo, tall); hi = Math.max(hi, tall);
    rows.push(`${tall.toFixed(2)}${poseAt.landing(t).t - t < 1 / 120 ? '|' : ''}`);
  }
  console.log(`身高 speed=${speed}：${lo.toFixed(2)} 到 ${hi.toFixed(2)}；${rows.join(' ')}`);
}
const here = road.at(uR), dir = road.dir(uR), len = Math.hypot(dir.x, dir.z), rx = -dir.z / len, rz = dir.x / len;
const camera = new THREE.PerspectiveCamera(30, W / H, wild.clip.near, wild.clip.far);
const side = new THREE.Vector3(here.x + rx * 10, here.y + 2, here.z + rz * 10), sideAt = new THREE.Vector3(here.x - rx * 1.5, here.y + .4, here.z - rz * 1.5);   // 站在路右边的坡上，横着看路左边那只
const cast = [{ speed: 5.5, side: -1.5, s: 1, lag: 0 }]
  .map(c => ({ crab: new Crab('pin', 24), poseAt: trek.walker({ ...c, u0: uR - c.speed * .4 / L, t0: T0 }) }));
cast.forEach(({ crab }) => wild.scene.add(crab.root));
// 主片 34.4 – 36.3 秒「路上的风」那只：同样的走法参数、同样的机位算法（t 小于 60 时拍它）
const toward = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
const runner = new Crab(KIT_NAMES[5], 42), run = trek.walker({ u0: uR - 8 / L, t0: 34.4, speed: 8.5, extra: { mood: MOOD.joy, mouth: .8, laugh: .8, pitch: 12, aL: [70, .34, -.1], aR: [70, .34, -.1] } });
wild.scene.add(runner.root);
wild.setSeason('秋');

window.renderFrame = t => {
  wild.update(t);
  const film = t < 60;
  cast.forEach(({ crab, poseAt }) => { crab.root.visible = !film; if (!film) crab.update(poseAt, t); });
  runner.root.visible = film;
  if (film) {
    runner.update(run, t);
    const p = run(t), eye = toward(ridge.p, [p.x, p.y + 2.5, p.z], .5 + .05 * (t - 34.4));
    camera.fov = 36; camera.updateProjectionMatrix(); camera.position.set(...eye); camera.lookAt(p.x, p.y + 1.6, p.z);
    wild.focus(new THREE.Vector3(p.x, p.y, p.z));
  } else {
    camera.fov = 30; camera.updateProjectionMatrix(); camera.position.copy(side); camera.lookAt(sideAt);
    wild.focus(here);
  }
  renderer.render(wild.scene, camera);
};
window.renderFrame(T0);
window.mvReady = true;
