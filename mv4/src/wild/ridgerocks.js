// 山脊上的石头：成组的露头岩、孤石、石阶边散落的护坡石、碎石。造型和材质。
// 造型照国画里山石的结构：先是一个方中带圆的石块（超椭球），再按水平的层理切成一层层——每层各自往里收或往外探一点，
//   层与层之间是一道往里凹的缝，轮廓于是成了一级级的石檐；再用几刀平面削出大的块面（棱角），一两道竖的节理往里凹成裂缝；
//   面上再起一层细的起伏，不是光的。层理整组一起略倾斜（同一组石头倾向一致，像是同一块岩层露出来的）。
// 每个顶点带 aRock：x 在这一层里的高低（0 层底的缝，1 层顶的檐），y 有多「藏」（缝里、凹处，1 最深），z 在整块石头上的高低（0 底 1 顶），w 这一层的随机数。
// 上色：底色取季节表里的石色，一层一个深浅；斧劈皴——顺着石面往下的短促墨笔，背光的面上重；层缝是一道断续的墨线；
//   檐口朝上的那一溜受光亮、长苔；面上有地衣的斑点（灰绿、橙黄）、风化的浅斑、从檐下往下淌的水痕；冬天顶上积雪，雨天整块发深泛湿光。
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { rnd } from '../anim.js';
import { fbm, vnoise, smooth, clamp } from './noise.js';
import { paint, seasonal, shadowed } from './paint.js';
import { SEASONS } from './seasons.js';
import { pal } from './ridgeshade.js';

// 精细度：box 的每个方向分几段（hero 近处的大石；mid 一般；small 碎石）
export const ROCK_DETAIL = { hero: [12, 10, 12], mid: [6, 5, 6], small: [4, 2, 4] };

// 一块石头，大致在 x、z 各 ±1，y 从 0 到 1（底下多埋一截到 -0.35）
export function slabRock(seed, [nx, ny, nz]) {
  const R = k => rnd(seed * 7.13 + k * 3.71 + .9);
  const g = mergeVertices(new THREE.BoxGeometry(2, 2, 2, nx, ny, nz).deleteAttribute('uv').deleteAttribute('normal')), pos = g.attributes.position, v = new THREE.Vector3(), n = new THREE.Vector3();
  const layers = 3 + Math.floor(R(1) * 3), lean = (R(2) - .5) * .35, dipX = (R(3) - .5) * .5, dipZ = (R(4) - .5) * .3, sharp = 4.5 + 4 * R(5);
  const inset = Array.from({ length: layers + 2 }, (_, i) => .78 + .24 * R(10 + i) - .06 * Math.max(0, i - 1)), shove = Array.from({ length: layers + 2 }, (_, i) => [(R(30 + i) - .5) * .16, (R(40 + i) - .5) * .16]);
  const cuts = Array.from({ length: 7 }, (_, i) => ({ n: new THREE.Vector3(R(50 + i) - .5, (R(60 + i) - .2) * .7, R(70 + i) - .5).normalize(), d: .55 + .3 * R(80 + i) }));
  const joints = Array.from({ length: 2 }, (_, i) => { const a = R(90 + i) * Math.PI; return { n: new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), c: (R(95 + i) - .5) * .9, w: .06 + .05 * R(97 + i), deep: .1 + .1 * R(99 + i) }; });
  const tone = new Float32Array(pos.count * 4);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const u = v.clone().normalize(), y01 = (v.y + 1) / 2;
    // 超椭球：方中带圆
    let r = 1 / Math.pow(Math.abs(u.x) ** sharp + Math.abs(u.y) ** sharp + Math.abs(u.z) ** sharp, 1 / sharp);
    r *= .88 + .24 * fbm(u.x * 1.4 + seed, u.y * 1.4 + u.z * 1.2 + seed * 1.7, 3);
    v.copy(u).multiplyScalar(r);
    // 层理：按倾斜的层面分层；层内靠下的一截往里收成缝，靠上的檐略鼓
    const t = (v.y + 1) / 2 * layers + v.x * dipX + v.z * dipZ + .3 * (vnoise(v.x * 2 + seed, v.z * 2) - .5), L = clamp(Math.floor(t), 0, layers + 1), f = t - Math.floor(t);
    const groove = 1 - .13 * smooth(.16, 0, f) - .05 * smooth(.85, 1, f), sc = inset[L] * groove;
    const before = Math.hypot(v.x, v.z);
    v.x = v.x * sc + shove[L][0] + lean * (v.y + 1) * .5; v.z = v.z * sc + shove[L][1];
    // 削面：超出某一刀的部分削平
    for (const c of cuts) { const over = v.dot(c.n) - c.d; if (over > 0) v.addScaledVector(c.n, -over * .92); }
    // 竖的节理：贴着节理面的一窄条往里凹
    let crack = 0;
    for (const j of joints) { const d = Math.abs(v.x * j.n.x + v.z * j.n.z - j.c); if (d < j.w) { const k = 1 - d / j.w; crack = Math.max(crack, k); n.set(v.x, 0, v.z).normalize(); v.addScaledVector(n, -j.deep * k * k * smooth(-.6, .2, v.y)); } }
    // 面上细的起伏
    const fine = vnoise(v.x * 5.3 + seed * 3, v.y * 5.3 + v.z * 4.1) - .5;
    v.multiplyScalar(1 + .035 * fine);
    const hide = clamp(1 - Math.hypot(v.x, v.z) / Math.max(before, .01) * 1.05 + .5 * smooth(.2, 0, f) + .7 * crack);
    pos.setXYZ(i, v.x, (v.y + 1) * .675 - .35, v.z);
    tone.set([f, hide, y01, rnd(L * 3.7 + seed)], i * 4);
  }
  g.setAttribute('aRock', new THREE.BufferAttribute(tone, 4));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

