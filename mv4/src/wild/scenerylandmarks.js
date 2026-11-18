// 谷里的几样「看得见的地标」：塔、寺（大殿、山门、一圈院墙）、牌坊、溪上的石拱桥、湖边的码头和小船。原点都在地面（或水面）正中。
//   塔——八角七层：须弥座的台基，每层一圈白墙、四面开一个券门（夜里亮）、腰檐八个角起翘，往上一层比一层收；顶上铜刹，一串相轮、宝珠。
//   大殿——歇山顶：赭黄的墙、红柱、一圈回廊，正面五间的格扇门窗；台基前一道踏跺。山门是小一号的三间。
//   牌坊——三间四柱的石牌坊，柱脚抱鼓石，额枋上一块匾，每间一个小庑殿顶。
//   石拱桥——一个半圆的拱，桥面顺着拱背起伏，两边是矮的石栏。span：跨多宽。
//   码头——几根木桩撑着一溜木板伸进水里，头上横一截；小船——两头尖翘的木船，中间一个乌篷。
import * as THREE from 'three';
import { Kit, MAT, V, place } from './kit.js';
import { roofSlope } from './roof.js';

const STONE = '#B9B2A4', STONE_DK = '#8C877E', STONE_LT = '#CFC8BA', PLASTER = '#EAE2D0', OCHRE = '#C89A52', RED = '#A8402C', RED_DK = '#7E2E20', WOOD = '#5A3226';
const RIDGE = '#33424A', TILE = '#56707A', GOLD = '#C8A048', PAPER = '#FFC878', HULL = '#5E4632', MATTING = '#3E3A34';
const TAU = Math.PI * 2;

// 一圈多边形的屋檐：n 个角，半径从 r0（贴着墙）到 r1（檐口），檐口每个角起翘 lift。y：檐口高
function polyEave(kit, n, r0, r1, y, rise, lift) {
  const at = (i, k) => { const a = (i / n) * TAU + Math.PI / n, r = r0 + (r1 - r0) * k; return V(Math.sin(a) * r, y + rise * (1 - k) ** 1.4, Math.cos(a) * r); };
  kit.use(MAT.tile);
  for (let i = 0; i < n; i++) for (let j = 0; j < 3; j++) {
    const k0 = j / 3, k1 = (j + 1) / 3, a = at(i, k0), b = at(i, k1), c = at(i + 1, k1), d = at(i + 1, k0);
    if (j === 2) { b.y += lift; c.y += lift; }
    kit.face(a, b, c, d, TILE, V(0, 1, 0));
    if (j === 2) kit.face(b, c, c.clone().add(V(0, -.35, 0)), b.clone().add(V(0, -.35, 0)), RIDGE, b.clone().add(c).setY(0));
  }
  for (let i = 0; i < n; i++) kit.beam(at(i, 0).add(V(0, .1, 0)), at(i, 1).add(V(0, lift + .2, 0)), .3, .3, RIDGE);   // 戗脊
}

export function pagodaGeometry() {
  const kit = new Kit(), N = 8;
  const prism = (r, h) => new THREE.CylinderGeometry(r, r, h, N).rotateY(Math.PI / N);
  kit.use(MAT.stone).add(prism(7.2, 4), STONE_DK, place(0, -1, 0)).add(prism(6.6, .5), STONE_LT, place(0, 1.2, 0)).add(prism(6, .9), STONE, place(0, 1.85, 0));
  let y = 2.3, r = 4.4;
  for (let level = 0; level < 7; level++) {
    const h = level === 0 ? 5 : 3.6 - level * .18;
    kit.use(MAT.plaster).add(prism(r, h), PLASTER, place(0, y + h / 2, 0));
    kit.use(MAT.wood).add(prism(r + .12, .35), RED_DK, place(0, y + h - .2, 0));
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2 + Math.PI / N + (level % 2) * Math.PI / 4, fx = Math.sin(a) * (r * .93), fz = Math.cos(a) * (r * .93);
      kit.use(MAT.paper).box(1.1, h * .5, .2, PAPER, place(fx, y + h * .4, fz, a), .8);
      kit.use(MAT.wood).box(1.5, .25, .3, RED, place(fx, y + h * .68, fz, a));
    }
    polyEave(kit, N, r * .9, r + 2.4 - level * .12, y + h + .1, 1.2, .9);
    y += h + 1.1; r *= .88;
  }
  // 塔刹
  kit.use(MAT.tile).add(new THREE.ConeGeometry(r + .8, 2.2, N), RIDGE, place(0, y + .6, 0));
  kit.use(MAT.gold).add(new THREE.CylinderGeometry(.18, .22, 6, 6), GOLD, place(0, y + 4, 0));
  for (let k = 0; k < 6; k++) kit.add(new THREE.TorusGeometry(.6 - k * .06, .1, 4, 10).rotateX(Math.PI / 2), GOLD, place(0, y + 2.3 + k * .6, 0));
  kit.add(new THREE.SphereGeometry(.45, 8, 6), GOLD, place(0, y + 7.3, 0));
  return kit.geometry();
}

