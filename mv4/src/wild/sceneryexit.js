// 出山的路：湖的出水和下山的人都从南面的水口走。
//   溪——湖在南岸收成一条水道，出了水口成溪，顺着出谷的谷心弯弯曲曲往南流，沉进云里。水口以内那一段和湖面一样平（是湖的一汊），出了水口才跟着谷底一路往下。
//   古道——一条石板路，从湖南岸的渡口村出发，沿溪的东岸穿过水口，顺着谷往南，最后没进云里。路基在地面上压平一条；
//           中线每隔 EXIT.gap 一个点（带路面高度），给影片里往山外流的灯火用。
// 只算走向和高度、造路面的网格；路边的石灯、水口的牌坊由 scenerysites.js 摆。
import * as THREE from 'three';
import { smooth, lerp, clamp } from './noise.js';
import { valeAt } from './outland.js';
import { paint, seasonal, shadowed } from './paint.js';
import { SEASONS } from './seasons.js';

export const EXIT = { from: 1082, to: 1790, gap: 4, half: 2.3, side: 30, lift: .14 };   // 古道：从哪到哪（z）、中线取样的间距、路面半宽、在渡口村那一段走在谷心以东多远、路面比路基高多少
const OUTLET = { from: 1008, to: 1800, step: 2.5, wide: 1.25, level: -1 };   // 出水的溪：从哪到哪、每一步多长、比山上的溪宽几倍、水口以内的沟底多高
// 古道在 z 处走在谷心以东多远：渡口村里贴着溪，出了水口就靠到东岸的坡脚（谷底的边上，比溪高一截，涨水淹不着），一路轻轻地左右摆
const roadSide = (z, half) => lerp(EXIT.side, half + 5, smooth(1150, 1330, z)) + 9 * Math.sin(z / 75 + 2.1) * smooth(EXIT.from, EXIT.from + 60, z);

// 溪的走向：{ pts: [{ x, z, ground, y 沟底, steep }], wide }。heightAt：还没挖溪时的地面
export function traceOutlet(heightAt) {
  const pts = [];
  let low = OUTLET.level;
  for (let z = OUTLET.from; z <= OUTLET.to; z += OUTLET.step) {
    const x = valeAt(z).x + (-14 + 13 * Math.sin(z / 52 + .7)) * smooth(1050, 1150, z), ground = heightAt(x, z);
    low = Math.min(low, ground - 2.6);                                 // 顺流只降不升
    pts.push({ x, z, ground, y: low });
  }
  for (let i = 0; i < pts.length; i++) { const a = pts[Math.max(0, i - 2)], b = pts[Math.min(pts.length - 1, i + 2)]; pts[i].steep = (a.y - b.y) / Math.hypot(b.x - a.x, b.z - a.z); }
  return { pts, wide: OUTLET.wide };
}

