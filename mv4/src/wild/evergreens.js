// 常绿的两种：松和竹。冬天叶上压雪。
// 松照国画的画法：干是虬曲的、鳞皴；大枝横着伸出去，一路折着走、梢头微微上翘；枝上托着一片片平展的「云片」——
//   每片云片是几张平铺的松针（从上往下看是一轮轮的针）加一圈立着的扇形针（从侧面看是一排朝上的扇子，底是平的）。
//   三个长相：tall 直立的山松；lean 斜着长、一根长枝探出去（迎客松）；crag 贴着崖壁横着探出去再往上翘（朝 +x 探，种的时候把 +x 对着下坡）。
// 竹是一丛：几竿有节的青竿，高处微微弯下来，上半截每隔几节出一小枝，枝上垂着「个」字形的叶。
import { rnd } from '../anim.js';
import { CELLS } from './leaves.js';
import { Plant, PART, V, UP, TAU, spine, along, resample, kept } from './plant.js';

// 一片云片：中心 c、半径 r、厚 thick
function pad(t, c, r, thick, seed, d) {
  const R = k => rnd(seed * 11.3 + k * 2.7), [flats, fans] = d.pad;
  t.within(V(c.x, c.y - thick * .6, c.z), V(r * 1.15, thick * 2.4, r * 1.15));
  for (let i = 0; i < flats; i++) {
    const yaw = R(i) * TAU, a = i * 2.4 + R(i + 10), off = i === 0 ? 0 : r * .5, s = i === 0 ? r : r * (.6 + .2 * R(i + 20));
    const right = V(Math.cos(yaw), (R(i + 30) - .5) * .3, Math.sin(yaw)).normalize(), up = V(-Math.sin(yaw), (R(i + 40) - .5) * .3, Math.cos(yaw)).normalize();
    t.card(V(c.x + Math.cos(a) * off, c.y + thick * (.15 + .3 * (i % 3)), c.z + Math.sin(a) * off), right, up, s, s, i % 2 ? CELLS.needleSparse : CELLS.needleTop, PART.leaf, { cluster: c, spread: r, rand: R(50) });
  }
  for (let i = 0; i < fans; i++) {
    const a = (i + R(i + 60)) / fans * TAU, off = i < 2 ? 0 : r * .42, hw = r * (i < 2 ? .95 : .7), hh = hw * .52;      // 头两张过中心、互相交叉，其余围在外圈
    const right = V(-Math.sin(a), 0, Math.cos(a)), up = V(Math.cos(a) * .22, 1, Math.sin(a) * .22).normalize();
    t.card(V(c.x + Math.cos(a) * off, c.y - thick * .5 + hh * .5, c.z + Math.sin(a) * off), right, up, hw, hh, CELLS.needleSide, PART.leaf, { cluster: c, spread: r, rand: R(70) });
  }
}