// 歇山顶的殿：w、d 面阔进深，h 檐柱高。gate：山门（三间，没有回廊）
export function hallGeometry(w, d, h, gate = false) {
  const kit = new Kit(), base = 1.4;
  kit.use(MAT.stone).box(w + 4, base + 3, d + 4, STONE, place(0, base - (base + 3) / 2, 0)).box(w / 2.5, base, 3, STONE_DK, place(0, base / 2 - .1, d / 2 + 3));
  kit.use(MAT.plaster).box(w, h, d, gate ? RED : OCHRE, place(0, base + h / 2, 0));
  const bays = gate ? 3 : 5;
  kit.use(MAT.lacquer);
  for (let i = 0; i <= bays; i++) for (const z of [-1, 1]) kit.box(.6, h, .6, RED, place(-w / 2 + w * i / bays, base + h / 2, z * (d / 2 + (gate ? 0 : 1.6))));
  kit.box(w + 1, .6, .5, RED_DK, place(0, base + h - .3, d / 2 + (gate ? .1 : 1.6)));
  for (let i = 0; i < bays; i++) {
    const cx = -w / 2 + w * (i + .5) / bays, door = gate ? (i === 1) : true;
    if (door) kit.use(MAT.paper).box(w / bays * .78, h * .72, .2, gate ? '#3A2218' : PAPER, place(cx, base + h * .38, d / 2 + .05), gate ? 0 : .7);
  }
  // 歇山：下半是四坡，上半是两坡带一面山花
  const y0 = base + h + .3, ov = 2.6, rise = d * .42;
  for (const side of [1, -1]) {
    const surf = (u, v) => V(u * (w / 2 + ov) * (1 - .2 * (1 - v)), y0 + rise * (1 - v) ** 1.5 + .9 * u * u * v, side * (d / 2 + ov) * v);
    roofSlope(kit, surf, 6, 4, Math.round(w * .8), () => V(0, 0, side));
  }
  for (const side of [1, -1]) {
    const surf = (u, v) => V(side * (w / 2 + ov) * v, y0 + rise * .55 * (1 - v) ** 1.3 + .9 * u * u * v, u * (d / 2 + ov) * (1 - .3 * (1 - v)));
    kit.use(MAT.tile);
    for (let i = 0; i < 3; i++) for (let j = 1; j < 3; j++) kit.face(surf(-1 + 2 * i / 3, j / 3), surf(-1 + 2 * i / 3, (j + 1) / 3), surf(-1 + 2 * (i + 1) / 3, (j + 1) / 3), surf(-1 + 2 * (i + 1) / 3, j / 3), TILE, V(0, 1, 0));
    kit.use(MAT.plaster).tris([V(side * (w / 2 - .5), y0 + rise * .5, d / 2 - .3), V(side * (w / 2 - .5), y0 + rise * .5, -d / 2 + .3), V(side * (w / 2 - .5), y0 + rise * .95, 0)], RED_DK);
  }
  kit.use(MAT.tile).box(w * .72, .9, .8, RIDGE, place(0, y0 + rise + .3, 0));
  for (const x of [-1, 1]) kit.box(.9, 1.6, .8, RIDGE, place(x * w * .36, y0 + rise + .9, 0, 0, 0, -x * .3));
  return kit.geometry();
}

// 寺的院墙：w × d 的一圈赭黄墙，墙头一溜瓦；南面正中留出山门的位置
export function templeWall(w, d, gap) {
  const kit = new Kit(), H = 3, T = .7;
  const seg = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0), yaw = Math.atan2(x1 - x0, z1 - z0), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    kit.use(MAT.plaster).box(T, H + 3, len, OCHRE, place(cx, H / 2 - 1.5, cz, yaw)).use(MAT.tile).box(T + .8, .4, len + .4, RIDGE, place(cx, H + .15, cz, yaw));
  };
  seg(-w / 2, -d / 2, w / 2, -d / 2); seg(-w / 2, -d / 2, -w / 2, d / 2); seg(w / 2, -d / 2, w / 2, d / 2);
  seg(-w / 2, d / 2, -gap / 2, d / 2); seg(gap / 2, d / 2, w / 2, d / 2);
  return kit.geometry();
}

