// 石作：把一块块凿出来的石头拼成一个网格（石阶的条石、路面的石板、路缘石、基座和护坡的垒石），以及它们的材质。
// 每块石头是一个「面 + 往里的厚度」：正面四周削一圈斜棱（磨损的棱角），棱往后是侧面。相邻的石头各有各的棱，中间自然成缝。
// 每个顶点带 aTone：x 这块石头的随机数（深浅、冷暖各不同），y 种类，z 这一点有多「藏」（1 敞着，越小越在缝里、台阶根上——发暗、长苔、积雪），
// w 在路面上横向的位置（-1 左缘，1 右缘；中间被踩得多）。
import * as THREE from 'three';
import { paint, seasonal } from './paint.js';
import { SEASONS } from './seasons.js';
import { RISER } from './road.js';

export const KIND = { tread: 0, stair: .25, curb: 1, wall: 2, rubble: 3, bed: 4 };   // 平路的石板、石阶的条石、路缘石、基座的条石、护坡的毛石、石缝底下的垫层

const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), O = new THREE.Vector3(), NF = new THREE.Vector3();
const OUT = [0, 1, 2, 3].map(() => new THREE.Vector3()), IN = [0, 1, 2, 3].map(() => new THREE.Vector3()), RIM = [0, 1, 2, 3].map(() => new THREE.Vector3()), FAR = [0, 1, 2, 3].map(() => new THREE.Vector3());
const ALL = [true, true, true, true], OPEN = [1, 1, 1, 1];

export class Stones {
  constructor() { this.pos = []; this.nor = []; this.tone = []; }
  // 一个四边形：四个点、各自的法线和藏露，正面朝 ref 那一侧
  quad(p, n, hide, seed, kind, across, ref) {
    A.subVectors(p[1], p[0]); B.subVectors(p[3], p[0]);
    const order = A.cross(B).dot(ref) >= 0 ? [0, 1, 2, 0, 2, 3] : [0, 3, 2, 0, 2, 1];
    for (const i of order) { this.pos.push(p[i].x, p[i].y, p[i].z); this.nor.push(n[i].x, n[i].y, n[i].z); this.tone.push(seed, kind, hide[i], across[i]); }
  }
  // 一块石头。face：正面的四个角（绕一圈）；back：从正面往石头里面去的方向和厚度。
  // o：{ seed, kind, bevel 棱削多宽, sides 四条边（第 i 条是角 i 到角 i+1）各自要不要侧面, hide 四个角的藏露, deep 侧面里端的藏露, across 四个角在路面上的横向位置 }
  block(face, back, { seed, kind, bevel = .03, sides = ALL, hide = OPEN, deep = .5, across = OPEN }) {
    NF.copy(back).normalize().negate();
    O.set(0, 0, 0); for (const v of face) O.addScaledVector(v, .25);
    for (let i = 0; i < 4; i++) {
      const a = face[i], b = face[(i + 1) % 4];
      OUT[i].subVectors(b, a).cross(NF).normalize();                                 // 这条边朝外的方向
      if (C.addVectors(a, b).multiplyScalar(.5).sub(O).dot(OUT[i]) < 0) OUT[i].negate();
      IN[i].subVectors(O, a).setLength(bevel * 1.5).add(a);                         // 正面往里收一圈
      RIM[i].copy(a).addScaledVector(NF, -bevel * .8);                              // 棱的外沿比正面低一点
      FAR[i].copy(a).add(back);
    }
    const rimN = [0, 1, 2, 3].map(i => new THREE.Vector3().addVectors(OUT[i], OUT[(i + 3) % 4]).normalize().multiplyScalar(.8).add(NF).normalize());
    const flat = [NF, NF, NF, NF], rimHide = hide.map(h => h * .9);
    this.quad(IN, flat, hide, seed, kind, across, NF);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4, ac = [across[i], across[j], across[j], across[i]];
      C.addVectors(NF, OUT[i]);
      this.quad([RIM[i], RIM[j], IN[j], IN[i]], [rimN[i], rimN[j], NF, NF], [rimHide[i], rimHide[j], hide[j], hide[i]], seed, kind, ac, C);
      if (sides[i]) this.quad([FAR[i], FAR[j], RIM[j], RIM[i]], [OUT[i], OUT[i], rimN[j], rimN[i]], [deep, deep, rimHide[j], rimHide[i]], seed, kind, ac, OUT[i]);
    }
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('aTone', new THREE.Float32BufferAttribute(this.tone, 4));
    return g;
  }
}

