// 几段表演共用的动作和飞行路线：小蟹朝外散开化成光、光点划一道弧飞到别处、屏风画心上的落点、四季的颜色。
import * as THREE from 'three';
import { TAU, D, lerp, prog, pulse, ease, rnd, bez, mix } from '../anim.js';
import { pose, MOOD } from '../crab.js';
import { STAGE, WALL, MOON_DIR } from '../world/layout.js';
import { UP } from './beat.js';

export const WARM = new THREE.Color(1.5, 1.05, .5);                   // 出发时所有光点都是这个暖色
// 四季的光色
export const TINT = { 春: new THREE.Color(1.9, .8, 1.2), 夏: new THREE.Color(.6, 1.9, .8), 秋: new THREE.Color(2, .9, .25), 冬: new THREE.Color(.8, 1.3, 2) };

// 「落向四方」：朝外一蹦一蹦地散开，蹦出 GO 秒后缩成一点（这时该有一个光点从它身上升起）。
// p：出发前的姿势；home：出发点 [x, z]；y0：出发时脚底的高度；v：出发后的秒数
export const GO = 1.15;
export function depart(p, home, y0, v) {
  const r0 = Math.hypot(home[0], home[1] - STAGE.z), out = [home[0] / r0, (home[1] - STAGE.z) / r0], r = r0 + 2.8 * v * v / (v + .4);
  return pose(p, UP, { x: out[0] * r, z: STAGE.z + out[1] * r, y: y0 * (1 - ease.io(prog(v, 0, .45))) + .5 * Math.abs(Math.sin(Math.PI * v * 2.8)),
    s: p.s * (1 - ease.in(prog(v, GO, GO + .14))), lean: 8 * out[0], mood: MOOD.joy, mouth: .6 });
}

// 一个光点从 from 飞到 to（都是 [x, y, z]）：launch 出发、land 落地；中途向上拱起 lift 高。返回 { at, k }：此刻的位置和飞了几成
export function arc(from, to, launch, land, t, lift) {
  const k = ease.io(prog(t, launch, land));
  return { at: bez(from, [lerp(from[0], to[0], .35), Math.max(from[1], to[1]) + lift, lerp(from[2], to[2], .35)], to, k), k };
}

// 月洞窗的窗口里的第 n 个点：分身从这里飞出去，纸和光从这里回来
export const windowSpot = n => { const a = TAU * rnd(n * 2.9), r = WALL.window.r * .7 * Math.sqrt(rnd(n * 4.3)); return [WALL.window.c[0] + r * Math.cos(a), WALL.window.c[1] + r * Math.sin(a), WALL.z]; };

// 「落向四方」：小蟹自己飞出窗外。先蹲一下起跳，划一道弧线穿过月洞窗，朝月亮飞远、缩成一点。
// p：出发前的姿势；home：出发点 [x, z]；y0：出发时脚底的高度；v：出发后的秒数；n：第几只（各走各的弧线）
export const FLY = 1.9, CROUCH = .25;                                 // 从起跳到穿过窗口用多久；起跳前蹲多久
const GONE = 1.5;                                                     // 飞了这么几成（1 是穿过窗口的那一刻）以后就看不见了
const AWAY = MOON_DIR;                                                // 出了窗口以后朝月亮去的方向
export function flyAt(home, y0, v, n) {                               // 这只小蟹出发 v 秒后飞到了哪：{ at, q 飞了几成（大于 1 是已经在窗外） }
  const q = (v - CROUCH) / FLY, gate = windowSpot(n), from = [home[0], y0, home[1]];
  if (q <= 0) return { at: from, q: 0 };
  if (q > 1) {                                                          // 出了窗口就各奔东西：朝月亮那边飞远的同时往四面散开、往下落（下山去），不在窗外停着
    const w = q - 1, a = TAU * rnd(n * 5.3 + .7), wide = 9 + 9 * rnd(n * 8.1);
    return { at: [gate[0] + AWAY.x * 20 * w + Math.cos(a) * wide * w, gate[1] + AWAY.y * 20 * w + Math.sin(a) * .5 * wide * w - 26 * w * w, gate[2] + AWAY.z * 20 * w], q };
  }
  return { at: bez(from, [lerp(from[0], gate[0], .35) + 5 * (rnd(n * 7.1) - .5), 8 + 6 * rnd(n * 3.3), lerp(from[2], gate[2], .3)], gate, q ** 1.5), q };   // 起步慢，越飞越快
}
export function flyOut(p, home, y0, v, n) {
  const { at, q } = flyAt(home, y0, v, n), up = ease.io(prog(q, 0, .25)), toward = Math.atan2(WALL.window.c[0] - home[0], WALL.z - home[1]) / D;
  const far = lerp(1, .55, ease.io(prog(q, .3, 1)));                    // 越靠近窗口越小（飞远了）：大家都往一个窗口挤，个头小了才不互相撞上
  return pose(p, { x: at[0], y: at[1], z: at[2], s: p.s * far * (1 - ease.io(prog(q, 1, GONE))), yaw: lerp(p.yaw, toward, up), pitch: 40 * up,     // 转向窗口，身子往前探着飞
    lean: 14 * Math.sin(v * 5 + n) * up, sq: -.28 * pulse(v, CROUCH * .6, CROUCH * .6) + .16 * up, aL: mix(p.aL, [20, .36, 0], up), aR: mix(p.aR, [20, .36, 0], up), mood: MOOD.joy, mouth: .7 });
}

// 屏风的四扇画心，加上各自朝屋里的法线和季节的光色。world.panels 的顺序是春夏秋冬
export const panelsOf = world => world.panels.map(p => { const out = p.right.clone().cross(p.up); return { ...p, out: out.z < 0 ? out.negate() : out, tint: TINT[p.season] }; });
// 画心上的第 n 个落点（取画心的下三分之二：从书案上看得到的那一段）
export const panelSpot = (panel, n) => panel.c.clone().addScaledVector(panel.right, (rnd(n * 2.9) - .5) * panel.w * .86).addScaledVector(panel.up, -13 + 19 * rnd(n * 4.3)).addScaledVector(panel.out, .2).toArray();
