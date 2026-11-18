// 香炉：一只青瓷的鬲式三足小炉，配一顶铜的镂空盖。盖上是六朵如意云头，云头之间的空当就是出烟的孔；盖顶一枚宝珠钮。
// 炉里铺着香灰，灰上一枚燃着的塔香，隔着镂空能看见一点红。烟在 smoke.js。尺寸以书案台面为 0。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PROPS } from '../layout.js';
import { TOP, profile, lathe, flatCavity } from './shared.js';
import { bronze, celadon } from './materials.js';

// 炉身：圜底、鼓腹、束颈、平折的口沿；肩上两道弦纹。轮廓翻过口沿后沿内壁走到香灰面以下
const BODY = [[0, .5], [.5, .5], [1.05, .63], [1.44, .95], [1.56, 1.3], [1.47, 1.56], 'c', [1.46, 1.6], [1.42, 1.62], 'c', [1.36, 1.69], 'c', [1.34, 1.73], [1.3, 1.74], 'c',
  [1.2, 1.82], [1.15, 1.9], [1.15, 2.02], [1.24, 2.08], [1.5, 2.1], [1.57, 2.13], 'c', [1.58, 2.19], [1.54, 2.22], 'c', [1.2, 2.2], [1.12, 2.16], 'c', [1.07, 2.08], [1.07, 1.9], [1.2, 1.72], [1.3, 1.5]];
const LEG = [[0, 0], [.15, 0], 'c', [.2, .05], [.19, .16], [.21, .4], [.3, .7], [.42, .95], [.2, 1.15]];
const ASH_Y = 1.62;
// 炉盖：底下一道箍，往上是镂空的穹顶，顶上一块实心的小盖托着宝珠钮
const BAND = [[1.0, 2.2], [1.13, 2.2], 'c', [1.15, 2.27], [1.12, 2.35], 'c', [1.03, 2.37], 'c', [1.0, 2.3], [1.0, 2.21]];
const DOME_Y = 2.34, DOME_H = .78, DOME_R = 1.07, CAP = .78;          // 穹顶的底、高、底半径；CAP 以上是实心的小盖
const dome = k => ({ r: DOME_R * Math.cos(k * Math.PI / 2) ** .85, y: DOME_Y + DOME_H * Math.sin(k * Math.PI / 2) });
const onDome = (th, k) => { const { r, y } = dome(k); return new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r); };
const KNOB = [[.11, 3.17], 'c', [.2, 3.24], [.23, 3.33], [.15, 3.43], [.04, 3.5], [0, 3.51]];
// 如意云头的半边轮廓和里面的一个卷（a：横向 0 到 1 是半格宽；b：纵向 0 到 1 从箍到小盖）
const CLOUD = [[0, 0], [.3, .05], [.72, .12], [.95, .36], [.8, .6], [.5, .62], [.46, .82], [.25, .98], [0, 1]];
const CURL = [[.5, .62], [.67, .47], [.6, .29], [.43, .29], [.39, .42], [.5, .47]];

function lidGeometry() {
  const N = 6, cell = Math.PI * 2 / N, parts = [], bar = .04;
  const at = (i, a, b) => onDome(i * cell + a * cell / 2 * .93, .03 + b * (CAP - .04));
  const tube = (pts, closed, radius = bar) => flatCavity(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, closed), pts.length * 7, radius, 7, closed), -.2);
  for (let i = 0; i < N; i++) {
    parts.push(tube([...CLOUD.map(([a, b]) => at(i, a, b)), ...CLOUD.slice(1, -1).reverse().map(([a, b]) => at(i, -a, b))], true));
    for (const side of [1, -1]) parts.push(tube(CURL.map(([a, b]) => at(i, a * side, b)), false, bar * .8));
    parts.push(tube([0, .25, .5, .75, 1].map(b => at(i, 1 / .93, b)), false, bar * .9));                       // 云头之间的一根竖梁
    parts.push(flatCavity(new THREE.SphereGeometry(.075, 10, 8), -.6).translate(...at(i, 1 / .93, .5).toArray()));   // 梁上一颗珠
  }
  const capPts = [];
  for (let k = CAP - .02; dome(k).r > .14; k += .02) { const { r, y } = dome(k); capPts.push([r + .03, y + .02]); }
  parts.push(lathe(profile([[.36, dome(CAP).y - .06], [.44, dome(CAP).y - .03], 'c', ...capPts, 'c', ...KNOB]), 48), lathe(profile(BAND), 64));
  const lid = mergeGeometries(parts), pos = lid.attributes.position, nor = lid.attributes.normal, cav = lid.attributes.cavity, p = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {                                // 朝外的一面常被摸到，磨得亮；朝里的一面熏着烟、长着锈
    p.fromBufferAttribute(pos, i).setY(pos.getY(i) - DOME_Y + .4).normalize();
    cav.setX(i, THREE.MathUtils.clamp(cav.getX(i) * .5 - .75 * n.fromBufferAttribute(nor, i).dot(p) + .15, -1, 1));
  }
  return lid;
}

export function buildCenser(parent) {
  const [cx, cz] = PROPS.censer.c, censer = new THREE.Group();
  censer.position.set(cx, TOP, cz); censer.rotation.y = .35;
  parent.add(censer); censer.updateWorldMatrix(true, false);

  const legs = [0, 1, 2].map(i => lathe(profile(LEG), 28).rotateZ(.14).translate(.98, 0, 0).rotateY(i * Math.PI * 2 / 3 + .5));
  const body = new THREE.Mesh(mergeGeometries([lathe(profile(BODY), 96), ...legs]), celadon({ seed: 4 }));
  const lid = new THREE.Mesh(lidGeometry(), bronze({ seed: 31, rust: .58 }));
  // 香灰：中间略鼓，表面粗糙发灰
  const ash = new THREE.Mesh(lathe([[1.3, ASH_Y - .06], [1.0, ASH_Y], [.5, ASH_Y + .04], [.15, ASH_Y + .05], [.02, ASH_Y + .05]].map(p => new THREE.Vector2(...p)), 40),
    new THREE.MeshStandardMaterial({ color: '#8E8A86', roughness: 1 }));
  // 塔香：一枚小圆锥，尖上烧着
  const cone = new THREE.Mesh(new THREE.ConeGeometry(.13, .42, 16), new THREE.MeshStandardMaterial({ color: '#4A3A2C', roughness: 1 }));
  cone.position.y = ASH_Y + .25;
  const ember = new THREE.Mesh(new THREE.SphereGeometry(.06, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, .45, .1) }));
  ember.position.y = ASH_Y + .45;
  for (const m of [body, lid]) { m.castShadow = true; m.receiveShadow = true; }
  censer.add(body, lid, ash, cone, ember);
  return { vent: censer.localToWorld(new THREE.Vector3(0, DOME_Y + DOME_H * .6, 0)) };              // 出烟的高度：穹顶镂空处
}
