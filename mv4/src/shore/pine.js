// 松：矶头根上一棵被海风吹歪的松，树身朝海探出去，枝都顺着风往一边长。照国画里画松的样子：
//   树干鳞片状的老皮，枝梢上一团团扁平的松针——每团是一块墨绿的底子，上面铺几十把「扇形」的针（国画画松针就是一把把小扇）；
//   针梢受光的那一侧被落日染暖。整团随风轻轻摆。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rnd } from '../anim.js';
import { paint, shadowed, WIND } from './paint.js';

const FANS = 64;                                                                // 每团松针的扇子数

// 一根有粗细变化的管：沿曲线走，半径按 radius(0..1) 收细
function tube(curve, radius, segs, radial) {
  const frames = curve.computeFrenetFrames(segs, false), pos = [], nor = [], index = [], p = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const u = i / segs, c = curve.getPointAt(u), r = radius(u);
    for (let j = 0; j <= radial; j++) {
      const a = j / radial * Math.PI * 2;
      n.copy(frames.normals[i]).multiplyScalar(Math.cos(a)).addScaledVector(frames.binormals[i], Math.sin(a)).normalize();
      p.copy(c).addScaledVector(n, r * (1 + .12 * Math.sin(a * 3 + i * .7)));
      pos.push(p.x, p.y, p.z); nor.push(n.x, n.y, n.z);
    }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) {
    const a = i * (radial + 1) + j, b = a + radial + 1;
    index.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setIndex(index);
  return geo;
}

const BARK = /* glsl */`
  // 老松皮：一块块鳞片，片与片之间是墨线
  vec2 q = vec2(atan(vN.x, vN.z) * 2.2, vWp.y * 3.1);
  float plate = noise1(q * vec2(1., 1.6)), seam = smoothstep(.06, .0, abs(fract(q.y * .9 + plate * 1.4) - .5) - .38);
  albedo = mix(vec3(.30, .22, .2), vec3(.52, .4, .34), plate) * (1. - .55 * seam);
  ao = .85;`;

const FAN_PARS = /* glsl */`
varying vec2 vFan;
varying float vTip;`;
// 一把扇形的松针：根在扇面的下沿正中，二十来根针放射开，长短不一
const FAN_SHAPE = /* glsl */`
  vec2 rel = vFan - vec2(0., -.46);
  float ang = atan(rel.x, rel.y), r = length(rel), lanes = 13.;
  float id = floor(ang / 2.6 * lanes + lanes * .5), lane = abs(fract(ang / 2.6 * lanes + .5) - .5);
  float len = .62 + .34 * fract(sin(id * 12.9898 + vTip * 78.233) * 43758.5453);
  float needle = step(lane, .09 + .08 * (1. - r)) * step(r, len) * step(abs(ang), 1.3) * step(.05, r);
  if (needle < .5) discard;`;

