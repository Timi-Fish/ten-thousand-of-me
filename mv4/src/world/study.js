// 文房：笔架山和两支毛笔、砚台和墨、笔筒、水盂、梅瓶和那枝梅。各件器物的做法在 study/ 下，这里只管摆放。
import * as THREE from 'three';
import { PAL, STAGE } from './layout.js';
import { V3 } from './study/kit.js';
import { buildRest } from './study/mountain.js';
import { buildBrush, TONES } from './study/brush.js';
import { buildInkstone } from './study/inkstone.js';
import { buildWaterPot } from './study/waterpot.js';
import { buildBrushPot } from './study/pot.js';
import { buildVase } from './study/vase.js';
import { CLEAR, growBranches, buildBranches, sway } from './study/plum.js';
import { buildBlossoms } from './study/blossom.js';

const SHAFT_R = .3, SEAT_AT = 14.4;                                // 山上那两支笔：笔杆半径，搁点离笔尾的距离

// 把一支沿 +y 建好的笔放倒：搁点落在 seat.pos，笔尖朝 seat.dir，再绕笔杆转到挂绳朝下垂
function lay(brush, seat) {
  const q = new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), seat.dir);
  const down = new V3(0, -1, 0).addScaledVector(seat.dir, seat.dir.y).normalize().applyQuaternion(q.clone().invert());
  brush.group.quaternion.copy(q).multiply(new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), Math.atan2(-down.z, down.x)));
  brush.group.position.copy(seat.pos).addScaledVector(seat.dir, -SEAT_AT);
  return brush.group;
}

// 检查做工用的近看机位（预览里从 6 号起）
export const SHOTS = [
  { name: '近看：笔架山的釉', p: [-.5, 4.6, -8.5], q: [-2, 3, -18.5] },
  { name: '近看：蘸墨的笔毫', p: [7.6, 4.3, -11.2], q: [5, 3.1, -16.8] },
  { name: '近看：干的笔毫', p: [-11.6, 5.6, -11.4], q: [-9, 4.1, -16.8] },
  { name: '俯看：笔架山上的路和亭子', p: [-2.4, 7.2, -10.6], q: [-2, 2.6, -19] },
  { name: '近看：砚额和墨面', p: [11.2, 6.2, -9.2], q: [13.2, .6, -17.6] },
  { name: '近看：墨锭', p: [15.4, 3.6, -6.4], q: [15.7, .5, -12] },
  { name: '俯看：砚台', p: [13, 14, -15], q: [13, 0, -17.2] },
  { name: '近看：水盂', p: [4.2, 3.8, -11], q: [4.5, .9, -15.9] },
  { name: '近看：笔筒', p: [-15.5, 9, -9], q: [-21, 6.5, -21.5] },
  { name: '近看：梅瓶', p: [-19, 9, -2], q: [-27, 7.5, -15] },
  { name: '近看：梅花', p: [-1.2, 8.3, -8.6], q: [-2.6, 8.8, -14.4] },
  { name: '远看：整枝梅', p: [-8, 10, 26], q: [-10, 11, -15] },
  { name: '侧看：表演区上空的梅枝', p: [34, 9, -1], q: [0, 9, -6] },
];

export function build(scene) {
  const root = new THREE.Group(), time = { value: 0 };
  root.name = 'study';
  const rest = buildRest({ shaftR: SHAFT_R, seatAt: SEAT_AT });
  root.add(rest.group);
  root.add(lay(buildBrush({ r: SHAFT_R, kind: 'wet', tones: TONES.inked, count: 6000, skin: 'spotted', text: '萬毫齊力', trim: 'horn', cord: PAL.cinnabar, seed: 3 }), rest.seats[0]));
  root.add(lay(buildBrush({ r: SHAFT_R, kind: 'dry', tones: TONES.goat, count: 7000, skin: 'gold', text: '一口氣', trim: 'bone', cord: '#3F6E8C', seed: 5 }), rest.seats[1]));
  const vase = buildVase(), parts = [buildInkstone(), buildWaterPot(), buildBrushPot(), vase];
  parts.forEach(p => root.add(p.group));
  // 梅：枝和花用同一套轻轻摇晃的顶点程序，以瓶口为根
  const limbs = growBranches(), wrap = mat => sway(mat, time, vase.mouth), blossoms = buildBlossoms(limbs, wrap);
  root.add(buildBranches(limbs, wrap), blossoms.group);
  // 核对净空：表演区上空，枝和花的最低处都必须在 CLEAR 以上，否则会挡住小蟹和镜头
  const over = (x, z) => Math.hypot(x, z - STAGE.z) < STAGE.r;
  const lows = [...limbs.flatMap(l => l.pts.map((p, i) => ({ x: p.x, z: p.z, low: p.y - l.radii[i] }))), ...blossoms.reach].filter(s => over(s.x, s.z)).map(s => s.low);
  if (Math.min(...lows) < CLEAR) throw new Error(`梅枝在表演区上空低到了 y = ${Math.min(...lows).toFixed(2)}，必须不低于 ${CLEAR}`);
  scene.add(root);
  return { update(t) { time.value = t; parts.forEach(p => p.update(t)); }, branchTips: blossoms.tips };
}
