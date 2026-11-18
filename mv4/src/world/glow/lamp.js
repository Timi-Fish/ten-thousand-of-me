// 油灯的器形：一盏竹节柄的铜灯。自下而上是承盘（接灯油的浅盘，盘心隆起一圈覆莲）、竹节灯柱（中间一枚刻回纹的扁圆节）、
// 两层仰莲托着的灯盏。盏里有灯油，盏心立一根灯柱夹着灯芯，盏沿搭一根拨灯芯的铜签，盏侧一只带云头的环柄。
// 火苗和火光在 flame.js。这里的尺寸以书案台面为 0，整盏灯放在 PROPS.lamp 的落脚点上。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PROPS } from '../layout.js';
import { TOP, profile, lathe, flatCavity } from './shared.js';
import { bronze, ornament } from './materials.js';

// 各段的高度。灯做得比 PROPS.lamp.h 矮：全景机位在灯这个深度只能看到约 8.8 高，火苗要留在画面里。要加高只改两段灯柱的长度
const STEM_A = 1.06, STEM_B = 1.0, KNOB = .86, TRAY = 1.24;
const Y1 = TRAY + STEM_A, Y2 = Y1 + KNOB, Y3 = Y2 + STEM_B;           // 扁圆节底、上段灯柱底、灯盏底
export const WICK_TIP = Y3 + 2.47;                                    // 灯芯顶端（火苗的根）离台面的高度
const FLAME_LOCAL = new THREE.Vector3(0, WICK_TIP + .7, 0);

const bamboo = (y, len) => [[.3, y], [.265, y + .08], [.26, y + len / 2 - .15], [.29, y + len / 2 - .05], 'c', [.34, y + len / 2], 'c',
  [.29, y + len / 2 + .05], [.26, y + len / 2 + .15], [.265, y + len - .08], [.3, y + len]];
// 灯座：承盘、盘心的覆莲台、两段竹节柱和中间的扁圆节，一气呵成的一条轮廓
const STAND = [
  [.93, 0], [1.01, .01], 'c', [1.04, .14], [1.12, .22], [1.5, .29], [1.74, .4], [1.79, .5], 'c', [1.77, .57], [1.72, .58], 'c',
  [1.66, .52], [1.56, .4], [1.4, .35], [1.02, .34], 'c', [.94, .38], [.82, .5], [.66, .76], [.52, .98], [.44, 1.06], 'c',
  [.47, 1.1], [.47, 1.18], 'c', [.4, 1.22], [.3, TRAY], 'c', ...bamboo(TRAY, STEM_A).slice(1), 'c',
  [.37, Y1 + .02], 'c', [.39, Y1 + .08], [.35, Y1 + .12], 'c', [.5, Y1 + .18], [.64, Y1 + .31], [.68, Y1 + .43], [.64, Y1 + .55], [.5, Y1 + .68], [.35, Y1 + .74], 'c',
  [.39, Y1 + .78], [.37, Y1 + .84], 'c', [.3, Y2], 'c', ...bamboo(Y2, STEM_B).slice(1),
];
// 灯盏的外壁：柱头一道箍，往上是碗腹，口沿外侈
const BELLY = [[.38, Y3 + .14], [.6, Y3 + .2], [1.0, Y3 + .42], [1.32, Y3 + .8], [1.48, Y3 + 1.25], [1.53, Y3 + 1.55], [1.6, Y3 + 1.66], [1.63, Y3 + 1.72]];
const BOWL = [[.3, Y3], [.4, Y3 + .02], 'c', [.42, Y3 + .1], BELLY[0], 'c', ...BELLY.slice(1)];
// 口沿顶面和内壁：离火太近，不走灯光，颜色直接按离火的远近算好（见 litByFlame）
const INNER = [[1.63, Y3 + 1.72], [1.6, Y3 + 1.77], [1.54, Y3 + 1.76], 'c', [1.46, Y3 + 1.6], [1.38, Y3 + 1.3], [1.14, Y3 + .9], [.7, Y3 + .66], [.25, Y3 + .6], [0, Y3 + .6]];
const OIL_Y = Y3 + 1.5, OIL_R = 1.43;
const POST = [[.26, Y3 + .6], [.2, Y3 + .72], [.1, Y3 + 1.6], [.095, Y3 + 2.04], 'c', [.15, Y3 + 2.07], [.15, Y3 + 2.2], 'c', [.1, Y3 + 2.2], [0, Y3 + 2.2]];

// 碗腹外壁上的一点：k 是从柱头的箍（0）到口沿（1）的弧长比例。返回位置和朝外的法线（都在过轴线的平面里）
function bowlSurface() {
  const pts = profile(BELLY, .03), arc = [0];
  for (let i = 1; i < pts.length; i++) arc[i] = arc[i - 1] + pts[i].distanceTo(pts[i - 1]);
  return k => {
    const s = k * arc.at(-1); let i = 1;
    while (i < pts.length - 1 && arc[i] < s) i++;
    const q = (s - arc[i - 1]) / (arc[i] - arc[i - 1]), p = pts[i - 1].clone().lerp(pts[i], q), d = pts[i].clone().sub(pts[i - 1]).normalize();
    return { r: p.x, y: p.y, nr: d.y, ny: -d.x };
  };
}

