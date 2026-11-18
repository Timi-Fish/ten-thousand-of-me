// 山脊石阶边的细部：
//   台阶角落的落叶——每一级的踏面贴着上一级立面的那个墙角，挨着路缘，风刮下来的叶子攒成一溜；踏面上零散几片（春天是落花，夏天零星绿叶，冬天埋在雪里）。
//   缝里的草——立面根上、踏面和路缘石之间的缝里，一小撮草（缝里的苔是 stone.js 的石头材质画的）。都靠着两边，路中间留给小蟹蹦。
//   栏杆的旧漆——立柱和横档上一块块掉了漆的斑，棱角上掉得多，露出底灰和木头。
//   路标石——隔一段立一根短石柱（方身、圆顶，正面一道刻字描红），立在探出基座的石墩上，和石灯、路碑错开。
//   祈福的红绸——栏杆上隔几档系着一条条红绸，一处两三条长短不一，打结的地方贴着横档；风一阵阵把它们扯平、往下风甩，风松了垂下来再荡几荡。
// 栏杆在哪儿取自 rails.js（只有朱漆木栏有旧漆和红绸）。
import * as THREE from 'three';
import { rnd } from '../anim.js';
import { HALF } from './road.js';
import { WALL_AT } from './roadside.js';
import { Kit, MAT, place, builtMaterial } from './kit.js';
import { paint, shadowed } from './paint.js';
import { RIDGE_WIND } from './ridgeshade.js';
import { ridgeHerbShapes, ridgeHerbMaterial, herbMesh } from './ridgeherbs.js';
import { railRuns, BEAM } from './rails.js';

const PIER = 3.4;                                                     // 路标石的石墩往下多深
const CHUNK = 45, SEG = 10;                                           // 沿路每多长一组；一条红绸分几节

// 红绸：每条的每个顶点带 aKnot（打结的地方）和 aRib（x 沿绸带的位置 0 到 1，y 横着 -1 到 1，z 长，w 宽），aPhase 各自的相位和颜色
let ribbonMat = null;
function ribbonMaterial() {
  if (ribbonMat) return ribbonMat;
  ribbonMat = paint({
    side: THREE.DoubleSide,
    vertexPars: `attribute vec3 aKnot; attribute vec4 aRib; attribute float aPhase; varying vec2 vRib; varying float vPhase; ${RIDGE_WIND}`,
    world: /* glsl */`
      float k = aRib.x, len = aRib.z, ph = aPhase * 6.283;
      vec2 wd = ridgeWindDir();
      float press = ridgePress(aKnot.xz, aPhase), lift = clamp(press * 1.3, 0., .94);
      // 中线：从结往下垂，风越猛越往下风扯平；沿着绸带一道道波往梢上传，梢头甩得最厉害
      vec3 hang = normalize(mix(vec3(0., -1., 0.), vec3(wd.x, -.12, wd.y), lift));
      vec3 side = normalize(vec3(-wd.y, 0., wd.x));
      float wave = sin(k * 9. - uTime * (6. + 5. * lift) + ph), wave2 = sin(k * 15. - uTime * 11. + ph * 1.7);
      vec3 c = aKnot + hang * len * k + side * len * k * k * (.16 * wave + .05 * wave2) * (.4 + lift) + vec3(0., 1., 0.) * len * k * k * .12 * wave * lift;
      float twist = .5 * sin(k * 5. - uTime * 4. + ph) * lift;
      vec3 across = normalize(side * cos(twist) + cross(hang, side) * sin(twist));
      wp = c + across * aRib.y * aRib.w * (1. - .25 * k);
      wn = normalize(cross(hang, across));
      vRib = aRib.xy; vPhase = aPhase;`,
    fragmentPars: 'varying vec2 vRib; varying float vPhase;',
    fragment: /* glsl */`
      float fade = fract(vPhase * 7.3), k = vRib.x;
      vec3 silk = mix(vec3(.78, .09, .07), vec3(.96, .28, .16), .5 + .5 * N.y) * mix(1., 1.25, fade * .6);
      silk = mix(silk, vec3(.92, .58, .5), .25 * step(.75, fade));                                   // 有的晒褪了色
      silk = mix(silk, vec3(.95, .74, .3), smoothstep(.8, .9, abs(vRib.y)) * step(.4, fract(vPhase * 3.1)));   // 有的两边织着金线
      silk *= .9 + .1 * sin(k * 60.);                                                                    // 绸的织纹
      // 梢头剪成燕尾
      if (k > .93 && abs(abs(vRib.y) - .0) < (k - .93) * 9.) discard;
      float back = pow(max(dot(normalize(vWp - cameraPosition), uSunDir), 0.), 2.);
      albedo = silk * (1. + .9 * back); thin = .6 + .4 * back; ao = .9;`,
  });
  return ribbonMat;
}

