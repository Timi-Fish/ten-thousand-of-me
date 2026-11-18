// 山脊坡面贴着地的一层：把地形底色那一片平涂盖住，让坡面近看有一丛丛、一块块的结构，远看是有深浅的一片。
// 一张贴着地形网格那张面（ridgeplace.js 的 surfaceAt）铺的薄网，略抬起一点、往镜头那边挪一点画（不和地形抢），画的是：
//   草茬——顺着常年的风梳过去的一道道细笔（秋天金黄、赭、褐，春天嫩绿，夏天浓绿，冬天草黄压雪），一片一片地浓淡不一；
//   裸土和碎石——草稀的地方露出土，土上一粒粒深浅不一的碎石；陡处多露；
//   苔——凹处、背阴处一块块的青苔；
//   地被——秋天一片片匍匐的红叶小草（地锦、虎耳草那一类）、零散的落叶；春天星星点点的小花；
//   风——一阵风贴着坡面压过去时，草茬翻过来的那一片泛一层亮，一道道顺风推过去（草浪）。
// 坡太陡（崖面）的地方渐渐淡掉，露出地形自己画的石头；离路远、离机位远的地方也淡掉，和原来的坡面接得上。
import * as THREE from 'three';
import { paint } from './paint.js';
import { smooth } from './noise.js';
import { pal, num, RIDGE_WIND } from './ridgeshade.js';
import { WALL } from './ridgeplace.js';

// 网格的格距（和地形近处细分的格子一样大、对齐，所以每个小三角形都正好贴在地形的某一个三角形上）；沿路每多长一块；离中线多远为止；抬起多少
const CELL = .75, CHUNK = 45, OUTER = 26, LIFT = .03;

let material = null;
function groundMaterial() {
  if (material) return material;
  material = paint({
    transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
    vertexPars: `attribute float aFade; varying float vFade; ${RIDGE_WIND}`,
    vertex: 'vFade = aFade;',
    fragmentPars: `varying float vFade; ${RIDGE_WIND}`,
    fragment: /* glsl */`
      float dist = distance(vWp, cameraPosition), close = smoothstep(80., 10., dist), slope = 1. - N.y;
      vec2 w = ridgeWindDir(), xz = vWp.xz, along = vec2(dot(xz, w), dot(xz, vec2(-w.y, w.x)));
      float big = fbm(xz * .09 + 3.), mid = fbm(xz * .31 + 11.), fine = noise1(xz * 2.3);
      // 草茬：顺风梳的细笔。两层：长的一道道、短的一簇簇
      float comb = noise1(vec2(along.x * 1.1, along.y * 9.)) * .6 + noise1(vec2(along.x * 2.7 + 5., along.y * 21.)) * .4;
      float tuft = smoothstep(.35, .75, noise1(xz * 1.4 + 7.) * .6 + mid * .4);
      float grass = smoothstep(.3, .62, big * .55 + mid * .45 - .25 * smoothstep(.45, .8, slope)) ;
      vec3 straw = mix(${pal('#4E7E3C', '#2C6234', '#8A6634', '#8C826C')}, ${pal('#B4D884', '#76B25A', '#E6C474', '#D6CCB2')}, clamp(comb * .9 + tuft * .3 - .1 + (fine - .5) * .3, 0., 1.));
      straw *= .78 + .3 * mid;
      // 土和碎石
      float pebble = smoothstep(.62, .78, noise1(xz * 5.1) * .6 + noise1(xz * 11.3) * .4);
      vec3 soil = ${pal('#8E7656', '#6A5A44', '#8A6A4A', '#6E6660')} * (.75 + .35 * fine);
      soil = mix(soil, ${pal('#B8B0A0', '#9A9A90', '#BEB09A', '#A8ACB4')} * (.8 + .3 * fine), pebble * close);
      soil = mix(soil, soil * .55, smoothstep(.55, .75, noise1(xz * 3.3 + 2.)) * close * .6);
      albedo = mix(soil, straw, grass);
      // 苔：凹处、背阴
      float damp = smoothstep(.55, .75, fbm(xz * .2 + 21.) + .25 * smoothstep(.1, -.4, dot(normalize(N.xz + 1e-4), normalize(uSunDir.xz))));
      albedo = mix(albedo, ${pal('#5E9446', '#3A7A3C', '#6E7A3A', '#7E8478')} * (.7 + .4 * fine), damp * .55 * (1. - uSnow));
      // 地被：秋天匍匐的红叶小草一片片，春天小花点点
      float creep = smoothstep(.6, .72, fbm(xz * .7 + 31.)) * smoothstep(.45, .75, noise1(xz * 4.7 + 1.) * .6 + noise1(xz * 9.1) * .4);
      albedo = mix(albedo, ${pal('#E8E4F0', '#5A8A3E', '#A8402A', '#000000')} * (.7 + .45 * fine), creep * ${num(.3, .2, .5, 0)});
      float dots = smoothstep(.8, .9, noise1(xz * 6.1 + 4.) * noise1(xz * 2.3 + 9.) * 2.2) * grass;
      albedo = mix(albedo, ${pal('#F8C8DA', '#FFFFFF', '#E86A2A', '#FFFFFF')}, dots * close * ${num(.8, .3, .7, 0)});
      // 草浪：一阵风压过去，那一片草茬翻过来泛亮；草稀的地方没有
      float gust = ridgeGust(xz, uTime);
      albedo *= 1. + .22 * smoothstep(.5, 1.2, gust) * grass * (.6 + .4 * comb);
      // 雪：朝上的面积着，草茬尖从雪里露出来
      float snow = uSnow * smoothstep(.2, .55, N.y - .35 + (big - .5) * .4) * (1. - .5 * smoothstep(.55, .8, comb) * grass);
      albedo = mix(albedo, vec3(.9, .93, 1.), snow);
      albedo *= mix(1., .72, uWet);
      alpha = vFade * smoothstep(.92, .7, slope) * (.55 + .45 * smoothstep(.15, .45, grass + pebble * .3 + snow));
      ao = .85 + .15 * mid; sun *= bakedSun(vWp.xz);`,
  });
  return material;
}

