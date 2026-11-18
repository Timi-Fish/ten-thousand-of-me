// 灯火：这个世界的空气和那团火。油灯和火苗、火光、香炉和一缕烟、月光的光柱和浮尘、飘落的梅瓣。
// 各部分在 glow/ 下，这里只负责按顺序装起来、每帧把时间交给它们。
// 透明的东西都不写深度、照常做深度测试，按固定的先后画：光柱 10、灯的光晕 11、烟 13、火苗和灯花 14、浮尘 15（都排在别的模块的东西之后）。
import * as THREE from 'three';
import { buildLamp } from './glow/lamp.js';
import { buildFlame } from './glow/flame.js';
import { buildCenser } from './glow/censer.js';
import { buildSmoke } from './glow/smoke.js';
import { buildMoonbeam } from './glow/moonbeam.js';
import { buildDust } from './glow/dust.js';
import { buildPetals } from './glow/petals.js';

// 检查用的近看机位（预览工具里从 6 号起）
export const SHOTS = [
  { name: '灯火：油灯全貌', p: [-8.2, 4.2, -1.2], q: [-14, 4.1, -13] },
  { name: '灯火：火苗特写', p: [-12.4, 6.5, -8.4], q: [-14, 7, -13] },
  { name: '灯火：俯看灯盏', p: [-10.6, 10.6, -8.2], q: [-14, 6.1, -13] },
  { name: '灯火：灯座和灯柱', p: [-11.6, 1.5, -8.6], q: [-14, 1.9, -13] },
  { name: '灯火：香炉和烟', p: [8.5, 3.2, 3], q: [14.2, 6.2, -7.5] },
  { name: '灯火：香炉特写', p: [12.4, 3.5, -1.2], q: [16, 1.8, -7.5] },
  { name: '灯火：逆光看浮尘', p: [-4, 1.4, 9], q: [6, 6, -16] },
  { name: '灯火：梅瓣飘落', p: [2, 2.6, 12], q: [-9, 7, -6] },
  { name: '灯火：高处总览', p: [0, 26, 34], q: [0, 3, -10] },
  { name: '灯火：纸上的梅瓣', p: [-5.5, 1.1, 2.6], q: [-7.5, .1, -2.5] },
];

export function build(scene, ctx) {
  const root = new THREE.Group(); root.name = 'glow';
  scene.add(root);
  const warm = { value: 1 };                                         // 灯火此刻的亮度，器物上反上来的暖光、灯旁的浮尘都跟着它闪
  const gain = { value: 1 };                                         // 表演给的火势：1 正常，0 熄灭
  const lamp = buildLamp(root, warm), censer = buildCenser(root);
  const parts = [
    buildFlame(root, { ...lamp, center: lamp.flame, warm, gain }), buildSmoke(root, censer.vent), buildMoonbeam(root),
    buildDust(root, lamp.flame, warm), buildPetals(root, ctx.branchTips),
  ];
  return { update(t) { parts.forEach(p => p.update(t)); }, flame: lamp.flame, wick: lamp.wick, setLamp(k) { gain.value = k; } };
}
