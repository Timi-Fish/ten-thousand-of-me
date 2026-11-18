// 窗外的一枝梅：从月洞的右上角斜探进来，逆着月光只见剪影，枝梢和花随风轻轻摇。
// 枝干是由粗到细的弯管，花是五瓣的小碗，花苞是小球；摇动在顶点着色器里算，是时间的纯函数。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { WALL } from '../layout.js';
import { WALL_THICK } from './wall.js';
import { stream, TAU, D, lerp } from './util.js';

const SWAY_GLSL = `
  uniform float uTime;
  // s：离枝根有多远（0 到 1）。越靠梢摇得越大，并且比枝根慢半拍
  vec3 swayAt(float s, vec3 p){
    float k = s * s, ph = s * 2.6 + p.x * 0.07;
    return k * vec3(0.36 * sin(uTime * 0.62 - ph) + 0.10 * sin(uTime * 1.73 - ph * 1.7),
                    0.17 * sin(uTime * 0.81 + 1.3 - ph) + 0.05 * sin(uTime * 2.1 - ph * 2.0),
                    0.12 * sin(uTime * 0.50 + ph));
  }`;

// 一段由粗到细的枝：沿曲线排一圈圈顶点。sway0、sway1 是两端的摇动系数
function limbGeometry(curve, r0, r1, sway0, sway1, sides = 8) {
  const n = Math.max(6, Math.ceil(curve.getLength() * 2.2)), frames = curve.computeFrenetFrames(n, false);
  const pos = [], nor = [], sway = [], idx = [], P = new THREE.Vector3();
  for (let i = 0; i <= n; i++) {
    const t = i / n, r = lerp(r0, r1, t ** .8) * (1 + .12 * Math.sin(i * 2.1 + r0 * 30));       // 粗细略有起伏，像老枝的节
    curve.getPointAt(t, P);
    for (let j = 0; j < sides; j++) {
      const a = j / sides * TAU, nx = Math.cos(a), ny = Math.sin(a), N = frames.normals[i], B = frames.binormals[i];
      const x = N.x * nx + B.x * ny, y = N.y * nx + B.y * ny, z = N.z * nx + B.z * ny;
      pos.push(P.x + x * r, P.y + y * r, P.z + z * r); nor.push(x, y, z); sway.push(lerp(sway0, sway1, t));
    }
    if (i < n) for (let j = 0; j < sides; j++) { const a = i * sides + j, b = i * sides + (j + 1) % sides; idx.push(a, a + sides, b, b, a + sides, b + sides); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('aSway', new THREE.Float32BufferAttribute(sway, 1));
  g.setIndex(idx);
  return g;
}

// 一朵梅花：五片略向上兜的圆瓣，中间一个小花心
function blossomGeometry() {
  const parts = [];
  for (let i = 0; i < 5; i++) {
    const petal = new THREE.CircleGeometry(.36, 12);
    petal.rotateX(-.42); petal.translate(0, .37, .06); petal.rotateZ(i / 5 * TAU);
    parts.push(petal);
  }
  const core = new THREE.SphereGeometry(.13, 8, 6); core.scale(1, 1, .7); core.translate(0, 0, .06); parts.push(core);
  return mergeGeometries(parts);
}

export function buildPlum(scene) {
  const [cx, cy] = WALL.window.c, rs = stream(31), group = new THREE.Group();
  group.position.set(cx, cy, WALL.z - WALL_THICK - 2);
  scene.add(group);
  const uniforms = { uTime: { value: 0 } }, limbs = [], V = (x, y, z = 0) => new THREE.Vector3(x, y, z);

  // 主枝：从窗外右上方进来，一路向左下折着走。坐标以月洞圆心为原点
  const main = { curve: new THREE.CatmullRomCurve3([V(19, 14.5, .4), V(15.6, 12.3, .2), V(12.2, 10.9, 0), V(9.4, 9.0, -.3), V(6.2, 8.3, 0), V(3.4, 6.4, .3), V(.6, 5.9, .1), V(-1.8, 4.3, -.2), V(-3.6, 4.4, 0)], false, 'catmullrom', .35), r0: .62, r1: .1, s0: 0, s1: .78 };
  limbs.push(main);
  // 从一段枝上岔出一根小枝：t 在母枝上的位置，angle 朝向（度，0 向右，90 向上），len 长度，bend 弯多少
  const twig = (parent, t, angle, len, bend, r) => {
    const from = parent.curve.getPointAt(t), a = angle * D, s0 = lerp(parent.s0, parent.s1, t), pts = [from.clone()];
    for (let i = 1; i <= 3; i++) { const k = i / 3, turn = a + bend * k * k; pts.push(V(from.x + Math.cos(turn) * len * k + rs.range(-.12, .12), from.y + Math.sin(turn) * len * k + rs.range(-.12, .12), from.z + rs.range(-.5, .5) * k)); }
    const l = { curve: new THREE.CatmullRomCurve3(pts, false, 'catmullrom', .4), r0: r, r1: .045, s0, s1: Math.min(1, s0 + len * .075) };
    limbs.push(l);
    return l;
  };
  const twigs = [
    twig(main, .12, 78, 6.4, -.25, .24), twig(main, .24, -108, 7.2, .22, .26), twig(main, .36, 96, 5.4, .2, .2), twig(main, .47, -98, 6.0, -.3, .22),
    twig(main, .60, 118, 4.6, -.25, .17), twig(main, .72, -126, 4.4, .3, .16), twig(main, .84, 150, 3.2, .2, .12), twig(main, .93, -150, 2.8, -.2, .1),
  ];
  for (const [i, t, angle, len] of [[1, .4, -40, 3.2], [1, .7, -160, 2.6], [3, .45, -30, 2.8], [3, .75, -150, 2.2], [0, .5, 40, 2.8], [2, .5, 150, 2.4], [4, .5, 60, 2.0], [5, .5, -80, 2.0]]) twigs.push(twig(twigs[i], t, angle, len, rs.range(-.3, .3), .1));

  const silhouette = (color, rim, instanced) => new THREE.ShaderMaterial({
    fog: false, side: THREE.DoubleSide, uniforms: { ...uniforms, uColor: { value: new THREE.Color(color) }, uRim: { value: new THREE.Color(rim) } },
    vertexShader: `${SWAY_GLSL}
      attribute float aSway; varying vec3 vNormal;
      void main(){
        ${instanced ? 'vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0); vec3 n = mat3(instanceMatrix) * normal;' : 'vec4 world = modelMatrix * vec4(position, 1.0); vec3 n = normal;'}
        world.xyz += swayAt(aSway, world.xyz);
        vNormal = normalize(mat3(viewMatrix) * mat3(modelMatrix) * n);
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    // 逆光：正面是暗的本色，轮廓边上勾一点月色
    fragmentShader: `uniform vec3 uColor, uRim; varying vec3 vNormal;
      void main(){ float rim = pow(1.0 - abs(normalize(vNormal).z), 2.4); gl_FragColor = vec4(uColor + uRim * rim, 1.0); }`,
  });
  group.add(new THREE.Mesh(mergeGeometries(limbs.map(l => limbGeometry(l.curve, l.r0, l.r1, l.s0, l.s1))), silhouette('#0B0A1E', '#2E3460', false)));

  // 花和花苞：多数开在小枝上，越靠梢越密；也有几朵贴着主枝
  const spots = [];
  for (const l of [...twigs, main]) {
    const count = l === main ? 10 : Math.round(l.curve.getLength() * rs.range(1.3, 1.9));
    for (let i = 0; i < count; i++) {
      const t = l === main ? rs.range(.3, .98) : (i + rs.range(.2, .8)) / count * .8 + .2, at = l.curve.getPointAt(t);
      spots.push({ at: at.add(V(rs.range(-.22, .22), rs.range(-.22, .22), rs.range(-.2, .2))), sway: lerp(l.s0, l.s1, t), bud: rs() < .45 });
    }
  }
  const dummy = new THREE.Object3D(), place = (list, geo, mat, size) => {
    const mesh = new THREE.InstancedMesh(geo, mat, list.length), sway = new Float32Array(list.length);
    list.forEach((s, i) => {
      dummy.position.copy(s.at); dummy.rotation.set(rs.range(-.6, .6), rs.range(-.6, .6), rs() * TAU); dummy.scale.setScalar(size * rs.range(.75, 1.15));   // 多数花朝着屋里开，五瓣的轮廓看得出来
      dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix); sway[i] = s.sway;
    });
    geo.setAttribute('aSway', new THREE.InstancedBufferAttribute(sway, 1));
    mesh.frustumCulled = false;
    group.add(mesh);
  };
  // 花逆着月光，只透出一点暗红
  place(spots.filter(s => !s.bud), blossomGeometry(), silhouette('#40160F', '#602A1C', true), 1.15);
  const bud = new THREE.SphereGeometry(.22, 10, 8); bud.scale(1, 1.2, 1);
  place(spots.filter(s => s.bud), bud, silhouette('#2C100F', '#4A2018', true), 1);

  return { update(t) { uniforms.uTime.value = t; } };
}
