// 笔架山：青瓷烧的五峰小山，釉面有开片，坐在一方红木底座上。它在表演区正后方，是歌里「下山去」的那座山。
// 五座峰前后错开排成两列，峰与峰之间有两道斜穿过山脊的垭口，两支笔就搁在垭口里。
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { PROPS } from '../layout.js';
import { D, TAU } from '../../anim.js';
import { TOP, V3, fbm, ridge, smooth, field, loft, mesh, soft, merge, moved } from './kit.js';

const A = 6.6, B = 2.95;                                           // 山体占地（椭圆）的半长、半宽
const STAND = .8, FOOT = .1, LIFT = STAND + FOOT;                  // 底座的高度、山脚那圈足的高度；山体从 LIFT 往上长
// 五座峰：x、z 位置，高度，左右的半宽，前后的半深。中间的主峰最高；五座峰前后错开，山脊在平面上是一条折线
const PEAKS = [[-5.0, -1.0, 3.5, 1.5, 1.3], [-2.75, .9, 4.6, 1.7, 1.45], [.15, -.3, 5.9, 2.1, 1.7], [2.9, .9, 4.0, 1.65, 1.4], [5.0, -1.0, 2.8, 1.45, 1.25]];
// 山脚前后的几座小丘，给山添一层近景
const HILLS = [[-4.3, 2.0, 1.2, .95, .8], [-.9, 2.2, 1.55, 1.05, .8], [1.3, 2.2, 1.05, .85, .75], [4.5, 1.9, 1.25, .95, .8], [-1.6, -2.1, 1.5, 1.2, .8], [2.6, -2.0, 1.3, 1.1, .8]];
// 两道垭口：x、z 是笔杆搁在山上的那一点，yaw 是笔尖的朝向（度，从 +x 转向 +z），floor 是垭口底的高度。
// 右边那道低，搁蘸了墨的笔，笔尖朝右前；左边那道高，搁干的笔，笔尖朝左前。两支笔的笔杆在山后交叉，高的压在低的上面
const PASSES = [{ x: 4.0, z: 0, yaw: 25, floor: .92 }, { x: -3.95, z: 0, yaw: 155, floor: 1.8 }];

// 山梁：沿着依次连过五座峰的折线走，高度是两头峰高的四成多，把相邻的峰连起来（垭口就开在山梁上）
function spine(x, z) {
  let best = 0;
  for (let i = 1; i < PEAKS.length; i++) {
    const [x0, z0, h0] = PEAKS[i - 1], [x1, z1, h1] = PEAKS[i], ex = x1 - x0, ez = z1 - z0;
    const t = Math.min(1, Math.max(0, ((x - x0) * ex + (z - z0) * ez) / (ex * ex + ez * ez))), d = Math.hypot(x - x0 - ex * t, z - z0 - ez * t);
    best = Math.max(best, (h0 + (h1 - h0) * smooth(0, 1, t)) * .43 * Math.exp(-((d / 1.05) ** 2)));
  }
  return best;
}
// 没开垭口时的山形：每座峰顶圆、坡陡、往下放射出一道道沟壑，再和山梁、小丘融在一起
function natural(x, z) {
  const wx = x + (fbm(x * .5, z * .5, 3.1) - .5) * .35, wz = z + (fbm(x * .5 + 9.2, z * .5, 1.7) - .5) * .3;
  let sum = spine(wx, wz) ** 5;
  [...PEAKS, ...HILLS].forEach(([px, pz, h, w, dep], i) => {
    const dx = (wx - px) / w, dz = (wz - pz) / dep, d = Math.hypot(dx, dz), ang = Math.atan2(dz, dx);
    const gully = ridge(Math.cos(ang) * 1.5 + i * 5.3, Math.sin(ang) * 1.5, d * .8 + i * 3.1, 3) - .5;
    sum += (h * Math.exp(-((d * (1 + .34 * gully * Math.min(1, d * 2.2)) / .68) ** 2.3))) ** 5;
  });
  return sum ** .2;
}

// 一支笔搁在垭口里的姿态。shaftR 笔杆半径，seatAt 搁点离笔尾多远。笔尾落在案面上，所以搁点越高笔越斜
function seatOf(pass, shaftR, seatAt) {
  const rise = LIFT + pass.floor, sin = rise / seatAt, cos = Math.sqrt(1 - sin * sin), yaw = pass.yaw * D;
  const flat = new V3(Math.cos(yaw), 0, Math.sin(yaw));
  return { ...pass, flat, tan: sin / cos, dir: new V3(flat.x * cos, sin, flat.z * cos), y: pass.floor + shaftR };
}