export function buildPine(heightAt) {
  const group = new THREE.Group();
  const base = new THREE.Vector3(1.3, 0, 9.1); base.y = heightAt(base.x, base.z) - .3;
  const at = (x, y, z) => base.clone().add(new THREE.Vector3(x, y, z));
  // 树身：先往上，再被风压着朝海（-z）探出去，梢头又倔强地翘起来
  const trunk = new THREE.CatmullRomCurve3([at(0, 0, 0), at(-.2, 1.5, -.3), at(.25, 2.8, -1.1), at(-.3, 3.8, -2.4), at(-.9, 4.4, -3.7), at(-1.3, 5.0, -4.6)]);
  const pieces = [tube(trunk, u => .36 * (1 - .72 * u) + .08 * Math.max(0, .12 - u) / .12, 26, 9)];
  // 枝：从树身上几处长出去，都偏向下风头（-z 往海那边伸，略垂再上挑）
  const BRANCHES = [[.52, [-1.8, .2, -.9], 1.9], [.66, [1.6, .3, -1.4], 1.7], [.78, [-1.4, .5, -2.1], 1.5], [.9, [1.1, .4, -1.6], 1.3], [.4, [1.5, -.1, .6], 1.4]];
  const pads = [{ c: trunk.getPointAt(1).add(new THREE.Vector3(-.2, .35, -.3)), s: 1.25 }];
  BRANCHES.forEach(([u, dir, len], i) => {
    const from = trunk.getPointAt(u), d = new THREE.Vector3(...dir).normalize().multiplyScalar(len);
    const mid = from.clone().addScaledVector(d, .55).add(new THREE.Vector3(0, -.15, 0)), end = from.clone().add(d).add(new THREE.Vector3(0, .25, 0));
    pieces.push(tube(new THREE.CatmullRomCurve3([from, mid, end]), k => .13 * (1 - .7 * k), 8, 6));
    pads.push({ c: end.add(new THREE.Vector3(0, .12, 0)), s: .85 + .3 * rnd(i * 3.3 + 1) });
  });
  const wood = shadowed(new THREE.Mesh(mergeGeometries(pieces), paint({ fragment: BARK })));
  group.add(wood);

  // 每团松针的底子：压扁的一团墨绿
  const bodies = pads.map(({ c, s }, i) => {
    const g = new THREE.IcosahedronGeometry(1, 3), p = g.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const x = p.getX(k), y = p.getY(k), z = p.getZ(k), bump = 1 + .18 * Math.sin(x * 4 + i) * Math.cos(z * 3.5 + i * 2);
      p.setXYZ(k, c.x + x * s * 1.05 * bump, c.y + y * s * .26 * bump - .02, c.z + z * s * .85 * bump);
    }
    g.computeVertexNormals();
    return g;
  });
  const padMat = paint({
    vertexPars: WIND, world: 'wp += windSway(wp, .12, 0.);',
    fragment: `albedo = mix(vec3(.08, .2, .17), vec3(.16, .3, .22), smoothstep(-.3, .8, N.y)) * (.8 + .4 * noise1(vWp.xz * 3.));`,
  });
  group.add(shadowed(new THREE.Mesh(mergeGeometries(bodies), padMat)));

  // 松针扇：铺在每团的上半边，扇面大致朝上，各自歪一点、转一个方向
  const fanGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const fanMat = paint({
    vertexPars: WIND + FAN_PARS, vertex: 'vFan = vec2(position.x, -position.z); vTip = M[3].x * 3.1 + M[3].z * 1.7;',
    world: 'wp += windSway(M[3].xyz, .14 + .1 * (vFan.y + .5), vTip);',
    fragmentPars: FAN_PARS, side: THREE.DoubleSide,
    fragment: `${FAN_SHAPE}
  float rr = length(vFan - vec2(0., -.46));
  albedo = mix(vec3(.07, .2, .16), vec3(.36, .52, .34), smoothstep(.15, .8, rr)) * (.85 + .3 * fract(vTip * 7.3));
  thin = .5; N = normalize(N + vec3(0., .6, 0.));`,
    depthFragment: FAN_SHAPE,
  });
  const fans = new THREE.InstancedMesh(fanGeo, fanMat, pads.length * FANS), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  pads.forEach(({ c, s }, i) => {
    for (let j = 0; j < FANS; j++) {
      // 外圈的扇子朝外翻、低一点，盖住底子的边；里面的朝上、高一点
      const n = i * 101 + j * 1.7, a = rnd(n) * 6.283, r = Math.sqrt(rnd(n + 1)), rim = r * r;
      const pos = new THREE.Vector3(c.x + Math.cos(a) * r * s * 1.15, c.y + s * (.2 - .22 * rim + rnd(n + 2) * .12), c.z + Math.sin(a) * r * s * .95);
      e.set((rnd(n + 3) - .5) * .6 + rim * .9 * Math.sin(a), rnd(n + 4) * 6.283, (rnd(n + 5) - .5) * .6 - rim * .9 * Math.cos(a), 'YXZ');
      m.compose(pos, q.setFromEuler(e), new THREE.Vector3(1, 1, 1).multiplyScalar(s * (.75 + .4 * rnd(n + 6))));
      fans.setMatrixAt(i * FANS + j, m);
    }
  });
  group.add(shadowed(fans));
  return group;
}