// 每个长相：高矮、干扭多少、从多高开始出枝、几根大枝、枝伸多长、枝偏向 +x 多少、根部隆起多少、几条板根；
// axis(k, H)：干的走向，返回 k 处（0 根，1 梢）往 +x 探出多少、多高。直的和斜的是越往上越斜；崖上的是先从石壁里横着探出来、再弯上去
const PINES = {
  tall: { H: [12, 16], bend: 1.5, first: .42, boughs: 7, reach: 1, toward: 0, flare: .7, roots: 4, axis: (k, H) => [.14 * H * k ** 1.5, -1 + (H + 1) * k] },
  lean: { H: [9.5, 12.5], bend: 1.5, first: .36, boughs: 6, reach: 1.25, toward: .8, flare: .7, roots: 4, axis: (k, H) => [.42 * H * k ** 1.5, -1 + (H + 1) * k * (1 - .04 * k)] },
  crag: { H: [7, 9.5], bend: 1.1, first: .34, boughs: 5, reach: 1.35, toward: 1.5, flare: .25, roots: 0, axis: (k, H) => [-1.6 + .62 * H * (1 - (1 - k) ** 2.2), -.7 + (H + .7) * k ** 1.6] },
};
export function pine(seed, d, form) {
  const F = PINES[form], R = k => rnd(seed * 17.3 + k * 3.1), H = F.H[0] + (F.H[1] - F.H[0]) * R(0), t = new Plant(H), p1 = R(1) * TAU, p2 = R(2) * TAU, r0 = .58 + .16 * R(3);
  // 干：沿着这个长相的走向，同时左右扭两三道弯（贴地的一截不扭）
  const trunk = Array.from({ length: 10 }, (_, i) => { const k = i / 9, sw = Math.sqrt(k), [out, up] = F.axis(k, H); return V(out + F.bend * (Math.sin(k * 4.4 + p1) - Math.sin(p1)) * sw, up, F.bend * .7 * (Math.sin(k * 3.3 + p2) - Math.sin(p2)) * sw); });
  const radius = k => .1 + (r0 - .1) * (1 - k) ** .9;
  t.limb(resample(trunk, Math.max(3, Math.round(9 * d.joints))), r0, .1, { sides: d.sides, taper: .9, flare: F.flare, seed });
  if (d.roots && F.roots) t.roots(F.roots, r0, seed);
  for (let i = 0; i < F.boughs; i++) {
    const k = F.first + (.94 - F.first) * i / (F.boughs - 1), a = p1 + i * 2.4 + R(10 + i), from = along(trunk, k), len = F.reach * (2.4 + 3 * R(20 + i)) * (1.2 - .7 * k);
    const pts = spine(from, V(Math.cos(a) + F.toward, -.12, Math.sin(a)), len, 4, seed + i * 3.1, { crook: .3, lift: .09 });
    if (d.depth === 0 && !kept(i, .6)) continue;                                                     // 远档：隔着省掉几枝
    if (d.depth >= 1) t.limb(resample(pts, Math.max(2, Math.round(4 * d.joints))), radius(k) * .55, .04, { sides: Math.max(3, d.sides - 3), inner: .3 });
    pad(t, along(pts, 1).add(V(0, .3, 0)), (len * .26 + .75) * d.grow ** .5, .5, seed + i * 5.3, d);
    if (d.depth < 2) continue;
    pad(t, along(pts, .55).add(V(0, .3, 0)), len * .22 + .6, .45, seed + i * 5.3 + 1, d);
    const at = along(pts, .45), turn = a + (i % 2 ? 1.1 : -1.1), side = spine(at, V(Math.cos(turn), 0, Math.sin(turn)), len * .5, 2, seed + i * 7.7, { crook: .3, lift: .1 });     // 横着分出去的一小枝，梢上也托一片
    t.limb(side, radius(k) * .3, .03, { sides: 3, inner: .3 });
    pad(t, side[2].clone().add(V(0, .25, 0)), len * .18 + .55, .4, seed + i * 5.3 + 2, d);
  }
  // 顶上：干梢托着一片大的，旁边偏着两片小的
  const top = trunk[9];
  pad(t, V(top.x, top.y + .2, top.z), 1.7 * d.grow ** .5, .55, seed + 91, d);
  if (d.depth >= 1) for (let i = 0; i < 2; i++) { const a = p2 + i * 2.6; pad(t, V(top.x + Math.cos(a) * 1.3, top.y - .5 - .4 * i, top.z + Math.sin(a) * 1.3), 1.15, .45, seed + 93 + i, d); }
  // 干上留着的两截枯枝
  if (d.roots) for (let i = 0; i < 2; i++) { const k = .2 + .1 * i, a = p2 + i * 2.2; t.limb(spine(along(trunk, k), V(Math.cos(a), .25, Math.sin(a)), .9 + .5 * R(40 + i), 2, seed + i * 9.1, { crook: .3 }), radius(k) * .28, .03, { sides: 3 }); }
  return t;
}

export function bamboo(seed, d) {
  const R = k => rnd(seed * 19.7 + k * 2.9), H = 11 + 3 * R(0), t = new Plant(H), culms = Math.max(3, Math.round(6 * d.keep ** .6)), joints = Math.max(3, Math.round(6 * d.joints)), sprays = Math.max(2, Math.round(9 * d.keep));
  t.within(V(0, H * .7, 0), V(H * .3, H * .35, H * .3));
  for (let c = 0; c < culms; c++) {
    const Q = k => rnd(seed * 7.1 + c * 5.3 + k * 1.7), a = c * 2.4 + Q(0), off = .25 + 1.5 * Q(1) * Math.sqrt(c / culms), h = H * (.62 + .42 * Q(2)), dir = V(Math.cos(a + Q(3)), 0, Math.sin(a + Q(3))), nodes = Math.round(h * 1.25);
    // 竿：下半截直，越往上越朝外弯
    const at = k => V(Math.cos(a) * off + dir.x * h * (.06 * k + .2 * k ** 3), -.6 + (h + .6) * k * (1 - .08 * k * k), Math.sin(a) * off + dir.z * h * (.06 * k + .2 * k ** 3));
    const pts = Array.from({ length: joints + 1 }, (_, i) => at(i / joints));
    t.limb(pts, .085 + .04 * Q(4), .022, { sides: Math.max(3, d.sides - 3), taper: .8, vs: pts.map((_, i) => i / joints * nodes) });
    for (let j = 0; j < sprays; j++) {
      const k = .38 + .62 * (j + Q(10 + j)) / sprays, p = at(k), b = a + j * 2.4 + Q(30 + j) * 2, out = V(Math.cos(b), .35, Math.sin(b)).normalize(), reach = (.8 + .7 * Q(50 + j)) * d.grow ** .6, tip = p.clone().addScaledVector(out, reach);
      if (d.cross) t.limb([p, tip], .022, .008, { sides: 3 });
      const s = (.95 + .35 * Q(70 + j)) * d.grow, c0 = V(tip.x, tip.y - s * .35, tip.z), right = V(-Math.sin(b), 0, Math.cos(b)), lean = V(out.x * .3, 1, out.z * .3).normalize();
      t.card(c0, right, lean, s, s, CELLS.bamboo, PART.leaf, { cluster: p, spread: 1.5, rand: Q(90 + j), sway: .25 });
      if (d.cross) t.card(c0, V(out.x, 0, out.z).normalize(), UP, s, s, CELLS.bamboo, PART.leaf, { cluster: p, spread: 1.5, rand: Q(95 + j), sway: .25 });
    }
  }
  return t;
}
