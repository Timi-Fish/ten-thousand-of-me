// 草本：草丛、长草、野花、蕨、大叶草、落叶堆、芦苇、荷叶、荷花的造型，和它们共用的材质。全是小三角形拼的，成批实例化。
// 每个顶点带 aHerb：x 是在这株上的高度（0 根，1 梢），y 是哪一部分（0 茎叶，1 花或穗）；aUv 给需要按图案裁形状、描叶脉的用（蕨的羽片、荷叶的脉）。
// 上色：根深梢浅，根部压暗（和地面接得上），一丛一个深浅，一片地里还有成片的偏色；逆着日月看，叶梢是透亮的；冬天梢上顶着雪。
import * as THREE from 'three';
import { rnd } from '../anim.js';
import { paint, seasonal, shadowed, WIND } from './paint.js';
import { SEASONS } from './seasons.js';

const TAU = Math.PI * 2, T = SEASONS.春.u, UP = new THREE.Vector3(0, 1, 0);
export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const declare = names => names.map(n => `uniform ${typeof T[n] === 'number' ? 'float' : 'vec3'} ${n};`).join(' ');   // 季节表里的量：数字是 float，颜色和三元组是 vec3

// 草本的材质。names：用到季节表里的哪些量；low、high、accent：根色、梢色、花色（着色器表达式）；scale：整株的大小（表达式，0 就是没有）；
// bend：随风摆多少；shape：在物体坐标里再改 p 的一段；cut：按 vUv 裁形状的表达式（真的地方留下）；tone：定完颜色之后再改 albedo 的一段；round：受光时多少按叶面自己的朝向（0 全按朝上）
export function herbMaterial({ names, low, high, accent, scale, bend, shape = '', cut = '', tone = '', round = .35 }) {
  const pars = `${declare(names)} varying vec2 vHerb, vUv; varying float vSeed, vBake;`;
  return paint({
    side: THREE.DoubleSide, uniforms: seasonal(T, ...names), alphaToCoverage: cut !== '',
    vertexPars: `attribute vec2 aHerb, aUv; attribute float aSeed; ${pars} ${WIND}`,
    vertex: `p *= ${scale}; ${shape} vHerb = aHerb; vSeed = aSeed; vUv = aUv;`,
    world: `vec3 root = M[3].xyz; vBake = bakedSun(root.xz); wp += windSway(root, aHerb.x * aHerb.x * ${bend}, aSeed);`,
    fragmentPars: pars,
    depthFragment: cut ? `if (!(${cut})) discard;` : '',
    fragment: /* glsl */`
      ${cut ? `if (!(${cut})) discard;` : ''}
      N = normalize(vec3(vN.x * ${round.toFixed(2)}, 1., vN.z * ${round.toFixed(2)}));
      float drift = fbm2(vWp.xz * .11), h = vHerb.x;
      albedo = vHerb.y < .5 ? mix(${low}, ${high}, clamp(h + (drift - .5) * .5, 0., 1.)) * (.8 + .4 * vSeed) : ${accent};
      ${tone}
      albedo = mix(albedo, vec3(.9, .93, 1.), uSnow * .8 * smoothstep(.35, 1., h));
      float back = pow(max(dot(normalize(vWp - cameraPosition), uSunDir), 0.), 2.5) * h;
      albedo *= 1. + .5 * back;
      thin = .5 + .4 * back; ao = .32 + .68 * smoothstep(0., .6, h); sun *= vBake;`,
  });
}