// 沿路分段的一组石作：每 span 个单位的路一个网格，镜头外的段整段不画
export class StoneSet {
  constructor(length, span = 90) { this.span = span; this.list = Array.from({ length: Math.floor(length / span) + 1 }, () => new Stones()); }
  at(s) { return this.list[Math.min(this.list.length - 1, Math.max(0, Math.floor(s / this.span)))]; }
  meshes(material) { return this.list.filter(stones => stones.pos.length).map(stones => new THREE.Mesh(stones.geometry(), material)); }
}

// 石头的材质：每块深浅冷暖略不同，面上有凿痕和风化的斑；缝里、台阶根上、路的两缘长青苔；
// 夏天雨里颜色沉下去、一块块深浅拉开，低洼的石板上和路的两缘积着浅水（映着对面的天和岸）；冬天朝上的面积雪，台阶根上积得厚，路中间被踩出一条露石头的道。
export function stoneMaterial() {
  return paint({
    uniforms: seasonal(SEASONS.春.u, 'uPave', 'uPaveDark', 'uMoss', 'uSoil', 'uReflLand'),
    vertexPars: 'attribute vec4 aTone; varying vec4 vTone;',
    vertex: 'vTone = aTone;',
    fragmentPars: 'uniform vec3 uPave, uPaveDark, uMoss, uSoil, uReflLand; varying vec4 vTone;',
    fragment: /* glsl */`
      float seed = vTone.x, kind = vTone.y, open = vTone.z, across = vTone.w;
      float level = smoothstep(.55, .92, N.y), walk = step(kind, .5), close = smoothstep(60., 6., distance(vWp, cameraPosition));
      float grain = noise1(vWp.xz * 1.9 + vWp.y * 2.3) * .6 + noise1(vWp.xz * 6.3 + vWp.y * 5.1) * .4, blot = fbm(vWp.xz * .21 + vWp.y * .13);
      float chisel = noise1(vec2(dot(vWp, vec3(8.3, 6.1, 4.7)) + seed * 40., dot(vWp, vec3(-.6, .3, .8))));           // 一道道平行的凿痕，每块石头方向相同、位置不同
      vec3 stone = uPave * (.76 + .36 * fract(seed * 7.13)) * mix(vec3(1.), vec3(1.06, 1., .9), fract(seed * 13.7)) * (.86 + .28 * grain) * (1. + (chisel - .5) * .14 * close);
      stone = mix(stone, uPaveDark * 1.35, .3 * smoothstep(1.5, 2.5, kind));                                           // 基座和护坡的石头风化得深一些
      // 远看（一级石阶在画面上不到一个像素）：按高度把台阶并成一组组，每组底下一道暗的（立面攒起来的影）、上面是亮的踏面，
      // 组的大小跟着远近取，画面上总有五到十个像素宽——远远看去是一道道横纹的石阶，不是一条光带；颜色也往山石那边靠，立面压暗
      float away = distance(vWp, cameraPosition), lod = log2(max(away * .0086, .01)), far = smoothstep(-.6, .6, lod), stair = walk * step(.1, kind);
      float octave = max(floor(lod), 0.), period = ${(2 * RISER).toFixed(2)} * exp2(octave);
      vec2 fr = fract(vWp.y / vec2(period, 2. * period) + .12), band = smoothstep(.02, .08, fr) * (1. - smoothstep(.34, .42, fr));
      stone *= 1. - .34 * stair * far * mix(band.x, band.y, clamp(lod - octave, 0., 1.));
      stone *= mix(1., .7, stair * (1. - level) * (.4 + .6 * far));
      stone = mix(stone, stone * vec3(.88, .9, .86), far * .6);
      stone *= 1. + (.1 + .12 * far) * walk * level * smoothstep(.8, .2, abs(across) + (blot - .5) * .6);              // 路中间被脚磨得发亮
      N = normalize(N + vec3(noise4(vWp.xz * 2.7 + vWp.y * 3.1).rg - .5, 0.).xzy * .16 * close);                      // 石面不是镜子一样平
      albedo = stone * mix(.66, 1., smoothstep(.3, 1., open));
      // 青苔：缝里、台阶根上、路的两缘、墙面的下半
      float moss = clamp((1. - open) * 1.5 + walk * smoothstep(.68 - .12 * far, 1., abs(across)) * (.6 + .5 * far) + (1. - walk) * (.2 + .25 * far), 0., 1.) * smoothstep(.46 - .1 * far, .7, blot + .25 * grain);   // 远看两缘的苔连成一道绿边
      albedo = mix(albedo, uMoss * (.5 + .4 * grain), moss * mix(.45, .75, walk) * (1. - uSnow));
      // 垒墙的石头面上：凿过的面坑坑点点，风化出浅色的斑和几点地衣，雨水顺着墙面淌下来的深色水痕
      float upright = 1. - level, pit = smoothstep(.62, .82, noise1(vWp.xz * 4.1 + vWp.y * 3.7 + seed * 9.)), lichen = smoothstep(.7, .86, fbm(vWp.xz * .9 + vWp.y * .8 + seed * 5.));
      float trickle = smoothstep(.55, .85, noise1(vec2(dot(vWp.xz, vec2(.7, -.7)) * 2.3, vWp.y * .18))) * upright;
      albedo *= 1. - .22 * pit * close * upright - .25 * trickle * (.4 + .6 * uWet);
      albedo = mix(albedo, mix(vec3(.82, .8, .66), uMoss * .9, fract(seed * 3.1)), .35 * lichen * upright * (1. - uSnow) * step(.5, kind) * step(kind, 2.5));
      N = normalize(N + upright * close * .22 * vec3(noise4(vWp.xz * 1.3 + vWp.y * 1.7 + seed * 3.).rg - .5, noise1(vWp.xz * 1.1 + vWp.y * 2.1) - .5).xzy);
      // 石缝底下：暗的泥，零星一点苔，不是一道亮线
      albedo = mix(albedo, mix(uSoil * .3, uMoss * .34, .5 * smoothstep(.5, .7, blot + .3 * grain) * (1. - uSnow)), step(3.5, kind));
      // 雨里：石头颜色沉下去、发润，不起反光；低一点的石板上和路的两缘积着浅水，还在下雨时积水上打着一圈圈小涟漪；放晴后石面上有几粒水光
      float pond = blot * .6 + fbm(vWp.xz * .8 + 3.) * .4 + .2 * fract(seed * 5.3) - .1 + .16 * smoothstep(.45, 1., abs(across));
      float puddle = uWet * level * walk * smoothstep(.5, .6, pond) * smoothstep(.6, .9, open), film = uWet * level * walk * smoothstep(.36, .52, pond) * (1. - puddle);   // 积水，和它周围一圈还没干的水膜
      albedo = soak(albedo * mix(1., (.88 + .14 * blot) * (.84 + .34 * fract(seed * 3.7)), uWet), uWet * mix(.8, .4, smoothstep(1.5, 2.5, kind)));   // 湿了以后一块块石头的深浅拉得更开
      vec3 rd = normalize(vWp - cameraPosition);
      vec2 cell = floor(vWp.xz / .38); vec4 hr = texture2D(uNoise, (cell + .5) / 256.);
      float age = fract(uTime * (.9 + .7 * hr.a) + hr.r * 7.), ring = exp(-pow((length(fract(vWp.xz / .38) - .5 - (hr.gb - .5) * .4) - age * .42) / .05, 2.)) * (1. - age) * (1. - age) * uWeather.x * step(.3, hr.g);
      vec3 Np = normalize(vec3(ring * (hr.r - .5), 1., ring * (hr.b - .5)));
      albedo = mix(albedo, albedo * .45, puddle) * (1. - .22 * film);
      // 积水里映的是它对面的东西：视线压得低时映着天，俯看时映着岸上的树和崖（一片深的青绿），不是一律的天蓝
      vec3 R = reflect(rd, mix(N, Np, puddle)), land = mix(uReflLand, uMistCol, .35) * (uSkyCol * .7 + uSunCol * .25) * (RECIPROCAL_PI * GAIN);
      vec3 heaven = skyBase(R), mirrored = mix(land, mix(heaven, vec3(dot(heaven, vec3(.3, .5, .2))), .45) + sunWash(R) * .3, smoothstep(.05, .36, R.y + (grain - .5) * .12));   // 映出来的天比真的天灰一些：水面不是镜子
      glow = mirrored * (puddle * (.5 + .3 * ring) + film * .07) * (.5 + .5 * pow(1. - max(dot(-rd, N), 0.), 3.)) * (1. - uSnow) + uSunCol * dewGlint(vWp, N, .07) * .14 * uWet * walk;
      // 积雪：盖住朝上的石面，台阶根上、缝里积得厚；路中间一条被踩过的道露出石头
      float trod = smoothstep(.8, .3, abs(across) + (blot - .5) * .9) * walk;
      float snow = uSnow * level * smoothstep(.25, .6, blot * .5 + grain * .3 + .45 - trod * .62 + (1. - open) * .7);
      albedo = mix(albedo, vec3(.9, .93, 1.), snow);
      ao = mix(.52, 1., open) * mix(1., .5, step(3.5, kind));
      sun *= bakedSun(vWp.xz);`,
  });
}
