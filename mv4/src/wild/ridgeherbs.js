// 山脊坡上的草本：造型和材质。
//   芒草——山脊上最多的一种：二十来片又长又窄的叶从一个紧的根丛里拱出去、梢头垂下来；中间挺出三五根花莛，梢上一蓬丝一样的穗，
//         整丛顺着常年的风朝下风偏（种的时候把 +x 对着下风）。秋天叶金黄、穗银白带粉，逆光里透亮；夏天穗还是青紫的小穗；春天只有新叶；冬天枯成草黄色、穗残着。
//   矮草丛——贴地的一小丛短叶，填在芒草之间，远看连成片。
//   野菊和紫菀——秋天一簇簇黄的、紫的小花；春天换成山上的小白花、粉花；夏天零星几朵；冬天没有。
//   蕨——背阴的石缝和沟里，羽叶拱着垂下来，齿是按图案裁的；秋天转成锈红、冬天倒伏不见。
//   苔垫——石根、沟边鼓起来的一团团苔，绒绒的。
//   落叶堆——一堆堆被风刮到背风处的落叶（红、橙、黄、褐混着），春天是落花，夏天是零星的绿叶，冬天埋在雪里。
// 每个顶点带 aHerb：x 在这株上的高度（0 根 1 梢），y 哪一部分（0 叶，1 穗或花）；aUv 给蕨裁形状。风按 ridgeshade.js：一阵压弯、弹回。
import * as THREE from 'three';
import { rnd } from '../anim.js';
import { paint, shadowed } from './paint.js';
import { Sprig, V, HERBS } from './herbs.js';
import { pal, num, RIDGE_WIND } from './ridgeshade.js';

const TAU = Math.PI * 2, UP = new THREE.Vector3(0, 1, 0);
const R = (seed, k) => rnd(seed * 4.37 + k * 1.618 + .23);