// 拼草本用的工具：一个个三角形，带高度、部位和图案坐标
export class Sprig {
  constructor() { this.pos = []; this.nor = []; this.herb = []; this.uv = []; }
  // 三个顶点各是 [点, 高度, u, v]（u、v 可以不给）
  tri(a, b, c, part = 0) {
    const n = V().subVectors(b[0], a[0]).cross(V().subVectors(c[0], a[0])).normalize();
    for (const [p, h, u = 0, v = 0] of [a, b, c]) { this.pos.push(p.x, p.y, p.z); this.nor.push(n.x, Math.abs(n.y), n.z); this.herb.push(h, part); this.uv.push(u, v); }
  }
  quad(a, b, c, d, part = 0) { this.tri(a, b, c, part); this.tri(a, c, d, part); }
  // 一片条形的叶：从 base 朝 yaw 弯出去、长 len、往外倒 lean，分 segs 节，越往上越窄，尖收成一点。h0、h1：根和梢记成多高
  blade(base, yaw, len, width, lean, { part = 0, h0 = 0, h1 = 1, segs = 2, droop = 0 } = {}) {
    const side = V(Math.cos(yaw + TAU / 4) * width, 0, Math.sin(yaw + TAU / 4) * width);
    const at = k => V(base.x + Math.cos(yaw) * lean * k * k, base.y + len * (k - droop * k * k * k), base.z + Math.sin(yaw) * lean * k * k);
    for (let i = 0; i < segs; i++) {
      const k0 = i / segs, k1 = (i + 1) / segs, w0 = 1 - .6 * k0 * k0, w1 = i === segs - 1 ? 0 : 1 - .6 * k1 * k1, a = at(k0), b = at(k1), ha = h0 + (h1 - h0) * k0, hb = h0 + (h1 - h0) * k1;
      const a0 = [a.clone().addScaledVector(side, -w0), ha], a1 = [a.clone().addScaledVector(side, w0), ha], b0 = [b.clone().addScaledVector(side, -w1), hb], b1 = [b.clone().addScaledVector(side, w1), hb];
      this.tri(a0, a1, b1, part);
      if (w1 > 0) this.tri(a0, b1, b0, part);
    }
    return at;
  }
  // 一片有宽度的带子（蕨的一根羽叶）：沿 at(k) 走，半宽 width，带图案坐标（u 横着 -1 到 1，v 沿着 0 到 1）
  ribbon(at, side, segs, h0, h1, part = 0) {
    for (let i = 0; i < segs; i++) {
      const k0 = i / segs, k1 = (i + 1) / segs, a = at(k0), b = at(k1), ha = h0 + (h1 - h0) * k0, hb = h0 + (h1 - h0) * k1;
      this.quad([a.clone().addScaledVector(side, -1), ha, -1, k0], [a.clone().addScaledVector(side, 1), ha, 1, k0], [b.clone().addScaledVector(side, 1), hb, 1, k1], [b.clone().addScaledVector(side, -1), hb, -1, k1], part);
    }
  }
  // 一片菱形的小瓣（花瓣、落叶）：从 base 到 tip，中间最宽处半宽 w，两边微微翘起 lift
  petal(base, tip, w, lift, h0, h1, part = 0) {
    const mid = base.clone().lerp(tip, .45), dir = V().subVectors(tip, base), side = V(-dir.z, 0, dir.x).normalize().multiplyScalar(w), hm = (h0 + h1) / 2;
    const l = [mid.clone().sub(side).setY(mid.y + lift), hm], r = [mid.clone().add(side).setY(mid.y + lift), hm];
    this.tri([base, h0], l, [tip, h1], part); this.tri([base, h0], [tip, h1], r, part);
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('aHerb', new THREE.Float32BufferAttribute(this.herb, 2)); g.setAttribute('aUv', new THREE.Float32BufferAttribute(this.uv, 2));
    return g;
  }
}

