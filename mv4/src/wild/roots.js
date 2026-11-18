// 根脚：让树和石头「长在」地上的那一圈东西。
//   贴地的暗影：每棵树脚下一块软的暗斑——紧贴树干的一小圈是接触的暗（一直都有），外面一大片是树冠的影子，朝背着日月的方向拖出去
//     （日月越低拖得越长）。真的投影只罩得住镜头焦点附近，罩得到的地方这一大片自动让给真影子，远处的林子靠它才不像贴上去的。
//     暗斑是一张小网格，每个顶点在着色器里落到地面的高度上，所以在坡上也贴着地。
//   近景树（路边那一圈）脚下还围着草丛，落叶树下秋天有落叶、桃树下春天有落花；中景的落叶树下各有一堆落叶。
import * as THREE from 'three';
import { rnd } from '../anim.js';
import { paint } from './paint.js';
import { herbKit, instanced, item, slopeNormal } from './herbs.js';

// 每种树：树冠的影子多大、树脚多粗（都还要乘上这棵树的大小）、落不落叶
const FOOT = {
  pine: { shade: 4.6, trunk: .55, sheds: false }, broad: { shade: 5.8, trunk: .5, sheds: true }, peach: { shade: 3.8, trunk: .3, sheds: true },
  willow: { shade: 6.2, trunk: .58, sheds: true }, plum: { shade: 3.4, trunk: .34, sheds: true }, bamboo: { shade: 3, trunk: 1.5, sheds: false },
  shrub: { shade: 1.9, trunk: .5, sheds: false },
};
const WALL = 6.4;                                                    // 路的基座和护坡到这么远为止，脚下的草和落叶不撒到它上面

let material = null;
function shadeMaterial() {
  if (!material) material = paint({
    transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    vertexPars: 'varying vec2 vDisc; varying float vCore;',
    world: /* glsl */`
      vec3 root = M[3].xyz; float R = length(M[0].xyz);
      vec2 away = -uSunDir.xz / max(length(uSunDir.xz), .001); float len = clamp(.45 / max(uSunDir.y, .2), .3, 1.8);
      vec2 xz = root.xz + (position.xz + away * dot(position.xz, away) * len * .5) * R + away * R * len * .45;
      wp = vec3(xz.x, groundAt(xz) + .12, xz.y); wn = vec3(0., 1., 0.);
      vDisc = position.xz; vCore = distance(xz, root.xz) / R;`,
    fragmentPars: 'varying vec2 vDisc; varying float vCore;',
    fragment: /* glsl */`
      float blob = smoothstep(1., .2, length(vDisc)), real = 0.;
      #if defined(USE_SHADOWMAP) && NUM_DIR_LIGHT_SHADOWS > 0
      for (int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i++) {                 // 落在真投影罩得到的范围里：树冠的影子让给真的
        vec3 sc = vDirectionalShadowCoord[i].xyz / vDirectionalShadowCoord[i].w; vec2 e = min(sc.xy, 1. - sc.xy);
        real = max(real, smoothstep(0., .12, min(e.x, e.y)));
      }
      #endif
      albedo = vec3(.03, .05, .06); sun = 0.; ao = .5;
      alpha = blob * blob * .4 * (1. - real) * bakedSun(vWp.xz) + smoothstep(.5, .05, vCore) * .45;`,
  });
  return material;
}
// 一批贴地的暗影。spots：[{ x, y, z, r }]（r 是暗影的半径）；grid：网格一边分几格（坡上起伏大的用细一点的）
export function shadeDecals(spots, grid) {
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(2, 2, grid, grid).rotateX(-Math.PI / 2), shadeMaterial(), spots.length), m = new THREE.Matrix4();
  spots.forEach((s, i) => mesh.setMatrixAt(i, m.makeScale(s.r, s.r, s.r).setPosition(s.x, s.y, s.z)));
  return mesh;
}

export function buildRoots(trees, terrain, road) {
  const { groundAt } = terrain, { mats, geos } = herbKit(), group = new THREE.Group(), n = new THREE.Vector3();
  const spot = t => ({ x: t.x, y: t.y, z: t.z, r: FOOT[t.kind].shade * t.scale });
  group.add(shadeDecals(trees.filter(t => t.tier !== 'far').map(spot), 3), shadeDecals(trees.filter(t => t.tier === 'far').map(spot), 1));

  const tufts = geos.tuft.map(() => []), fallen = geos.litter.map(() => []), petals = geos.litter.map(() => []);
  const clear = (x, z) => { const on = road.locate(x, z); return !on || on.d > WALL; };
  trees.forEach((t, ti) => {
    if (t.tier === 'far' || t.potted) return;
    const F = FOOT[t.kind], near = t.tier === 'near', R = k => rnd(ti * 7.31 + k * 1.77 + 2.9);
    // 围着树脚的草
    for (let i = 0; near && i < 5; i++) {
      const a = i / 5 * 6.283 + R(i), d = F.trunk * t.scale * (1.5 + 1.6 * R(i + 10)), x = t.x + Math.cos(a) * d, z = t.z + Math.sin(a) * d;
      if (clear(x, z)) tufts[i % tufts.length].push(item(x, groundAt(x, z) - .04, z, ti * 13 + i, .7 + .6 * R(i + 20), .8 + .5 * R(i + 30)));
    }
    // 树下的落叶、落花：近景几小堆，中景一大堆
    if (!F.sheds) return;
    const piles = near ? 6 : 1, into = t.kind === 'peach' ? petals : fallen;
    for (let i = 0; i < piles; i++) {
      const a = i * 2.4 + R(i + 40) * 2, d = F.shade * t.scale * (near ? .12 + .7 * Math.sqrt(R(i + 50)) : .25), x = t.x + Math.cos(a) * d, z = t.z + Math.sin(a) * d, pile = item(x, groundAt(x, z) + .04, z, ti * 17 + i, near ? 1 + .8 * R(i + 60) : 2.6, 1, slopeNormal(groundAt, x, z, n).clone());
      if (clear(x, z)) { into[i % into.length].push(pile); if (t.kind === 'peach') fallen[i % fallen.length].push(pile); }
    }
  });
  const put = (lists, shapes, mat) => lists.forEach((items, i) => { if (items.length) group.add(instanced(shapes[i], mat, items)); });
  put(tufts, geos.tuft, mats.grass); put(fallen, geos.litter, mats.fallen); put(petals, geos.litter, mats.petals);
  return group;
}
