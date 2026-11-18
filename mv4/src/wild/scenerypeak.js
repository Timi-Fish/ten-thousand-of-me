// 主峰顶上盖上去的细节：雪夜「月出峰后」那个机位里，峰顶和两肩是画面里唯一的实景，要经得起看。
// 这里的东西都是摆上去的，全都摆在路中线 PATH_GAP 以外，并且让开山脊石阶两个近景机位的视线：
//   岩角和石墩——峰顶四周和登山道上段两旁的崖沿上探出去一块块岩角、立起一根根石墩（都是平顶的、钝的，不高过亭子的台基），
//               顶上和每一层台面压着雪，底下挂着一排冰凌；峰顶的剪影是亭子和松，石头只是参差的一圈崖沿。
//   松——崖沿上一棵棵黄山松（贴着崖探出去的、斜着长的），交给种树的人种（sites.trees）。
//   亭的灯——六个檐角下各挂一盏灯笼，亭里正中吊一盏；夜里亮，光晕映在亭子四周的雪上。
// 远看的灯晕（far）：山脊石阶上的每盏石灯（props.js 的和 scenery.js 添的）远远看去只有几个像素，另给一层只在远处显出来的柔光，
//   一串暖光顺着石阶一路通到亭子；近景里它不显出来（离镜头 FAR_FROM 以内是零）。
import * as THREE from 'three';
import { rnd } from '../anim.js';
import { Kit, MAT, place, builtMaterial } from './kit.js';
import { COMMON, U, paint, shadowed } from './paint.js';
import { ridgePlace } from './ridgeplace.js';

const PATH_GAP = 8.5, CAP = 230, SHOT_CLEAR = 125, LANTERN = '#FF9A4A';
// 亭子的尺寸（和 pavilion.js 一致）：檐角离中心多远、檐口离地坪多高
const EAVE_R = 9.4, EAVE_Y = 7.2;

// 一根石笋 / 一块岩角：竖着拉长的多面体，分三四层，每层往里收一点、错开一点，层面是平的（好积雪），四面带竖的棱
function spireGeometry(seed, tiers, lean) {
  const kit = new Kit().use(MAT.stone), R = k => rnd(seed * 7.7 + k * 3.1);
  let y = -2, r = 1, x = 0, z = 0;
  for (let t = 0; t < tiers; t++) {
    const h = (1.6 + 1.4 * R(t)) * (t === tiers - 1 ? 1.3 : 1), n = 5 + Math.floor(R(t + 9) * 3), top = r * (.62 + .25 * R(t + 3));
    const g = new THREE.CylinderGeometry(t === tiers - 1 ? top * .8 : top, r, h, n, 1).rotateY(R(t + 5) * 6);   // 顶是钝的：最上一层也只略收一点，留一个平顶
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (.8 + .4 * R(i + t * 20)), p.getY(i), p.getZ(i) * (.8 + .4 * R(i + t * 20 + 50)));
    g.computeVertexNormals();
    kit.add(g, t % 2 ? '#8E9088' : '#9C9D94', place(x, y + h / 2, z));
    y += h; r = top; x += lean * (R(t + 7) - .3); z += lean * (R(t + 11) - .5);
  }
  return kit.geometry();
}
// 冰凌：一排细的锥，挂在 (0, 0, 0) 往下
function icicleGeometry() {
  const kit = new Kit().use(MAT.paper);
  for (let k = 0; k < 7; k++) kit.add(new THREE.ConeGeometry(.07 + .05 * rnd(k * 3.3), .5 + 1.1 * rnd(k * 5.7), 5).rotateX(Math.PI), '#DCE8F6', place((k - 3) * .32, -.4 - .5 * rnd(k * 5.7), (rnd(k * 2.1) - .5) * .3));
  return kit.geometry();
}
// 灯笼：上下两个木盖，纸的灯身（夜里亮），底下垂一缕穗
function lanternGeometry() {
  const kit = new Kit();
  kit.use(MAT.wood).box(.04, .9, .04, '#3E2018', place(0, .85, 0)).add(new THREE.CylinderGeometry(.24, .24, .1, 8), '#3E2018', place(0, .45, 0)).add(new THREE.CylinderGeometry(.24, .24, .1, 8), '#3E2018', place(0, -.45, 0));
  kit.use(MAT.paper).add(new THREE.SphereGeometry(.45, 10, 8), LANTERN, place(0, 0, 0, 0, 0, 0, 1, 1.2, 1), 1.8).box(.05, .5, .05, '#B8402C', place(0, -.8, 0));
  return kit.geometry();
}