const R = (seed, k) => rnd(seed * 3.7 + k * 1.93 + .31);
// 各种草本的造型。seed：同一种做几个不同的样子
export const HERBS = {
  // 矮草丛：一把短叶朝四周散开
  tuft(seed) {
    const s = new Sprig();
    for (let i = 0; i < 10; i++) s.blade(V((R(seed, i) - .5) * .55, 0, (R(seed, i + 20) - .5) * .55), i / 10 * TAU + R(seed, i + 40), .45 + .65 * R(seed, i + 60), .032 + .026 * R(seed, i + 80), .2 + .5 * R(seed, i + 100));
    return s.geometry();
  },
  // 长草：高而拱着的叶，中间挺出两三根带穗的茎（秋冬是枯黄的一丛）
  sedge(seed) {
    const s = new Sprig();
    for (let i = 0; i < 6; i++) s.blade(V((R(seed, i) - .5) * .4, 0, (R(seed, i + 20) - .5) * .4), i / 6 * TAU + R(seed, i + 40), 1.3 + .9 * R(seed, i + 60), .034 + .02 * R(seed, i + 80), .5 + .8 * R(seed, i + 100), { segs: 3, droop: .25 });
    for (let i = 0; i < 2; i++) {
      const yaw = i * 2.9 + R(seed, i + 120), len = 1.9 + .6 * R(seed, i + 130), at = s.blade(V(0, 0, 0), yaw, len, .022, .35, { h1: .8 });
      s.blade(at(.86), yaw, len * .3, .042, .22, { part: 1, h0: .8, h1: 1 });
    }
    return s.geometry();
  },
  // 野花（雏菊那样的）：三四根细茎，各顶一朵平展的花，脚下几片小叶
  daisy(seed) {
    const s = new Sprig();
    for (let k = 0; k < 3; k++) {
      const base = V((R(seed, k) - .5) * .8, 0, (R(seed, k + 10) - .5) * .8), h = .5 + .45 * R(seed, k + 20), yaw = k * 2.1 + R(seed, k + 30), top = s.blade(base, yaw, h, .022, .15, { h1: .8 })(1);
      s.blade(base, yaw + 2, h * .5, .065, .3);
      for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + k; s.petal(V(top.x, top.y, top.z), V(top.x + Math.cos(a) * .2, top.y + .06, top.z + Math.sin(a) * .2), .07, .03, 1, 1, 1); }
    }
    return s.geometry();
  },
  // 野花（一串串的）：茎的上半截缀着一串小花
  bells(seed) {
    const s = new Sprig();
    for (let k = 0; k < 3; k++) {
      const base = V((R(seed, k) - .5) * .7, 0, (R(seed, k + 10) - .5) * .7), h = .8 + .6 * R(seed, k + 20), yaw = k * 1.9 + R(seed, k + 30), at = s.blade(base, yaw, h, .025, .22, { h1: .7 });
      s.blade(base, yaw + 1.7, h * .45, .07, .35);
      for (let i = 0; i < 5; i++) { const p = at(.5 + .5 * i / 5), a = i * 2.4 + k, size = .12 * (1 - .08 * i); s.petal(p, V(p.x + Math.cos(a) * size, p.y - .02, p.z + Math.sin(a) * size), size * .5, .04, 1, 1, 1); }
    }
    return s.geometry();
  },
  // 蕨：几根羽叶从中心拱出去，梢头垂下来（羽片的齿是着色器按图案裁出来的）
  fern(seed) {
    const s = new Sprig();
    for (let i = 0; i < 6; i++) {
      const yaw = i / 6 * TAU + R(seed, i), len = 1 + .7 * R(seed, i + 10), rise = .5 + .5 * R(seed, i + 20), c = Math.cos(yaw), d = Math.sin(yaw);
      s.ribbon(k => V(c * len * k, len * rise * (k - .75 * k * k) * 1.6, d * len * k), V(-d * .22, 0, c * .22), 3, .15, 1);
    }
    return s.geometry();
  },
  // 大叶草：几片贴着地的圆叶，各有一根短柄
  docks(seed) {
    const s = new Sprig();
    for (let k = 0; k < 4; k++) {
      const yaw = k / 4 * TAU + R(seed, k), reach = .3 + .35 * R(seed, k + 10), size = .26 + .16 * R(seed, k + 20), h = .22 + .2 * R(seed, k + 30), c = V(Math.cos(yaw) * reach, h, Math.sin(yaw) * reach);
      s.blade(V(0, 0, 0), yaw, h, .02, reach, { h1: .4 });
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * TAU, b = (i + 1) / 6 * TAU, rim = t => V(c.x + Math.cos(t) * size, h + .07 * Math.sin(t * 2 + k) + .1 * Math.cos(t - yaw), c.z + Math.sin(t) * size);
        s.tri([c, .45], [rim(b), 1], [rim(a), 1]);
      }
    }
    return s.geometry();
  },
  // 一小堆落叶（或落花）：十来片贴着地，有平有翘
  litter(seed) {
    const s = new Sprig();
    for (let i = 0; i < 14; i++) {
      const a = R(seed, i) * TAU, rr = .95 * Math.sqrt(R(seed, i + 20)), turn = R(seed, i + 40) * TAU, len = .12 + .09 * R(seed, i + 60), y = .03 + .05 * R(seed, i + 80), base = V(Math.cos(a) * rr, y, Math.sin(a) * rr);
      s.petal(base, V(base.x + Math.cos(turn) * len, y + .1 * (R(seed, i + 100) - .3), base.z + Math.sin(turn) * len), len * .36, .04 * (R(seed, i + 120) - .3), R(seed, i + 140), R(seed, i + 160));
    }
    return s.geometry();
  },
  // 芦苇：几根高挑的秆，秆上两三片长叶，梢上一蓬顺风垂着的芦花
  reed(seed) {
    const s = new Sprig();
    for (let k = 0; k < 4; k++) {
      const base = V((R(seed, k) - .5) * 1.1, 0, (R(seed, k + 10) - .5) * 1.1), yaw = k * 1.7 + R(seed, k + 20) * 2, h = 3.2 + 1.9 * R(seed, k + 30), lean = .4 + .6 * R(seed, k + 40), at = s.blade(base, yaw, h, .045, lean, { h1: .85, segs: 3 });
      s.blade(at(.3), yaw + 2.3, h * .5, .09, 1, { h0: .25, h1: .7, droop: .3 }); s.blade(at(.5), yaw - 1.9, h * .45, .08, 1.1, { h0: .4, h1: .8, droop: .3 });
      const top = at(.96);
      for (let i = 0; i < 2; i++) {                                                                      // 芦花：两枚中间宽、两头尖的穗，顺着秆弯的方向垂出去
        const a = yaw + (i - .5) * .8, len = .8 + .5 * R(seed, k * 3 + i + 50);
        s.petal(top, V(top.x + Math.cos(a) * len * .8, top.y + len * (.25 - .3 * i), top.z + Math.sin(a) * len * .8), .085, .03, .85, 1, 1);
      }
    }
    return s.geometry();
  },
  // 荷叶：一张边缘起伏的圆叶，中心凹下去接着叶柄，叶脉从中心射向边缘（着色器描）；豁口朝一边
  lotusLeaf(seed) {
    const s = new Sprig(), N = 14, at = (i, r) => { const a = i / N * TAU, wave = .09 * Math.sin(a * 4 + seed) + .06 * Math.sin(a * 7 + seed * 2); return V(Math.cos(a) * r * (1 + .06 * Math.sin(a * 5 + seed)), .05 + r * r * (.18 + wave), Math.sin(a) * r * (1 + .06 * Math.sin(a * 5 + seed))); };
    for (let i = 0; i < N; i++) {
      if (i === 3) continue;
      s.tri([V(0, 0, 0), .2, i / N, 0], [at(i + 1, .55), .6, (i + 1) / N, .55], [at(i, .55), .6, i / N, .55]);
      s.quad([at(i, .55), .6, i / N, .55], [at(i + 1, .55), .6, (i + 1) / N, .55], [at(i + 1, 1), 1, (i + 1) / N, 1], [at(i, 1), 1, i / N, 1]);
    }
    s.blade(V(0, -1.8, 0), 0, 1.8, .045, 0, { h1: .2 });
    return s.geometry();
  },
  // 荷花：三层花瓣，外层平展、里层拢着，中间一个莲蓬
  lotusFlower() {
    const s = new Sprig();
    for (let ring = 0; ring < 3; ring++) for (let i = 0; i < 6; i++) {
      const a = i / 6 * TAU + ring * .52, out = [.42, .78, 1.05][ring], rise = [1, .78, .4][ring], c = Math.cos(a), d = Math.sin(a), w = .25;
      const base = V(c * .1, 0, d * .1), mid = V(c * out * .62, rise * .52, d * out * .62), tip = V(c * out, rise, d * out);
      s.tri([base, 0], [V(mid.x - d * w, mid.y - .04, mid.z + c * w), .5], [V(mid.x + d * w, mid.y - .04, mid.z - c * w), .5]);
      s.tri([V(mid.x - d * w, mid.y - .04, mid.z + c * w), .5], [tip, 1], [V(mid.x + d * w, mid.y - .04, mid.z - c * w), .5]);
    }
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU, b = (i + 1) / 6 * TAU; s.tri([V(0, .46, 0), 1], [V(Math.cos(b) * .2, .4, Math.sin(b) * .2), 1], [V(Math.cos(a) * .2, .4, Math.sin(a) * .2), 1], 1); }
    s.blade(V(0, -2.2, 0), 0, 2.2, .045, 0, { part: 1, h0: 1, h1: 1 });
    return s.geometry();
  },
  // 花苞：还拢着的荷花，尖尖的一枚
  lotusBud() {
    const s = new Sprig();
    for (let i = 0; i < 5; i++) { const a = i / 5 * TAU, b = (i + 1) / 5 * TAU; s.tri([V(Math.cos(a) * .2, .32, Math.sin(a) * .2), .4], [V(Math.cos(b) * .2, .32, Math.sin(b) * .2), .4], [V(0, .9, 0), 1]); s.tri([V(0, 0, 0), 0], [V(Math.cos(b) * .2, .32, Math.sin(b) * .2), .4], [V(Math.cos(a) * .2, .32, Math.sin(a) * .2), .4]); }
    s.blade(V(0, -2.2, 0), 0, 2.2, .04, 0, { part: 1, h0: 1, h1: 1 });
    return s.geometry();
  },
};

