// 书案模块共用的小工具：画布、随机数流、可平铺的噪声、由高度算法线贴图、把画布包成贴图、给标准材质的着色器加料。
import * as THREE from 'three';
import { rnd } from '../../anim.js';

export function canvas2d(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d', { willReadFrequently: true })];
}

// 楷体：机器上装了哪种就用哪种。把候选字体和通用字体各画一遍，画出来不一样的才是真装了的
let kai = null;
export function kaiFont() {
  if (kai) return kai;
  const [, g] = canvas2d(48, 48);
  const shot = font => { g.clearRect(0, 0, 48, 48); g.font = `40px ${font}`; g.textBaseline = 'top'; g.fillText('永', 4, 2); return g.getImageData(0, 0, 48, 48).data.join(); };
  const plain = shot('sans-serif');
  const found = ['Kaiti SC', 'STKaiti', 'HYKaiTiJ', 'KaiTi_GB2312', 'KaiTi'].filter(name => shot(`"${name}", sans-serif`) !== plain);
  if (!found.length) throw new Error('这台机器上没有找到楷体字库');
  console.log(`书案：写字用的楷体是 ${found.join('、')}`);
  kai = [...found.map(n => `"${n}"`), 'serif'].join(', ');
  return kai;
}

// 随机数流：同一个 seed 每次给出同一串数
export function stream(seed) {
  let i = 0;
  return () => rnd(seed * 91.7 + (i += 1) * 1.37);
}
export const smooth = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };

// 可平铺的值噪声：cx × cy 个随机格点，平滑插值到 w × h。返回 0 到 1 的浮点数组
export function noiseField(w, h, cx, cy, seed) {
  const lat = new Float32Array(cx * cy), out = new Float32Array(w * h);
  for (let i = 0; i < lat.length; i++) lat[i] = rnd(seed * 17.31 + i * .618);
  const xa = new Int32Array(w), xb = new Int32Array(w), xt = new Float32Array(w);
  for (let x = 0; x < w; x++) {
    const f = x / w * cx, i = Math.floor(f), t = f - i;
    xa[x] = i % cx; xb[x] = (i + 1) % cx; xt[x] = t * t * (3 - 2 * t);
  }
  for (let y = 0; y < h; y++) {
    const f = y / h * cy, j = Math.floor(f), t = f - j, ty = t * t * (3 - 2 * t), r0 = (j % cy) * cx, r1 = ((j + 1) % cy) * cx, o = y * w;
    for (let x = 0; x < w; x++) {
      const a = xa[x], b = xb[x], top = lat[r0 + a] + (lat[r0 + b] - lat[r0 + a]) * xt[x], bot = lat[r1 + a] + (lat[r1 + b] - lat[r1 + a]) * xt[x];
      out[o + x] = top + (bot - top) * ty;
    }
  }
  return out;
}
// 几层值噪声叠起来（每层格点加倍、幅度乘 gain），仍然可平铺，结果在 0 到 1 之间
export function fbmField(w, h, cx, cy, octaves, seed, gain = .5) {
  const out = new Float32Array(w * h);
  let amp = 1, total = 0;
  for (let o = 0; o < octaves; o++) {
    const n = noiseField(w, h, cx << o, cy << o, seed + o * 7.7);
    for (let i = 0; i < out.length; i++) out[i] += n[i] * amp;
    total += amp; amp *= gain;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}
// 逐点取样的值噪声：返回 (x, y) → 0 到 1，格点间距是 1，每 256 格重复
export function pointNoise(seed) {
  const lat = new Float32Array(65536);
  for (let i = 0; i < 65536; i++) lat[i] = rnd(seed * 29.3 + i * .377);
  return (x, y) => {
    const i = Math.floor(x), j = Math.floor(y), tx = x - i, ty = y - j, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const a = i & 255, b = (i + 1) & 255, r0 = (j & 255) << 8, r1 = ((j + 1) & 255) << 8;
    const top = lat[r0 | a] + (lat[r0 | b] - lat[r0 | a]) * sx, bot = lat[r1 | a] + (lat[r1 | b] - lat[r1 | a]) * sx;
    return top + (bot - top) * sy;
  };
}

// 把画布的某个通道读成 0 到 1 的浮点数组
export function channel(g, w, h, ch = 0) {
  const d = g.getImageData(0, 0, w, h).data, out = new Float32Array(w * h);
  for (let i = 0; i < out.length; i++) out[i] = d[i * 4 + ch] / 255;
  return out;
}
// 由高度场算切线空间的法线贴图。strength 越大起伏越明显；wrap 为真时按可平铺处理边界
export function normalCanvas(hf, w, h, strength, wrap = true) {
  const [c, g] = canvas2d(w, h), img = g.createImageData(w, h), d = img.data;
  const at = (x, y) => (wrap ? hf[((y + h) % h) * w + (x + w) % w] : hf[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))]);
  for (let y = 0, p = 0; y < h; y++) for (let x = 0; x < w; x++, p += 4) {
    const nx = (at(x - 1, y) - at(x + 1, y)) * strength, ny = (at(x, y + 1) - at(x, y - 1)) * strength, k = 127.5 / Math.hypot(nx, ny, 1);
    d[p] = 127.5 + nx * k; d[p + 1] = 127.5 + ny * k; d[p + 2] = 127.5 + k; d[p + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

let maxAniso = 16;
export const setMaxAniso = renderer => { maxAniso = renderer.capabilities.getMaxAnisotropy(); };
// 把画布包成贴图。srgb：是颜色还是数据；repeat：平铺次数 [u, v]
export function tex(canvas, { srgb = false, repeat = null } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = maxAniso;                                         // 镜头贴着案面看，贴图都是斜着被看到的，各向异性过滤要开到最大
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

// 给标准材质的着色器加料。uniforms：新增的量；其余各项是插到对应位置的 GLSL 片段。
// 顶点着色器里可以用 vWorld（世界坐标）和 vUv0（没有平铺过的原始 uv）
// gloss：给高光打的折扣（GLSL 表达式）。月光几乎贴着案面从镜头对面照过来，不打折的话木和纸会泛出一片刺眼的反光
export function extend(material, { uniforms = {}, vertexHead = '', vertex = '', head = '', afterMap = '', afterRoughness = '', gloss = '1.' }) {
  material.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vWorld;\nvarying vec2 vUv0;\n${vertexHead}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${vertex}\nvWorld = (modelMatrix * vec4(transformed, 1.)).xyz;\nvUv0 = uv;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vWorld;\nvarying vec2 vUv0;\n${head}`)
      .replace('#include <map_fragment>', `#include <map_fragment>\n${afterMap}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\n${afterRoughness}`)
      .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>\nfloat glossK = ${gloss};\nmaterial.specularColor *= glossK;\nmaterial.specularColorBlended *= glossK;\nmaterial.specularF90 *= glossK;`);
  };
  return material;
}

export const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: .8, ...o });
// 让一个物体（连同它的子物体）投影并接收投影
export function shadowed(obj, cast = true, receive = true) {
  obj.traverse(m => { if (m.isMesh) { m.castShadow = cast; m.receiveShadow = receive; } });
  return obj;
}
