// 落地的小动静：外景里小蟹每一蹦落地，脚边带起一小圈东西——土路上是尘，雪地上是雪沫，雨天的桥面上是水花，秋天的石阶上卷起两片落叶，
// 礁石上是一点水沫。有了它，小蟹才像是真的踩在这块地上。
// 用法和光点、薄纸一样「每帧现说」：puffs.put(落点, 落地后过了几秒, 种类, …)，每帧开始时清空。
import * as THREE from 'three';
import { rnd, lerp } from '../anim.js';

const CAP = 1400, LIFE = .5, TAU = Math.PI * 2;
// 每一种：颗粒的颜色、最浓时有多不透、几颗、往外散多远、往上扬多高、落回来有多快（都按小蟹的个头算）、颗粒多大、有没有贴地荡开的一圈、带几片翻飞的叶子
export const PUFF = {
  dust: { tint: [.78, .70, .60], alpha: .46, grains: 9, out: .95, up: .30, fall: .25, size: .30, ring: 0, flakes: 0 },
  snow: { tint: [.96, .98, 1.04], alpha: .82, grains: 12, out: .9, up: .8, fall: 1.05, size: .2, ring: 0, flakes: 0 },
  splash: { tint: [.82, .93, .98], alpha: .58, grains: 10, out: .75, up: 1.0, fall: 1.5, size: .09, ring: 1, flakes: 0 },
  leaf: { tint: [.80, .66, .50], alpha: .28, grains: 6, out: .9, up: .26, fall: .2, size: .28, ring: 0, flakes: 3 },
  spray: { tint: [.98, .96, .94], alpha: .5, grains: 7, out: .6, up: .7, fall: 1.3, size: .08, ring: 0, flakes: 0 },
};
const FLAKE = [[1.1, .42, .12], [1.0, .62, .16], [.86, .26, .10]];      // 落叶的几种颜色

export function buildPuffs() {
  // 每个实例：aAt 中心；aLook = [大小, 不透明度, 形状（0 一团软的圆，1 贴地的一圈，2 一片叶子）, 转角]；颜色
  const geo = new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry(2, 2));
  const at = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 3), 3), look = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 4), 4), tint = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 3), 3);
  geo.setAttribute('aAt', at); geo.setAttribute('aLook', look); geo.setAttribute('aTint', tint);
  const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    vertexShader: /* glsl */`
      attribute vec3 aAt, aTint; attribute vec4 aLook;
      varying vec2 vP; varying vec3 vTint; varying vec3 vLook;
      void main() {
        vP = position.xy; vTint = aTint; vLook = aLook.yzw;
        float c = cos(aLook.w), s = sin(aLook.w);
        vec2 q = vec2(c * position.x - s * position.y, s * position.x + c * position.y) * aLook.x;
        if (aLook.z > .5 && aLook.z < 1.5) gl_Position = projectionMatrix * viewMatrix * vec4(aAt + vec3(q.x, 0., q.y), 1.);   // 贴地的一圈：平躺在地上
        else { vec4 mv = viewMatrix * vec4(aAt, 1.); mv.xy += q; gl_Position = projectionMatrix * mv; }                     // 其余的朝着镜头
      }`,
    fragmentShader: /* glsl */`
      varying vec2 vP; varying vec3 vTint; varying vec3 vLook;
      void main() {
        float r = length(vP), a;
        if (vLook.y < .5) a = smoothstep(1., .25, r);                                           // 一团软的圆
        else if (vLook.y < 1.5) a = smoothstep(1., .9, r) * smoothstep(.72, .86, r);            // 一圈
        else a = smoothstep(1., .9, abs(vP.x) * 1.9 + abs(vP.y) * abs(vP.y) * 1.1) ;            // 一片两头尖的叶子
        if (a * vLook.x < .004) discard;
        gl_FragColor = vec4(vTint, a * vLook.x);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  mesh.frustumCulled = false; mesh.renderOrder = 18;
  let count = 0;
  const add = (x, y, z, size, alpha, shape, turn, color, light) => {
    if (count >= CAP) throw new Error(`同屏落地的颗粒超过了 ${CAP} 个`);
    at.setXYZ(count, x, y, z); look.setXYZW(count, size, alpha, shape, turn); tint.setXYZ(count, color[0] * light, color[1] * light, color[2] * light);
    count++;
  };
  return {
    mesh,
    clear() { count = 0; },
    // spot 落点 [x, y, z]；age 落地后过了几秒（不在 0 到 LIFE 之间就不画）；kind 是 PUFF 里的一种；s 小蟹的个头；
    // power 这一下落得多重（0 到 1 多，落差大的重）；light 这里有多亮（雪夜给小一点，颗粒不会在暗处发白）
    put(spot, age, kind, { s = 1, power = .5, light = 1 } = {}) {
      if (age < 0 || age >= LIFE) return;
      const k = age / LIFE, fade = (1 - k) ** 1.6, seed = spot[0] * 13.1 + spot[2] * 7.7, force = .7 + .6 * power;
      for (let j = 0; j < kind.grains; j++) {
        const a = TAU * rnd(seed + j * 3.3), far = (.45 + .75 * rnd(seed + j * 5.1)) * kind.out * force * s * (1 - (1 - k) ** 2.2);
        const high = (.5 + .8 * rnd(seed + j * 7.9)) * force * s * (kind.up * 2 * k - kind.fall * k * k * 2);
        add(spot[0] + Math.cos(a) * far, spot[1] + .06 * s + Math.max(0, high), spot[2] + Math.sin(a) * far,
          kind.size * s * (.7 + .6 * rnd(seed + j * 2.1)) * lerp(.6, 1.5, k), kind.alpha * fade, 0, 0, kind.tint, light);
      }
      if (kind.ring) add(spot[0], spot[1] + .03, spot[2], s * lerp(.5, 1.5, 1 - (1 - k) ** 2) * force, .5 * fade, 1, 0, kind.tint, light);
      for (let j = 0; j < kind.flakes; j++) {                             // 被带起来的落叶：打着转飞出去，落得慢
        const a = TAU * rnd(seed + j * 9.7 + 1.3), far = (.6 + .9 * rnd(seed + j * 4.3)) * force * s * (1 - (1 - k) ** 2);
        add(spot[0] + Math.cos(a) * far, spot[1] + .1 * s + s * (1.5 * k - 1.1 * k * k) * (.5 + .6 * rnd(seed + j * 6.1)), spot[2] + Math.sin(a) * far,
          .2 * s, Math.min(1, 3 * (1 - k)), 2, age * (7 + 5 * rnd(seed + j)) + j, FLAKE[j % FLAKE.length], light);
      }
    },
    // 每帧摆完以后调：把这一帧的颗粒交给显卡
    commit() { geo.instanceCount = count; at.needsUpdate = look.needsUpdate = tint.needsUpdate = true; },
  };
}
