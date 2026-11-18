// 山脊上的灌木和秋树：造型和材质（松用 evergreens.js 的，材质用 foliage.js 的）。
//   灌木——贴着地分出七八根细枝，朝四周、更朝下风散开，成一个矮的圆丘；枝头一团团小叶。三个品种：
//         红的（秋天深红到朱红，春天开粉紫的山杜鹃），橙黄的（秋天橙到金黄，春天开白花），紫红的（秋天酒红到紫，春天开淡紫的花）。
//   红枫——山脊上的小树：干短而歪，几股枝都朝下风探（常年被风吹出来的旗形树冠），叶是掌状的，秋天红透，逆光里透亮。
//   黄栌——圆一些的冠，小圆叶，秋天黄里透红。
//   枯树——被雷劈过、风吹折的老树：一截歪干，几根光枝，梢头断着。冬天枝上压雪。
// 都用 plant.js 的工具拼（枝干是管子、叶是贴图谱的小卡片），一种品种一个 aKind（实例上的），材质按它取四季的叶色和花色。
// 风按 ridgeshade.js：整株顺着风一阵阵弯，每张叶片各自抖。
import * as THREE from 'three';
import { rnd } from '../anim.js';
import { CELLS, leafAtlas } from './leaves.js';
import { Plant, PART, DETAIL, V, ramify, kept, along, spine, resample } from './plant.js';
import { paint, shadowed, seasonal } from './paint.js';
import { SEASONS } from './seasons.js';
import { pal, num, RIDGE_WIND } from './ridgeshade.js';

export const FLORA = { red: 0, amber: 1, wine: 2, maple: 3, smoke: 4, snag: 5 };

// 灌木：levels 的写法见 plant.js 的 ramify
const BUSH = [
  { joints: 2, crook: 0, lift: 0, taper: 1, forks: 8, first: .2, thin: .8, lead: 1 },
  { joints: 3, crook: .28, lift: .1, taper: 1, forks: 3, first: .45, thin: .5, lead: .5, spread: 1.05, len: 4.4, thick: .34, pull: V(.55, .5, 0).normalize() },
  { joints: 2, crook: .32, lift: .08, taper: 1, tip: .01, spread: .6, len: .55, thick: .7 },
];
function bush(seed, kind, lite) {
  const R = k => rnd(seed * 9.7 + k * 3.1), t = new Plant(1.6), plan = { limbs: [], tips: [] }, d = { ...DETAIL.mid, depth: lite ? 1 : 2, cards: lite ? 4 : 6, keep: 1, grow: 1 };
  ramify(plan, V(0, -.25, 0), V(.15, 1, 0), .32 + .1 * R(0), .1, 0, seed, BUSH);
  t.skeleton(plan, d, 0, seed, 0).crownOver(plan.tips.map(tip => tip.p), .55);
  const leaves = kind === FLORA.red ? [CELLS.ovate, CELLS.round] : kind === FLORA.amber ? [CELLS.round, CELLS.sprig] : [CELLS.sprig, CELLS.ovate];
  plan.tips.forEach((tip, i) => {
    const r = .42 + .2 * rnd(seed + i * 3.3), c = V(tip.p.x, tip.p.y + .05, tip.p.z);
    t.cluster(c, V(r, r * .75, r), d.cards, leaves, seed + i * .37, { size: .85 });
    if (!lite && i % 3 === 0) t.cluster(V(c.x, c.y + r * .4, c.z), V(r * .6, r * .35, r * .6), 2, [CELLS.peach, CELLS.plum], seed + i * .43 + 2, { part: PART.bloom, size: .7 });
  });
  if (!lite) plan.limbs.filter(l => l.level === 1).forEach((l, i) => t.cluster(along(l.pts, .55), V(.45, .35, .45), 3, leaves, seed + i * .53 + 7, { size: .8 }));   // 枝中段也垫着叶，冠不空
  return t.twigs(plan, d, seed, .4);
}

