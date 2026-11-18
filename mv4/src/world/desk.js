// 书案：案面、毡、宣纸和纸上的墨迹、两条镇尺、印泥盒和印、一摞线装书和几卷卷轴。各样东西的做法在 desk/ 下。
import * as THREE from 'three';
import { setMaxAniso } from './desk/kit.js';
import { buildPaper } from './desk/paper.js';
import { buildTabletop } from './desk/tabletop.js';
import { buildWeights } from './desk/weights.js';
import { buildSeal } from './desk/seal.js';
import { buildBooks } from './desk/books.js';
import { buildScrolls } from './desk/scrolls.js';

// 近看做工的检查机位（预览工具里从 6 号起）
export const SHOTS = [
  { name: '书案：俯看整张纸', p: [0, 40, 2], q: [0, 0, -1] },
  { name: '书案：贴着纸面看字', p: [1.6, 1.1, 4.2], q: [-.6, 0, -.6] },
  { name: '书案：斜看一列字', p: [3.2, 2.4, 2.2], q: [1.2, 0, -1.4] },
  { name: '书案：落款和朱印', p: [-6.2, 2.6, 1.6], q: [-9, 0, -3.2] },
  { name: '书案：左镇尺', p: [-6.6, 2.5, 3.4], q: [-11.2, .7, -.6] },
  { name: '书案：右镇尺的端头', p: [7.6, 2.2, 9], q: [11.2, .7, 4.6] },
  { name: '书案：印泥盒和印', p: [-7.2, 3.2, -10.4], q: [-9.6, .7, -15.4] },
  { name: '书案：线装书和卷轴', p: [15.5, 6, -9.5], q: [24.5, 1.6, -21.5] },
  { name: '书案：翘起的纸角', p: [-7.5, 1.5, 15.2], q: [-11.2, .2, 10.4] },
  { name: '书案：案面前沿', p: [16, 7, 32], q: [2, -3, 12] },
  { name: '书案：正上方看几个字的笔墨', p: [-2.6, 7.5, 1.4], q: [-2.6, 0, 1] },
  { name: '书案：正上方看题目', p: [8.6, 9, -8.2], q: [8.6, 0, -8.6] },
];

export function build(scene, ctx) {
  setMaxAniso(ctx.renderer);
  const root = new THREE.Group(), paper = buildPaper(), weights = buildWeights();
  root.name = 'desk';
  root.add(buildTabletop(), paper.group, weights.group, buildSeal(), buildBooks(), buildScrolls());
  scene.add(root);
  return { update(t) { paper.update(t); }, perches: weights.perches };
}
