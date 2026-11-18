// 背景模块共用的小工具：可复现的随机数序列、噪声、画布和贴图、给标准材质加料的钩子。
import * as THREE from 'three';
import { rnd } from '../../anim.js';

export const TAU = Math.PI * 2, D = Math.PI / 180;
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const smooth = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };

// 一串可复现的随机数：同一个 seed 每次给出同样的序列
export function stream(seed) {
  let i = 0;
  const next = () => rnd(seed * 17.31 + (i++) * 1.6180339);
  next.range = (a, b) => a + (b - a) * next();
  next.int = (a, b) => Math.floor(next.range(a, b + 1));
  next.pick = list => list[Math.floor(next() * list.length)];
  next.sign = () => (next() < .5 ? -1 : 1);
  next.bell = () => (next() + next() + next()) / 1.5 - 1;      // 大致钟形，落在 -1 到 1，中间多
  return next;
}

// 值噪声：一张 256×256 的随机格点表，双线性加平滑插值，周期 256
const N = 256, LATTICE = new Float32Array(N * N);
for (let i = 0; i < N * N; i++) LATTICE[i] = rnd(i * .7310585 + 5.3);
export function noise2(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  let fx = x - xi, fy = y - yi;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const x0 = xi & 255, x1 = (xi + 1) & 255, y0 = (yi & 255) * N, y1 = ((yi + 1) & 255) * N;
  const a = LATTICE[y0 + x0], b = LATTICE[y0 + x1], c = LATTICE[y1 + x0], d = LATTICE[y1 + x1];
  return a + (b - a) * fx + (c - a + (a - b - c + d) * fx) * fy;
}
// 分形噪声，结果大致在 0 到 1
export function fbm(x, y, octaves = 4, gain = .5) {
  let sum = 0, amp = .5, norm = 0;
  for (let o = 0; o < octaves; o++) { sum += amp * noise2(x, y); norm += amp; x = x * 2.03 + 17.1; y = y * 2.03 + 9.7; amp *= gain; }
  return sum / norm;
}

// 可以无缝平铺的分形噪声：x、y 的周期必须是 2 的幂（格点数），且最细一层不超过 256
export function tfbm(x, y, octaves = 4, gain = .5) {
  let sum = 0, amp = .5, norm = 0;
  for (let o = 0; o < octaves; o++) { sum += amp * noise2(x + o * 37, y + o * 71); norm += amp; x *= 2; y *= 2; amp *= gain; }
  return sum / norm;
}

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
// 逐像素生成一张画布：fn(x, y, out) 往 out 里写 0–255 的 r、g、b（可选第四项 a）
export function pixelCanvas(w, h, fn) {
  const c = makeCanvas(w, h), g = c.getContext('2d'), img = g.createImageData(w, h), d = img.data, out = [0, 0, 0, 255];
  for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i += 4) {
    out[3] = 255; fn(x, y, out);
    d[i] = out[0]; d[i + 1] = out[1]; d[i + 2] = out[2]; d[i + 3] = out[3];
  }
  g.putImageData(img, 0, 0);
  return c;
}
// 画布转贴图。color：是颜色（sRGB）还是数据（线性）；repeat：平铺次数
export function toTexture(c, { color = true, repeat = null, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = aniso;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}
export const hexToRgb = hex => { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
export const rgba = (hex, a) => { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; };
// 两个十六进制颜色之间取一点
export function mixHex(a, b, k) {
  const p = hexToRgb(a), q = hexToRgb(b);
  return '#' + p.map((v, i) => Math.round(lerp(v, q[i], k)).toString(16).padStart(2, '0')).join('');
}

// 给标准材质再乘一张按物体自身 xy 坐标铺开的大尺度明暗图（墙面的水渍、暗角这类不随细纹平铺的东西）。
// box：[x0, y0, 宽, 高]，明暗图覆盖的范围；图里 SHADE_UNIT 这个灰度是不变，更亮更暗按比例乘
export const SHADE_UNIT = 96;
export function multiplyShade(material, shadeTexture, box) {
  material.onBeforeCompile = shader => {
    shader.uniforms.shadeMap = { value: shadeTexture };
    shader.uniforms.shadeBox = { value: new THREE.Vector4(box[0], box[1], 1 / box[2], 1 / box[3]) };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform vec4 shadeBox;\nvarying vec2 vShadeUv;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvShadeUv = (position.xy - shadeBox.xy) * shadeBox.zw;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D shadeMap;\nvarying vec2 vShadeUv;')
      .replace('#include <map_fragment>', `#include <map_fragment>\ndiffuseColor.rgb *= texture2D(shadeMap, vShadeUv).rgb * ${(255 / SHADE_UNIT).toFixed(4)};`);
  };
  return material;
}

// 按位置重新铺 uv：沿 along 轴（0 x、1 y、2 z）是木纹的走向，另外两轴合成横向。scale：每个单位长度对应多少贴图
export function grainUV(geo, along, scale = .25, offset = 0) {
  const p = geo.attributes.position, uv = new Float32Array(p.count * 2), a = [0, 1, 2].filter(i => i !== along);
  for (let i = 0; i < p.count; i++) {
    const v = [p.getX(i), p.getY(i), p.getZ(i)];
    uv[i * 2] = (v[a[0]] + v[a[1]] * .83) * scale + offset;
    uv[i * 2 + 1] = v[along] * scale * .5 + offset * 1.7;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}
