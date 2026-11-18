// 灯和香炉用的材质：带锈色和包浆的铜、开片的青瓷；以及刻在器物上的纹饰（回纹、莲瓣、联珠、卷云、弦纹）的高度图。
import * as THREE from 'three';
import { NOISE, CELLS, canvasTexture, TOP } from './shared.js';

// 纹饰高度图。底色是中灰，凸起的纹样偏白，刻下去的线偏黑。bands：[{ kind, v0, v1, n }]，v 是贴图纵向 0 到 1，n 是绕一圈重复几次
const DRAW = {
  // 回纹：方折的螺旋，一格接一格
  fret(c, x, y, w, h) {
    const P = [[0, .9], [.9, .9], [.9, .1], [.18, .1], [.18, .68], [.68, .68], [.68, .32], [.42, .32], [.42, .5]];
    c.lineWidth = Math.min(w, h) * .09; c.lineJoin = 'miter'; c.strokeStyle = '#E6E6E6';
    c.beginPath(); P.forEach(([a, b], i) => c[i ? 'lineTo' : 'moveTo'](x + a * w, y + b * h)); c.stroke();
  },
  // 莲瓣：尖拱形的瓣，中间鼓、有中脊，瓣与瓣之间露出后一层的瓣尖
  lotus(c, x, y, w, h, up) {
    const Y = b => y + (up ? b : 1 - b) * h;                          // up：瓣尖朝贴图上方
    const petal = (cx, half, tip, base, fill) => {
      c.beginPath(); c.moveTo(cx - half, Y(base));
      c.bezierCurveTo(cx - half, Y(base - (base - tip) * .55), cx - half * .35, Y(tip + (base - tip) * .12), cx, Y(tip));
      c.bezierCurveTo(cx + half * .35, Y(tip + (base - tip) * .12), cx + half, Y(base - (base - tip) * .55), cx + half, Y(base));
      c.closePath();
      if (fill) { c.fillStyle = fill; c.fill(); }
      c.lineWidth = w * .035; c.strokeStyle = '#3A3A3A'; c.stroke();
    };
    petal(x, w * .46, .2, 1, '#9C9C9C'); petal(x + w, w * .46, .2, 1, '#9C9C9C');      // 后一层，只露瓣尖
    const g = c.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, '#8A8A8A'); g.addColorStop(.5, '#F0F0F0'); g.addColorStop(1, '#8A8A8A');
    petal(x + w / 2, w * .47, .04, 1, g);
    c.lineWidth = w * .03; c.strokeStyle = '#FFFFFF'; c.beginPath(); c.moveTo(x + w / 2, Y(.16)); c.lineTo(x + w / 2, Y(.92)); c.stroke();
  },
  // 联珠：一圈小圆珠
  pearls(c, x, y, w, h) {
    const r = Math.min(w, h) * .4, g = c.createRadialGradient(x + w / 2, y + h / 2, 0, x + w / 2, y + h / 2, r);
    g.addColorStop(0, '#FFFFFF'); g.addColorStop(.7, '#D0D0D0'); g.addColorStop(1, '#808080');
    c.fillStyle = g; c.beginPath(); c.arc(x + w / 2, y + h / 2, r, 0, 7); c.fill();
  },
  // 卷云：一左一右两个往里卷的涡，中间一道 S 形的云脚相连
  cloud(c, x, y, w, h) {
    c.lineWidth = Math.min(w, h) * .085; c.lineCap = 'round'; c.strokeStyle = '#E8E8E8';
    const swirl = (cx, cy, R, dir, a0) => {
      c.beginPath();
      for (let k = 0; k <= 40; k++) { const a = a0 + dir * k / 40 * 7.4, r = R * (1 - k / 40 * .86); c[k ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
      c.stroke();
    };
    swirl(x + w * .27, y + h * .58, h * .34, 1, Math.PI * .5); swirl(x + w * .73, y + h * .42, h * .34, 1, -Math.PI * .5);
    c.beginPath(); c.moveTo(x + w * .27, y + h * .92); c.bezierCurveTo(x + w * .55, y + h * .95, x + w * .45, y + h * .05, x + w * .73, y + h * .08); c.stroke();
  },
  // 弦纹：几道平行的细棱
  lines(c, x, y, w, h) {
    c.fillStyle = '#E0E0E0';
    for (const b of [.15, .7]) c.fillRect(x - 1, y + b * h, w + 2, h * .18);
  },
};
const GROUND = ['fret', 'cloud', 'lotus'];
export function ornament(bands, w = 1024, h = 512) {
  return canvasTexture(w, h, c => {
    c.fillStyle = '#808080'; c.fillRect(0, 0, w, h);
    for (const { kind, v0, v1, n, up = true } of bands) {
      const y = (1 - v1) * h, bh = (v1 - v0) * h, cw = w / n;
      if (GROUND.includes(kind)) { c.fillStyle = '#585858'; c.fillRect(0, y, w, bh); }       // 纹样是减地浮雕：地子低，纹样高
      for (let i = 0; i < n; i++) DRAW[kind](c, i * cw, y, cw, bh, up);
    }
  }, 1.2);
}

// 在标准材质上改片元着色器的几个环节。color：算底色；rough：改粗糙度和金属度；glow：加自发光
function customise(mat, uniforms, { key, head, color, rough, glow = '' }) {
  mat.customProgramCacheKey = () => key;                              // three 按这个区分着色器程序；不给的话两种材质会被当成同一个
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float cavity;\nvarying float vCav;\nvarying vec3 vObj;\nvarying vec3 vWp;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCav = cavity; vObj = position; vWp = (modelMatrix * vec4(position, 1.)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${NOISE}\nvarying float vCav;\nvarying vec3 vObj;\nvarying vec3 vWp;\nfloat gAge = 0.;\n${head}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${color}`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>\n${rough}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${glow}`);
  };
  return mat;
}
const col = hex => ({ value: new THREE.Color(hex) });

