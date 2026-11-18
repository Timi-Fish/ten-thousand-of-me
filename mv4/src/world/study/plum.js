// 那枝梅：从梅瓶口斜出的一枝老梅。主枝先往上，再折向右，从油灯后面绕过去，压在笔架山上方，梢头探到表演区上空。
// 这里只长枝干（主枝、分枝、当年的长条、细梢），花在 blossom.js 里。坐标直接用世界坐标。
import * as THREE from 'three';
import { STAGE, PROPS } from '../layout.js';
import { V3, stream, pick, noise, smooth, tube, mesh, soft, merge } from './kit.js';

export const CLEAR = 9;                                             // 表演区上空，梅枝的任何部分都不能低于这个高度

// 主枝经过的点。瓶口在第二个点；第一个点在瓶子里面
const MAIN = [[-27, 9.6, -15], [-26.95, 12.9, -15], [-26.4, 15.2, -15.5], [-24.7, 17.5, -16.5], [-21.6, 18.8, -17.6], [-18.4, 18.1, -18.5], [-15.6, 16.2, -18.8],
  [-12.8, 12.9, -17.9], [-10, 10.5, -16.7], [-6.9, 9.1, -15.5], [-3.5, 8.25, -14.7], [.1, 7.95, -13.9], [3.3, 8.25, -12.9], [5.9, 9.1, -11.9]];
// 分枝：每条从主枝上的某个点出发。有往上蹿的，有往下垂的，有往前探到表演区上空的
const SIDE = [
  [[-24.7, 17.5, -16.5], [-25.2, 19.6, -17.2], [-24.6, 21.8, -18.2], [-23.2, 23.6, -18.8]],
  [[-21.6, 18.8, -17.6], [-20.6, 17.6, -15.8], [-19.4, 16, -14.2], [-18.6, 14.4, -12.8]],
  [[-18.4, 18.1, -18.5], [-17.2, 19.8, -19.4], [-15.2, 21, -20], [-12.8, 21.6, -20.2]],
  [[-12.8, 12.9, -17.9], [-11.6, 11.6, -16.6], [-10.7, 10.2, -15.3], [-10.1, 8.9, -14], [-9.9, 7.8, -12.9]],
  [[-10, 10.5, -16.7], [-9.2, 12, -17.8], [-8.6, 13.6, -18.6]],
  [[-6.9, 9.1, -15.5], [-5.8, 10.7, -16.3], [-4.2, 12.2, -17], [-2.2, 13.4, -17.4], [-.4, 14.9, -17.6]],
  [[-3.5, 8.25, -14.7], [-3, 9.4, -13.2], [-2.3, 10.3, -11.5], [-1.3, 10.7, -9.6], [-.5, 10.6, -7.8]],
  [[.1, 7.95, -13.9], [1.3, 7.6, -13.3], [2.5, 7.45, -13], [3.6, 7.7, -12.8]],
  [[3.3, 8.25, -12.9], [4.5, 9.6, -11.5], [5.7, 10.4, -9.8], [6.5, 10.6, -8], [7, 10.4, -6.4]],
  [[5.9, 9.1, -11.9], [8, 10.3, -11], [10, 11.8, -10.4], [11.6, 13.4, -10]],
];
// 当年抽的长条：又直又长，往上蹿
const SHOOTS = [
  [[-14.3, 14.7, -18.5], [-13.3, 17, -18.9], [-12.7, 19.3, -19.1]], [[-8.3, 9.7, -16.1], [-7.6, 12.2, -16.5], [-7.2, 14.6, -16.7]],
  [[1, 8.1, -13.7], [1.9, 10.3, -13.6], [2.5, 12.3, -13.3]], [[4.9, 8.8, -12.3], [6, 10.9, -12.4], [6.8, 12.7, -12.2]], [[-20.2, 18.6, -18], [-19.4, 21, -18.6], [-19, 23.2, -19]],
];

// 把一个点挪到允许的地方：表演区上空抬到 CLEAR + margin 以上（快到表演区边上时就开始渐渐抬高），并且离油灯远一些
export function settle(p, margin) {
  const k = smooth(STAGE.r + 2.6, STAGE.r + .9, Math.hypot(p.x, p.z - STAGE.z));
  if (k > 0) p.y = Math.max(p.y, CLEAR + margin - (1 - k) * 4);
  const [lx, lz] = PROPS.lamp.c, d = Math.hypot(p.x - lx, p.z - lz);
  if (d < 4.2 && p.y < 18) { p.x = lx + (p.x - lx) / d * 4.2; p.z = lz + (p.z - lz) / d * 4.2; }
  return p;
}

