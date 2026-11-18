// 梅花：五瓣，橙红色，有花蕊、花萼。盛开的、半开的、花苞各做一个模子，再沿着梅枝摆上几百朵（实例化）。
import * as THREE from 'three';
import { PAL } from '../layout.js';
import { TAU } from '../../anim.js';
import { V3, stream, pick, smooth, soft, merge } from './kit.js';
import { settle } from './plum.js';

const L = .56;                                                      // 一片花瓣的长度（盛开的花直径约是它的两倍）
const HUE = { deep: new THREE.Color('#D2391C'), mid: new THREE.Color(PAL.plum), light: new THREE.Color(PAL.plumLt), calyx: new THREE.Color('#6E2826'), thread: new THREE.Color('#FFE6B4'), anther: new THREE.Color('#F4B531'), heart: new THREE.Color('#C9B958') };

// 给一个几何体整体刷上一种颜色（color 可以是按顶点位置算的函数）
function dyed(geo, color) {
  const flat = geo.index ? geo.toNonIndexed() : geo, pos = flat.attributes.position, col = [], p = new V3();
  for (let i = 0; i < pos.count; i++) { const c = typeof color === 'function' ? color(p.fromBufferAttribute(pos, i)) : color; col.push(c.r, c.g, c.b); }
  flat.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  flat.deleteAttribute('uv');
  return flat;
}
// 一片薄片：grid(a, b) 给出每个格点的位置和颜色，a 横向 -1..1，b 纵向 0..1
function sheet(na, nb, at) {
  const pos = [], col = [], idx = [];
  for (let j = 0; j <= nb; j++) for (let i = 0; i <= na; i++) { const [p, c] = at(i / na * 2 - 1, j / nb); pos.push(p.x, p.y, p.z); col.push(c.r, c.g, c.b); }
  for (let j = 0; j < nb; j++) for (let i = 0; i < na; i++) { const a = j * (na + 1) + i, b = a + na + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx); geo.computeVertexNormals();
  return geo.toNonIndexed();
}
// 一片花瓣。turn 花瓣朝哪个方向（绕花心），lift 翘起的角度（0 平摊，90° 竖直），size 大小，cup 瓣面兜起来的程度
function petal(turn, lift, size, cup, rand) {
  const len = L * size, wid = len * pick(rand, .54, .62), skew = pick(rand, -.06, .06), cs = Math.cos(lift), sn = Math.sin(lift), ct = Math.cos(turn), st = Math.sin(turn);
  return sheet(6, 6, (a, t) => {
    const b = 1 - (1 - t) ** 1.7;                                    // 格子往瓣尖加密，瓣尖才圆得起来
    const half = wid * Math.sin(Math.PI * (b * .95 + .03)) ** .58 * (.7 + .3 * b), u = a * half + skew * len * b * b, v = len * b;
    const w = cup * len * b * b + .55 * u * u / len + .03 * len * Math.sin(a * 3.1 + turn * 3) * b * b;   // 瓣面像小勺：顺着长向往上兜，两边也翘起来
    const out = v * cs - w * sn, up = v * sn + w * cs;
    const c = HUE.deep.clone().lerp(HUE.mid, smooth(.05, .45, b)).lerp(HUE.light, smooth(.5, 1, b) * .7 + .25 * a * a * b);
    return [new V3(ct * out - st * u, up, st * out + ct * u), c];
  });
}
// 花蕊：一圈细丝，丝头顶着金黄的花药；中间是花心
function stamens(count, reach, spread, rand) {
  const parts = [dyed(new THREE.SphereGeometry(.075, 8, 5, 0, TAU, 0, Math.PI / 2).translate(0, .01, 0), HUE.heart)];
  for (let i = 0; i < count; i++) {
    const turn = (i + rand()) / count * TAU, tilt = pick(rand, .25, 1) * spread, len = reach * pick(rand, .7, 1.05);
    const tip = new V3(Math.cos(turn) * Math.sin(tilt), Math.cos(tilt), Math.sin(turn) * Math.sin(tilt)).multiplyScalar(len).add(new V3(0, .02, 0));
    const thread = new THREE.CylinderGeometry(.006, .011, len, 3, 1, true).translate(0, len / 2, 0);
    thread.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), tip.clone().normalize()));
    parts.push(dyed(thread, HUE.thread), dyed(new THREE.OctahedronGeometry(.024).scale(1, 1.35, 1).translate(tip.x, tip.y, tip.z), HUE.anther));
  }
  return parts;
}
// 花萼和花梗：花背面五片深红褐色的小萼片，下面一小段梗连到枝上
function calyx(lift, size, rand) {
  const parts = [dyed(new THREE.CylinderGeometry(.1 * size, .035, .13, 7, 1, true).translate(0, -.075, 0), HUE.calyx)];
  for (let i = 0; i < 5; i++) {
    const turn = (i + .5) / 5 * TAU + pick(rand, -.1, .1), ct = Math.cos(turn), st = Math.sin(turn), cs = Math.cos(lift), sn = Math.sin(lift), len = .17 * size;
    parts.push(sheet(2, 3, (a, b) => {
      const u = a * len * .42 * Math.sin(Math.PI * (b * .86 + .14)) ** .8, out = len * b * cs + .05, up = len * b * sn - .035 + .02 * (1 - a * a);
      return [new V3(ct * out - st * u, up, st * out + ct * u), HUE.calyx];
    }));
  }
  return parts;
}
function moulds() {
  const rand = stream(201), five = (lift, cup, size) => Array.from({ length: 5 }, (_, i) => petal(i / 5 * TAU + pick(rand, -.07, .07), lift + pick(rand, -.08, .08), size * pick(rand, .93, 1.06), cup, rand));
  const open = merge([...five(.3, .22, 1), ...stamens(14, .36, 1, rand), ...calyx(-.2, 1, rand)]);
  const half = merge([...five(1.02, .42, .9), ...stamens(8, .3, .5, rand), ...calyx(.35, .95, rand)]);
  // 花苞：一个尖头的小球，根部包着花萼
  const egg = [];
  for (let i = 0; i <= 8; i++) { const b = i / 8; egg.push(new THREE.Vector2(.2 * Math.sin(Math.PI * b ** .75) ** .8 + .001, .36 * b - .02)); }
  const bud = merge([dyed(new THREE.LatheGeometry(egg, 9), p => HUE.deep.clone().lerp(HUE.mid, smooth(.02, .3, p.y)).lerp(HUE.light, smooth(.22, .36, p.y) * .5)), ...calyx(1.05, 1.15, rand)]);
  return { open, half, bud };
}