// 老铜：深褐的胎，凸起的棱和纹饰高处被手摸出暖金色的包浆，凹处和背阴处长铜绿。
// warm：{ value } 灯火此刻的亮度，照在案上的暖光会反上来，映亮器物朝下的一面（bounce 是强度，香炉盖不受这个影响就给 0）
export function bronze({ bump = null, bumpScale = 1, rust = .5, seed = 0, bounce = 0, warm = { value: 1 } } = {}) {
  const mat = new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: .56, metalness: .38, bumpMap: bump, bumpScale });
  return customise(mat, {
    uDark: col('#261A13'), uBase: col('#6A5133'), uSheen: col('#B48E55'), uRustA: col('#2A6A5C'), uRustB: col('#6FA590'),
    uRust: { value: rust }, uSeed: { value: seed }, uBounce: { value: bounce }, uWarm: warm,
  }, {
    key: 'glow-bronze',
    head: 'uniform vec3 uDark, uBase, uSheen, uRustA, uRustB; uniform float uRust, uSeed, uBounce, uWarm;',
    color: /* glsl */`
      float orn = 0.;
      #ifdef USE_BUMPMAP
        orn = texture2D(bumpMap, vBumpMapUv).x - .5;
      #endif
      vec3 P = vObj + uSeed;
      float n1 = fbm(P * 1.3), n2 = fbm(P * 5.1 + 7.3), n3 = fbm(P * 13. + 3.1);
      vec3 tone = mix(uDark, uBase, smoothstep(.2, .8, n1 * .7 + n3 * .3));
      float worn = clamp(smoothstep(.08, .7, -vCav) * (.4 + .8 * n2) + max(orn, 0.) * 1.6, 0., 1.);    // 凸棱和纹饰高处：包浆
      tone = mix(tone, uSheen, worn * .62);
      tone *= 1. + min(orn, 0.) * 1.6;                                                                   // 纹饰的地子：积着陈年的暗色
      gAge = smoothstep(.5, .74, n1 * .62 + n2 * .4 + vCav * .3 + max(-orn, 0.) * .9 + uRust - .5) * (1. - worn * .7);   // 凹处和背阴处：铜绿
      tone = mix(tone, mix(uRustA, uRustB, smoothstep(.3, .7, n3 * .6 + n2 * .5)), gAge * .82);
      diffuseColor.rgb = tone * (.8 + .4 * n3);`,
    rough: 'roughnessFactor = mix(roughnessFactor, .95, gAge); metalnessFactor *= 1. - gAge;',
    glow: /* glsl */`
      vec3 wn = inverseTransformDirection(normal, viewMatrix);
      float under = clamp(.6 - wn.y * .6, 0., 1.), low = 1. - .45 * smoothstep(${(TOP + .5).toFixed(2)}, ${(TOP + 6).toFixed(2)}, vWp.y);   // 朝下的面、离案面近的地方反光多
      totalEmissiveRadiance += diffuseColor.rgb * vec3(1., .56, .2) * uWarm * uBounce * under * under * low * .95;`,
  });
}

// 青瓷：粉青的釉，釉厚处色深，棱上釉薄露出浅色的胎；满身大小两层开片，纹路里沁着茶褐色；足尖不挂釉，露出深色的胎
export function celadon({ seed = 0 } = {}) {
  const mat = new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: .68, metalness: 0 });
  return customise(mat, {
    uGlaze: col('#A8D8C6'), uDeep: col('#6FA996'), uThin: col('#C4D6C4'), uCrack: col('#6A5438'), uClay: col('#3A2620'), uSeed: { value: seed }, uFoot: { value: TOP + .13 },
  }, {
    key: 'glow-celadon',
    head: `uniform vec3 uGlaze, uDeep, uThin, uCrack, uClay; uniform float uSeed, uFoot;\n${CELLS}`,
    color: /* glsl */`
      vec3 P = vWp + uSeed;
      float n1 = fbm(P * 1.1), n2 = vnoise(P * 9.);
      vec3 tone = mix(uGlaze, uDeep, clamp(smoothstep(.3, .7, n1) * .5 + max(vCav, 0.) * .9, 0., 1.));
      tone = mix(tone, uThin, smoothstep(.1, .75, -vCav) * .55);
      float big = 1. - smoothstep(.0, .028, cellEdge(P * 3.3 + (fbm(P * 2.2) - .5) * 1.2));
      float fine = 1. - smoothstep(.0, .04, cellEdge(P * 8.2 + 11.));
      tone = mix(tone, uCrack, max(big * .62, fine * .2 * smoothstep(.3, .6, n1)));
      gAge = 1. - smoothstep(uFoot - .03, uFoot + .03, vWp.y + (n2 - .5) * .05);
      diffuseColor.rgb = mix(tone, uClay * (.7 + .6 * n2), gAge);`,
    rough: 'roughnessFactor = mix(roughnessFactor, .92, gAge);',
  });
}
