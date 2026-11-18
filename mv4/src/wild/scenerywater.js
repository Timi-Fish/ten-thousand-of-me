// 山上流下来的溪（scenerystreams.js 定的走向）和湖边的芦苇荡。
// 溪：顺着水道铺一条带子，源头窄、越往下越宽；水纹顺流滚动。缓处是青的水、映着天；陡处一级级跌成白的跌水；崖上直挂下来的一段整条是白的瀑布，
//     远看就是一道道从山上挂下来的白线。冬天冻住：发青白，水纹不动。
// 芦苇：湖岸的浅滩上（水深 0 到 1.3）一丛挨一丛，成片地有、成片地没有；湖心小洲的四周也围一圈。
import * as THREE from 'three';
import { rnd } from '../anim.js';
import { fbm } from './noise.js';
import { COMMON, U, seasonal } from './paint.js';
import { SEASONS } from './seasons.js';
import { herbKit, instanced, item } from './herbs.js';
import { lakeDepth, LAKE, ISLES } from './scenerymap.js';

const VERT = /* glsl */`
attribute vec3 aInfo;       // 顺流走了多远、这一处多陡、离源头几成
varying vec3 vWp, vInfo; varying float vAcross;
void main() { vWp = (modelMatrix * vec4(position, 1.)).xyz; vInfo = aInfo; vAcross = uv.x; gl_Position = projectionMatrix * viewMatrix * vec4(vWp, 1.); }`;
const FRAG = /* glsl */`
#include <common>
${COMMON}
uniform vec3 uWaterDeep, uWaterShallow;
uniform vec2 uFlow;
varying vec3 vWp, vInfo; varying float vAcross;
void main() {
  float along = vInfo.x, steep = vInfo.y, run = uTime * (1. - uFlow.y) * (3. + 14. * min(steep, 1.5));
  vec3 rd = normalize(vWp - cameraPosition);
  vec3 light = (uSkyCol * .8 + uSunCol * .55 * bakedSun(vWp.xz)) * (RECIPROCAL_PI * GAIN), white = mix(light, vec3(dot(light, vec3(.3333))), .35) * 1.3;
  float edge = abs(vAcross);
  // 白：陡处的跌水和瀑布（整条），缓处只有零星几道沫
  float fall = smoothstep(.45, 1.1, steep), rapids = smoothstep(.12, .45, steep);
  float streak = noise1(vec2(vAcross * 4. + 3.1, (along - run) * .12)) * .6 + noise1(vec2(vAcross * 9., (along - run) * .3)) * .4;
  float foam = max(fall * (.75 + .25 * streak), rapids * smoothstep(.45, .75, streak + .2 * rapids));
  foam = max(foam, smoothstep(.6, .95, edge + .15 * streak) * .5);
  vec3 sky = skyBase(reflect(rd, vec3(0., 1., 0.)));
  vec3 water = mix(mix(uWaterShallow, uWaterDeep, smoothstep(.9, .2, edge)) * light, sky * .6, .35 + .4 * pow(1. - abs(rd.y), 3.));
  vec3 c = mix(water, white, foam);
  c = mix(c, mix(vec3(.72, .8, .92), vec3(.9, .93, 1.), streak) * (uSkyCol + uSunCol * .6) * (RECIPROCAL_PI * GAIN) * 1.2, uFlow.y);   // 冬天冻住
  c = wildFog(c, vWp);
  gl_FragColor = vec4(c, smoothstep(1., .7, edge) * mix(.85, 1., foam));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// 一条溪的带子：pts 每项 { x, z, y 沟底, steep }；wide 比山上的溪宽几倍
function ribbon(pts, groundAt, wide) {
  const pos = [], uv = [], info = [], idx = [], n = pts.length;
  let along = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz) || 1, rx = -dz / len, rz = dx / len;
    if (i > 0) along += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
    const k = i / (n - 1), half = (1.3 + 2.4 * k + .6 * Math.min(pts[i].steep, 1.5)) * wide, y = Math.max(pts[i].y + 1, groundAt(pts[i].x, pts[i].z) + .45);
    for (const side of [-1, 1]) { pos.push(pts[i].x + rx * half * side, y, pts[i].z + rz * half * side); uv.push(side, k); info.push(along, pts[i].steep, k); }
    if (i < n - 1) { const v = i * 2; idx.push(v, v + 2, v + 1, v + 1, v + 2, v + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('aInfo', new THREE.Float32BufferAttribute(info, 3));
  g.setIndex(idx); g.computeBoundingSphere();
  return g;
}

export function buildStreamWater(relief, terrain) {
  const group = new THREE.Group(), tints = seasonal(SEASONS.春.u, 'uWaterDeep', 'uWaterShallow', 'uFlow');
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: { ...U, ...tints }, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  for (const s of relief.streams.list) { const mesh = new THREE.Mesh(ribbon(s.pts, terrain.groundAt, s.wide), mat); mesh.renderOrder = 5; group.add(mesh); }

  // 芦苇荡
  const { mats, geos } = herbKit(), beds = geos.reed.map(() => []), keep = relief.keep;
  let k = 0;
  for (let z = LAKE.z - LAKE.rz * 1.6; z < LAKE.z + LAKE.rz * 1.6; z += 2.6) for (let x = LAKE.x - LAKE.rx * 1.6; x < LAKE.x + LAKE.rx * 1.6; x += 2.6) {
    k++;
    const jx = x + 2.4 * (rnd(k * 1.37) - .5), jz = z + 2.4 * (rnd(k * 2.71) - .5), g = terrain.groundAt(jx, jz);
    if (g > .2 || g < -1.4 || keep.weight(jx, jz) < .9 || keep.roadDist(jx, jz) < 60) continue;
    const isle = ISLES.some(([ix, iz, r]) => Math.hypot(jx - ix, jz - iz) < r * 1.8);
    if (!isle && fbm(jx / 45 + 3.3, jz / 45 + 8.1, 3) < .5) continue;                                     // 成片地有、成片地没有
    if (lakeDepth(jx, jz) > .35) continue;
    beds[k % beds.length].push(item(jx, g, jz, k, .9 + .5 * rnd(k * 4.3)));
  }
  beds.forEach((items, i) => { if (items.length) group.add(instanced(geos.reed[i], mats.reeds, items)); });
  return { group, reeds: beds.reduce((s, b) => s + b.length, 0) };
}
