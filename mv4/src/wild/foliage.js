// 树的上色：每个树种一个材质，枝干和叶在同一个着色器里（按顶点上的 aTint.x 分）。
// 枝干：沿枝的树皮纹（每种树一种皴法：松是鳞皴，阔叶树和柳是纵裂，桃是光皮上横着的皮孔，梅是墨黑的疙瘩，竹是一节一节的青竿）；
//       贴地的一截发暗、长苔，冬天朝上的一面压着雪。
// 叶：形状、浓淡、偏色都从图谱里读。一片叶的颜色 = 这种树当季的两种叶色之间取一点——在树冠里面的、背光的偏深的那种，
//     外缘的、受光的偏浅的那种（青绿山水那样随光换色相，不只是换明暗）；逆着日月看，外缘的叶是透亮的。
//     一棵树一个深浅，一片林子里还有成片的偏色（秋天有的整棵红、有的整棵黄）。
// 落叶、开花：季节表里的「还剩几成叶」「开了几成花」各管一批卡片，轮不到的缩成一点消失，露出枝和枯枝梢。
// 风：整棵树顺着风弯，每张叶片各自绕着自己的中心抖，柳丝从上往下荡。
import * as THREE from 'three';
import { paint, seasonal, WIND } from './paint.js';
import { SEASONS } from './seasons.js';
import { leafAtlas } from './leaves.js';

const T = SEASONS.春.u;

// 树皮的皴法：由 q（绕枝一圈的方向）、v（沿枝的长度）、f1 f2（粗细两层噪声）算出 bark（0 墨色到 1 亮色）
const BARK = {
  scales: 'float s1 = noise3(vec3(q.x * 2.4, v * .5, q.z * 2.4) + vSeed * 7.), c1 = noise3(vec3(q.x * 3., v * 1.15, q.z * 3.) + 11.); float bark = smoothstep(0., .1, min(abs(s1 - .5), abs(c1 - .5))) * (.5 + .5 * f2);',
  furrow: 'float c1 = noise3(vec3(q.x * 5., v * .5, q.z * 5.) + 11.); float bark = smoothstep(.25, .65, f1 * .6 + f2 * .4) * (.4 + .6 * smoothstep(0., .08, abs(c1 - .5)));',
  smooth: 'float bark = .5 + .35 * f1 - .55 * smoothstep(.6, .7, noise3(vec3(q.x * 1.6, v * 9., q.z * 1.6)));',
  gnarl: 'float bark = smoothstep(.2, .75, f1 * .55 + f2 * .45);',
  cane: 'float seg = fract(v), bark = .3 + .4 * seg + .5 * smoothstep(.86, .95, seg) - smoothstep(.06, .0, min(seg, 1. - seg)) + .15 * (f1 - .5);',
};
// 每种树：季节表里的叶色（深、浅、还剩几成）、花色（深、浅、开了几成；没有花的不写）、冬天叶上积不积雪、树皮的皴法和两种颜色、长不长苔
export const KINDS = {
  pine: { leaf: ['uPineA', 'uPineB', 'uPineOn'], snow: 1, bark: 'scales', barkA: '#3E2A24', barkB: '#A46E54', moss: .5 },
  broad: { leaf: ['uBroadA', 'uBroadB', 'uBroadOn'], snow: 0, bark: 'furrow', barkA: '#3A302A', barkB: '#917D6A', moss: .7 },
  peach: { leaf: ['uPeachA', 'uPeachB', 'uPeachOn'], bloom: ['uPeachBloomA', 'uPeachBloomB', 'uPeachBloom'], snow: 0, bark: 'smooth', barkA: '#3E2824', barkB: '#98665A', moss: .3 },
  willow: { leaf: ['uWillowA', 'uWillowB', 'uWillowOn'], snow: 0, bark: 'furrow', barkA: '#34302A', barkB: '#8C8272', moss: .8 },
  plum: { leaf: ['uPlumA', 'uPlumB', 'uPlumOn'], bloom: ['uPlumBloomA', 'uPlumBloomB', 'uPlumBloom'], snow: 0, bark: 'gnarl', barkA: '#141114', barkB: '#483C42', moss: .3 },
  bamboo: { leaf: ['uBambooA', 'uBambooB', 'uBambooOn'], snow: 1, bark: 'cane', barkA: '#3E6E34', barkB: '#A4C06A', moss: 0 },
  shrub: { leaf: ['uBroadA', 'uBroadB', 'uBroadOn'], bloom: ['uFlowerA', 'uFlowerB', 'uFlowerScale'], snow: 0, bark: 'smooth', barkA: '#342A24', barkB: '#7C6858', moss: 0 },   // 灌木：叶色跟阔叶树走，花色跟野花走
};
const NO_BLOOM = { a: { value: new THREE.Color(0) }, b: { value: new THREE.Color(0) }, on: { value: 0 } };