// 石头的材质：深色的岩面（远看是一块块的冷灰），朝上的面积雪，背着光的时候棱上被月光勾一道边
let rockMat = null;
const rockMaterial = () => rockMat ??= paint({
  vertexPars: 'attribute vec3 aCol; varying vec3 vCol;', vertex: 'vCol = aCol;',
  fragmentPars: 'varying vec3 vCol;',
  fragment: /* glsl */`
    float grain = noise1(vWp.xz * 1.7 + vWp.y * .9) * .6 + noise1(vec2(vWp.x + vWp.z, vWp.y) * .35) * .4;
    albedo = vCol * (.78 + .44 * grain);
    float snow = uSnow * smoothstep(.45, .75, N.y + (grain - .5) * .3);
    albedo = mix(albedo, vec3(.9, .93, 1.), snow);
    sun *= bakedSun(vWp.xz);
    vec3 toEye = normalize(cameraPosition - vWp);
    float rim = pow(1. - max(dot(N, toEye), 0.), 2.5) * smoothstep(.2, .85, dot(-toEye, uSunDir)) * (.5 + .5 * max(N.y, 0.)) * (.6 + .8 * max(dot(N, uSunDir), 0.));
    glow += uSunCol * mix(albedo, vec3(1.), .4) * rim * uSnow * smoothstep(60., 220., distance(vWp, cameraPosition)) * .55;
    glow += uSkyCol * albedo * uSnow * .1 * (.6 + .4 * N.y) * (1. - sun);                    // 背光面：天光映出来的冷蓝`,
});

