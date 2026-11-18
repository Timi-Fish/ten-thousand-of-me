// 从高度场烘出来给着色器用的量：凹凸、四季各自的大尺度山影，和把数组装成贴图的小工具。
import * as THREE from 'three';
import { clamp } from './noise.js';
import { SEASONS, SEASON_NAMES } from './seasons.js';

// 凹凸：每个点比周围（(2R+1) 格见方的平均）高出多少，除以 norm 后截到 ±1。山脊为正，沟壑为负。
// 默认 15 个单位见方（石头的块面、小沟）；大远景用的是一百来个单位见方（整道山脊、整条侧谷）
export function cavity(g, H, R = 5, norm = 8) {
  const tmp = new Float32Array(H.length), out = new Float32Array(H.length);
  for (let j = 0; j < g.nz; j++) for (let i = 0; i < g.nx; i++) { let s = 0; for (let a = -R; a <= R; a++) s += H[j * g.nx + clamp(i + a, 0, g.nx - 1)]; tmp[j * g.nx + i] = s / (2 * R + 1); }
  for (let j = 0; j < g.nz; j++) for (let i = 0; i < g.nx; i++) { let s = 0; for (let a = -R; a <= R; a++) s += tmp[clamp(j + a, 0, g.nz - 1) * g.nx + i]; out[j * g.nx + i] = clamp((H[j * g.nx + i] - s / (2 * R + 1)) / norm, -1, 1); }
  return out;
}

// 四季的山影：从每个点朝日（月）走一条线，看被山挡了多少；差一点被挡的地方算半影。四个季节各占一个通道
export function bakeShadows(g, heightAt) {
  const w = Math.ceil(g.nx / 2), h = Math.ceil(g.nz / 2), data = new Uint8Array(w * h * 4);
  SEASON_NAMES.forEach((name, c) => {
    const [dx, dy, dz] = new THREE.Vector3(...SEASONS[name].sunDir).normalize().toArray();
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const x = g.x0 + i * 2 * g.cell, z = g.z0 + j * 2 * g.cell, y = heightAt(x, z) + 1.5;
      let lit = 1;
      for (let t = 5; t < 2600 && lit > 0; t *= 1.13) {
        const ry = y + dy * t;
        if (ry > 620) break;
        lit = Math.min(lit, 9 * (ry - heightAt(x + dx * t, z + dz * t)) / t);
      }
      data[(j * w + i) * 4 + c] = 255 * clamp(lit);
    }
  });
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
  return tex;
}

export function floatTexture(values, w, h, channels) {
  const half = new Uint16Array(values.length);
  for (let i = 0; i < values.length; i++) half[i] = THREE.DataUtils.toHalfFloat(values[i]);
  const tex = new THREE.DataTexture(half, w, h, { 1: THREE.RedFormat, 2: THREE.RGFormat, 4: THREE.RGBAFormat }[channels], THREE.HalfFloatType);
  tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
  return tex;
}