const materials = new Map();
export function treeMaterial(kind) {
  if (!materials.has(kind)) materials.set(kind, build(KINDS[kind]));
  return materials.get(kind);
}

function build(K) {
  const pick = names => { const u = seasonal(T, ...names); return { a: u[names[0]], b: u[names[1]], on: u[names[2]] }; };
  const leaf = pick(K.leaf), bloom = K.bloom ? pick(K.bloom) : NO_BLOOM;
  return paint({
    side: THREE.DoubleSide, alphaToCoverage: true,
    uniforms: {
      uAtlas: { value: leafAtlas() }, uLeafA: leaf.a, uLeafB: leaf.b, uLeafOn: leaf.on, uBloomA: bloom.a, uBloomB: bloom.b, uBloomOn: bloom.on, ...seasonal(T, 'uMoss'),
      uLeafSnow: { value: K.snow }, uBarkA: { value: new THREE.Color(K.barkA) }, uBarkB: { value: new THREE.Color(K.barkB) }, uMossy: { value: K.moss },
    },
    vertexPars: /* glsl */`
      attribute vec4 aTint; attribute vec3 aCenter; attribute float aSeed; uniform float uLeafOn, uBloomOn;
      varying vec4 vTint; varying vec2 vUv; varying float vSeed, vBake, vOn, vTree; ${WIND}`,
    vertex: /* glsl */`
      float part = aTint.x, own = fract(aTint.w * 7.13 + aSeed * 3.71), each = fract(own + dot(aCenter, vec3(.731, .517, .293)));
      float keep = part > .5 && part < 1.5 ? step(each, uLeafOn - .001) : part > 2.5 && part < 3.5 ? step(each, uBloomOn - .001) : 1.;
      p = mix(aCenter, p, keep);
      vTint = aTint; vSeed = aSeed; vUv = uv; vOn = step(own, uLeafOn - .001);`,
    world: /* glsl */`
      vec3 root = M[3].xyz; vBake = bakedSun(root.xz);
      vTree = clamp(.5 + (fract(aSeed * 7.3) - .5) * .8 + (fbm2(root.xz * .017) - .5) * 1.4, 0., 1.);
      float isStrand = step(1.5, part) * step(part, 2.5), isCard = step(.5, part) * (1. - isStrand);
      vec3 cw = (M * vec4(aCenter, 1.)).xyz, off = wp - cw;
      float ph = aTint.w * 31. + aSeed * 17. + cw.y * .4, shake = uWind.z * (.6 * sin(uTime * 2.3 + ph) + .4 * sin(uTime * 3.9 + ph * 1.7));
      wp += windSway(root, aTint.z, aSeed);
      wp += isCard * (cross(normalize(vec3(uWind.y, .6, -uWind.x)), off) * shake * .22 + vec3(uWind.x, .2, uWind.y) * shake * .07);
      wp += isStrand * vec3(uWind.x, 0., uWind.y) * uWind.z * aTint.y * aTint.y * (.55 * sin(uTime * 1.5 - aTint.y * 3.2 + ph) + .25 * sin(uTime * 2.7 - aTint.y * 5. + ph * 2.));`,
    fragmentPars: /* glsl */`
      uniform sampler2D uAtlas; uniform vec3 uLeafA, uLeafB, uBloomA, uBloomB, uBarkA, uBarkB, uMoss; uniform float uLeafSnow, uMossy;
      varying vec4 vTint; varying vec2 vUv; varying float vSeed, vBake, vOn, vTree;
      // 这个像素上有没有东西（枝干处处都有）。图谱里的 B：0.5 上下是枝梗，1 是花瓣或雪
      float cover(vec4 tex) {
        float part = vTint.x, stem = smoothstep(.25, .45, tex.b) * (1. - smoothstep(.6, .85, tex.b)), petal = smoothstep(.6, .85, tex.b), a = tex.a;
        if (part > 3.5) a *= mix(1., uSnow, petal);                       // 枯枝梢上的雪只在积雪的季节有
        else if (part > 1.5 && part < 2.5) a *= mix(vOn, 1., stem);      // 柳丝：叶落了，梗还垂着
        return a;
      }`,
    depthFragment: 'if (vTint.x > .5 && cover(texture2D(uAtlas, vUv)) < .4) discard;',
    fragment: /* glsl */`
      N = normalize(vN);
      float part = vTint.x, dab = fbm(vWp.xz * .9 + vWp.y * 1.1);
      vec3 snow = vec3(.9, .93, 1.);
      if (part < .5) {
        float ang = vUv.x * 6.2832, v = vUv.y; vec3 q = vec3(cos(ang), 0., sin(ang));
        float f1 = noise3(vec3(q.x * 4.2, v * .65, q.z * 4.2) + vSeed * 7.), f2 = noise3(vec3(q.x * 9., v * 2.1, q.z * 9.) + 3.);
        ${BARK[K.bark]}
        albedo = mix(uBarkA, uBarkB, clamp(bark, 0., 1.)) * (.72 + .28 * vTint.y);
        albedo = mix(albedo, uMoss * .55, uMossy * smoothstep(.8, .3, vTint.y) * smoothstep(.35, .65, f2 + .25 * N.y) * (1. - uSnow));
        albedo = mix(albedo, snow, uSnow * smoothstep(.2, .6, N.y + (f2 - .5) * .5));
        ao = .6 + .4 * vTint.y;
      } else {
        vec4 tex = texture2D(uAtlas, vUv);
        float a = cover(tex);
        if (part < 1.5 || part > 2.5) a *= smoothstep(.05, .3, abs(dot(normalize(cross(dFdx(vWp), dFdy(vWp))), normalize(vWp - cameraPosition))));   // 侧着对镜头的卡片淡掉，不露出一道道的边
        alpha = clamp((a - .36) / max(fwidth(a), .03) + .5, 0., 1.);                     // 边缘按屏幕上的粗细收紧：远了不变稀
        if (alpha < .05) discard;
        float stem = smoothstep(.25, .45, tex.b) * (1. - smoothstep(.6, .85, tex.b)), petal = smoothstep(.6, .85, tex.b);
        float depth = part > 1.5 && part < 2.5 ? .45 + .55 * vTint.y : vTint.y;          // 在树冠里的深浅（柳丝：越往下越亮）
        float facing = smoothstep(-.35, .55, dot(N, uSunDir));
        vec3 leaf = mix(uLeafA, uLeafB, clamp(tex.g * .4 + depth * .35 + facing * .45 + (vTree - .5) * .8 + (dab - .5) * .35 - .2, 0., 1.)) * (.55 + .6 * tex.r) * (.86 + .28 * fract(vSeed * 9.7)) * mix(.76, 1.16, facing);
        vec3 flower = mix(uBloomA, uBloomB, clamp(tex.g * .6 + depth * .3 + facing * .3 + (dab - .5) * .3 - .1, 0., 1.)) * (.72 + .4 * tex.r);
        albedo = mix(leaf, mix(uBarkA, uBarkB, .45) * (.5 + .6 * tex.r), stem);
        albedo = mix(albedo, part > 3.5 ? snow : flower, petal);
        albedo = mix(albedo, snow, uSnow * uLeafSnow * (1. - stem) * smoothstep(.1, .55, N.y + (dab - .5) * .6));
        float back = pow(max(dot(normalize(vWp - cameraPosition), uSunDir), 0.), 2.5) * depth * (1. - stem);   // 逆光：外缘的叶透亮
        albedo = mix(albedo, albedo * 1.4 + uLeafB * .1, back);
        ao = mix(mix(.45, 1., depth), 1., .6 * petal); thin = .3 + .55 * back + .3 * petal;
        glow += uSunCol * mix(albedo, vec3(1.), .4) * uSnow * back * smoothstep(110., 260., distance(vWp, cameraPosition)) * .12;   // 雪夜远看、背着月亮：树冠外缘压着的雪被月光勾亮
      }
      sun *= vBake;`,
  });
}