// 沿控制点走一条枝：每两个控制点之间插一个往旁边偏出去的点（kink 是偏多少），枝条因此一折一折的；
// 折角只略微磨圆，保留梅枝硬朗的转折。最后每隔 step 取一个点
function trace(ctrl, step, kink, rand) {
  let pts = [];
  ctrl.forEach((c, i) => {
    const p = c.isVector3 ? c.clone() : new V3(...c);
    pts.push(p);
    if (!kink || i === ctrl.length - 1) return;
    const n = ctrl[i + 1].isVector3 ? ctrl[i + 1] : new V3(...ctrl[i + 1]), d = new V3().subVectors(n, p);
    const side = new V3(rand() - .5, rand() - .5, rand() - .5).cross(d).normalize();
    pts.push(p.clone().addScaledVector(d, pick(rand, .35, .65)).addScaledVector(side, d.length() * kink * pick(rand, .5, 1)));
  });
  for (let pass = 0; pass < 2; pass++) {
    const cut = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) cut.push(pts[i].clone().lerp(pts[i + 1], .22), pts[i].clone().lerp(pts[i + 1], .78));
    cut.push(pts[pts.length - 1]);
    pts = cut;
  }
  const out = [pts[0].clone()];
  let need = step;
  for (let i = 1; i < pts.length; i++) {
    let seg = pts[i].distanceTo(pts[i - 1]), from = pts[i - 1];
    while (seg >= need) { from = from.clone().lerp(pts[i], need / seg); out.push(from); seg -= need; need = step; }
    need -= seg;
  }
  out.push(pts[pts.length - 1].clone());
  return out;
}
const lengthOf = pts => pts.reduce((sum, p, i) => sum + (i ? p.distanceTo(pts[i - 1]) : 0), 0);

// 长出整枝梅的骨架。返回一组枝条，每条：pts 中心线、radii 各点的半径、kind（old 老枝 / young 当年的条和细梢）、
// bear 花开得多密、from 从枝条的哪一段开始长东西
export function growBranches() {
  const rand = stream(140), limbs = [];
  const main = [...trace(MAIN.slice(0, 2), .2, 0, rand).slice(0, -1), ...trace(MAIN.slice(1), .2, .13, rand)];   // 瓶子里那一段是直的，出了瓶口才开始曲折
  const mainR = main.map((_, i) => { const k = i / (main.length - 1); return .085 + .42 * (1 - k) ** 1.5 + .05 * (1 - k) * noise(k * 23, 5.5); });
  limbs.push({ pts: main, radii: mainR, kind: 'old', sides: 12, bear: .55, from: .3 });
  const radiusNear = p => { let best = 0, d = 1e9; main.forEach((m, i) => { const dd = m.distanceToSquared(p); if (dd < d) { d = dd; best = i; } }); return mainR[best]; };
  for (const ctrl of SIDE) {
    const pts = trace(ctrl, .18, .14, rand), r0 = radiusNear(pts[0]) * .7;
    limbs.push({ pts, radii: pts.map((_, i) => .035 + (r0 - .035) * (1 - i / (pts.length - 1)) ** 1.2), kind: 'old', sides: 8, bear: 1, from: .1 });
  }
  for (const ctrl of SHOOTS) {
    const pts = trace(ctrl, .18, .03, rand);
    limbs.push({ pts, radii: pts.map((_, i) => .014 + .05 * (1 - i / (pts.length - 1))), kind: 'young', sides: 6, bear: .8, from: .12, bare: true });
  }
  // 细梢：沿老枝每隔一段抽一条，多数斜着往上，少数平伸或下垂；有些细梢上再分一小段短刺
  const twig = (start, dir, len, r0, depth) => {
    const side = new V3(rand() - .5, rand() - .5, rand() - .5).cross(dir).normalize().multiplyScalar(len * pick(rand, .05, .14));
    const mid = start.clone().addScaledVector(dir, len * .5).add(side), end = start.clone().addScaledVector(dir, len).addScaledVector(side, -.5).add(new V3(0, len * pick(rand, .02, .14), 0));
    const pts = trace([start, mid, end], .15, 0, rand);
    limbs.push({ pts, radii: pts.map((_, i) => .011 + (r0 - .011) * (1 - i / (pts.length - 1)) ** .8), kind: 'young', sides: 5, bear: 1, from: .1, bare: true });
    if (depth < 1 && len > 1.4 && rand() < .55) {
      const at = pts[Math.floor(pts.length * pick(rand, .35, .7))], out = new V3(rand() - .5, rand() * .8, rand() - .2).normalize();
      twig(at.clone(), out, len * pick(rand, .3, .5), r0 * .7, depth + 1);
    }
  };
  for (const limb of limbs.filter(l => !l.bare)) {
    const total = lengthOf(limb.pts);
    let next = total * limb.from + rand() * .6, run = 0;
    for (let i = 1; i < limb.pts.length - 1; i++) {
      run += limb.pts[i].distanceTo(limb.pts[i - 1]);
      if (run < next) continue;
      next = run + pick(rand, .8, 1.6);
      const tan = new V3().subVectors(limb.pts[i + 1], limb.pts[i - 1]).normalize(), mood = rand();
      const perp = new V3(rand() - .5, rand() - .5, rand() - .5).cross(tan).normalize();
      const dir = perp.multiplyScalar(.8).addScaledVector(tan, pick(rand, .2, .7)).add(new V3(0, mood < .22 ? -.7 : mood < .4 ? 0 : pick(rand, .5, 1.1), .25)).normalize();
      twig(limb.pts[i].clone(), dir, (limb === limbs[0] ? pick(rand, 1.3, 3.2) : pick(rand, .9, 2.4)) * (mood < .22 ? .6 : 1), Math.min(.045, limb.radii[i] * .6), 0);
    }
  }
  for (const limb of limbs) limb.pts.forEach((p, i) => settle(p, limb.radii[i] + .12));
  return limbs;
}