// 栏杆的旧漆：套在立柱、横档外面薄薄一层壳，只画掉了漆的那些斑（露出底下灰褐的木头和土黄的底灰），棱角上掉得多；其余地方透明，露出原来的红漆
let chipMat = null;
function chipMaterial() {
  if (chipMat) return chipMat;
  chipMat = paint({
    vertexPars: 'varying vec3 vLoc, vSize;',
    world: 'vLoc = position; vSize = vec3(length(M[0].xyz), length(M[1].xyz), length(M[2].xyz));',
    fragmentPars: 'varying vec3 vLoc, vSize;',
    fragment: /* glsl */`
      vec3 a = abs(vLoc) * 2., h = vSize * .5;
      // 离最近的一条棱多远（世界单位）：在哪个面上就看另外两个方向
      float edge = a.x > a.y && a.x > a.z ? min((1. - a.y) * h.y, (1. - a.z) * h.z) : a.y > a.z ? min((1. - a.x) * h.x, (1. - a.z) * h.z) : min((1. - a.x) * h.x, (1. - a.y) * h.y);
      float n = noise1(vWp.xz * 9.3 + vWp.y * 7.1) * .55 + noise1(vWp.xz * 27. + vWp.y * 23.) * .3 + noise1(vec2(vWp.y * 3.1, vWp.x + vWp.z) * 2.) * .15;
      float close = smoothstep(40., 6., distance(vWp, cameraPosition));
      float chip = n + .26 * smoothstep(.035, 0., edge) * smoothstep(.45, .6, noise1(vWp.xz * 2.1 + vWp.y * 1.7)) - .05 * vLoc.y;
      if (chip < .83 - .04 * close) discard;                                                           // 远了只剩棱上零星几处
      float core = smoothstep(.84, .9, chip);
      albedo = mix(vec3(.55, .44, .3), vec3(.36, .3, .26) * (.8 + .4 * noise1(vec2(vWp.y * 30., vWp.x * 3.))), core);   // 掉漆的边是一圈底灰，中间露木头
      albedo = mix(albedo, vec3(.9, .93, 1.), uSnow * smoothstep(.5, .8, N.y));
      ao = .9; sun *= bakedSun(vWp.xz);`,
  });
  return chipMat;
}

// 路标石：墩、方身、圆顶，正面一道刻字描红
function markerGeometry() {
  const kit = new Kit().use(MAT.stone);
  kit.box(.62, PIER, .62, '#8E897E', place(0, -PIER / 2, 0)).box(.74, .1, .74, '#ABA699', place(0, 0, 0));
  kit.box(.4, .1, .4, '#BCB7AA', place(0, .1, 0)).box(.3, .78, .26, '#B2AD9F', place(0, .52, 0));
  kit.add(new THREE.CylinderGeometry(.15, .15, .26, 10, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2), '#B2AD9F', place(0, .91, 0));
  kit.box(.12, .5, .02, '#8E897E', place(0, .55, .125));
  kit.use(MAT.paper);
  for (let i = 0; i < 3; i++) kit.box(.08, .1, .02, '#B03A2A', place(0, .72 - i * .15, .137));
  return kit.geometry();
}