// 芒草。lite：远一点用的简化版（叶少、穗少）
function plume(seed, lite) {
  const s = new Sprig(), blades = lite ? 6 : 14, stalks = lite ? 2 : 3 + Math.floor(R(seed, 1) * 2);
  for (let i = 0; i < blades; i++) {
    // 叶多偏向 +x（下风）：朝向在 ±100° 里，越靠 +x 越多；外圈的叶拱得低、垂得多
    const yaw = (R(seed, i + 10) - .5) * 3.4 * (.6 + .4 * R(seed, i + 30)), len = .9 + .8 * R(seed, i + 50), out = .3 + .7 * R(seed, i + 70);
    s.blade(V((R(seed, i + 90) - .5) * .28, 0, (R(seed, i + 110) - .5) * .28), yaw, len, .018 + .016 * R(seed, i + 130), .35 + .9 * out, { segs: lite ? 2 : 3, droop: .15 + .35 * out });
  }
  for (let k = 0; k < stalks; k++) {
    const yaw = (R(seed, k + 150) - .5) * 1.4, h = 1.55 + .7 * R(seed, k + 170), at = s.blade(V((R(seed, k + 190) - .5) * .2, 0, (R(seed, k + 210) - .5) * .2), yaw, h, .011, .25 + .3 * R(seed, k + 230), { segs: lite ? 2 : 3, h1: .85 });
    // 穗：顶上一蓬丝，七八根从一点散开、顺着 +x 垂下去，丝上带细的穗片（菱形的长瓣）
    const top = at(1), threads = lite ? 3 : 7;
    for (let j = 0; j < threads; j++) {
      const a = (j / threads - .5) * 1.9 + (R(seed, k * 20 + j + 300) - .5) * .4, len = .32 + .22 * R(seed, k * 20 + j + 400), from = at(.8 + .2 * j / threads);
      const tip = V(from.x + Math.cos(a) * len * .8 + .12, from.y + len * (.25 - .55 * R(seed, k * 20 + j + 500)), from.z + Math.sin(a) * len * .8);
      s.petal(from, tip, .013 + .008 * R(seed, k * 20 + j + 600), .005, .86, 1, 1);
    }
  }
  return s.geometry();
}
// 矮草丛：二十多片短叶，挤成一团朝四周散开
function tussock(seed) {
  const s = new Sprig();
  for (let i = 0; i < 18; i++) s.blade(V((R(seed, i) - .5) * .4, 0, (R(seed, i + 20) - .5) * .4), i / 18 * TAU + R(seed, i + 40), .32 + .38 * R(seed, i + 60), .02 + .018 * R(seed, i + 80), .15 + .4 * R(seed, i + 100), { segs: 2, droop: .2 });
  return s.geometry();
}
// 一簇小花：五六根细茎，各顶一朵（瓣多、小），脚下一圈小叶
function asters(seed) {
  const s = new Sprig();
  for (let k = 0; k < 6; k++) {
    const base = V((R(seed, k) - .5) * .5, 0, (R(seed, k + 10) - .5) * .5), h = .35 + .4 * R(seed, k + 20), yaw = k * 1.7 + R(seed, k + 30), top = s.blade(base, yaw, h, .012, .12, { h1: .8 })(1);
    s.blade(base, yaw + 2.2, h * .45, .04, .22);
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + k; s.petal(V(top.x, top.y, top.z), V(top.x + Math.cos(a) * .085, top.y + .02, top.z + Math.sin(a) * .085), .022, .012, 1, 1, 1); }
  }
  return s.geometry();
}
// 苔垫：压扁的半个球，面上起伏
function cushion(seed) {
  const g = new THREE.IcosahedronGeometry(1, 1), p = g.attributes.position, v = new THREE.Vector3(), s = new Sprig();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const bump = .8 + .35 * rnd(Math.floor(v.x * 3 + 7) * 7.1 + Math.floor(v.z * 3 + 7) * 3.3 + seed);
    p.setXYZ(i, v.x * bump, Math.max(v.y, -.1) * .42 * bump, v.z * bump);
  }
  const idx = g.index ? g.index.array : null, tri = j => V().fromBufferAttribute(p, idx ? idx[j] : j);
  for (let j = 0; j < (idx ? idx.length : p.count); j += 3) {
    const a = tri(j), b = tri(j + 1), c = tri(j + 2);
    if (a.y < -.03 && b.y < -.03 && c.y < -.03) continue;
    s.tri([a, Math.max(0, a.y * 2.4)], [b, Math.max(0, b.y * 2.4)], [c, Math.max(0, c.y * 2.4)]);
  }
  return s.geometry();
}

// 台阶墙角攒的一溜落叶：沿 x 长一个单位、往 +z（贴着立面的那一边）堆得厚，叶片是真的大小，两三层压着
function drift(seed) {
  const s = new Sprig();
  for (let i = 0; i < 46; i++) {
    const x = (R(seed, i) - .5) * (1 - .3 * R(seed, i + 300)), d = Math.sqrt(R(seed, i + 50)), z = .32 * d - .05, heap = .02 + .07 * d * (1 - 2 * Math.abs(x)) + .015 * (i % 3);
    const turn = R(seed, i + 100) * TAU, len = .11 + .08 * R(seed, i + 150), base = V(x, heap, z);
    s.petal(base, V(x + Math.cos(turn) * len, heap + .03 * (R(seed, i + 200) - .3), z + Math.sin(turn) * len * .7), len * .4, .02 * (R(seed, i + 250) - .2), R(seed, i + 350), R(seed, i + 400));
  }
  return s.geometry();
}

