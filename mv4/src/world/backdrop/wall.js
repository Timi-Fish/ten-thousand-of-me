// 后墙和屋子的壳：带月洞的粉墙（细的灰泥肌理 + 大尺度的水渍和明暗）、墙边的木柱和额枋、地面、两侧的暗墙。
// 屋里的暗在这里定调：近窗的墙被月色映亮一圈，屏风后面和墙脚沉进冷靛色里，但留着层次。
import * as THREE from 'three';
import { DESK, WALL, SCREEN } from '../layout.js';
import { tfbm, fbm, pixelCanvas, toTexture, multiplyShade, SHADE_UNIT, grainUV, clamp, smooth, stream } from './util.js';

export const WALL_THICK = 3.2;                                   // 墙厚：月洞的洞壁有这么深
const X0 = -96, X1 = 96, Y0 = DESK.floor, Y1 = 76;                // 墙面的范围

// 灰泥的细纹：可平铺。斑驳的底色、细颗粒、抹子留下的弧形刮痕、几道发丝一样的裂纹
function plasterCanvas(size = 1024) {
  const rs = stream(7), arcs = [], cracks = [];
  for (let i = 0; i < 26; i++) arcs.push({ x: rs() * size, y: rs() * size, r: rs.range(60, 220), w: rs.range(5, 16), a: rs.range(-.9, .9) });
  for (let i = 0; i < 5; i++) cracks.push({ x: rs() * size, y: rs() * size, dir: rs.range(-.5, .5) + (rs() < .5 ? 0 : 1.57), len: rs.range(120, 320), seed: rs() * 50 });
  const k = 1 / size;
  return pixelCanvas(size, size, (x, y, out) => {
    let v = .5 + .46 * (tfbm(x * k * 8, y * k * 8, 5) - .5) + .2 * (tfbm(x * k * 64 + 9, y * k * 64, 3) - .5);
    for (const a of arcs) {                                          // 抹痕：一段弧上略亮略暗的条
      let dx = x - a.x, dy = y - a.y;
      dx -= size * Math.round(dx / size); dy -= size * Math.round(dy / size);
      const d = Math.hypot(dx, dy) - a.r, along = Math.atan2(dy, dx) - a.a;
      if (Math.abs(d) < a.w && Math.abs(along) < .7) v += .035 * Math.cos(d / a.w * 1.57) * (1 - Math.abs(along) / .7) * (a.w > 10 ? 1 : -1);
    }
    for (const c of cracks) {                                        // 裂纹：沿一个方向走、带一点抖的细线
      let dx = x - c.x, dy = y - c.y;
      dx -= size * Math.round(dx / size); dy -= size * Math.round(dy / size);
      const s = dx * Math.cos(c.dir) + dy * Math.sin(c.dir), n = -dx * Math.sin(c.dir) + dy * Math.cos(c.dir);
      if (s > 0 && s < c.len) { const off = n - 14 * (fbm(s * .03 + c.seed, c.seed, 3) - .5); v -= .16 * smooth(1.6, .3, Math.abs(off)) * Math.sin(s / c.len * 3.14); }
    }
    v = clamp(v, 0, 1);
    out[0] = 150 + 70 * v; out[1] = 146 + 70 * v; out[2] = 146 + 68 * v;
  });
}

// 大尺度的明暗（SHADE_UNIT 灰是不变）：月洞周围一圈被月色映亮，墙脚和屏风背后沉下去，窗下有几道往下淌的水渍
function shadeCanvas(w = 768, h = 608) {
  const [cx, cy] = WALL.window.c, R = WALL.window.r, rs = stream(19), drips = [];
  for (let i = 0; i < 9; i++) drips.push({ x: cx + rs.range(-R, R) * .95, len: rs.range(8, 30), w: rs.range(.5, 1.8), k: rs.range(.05, .14) });
  const screenRight = Math.max(...SCREEN.panels.map(p => p.c[0])) + 4;
  return pixelCanvas(w, h, (px, py, out) => {
    const x = X0 + (X1 - X0) * px / w, y = Y1 - (Y1 - Y0) * py / h, d = Math.hypot(x - cx, y - cy) - R;
    let v = 1;
    v *= .62 + .38 * smooth(-34, 14, y);                             // 越往墙脚越暗
    v *= .74 + .26 * smooth(screenRight - 14, screenRight + 10, x);  // 屏风背后一片更暗
    v *= 1 - .22 * smooth(52, 76, y);                                // 高处靠近屋顶也暗下去
    const spill = .6 * Math.exp(-Math.max(d, 0) / 7) + .4 * Math.exp(-Math.max(d, 0) / 26);   // 月洞外沿的月色：贴着窗一圈亮，再远远地淡开
    v *= 1 + 1.25 * spill;
    v *= .82 + .36 * fbm(x * .05 + 3, y * .05, 4);                   // 大块的潮斑
    let stain = 0;
    for (const s of drips) {
      const top = cy - Math.sqrt(Math.max(R * R - (s.x - cx) ** 2, 0)) - .8, t = (top - y) / s.len;
      if (t > 0 && t < 1) stain += s.k * smooth(s.w, 0, Math.abs(x - s.x + .5 * (fbm(y * .2, s.x, 2) - .5))) * (1 - t) ** 1.3;
    }
    v *= 1 - stain;
    const cool = .8 * spill;                                         // 被月色映到的地方偏冷
    out[0] = clamp(SHADE_UNIT * v * (1 - .12 * cool), 0, 255); out[1] = clamp(SHADE_UNIT * v * (1 - .04 * cool), 0, 255); out[2] = clamp(SHADE_UNIT * v * (1 + .12 * cool), 0, 255);
  });
}

