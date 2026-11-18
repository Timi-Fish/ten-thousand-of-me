// 登山道沿途人修的、山自己长的那些东西：让人一眼看出这是一条一级一级修上去的朝山古道，也给山一个尺度。
//   山门——天街尽头的南天门：两座红墙的城台夹着一个券洞（路从洞里过：洞宽过了路两边的灯火，洞顶离路面 SPRING 以上），台上一座歇山顶的门楼；
//           门里门外各一对大石灯。
//   歇脚的平台——西山肩伸出来的台地上：一座小亭、一通大碑、一对大石灯，朝崖的一圈矮石栏。
//   经幡——门楼的四角、小亭的宝顶、鲫鱼背两头的幡杆上拉出去一串串五色的小旗，风里一阵阵地飘；横过路面的那几串最低处也在路面 5 个单位以上。
//   山石——路两旁隔不等的距离一丛丛露头的岩（一块大的带几块小的，顶都是钝的）：十八盘的弯角、石壁脚下、鲫鱼背的两头、松林里的拐弯处。
//           路是从石头和树之间穿过去的。石头离路的中线至少 CLEAR，不挡灯火和小蟹。
//   迎客的松——山门外、平台边、鲫鱼背两头各有一两棵探出去的大松（交给种树的人种）。
import * as THREE from 'three';
import { rnd } from '../anim.js';
import { fbm } from './noise.js';
import { Kit, MAT, V, place, builtMaterial } from './kit.js';
import { paint, shadowed } from './paint.js';
import { tracer } from './roadside.js';
import { pavilionGeometry } from './pavilion.js';
import { hallGeometry } from './scenerylandmarks.js';
import { lanternGeometry, steleGeometry, LIGHT_Y } from './props.js';
import { railGeometry } from './rails.js';
import { rockShapes, rockMesh } from './ridgerocks.js';
import { RIDGE_WIND } from './ridgeshade.js';

const STONE = '#B4AEA0', STONE_DK = '#8C877E', STONE_LT = '#CBC4B6', WALL = '#A4442F', WALL_DK = '#86362A', WOOD = '#4A2C20', GOLD = '#C8A048';
const CLEAR = 7.4;                                                   // 新摆的东西离路中线至少这么远（灯火铺到中线两侧 6.5）
export const GATE = { inner: 7.1, outer: 12.8, deep: 9, top: 9.6, spring: 4.3, crown: 7.7 };   // 山门：券洞半宽、城台外沿、进深、台顶高、券脚和券顶离路面多高
const BIG = 2.2, PAVILION = .55;                                     // 大石灯、平台上的小亭各是原样的几倍

// 山门的城台。原点在路中线上、路面的高度；x 横着，z 顺着路
function gateGeometry() {
  const kit = new Kit(), { inner, outer, deep, top, spring, crown } = GATE, mid = (inner + outer) / 2, wide = outer - inner;
  for (const sx of [-1, 1]) {
    kit.use(MAT.stone).box(wide + .6, 7.4, deep + .6, STONE_DK, place(sx * mid, -1.3, 0)).box(wide + .3, .4, deep + .3, STONE, place(sx * mid, 2.6, 0));   // 条石的台脚，埋进地里
    kit.use(MAT.plaster).box(wide, top - 2.4, deep, WALL, place(sx * mid, 2.4 + (top - 2.4) / 2, 0));
  }
  // 券洞上面的墙：一条条竖着接起来，底边顺着券的弧；弧下面压一圈券石
  const N = 24;
  for (let i = 0; i < N; i++) {
    const x0 = -inner + 2 * inner * i / N, x1 = x0 + 2 * inner / N, edge = Math.max(Math.abs(x0), Math.abs(x1)), under = spring + (crown - spring) * Math.sqrt(Math.max(0, 1 - (edge / inner) ** 2));
    kit.use(MAT.plaster).box(x1 - x0 + .01, top - under, deep, WALL, place((x0 + x1) / 2, (top + under) / 2, 0));
    kit.use(MAT.stone).box(x1 - x0 + .01, .5, deep + .3, STONE_LT, place((x0 + x1) / 2, under + .22, 0));
  }
  // 压顶、垛口、门额
  kit.use(MAT.stone).box(2 * outer + .7, .5, deep + .7, STONE, place(0, top + .25, 0));
  for (const sz of [-1, 1]) {
    for (let x = -outer + .5; x <= outer - .4; x += 1.45) kit.box(.8, .6, .45, STONE_LT, place(x, top + .78, sz * (deep / 2 + .05)));
    kit.use(MAT.paper).box(4.4, 1.3, .2, '#2E4A6E', place(0, crown + 1, sz * (deep / 2 + .12)));
    kit.use(MAT.gold);
    for (const x of [-1.3, 0, 1.3]) kit.box(.8, .8, .06, GOLD, place(x, crown + 1, sz * (deep / 2 + .25)));
    kit.use(MAT.stone);
  }
  return kit.geometry();
}