// 每种：用哪个造型（几个样子）
const SHAPES = {
  plume: n => Array.from({ length: n }, (_, i) => plume(2.1 + i * 3.3, false)),
  plumeLite: n => Array.from({ length: n }, (_, i) => plume(2.1 + i * 3.3, true)),
  tussock: n => Array.from({ length: n }, (_, i) => tussock(1.7 + i * 2.9)),
  asters: n => Array.from({ length: n }, (_, i) => asters(5.1 + i * 1.9)),
  fern: n => Array.from({ length: n }, (_, i) => HERBS.fern(8.3 + i * 2.3)),
  cushion: n => Array.from({ length: n }, (_, i) => cushion(3.9 + i * 4.1)),
  litter: n => Array.from({ length: n }, (_, i) => HERBS.litter(6.6 + i * 3.1)),
  drift: n => Array.from({ length: n }, (_, i) => drift(9.4 + i * 2.2)),
};

// 每种的颜色（四季）和风：low 根色、high 梢色、accent 穗或花；on 这一季有几成（0 没有）；accentOn 穗、花有几成；
// height 整株大约多高；give 一阵风压过来梢头最多偏出去几成高（0 是不动）；cut 按 vUv 裁形状
const LOOKS = {
  plume: {
    low: pal('#4E8040', '#2E6A36', '#8A6A34', '#7A6A52'), high: pal('#A8D47A', '#7CB860', '#E6C878', '#D2C4A2'),
    accent: pal('#C8D2A0', '#9A7E92', '#E2C8B4', '#CEC4AE'), on: num(.85, 1, 1, .8), accentOn: num(0, .45, 1, .6), height: 1.8, give: .42,
  },
  tussock: { low: pal('#4A7E3E', '#2C6634', '#86683A', '#7C705A'), high: pal('#9ACC6C', '#6AAA52', '#DABA6A', '#C8BC9E'), accent: pal('#9ACC6C', '#6AAA52', '#DABA6A', '#C8BC9E'), on: num(1, 1, 1, .7), accentOn: '0.', height: .6, give: .32 },
  asters: {
    low: pal('#4C8442', '#2E6A38', '#5E6A36', '#000000'), high: pal('#8EC266', '#5C9E50', '#8E9A52', '#000000'),
    accent: '(fract(vSeed * 7.3) < .5 ? ' + pal('#FFFFFF', '#F2F0FF', '#FFD040', '#FFFFFF') + ' : ' + pal('#F6A8C4', '#B8A0E8', '#B48CE0', '#FFFFFF') + ')', on: num(.9, .5, 1, 0), accentOn: num(1, .6, 1, 0), height: .7, give: .3,
  },
  fern: {
    low: pal('#3C7438', '#245C30', '#7A3E22', '#000000'), high: pal('#8CC460', '#5A9A4A', '#C8803A', '#000000'), accent: pal('#8CC460', '#5A9A4A', '#C8803A', '#000000'), on: num(1, 1, 1, 0), accentOn: '1.', height: 1.1, give: .18,
    cut: 'abs(vUv.x) < (1. - vUv.y * .85) * (.2 + 1.6 * abs(fract(vUv.y * 11.) - .5))',
  },
  cushion: { low: pal('#3E6A34', '#2E5E30', '#5A6A34', '#6A7068'), high: pal('#86B45A', '#5E9A48', '#A6A050', '#C8CED6'), accent: pal('#86B45A', '#5E9A48', '#A6A050', '#C8CED6'), on: '1.', accentOn: '0.', height: .4, give: 0, round: .8, flat: true },
  litter: {
    low: '(fract(vSeed * 5.1 + noise1(vWp.xz * 8.3) * 2.) < .5 ? ' + pal('#F2B4C6', '#4E8A3E', '#B8301C', '#5A4436') + ' : ' + pal('#FBE0E6', '#7AAA52', '#E88A28', '#7A6048') + ')',
    high: '(fract(vSeed * 3.7 + noise1(vWp.xz * 6.1 + 3.) * 2.) < .45 ? ' + pal('#FBDDE2', '#8CB45A', '#F2C040', '#8A6C50') + ' : ' + pal('#F6C4D0', '#5E9444', '#8A4A26', '#6E5444') + ')',
    accent: pal('#FBDDE2', '#8CB45A', '#D85A26', '#8A6C50'), on: num(.7, .25, 1, .6), accentOn: '1.', height: .3, give: 0, flat: true,
  },
};