// 枝干的网格。老枝粗糙，有纵向的裂纹、疙瘩和零星的青苔；当年的条和细梢光滑，带一点青褐色。wrap 给材质接上摇晃
export function buildBranches(limbs, wrap) {
  const group = new THREE.Group();
  const old = limbs.filter(l => l.kind === 'old').map((l, n) => tube(l.pts, l.radii, l.sides, {
    bump: (i, j, len) => 1 + .34 * (noise(j * 1.7 + n * 9, len * 1.3, n * 3.3) - .5) + .9 * Math.max(0, noise(len * .6 + n * 5, 2.2) - .66),
  }));
  const bark = soft({
    color: '#6A5650', roughness: .95, rim: .16, rimColor: '#A9A6E6', rimPow: 2.6, bump: .03,
    albedo: /* glsl */`
      float grain = fbm(vec3(vUv.x * 9., vUv.y * 1.3, 2.)), split = abs(fract(vUv.x * 5. + grain * 2.2) - .5) * 2.;
      float plate = fbm(vec3(vUv.x * 3., vUv.y * 2.6, 7.));
      col *= (.3 + .9 * smoothstep(.0, .75, split)) * (.6 + .8 * plate);
      col = mix(col, vec3(.42, .5, .38), smoothstep(.56, .74, fbm(p * 1.6 + 4.)) * .6);      // 青苔
      col = mix(col, vec3(.62, .6, .56), smoothstep(.68, .8, fbm(p * 2.7 + 11.)) * .35);     // 灰白的地衣
      gBump = split * .7 + grain + plate;`,
  });
  bark.defines = { ...bark.defines, USE_UV: '' };
  group.add(mesh(merge(old), wrap(bark)));
  const young = limbs.filter(l => l.kind === 'young').map(l => tube(l.pts, l.radii, l.sides));
  const skin = soft({ color: '#6B5236', roughness: .75, rim: .2, rimColor: '#B9B6EE', albedo: 'col = mix(col, vec3(.36, .42, .22), .55 * fbm(p * 1.7)); col *= .75 + .5 * fbm(p * 7.);' });
  group.add(mesh(merge(young), wrap(skin), { cast: false }));
  return group;
}

// 梅枝在夜里微微地晃：离瓶口越远晃得越多。接在材质的顶点程序里，花和枝用同一套，所以花不会离开枝
export function sway(mat, time, root) {
  const prev = mat.onBeforeCompile, key = mat.customProgramCacheKey();
  mat.onBeforeCompile = sh => {
    prev(sh);
    sh.uniforms.uTime = time; sh.uniforms.uRoot = { value: root };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime; uniform vec3 uRoot;').replace('#include <project_vertex>', /* glsl */`
      vec4 mvPosition = vec4(transformed, 1.);
      #ifdef USE_INSTANCING
        mvPosition = instanceMatrix * mvPosition;
      #endif
      float far = clamp(length(mvPosition.xyz - uRoot) / 38., 0., 1.);
      float gust = sin(uTime * .8 + mvPosition.x * .09) * .1 + sin(uTime * 1.9 + mvPosition.x * .31 + mvPosition.z * .23) * .03;
      mvPosition.xyz += vec3(.55, -.1, .8) * gust * far * far;
      mvPosition = modelViewMatrix * mvPosition;
      gl_Position = projectionMatrix * mvPosition;`);
  };
  mat.customProgramCacheKey = () => `${key}|sway`;
  return mat;
}