export function buildRidgeGround(P) {
  const { road, surfaceAt, weight, locate, spans } = P, group = new THREE.Group(), culled = [], chunks = new Map(), p = new THREE.Vector3();
  // 先在世界坐标的方格里挑出要铺的格子：离中线 WALL 到 OUTER 之间、那一段有布景
  const box = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity };
  for (const [a, b] of spans) for (let s = Math.max(0, a); s < Math.min(road.length, b); s += 2) {
    road.at0(s, p);
    box.x0 = Math.min(box.x0, p.x - OUTER); box.x1 = Math.max(box.x1, p.x + OUTER); box.z0 = Math.min(box.z0, p.z - OUTER); box.z1 = Math.max(box.z1, p.z + OUTER);
  }
  const fadeAt = (x, z) => {
    const on = locate(x, z);
    if (!on) return 0;
    return weight(on.s) * smooth(WALL - 1.2, WALL + .6, on.d) * smooth(OUTER, OUTER - 9, on.d);
  };
  const x0 = Math.floor(box.x0 / CELL) * CELL, z0 = Math.floor(box.z0 / CELL) * CELL, nx = Math.ceil((box.x1 - x0) / CELL), nz = Math.ceil((box.z1 - z0) / CELL);
  const H = new Float32Array((nx + 1) * (nz + 1)), F = new Float32Array((nx + 1) * (nz + 1)).fill(-1), idx = (i, j) => j * (nx + 1) + i;
  const corner = (i, j) => { const k = idx(i, j); if (F[k] < 0) { const x = x0 + i * CELL, z = z0 + j * CELL; F[k] = fadeAt(x, z); H[k] = F[k] > 0 ? surfaceAt(x, z) + LIFT : 0; } return k; };
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const cx = x0 + (i + .5) * CELL, cz = z0 + (j + .5) * CELL, on = locate(cx, cz);
    if (!on || on.d > OUTER || on.d < WALL - 1.2 || weight(on.s) <= 0) continue;
    const ks = [corner(i, j), corner(i + 1, j), corner(i, j + 1), corner(i + 1, j + 1)];
    if (ks.every(k => F[k] <= 0)) continue;
    const key = Math.floor(on.s / CHUNK);
    if (!chunks.has(key)) chunks.set(key, { s: (key + .5) * CHUNK, pos: [], fade: [] });
    const c = chunks.get(key), pts = [[i, j], [i + 1, j], [i, j + 1], [i + 1, j + 1]].map(([a, b], q) => [x0 + a * CELL, H[ks[q]], z0 + b * CELL, F[ks[q]]]);
    // 和地形网格同一条对角线切开
    for (const t of [0, 2, 1, 1, 2, 3]) { c.pos.push(pts[t][0], pts[t][1], pts[t][2]); c.fade.push(pts[t][3]); }
  }
  for (const c of chunks.values()) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(c.pos, 3)); g.setAttribute('aFade', new THREE.Float32BufferAttribute(c.fade, 1));
    g.computeVertexNormals(); g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, groundMaterial());
    mesh.receiveShadow = true; mesh.renderOrder = 2; mesh.name = '山脊 坡面';
    group.add(mesh);
    culled.push({ mesh, at: road.at0(Math.min(c.s, road.length), new THREE.Vector3()), reach: 520 });
  }
  return { group, culled };
}