// 现成的一套：各种草本的材质，和每种造型的几个样子（建一次，路边的地被和树脚下的草共用）
const BLADE = ['uBladeA', 'uBladeB', 'uBladeScale'];
const MATERIALS = {
  grass: { names: BLADE, low: 'uBladeA', high: 'uBladeB', accent: 'uBladeB', scale: 'uBladeScale', bend: '1.1' },
  sedge: { names: BLADE, low: 'uBladeA * .9', high: 'uBladeB', accent: 'mix(uBladeB, vec3(.8, .68, .44), .5)', scale: 'max(uBladeScale, .78)', bend: '1.6' },
  flowers: { names: [...BLADE, 'uFlowerA', 'uFlowerB', 'uFlowerC', 'uFlowerScale'], low: 'uBladeA', high: 'uBladeB', accent: '(vSeed < .4 ? uFlowerA : vSeed < .75 ? uFlowerB : uFlowerC)', scale: 'uFlowerScale', bend: '.8' },
  fern: { names: BLADE, low: 'uBladeA * .7', high: 'mix(uBladeA, uBladeB, .55)', accent: 'uBladeB', scale: 'uBladeScale * (1. - uSnow)', bend: '.6', cut: 'abs(vUv.x) < (1. - vUv.y * .85) * (.2 + 1.6 * abs(fract(vUv.y * 11.) - .5))' },
  docks: { names: BLADE, low: 'uBladeA * .75', high: 'mix(uBladeA, uBladeB, .45)', accent: 'uBladeB', scale: 'uBladeScale * (1. - uSnow)', bend: '.3', round: .6 },
  // 落在地上的：路上和路边的（春天是花瓣、秋天是叶）；树下的落叶（桃花开着的季节没有）；桃树下的落花
  litter: { names: ['uLitterA', 'uLitterB', 'uLitterOn'], low: 'uLitterA', high: 'uLitterB', accent: 'uLitterB', scale: 'uLitterOn', bend: '0.' },
  fallen: { names: ['uLitterA', 'uLitterB', 'uLitterOn', 'uPeachBloom'], low: 'uLitterA', high: 'uLitterB', accent: 'uLitterB', scale: 'uLitterOn * (1. - uPeachBloom)', bend: '0.' },
  petals: { names: ['uPeachBloomA', 'uPeachBloomB', 'uPeachBloom'], low: 'uPeachBloomA', high: 'uPeachBloomB', accent: 'uPeachBloomB', scale: 'uPeachBloom', bend: '0.' },
  reeds: { names: ['uReedA', 'uReedB'], low: 'uReedA * .65', high: 'uReedA', accent: 'mix(uReedA, uReedB, .75)', scale: '1.', bend: '2.2' },
  pads: { names: ['uLotusLeaf', 'uLotusP'], low: 'uLotusLeaf * .5', high: 'uLotusLeaf', accent: 'uLotusLeaf', scale: 'uLotusP.x', bend: '.25', round: .7, shape: 'p.y -= uLotusP.z * aHerb.x * aHerb.x * .8;', tone: 'albedo *= (.84 + .22 * smoothstep(0., .14, abs(fract(vUv.x * 14.) - .5))) * (.9 + .2 * vUv.y);' },
  blooms: { names: ['uLotusFlower', 'uLotusP'], low: 'vec3(1., .96, .92)', high: 'uLotusFlower', accent: 'vec3(.74, .76, .34)', scale: 'uLotusP.y', bend: '.5', round: .8 },
};
const COPIES = { tuft: 3, sedge: 2, daisy: 2, bells: 2, fern: 2, docks: 2, litter: 3, reed: 2, lotusLeaf: 2, lotusFlower: 1, lotusBud: 1 };
let kit = null;
// 返回 { mats: 各材质, geos: 每种造型的几个样子 }
export function herbKit() {
  if (!kit) kit = {
    mats: Object.fromEntries(Object.entries(MATERIALS).map(([name, o]) => [name, herbMaterial(o)])),
    geos: Object.fromEntries(Object.entries(COPIES).map(([name, n]) => [name, Array.from({ length: n }, (_, i) => HERBS[name](1.3 + i * 2.7))])),
  };
  return kit;
}

