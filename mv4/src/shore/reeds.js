// 芦苇和芒草：数量少，摆得讲究。
//   沙滩靠岸坡的两丛芦苇，秆子被海风压向岸里，梢上是一穗穗灰白的芦花；
//   矶头背上石缝里一小丛芒草，正好在主机位的前景里，把画面框住。
// 每根是一条收细的叶片，越往梢越弯；芦花另是一片接在秆梢上的软羽。整根跟着阵风摆。
import * as THREE from 'three';
import { rnd } from '../anim.js';
import { paint, shadowed, WIND } from './paint.js';

// [中心 x, z, 半径, 根数, 高, 带芦花的比例]
const CLUMPS = [[12.4, 12.2, .9, 30, 2.6, .5], [16.8, 11.4, .7, 22, 2.2, .45], [-4.4, 9.6, .6, 16, 1.8, .3], [3.4, .2, .45, 14, 1.15, 0]];

// 一条叶片：沿 y 从 0 到 1，宽从 w 收到 0；顶点的 y 就是「离根多远」，着色器按它弯
function blade(segs, w) {
  const pos = [], index = [];
  for (let i = 0; i <= segs; i++) { const y = i / segs, half = w * (1 - y * .92) * .5; pos.push(-half, y, 0, half, y, 0); }
  for (let i = 0; i < segs; i++) { const a = i * 2; index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(index); g.computeVertexNormals();
  return g;
}
// 一穗芦花：接在秆梢上，从 y = 0.9 到 1.25，中间鼓、两头尖，垂向下风
function plume(segs) {
  const pos = [], index = [];
  for (let i = 0; i <= segs; i++) { const k = i / segs, y = .9 + .3 * k, half = .038 * Math.sin(Math.PI * Math.pow(k, .6)); pos.push(-half, y, 0, half, y, 0); }
  for (let i = 0; i < segs; i++) { const a = i * 2; index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(index); g.computeVertexNormals();
  return g;
}

// 弯：越往梢越弯，先往外倒，再被风压向下风头（世界里的弯在 world 里加）
const BEND = /* glsl */`
  float k = p.y * p.y;
  p.z += k * .32; p.x += sin(p.y * 3.1) * .03;`;
const SWAY = /* glsl */`
  vec3 root = M[3].xyz;
  wp += windSway(root, k * 1.6 * length(M[1].xyz), root.x * .37 + root.z * .21);`;

export function buildReeds(heightAt) {
  const group = new THREE.Group(), stems = [], plumes = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  CLUMPS.forEach(([cx, cz, R, n, tall, flower], ci) => {
    for (let i = 0; i < n; i++) {
      const s = ci * 97 + i * 1.31, a = rnd(s) * 6.283, r = Math.sqrt(rnd(s + 1)) * R, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      const h = tall * (.6 + .5 * rnd(s + 2));
      // 朝向：叶片随便转，整丛向下风头（+z +x）微微倒
      e.set(.25 * (rnd(s + 3) - .2), rnd(s + 4) * 6.283, .3 * (rnd(s + 5) - .5), 'YXZ');
      m.compose(new THREE.Vector3(x, heightAt(x, z) - .05, z), q.setFromEuler(e), new THREE.Vector3(1, h, 1));
      stems.push(m.clone());
      if (rnd(s + 6) < flower) plumes.push(m.clone());
    }
  });
  const sway = { vertexPars: WIND, vertex: BEND, world: SWAY, side: THREE.DoubleSide };
  const stemMat = paint({
    ...sway, vertex: BEND + 'vH = p.y;', vertexPars: WIND + 'varying float vH;', fragmentPars: 'varying float vH; uniform vec3 uReedA, uReedB;',
    uniforms: { uReedA: { value: new THREE.Color('#9C7E44') }, uReedB: { value: new THREE.Color('#E2CC8E') } },
    fragment: 'albedo = mix(uReedA, uReedB, smoothstep(.1, .9, vH)) * (.9 + .2 * fract(vWp.x * 13.7)); thin = .6; ao = mix(.6, 1., vH);',
  });
  const plumeMat = paint({
    ...sway,
    fragment: 'albedo = vec3(.66, .58, .5) * (.85 + .3 * noise1(vWp.xy * 40.)); thin = .45; N = normalize(N + vec3(0., .8, 0.));',
  });
  const add = (geo, mat, list) => {
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((mm, i) => mesh.setMatrixAt(i, mm));
    group.add(shadowed(mesh));
  };
  add(blade(7, .045), stemMat, stems);
  add(plume(6), plumeMat, plumes);
  return group;
}
