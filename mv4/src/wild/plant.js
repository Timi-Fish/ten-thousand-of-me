// 草木的造型工具：把一棵树拼成一个网格。
// 枝干是沿一串点的管子（带着画树皮用的坐标，根部可以隆起成板根）；叶是一张张贴着图谱（leaves.js）某一格的卡片，几张围成一团；柳丝是垂下来的带子。
// 每个顶点带：
//   aTint：x 是什么（PART）；y 明暗（枝干：贴地的、藏在冠里的暗；叶：树冠里面暗、外缘和顶上亮；柳丝：从上到下的位置）；z 随风摆多少；w 这一团的随机数
//   aCenter：这张卡片的中心（落叶时整张缩到这一点消失；风吹时绕着它抖）
//   normal：枝干是管壁的法线；叶是「从这一团的中心、从整个树冠的中心往外」的方向，所以一团叶、一个树冠各有圆润的受光面和背光面
//   uv：叶是图谱上的位置；枝干是（绕一圈 0 到 1，沿枝的长度）
import * as THREE from 'three';
import { rnd } from '../anim.js';
import { CELLS, cellRect, STRANDS } from './leaves.js';

export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), TAU = Math.PI * 2, UP = V(0, 1, 0);
export const PART = { bark: 0, leaf: 1, strand: 2, bloom: 3, twig: 4 };
export const clamp01 = x => Math.min(1, Math.max(0, x));
export const lerp = (a, b, k) => a + (b - a) * k;

// 一根枝的走向：从 from 朝 dir 长 len，分 n 节。每节的方向随机拧一点（crook），并被往 pull 的方向带一点（lift）
export function spine(from, dir, len, n, seed, { crook = .15, lift = 0, pull = UP } = {}) {
  const pts = [from.clone()], d = dir.clone().normalize();
  for (let i = 0; i < n; i++) {
    const R = k => rnd(seed * 13.7 + i * 5.3 + k * 2.1) - .5;
    d.x += R(0) * 2 * crook; d.y += R(1) * 1.2 * crook; d.z += R(2) * 2 * crook;
    d.addScaledVector(pull, lift).normalize();
    pts.push(pts[i].clone().addScaledVector(d, len / n));
  }
  return pts;
}
const span = (pts, k) => { const f = clamp01(k) * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(f)); return [i, f - i]; };
export function along(pts, k) { const [i, f] = span(pts, k); return pts[i].clone().lerp(pts[i + 1], f); }                  // 枝上 k 处（0 根，1 梢）的点
export function heading(pts, k) { const [i] = span(pts, k); return pts[i + 1].clone().sub(pts[i]).normalize(); }           // 那一处枝的朝向
// 把一串点重新取样成 n 节：过这些点画一条圆顺的曲线再取点（精细档节数多，折角成了弯；精简档节数少）
export const resample = (pts, n) => new THREE.CatmullRomCurve3(pts, false, 'centripetal').getPoints(n);
// 垂直于 d 的一个方向，绕着 d 转 angle
export function sideways(d, angle) {
  const a = V().crossVectors(d, Math.abs(d.y) > .9 ? V(1, 0, 0) : UP).normalize(), b = V().crossVectors(d, a);
  return a.multiplyScalar(Math.cos(angle)).addScaledVector(b, Math.sin(angle));
}

// 三档精细度：near 路边近看的，mid 隔一段看的，far 远山上成片的。
//   sides 树干的边数；joints 枝的节数留几成；depth 枝画到第几级；cards 一团叶几张卡片；keep 叶团留几成；grow 留下的叶团放大多少（补上去掉的）；
//   roots 画不画板根；fill 树冠里面垫不垫叶；pad 松的一片云片里平铺、立着的卡片各几张；strands 柳丝留几成、多宽、分几节
//   tilt 叶片立着往上仰多少（null：各朝各的外面）；dabs 叶用不用「碎点子」那一格；cross 枯枝梢是不是两张交叉
export const DETAIL = {
  near: { sides: 8, joints: 1.7, depth: 3, cards: 8, keep: 1, grow: 1, roots: true, fill: true, pad: [4, 5], strands: [1, 1, 5], tilt: null, dabs: false, cross: true },
  mid: { sides: 5, joints: .5, depth: 2, cards: 3, keep: .5, grow: 1.35, roots: false, fill: false, pad: [2, 3], strands: [.5, 1.5, 4], tilt: null, dabs: false, cross: false },
  far: { sides: 3, joints: .34, depth: 0, cards: 2, keep: .2, grow: 2.2, roots: false, fill: false, pad: [1, 2], strands: [.12, 3.2, 2], tilt: .35, dabs: true, cross: false },
};
// 第 i 个要不要留（留 keep 成，均匀地隔着留）
export const kept = (i, keep) => Math.floor((i + 1) * keep) > Math.floor(i * keep);