// 古道的中线和路基。heightAt：挖好溪以后的地面。返回 { pts: [{ x, z, y 路面高 }], grade(x, z, h) 把路基压平 }
export function planExitRoad(heightAt) {
  // 先按 z 密密地走一遍，再按弧长等距取点
  const dense = [];
  for (let z = EXIT.from; z <= EXIT.to; z += 1) { const v = valeAt(z); dense.push([v.x + roadSide(z, v.half), z]); }
  const pts = [{ x: dense[0][0], z: dense[0][1] }];
  let carry = 0;
  for (let i = 1; i < dense.length; i++) {
    const [ax, az] = dense[i - 1], [bx, bz] = dense[i], len = Math.hypot(bx - ax, bz - az);
    for (let d = EXIT.gap - carry; d <= len; d += EXIT.gap) pts.push({ x: lerp(ax, bx, d / len), z: lerp(az, bz, d / len) });
    carry = (carry + len) % EXIT.gap;
  }
  // 路面：地面的高度沿路抹平（前后各五个点），小坑小包填平削平
  const raw = pts.map(p => heightAt(p.x, p.z));
  pts.forEach((p, i) => { let sum = 0, n = 0; for (let k = Math.max(0, i - 5); k <= Math.min(pts.length - 1, i + 5); k++) { sum += raw[k]; n++; } p.y = sum / n; });
  const hit = { d: 0, y: 0 };
  function near(x, z) {
    // 路大体朝南：按 z 估出最近的点在第几个，前后各看几个
    const guess = clamp(Math.round((z - EXIT.from) / (EXIT.to - EXIT.from) * (pts.length - 1)), 0, pts.length - 1);
    hit.d = Infinity;
    for (let i = Math.max(0, guess - 8); i < Math.min(pts.length - 1, guess + 8); i++) {
      const p = pts[i], q = pts[i + 1], ex = q.x - p.x, ez = q.z - p.z, k = clamp(((x - p.x) * ex + (z - p.z) * ez) / (ex * ex + ez * ez)), d = Math.hypot(x - p.x - ex * k, z - p.z - ez * k);
      if (d < hit.d) { hit.d = d; hit.y = lerp(p.y, q.y, k); }
    }
    return hit;
  }
  const grade = (x, z, h) => {
    if (z < EXIT.from - 12 || z > EXIT.to + 12) return h;
    const v = valeAt(z);
    if (Math.abs(x - v.x - roadSide(z, v.half)) > 16) return h;
    const { d, y } = near(x, z);
    return d > 9 ? h : lerp(h, y, smooth(9, EXIT.half + 1.2, d));
  };
  return { pts, grade };
}

// 路面：一条贴地的带子。石板错缝铺成，中间被踩得发亮，边上长草；雪天路心的雪被踩薄了，远远看是雪地里一道深色的线
export function exitRoadMesh(pts, groundAt) {
  const pos = [], uv = [], idx = [], n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz), rx = -dz / len, rz = dx / len;
    for (const side of [-1, 1]) {
      const x = pts[i].x + rx * EXIT.half * side, z = pts[i].z + rz * EXIT.half * side;
      pos.push(x, Math.max(pts[i].y, groundAt(x, z)) + EXIT.lift, z); uv.push(side, i * EXIT.gap);
    }
    if (i < n - 1) { const v = i * 2; idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2); }                 // 朝上的面是正面
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
  geo.computeVertexNormals(); geo.computeBoundingSphere();
  const mat = paint({
    uniforms: seasonal(SEASONS.春.u, 'uPave', 'uPaveDark', 'uMoss'),
    vertexPars: 'varying vec2 vUv;', vertex: 'vUv = uv;',
    fragmentPars: 'uniform vec3 uPave, uPaveDark, uMoss; varying vec2 vUv;',
    fragment: /* glsl */`
      float dist = distance(vWp, cameraPosition), close = smoothstep(260., 40., dist), across = abs(vUv.x);
      // 石板：每排两三块，排与排错缝
      float row = floor(vUv.y / 1.3), cut = fract((vUv.x * .5 + .5) * (2. + step(.5, fract(row * .37))) + fract(row * .618)), along = fract(vUv.y / 1.3);
      float joint = max(smoothstep(.06, .0, min(cut, 1. - cut)), smoothstep(.07, .0, min(along, 1. - along))) * close;
      float tone = noise1(vec2(row * 3.7, floor((vUv.x * .5 + .5) * 3.) * 7.1)), worn = smoothstep(.9, .2, across);
      albedo = mix(uPaveDark, uPave, .45 + .4 * tone + .15 * worn) * (1. - .45 * joint);
      albedo = mix(albedo, uMoss * .8, smoothstep(.62, 1., across + .3 * noise1(vWp.xz * .4)) * .7);      // 路边长草
      albedo = soak(albedo, uWet * .7);
      albedo = mix(albedo, vec3(.9, .93, 1.), uSnow * (.35 + .55 * smoothstep(.3, 1., across + .4 * noise1(vWp.xz * .23))));   // 路心的雪踩薄了
      sun = bakedSun(vWp.xz);
      alpha = smoothstep(1., .82, across + .12 * noise1(vWp.xz * .9));`,
    transparent: true, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
  });
  const mesh = shadowed(new THREE.Mesh(geo, mat), false, true);
  mesh.renderOrder = 3;
  return mesh;
}