let material = null;
export function ridgeRockMaterial() {
  if (material) return material;
  material = paint({
    uniforms: seasonal(SEASONS.春.u, 'uRockA', 'uRockB', 'uMoss'),
    vertexPars: 'attribute vec4 aRock; attribute float aSeed; varying vec4 vRock; varying float vSeed; varying vec3 vUp;',
    vertex: 'vRock = aRock; vSeed = aSeed;',
    world: 'vUp = normalize(mat3(M) * vec3(0., 1., 0.));',
    fragmentPars: 'uniform vec3 uRockA, uRockB, uMoss; varying vec4 vRock; varying float vSeed; varying vec3 vUp;',
    fragment: /* glsl */`
      float hide = vRock.y, lift = vRock.z;
      float dist = distance(vWp, cameraPosition), close = smoothstep(90., 6., dist), up = dot(N, vUp), px = fwidth(vWp.y) + 1e-3;
      vec3 side = normalize(cross(N, vUp) + 1e-4);
      float across = dot(vWp, side), downs = dot(vWp, vUp);
      // 层理（在着色器里按世界高度算，线是利落的）：层厚一块石头一个样，层面略倾斜、略起伏；每层一个深浅冷暖
      float thick = .32 + .3 * fract(vSeed * 3.7), t = (vWp.y + dot(vWp.xz, vec2(.09, -.06)) + .35 * (noise1(vec2(across * .35, vSeed * 9.)) - .5)) / thick;
      float band = floor(t), lay = fract(t);
      vec4 hb = texture2D(uNoise, (vec2(band, vSeed * 97.) + .5) / 256.);
      float g = fbm(vWp.xz * .9 + vWp.y * 1.3), grain = noise1(vWp.xz * 7.3 + vWp.y * 6.1);
      vec3 rock = mix(uRockB, uRockA, clamp(.62 + .38 * (hb.r - .5) + .25 * (g - .5) + .25 * up, 0., 1.));
      rock *= mix(vec3(.94, .97, 1.04), vec3(1.07, .99, .88), hb.g) * (.9 + .2 * grain * close);
      // 斧劈皴：斜着往下刷的一笔笔，笔头重、笔尾散（飞白）；背光的面上浓，受光的面上只留几笔
      float facing = smoothstep(-.3, .6, dot(N, uSunDir));
      vec2 sw = vec2(across * 1.4 + downs * .55, downs * .32);
      float stroke = noise1(sw + vSeed * 30.) * .6 + noise1(sw * vec2(3.1, 2.3) + 4.) * .25 + noise1(vec2(across * 9., downs * 2.) ) * .15;
      float cun = smoothstep(.55, .66, stroke) * (1. - smoothstep(.1, .85, up)) * mix(.9, .35, facing) * (.6 + .4 * smoothstep(.3, .7, noise1(vec2(across * 4.3, downs * 7.1))));
      rock *= 1. - cun * (.32 + .28 * close);
      // 层缝：每层底下一道墨线（断续，像笔断了又续上）；层里再有一两道淡的细层；每层顶上受光的一溜亮边
      float seam = smoothstep(px * 2.5 + .05, px * .5, lay) * smoothstep(.25, .5, noise1(vec2(across * .7, band * 13.)) + .15 * close);
      float fine = smoothstep(px * 2. + .02, 0., abs(fract(t * 3. + hb.b) - .5) - .45) * .35 * close;
      rock *= 1. - (.6 * seam + .25 * fine) * (1. - smoothstep(.55, .85, up)) - .25 * hide;
      rock = mix(rock, rock * 1.2 + uRockA * .05, smoothstep(.86, .98, lay) * (1. - smoothstep(.55, .85, up)));
      // 竖的节理：几道细裂缝，从层缝里往下裂
      float joint = smoothstep(.02 + px, 0., abs(noise1(vec2(across * .9 + band * 3.3, vSeed * 5.)) - .5) - .0) * step(.55, hb.a) * (1. - up);
      rock *= 1. - .55 * joint * close;
      // 风化的浅斑、檐下往下淌的水痕
      float weather = smoothstep(.62, .8, fbm(vWp.xz * .33 + vWp.y * .4 + vSeed * 7.));
      rock = mix(rock, mix(uRockA, vec3(.86, .84, .78), .4), .3 * weather * (1. - hide));
      float trickle = smoothstep(.6, .85, noise1(vec2(across * 3.7 + 11., downs * .16))) * (1. - smoothstep(.0, .6, up)) * smoothstep(.95, .4, lay);
      rock *= 1. - .28 * trickle * (.6 + .4 * uWet);
      // 地衣：一点点圆斑，灰绿的和橙黄的，长在敞着的面上
      float spot = noise1(vWp.xz * 3.1 + vWp.y * 2.7 + vSeed * 13.) * noise1(vWp.zx * 7.7 + vWp.y * 5.9);
      float lichen = smoothstep(.36, .46, spot) * (1. - hide) * (1. - uSnow) * close;
      rock = mix(rock, mix(vec3(.74, .76, .6), vec3(.88, .6, .26), step(.5, fract(spot * 37.))), .6 * lichen);
      // 苔：朝上的檐面、缝里，背阴潮湿处更厚
      float moss = smoothstep(.5, .8, up + .3 * hide + .3 * (fbm(vWp.xz * .7 + 9.) - .5) - .3 * facing) * smoothstep(.3, .6, dot(vUp, vec3(0., 1., 0.))) * (1. - uSnow);
      vec3 mossCol = uMoss * (.55 + .5 * grain) * ${pal('#E0F0C0', '#B8D8A0', '#E8D29A', '#C0C8C8')};
      rock = mix(rock, mossCol, .6 * moss * (.7 + .3 * smoothstep(.4, .6, grain)));
      albedo = rock;
      N = normalize(N + (noise4(vWp.xz * 4.1 + vWp.y * 3.3).rgb - .5) * .18 * close);
      // 雨后发深、泛湿光
      vec3 rd = normalize(vWp - cameraPosition);
      albedo *= mix(1., .62, uWet);
      glow = skyGradient(reflect(rd, N)) * uWet * .12 * pow(1. - max(dot(-rd, N), 0.), 2.) * (1. - uSnow);
      // 雪：朝上的面、檐口上积着，陡面上露石头
      albedo = mix(albedo, vec3(.9, .93, 1.), uSnow * smoothstep(.35, .7, up + (g - .5) * .5 + .25 * smoothstep(.85, 1., lay)));
      ao = (1. - .4 * hide) * mix(.7, 1., smoothstep(0., .25, lift)); sun *= bakedSun(vWp.xz);`,
  });
  return material;
}