// 木柱的纹理：竖向的木纹，暗红褐色
function timberCanvas(size = 512) {
  const k = 1 / size;
  return pixelCanvas(size, size, (x, y, out) => {
    const streak = tfbm(x * k * 32, y * k * 2, 4), pore = tfbm(x * k * 128 + 5, y * k * 8, 2);
    const v = clamp(.25 + .9 * (streak - .35) - .25 * smooth(.62, .8, pore));
    out[0] = 70 + 84 * v; out[1] = 44 + 48 * v; out[2] = 46 + 38 * v;
  });
}

export function buildWall(scene) {
  const [cx, cy] = WALL.window.c, R = WALL.window.r, group = new THREE.Group();
  scene.add(group);

  // 墙面：一个开了圆洞的长方形
  const shape = new THREE.Shape([new THREE.Vector2(X0, Y0), new THREE.Vector2(X1, Y0), new THREE.Vector2(X1, Y1), new THREE.Vector2(X0, Y1)]);
  const hole = new THREE.Path(); hole.absarc(cx, cy, R, 0, Math.PI * 2, true); shape.holes.push(hole);
  const grain = plasterCanvas(), tile = 30;
  const plaster = multiplyShade(new THREE.MeshStandardMaterial({
    map: toTexture(grain, { repeat: [1 / tile, 1 / tile] }), bumpMap: toTexture(grain, { color: false, repeat: [1 / tile, 1 / tile] }), bumpScale: .5, roughness: .96, color: '#B8B2B8',
  }), toTexture(shadeCanvas(), { color: false }), [X0, Y0, X1 - X0, Y1 - Y0]);
  plaster.map.flipY = plaster.bumpMap.flipY = false;
  const wall = new THREE.Mesh(new THREE.ShapeGeometry(shape, 128), plaster);
  wall.position.z = WALL.z;
  group.add(wall);

  // 木构：窗右侧一根半露的圆柱，屏风背后一根；高处一道额枋，墙脚一道地栿。柱下有石础
  const timber = new THREE.MeshStandardMaterial({ map: toTexture(timberCanvas(), { repeat: [1, 1] }), color: '#8E7C8C', roughness: .7 });
  const stone = new THREE.MeshStandardMaterial({ color: '#4A4A68', roughness: .9 });
  for (const x of [40.5, -47]) {
    const col = new THREE.Mesh(grainUV(new THREE.CylinderGeometry(1.9, 2.05, Y1 - Y0, 28, 1, true), 1, .12), timber);
    col.position.set(x, (Y0 + Y1) / 2, WALL.z + .5);
    const base = new THREE.Mesh(new THREE.LatheGeometry([[2.9, 0], [3.0, .6], [2.6, 1.5], [2.25, 2.1], [2.1, 2.4]].map(p => new THREE.Vector2(...p)), 28), stone);
    base.position.set(x, Y0, WALL.z + .5);
    group.add(col, base);
  }
  const beam = new THREE.Mesh(grainUV(new THREE.BoxGeometry(X1 - X0, 4.2, 1.4), 0, .12), timber);
  beam.position.set(0, 46, WALL.z + .7);
  const beamLip = new THREE.Mesh(grainUV(new THREE.BoxGeometry(X1 - X0, .7, 1.9), 0, .12), timber);
  beamLip.position.set(0, 43.6, WALL.z + .95);
  const sill = new THREE.Mesh(grainUV(new THREE.BoxGeometry(X1 - X0, 3, 1.2), 0, .12), timber);
  sill.position.set(0, Y0 + 1.5, WALL.z + .6);
  group.add(beam, beamLip, sill);

  // 屋子的壳：地面和两侧的墙，都是很深的冷色，只为镜头万一扫到时不露出空白
  const dark = new THREE.MeshStandardMaterial({ color: '#34325C', roughness: 1 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, 110), dark);
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, Y0, WALL.z + 55);
  group.add(floor);
  for (const s of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.PlaneGeometry(110, Y1 - Y0), dark);
    side.rotation.y = -s * Math.PI / 2; side.position.set(s * X1, (Y0 + Y1) / 2, WALL.z + 55);
    group.add(side);
  }
  return { group };
}