// 旗形树冠的小树：干朝下风（+x）歪，大枝多朝 +x 长
const FLAG = [
  { joints: 5, crook: .12, lift: .02, taper: 1.2, forks: 5, first: .4, thin: .45, lead: .4, pull: V(.6, .8, 0).normalize() },
  { joints: 4, crook: .24, lift: .1, taper: 1, forks: 3, first: .4, thin: .45, lead: .5, spread: .95, len: .7, thick: .55, pull: V(1, .25, 0).normalize() },
  { joints: 3, crook: .3, lift: .07, taper: 1, forks: 3, first: .4, thin: .5, lead: .5, spread: .75, len: .55, thick: .7, pull: V(.8, .4, 0).normalize() },
  { joints: 2, crook: .3, lift: .05, taper: 1, tip: .018, spread: .6, len: .55, thick: .7 },
];
function flagTree(seed, kind, d) {
  const R = k => rnd(seed * 13.1 + k * 2.7), H = kind === FLORA.maple ? 6.5 + 2.5 * R(0) : 5.5 + 2 * R(0), t = new Plant(H), plan = { limbs: [], tips: [] };
  ramify(plan, V(0, -.8, 0), V(.35 + .2 * R(1), 1, (R(2) - .5) * .3), H * .45 + .8, .32 + .08 * R(3), 0, seed, FLAG);
  t.skeleton(plan, d, .8, seed, 3).crownOver(plan.tips.map(tip => tip.p), 1.1);
  const cells = kind === FLORA.maple ? [CELLS.maple, CELLS.mapleSprig, CELLS.maple] : [CELLS.round, CELLS.sprig, CELLS.round];
  plan.tips.forEach((tip, i) => {
    if (!kept(i, d.keep)) return;
    const r = (1 + .4 * rnd(seed + i * 3.3)) * d.grow;
    t.cluster(V(tip.p.x + .2, tip.p.y + .2, tip.p.z), V(r * 1.15, r * .7, r), d.cards, cells, seed + i * .37, { size: .8, tilt: d.tilt });
  });
  if (d.fill) plan.limbs.filter(l => l.level === 2).forEach((l, i) => t.cluster(along(l.pts, .5), V(1, .75, 1), 4, cells, seed + i * .53 + 7, { size: .78 }));
  return t.twigs(plan, d, seed, .8);
}

// 枯树：一截歪着的老干，梢头折断；几根光枝朝下风伸，枝上再分两三杈
function snag(seed, d) {
  const R = k => rnd(seed * 5.9 + k * 1.3), H = 5 + 2.5 * R(0), t = new Plant(H);
  const trunk = spine(V(0, -.6, 0), V(.3, 1, (R(1) - .5) * .3), H, 6, seed, { crook: .2, lift: .02 });
  t.limb(resample(trunk, 8), .34 + .08 * R(2), .14, { sides: d.sides, taper: .7, flare: .6, seed });
  if (d.roots) t.roots(3, .36, seed);
  for (let i = 0; i < 5; i++) {
    const k = .35 + .12 * i, a = (R(10 + i) - .5) * 2.6, from = along(trunk, k), len = (2.4 - .25 * i) * (.7 + .5 * R(20 + i));
    const pts = spine(from, V(Math.cos(a) + .5, .35 + .3 * R(30 + i), Math.sin(a)), len, 4, seed + i * 3.3, { crook: .35, lift: .05 });
    t.limb(resample(pts, 5), .12 - .015 * i, .015, { sides: 4, inner: .1 });
    for (let j = 0; j < 2; j++) { const b = a + (j ? .9 : -.9), twig = spine(along(pts, .5 + .3 * j), V(Math.cos(b), .5, Math.sin(b)), len * .4, 2, seed + i * 7 + j, { crook: .4 }); t.limb(twig, .04, .008, { sides: 3 }); }
  }
  return t;
}

// 每种几个样子。tier：'near' 近看的，'mid' 隔一段看的
const made = new Map();
export function floraShapes(kind, tier, copies) {
  const key = `${kind}|${tier}|${copies}`;
  if (!made.has(key)) made.set(key, Array.from({ length: copies }, (_, i) => {
    const seed = 2.3 + kind * 3.7 + i * 1.91, lite = tier !== 'near';
    const plant = kind <= FLORA.wine ? bush(seed, kind, lite) : kind === FLORA.snag ? snag(seed, DETAIL[tier]) : flagTree(seed, kind, DETAIL[tier]);
    return plant.geometry();
  }));
  return made.get(key);
}