// 幡杆：一根立着的木杆，顶上一个金色的小帽。原点在杆脚，高 1 个单位（摆的时候按各自的高度拉长）
const poleGeometry = () => new Kit().use(MAT.wood).box(.2, 1, .2, WOOD, place(0, .5, 0)).use(MAT.gold).box(.34, .03, .34, GOLD, place(0, 1, 0)).geometry();

const FLAG_COLORS = ['#3F6FB4', '#F2EEE2', '#C4372C', '#3E9A62', '#E6B93C'];
let flagMat = null;
// 经幡的材质：每面小旗挂在绳上（aPin），越往下摆得越开；风猛了整面往下风扬起来
const flagMaterial = () => flagMat ??= paint({
  side: THREE.DoubleSide,
  vertexPars: `attribute vec3 aPin, aCol; attribute vec2 aHang; varying vec3 vCol; varying float vDown; ${RIDGE_WIND}`,
  world: /* glsl */`
    float press = ridgePress(aPin.xz, aHang.y), down = aHang.x;
    vec2 wd = ridgeWindDir();
    float lift = clamp(press * 1.1, 0., .85), wave = sin(uTime * (5. + 4. * lift) + aHang.y * 40. + down * 3.);
    vec3 rest = wp - aPin;
    wp = aPin + rest * (1. - .5 * lift * down) + vec3(wd.x, .1, wd.y) * length(rest) * down * (lift + .12 * wave);
    vCol = aCol; vDown = down;`,
  fragmentPars: 'varying vec3 vCol; varying float vDown;',
  fragment: /* glsl */`
    float back = pow(max(dot(normalize(vWp - cameraPosition), uSunDir), 0.), 2.);
    albedo = vCol * (.82 + .18 * sin(vDown * 9.)) * (1. + .7 * back);
    albedo = mix(albedo, vec3(.9, .93, 1.), uSnow * .25);
    thin = .5 + .4 * back; ao = .95;`,
});

