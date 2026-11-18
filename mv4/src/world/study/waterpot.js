// 水盂：一只影青的小瓷盂，扁圆的肚子、小口，肚子上浮雕一圈仰莲瓣，凹处积釉，颜色略深。里面盛着水，口沿上搭一把小铜勺。
import * as THREE from 'three';
import { PROPS } from '../layout.js';
import { D, TAU } from '../../anim.js';
import { TOP, V3, smooth, turn, emboss, tube, mesh, soft, merge, moved } from './kit.js';
import { buildLiquid } from './liquid.js';

const PETALS = 12;
// 莲瓣的浮雕：肚子上一圈尖头朝上的瓣，瓣面微鼓、瓣心一道棱，瓣与瓣之间是凹下去的沟
function petal(a, y) {
  const v = (y - .18) / .98;                                        // 瓣从肚子下部长到肩上
  const u = Math.abs(((a / TAU * PETALS) % 1 + 1) % 1 - .5) * 2, half = Math.sqrt(Math.max(0, 1 - Math.max(0, v) ** 2.4)) * .9;   // u：离瓣心多远（0 在瓣心，1 在瓣缝）
  const inside = smooth(half + .09, half - .09, u) * smooth(-.04, .03, v) * smooth(1.03, .97, v), k = u / Math.max(half, .05);
  return -.014 + inside * (.042 * (1 - .5 * Math.min(1, k) ** 2) + .012 * Math.exp(-((u / .06) ** 2)));
}

export function buildWaterPot() {
  const group = new THREE.Group();
  const outer = turn([[[.6, 0], [.66, 0], [.69, .07]], [[.69, .07], [1.02, .2], [1.31, .62], [1.29, 1.0], [1.02, 1.3], [.8, 1.43], [.76, 1.5]]], 192, 8);
  const pool = new THREE.Color('#8FC2BE'), glaze = new THREE.Color('#E9F1EE'), c = new THREE.Color();
  emboss(outer, petal, (a, y, v, off) => c.copy(glaze).lerp(pool, Math.min(1, Math.max(0, (.016 - off) / .03))).clone());
  const porcelain = extra => soft({ color: '#FFFFFF', roughness: .64, rim: .36, rimColor: '#D6E6FF', rimPow: 2.4, emissive: '#22343A', emissiveIntensity: .3, albedo: 'col *= .94 + .1 * fbm(p * 2.);', ...extra });
  group.add(mesh(outer, porcelain({ vertexColors: true })));
  // 口沿和里壁：里面也上了釉
  const inner = turn([[[.76, 1.5], [.8, 1.58], [.74, 1.62], [.66, 1.58]], [[.66, 1.58], [.7, 1.42], [1.14, 1.0], [1.2, .62], [.9, .32], [0, .26]]], 64, 8);
  group.add(mesh(inner, porcelain({ color: '#E3EEEA' })));
  const water = buildLiquid(new THREE.CircleGeometry(1.12, 48).rotateX(-Math.PI / 2).translate(0, 1.12, 0), { centre: new V3(-.24, 1.12, -.12), reach: .42, base: '#0C1A24', sky: '#3A4490', ripple: .008 });
  group.add(water.mesh);
  // 铜勺：勺头浸在水里，细长的柄斜搭在口沿上，柄尾卷成一个小如意头
  const bronze = soft({
    color: '#8A6A3C', roughness: .55, metalness: .25, rim: .35, rimColor: '#E8D6A8',
    albedo: 'float rust = smoothstep(.5, .72, fbm(p * 5. + 3.)); col = mix(col, vec3(.25, .47, .40), rust * .7); col *= .8 + .4 * fbm(p * 11.); gRough = 1. + .5 * rust;',
  });
  const handle = [];
  for (let i = 0; i <= 30; i++) {
    const t = i / 30, curl = Math.max(0, t - .86) / .14;              // 最后一小段向下卷
    handle.push(new V3(.12 + t * 1.75 - curl * curl * .1, .1 + .75 * smooth(0, .3, t) + .45 * t - Math.sin(curl * 4.6) * .1 * curl, 0));   // 先陡陡地升到口沿的高度，再斜着伸出去
  }
  const spoon = merge([
    tube(handle, handle.map((_, i) => .05 - .018 * Math.sin(i / 30 * Math.PI)), 8),
    moved(new THREE.SphereGeometry(.3, 20, 10, 0, TAU, Math.PI / 2, Math.PI / 2).scale(1, .62, .86), -.1, .19, 0),
    moved(new THREE.TorusGeometry(.3, .022, 6, 24).rotateX(Math.PI / 2).scale(1, 1, .86), -.1, .19, 0),
    moved(new THREE.SphereGeometry(.075, 10, 8), handle[30].x, handle[30].y, 0),
  ]);
  const ladle = mesh(spoon, bronze);
  ladle.material.side = THREE.DoubleSide;
  ladle.position.set(.3, .9, .22);                                    // 勺头靠在盂里的一侧，把水面中央让给月影
  ladle.rotation.y = -36 * D;
  group.add(ladle);
  const [cx, cz] = PROPS.waterPot.c;
  group.position.set(cx, TOP, cz - .35);                              // 往后让一点，不压到毡的边
  group.rotation.y = 20 * D;
  return { group, update: t => water.setTime(t) };
}