// 叶色：每种两种（树冠里、背光的偏深 A；外缘、受光的偏浅 B），四季；ON 这一季还剩几成叶；BLOOM 花色和开几成
const LEAF_A = [pal('#4E8A40', '#2A6434', '#9C1C18', '#4A3A30'), pal('#5A9444', '#2E6A38', '#A8441A', '#4A3A30'), pal('#4C8442', '#2A6034', '#5A1E3A', '#4A3A30'), pal('#5C9A48', '#2C6A3A', '#A8201A', '#4A3A30'), pal('#6AA04A', '#357040', '#8E2A24', '#4A3A30')];
const LEAF_B = [pal('#B4DA78', '#62A452', '#F0582A', '#7A6450'), pal('#C2E080', '#6CAA54', '#EE9A38', '#7A6450'), pal('#AED276', '#5E9C50', '#B4506E', '#7A6450'), pal('#C0E284', '#6CAE58', '#FF7A3A', '#7A6450'), pal('#CCE48A', '#78B05C', '#F2A040', '#7A6450')];
const BLOOM_A = [pal('#C83A78', '#000000', '#000000', '#000000'), pal('#E8E2D6', '#000000', '#000000', '#000000'), pal('#9A6CC0', '#000000', '#000000', '#000000')];
const BLOOM_B = [pal('#FF9CC4', '#000000', '#000000', '#000000'), pal('#FFFFFF', '#000000', '#000000', '#000000'), pal('#E4C8F4', '#000000', '#000000', '#000000')];
const pick = (list, fallback) => list.map((c, i) => `k == ${i} ? ${c} : `).join('') + fallback;