const shapes = new Map();
// 某一档的几个样子
export function rockShapes(tier, copies) {
  const key = `${tier}|${copies}`;
  if (!shapes.has(key)) shapes.set(key, Array.from({ length: copies }, (_, i) => slabRock(1.3 + i * 4.7 + tier.length * 11.1, ROCK_DETAIL[tier])));
  return shapes.get(key);
}

// 一批石头装成一个网格。items：[{ x, y, z, up 石头的「上」朝哪（坡上的石头顺着坡躺）, yaw, tilt: [绕 x, 绕 z], size: [宽, 高, 深], seed }]
export function rockMesh(geo, items, cast = true) {
  const g = new THREE.BufferGeometry(), m = new THREE.Matrix4(), q = new THREE.Quaternion(), lay = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  for (const [name, attribute] of Object.entries(geo.attributes)) g.setAttribute(name, attribute);
  g.setIndex(geo.index);
  g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(Float32Array.from(items, t => t.seed), 1));
  const mesh = new THREE.InstancedMesh(g, ridgeRockMaterial(), items.length);
  items.forEach((t, i) => mesh.setMatrixAt(i, m.compose(p.set(t.x, t.y, t.z), lay.setFromUnitVectors(UP, t.up).multiply(q.setFromEuler(e.set(t.tilt[0], t.yaw, t.tilt[1], 'YXZ'))), s.set(...t.size))));
  mesh.computeBoundingSphere();
  return shadowed(mesh, cast, true);
}
