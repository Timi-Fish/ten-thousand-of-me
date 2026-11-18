// 月洞窗：磨砖对缝的圆窗套（带洞壁），一圈冰裂纹的木花格，花格中间留一个空圆给月亮。
// 冰裂纹的几处交点上嵌一朵小梅花（冰梅纹），呼应窗外那枝梅。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { WALL } from '../layout.js';
import { WALL_THICK } from './wall.js';
import { tfbm, pixelCanvas, toTexture, grainUV, stream, clamp, smooth, TAU } from './util.js';

export const CLEAR_R = 9.1;                                       // 花格中间空圆的半径。影片里任何机位看过去，月亮都落在这个圆里
const LATTICE_Z = -1.5, RIM_R = 13.5;                             // 花格所在的深度（墙面往里）、花格外圈的半径

// 把一个凸多边形沿一条直线切成两半，返回两半和切口线段
function cut(poly, px, py, dx, dy) {
  const side = poly.map(([x, y]) => (x - px) * dy - (y - py) * dx), a = [], b = [], chord = [];
  for (let i = 0; i < poly.length; i++) {
    const j = (i + 1) % poly.length, p = poly[i], q = poly[j];
    (side[i] >= 0 ? a : b).push(p);
    if (side[i] >= 0 !== side[j] >= 0) {
      const t = side[i] / (side[i] - side[j]), m = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
      a.push(m); b.push(m); chord.push(m);
    }
  }
  return { a, b, chord };
}
const area = poly => Math.abs(poly.reduce((s, p, i) => { const q = poly[(i + 1) % poly.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;

// 冰裂纹：先用几根斜的棂条把圆环分成宽窄不一的几段，每段再切一两刀——第一刀斜着顺环走，第二刀横过较大的那块。
// 每次的切口是一根棂条，一头顶在别的棂条上，形成丁字交点。r0、r1 是圆环的内外半径
function iceCrack(r0, r1, count, seed) {
  const rs = stream(seed), bars = [], at = (r, a) => [r * Math.cos(a), r * Math.sin(a)];
  const edges = Array.from({ length: count }, (_, i) => { const a = (i + rs.range(-.22, .22)) / count * TAU, lean = rs.range(.1, .26) * rs.sign(); return [a - lean, a + lean]; });
  for (let i = 0; i < count; i++) {
    const [a0, a1] = edges[i], [b0, b1] = edges[(i + 1) % count].map(a => (i === count - 1 ? a + TAU : a));
    bars.push([at(r0 * .86, a0), at(r1 * 1.08, a1)]);
    const cell = [at(r0 * .86, a0), at(r1 * 1.08, a1), at(r1 * 1.08, (a1 + b1) / 2), at(r1 * 1.08, b1), at(r0 * .86, b0)];      // 这一段（略大于圆环，棂条两头都伸进木环里）
    const mid = (a0 + a1 + b0 + b1) / 4, c = at((r0 + r1) / 2 + rs.range(-.5, .5), mid + rs.range(-.04, .04)), slant = mid + Math.PI / 2 + rs.range(.38, .7) * rs.sign();
    const first = cut(cell, c[0], c[1], Math.cos(slant), Math.sin(slant));
    if (first.chord.length !== 2) continue;
    bars.push(first.chord);
    if (b0 - a0 < TAU / count * .8) continue;                         // 窄的一段切一刀就够
    const big = area(first.a) > area(first.b) ? first.a : first.b, g = big.reduce((s, p) => [s[0] + p[0] / big.length, s[1] + p[1] / big.length], [0, 0]);
    const across = Math.atan2(g[1], g[0]) + rs.range(-.5, .5), second = cut(big, g[0], g[1], Math.cos(across), Math.sin(across));
    if (second.chord.length === 2) bars.push(second.chord);
  }
  return bars;
}
// 只留下线段落在圆环（r0 到 r1）里的部分；穿过中间空圆的会断成两截
function clipToRing([p, q], r0, r1) {
  const dx = q[0] - p[0], dy = q[1] - p[1], A = dx * dx + dy * dy, B = 2 * (p[0] * dx + p[1] * dy), hit = r => {
    const disc = B * B - 4 * A * (p[0] * p[0] + p[1] * p[1] - r * r);
    return disc <= 0 ? null : [(-B - Math.sqrt(disc)) / (2 * A), (-B + Math.sqrt(disc)) / (2 * A)];
  };
  const out = hit(r1), inn = hit(r0);
  if (!out) return [];
  const t0 = Math.max(0, out[0]), t1 = Math.min(1, out[1]), spans = [];
  if (t0 >= t1) return [];
  if (!inn || inn[1] <= t0 || inn[0] >= t1) spans.push([t0, t1]);
  else { if (inn[0] > t0) spans.push([t0, inn[0]]); if (inn[1] < t1) spans.push([inn[1], t1]); }
  // openP、openQ：这一头是不是切口原本的端点（顶在别的棂条上），而不是被圆环截断的
  return spans.map(([a, b]) => ({ p: [p[0] + dx * a, p[1] + dy * a], q: [p[0] + dx * b, p[1] + dy * b], openP: a === 0, openQ: b === 1 }));
}

// 磨砖窗套的贴图：绕一圈 44 块楔形砖，每块深浅略有不同，砖缝是细的浅线
function brickCanvas(w = 2048, h = 128, count = 44) {
  const rs = stream(23), tone = Array.from({ length: count }, () => rs.range(-.09, .09));
  return pixelCanvas(w, h, (x, y, out) => {
    const u = x / w * count, i = Math.floor(u), f = u - i, joint = smooth(.035, .012, Math.min(f, 1 - f));
    let v = .5 + tone[i] + .22 * (tfbm(x / w * 128, y / h * 8, 4) - .5) + .1 * (tfbm(x / w * 256 + 3, y / h * 32, 2) - .5);
    v = clamp(v + .22 * joint, 0, 1);
    out[0] = 92 + 66 * v; out[1] = 96 + 66 * v; out[2] = 112 + 68 * v;
  });
}
function latticeWoodCanvas(size = 256) {
  return pixelCanvas(size, size, (x, y, out) => {
    const v = clamp(.3 + 1.1 * (tfbm(x / size * 32, y / size * 2, 4) - .4));
    out[0] = 46 + 58 * v; out[1] = 30 + 34 * v; out[2] = 34 + 30 * v;
  });
}

// 一朵嵌在交点上的小梅花：五个圆瓣加花心，薄薄一片
function rosette(r) {
  const parts = [];
  for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + Math.PI / 2, g = new THREE.CylinderGeometry(r * .46, r * .5, .16, 14); g.rotateX(Math.PI / 2); g.translate(Math.cos(a) * r * .56, Math.sin(a) * r * .56, 0); parts.push(g); }
  const core = new THREE.SphereGeometry(r * .3, 12, 8); core.scale(1, 1, .6); core.translate(0, 0, .08); parts.push(core);
  return mergeGeometries(parts);
}

export function buildWindow(scene) {
  const [cx, cy] = WALL.window.c, R = WALL.window.r, group = new THREE.Group();
  group.position.set(cx, cy, WALL.z);
  scene.add(group);
  const ring = (profile, segs = 128) => { const g = new THREE.LatheGeometry(profile.map(p => new THREE.Vector2(...p)), segs); g.rotateX(Math.PI / 2); return g; };

  // 窗套：从墙背面的洞口沿洞壁走到墙面，再翻出一道带线脚的砖边压在墙上
  const brick = new THREE.MeshStandardMaterial({ map: toTexture(brickCanvas()), color: '#B6B2BE', roughness: .88, side: THREE.DoubleSide });
  const surround = new THREE.Mesh(ring([[R, -WALL_THICK], [R, .28], [R + .1, .46], [R + .45, .52], [R + .8, .5], [R + .95, .38], [R + 1.05, .3], [R + 1.5, .3], [R + 1.72, .18], [R + 1.8, 0]], 176), brick);
  group.add(surround);

  // 花格：外圈和内圈各一道木环，中间是冰裂纹的棂条
  const wood = new THREE.MeshStandardMaterial({ map: toTexture(latticeWoodCanvas(), { repeat: [1, 1] }), color: '#A89AA8', roughness: .62 });
  const D = .56, W = .30, parts = [];                                 // 棂条的进深、看面的宽
  parts.push(ring([[RIM_R, -D / 2], [R, -D / 2], [R, D / 2], [RIM_R, D / 2], [RIM_R - .08, D / 2 - .08], [RIM_R - .08, -D / 2 + .08], [RIM_R, -D / 2]]));
  parts.push(ring([[CLEAR_R, -D / 2 - .06], [CLEAR_R + .2, -D / 2 - .12], [CLEAR_R + .42, -D / 2 - .06], [CLEAR_R + .42, D / 2 + .06], [CLEAR_R + .2, D / 2 + .12], [CLEAR_R, D / 2 + .06], [CLEAR_R, -D / 2 - .06]]));
  const joints = [];
  for (const chord of iceCrack(CLEAR_R + .3, RIM_R, 7, 5)) for (const s of clipToRing(chord, CLEAR_R + .3, RIM_R)) {
    const dx = s.q[0] - s.p[0], dy = s.q[1] - s.p[1], len = Math.hypot(dx, dy);
    if (len < 1.1) continue;
    const bar = grainUV(new THREE.BoxGeometry(len, W, D), 0, .18, len);
    bar.rotateZ(Math.atan2(dy, dx)); bar.translate((s.p[0] + s.q[0]) / 2, (s.p[1] + s.q[1]) / 2, 0);
    parts.push(bar);
    if (s.openP) joints.push(s.p);
    if (s.openQ) joints.push(s.q);
  }
  const lattice = new THREE.Mesh(mergeGeometries(parts), wood);
  lattice.position.z = LATTICE_Z;
  group.add(lattice);

  // 冰梅：挑几处彼此离得开的丁字交点，各嵌一朵小梅花
  const picked = [];
  for (const j of joints) {
    const r = Math.hypot(j[0], j[1]);
    if (r < CLEAR_R + 1 || r > RIM_R - .9 || picked.some(k => Math.hypot(k[0] - j[0], k[1] - j[1]) < 7)) continue;
    picked.push(j);
  }
  if (picked.length) {
    const flowers = new THREE.Mesh(mergeGeometries(picked.map(([x, y], i) => { const g = rosette(.62); g.rotateZ(i * 1.3); g.translate(x, y, D / 2 + .04); return g; })),
      new THREE.MeshStandardMaterial({ color: '#8A6E6C', roughness: .6 }));
    flowers.position.z = LATTICE_Z;
    group.add(flowers);
  }
  return { group };
}