// 下山的路：一条窄窄的石阶，在主峰正面来回折着往下绕，经过山前小丘上的亭子，一直下到山脚。歌里的「下山去」走的就是它。
// 做成贴在山坡上的一条带子：顶面横向是平的，两侧各垂下一道边，所以在陡坡上像凿出来的栈道
function buildTrail(height) {
  const [cx, cz, , w, dep] = PEAKS[2], turns = [[.3, 64], [.4, 126], [.5, 54], [.6, 130], [.7, 58], [.8, 112]], ctrl = [];
  for (let i = 0; i < turns.length - 1; i++) for (let k = 0; k < 8; k++) {
    const t = k / 8, d = turns[i][0] + (turns[i + 1][0] - turns[i][0]) * t, a = (turns[i][1] + (turns[i + 1][1] - turns[i][1]) * t) * D;
    ctrl.push([cx + w * d * Math.cos(a), cz + dep * d * Math.sin(a)]);
  }
  ctrl.push([-.48, .96], [-.74, 1.5], [-.93, 1.9], [-.78, 2.42], [-.3, 2.62], [.15, 2.82]);
  const pos = [], col = [], idx = [], HALF = .05, DROP = .07;
  let steps = 0, n = 0;
  for (let i = 0; i < ctrl.length - 1; i++) {
    const [x0, z0] = ctrl[i], [x1, z1] = ctrl[i + 1], len = Math.hypot(x1 - x0, z1 - z0), tx = (x1 - x0) / len, tz = (z1 - z0) / len, count = Math.max(1, Math.round(len / .04));
    for (let k = 0; k <= count; k++, n++) {
      const x = x0 + (x1 - x0) * k / count, z = z0 + (z1 - z0) * k / count, y = height(x, z) + .012, shade = (steps++ % 2 ? .8 : 1) * (.94 + .06 * Math.sin(n));
      for (const [side, dy] of [[-1, -DROP], [-1, 0], [1, 0], [1, -DROP]]) { pos.push(x - tz * side * HALF, y + dy, z + tx * side * HALF); col.push(shade, shade, shade); }
      if (k) for (let j = 0; j < 3; j++) { const a = (n - 1) * 4 + j, b = a + 4; idx.push(a, a + 1, b, a + 1, b + 1, b); }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  const flat = geo.toNonIndexed();
  flat.computeVertexNormals();
  return flat;
}
// 山前小丘上的亭子：六角的小亭，白石台基、朱红柱子、黄釉的攒尖顶
function buildPavilion() {
  const group = new THREE.Group(), six = (r, y, fn) => Array.from({ length: 6 }, (_, i) => fn(Math.cos((i + .5) / 6 * TAU) * r, y, Math.sin((i + .5) / 6 * TAU) * r));
  const stone = soft({ color: '#E9E2D2', roughness: .85, rim: .15 });
  group.add(mesh(merge([moved(new THREE.CylinderGeometry(.28, .31, .08, 6), 0, .04, 0), moved(new THREE.CylinderGeometry(.24, .24, .04, 6), 0, .1, 0)]), stone));
  group.add(mesh(merge([...six(.2, .28, (x, y, z) => moved(new THREE.CylinderGeometry(.02, .022, .34, 6), x, y, z)), moved(new THREE.CylinderGeometry(.215, .215, .035, 6, 1, true), 0, .43, 0)]),
    soft({ color: '#B23A38', roughness: .7, rim: .2 })));
  const roof = new THREE.LatheGeometry([[.39, .03], [.35, 0], [.25, .05], [.14, .15], [.06, .27], [.02, .36], [0, .37]].map(([r, y]) => new THREE.Vector2(r, y)), 6).toNonIndexed();
  roof.computeVertexNormals();                                       // 六个坡面各自是平的，屋脊才分明
  group.add(mesh(merge([moved(roof, 0, .44, 0, 0, TAU / 12, 0), moved(new THREE.SphereGeometry(.04, 8, 6), 0, .84, 0)]),
    soft({ color: '#D09A36', roughness: .6, rim: .3, rimColor: '#FFE9B0', albedo: 'col *= .85 + .3 * fbm(p * 9.);' })));
  return group;
}

export function buildRest({ shaftR, seatAt }) {
  const seats = PASSES.map(p => seatOf(p, shaftR, seatAt));
  // 垭口：沿笔的走向在山上开一道槽，槽底跟着笔杆走，笔斗和笔头经过的地方再让开一些
  const height = (x, z) => {
    let h = natural(x, z);
    for (const s of seats) {
      const along = (x - s.x) * s.flat.x + (z - s.z) * s.flat.z, side = Math.abs((z - s.z) * s.flat.x - (x - s.x) * s.flat.z);
      const groove = s.floor + along * s.tan - .5 * smooth(.3, 1.4, along) + 1.7 * Math.max(0, side - .34) ** 1.4;
      h = -Math.log(Math.exp(-7 * h) + Math.exp(-7 * groove)) / 7;      // 取两者里低的那个，交界处圆顺
    }
    return h;
  };
  // 山面的高度：山形在占地边缘收到一圈圆鼓的山脚上
  const shell = (x, z) => { const rho = Math.min(1, Math.hypot(x / A, z / B)); return Math.max(0, height(x, z)) * (1 - rho ** 8) + .24 * Math.sqrt(1 - rho ** 6); };
  const NX = 290, NZ = 116, ys = [];
  const body = field(NX, NZ, (u, v) => {
    const x = u * Math.sqrt(1 - v * v / 2) * A, z = v * Math.sqrt(1 - u * u / 2) * B, y = shell(x, z);   // 方格子压成圆盘，再拉成椭圆
    ys.push(y);
    return [x, y, z];
  });
  // 釉的厚薄：凹处积釉，颜色深；棱线上釉薄，颜色浅，露一点胎色
  const tone = [], pool = new THREE.Color('#4E9C8A'), mid = new THREE.Color('#9BD0BE'), thin = new THREE.Color('#EAF2DF'), c = new THREE.Color();
  const at = (i, j) => ys[Math.min(NZ, Math.max(0, j)) * (NX + 1) + Math.min(NX, Math.max(0, i))];
  for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) {
    const bulge = at(i, j) - (at(i - 3, j) + at(i + 3, j) + at(i, j - 3) + at(i, j + 3)) / 4;
    const wide = at(i, j) - (at(i - 9, j) + at(i + 9, j) + at(i, j - 9) + at(i, j + 9)) / 4;
    const k = Math.max(-1, Math.min(1, bulge / .03 + wide / .35 + (at(i, j) - 2.2) * .07));
    c.copy(mid).lerp(k > 0 ? thin : pool, Math.abs(k) ** .8 * (k > 0 ? .8 : .85));
    tone.push(c.r, c.g, c.b);
  }
  body.setAttribute('color', new THREE.Float32BufferAttribute(tone, 3));
  const glaze = soft({
    color: '#FFFFFF', vertexColors: true, roughness: .6, rim: .28, rimColor: '#CFE9F2', rimPow: 2.6, bump: .008,
    emissive: '#1C3A36', emissiveIntensity: .3,
    albedo: /* glsl */`
      float big = hair(crack(p * 1.8 + 3.), .011), fine = hair(crack(p * 4.6 + 11.), .012) * (1. - big);
      col *= .93 + .14 * fbm(p * 1.3);
      col = mix(col, vec3(.24, .18, .14), big * .6);                    // 粗的开片：深褐的「铁线」
      col = mix(col, vec3(.70, .56, .34), fine * .3);                   // 细的开片：浅黄的「金丝」
      gBump = -(big * .6 + fine * .25);`,
  });
  const group = new THREE.Group(), surface = (x, z) => shell(x, z) + LIFT;
  group.add(mesh(body, glaze));
  const trail = mesh(buildTrail(surface), soft({ color: '#EFE8D8', vertexColors: true, roughness: .85, rim: .15, side: THREE.DoubleSide }), { cast: false });
  const pavilion = buildPavilion();
  pavilion.position.set(-.92, surface(-.92, 2.17) - .05, 2.17);
  group.add(trail, pavilion);

  // 山脚一圈不上釉的足，和红木底座：束腰、托泥、六只小足
  const oval = (a, b) => k => [Math.cos(k * TAU) * a, Math.sin(k * TAU) * b];
  const foot = mesh(loft(oval(A, B), [[-.3, FOOT], [.03, FOOT], [.06, FOOT * .6], [.03, 0], [-.3, 0]]),
    soft({ color: '#6B5445', roughness: .9, rim: .1, albedo: 'col *= .8 + .4 * fbm(p * 6.);' }));
  foot.position.y = STAND;
  body.translate(0, STAND + FOOT, 0);
  group.add(foot);
  const wood = soft({
    color: '#4A2226', roughness: .62, rim: .22, rimColor: '#C9B6E8', bump: .006,
    albedo: /* glsl */`
      float g = fbm(vec3(p.x * .7, p.y * 7., p.z * 2.2) + fbm(p * .6) * 2.);
      float line = abs(fract(g * 11.) - .5) * 2.;
      col *= .62 + .7 * g; col = mix(col, col * .45, smoothstep(.75, 1., line) * .6);
      gBump = line * .5;`,
  });
  const a = A + .34, b = B + .34;
  const stand = [loft(oval(a, b), [[-.6, STAND], [-.1, STAND], [-.02, STAND - .03], [0, STAND - .1], [-.1, STAND - .16], [-.2, STAND - .2], [-.2, STAND - .36],
    [-.06, STAND - .42], [.04, STAND - .5], [.04, STAND - .6], [-.03, STAND - .64], [-.5, STAND - .64]], 200)];
  for (let i = 0; i < 6; i++) {
    const k = (i + .5) / 6, [fx, fz] = oval(a - .55, b - .5)(k);
    stand.push(moved(new RoundedBoxGeometry(.95, .14, .5, 3, .06), fx, .06, fz, 0, k * TAU * (i % 3 === 1 ? 0 : .12), 0));
  }
  const base = mesh(merge(stand), wood);
  group.add(base);
  const [cx, cz] = PROPS.brushRest.c;
  group.position.set(cx, TOP, cz);
  // 交给外面：每支笔搁点的世界坐标（笔杆轴线上的点）和笔尖的朝向
  return { group, seats: seats.map(s => ({ pos: new V3(cx + s.x, TOP + LIFT + s.y, cz + s.z), dir: s.dir })) };
}