// 把一批实例装成一个网格。items 用 item() 造；cast：投不投影
export function instanced(geo, mat, items, cast = false) {
  const g = new THREE.BufferGeometry(), m = new THREE.Matrix4(), q = new THREE.Quaternion(), turn = new THREE.Quaternion(), p = V(), s = V();
  for (const [name, attribute] of Object.entries(geo.attributes)) g.setAttribute(name, attribute);
  g.setIndex(geo.index);
  g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(Float32Array.from(items, t => t.seed), 1));
  const mesh = new THREE.InstancedMesh(g, mat, items.length);
  items.forEach((t, i) => mesh.setMatrixAt(i, m.compose(p.set(t.x, t.y, t.z), q.setFromUnitVectors(UP, t.up).multiply(turn.setFromAxisAngle(UP, t.yaw)), s.set(t.scale, t.scale * t.tall, t.scale))));
  return shadowed(mesh, cast, true);
}
// 一个实例：位置、随机数的种子 k、大小、高矮的比例、朝上的方向（贴着坡躺的东西给坡面的法线）
export const item = (x, y, z, k, scale, tall = 1, up = UP) => ({ x, y, z, yaw: rnd(k * 1.93 + .3) * TAU, scale, tall, up, seed: rnd(k * 3.37 + 5.1) });
// 这一处坡面的法线
export function slopeNormal(groundAt, x, z, out = V()) { return out.set(groundAt(x - 1, z) - groundAt(x + 1, z), 2, groundAt(x, z - 1) - groundAt(x, z + 1)).normalize(); }