// 分枝：一根枝长出去，沿途和梢头再发下一级的枝，直到 levels 用完。结果记在 plan 里：limbs 每一根枝，tips 每个梢头。
// levels[i] 是第 i 级的枝怎么长：joints 几节，crook 拧多少，lift 往上（或往 pull）带多少，taper 粗细怎么收；
//   forks 发几根下一级的枝（最后一根在梢头），first 第一根发在多远处，thin 梢头收到根部的几成粗，lead 梢头那根少张开几成；
//   spread 张开的角度、len 长度是上一级的几成、thick 粗细是发枝处的几成（这三个说的是自己相对上一级）；最末一级的 tip 是梢头的粗细
export function ramify(plan, from, dir, len, r0, level, seed, levels) {
  const L = levels[level], last = level === levels.length - 1, pts = spine(from, dir, len, L.joints, seed, L), r1 = last ? L.tip : r0 * L.thin;
  plan.limbs.push({ pts, r0, r1, level, taper: L.taper });
  if (last) { plan.tips.push({ p: pts[pts.length - 1], dir: heading(pts, 1), from: pts[0] }); return; }
  const next = levels[level + 1];
  for (let i = 0; i < L.forks; i++) {
    const R = k => rnd(seed * 7.9 + i * 3.3 + k * 1.7), k = L.forks === 1 ? 1 : lerp(L.first, 1, i / (L.forks - 1)), ahead = heading(pts, k);
    const open = next.spread * (.75 + .5 * R(2)) * (i === L.forks - 1 ? L.lead : 1), out = sideways(ahead, i * 2.4 + R(0) * .7 + seed * 5);
    ramify(plan, along(pts, k), ahead.multiplyScalar(Math.cos(open)).addScaledVector(out, Math.sin(open)), len * next.len * (.75 + .5 * R(1)), (r1 + (r0 - r1) * (1 - k) ** L.taper) * next.thick, level + 1, seed * 1.37 + i * 2.11 + 1, levels);
  }
}

export class Plant {
  constructor(height) {
    this.height = height; this.pos = []; this.nor = []; this.tint = []; this.cen = []; this.uv = [];
    this.crown = { c: V(0, height * .7, 0), r: V(height * .4, height * .3, height * .4) };
  }
  get tris() { return this.pos.length / 9; }
  // 这一点随风摆多少：越高、伸得越远摆得越多
  sway(p) { return Math.max(0, p.y / this.height) ** 1.6 * (1 + .6 * Math.hypot(p.x, p.z) / this.height); }
  push(p, n, part, shade, sway, rand, c, u, v) { this.pos.push(p.x, p.y, p.z); this.nor.push(n.x, n.y, n.z); this.tint.push(part, shade, sway, rand); this.cen.push(c.x, c.y, c.z); this.uv.push(u, v); }
  // 接下来长的叶属于哪个树冠（中心 c、三个方向的半径 r）：明暗和受光的方向按它算
  within(c, r) { this.crown = { c, r }; return this; }