// 沿枝条摆花。越靠梢头越多是花苞，越靠枝条根部越多是盛开的。返回三种花各自的位置、朝向、大小
function scatter(limbs) {
  const rand = stream(260), spots = { open: [], half: [], bud: [] }, toward = new V3(.05, .2, .75);
  for (const limb of limbs) {
    const total = limb.pts.reduce((s, p, i) => s + (i ? p.distanceTo(limb.pts[i - 1]) : 0), 0), gap = (limb.kind === 'old' ? .8 : .56) / limb.bear;
    let run = 0, next = total * limb.from + rand() * gap;
    for (let i = 1; i < limb.pts.length - 1; i++) {
      run += limb.pts[i].distanceTo(limb.pts[i - 1]);
      if (run < next) continue;
      next = run + gap * pick(rand, .6, 1.5);
      const tan = new V3().subVectors(limb.pts[i + 1], limb.pts[i - 1]).normalize(), along = run / total;
      for (let n = rand() < .4 ? 2 : 1; n > 0; n--) {
        const side = new V3(rand() - .5, rand() - .5, rand() - .5).cross(tan).normalize();
        const face = side.addScaledVector(toward, pick(rand, .3, 1.1)).addScaledVector(tan, pick(rand, -.2, .4)).normalize();   // 花朝外开，多数偏向镜头这一侧
        const mood = rand() + (limb.kind === 'young' ? along * .55 : 0), kind = mood > 1.02 ? 'bud' : mood > .8 ? 'half' : mood < .1 ? 'bud' : 'open';
        const size = pick(rand, .82, 1.22) * (kind === 'bud' ? pick(rand, .7, 1.1) : 1);
        const pos = settle(limb.pts[i].clone().addScaledVector(face, limb.radii[i] + .1), L * size + .15);
        spots[kind].push({ pos, face, size });
      }
    }
  }
  return spots;
}

// 返回 { group, tips }：tips 是盛开的花里挑出来的三十来处，梅瓣从这些地方飘落
export function buildBlossoms(limbs, wrap) {
  const group = new THREE.Group(), rand = stream(301), geo = moulds(), spots = scatter(limbs);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), spin = new THREE.Quaternion(), up = new V3(0, 1, 0), c = new THREE.Color(), pale = new THREE.Color(1.08, .92, .84);
  for (const kind of ['open', 'half', 'bud']) {
    // 花瓣很薄，月光从背后照过来时会透出一点自己的颜色
    const mat = wrap(soft({ color: '#FFFFFF', vertexColors: true, roughness: .78, side: THREE.DoubleSide, rim: .12, rimColor: '#FFD9C2', albedo: 'gGlow = col * .2;' }));
    const flowers = new THREE.InstancedMesh(geo[kind], mat, spots[kind].length);
    spots[kind].forEach((s, i) => {
      q.setFromUnitVectors(up, s.face).multiply(spin.setFromAxisAngle(up, rand() * TAU));
      flowers.setMatrixAt(i, m.compose(s.pos, q, new V3(s.size, s.size, s.size)));
      flowers.setColorAt(i, c.setScalar(pick(rand, .86, 1.1)).lerp(pale, rand() * .35));   // 每朵深浅略有不同，有的偏浅
    });
    flowers.receiveShadow = true;
    group.add(flowers);
  }
  const near = spots.open.filter(s => s.pos.x > -13 && s.pos.x < 12 && s.pos.z > -19).sort((a, b) => a.pos.x - b.pos.x);
  const tips = Array.from({ length: 32 }, (_, i) => near[Math.floor((i + .5) / 32 * near.length)].pos.clone());
  // 每朵花最低能到哪（花心高度减去花的半径），给外面核对表演区上空的净空用
  const reach = Object.values(spots).flat().map(s => ({ x: s.pos.x, z: s.pos.z, low: s.pos.y - L * s.size }));
  return { group, tips, reach, count: { open: spots.open.length, half: spots.half.length, bud: spots.bud.length } };
}