// 一圈仰莲瓣：贴着碗腹的浮雕。每瓣中间鼓起、有一道中脊，瓣尖微微离开碗壁往外翘。lift 是整瓣高出碗壁多少（前一层比后一层高）
function lotusRow(surface, { n, phase, k0, k1, lift, puff }) {
  const A = 18, K = 28, pos = [], cav = [], idx = [];
  for (let i = 0; i < n; i++) {
    const base = pos.length / 3, mid = phase + i / n * Math.PI * 2;
    for (let kk = 0; kk <= K; kk++) for (let aa = 0; aa <= A; aa++) {
      const k = kk / K, a = (aa / A * 2 - 1) * 1.12, ac = THREE.MathUtils.clamp(a, -1, 1);      // |a| 超过 1 的一圈是瓣边垂到碗壁的侧壁
      const width = (1 - k ** 2.2) ** .6 * (.72 + .28 * THREE.MathUtils.smoothstep(k, 0, .4)) * (1 - .25 * THREE.MathUtils.smoothstep(k, .7, 1));
      const s = surface(k0 + (k1 - k0) * k), th = mid + ac * Math.PI / n * .97 * width;
      const pillow = puff * Math.sqrt(1 - ac ** 4) * Math.sqrt(Math.sin(Math.PI * Math.min(1, .08 + k * .98))) + puff * .3 * Math.exp(-((ac / .13) ** 2));
      const h = Math.abs(a) > 1 ? THREE.MathUtils.lerp(lift, -.03, (Math.abs(a) - 1) / .12) : lift + pillow + .13 * k ** 3;
      const r = s.r + s.nr * h, y = s.y + s.ny * h;
      pos.push(Math.cos(th) * r, y, -Math.sin(th) * r);
      cav.push(ac ** 4 * .9 - Math.exp(-((ac / .2) ** 2)) * .85);
    }
    for (let kk = 0; kk < K; kk++) for (let aa = 0; aa < A; aa++) {
      const p = base + kk * (A + 1) + aa;
      idx.push(p, p + 1, p + A + 1, p + 1, p + A + 2, p + A + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('cavity', new THREE.Float32BufferAttribute(cav, 1));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3 * 2), 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

// 离火很近的部件不受灯光照射，颜色按「离火多远、朝不朝火」直接算进顶点色里。albedo(p) 给出各处的本色
function litByFlame(g, albedo) {
  const P = g.attributes.position, N = g.attributes.normal, c = new Float32Array(P.count * 3), p = new THREE.Vector3(), n = new THREE.Vector3(), L = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) {
    p.fromBufferAttribute(P, i); n.fromBufferAttribute(N, i); L.copy(FLAME_LOCAL).sub(p);
    const d = L.length(), facing = Math.max(n.dot(L) / d, 0) * .8 + .2, e = Math.min(1.1, 1.2 / (d * d + .6)) * facing, a = albedo(p);
    c.set([a.r * (e + .03), a.g * (e * .7 + .035), a.b * (e * .36 + .05)], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(name)) g.deleteAttribute(name);
  return g;
}

export function buildLamp(parent, warm) {
  const [cx, cz] = PROPS.lamp.c, lamp = new THREE.Group();
  lamp.position.set(cx, TOP, cz); lamp.rotation.y = .5;
  parent.add(lamp); lamp.updateWorldMatrix(true, false);
  const flame = lamp.localToWorld(FLAME_LOCAL.clone()), shared = { warm, bounce: 1 };

  // 灯座
  const standGeo = lathe(profile(STAND), 96), v = standGeo.userData.vAt;
  const stand = new THREE.Mesh(standGeo, bronze({ ...shared, seed: 3, rust: .52, bumpScale: .09, bump: ornament([
    { kind: 'lines', v0: v(1.2, .23), v1: v(1.74, .4), n: 1 },
    { kind: 'lotus', v0: v(.94, .38), v1: v(.47, 1.04), n: 12, up: false },
    { kind: 'pearls', v0: v(.47, 1.1), v1: v(.47, 1.18), n: 30 },
    { kind: 'fret', v0: v(.6, Y1 + .27), v1: v(.6, Y1 + .59), n: 14 },
    { kind: 'pearls', v0: v(.39, Y1 + .06), v1: v(.36, Y1 + .12), n: 26 }, { kind: 'pearls', v0: v(.36, Y1 + .74), v1: v(.39, Y1 + .8), n: 26 },
  ], 2048, 2048) }));

  // 灯盏外壁、莲瓣、环柄
  const bowlGeo = lathe(profile(BOWL), 96), bv = bowlGeo.userData.vAt, surface = bowlSurface();
  const bowl = new THREE.Mesh(bowlGeo, bronze({ ...shared, seed: 11, rust: .46, bumpScale: .07, bump: ornament([
    { kind: 'cloud', v0: bv(1.47, Y3 + 1.2), v1: bv(1.53, Y3 + 1.52), n: 11 }, { kind: 'lines', v0: bv(1.53, Y3 + 1.55), v1: bv(1.6, Y3 + 1.66), n: 1 },
  ], 2048, 1024) }));
  const ring = flatCavity(new THREE.TorusGeometry(.36, .075, 14, 48)).translate(1.72, Y3 + 1.08, 0);
  const plate = flatCavity(new THREE.SphereGeometry(1, 24, 14), -.5).scale(.36, .05, .25).rotateZ(-.16).translate(1.94, Y3 + 1.5, 0);
  const stud = flatCavity(new THREE.SphereGeometry(.07, 12, 8), -.8).translate(2.02, Y3 + 1.53, 0);
  const handle = mergeGeometries([ring, plate, stud]).rotateY(Math.PI * .8);
  const petals = new THREE.Mesh(mergeGeometries([
    lotusRow(surface, { n: 8, phase: Math.PI / 8, k0: .0, k1: .68, lift: .012, puff: .05 }),
    lotusRow(surface, { n: 8, phase: 0, k0: .0, k1: .54, lift: .07, puff: .085 }), handle,
  ]), bronze({ ...shared, seed: 23, rust: .5 }));

  // 盏里：内壁、灯油、夹灯芯的小柱、灯芯、铜签。都按离火的远近直接上色
  const rgb = (r, g, b) => () => ({ r, g, b });
  const soot = p => { const k = THREE.MathUtils.smoothstep(p.y, Y3 + 1.2, Y3 + 1.78); return { r: .3 - .2 * k, g: .23 - .16 * k, b: .13 - .09 * k }; };   // 内壁越靠口沿熏得越黑
  // 灯油：深琥珀色，贴着盏壁的一圈因为油面上爬而略亮，灯芯底下映着一团火光
  const oil = p => { const r = Math.hypot(p.x, p.z), rim = THREE.MathUtils.smoothstep(r, OIL_R - .1, OIL_R), core = Math.exp(-r * r * 3.5); return { r: .1 + .16 * rim + .75 * core, g: .04 + .07 * rim + .4 * core, b: .008 + .02 * rim + .1 * core }; };
  const wickPath = new THREE.CatmullRomCurve3([new THREE.Vector3(0, Y3 + 2.05, 0), new THREE.Vector3(.01, Y3 + 2.26, 0), new THREE.Vector3(.045, WICK_TIP - .04, .015)]);
  const char = p => { const k = THREE.MathUtils.smoothstep(p.y, Y3 + 2.16, WICK_TIP - .2), twist = .85 + .15 * Math.sin(p.y * 60 + Math.atan2(p.z, p.x) * 2); return { r: (.62 - .6 * k) * twist, g: (.5 - .49 * k) * twist, b: (.34 - .33 * k) * twist }; };
  const a = -.55, dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));                                   // 铜签搭在盏沿上的方位
  const pickPath = new THREE.LineCurve3(dir.clone().multiplyScalar(.5).setY(OIL_Y - .2), dir.clone().multiplyScalar(2.3).setY(Y3 + 2.13));
  const pickEnd = new THREE.SphereGeometry(1, 16, 10).scale(.15, .035, .08).rotateZ(.4).rotateY(-a).translate(dir.x * 2.36, Y3 + 2.16, dir.z * 2.36);
  const inside = new THREE.Mesh(mergeGeometries([
    litByFlame(lathe(profile(INNER), 96), soot),
    litByFlame(lathe([new THREE.Vector2(OIL_R, OIL_Y), new THREE.Vector2(1.2, OIL_Y), new THREE.Vector2(.6, OIL_Y), new THREE.Vector2(.3, OIL_Y), new THREE.Vector2(.1, OIL_Y)], 72), oil),
    litByFlame(lathe(profile(POST), 32), rgb(.3, .22, .12)),
    litByFlame(new THREE.TubeGeometry(wickPath, 16, .062, 10), char),
    litByFlame(new THREE.SphereGeometry(.062, 10, 8).translate(.045, WICK_TIP - .04, .015), rgb(.02, .012, .008)),
    litByFlame(new THREE.TubeGeometry(pickPath, 8, .032, 8), rgb(.34, .26, .13)),
    litByFlame(pickEnd, rgb(.36, .28, .14)),
  ]), new THREE.MeshBasicMaterial({ vertexColors: true }));
  // 灯芯顶上烧红的一点
  const ember = new THREE.Mesh(new THREE.SphereGeometry(.05, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, .42, .08) }));
  ember.position.set(.045, WICK_TIP - .015, .015); ember.scale.set(1, .6, 1);

  for (const m of [stand, bowl, petals]) { m.castShadow = true; m.receiveShadow = true; }
  lamp.add(stand, bowl, petals, inside, ember);
  return {
    wick: lamp.localToWorld(new THREE.Vector3(.045, WICK_TIP, .015)), flame,
    setPower(p) { inside.material.color.setScalar(p); ember.material.color.setRGB(1.5 * p, .42 * p, .08 * p); },
  };
}
