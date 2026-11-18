// 点景：远处一叶帆，天上几只归鸟。都隔着霭，只剩淡淡的剪影，点一下「海」和「黄昏」。
//   帆：一条小船挂一面带撑条的硬帆（老式的篷帆），在光路的左边，随涌浪起伏、轻轻摇。
//   归鸟：三只，一前两后，朝着落日那边慢慢飞过去，翅膀一扇一停。
import * as THREE from 'three';
import { paint } from './paint.js';
import { seaHeight } from './waves.js';

// 远处的剪影：本色很深，受光很弱，全靠霭把它推远
const silhouette = (col, extra = '') => paint({ fragment: `albedo = ${col}; ao = .6; ${extra}`, side: THREE.DoubleSide });

function boat() {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(.9, .55, 8, 10, 1, false).rotateZ(Math.PI / 2).scale(1, .55, .55), silhouette('vec3(.12, .09, .1)'));
  hull.position.y = .3;
  // 篷帆：后缘鼓出去一点、顶上一根斜的帆桁，带几道横的撑条
  const pts = [[-1.4, 0], [1.6, 0], [2.3, 1.8], [2.4, 3.6], [1.9, 5.3], [-.9, 6.1], [-1.2, 3]], pos = [0, 2.8, 0];
  pts.forEach(([x, y]) => pos.push(x, y, 0));
  const sail = new THREE.BufferGeometry();
  sail.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  sail.setIndex(pts.flatMap((_, i) => [0, i + 1, (i + 1) % pts.length + 1])); sail.computeVertexNormals();
  const cloth = new THREE.Mesh(sail, silhouette('vec3(.62, .46, .36)', 'float bat = smoothstep(.07, 0., abs(fract(vWp.y * .62 - vWp.x * .08) - .5) - .43); albedo *= 1. - .55 * bat; thin = .9;'));
  cloth.position.set(.3, 1, 0);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(.07, .09, 7.6, 5), silhouette('vec3(.1, .08, .08)'));
  mast.position.set(-.4, 4.2, 0);
  g.add(hull, cloth, mast);
  return g;
}

function bird() {
  const g = new THREE.Group(), mat = silhouette('vec3(.06, .05, .07)');
  const body = new THREE.Mesh(new THREE.SphereGeometry(.18, 8, 6).scale(2.6, .8, .8), mat);
  const wing = side => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -.22, 0, 0, .25, .3 * side, 0, .3, 1.6 * side, 0, -.05], 3));
    geo.setIndex(side > 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2]); geo.computeVertexNormals();
    const pivot = new THREE.Group(); pivot.add(new THREE.Mesh(geo, mat));
    return pivot;
  };
  const L = wing(-1), R = wing(1);
  body.rotation.y = Math.PI / 2;
  g.add(body, L, R);
  g.userData = { L, R };
  return g;
}

export function buildFar(stand, sea) {
  const group = new THREE.Group(), side = new THREE.Vector3(-sea.z, 0, sea.x);
  const ship = boat(), port = stand.clone().addScaledVector(sea, 210).addScaledVector(side, -62);
  ship.rotation.y = Math.atan2(-sea.x, -sea.z) + .45; ship.scale.setScalar(1.4);                       // 帆面大致朝着岸，看得见帆
  group.add(ship);
  // 归鸟：在落日的右上方，往左前方（朝着落日那边）慢慢飞远，从岸上看得见张开的翅膀
  const birds = [[0, 0, 0], [-1.6, -.5, 1.4], [1.5, -.7, 1.1]].map(o => { const b = bird(); b.scale.setScalar(1.5); b.userData.offset = new THREE.Vector3(...o); group.add(b); return b; });
  const heading = sea.clone().multiplyScalar(.75).addScaledVector(side, -.66).normalize();
  const flock = stand.clone().addScaledVector(sea, 75).addScaledVector(side, 9).add(new THREE.Vector3(0, 12, 0));
  return {
    group,
    update(t) {
      ship.position.set(port.x, seaHeight(port.x, port.z, t) * .6 - .2, port.z);
      ship.rotation.z = .05 * Math.sin(t * .9); ship.rotation.x = .04 * Math.sin(t * .7 + 1);
      birds.forEach((b, i) => {
        const o = b.userData.offset;
        b.position.copy(flock).addScaledVector(heading, 2.4 * t).addScaledVector(side, o.x * 2).add(new THREE.Vector3(0, o.y * 1.5 + .25 * Math.sin(t * 1.3 + i), 0)).addScaledVector(sea, o.z * 2);
        b.rotation.y = Math.atan2(heading.x, heading.z);
        const flap = Math.sin(t * 7 + i * 2.1), beat = Math.max(0, Math.sin(t * 1.1 + i * 1.7));                    // 扇几下、滑一阵
        const a = .55 * flap * beat + .12;
        b.userData.L.rotation.z = -a; b.userData.R.rotation.z = a;
      });
    },
  };
}