const FAR_FROM = 140;                                                 // 远看的柔光从离镜头多远开始显出来
const FAR_VERT = /* glsl */`
attribute vec4 aSpot;       // 灯的位置、光晕多大（离镜头越远放得越大一点，远看也有几个像素）
varying vec2 vUv; varying vec3 vWp; varying float vFar;
void main() {
  vUv = position.xy; vWp = aSpot.xyz;
  float d = distance(aSpot.xyz, cameraPosition);
  vFar = smoothstep(${FAR_FROM.toFixed(1)}, ${(FAR_FROM + 160).toFixed(1)}, d);
  vec4 mv = viewMatrix * vec4(aSpot.xyz, 1.);
  mv.xy += position.xy * aSpot.w * (1. + d * .004);
  gl_Position = projectionMatrix * mv;
}`;
const FAR_FRAG = /* glsl */`
#include <common>
${COMMON}
varying vec2 vUv; varying vec3 vWp; varying float vFar;
void main() {
  float r = length(vUv), halo = exp(-r * r * 5.) * .35 + exp(-r * r * 30.) * .65;
  float veil = exp(-uFogP.x * 1.6 * distance(vWp, cameraPosition));
  float flicker = .93 + .07 * sin(uTime * 5.3 + vWp.x * 3.1) * sin(uTime * 3.7 + vWp.z * 2.3);
  gl_FragColor = vec4(vec3(1., .66, .32) * halo * uLamp * veil * flicker * vFar * smoothstep(1., .6, r) * .9, 1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// shots：推荐机位；groundAt：地面高度；plan：建筑的位置（亭子在 plan.pavilion）；lamps：路边石灯灯心的位置（远看的柔光）
export function buildPeak(road, groundAt, shots, plan, lamps) {
  const glowMaterial = { built: builtMaterial(), far: new THREE.ShaderMaterial({ vertexShader: FAR_VERT, fragmentShader: FAR_FRAG, uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }) };
  const group = new THREE.Group(), P = ridgePlace(road, groundAt, shots), trees = [], spires = [], icicles = [];
  const away = (x, z) => { const on = road.locate(x, z); return on ? on.d : 99; };
  const top = plan.pavilion;
  // 能不能摆：离路中线够远，不在两个近景机位的视线里，不压在亭子的台基上
  // 近景机位（山脊石阶那两个）的镜头和它看的那一点周围 SHOT_CLEAR 以内什么都不摆：那里的画面是别人布置好的
  const close = shots.filter(s => Math.hypot(s.p[0] - s.q[0], s.p[2] - s.q[2]) < 70).flatMap(s => [s.p, s.q]);
  const free = (x, z, r) => away(x, z) > PATH_GAP + r && !P.blocks(x, groundAt(x, z) + 3, z, r) && Math.hypot(x - top.x, z - top.z) > 15 + r && plan.clearings.slice(1).every(c => Math.hypot(x - c.x, z - c.z) > c.r + r) && close.every(c => Math.hypot(x - c[0], z - c[2]) > SHOT_CLEAR);
  // 崖沿：从这一点往外（朝下坡）地面掉得快 —— 立在这儿的东西会成为剪影的一部分
  const edge = (x, z) => { const h = groundAt(x, z), dx = groundAt(x + 4, z) - groundAt(x - 4, z), dz = groundAt(x, z + 4) - groundAt(x, z - 4); return { h, fall: Math.hypot(dx, dz) / 8, out: Math.atan2(-dx, -dz), yaw: Math.atan2(dz, -dx) }; };   // out：朝下坡的方位（+z 为 0）；yaw：把树的 +x 转到朝下坡（和 forest.js 一样）
  // 一块岩角（前两种：矮而宽、一层层的平台，朝崖外探）或一根石笋（后两种：细高）
  const shapes = [0, 1, 2, 3].map(i => spireGeometry(i * 2.3 + .7, 3 + (i % 2), .25 + .1 * i)), TALL = shapes.map(g => { g.computeBoundingBox(); return g.boundingBox.max.y; });   // 四种造型，和各自有多高
  const rock = (x, z, e, k, size) => {
    const copy = k % 4, slab = copy < 2, r = rnd(k * 2.3), t = rnd(k * 8.1);
    const s = (slab ? 2.6 + 1.8 * r : 2 + 1.1 * r) * size, tall = slab ? .45 + .35 * t : .6 + .3 * t;
    // 不高过亭子的台基：亭子始终立在石头上面，峰顶的剪影是亭子，不是石笋
    return { x, z, y: e.h - 1.5, yaw: rnd(k * 5.1) * 6.28, s, tall: Math.min(tall, Math.max(.2, (top.y + 2 - (e.h - 1.5)) / (s * TALL[copy]))), copy };
  };
  let k = 0;
  // 峰顶一圈：离亭子 15 到 46，往外一圈一圈撒；贴着峰顶的一圈（亭子脚下那面圆的石顶）撒得密，多是大块的岩角
  for (let ring = 15; ring <= 46; ring += 3) for (let a = 0; a < 360; a += 360 / (ring * (ring < 34 ? 1.2 : .6))) {
    k++;
    const ang = (a + 23 * rnd(k * 1.7)) * Math.PI / 180, x = top.x + Math.sin(ang) * ring, z = top.z + Math.cos(ang) * ring, e = edge(x, z);
    if (e.h < top.y - 70 || e.fall < .35) continue;
    const pick = rnd(k * 3.9 + .2) * (ring < 34 ? .7 : 1);
    if (pick < .3 && e.h < top.y - 6 && e.fall > .7 && free(x, z, 3)) { spires.push(rock(x, z, e, k, ring < 34 ? 1.35 : 1)); icicles.push({ x: x + Math.sin(e.out) * 2.4, z: z + Math.cos(e.out) * 2.4, y: e.h + 1.2, yaw: e.out }); }
    else if (pick < (ring < 34 ? .62 : .8) && e.h < top.y - 5 && free(x, z, 2)) trees.push({ x, z, kind: 'pine', form: e.fall > .9 ? 'crag' : 'lean', scale: .55 + .3 * rnd(k * 6.7), yaw: e.yaw });   // 崖沿以下探出去的松：不站在台地上挡亭子
  }
  // 登山道上段（天街、十八盘）两旁：沿路往下 CAP 以内，两侧离中线 9 到 34 的崖沿上
  const p = new THREE.Vector3(), r = new THREE.Vector3();
  for (let s = 10; s < CAP; s += 5) for (const side of [-1, 1]) for (const o of [10, 16, 23, 31]) {
    k++;
    road.at0(s + 4 * (rnd(k * 1.3) - .5), p); road.right(s, r);
    const x = p.x + r.x * side * (o + 3 * rnd(k * 2.9)), z = p.z + r.z * side * (o + 3 * rnd(k * 2.9)), e = edge(x, z);
    if (e.h < p.y - 45 || e.fall < .6 || rnd(k * 4.4) > .45) continue;
    if (rnd(k * 7.3) < .2) { if (free(x, z, 3)) spires.push(rock(x, z, e, k, .85)); }                     // 路两旁成丛的山石在 wayside.js，这里只零星几块
    else if (free(x, z, 2)) trees.push({ x, z, kind: 'pine', form: e.fall > .9 ? 'crag' : 'lean', scale: .6 + .35 * rnd(k * 6.7), yaw: e.yaw });
  }
  // 摆进场景
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), sc = new THREE.Vector3(), at = new THREE.Vector3();
  shapes.forEach((geo, i) => {
    const list = spires.filter(t => t.copy === i);
    if (!list.length) return;
    const mesh = shadowed(new THREE.InstancedMesh(geo, rockMaterial(), list.length), false, true);
    list.forEach((t, j) => mesh.setMatrixAt(j, m.compose(at.set(t.x, t.y, t.z), q.setFromAxisAngle(up, t.yaw), sc.set(t.s, t.s * t.tall, t.s))));
    mesh.computeBoundingSphere(); group.add(mesh);
  });
  // 冰凌：挂在岩角朝外的那一边
  {
    const mesh = shadowed(new THREE.InstancedMesh(icicleGeometry(), glowMaterial.built, icicles.length), false, false);
    icicles.forEach((t, j) => mesh.setMatrixAt(j, m.compose(at.set(t.x, t.y, t.z), q.setFromAxisAngle(up, t.yaw), sc.set(1.4, 1.4, 1.4))));
    mesh.computeBoundingSphere(); group.add(mesh);
  }
  // 亭的灯笼：六个檐角下各一盏，正中吊一盏
  const hung = [];
  for (let i = 0; i < 6; i++) { const a = (i + .5) * Math.PI / 3; hung.push(new THREE.Vector3(top.x + Math.sin(a) * EAVE_R, top.y + EAVE_Y - 1.2, top.z + Math.cos(a) * EAVE_R)); }
  hung.push(new THREE.Vector3(top.x, top.y + 5.2, top.z));
  {
    const mesh = shadowed(new THREE.InstancedMesh(lanternGeometry(), glowMaterial.built, hung.length), false, false);
    hung.forEach((v, j) => mesh.setMatrixAt(j, m.compose(v, q.identity(), sc.set(1.2, 1.2, 1.2))));
    mesh.computeBoundingSphere(); group.add(mesh);
  }
  // 远看的柔光：山脊上的每盏石灯、亭子的灯笼。近景里不显
  const ridgeLamps = lamps.filter(v => Math.hypot(v.x - top.x, v.z - top.z) < 700);
  const spots = [...ridgeLamps.map(v => [v.x, v.y, v.z, 1.6]), ...hung.map(v => [v.x, v.y, v.z, 1.4]), [top.x, top.y + 5, top.z, 5]];
  const quad = new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry(2, 2)), data = new Float32Array(spots.length * 4);
  spots.forEach((v, i) => data.set(v, i * 4));
  quad.setAttribute('aSpot', new THREE.InstancedBufferAttribute(data, 4)); quad.instanceCount = spots.length;
  const far = new THREE.Mesh(quad, glowMaterial.far);
  far.frustumCulled = false; far.renderOrder = 31; group.add(far);
  // 地上的暖光：亭子一团、每盏石灯一小团（交给地形的着色器，和村子的灯光一样）
  const pools = [{ x: top.x, z: top.z, reach: 26, power: 1.2 }, ...ridgeLamps.filter(v => Math.hypot(v.x - top.x, v.z - top.z) < CAP + 30).map(v => ({ x: v.x, z: v.z, reach: 9, power: .9 }))];
  return { group, trees, pools, lanterns: hung, count: { spires: spires.length, pines: trees.length, icicles: icicles.length } };
}