let material = null;
export function floraMaterial() {
  if (material) return material;
  material = paint({
    side: THREE.DoubleSide, alphaToCoverage: true,
    uniforms: { uAtlas: { value: leafAtlas() }, ...seasonal(SEASONS.春.u, 'uMoss') },
    vertexPars: /* glsl */`
      attribute vec4 aTint; attribute vec3 aCenter; attribute float aSeed, aKind;
      varying vec4 vTint; varying vec2 vUv; varying float vSeed, vBake, vKind, vBack; ${RIDGE_WIND}`,
    vertex: /* glsl */`
      float part = aTint.x, each = fract(fract(aTint.w * 7.13 + aSeed * 3.71) + dot(aCenter, vec3(.731, .517, .293)));
      float leafOn = ${num(.96, 1, .92, .04)} * step(aKind, 4.5), bloomOn = ${num(.9, 0, 0, 0)} * step(aKind, 2.5);
      float keep = part > .5 && part < 1.5 ? step(each, leafOn - .001) : part > 2.5 && part < 3.5 ? step(each, bloomOn - .001) : 1.;
      p = mix(aCenter, p, keep);
      vTint = aTint; vSeed = aSeed; vUv = uv; vKind = aKind;`,
    world: /* glsl */`
      vec3 root = M[3].xyz; float tall = length(M[1].xyz); vBake = bakedSun(root.xz);
      vec3 cw = (M * vec4(aCenter, 1.)).xyz, off = wp - cw;
      float isCard = step(.5, aTint.x), ph = aTint.w * 31. + aSeed * 17. + cw.y * .4;
      float reach = max(wp.y - root.y, 0.);
      float tree = step(2.5, aKind);
      wp += ridgeBend(root, reach, mix(1.6, 7., tree) * tall, mix(.2, .06, tree), aSeed);
      float shake = uWind.z * (.5 + ridgeGust(cw.xz, uTime)) * (.6 * sin(uTime * 6.1 + ph) + .4 * sin(uTime * 9.3 + ph * 1.7));
      wp += isCard * (cross(normalize(vec3(uWind.y, .6, -uWind.x)), off) * shake * .3 + vec3(uWind.x, .25, uWind.y) * shake * .06);`,
    fragmentPars: /* glsl */`
      uniform sampler2D uAtlas; uniform vec3 uMoss;
      varying vec4 vTint; varying vec2 vUv; varying float vSeed, vBake, vKind, vBack;`,
    depthFragment: 'if (vTint.x > .5 && texture2D(uAtlas, vUv).a < .4) discard;',
    fragment: /* glsl */`
      N = normalize(vN);
      float part = vTint.x; int k = int(vKind + .5);
      vec3 snow = vec3(.9, .93, 1.), barkA = vec3(.12, .09, .08) * (1. + uSnow), barkB = (k == 5 ? vec3(.56, .52, .48) : vec3(.42, .33, .27)) * (1. + .4 * uSnow);   // 雪夜里枝条映着雪光，不是一团墨
      if (part < .5) {
        float ang = vUv.x * 6.2832, v = vUv.y; vec3 q = vec3(cos(ang), 0., sin(ang));
        float f1 = noise3(vec3(q.x * 4.2, v * .65, q.z * 4.2) + vSeed * 7.), f2 = noise3(vec3(q.x * 9., v * 2.1, q.z * 9.) + 3.);
        float bark = smoothstep(.2, .7, f1 * .6 + f2 * .4) * (k == 5 ? .6 + .4 * smoothstep(.3, .6, noise3(vec3(q.x * 2., v * 3., q.z * 2.))) : 1.);
        albedo = mix(barkA, barkB, bark) * (.7 + .3 * vTint.y);
        albedo = mix(albedo, uMoss * .5, .5 * smoothstep(.8, .3, vTint.y) * smoothstep(.4, .7, f2 + .25 * N.y) * (1. - uSnow));
        albedo = mix(albedo, snow, uSnow * smoothstep(.15, .55, N.y + (f2 - .5) * .5));
        ao = .55 + .45 * vTint.y;
      } else {
        vec4 tex = texture2D(uAtlas, vUv);
        float a = tex.a;
        if (part > 3.5) a *= mix(1., uSnow, smoothstep(.6, .85, tex.b));
        a *= smoothstep(.05, .3, abs(dot(normalize(cross(dFdx(vWp), dFdy(vWp))), normalize(vWp - cameraPosition))));
        alpha = clamp((a - .36) / max(fwidth(a), .03) + .5, 0., 1.);
        if (alpha < .05) discard;
        float stem = smoothstep(.25, .45, tex.b) * (1. - smoothstep(.6, .85, tex.b)), petal = smoothstep(.6, .85, tex.b);
        float depth = vTint.y, facing = smoothstep(-.35, .55, dot(N, uSunDir)), dab = fbm(vWp.xz * 1.3 + vWp.y * 1.1);
        vec3 la = ${pick(LEAF_A, 'vec3(0.)')}, lb = ${pick(LEAF_B, 'vec3(0.)')};
        vec3 leaf = mix(la, lb, clamp(tex.g * .45 + depth * .35 + facing * .4 + (fract(vSeed * 7.3) - .5) * .5 + (dab - .5) * .4 - .2, 0., 1.)) * (.6 + .55 * tex.r) * mix(.8, 1.12, facing);
        vec3 flower = mix(${pick(BLOOM_A, 'vec3(0.)')}, ${pick(BLOOM_B, 'vec3(0.)')}, clamp(tex.g * .6 + depth * .3 + facing * .3, 0., 1.)) * (.75 + .35 * tex.r);
        albedo = mix(leaf, mix(barkA, barkB, .5) * (.5 + .5 * tex.r), stem);
        albedo = mix(albedo, part > 3.5 ? snow : flower, petal);
        // 逆光：叶薄，外缘的透成一片亮的红、黄
        float back = pow(max(dot(normalize(vWp - cameraPosition), uSunDir), 0.), 2.) * (.35 + .65 * depth) * (1. - stem);
        albedo = mix(albedo, albedo * 1.4 + lb * .1, back);
        ao = mix(mix(.45, 1., depth), 1., .5 * petal); thin = .35 + .6 * back + .3 * petal;
      }
      sun *= vBake;`,
  });
  return material;
}

// 一批装成网格。items：[{ x, y, z, yaw, scale, seed }]，kind 是 FLORA 里的哪种
export function floraMesh(geo, kind, items, cast = true) {
  const g = new THREE.BufferGeometry(), m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  for (const [name, attribute] of Object.entries(geo.attributes)) g.setAttribute(name, attribute);
  g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(Float32Array.from(items, t => t.seed), 1));
  g.setAttribute('aKind', new THREE.InstancedBufferAttribute(new Float32Array(items.length).fill(kind), 1));
  const mesh = new THREE.InstancedMesh(g, floraMaterial(), items.length);
  items.forEach((t, i) => mesh.setMatrixAt(i, m.compose(p.set(t.x, t.y, t.z), q.setFromAxisAngle(up, t.yaw), s.set(t.scale, t.scale * (t.tall ?? 1), t.scale))));
  mesh.computeBoundingSphere();
  return shadowed(mesh, cast, true);
}
