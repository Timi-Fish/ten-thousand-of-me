// 飘落的梅瓣：零星几片从梅枝上脱落，打着旋、左右摇摆着落到宣纸和案面上，躺一阵之后慢慢蜷缩消失，再轮到下一片。
// 每一片在任何时刻的位置和姿态都只由时间算出：按各自的周期循环，每一轮的起点、落点、旋转方向都由（第几片、第几轮）决定。
import * as THREE from 'three';
import { rnd, clamp, lerp, TAU } from '../../anim.js';
import { PAL, PAPER, PROPS, WEIGHTS, STAGE, DESK } from '../layout.js';
import { TOP } from './shared.js';

const COUNT = 10, FADE = 3;                                         // 一共几片在轮转（同一时刻两三片在空中，六七片躺着）；消失前蜷缩的秒数
const smooth = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };

// 一片梅瓣：近圆、基部收成一个小爪、瓣尖有个浅缺口，整片像小勺一样微微兜起。朝 +y 的一面是正面
function petalGeometry() {
  const U = 14, V = 18, L = .92, W = .47, pos = [], col = [], idx = [];
  const claw = new THREE.Color('#FFE6BC'), heart = new THREE.Color('#E0603A'), deep = new THREE.Color(PAL.plum).lerp(new THREE.Color(PAL.plumLt), .5), light = new THREE.Color('#FFCBA6'), c = new THREE.Color();
  for (let v = 0; v <= V; v++) for (let u = 0; u <= U; u++) {
    const k = v / V, a = u / U * 2 - 1, half = W * Math.sin(Math.PI * k ** 1.45) ** .55, x = a * half;
    const z = (k - .45) * L - .08 * Math.exp(-((a / .3) ** 2)) * smooth(.75, 1, k);                  // 瓣尖的缺口
    const y = .7 * x * x + .42 * (k - .45) ** 2 + .03 * Math.sin(a * 6 + k * 5) * k * Math.abs(a);   // 两侧和前后翘起，边上有一点波
    pos.push(x, y, z);
    const vein = Math.abs(Math.sin(a * (5.5 - 2 * k) * Math.PI)) ** 6 * smooth(.12, .4, k) * (1 - smooth(.7, 1, k));   // 从基部散开的几道脉
    c.copy(heart).lerp(deep, smooth(.1, .5, k)).lerp(light, clamp(smooth(.45, 1, k) * .7 + Math.abs(a) ** 3 * .5)).lerp(heart, vein * .35).lerp(claw, 1 - smooth(.0, .22, k));
    col.push(c.r, c.g, c.b);
  }
  for (let v = 0; v < V; v++) for (let u = 0; u < U; u++) { const p = v * (U + 1) + u; idx.push(p, p + U + 1, p + 1, p + 1, p + U + 1, p + U + 2); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

// 这一点能不能落：不能落在器物和镇尺上、表演区中间，也不落在纸边（纸边会起翘，纸外一圈是毡）。返回落点的高度，不能落返回 null
function groundAt(x, z) {
  for (const { c, r } of Object.values(PROPS)) if (Math.hypot(x - c[0], z - c[1]) < r + .5) return null;
  for (const w of WEIGHTS) if (Math.abs(x - w.x) < w.w / 2 + .6 && z > w.z0 - .6 && z < w.z1 + .6) return null;
  if (x < DESK.x0 + 1 || x > DESK.x1 - 1 || z < DESK.z0 + 1 || z > DESK.z1 - 1) return null;
  if (Math.hypot(x, z - STAGE.z) < STAGE.r * .62) return null;                                        // 表演区中间是小蟹站的地方，不往那儿落
  const inset = Math.min(x - PAPER.x0, PAPER.x1 - x, z - PAPER.z0, PAPER.z1 - z);                     // 离纸边多远（纸外为负）
  if (inset > 1.6) return 0;
  return inset < -1.6 ? TOP : null;
}

// 梅枝还没装上时（单独预览）顶替的开花处：梅瓶上方 14 到 20、朝表演区探出 5 到 22 的一段
function standInTips() {
  const [vx, vz] = PROPS.vase.c, d = new THREE.Vector2(-vx, STAGE.z - vz).normalize();
  return Array.from({ length: 12 }, (_, i) => { const out = 5 + 17 * rnd(i * 4.1 + 3); return new THREE.Vector3(vx + d.x * out, TOP + 14 + 6 * rnd(i * 6.7 + 9), vz + d.y * out); });
}

export function buildPetals(parent, branchTips) {
  const tips = branchTips && branchTips.length ? branchTips : standInTips();   // 接口约定：总装时由文房模块给出开花处，单独预览时没有
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: .8, emissive: PAL.plum, emissiveIntensity: .14 });   // 一点自发光：薄瓣透光，在冷的月色里仍是暖的
  const mesh = new THREE.InstancedMesh(petalGeometry(), mat, COUNT);
  const tint = new THREE.Color();
  for (let i = 0; i < COUNT; i++) mesh.setColorAt(i, tint.setScalar(1).lerp(new THREE.Color('#FFD9B0'), .5 * rnd(i * 2.9 + 4)).multiplyScalar(.85 + .3 * rnd(i * 8.3 + 1)));
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
  parent.add(mesh);

  const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3();
  // 第 i 片在第 n 轮的行程：从哪里落、落到哪里
  const trip = (i, n) => {
    const seed = i * 17.3 + n * 101.7, start = tips[Math.floor(rnd(seed + 1) * tips.length)];
    for (let k = 0; k < 12; k++) {                                                                    // 顺着屋里的气流往表演区和镜头方向飘出一段；落点不合适就换一个
      const x = start.x + 2 + 13 * rnd(seed + 2 + k * 5.3), z = start.z + 1 + 14 * rnd(seed + 3 + k * 7.9), y = groundAt(x, z);
      if (y !== null) return { seed, start, x, y, z };
    }
    return null;                                                                                      // 十二次都没找到合适的落点：这一轮这片不落
  };
  return {
    update(t) {
      for (let i = 0; i < COUNT; i++) {
        const period = 28 + 14 * rnd(i * 3.7 + 1), at = t + rnd(i * 9.1 + 2) * period, n = Math.floor(at / period), tau = at - n * period, go = trip(i, n);
        if (!go) { mesh.setMatrixAt(i, m.makeScale(0, 0, 0)); continue; }
        const { seed, start } = go, R = k => rnd(seed + 10 + k * 3.3);
        const fall = 7.5 + 4 * R(0), k = clamp(tau / fall), air = smooth(0, .1, k) * (1 - k) ** .7;          // air：还在空中、摆动没有收住的程度
        const turn = (R(1) < .5 ? -1 : 1) * (1.2 + .9 * R(2)), swirl = TAU * R(3) + turn * tau, rock = 2.4 + 1.4 * R(4);
        // 位置：匀速偏加速地下落，同时绕着下落的路线打旋，再叠上左右摇摆
        const flip = R(8) < .45, r = (.6 + .9 * R(5)) * air, sway = (.35 + .4 * R(6)) * air * Math.sin(rock * tau + TAU * R(7));
        p.set(lerp(start.x, go.x, smooth(0, 1, k) * .6 + k * .4) + Math.cos(swirl) * r + sway * .7,
          lerp(start.y, go.y + (flip ? .2 : .02), k ** 1.12) + .22 * air * Math.sin(rock * 2 * tau),      // 反扣着躺的要垫高一个瓣的拱高
          lerp(start.z, go.z, smooth(0, 1, k) * .6 + k * .4) + Math.sin(swirl) * r - sway * .7);
        // 姿态：落地后平躺（正面朝上或朝下），空中时一边自转一边前后左右翻摆，越接近落地摆得越小
        const lie = (flip ? Math.PI : 0) + (R(9) - .5) * .16, spin = TAU * R(10) + turn * 1.6 * fall * (1 - k) ** 1.5;
        e.set(lie + air * 1.25 * Math.sin(rock * tau + TAU * R(11)), spin, (R(12) - .5) * .14 + air * 1.1 * Math.cos(rock * tau * .83 + TAU * R(13)), 'YXZ');
        const size = (.62 + .26 * R(14)) * smooth(0, .35, tau) * (1 - smooth(period - FADE, period, tau));
        mesh.setMatrixAt(i, m.compose(p, q.setFromEuler(e), s.setScalar(size)));
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}
