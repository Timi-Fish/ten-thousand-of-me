// 背景：案后的四季屏风、后墙和月洞窗、窗外的满月、夜空、薄云和一枝梅。
// 这里只做装配；各部分在 backdrop/ 下。导出 panels：四扇画心的位置和朝向，光点会落到画面上。
import * as THREE from 'three';
import { SCREEN, WALL } from './layout.js';
import { D } from './backdrop/util.js';
import { buildSky } from './backdrop/sky.js';
import { buildWall } from './backdrop/wall.js';
import { buildWindow } from './backdrop/window.js';
import { buildPlum } from './backdrop/plum.js';
import { buildScreen } from './backdrop/screen.js';
import { paintSeasons } from './backdrop/paintings.js';

export function build(scene, ctx) {
  const sky = buildSky(scene);
  buildWall(scene);
  buildWindow(scene);
  const plum = buildPlum(scene);
  const maxAniso = ctx.renderer.capabilities.getMaxAnisotropy();
  const paintings = paintSeasons(SCREEN.panels).map(canvas => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso;
    return t;
  });
  const { panels } = buildScreen(scene, paintings);
  return { panels, setDawn: sky.setDawn, setEye: sky.setEye, update(t) { sky.update(t); plum.update(t); } };
}

// 检查用的机位：正对每一扇画心（全幅、下半、上半），正对月洞窗，屏风的整体和细部
const facing = (p, dist, dy = 0, side = 0) => {
  const yaw = p.yaw * D, n = [Math.sin(yaw), 0, Math.cos(yaw)], r = [Math.cos(yaw), 0, -Math.sin(yaw)], q = [p.c[0] + r[0] * side, p.c[1] + dy, p.c[2] + r[2] * side];
  return { p: [q[0] + n[0] * dist, q[1], q[2] + n[2] * dist], q };
};
const [wx, wy] = WALL.window.c;
export const SHOTS = [
  ...SCREEN.panels.map(p => ({ name: `正对${p.season}：全幅`, ...facing(p, 42) })),                          // 6–9
  ...SCREEN.panels.map(p => ({ name: `正对${p.season}：下半`, ...facing(p, 21.5, -6.5) })),                   // 10–13
  ...SCREEN.panels.map(p => ({ name: `正对${p.season}：上半`, ...facing(p, 21.5, 6.5) })),                    // 14–17
  { name: '正对月洞窗', p: [wx, wy, -8], q: [wx, wy, WALL.z] },                                               // 18
  { name: '月洞窗近看', p: [wx - 4, wy - 3, -34], q: [wx + 1, wy + 1, WALL.z] },                              // 19
  { name: '屏风整体（平视）', p: [-14, 13, 22], q: [-14, 13, -33] },                                          // 20
  { name: '屏风顶部和眉板', p: [-12, 26, -18], q: [-13, 27.5, -33] },                                         // 21
  { name: '折缝和合页近看', p: [-13, 6, -24], q: [-14.4, 5.6, -31.2] },                                       // 22
  { name: '屏风下半（案后）', p: [-14, -22, 6], q: [-14, -26, -33] },                                         // 23
  { name: '屋子全貌', p: [6, 20, 60], q: [0, 8, -40] },                                                       // 24
  { name: '书案上看屏风（中景高度）', p: [-6, 3, 4], q: [-13, 9, -33] },                                      // 25
];