const materials = new Map();
export function ridgeHerbMaterial(name) {
  if (materials.has(name)) return materials.get(name);
  const L = LOOKS[name], cut = L.cut ? `if (!(${L.cut})) discard;` : '', round = (L.round ?? .35).toFixed(2);
  const pars = 'varying vec2 vHerb, vUv; varying float vSeed, vBake, vGust;';
  const mat = paint({
    side: THREE.DoubleSide, alphaToCoverage: !!L.cut,
    vertexPars: `attribute vec2 aHerb, aUv; attribute float aSeed; ${pars} ${RIDGE_WIND}`,
    vertex: `p *= step(fract(aSeed * 13.7), ${L.on}); vHerb = aHerb; vSeed = aSeed; vUv = aUv;`,
    world: /* glsl */`
      vec3 root = M[3].xyz; float tall = length(M[1].xyz);
      vBake = bakedSun(root.xz); vGust = ridgeGust(root.xz, uTime);
      ${L.flat ? '' : `wp += ridgeBend(root, aHerb.x * tall * ${L.height.toFixed(2)}, tall * ${L.height.toFixed(2)}, ${L.give.toFixed(2)} * (.8 + .4 * aSeed), aSeed) * (1. - .6 * uSnow);`}`,
    fragmentPars: pars,
    depthFragment: cut,
    fragment: /* glsl */`
      ${cut}
      if (vHerb.y > .5 && fract(vSeed * 29.1) > ${L.accentOn}) discard;
      N = normalize(vec3(vN.x * ${round}, 1., vN.z * ${round}));
      float drift = fbm2(vWp.xz * .13), h = vHerb.x, own = fract(vSeed * 9.7);
      albedo = vHerb.y < .5 ? mix(${L.low}, ${L.high}, clamp(h * 1.1 + (drift - .5) * .6 + (own - .5) * .3, 0., 1.)) * (.82 + .36 * own) : ${L.accent} * (.9 + .2 * own);
      albedo = mix(albedo, vec3(.92, .94, 1.), uSnow * smoothstep(.3, 1., h + (drift - .5) * .4) * .85);
      // 逆着日月看：梢头、穗、花瓣透亮；正被一阵风压着的那一片草泛一层亮（叶背翻过来）
      float back = pow(max(dot(normalize(vWp - cameraPosition), uSunDir), 0.), 2.2) * (.3 + .7 * h);
      albedo *= 1. + (.6 + .2 * vHerb.y) * back + .14 * smoothstep(.5, 1.2, vGust) * h;
      thin = .45 + .45 * back + .25 * vHerb.y; ao = .34 + .66 * smoothstep(0., .55, h); sun *= vBake;`,
  });
  materials.set(name, mat);
  return mat;
}

const kits = new Map();
// 某种草本的几个样子
export function ridgeHerbShapes(name, copies) {
  if (!kits.has(name)) kits.set(name, SHAPES[name](copies));
  return kits.get(name);
}

// 一批实例装成网格。items：[{ x, y, z, yaw, scale, tall, up, seed }]
export function herbMesh(geo, mat, items, cast = false) {
  const g = new THREE.BufferGeometry(), m = new THREE.Matrix4(), q = new THREE.Quaternion(), turn = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
  for (const [name, attribute] of Object.entries(geo.attributes)) g.setAttribute(name, attribute);
  if (geo.index) g.setIndex(geo.index);
  g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(Float32Array.from(items, t => t.seed), 1));
  const mesh = new THREE.InstancedMesh(g, mat, items.length);
  items.forEach((t, i) => mesh.setMatrixAt(i, m.compose(p.set(t.x, t.y, t.z), q.setFromUnitVectors(UP, t.up ?? UP).multiply(turn.setFromAxisAngle(UP, t.yaw)), s.set(t.scale, t.scale * (t.tall ?? 1), t.scale))));
  mesh.computeBoundingSphere();
  return shadowed(mesh, cast, true);
}