// groundAt：地面高度；shots：推荐机位（近景机位跟前不摆石头）
export function buildWayside(road, groundAt, shots) {
  const group = new THREE.Group(), mat = builtMaterial(), T = tracer(road), tangent = new THREE.Vector3(), spots = [], trees = [];
  const yawAt = s => Math.atan2(road.tangent(s, tangent).x, tangent.z);
  const one = (geo, matrix, cast = true) => { const m = shadowed(new THREE.Mesh(geo, mat), cast, true); m.applyMatrix4(matrix); m.updateMatrixWorld(); group.add(m); return m; };
  const many = (geo, matrices) => { const m = shadowed(new THREE.InstancedMesh(geo, mat, matrices.length)); matrices.forEach((mx, i) => m.setMatrixAt(i, mx)); m.computeBoundingSphere(); group.add(m); };
  const lamps = [], poles = [], strings = [];
  // 一盏大石灯：立在 (s, o) 的地面上，正面朝着路
  const bigLamp = (s, o) => { const p = T.point(s, o, 0); p.y = groundAt(p.x, p.z) + .1; lamps.push(place(p.x, p.y, p.z, yawAt(s) + Math.sign(o) * Math.PI / 2, 0, 0, BIG)); spots.push(p.clone().setY(p.y + LIGHT_Y * BIG)); };
  // 一根幡杆：杆顶比路面高 lift（杆脚插在地里，地势低的地方杆就长），返回杆顶
  const pole = (s, o, lift) => { const p = T.point(s, o, 0), foot = groundAt(p.x, p.z) - 1.5, top = road.surface(s) + lift; poles.push(place(p.x, foot, p.z, 0, 0, 0, 1, top - foot, 1)); return p.setY(top); };

  // —— 山门 ——
  {
    const s = road.marks.gate, at = T.point(s, 0, road.surface(s)), yaw = yawAt(s), frame = place(at.x, at.y, at.z, yaw);
    one(gateGeometry(), frame);
    one(hallGeometry(11.5, 3.6, 3.4, true), frame.clone().multiply(place(0, GATE.top - .6, 0)));
    for (const [ds, o] of [[-8, -8.6], [-8, 8.6], [9, -8.6], [9, 8.6]]) bigLamp(s + ds, o);
    // 门楼四角拉出去的经幡：门里两串落到天街两侧的幡杆上，门外两串落到石阶两旁
    const corner = (sx, sz) => V(sx * 8.2, GATE.top + 4.9, sz * 3).applyMatrix4(frame);
    for (const sx of [-1, 1]) { strings.push([corner(sx, -1), pole(s - 19, sx * 9.5, 7)]); strings.push([corner(sx, 1), pole(s + 17, sx * 9, 7)]); }
    trees.push({ s: s + 12, o: -11.5, form: 'lean', scale: 1.15 }, { s: s - 13, o: 12, form: 'lean', scale: .95 });
  }

  // —— 歇脚的平台 ——
  {
    const sec = road.section('terrace'), sc = (sec.from + sec.to) / 2, c = T.point(sc, 14, 0), yaw = yawAt(sc);
    c.y = groundAt(c.x, c.z);
    one(pavilionGeometry(), place(c.x, c.y, c.z, yaw + Math.PI / 2, 0, 0, PAVILION));
    const stele = T.point(sec.from + 2, 9.2, 0);
    stele.y = groundAt(stele.x, stele.z) + .1;
    one(steleGeometry(), place(stele.x, stele.y, stele.z, yawAt(sec.from + 2) + Math.PI / 2, 0, 0, 2));
    bigLamp(sec.from - 1, -8.2); bigLamp(sec.to + 1, -8.2);
    // 朝崖的一圈矮石栏：从路缘出去，沿平台的外沿绕一圈，再回到路缘
    const posts = [], rim = 21.5, put = (s, o) => { const p = T.point(s, o, 0); p.y = groundAt(p.x, p.z) - .05; posts.push({ at: p, yaw: 0 }); };
    for (let o = 5.2; o < rim; o += 2.3) put(sec.from - 3, o);
    for (let s = sec.from - 3; s <= sec.to + 3; s += .95) put(s, rim);
    for (let o = rim - 2.3; o > 5; o -= 2.3) put(sec.to + 3, o);
    one(railGeometry([{ kind: 'stone', posts }]), new THREE.Matrix4());
    // 小亭的宝顶上拉出去三串经幡，落到石栏边的幡杆上
    const tip = c.clone().setY(c.y + 15.5 * PAVILION);
    for (const ds of [-9, 0, 9]) strings.push([tip, pole(sc + ds, rim - 1.2, 7)]);
    trees.push({ s: sec.from - 6, o: 12.5, form: 'lean', scale: 1.1 }, { s: sec.to + 6, o: 13, form: 'crag', scale: 1 });
  }

  // —— 鲫鱼背两头：一对幡杆、横过路面的一串经幡、一对大石灯、探出去的松 ——
  {
    const ridge = road.section('ridge');
    for (const s of [ridge.from + 1.5, ridge.to - 3]) {
      strings.push([pole(s, -CLEAR, 9), pole(s, CLEAR, 9)]);
      bigLamp(s - 2.5, -8.4); bigLamp(s - 2.5, 8.4);
    }
    trees.push({ s: ridge.to + 2, o: 11, form: 'crag', scale: 1.05 }, { s: ridge.to + 6, o: -12, form: 'lean', scale: .9 });
  }
  many(lanternGeometry(), lamps);
  many(poleGeometry(), poles);

  // —— 经幡：每串绳从 a 垂到 b，绳上一面面小旗 ——
  {
    const pos = [], nor = [], pin = [], col = [], hang = [], color = new THREE.Color(), rope = new Kit().use(MAT.wood);
    strings.forEach(([a, b], n) => {
      const len = a.distanceTo(b), sag = Math.min(1.6, len * .06), count = Math.floor(len / .78), at = t => a.clone().lerp(b, t).setY(a.y + (b.y - a.y) * t - sag * 4 * t * (1 - t));
      const along = b.clone().sub(a).setY(0).normalize();
      for (let i = 0; i < 12; i++) rope.beam(at(i / 12), at((i + 1) / 12), .04, .04, '#6A5A48');
      for (let i = 1; i < count; i++) {
        const top = at(i / count), w = .3, h = .62 + .2 * rnd(n * 7.1 + i * 3.3), phase = rnd(n * 3.7 + i * 1.9);
        color.set(FLAG_COLORS[(i + n) % FLAG_COLORS.length]);
        const quad = [[-w, 0], [w, 0], [w, -h], [-w, 0], [w, -h], [-w, -h]];
        for (const [dx, dy] of quad) {
          pos.push(top.x + along.x * dx, top.y + dy, top.z + along.z * dx); nor.push(-along.z, 0, along.x);
          pin.push(top.x, top.y, top.z); col.push(color.r, color.g, color.b); hang.push(-dy / h, phase);
        }
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('aPin', new THREE.Float32BufferAttribute(pin, 3)); g.setAttribute('aCol', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('aHang', new THREE.Float32BufferAttribute(hang, 2));
    g.computeBoundingSphere(); g.boundingSphere.radius += 2;
    const flags = shadowed(new THREE.Mesh(g, flagMaterial()), false, true);
    flags.name = '经幡';
    group.add(flags);
    one(rope.geometry(), new THREE.Matrix4(), false);
  }

  // —— 山石 ——
  const rocks = { hero: [[], [], [], []], mid: [[], [], [], []] }, up = new THREE.Vector3(0, 1, 0);
  const close = shots.filter(s => Math.hypot(s.p[0] - s.q[0], s.p[2] - s.q[2]) < 70).flatMap(s => [s.p, s.q]);
  const built = [road.marks.gate, (road.section('terrace').from + road.section('terrace').to) / 2].map(s => ({ at: T.point(s, 0, 0), r: 30 }));
  // 每个路段：多密、多大（半宽）、多高（是半宽的几倍）
  const ROCKS = { gully: [.62, 3.2, 5.5, 1.3], bench: [.5, 2.6, 4.6, 1.2], ridge: [.3, 1.5, 2.6, .8], forest: [.42, 2, 3.8, .9], rejoin: [.3, 1.6, 3, .8] };
  let k = 0;
  for (let s = road.section('gully').from + 4; s < road.upper - 14; s += 6.5) for (const side of [-1, 1]) {
    k++;
    const rule = ROCKS[road.sectionAt(s)];
    if (!rule || rnd(k * 2.3) > rule[0] * (.35 + 1.3 * fbm(s / 31 + side * 7.7, 4.1, 2))) continue;
    const big = rule[1] + (rule[2] - rule[1]) * rnd(k * 3.7) ** 1.4, o = side * (CLEAR + big * 1.25 + 5 * rnd(k * 4.9)), c = T.point(s + 3 * (rnd(k * 5.3) - .5), o, 0), yaw = rnd(k * 6.1) * 6.283;
    for (let i = 0, n = 1 + Math.floor(rnd(k * 8.9) * 3.2); i <= n; i++) {
      const a = yaw + i * 2.3, d = i ? big * (1.1 + .7 * rnd(k * 4.4 + i)) : 0, x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d;
      const wide = (i ? big * (.3 + .4 * rnd(k * 1.9 + i)) : big) * (.85 + .3 * rnd(k * 2.7 + i)), tall = wide * rule[3] * (.75 + .6 * rnd(k * 3.9 + i)), deep = wide * (.7 + .4 * rnd(k * 5.3 + i));
      const on = road.locate(x, z);
      if ((on && on.d < CLEAR + wide * 1.05) || built.some(b => Math.hypot(x - b.at.x, z - b.at.z) < b.r) || close.some(q => Math.hypot(x - q[0], z - q[2]) < 26 + wide)) continue;
      // 坐在坡上：往下埋到四周最低的地面以下，露出来的高度按石头自己的
      const low = Math.min(groundAt(x - wide, z), groundAt(x + wide, z), groundAt(x, z - deep), groundAt(x, z + deep)), sink = groundAt(x, z) - low + .3 * tall;
      if (groundAt(x, z) - low > 1.3 * wide) continue;                                                // 崖壁上坐不住石头
      rocks[wide > 2.4 ? 'hero' : 'mid'][Math.floor(rnd(k * 3.1 + i) * 4)].push({ x, y: groundAt(x, z) - sink, z, up, yaw: yaw + (rnd(k * 6.6 + i) - .5) * .8, tilt: [(rnd(k * 6.1 + i) - .5) * .14, (rnd(k * 7.3 + i) - .5) * .14], size: [wide, tall + sink, deep], seed: rnd(k * 7.7 + i) });
    }
  }
  let rockCount = 0;
  for (const tier of ['hero', 'mid']) rocks[tier].forEach((items, copy) => { if (!items.length) return; rockCount += items.length; const mesh = rockMesh(rockShapes(tier, 4)[copy], items, true); mesh.name = `路旁山石 ${tier}`; group.add(mesh); });

  // 迎客的松：位置换成世界坐标，朝着崖外（离路的方向）探出去
  const pines = trees.map(({ s, o, form, scale }) => { const p = T.point(s, o, 0), q = T.point(s, 0, 0); return { x: p.x, z: p.z, kind: 'pine', form, scale, yaw: Math.atan2(-(p.z - q.z), p.x - q.x) }; });
  return { group, spots, trees: pines, count: { rocks: rockCount, flags: strings.length, lamps: lamps.length } };
}
