// 石头：路边的山石。有棱角——先把一个球揉成不规则的一团，再用几刀平面削出大块的平面，棱线是削出来的，不是光滑的卵石；
// 石面上有横向的层理、斜着一刀刀的斧劈皴和一簇簇苔点，朝上的面长苔，贴地的一圈发暗（和地面接得上），雨里颜色沉下去，冬天顶上压雪。
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { rnd } from '../anim.js';
import { fbm } from './noise.js';
import { paint, seasonal } from './paint.js';
import { SEASONS } from './seasons.js';

// detail：细分几次（2 是大石，320 个面；1 是小石，80 个面）
export function rockGeometry(seed, detail) {
  const g = mergeVertices(new THREE.IcosahedronGeometry(1, detail).deleteAttribute('uv').deleteAttribute('normal')), p = g.attributes.position, v = new THREE.Vector3();
  // 削石头的几刀：每刀一个朝向、离中心多远
  const cuts = Array.from({ length: 7 }, (_, i) => ({ n: new THREE.Vector3(rnd(seed * 3.1 + i * 7.7) - .5, (rnd(seed * 5.3 + i * 2.9) - .3) * .9, rnd(seed * 9.7 + i * 4.1) - .5).normalize(), d: .5 + .32 * rnd(seed * 1.7 + i * 6.3) }));
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    v.multiplyScalar(.8 + .5 * fbm(v.x * 1.3 + seed, v.y * 1.3 + v.z * 1.1 + seed * 2, 2));
    for (const { n, d } of cuts) { const over = v.dot(n) - d; if (over > 0) v.addScaledVector(n, -over); }
    p.setXYZ(i, v.x, Math.max(v.y * .8, -.22), v.z);
  }
  g.computeVertexNormals();
  return g;
}

let material = null;
export function rockMaterial() {
  if (!material) material = paint({
    uniforms: seasonal(SEASONS.春.u, 'uRockA', 'uRockB', 'uMoss'),
    vertexPars: 'varying float vLift;', vertex: 'vLift = p.y + .22;',
    fragmentPars: 'uniform vec3 uRockA, uRockB, uMoss; varying float vLift;',
    fragment: /* glsl */`
      float g = fbm(vWp.xz * 1.3 + vWp.y * 2.1), strata = fbm(vec2(vWp.y * 3.3 + g * 1.4, (vWp.x + vWp.z) * .45)), m = fbm(vWp.xz * .7 + 9.), foot = smoothstep(0., .4, vLift);
      albedo = mix(uRockB, uRockA, smoothstep(.25, .75, strata * .55 + g * .45 + .25 * N.y)) * mix(.5, 1., foot);
      // 皴：顺着一个斜的方向一刀刀短促的墨痕（斧劈），背光的面上密一些；横着几道断断续续的层理缝。离远了化掉
      float near = smoothstep(170., 25., distance(vWp, cameraPosition)), slant = dot(vWp, vec3(.8, 1.9, .5)), lay = dot(vWp, vec3(-.5, .3, .8));
      float cut = noise1(vec2(slant * 2.4, lay * .5)) * .65 + noise1(vec2(slant * 6.1, lay * 1.3)) * .35;
      albedo *= 1. - .36 * smoothstep(.54, .68, cut) * near * (.45 + .55 * smoothstep(.7, -.2, dot(N, uSunDir)));
      albedo *= 1. - .4 * smoothstep(.07, .0, abs(fract(vWp.y * .5 + g * .9) - .5)) * smoothstep(.35, .6, noise1(vec2(lay * .4, vWp.y * 1.5))) * near;
      albedo = mix(albedo, uMoss * .7, smoothstep(.48, .7, m + .45 * N.y - .22) * (1. - uSnow));
      // 苔点：朝上的面和棱上一簇簇墨绿的点
      vec2 dc = vWp.xz * 3.1 + vWp.y * 1.3; vec4 dh = texture2D(uNoise, (floor(dc) + .5) / 256.);
      float dots = smoothstep(.24, .12, length(fract(dc) - .5 - (dh.rg - .5) * .5)) * step(.35, dh.b) * smoothstep(.46, .66, fbm(vWp.xz * .45 + 3.) + .3 * N.y) * near;
      albedo = mix(albedo, uMoss * .3, dots * .85 * (1. - uSnow));
      // 雨里：石头颜色沉下去；放晴后迎着日头的面上有几粒水光
      albedo = soak(albedo * mix(1., .82, uWet), uWet);
      glow = uSunCol * dewGlint(vWp, N, .09) * .12 * uWet;
      albedo = mix(albedo, vec3(.9, .93, 1.), uSnow * smoothstep(.35, .75, N.y + (g - .5) * .5));
      ao = mix(.5, 1., foot); sun *= bakedSun(vWp.xz);`,
  });
  return material;
}