  // 枝干：沿 pts 的管子，粗细从 r0 收到 r1（taper 越大，越是先粗后急收）。
  // flare：根部隆起多少（贴地的那一圈按 lobes 条板根鼓出去）；inner：有几成藏在树冠里（藏着的暗）；vs：每个点沿枝的坐标（竹子用它数节）
  limb(pts, r0, r1, { sides = 6, taper = 1, flare = 0, lobes = 3, inner = 0, seed = 0, vs = null } = {}) {
    const n = pts.length, rings = [], normal = V(), run = [0];
    for (let i = 1; i < n; i++) run.push(run[i - 1] + pts[i].distanceTo(pts[i - 1]));
    for (let i = 0; i < n; i++) {
      const tan = V().subVectors(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)]).normalize();
      if (i === 0) normal.copy(sideways(tan, 0)); else normal.addScaledVector(tan, -normal.dot(tan)).normalize();                // 管壁的朝向一路带下去，不让管子拧麻花
      const side = V().crossVectors(tan, normal), k = run[i] / run[n - 1], r = r1 + (r0 - r1) * (1 - k) ** taper, swell = flare * Math.exp(-Math.max(0, pts[i].y + .15) / (r0 * 1.5)), ring = [];
      for (let j = 0; j <= sides; j++) {
        const a = j / sides * TAU, dir = normal.clone().multiplyScalar(Math.cos(a)).addScaledVector(side, Math.sin(a));
        const p = pts[i].clone().addScaledVector(dir, r * (1 + swell * (.5 + .7 * (.5 + .5 * Math.cos(lobes * (j % sides) / sides * TAU + seed * 9)))));
        ring.push({ p, n: dir, u: j / sides, v: vs ? vs[i] : run[i], shade: (.25 + .75 * clamp01((p.y + .2) / 2.4)) * (1 - .45 * inner) });
      }
      rings.push(ring);
    }
    for (let i = 0; i + 1 < n; i++) for (let j = 0; j < sides; j++) {
      const q = [rings[i][j], rings[i + 1][j], rings[i + 1][j + 1], rings[i][j + 1]];
      for (const m of [0, 2, 1, 0, 3, 2]) this.push(q[m].p, q[m].n, PART.bark, q[m].shade, this.sway(q[m].p), 0, q[m].p, q[m].u, q[m].v);
    }
    return this;
  }
  // 把 ramify 算出的骨架按精细度 d 画出来：级数超过 d.depth 的枝不画，越细的枝边数、节数越少。flare：树干根部隆起多少
  skeleton(plan, d, flare, seed, roots = 4) {
    for (const l of plan.limbs) if (l.level <= d.depth) {
      const joints = Math.max(l.level === 0 ? 2 : 1, Math.round((l.pts.length - 1) * d.joints * [1, 1, .75, .5][l.level])), pts = resample(l.pts, joints);
      if (l.level === 0 && d.roots && roots) pts.splice(1, 2, ...resample(pts.slice(0, 4), 7).slice(1, 6));      // 近看的树：贴地那一截多切几圈，板根的隆起才圆顺
      this.limb(pts, l.r0, l.r1, { sides: Math.max(3, d.sides - [0, 3, 4, 5][l.level]), taper: l.taper, flare: l.level === 0 ? flare : 0, inner: Math.min(.7, l.level * .3), seed });
    }
    if (d.roots && roots) this.roots(roots, plan.limbs[0].r0, seed);
    return this;
  }
  // 把树冠定成正好罩住这些点的椭球（四周再放出 margin）
  crownOver(points, margin) {
    const box = new THREE.Box3().setFromPoints(points), c = box.getCenter(V()), r = box.getSize(V()).multiplyScalar(.5).addScalar(margin);
    return this.within(c, r);
  }
  // 枯枝梢：每个梢头一张（近看两张交叉）顺着枝长出去的细杈，叶落之后树冠的外缘靠它；枝没画到梢的远档，改成顺着每根大枝立一大张
  twigs(plan, d, seed, size = .95) {
    const spray = (base, dir, s, k) => {
      const right = sideways(dir, rnd(seed * 3.3 + k * 7.1) * TAU), c = base.clone().addScaledVector(dir, s * .9);
      this.card(c, right, dir, s, s, CELLS.twig, PART.twig, { rand: rnd(k * 1.7 + seed) });
      if (d.cross) this.card(c, V().crossVectors(dir, right), dir, s, s, CELLS.twig, PART.twig, { rand: rnd(k * 2.9 + seed) });
    };
    if (d.depth >= 2) plan.tips.forEach((tip, i) => { if (kept(i, d.keep)) spray(tip.p.clone().addScaledVector(tip.dir, -.35 * size), tip.dir, size * d.grow, i); });
    else plan.limbs.filter(l => l.level === 1).forEach((l, i) => { const a = l.pts[0], b = l.pts[l.pts.length - 1]; spray(a, V().subVectors(b, a).normalize(), a.distanceTo(b) * .8, i); });
    return this;
  }
  // 板根：从树干脚下朝四周爬出去、扎进土里的几条根
  roots(count, r, seed) {
    for (let i = 0; i < count; i++) {
      const a = (i + rnd(seed * 3.1 + i * 7.7)) / count * TAU, dir = V(Math.cos(a), -.5, Math.sin(a));
      const pts = spine(V(dir.x * r * .3, .42 + .2 * rnd(seed + i * 2.3), dir.z * r * .3), dir, r * (2.2 + 1.6 * rnd(seed * 5.9 + i * 1.3)), 3, seed + i * 4.1, { crook: .2, lift: .16, pull: V(0, -1, 0) });
      this.limb(resample(pts, 4), r * .62, r * .2, { sides: 5, taper: .8 });
    }
    return this;
  }

  // 一张卡片：中心 c，沿 right、up 两个方向各伸出 w、h，贴图谱的 cell 那一格。cluster、spread：它所在那一团的中心和大小
  card(c, right, up, w, h, cell, part, { cluster = c, spread = 1, rand = 0, sway = 0 } = {}) {
    const [u0, v0, du, dv] = cellRect(cell), { c: cc, r } = this.crown;
    const q = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => {
      const p = c.clone().addScaledVector(right, x * w).addScaledVector(up, y * h), o = V((p.x - cc.x) / r.x, (p.y - cc.y) / r.y, (p.z - cc.z) / r.z);
      const shade = clamp01(.06 + .5 * Math.min(1, o.length()) ** 1.5 + .44 * clamp01(o.y * .5 + .5));
      const nrm = o.multiplyScalar(.8).addScaledVector(V().subVectors(p, cluster), .7 / spread); nrm.y += .3;
      return { p, n: nrm.normalize(), shade, u: u0 + (x + 1) / 2 * du, v: v0 + (1 - y) / 2 * dv };
    });
    for (const m of [0, 1, 2, 0, 2, 3]) this.push(q[m].p, q[m].n, part, q[m].shade, this.sway(q[m].p) + sway, rand, c, q[m].u, q[m].v);
    return this;
  }
  // 一团叶：count 张卡片朝外围成一团，r 是这一团三个方向的半径；cells：轮着用图谱的哪几格；size：卡片相对这一团的大小；
  // tilt：不给就各朝各的外面，给了就都立着、往上仰这么多（远处的树用：从侧面、从上面看都是满的）
  cluster(c, r, count, cells, seed, { part = PART.leaf, size = 1, tilt = null, sway = 0 } = {}) {
    const rand = rnd(seed * 3.7 + 1.1), mean = (r.x + r.y + r.z) / 3;
    for (let i = 0; i < count; i++) {
      const R = k => rnd(seed * 31.7 + i * 7.3 + k * 1.9), y = 1 - 2 * (i + .5) / count, ring = Math.sqrt(1 - y * y), ang = i * 2.39996 + R(0) * 1.2, reach = .3 + .5 * R(1);
      const dir = V(Math.cos(ang) * ring, y, Math.sin(ang) * ring), mid = V(c.x + dir.x * r.x * reach, c.y + dir.y * r.y * reach * (y < 0 ? .6 : 1), c.z + dir.z * r.z * reach);
      const face = tilt === null ? V(dir.x + (R(2) - .5) * .7, dir.y + .25 + (R(3) - .5) * .5, dir.z + (R(4) - .5) * .7).normalize() : V(Math.cos(ang) * Math.cos(tilt), Math.sin(tilt), Math.sin(ang) * Math.cos(tilt));
      const right = sideways(face, tilt === null ? R(5) * TAU : 0), up = V().crossVectors(right, face), s = mean * size * (.8 + .4 * R(6));
      this.card(mid, right, up, s, s, cells[i % cells.length], part, { cluster: c, spread: mean, rand, sway });
    }
    return this;
  }
  // 一条垂下来的丝绦（柳丝）：从 top 垂下 len，先顺着 lean 往外飘一点再落下去，越往下摆得越厉害
  strand(top, len, width, lean, seed, SEG = 5) {
    const rand = rnd(seed * 5.3 + 2.9), yaw = rnd(seed * 9.1) * TAU, side = V(Math.cos(yaw) * width, 0, Math.sin(yaw) * width);
    const [u0, v0, du, dv] = cellRect(CELLS.strand, Math.floor(rnd(seed * 7.7) * STRANDS)), n = V(top.x - this.crown.c.x, 0, top.z - this.crown.c.z).normalize().setY(.5).normalize();
    const at = k => V(top.x + lean.x * Math.sqrt(k), top.y - len * k * (.3 + .7 * k), top.z + lean.z * Math.sqrt(k)), base = this.sway(top);
    for (let i = 0; i < SEG; i++) {
      const k0 = i / SEG, k1 = (i + 1) / SEG, a = at(k0), b = at(k1);
      const q = [[a, -1, k0], [a, 1, k0], [b, 1, k1], [b, -1, k1]].map(([p, s, k]) => ({ p: p.clone().addScaledVector(side, s), k, u: u0 + (s + 1) / 2 * du, v: v0 + k * dv }));
      for (const m of [0, 1, 2, 0, 2, 3]) this.push(q[m].p, n, PART.strand, q[m].k, base + 1.4 * q[m].k ** 1.5, rand, top, q[m].u, q[m].v);
    }
    return this;
  }

  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('aTint', new THREE.Float32BufferAttribute(this.tint, 4)); g.setAttribute('aCenter', new THREE.Float32BufferAttribute(this.cen, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.computeBoundingSphere();
    return g;
  }
}