export function buildRidgeStair(P) {
  const { road, T, weight, spans, groundAt } = P, group = new THREE.Group(), culled = [], tangent = new THREE.Vector3(), out = new THREE.Vector3();
  const bins = new Map(), put = (kind, copy, s, it) => { const key = `${kind}|${copy}|${Math.floor(s / CHUNK)}`; if (!bins.has(key)) bins.set(key, { kind, copy, s: (Math.floor(s / CHUNK) + .5) * CHUNK, items: [] }); bins.get(key).items.push(it); };
  let k = 0;

  // —— 每一级立面的位置：路面往下跌的地方 ——
  for (const [a, b] of spans) {
    let prev = road.surface(Math.max(0, a));
    for (let s = Math.max(0, a) + .02; s < Math.min(road.length, b); s += .02) {
      const y = road.surface(s), w = weight(s);
      if (prev - y < .03 || w <= 0) { prev = y; continue; }
      prev = y;
      // s 是一道立面；它下面那一级的踏面从这里开始。墙角在 s 往下山一点
      for (const sign of [-1, 1]) {
        k++;
        const R = j => rnd(k * 3.17 + j * 1.31 + .7);
        // 墙角的落叶：贴着立面、挨着路缘攒成一溜，中间厚两头薄。一溜不宽过一级踏面，不悬到下一级上空。
        // 造型的 +x 顺着路的右手、+z 朝着立面（上山）
        if (R(30) < .8 * w) {
          const len = .8 + .7 * R(31), o = sign * (HALF - .05 - len * .5), at = T.point(s + .3, o, 0);
          T.right(s, out);
          put('drift', Math.floor(R(32) * 3), s, { x: at.x, y: road.surface(s + .3) + .005, z: at.z, yaw: Math.atan2(-out.z, out.x), scale: len, tall: .9 + .4 * R(33), seed: R(34) });
        }
        if (R(6) < .45 * w) {                                                                  // 缝里的一撮草（缝里的苔是石头材质自己画的）
          const o = sign * (3.15 + .15 * R(7)), at = T.point(s + .12 + .5 * R(8), o, 0);
          put('tussock', Math.floor(R(10) * 3), s, { x: at.x, y: road.surface(s + .2) - .02, z: at.z, yaw: R(11) * 6.283, scale: .32 + .22 * R(12), tall: .7 + .3 * R(13), seed: R(14) });
        }
        if (R(15) < .3 * w) {                                                                  // 踏面上零散的叶
          const o = sign * (.6 + 2.4 * R(16)), at = T.point(s + .15 + .4 * R(17), o, 0);
          put('litter', Math.floor(R(18) * 3), s, { x: at.x, y: road.surface(s + .5) + .01, z: at.z, yaw: R(19) * 6.283, scale: .14 + .12 * R(20), tall: .5, seed: R(21) });
        }
      }
    }
  }
  const COPIES = { litter: 3, drift: 3, tussock: 3 };
  for (const { kind, copy, s, items } of bins.values()) {
    const mesh = herbMesh(ridgeHerbShapes(kind, COPIES[kind])[copy], ridgeHerbMaterial(kind === 'drift' ? 'litter' : kind), items);
    mesh.name = `山脊 石阶 ${kind}`;
    group.add(mesh);
    culled.push({ mesh, at: road.at0(Math.min(s, road.length), new THREE.Vector3()), reach: 110 });
  }

  // —— 路标石 ——
  const markers = [], lamp = s => Math.abs(((s - 14) % 30 + 30) % 30) < 4 || Math.abs(((s - 14) % 30 + 30) % 30 - 30) < 4, stele = s => Math.abs(((s - 59) % 150 + 150) % 150) < 6 || Math.abs(((s - 119) % 150 + 150) % 150) < 6;
  for (const [a, b] of spans) for (let s = Math.max(8, a), i = 0; s < Math.min(road.length - 4, b); s += 19, i++) {
    if (weight(s) < .25 || lamp(road.mile(s)) || stele(road.mile(s)) || !T.offBridge(s, 6)) continue;                // 石灯、路碑、石凳按里程排（props.js）
    const sign = i % 2 ? 1 : -1, at = T.point(s, sign * (WALL_AT + .45), T.curb(s) - .06), yaw = Math.atan2(road.tangent(s, tangent).x, tangent.z) + sign * Math.PI / 2;
    markers.push(place(at.x, at.y, at.z, yaw));
  }
  if (markers.length) {
    const mesh = shadowed(new THREE.InstancedMesh(markerGeometry(), builtMaterial(), markers.length));
    markers.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.computeBoundingSphere();
    group.add(mesh);
  }

  // —— 红绸：沿着栏杆的上横档 ——
  const ribs = { knot: [], rib: [], phase: [], idx: [] }, shells = [], UP = new THREE.Vector3(0, 1, 0);
  for (const run of railRuns(road, T, groundAt)) {
    if (run.kind !== 'rail') continue;
    let prev = null;
    for (const { s, at, yaw } of run.posts) {
      const w = weight(s);
      if (w > 0) {                                                                             // 旧漆的壳：立柱（和栏杆的立柱同位置、略大一圈）、两道横档
        shells.push(place(at.x, at.y + .78, at.z, yaw, 0, 0, .252, 1.27, .252));
        if (prev) for (const [h, wd] of [[.56, .1], [1.12, .13]]) {
          const a = prev.clone().setY(prev.y + h), b = at.clone().setY(at.y + h);
          shells.push(new THREE.Matrix4().lookAt(a, b, UP).setPosition(a.clone().lerp(b, .5)).scale(new THREE.Vector3(wd + .012, .142, a.distanceTo(b) - .26)));
        }
      }
      if (prev && w > 0) {
        k++;
        const R = j => rnd(k * 5.71 + j * 2.13 + .3);
        if (R(0) < .55 * w) {
          const knot = prev.clone().lerp(at, .15 + .7 * R(1));
          knot.y += BEAM - .04;
          const tails = 1 + Math.floor(R(2) * 3);
          for (let t = 0; t < tails; t++) {
            const len = .45 + .75 * R(3 + t), width = .045 + .03 * R(6 + t), phase = R(9 + t), off = (t - (tails - 1) / 2) * .07, base = ribs.knot.length / 3;
            const kn = knot.clone().add(new THREE.Vector3((prev.x - at.x), 0, (prev.z - at.z)).normalize().multiplyScalar(off));
            for (let i = 0; i <= SEG; i++) for (const across of [-1, 1]) { ribs.knot.push(kn.x, kn.y, kn.z); ribs.rib.push(i / SEG, across, len, width); ribs.phase.push(phase); }
            for (let i = 0; i < SEG; i++) { const a = base + i * 2; ribs.idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
          }
        }
      }
      prev = at;
    }
  }
  if (ribs.idx.length) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(ribs.knot, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(ribs.knot.map((_, i) => i % 3 === 1 ? 1 : 0), 3));
    g.setAttribute('aKnot', new THREE.Float32BufferAttribute(ribs.knot, 3)); g.setAttribute('aRib', new THREE.Float32BufferAttribute(ribs.rib, 4)); g.setAttribute('aPhase', new THREE.Float32BufferAttribute(ribs.phase, 1));
    g.setIndex(ribs.idx); g.computeBoundingSphere(); g.boundingSphere.radius += 2;
    const mesh = shadowed(new THREE.Mesh(g, ribbonMaterial()), true, true);
    mesh.name = '山脊 红绸';
    group.add(mesh);
  }
  if (shells.length) {
    const mesh = shadowed(new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), chipMaterial(), shells.length), false, true);
    shells.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.computeBoundingSphere(); mesh.name = '山脊 栏杆旧漆';
    group.add(mesh);
  }
  return { group, culled, ribbonCount: ribs.idx.length / (SEG * 6) };
}