export function paifangGeometry() {
  const kit = new Kit(), H = 7.5, spans = [-6, -2, 2, 6];
  kit.use(MAT.stone);
  for (const x of spans) {
    kit.box(.9, H + 2, .9, STONE, place(x, H / 2 - 1, 0));
    for (const z of [-1, 1]) kit.add(new THREE.CylinderGeometry(.75, .75, .5, 10).rotateX(Math.PI / 2), STONE_DK, place(x, 1.1, z * .8)).box(.8, 1.4, .9, STONE_DK, place(x, .5, z * .8));   // 抱鼓石
  }
  kit.box(13.5, .8, .7, STONE, place(0, H - 1.6, 0)).box(4.6, .7, .7, STONE, place(0, H + .3, 0));
  kit.use(MAT.paper).box(2.8, 1.2, .2, '#2E4A6E', place(0, H - .55, .4)).use(MAT.gold).box(2.2, .8, .05, GOLD, place(0, H - .55, .52));
  const roof = (cx, cy, w) => {
    for (const side of [1, -1]) roofSlope(kit, (u, v) => V(cx + u * w / 2 * (1 + .05 * v), cy + 1 * (1 - v) ** 1.3 + .4 * u * u * v, side * 1.3 * v), 3, 2, Math.round(w), () => V(0, 0, side));
    kit.use(MAT.tile).box(w * .9, .35, .35, RIDGE, place(cx, cy + 1.1, 0));
  };
  roof(0, H + .9, 5.2); roof(-4, H - .9, 4.4); roof(4, H - .9, 4.4);
  return kit.geometry();
}

// 石拱桥：沿 x 跨过去，span 跨多宽，width 桥面多宽
export function archBridgeGeometry(span, width) {
  const kit = new Kit(), rise = span * .42, n = 10, L = span + 6;
  const deck = x => { const k = x / (L / 2); return rise + 1 - (rise * .9) * k * k; };
  kit.use(MAT.stone);
  for (let i = 0; i < n; i++) {
    const x0 = -L / 2 + L * i / n, x1 = -L / 2 + L * (i + 1) / n, y0 = deck(x0), y1 = deck(x1), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const slope = Math.atan2(y1 - y0, x1 - x0), len = Math.hypot(x1 - x0, y1 - y0) + .05;
    kit.box(len, .5, width, STONE_LT, place(cx, cy, 0, 0, 0, slope));
    for (const z of [-1, 1]) kit.box(len, .7, .35, STONE, place(cx, cy + .55, z * (width / 2 - .15), 0, 0, slope));
    // 拱圈下面的桥身：拱以外的部分填实
    const under = Math.abs(cx) < span / 2 ? Math.sqrt(1 - (cx / (span / 2)) ** 2) * rise : 0;
    kit.box(len, Math.max(.5, cy - under + 2), width - .2, STONE, place(cx, (cy + under - 2) / 2 - .2, 0, 0, 0, slope * .3));
  }
  for (const x of [-L / 2, L / 2]) kit.box(1.4, 1.6, 1.2, STONE_DK, place(x * .98, deck(x) + .6, width / 2 - .1)).box(1.4, 1.6, 1.2, STONE_DK, place(x * .98, deck(x) + .6, -width / 2 + .1));
  return kit.geometry();
}

// 码头：沿 +z 伸进水里 len 那么长；原点在岸边的水面
export function pierGeometry(len) {
  const kit = new Kit().use(MAT.wood), W = 2.6;
  for (let z = 0; z <= len; z += 3.2) for (const x of [-1, 1]) kit.box(.32, 4, .32, '#4A3020', place(x * W / 2, -1.2, z));
  for (let z = 0; z < len; z += .7) kit.box(W + .3, .14, .6, z % 1.4 < .7 ? '#8A6844' : '#7A5A3A', place(0, .7, z + .35));
  kit.box(W * 2.2, .18, 1.4, '#7A5A3A', place(0, .72, len + .3));
  return kit.geometry();
}

export function boatGeometry() {
  const kit = new Kit().use(MAT.wood), L = 7, n = 8;
  for (let i = 0; i < n; i++) {
    const k0 = i / n, k1 = (i + 1) / n, w = k => 1.5 * Math.sin(Math.PI * k) ** .7 + .05, y = k => .45 * (2 * k - 1) ** 2 * 1.4;
    const a = V(-L / 2 + L * k0, y(k0), 0), b = V(-L / 2 + L * k1, y(k1), 0);
    for (const s of [1, -1]) {
      kit.face(a.clone().setZ(s * w(k0)), b.clone().setZ(s * w(k1)), b.clone().setY(y(k1) - .8).setZ(s * w(k1) * .5), a.clone().setY(y(k0) - .8).setZ(s * w(k0) * .5), HULL, V(0, 0, s));
      kit.face(a.clone().setZ(s * w(k0)).setY(y(k0) + .08), b.clone().setZ(s * w(k1)).setY(y(k1) + .08), b.clone().setY(y(k1) - .1), a.clone().setY(y(k0) - .1), '#6E5440', V(0, 1, 0));
    }
  }
  // 乌篷：半圆的篷，竹篾编的
  kit.use(MAT.paper).add(new THREE.CylinderGeometry(1.15, 1.15, 2.6, 10, 1, true, 0, Math.PI).rotateZ(Math.PI / 2), MATTING, place(.3, .5, 0));
  return kit.geometry();
}
