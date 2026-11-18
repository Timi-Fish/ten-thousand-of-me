// 各段表演共用的家当：一班小蟹演员、分裂时的拉丝、光点、薄纸，以及两个场景（书案、画中山水）的把手。
// 用法是「每帧现说」：每一帧开始时全部清空，当前这段表演说这一帧谁上场、哪里有光点、哪里有纸；没被点到的就不出现。
// 这样每一帧只取决于时刻，可以乱序渲染。
import * as THREE from 'three';
import { Crab, Bond, KIT_NAMES } from '../crab.js';
import { buildSlips } from './slips.js';
import { buildPuffs } from './puffs.js';
import { bodyOf } from './body.js';

const FULL = 15, LITE = 40, BONDS = 16, LIGHTS = 1200;
const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), at3 = new THREE.Vector3(), size3 = new THREE.Vector3(), down = new THREE.Vector3(0, -1, 0);

export function buildKit({ world, wild, shore, deskScene }) {
  const root = new THREE.Group();                                     // 所有家当都挂在这下面；拍哪个场景，就把它挪进哪个场景
  const cast = (kit, steps) => { const crab = new Crab(kit, steps); root.add(crab.root); return crab; };
  // 演员：主角（头上一支簪）、和主角一模一样的另一只、15 只戴各种头饰的分身、40 只精简档的人群
  const hero = cast('pin'), twin = cast('pin');
  const full = Array.from({ length: FULL }, (_, i) => cast(KIT_NAMES[1 + i % 6]));
  const lite = Array.from({ length: LITE }, (_, i) => cast(KIT_NAMES[1 + i % 6], 24));
  const actors = [hero, twin, ...full, ...lite], acting = new Map();
  const names = new Map([[hero, '主角'], [twin, '孪生'], ...full.map((c, i) => [c, `分身${i}`]), ...lite.map((c, i) => [c, `人群${i}`])]);   // 检查报告里怎么称呼每一只

  const bonds = Array.from({ length: BONDS }, () => { const bond = new Bond(); root.add(bond.root); return bond; }), pulls = [], merging = [];

  // 光点：一个发光的小球（亮度超过 1 的颜色会泛光），外面罩一圈朝着镜头的柔和光晕。两样都跟着场景的雾走：远处的光会淡下去、融进空气里
  const lightMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshBasicMaterial(), LIGHTS);
  lightMesh.frustumCulled = false; lightMesh.renderOrder = 20; lightMesh.count = 0;   // 画在浮尘、光柱这些半透明的东西之后
  lightMesh.setColorAt(0, new THREE.Color(1, 1, 1));
  // 光晕：比小球大 HALO 倍的一张面，中间亮、往外很快淡掉，叠加在画面上，不挡别的东西
  const HALO = 4.5, haloMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog]),
    vertexShader: /* glsl */`
      #include <fog_pars_vertex>
      varying vec2 vP; varying vec3 vTint;
      void main() {
        vP = position.xy; vTint = instanceColor;
        vec4 mvPosition = viewMatrix * modelMatrix * instanceMatrix * vec4(0., 0., 0., 1.);
        mvPosition.xy += position.xy * length(instanceMatrix[0].xyz) * ${HALO.toFixed(1)};
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <fog_pars_fragment>
      varying vec2 vP; varying vec3 vTint;
      void main() {
        float r = length(vP) * ${HALO.toFixed(1)}, glow = .16 * exp(-r * r * .32) + .05 / (1. + r * r) * (1. - smoothstep(${(HALO * .6).toFixed(2)}, ${HALO.toFixed(1)}, r));
        #ifdef USE_FOG
          #ifdef FOG_EXP2
            glow *= exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
          #else
            glow *= 1. - smoothstep(fogNear, fogFar, vFogDepth);
          #endif
        #endif
        gl_FragColor = vec4(vTint * glow, 1.);
      }`,
  }), LIGHTS);
  haloMesh.frustumCulled = false; haloMesh.renderOrder = 21; haloMesh.count = 0;
  haloMesh.setColorAt(0, new THREE.Color(1, 1, 1));
  root.add(lightMesh, haloMesh);
  const lights = {
    // at [x, y, z]；size 小球的半径；color 是 THREE.Color（分量可以大于 1）
    put(at, size, color) {
      const i = lightMesh.count++;
      if (i >= LIGHTS) throw new Error(`同屏的光点超过了 ${LIGHTS} 个`);
      m4.compose(at3.fromArray(at), q4, size3.setScalar(size));
      lightMesh.setMatrixAt(i, m4); lightMesh.setColorAt(i, color);
      haloMesh.setMatrixAt(i, m4); haloMesh.setColorAt(i, color);
    },
  };

  const slips = buildSlips();
  root.add(slips.mesh);
  const puffs = buildPuffs();                                          // 落地时脚边带起的尘、雪沫、水花
  root.add(puffs.mesh);

  // 各段自己的道具：挂在一个组里，只有轮到那一段时才显示
  const props = [];
  const ray = new THREE.Raycaster(), solid = ['desk', 'study', 'glow'].map(name => deskScene.getObjectByName(name));
  deskScene.updateMatrixWorld(true);                                  // 器物摆好的位置要算一遍才作数，否则还没渲染过一帧时量出来的高度不对
  return {
    root, world, wild, shore, hero, twin, full, lite, lights, slips, puffs,
    // 这一帧让这只小蟹上场。poseAt(时刻) 返回姿势
    act(crab, poseAt) { acting.set(crab, poseAt); },
    // 这一帧在两只小蟹之间拉一根丝。u：它俩分开后的秒数（0 到 0.7 之外不显示）
    bond(a, b, u) { pulls.push([a, b, u]); },
    // 这一帧 b 正从 a 的身体里分出来（没有拉丝的那种，比如像爆米花一样蹦出来）：这两只此刻叠在一起是本来的样子，穿模检查不报
    merge(a, b) { merging.push([a, b]); },
    // 新建一个道具组，交给调用它的那一段；owner 是那一段的编号
    group(owner) { const g = new THREE.Group(); g.visible = false; root.add(g); props.push({ owner, g }); return g; },
    // 书案上某一点正下方，最高的那个表面有多高（案面、纸、器物）。从 fromY 往下找；找不到说明这一点在书案外面
    groundAt(x, z, fromY = 40) {
      ray.set(at3.set(x, fromY, z), down);
      const hit = ray.intersectObjects(solid, true).find(h => h.object.isMesh && h.object.material.depthWrite !== false);
      if (!hit) throw new Error(`(${x}, ${z}) 下面没有可以站的地方`);
      return hit.point.y;
    },
    // 书案上从 from 朝 dir 看出去，far 以内最近的器物表面有多远（没有就是 far）。给穿模检查用
    probe(from, dir, far) {
      ray.set(from, dir); ray.far = far;
      const hit = ray.intersectObjects(solid, true).find(h => h.object.isMesh && h.object.material.depthWrite !== false);
      ray.far = Infinity;
      return hit ? hit.distance : far;
    },
    // —— 以下由总调度每帧调用 ——
    begin(owner) {
      acting.clear(); pulls.length = 0; merging.length = 0; lightMesh.count = 0; slips.clear(); puffs.clear();   // 光晕的个数在 end 里跟着小球走
      props.forEach(p => { p.g.visible = p.owner === owner; });
    },
    end(t) {
      actors.forEach(crab => { const poseAt = acting.get(crab); if (poseAt) crab.update(poseAt, t); else crab.root.visible = false; });
      if (pulls.length > BONDS) throw new Error(`同一帧的拉丝超过了 ${BONDS} 根`);
      bonds.forEach((bond, i) => { if (i < pulls.length) bond.update(...pulls[i]); else bond.update(hero, twin, -1); });   // 拉丝要在小蟹之后更新；没用上的给一个「还没分开」的时刻，它自己会隐藏
      haloMesh.count = lightMesh.count;
      puffs.commit();
      for (const mesh of [lightMesh, haloMesh]) { mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true; }
      // 薄纸避让小蟹的身体；结果留着给穿模检查看
      const bodies = actors.filter(crab => crab.root.visible).map(crab => bodyOf(crab, names.get(crab)));
      this.seen = { bodies, pushed: slips.settle(bodies), parting: [...pulls, ...merging].map(([a, b]) => [a, b]) };
    },
    seen: { bodies: [], pushed: [], parting: [] },                    // 最近一帧：上场的小蟹的身体、被推开的纸、正在分开的每一对（拉着丝的、刚蹦出来的）
  };
}
