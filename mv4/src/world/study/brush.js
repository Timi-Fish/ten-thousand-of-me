// 毛笔：竹笔杆（有竹节、刻字）、笔顶和挂绳、笔斗，以及由几千根毛组成的笔头。
// 整支笔沿 +y 建：笔尾在 y = 0，笔尖在最上面。笔架山上那两支和笔筒里那几支都用这里的做法。
import * as THREE from 'three';
import { PAL } from '../layout.js';
import { TAU } from '../../anim.js';
import { V3, KAI, stream, pick, turn, tube, mesh, soft, canvasTex } from './kit.js';

// 笔头的外形：s 从笔根 0 到笔尖 1，返回这一处的半径是笔根的几倍
const SHAPES = {
  wet: s => (1 + 1.25 * s) * (1 - s ** 1.5) ** 1.1,                 // 蘸饱了墨：肚子鼓，收成一个尖锋
  point: s => (1 + .9 * s) * (1 - s ** 1.9) ** .9,                  // 干的新笔：笔锋还拢着
  dry: s => (1 + .55 * s) * (1 - .7 * s ** 3),                      // 干的旧笔：前头松开，收不成尖
  bushy: s => (1 + .8 * s) * (1 - .8 * s ** 2.4),                   // 大号的斗笔：蓬松
};
// 毛的排法。len：长短参差；out：朝外倒多少；tan：侧着倒多少；w：一根毛的宽度；stray：飞出去的散毛占多少；lock：毛结成几绺
const HAIR = {
  wet: { len: [.97, 1], out: [-.004, .004], tan: .01, w: .018, stray: 0, lock: 9, sway: .007 },
  point: { len: [.88, 1], out: [-.01, .025], tan: .035, w: .013, stray: .003, lock: 12, sway: .03 },
  dry: { len: [.72, 1.03], out: [-.03, .09], tan: .07, w: .012, stray: .012, lock: 16, sway: .08 },
  bushy: { len: [.75, 1.03], out: [-.02, .08], tan: .06, w: .013, stray: .01, lock: 18, sway: .07 },
};
// 毛色：从笔根到笔尖的几个色标
export const TONES = {
  inked: [[0, '#6A4A34'], [.2, '#4A3226'], [.42, '#17141A'], [1, '#08080D']],          // 褐色的毫，前半截吃饱了墨
  goat: [[0, '#C9B998'], [.14, '#EADFC6'], [1, '#F8F2E2']],                             // 羊毫，白
  wolf: [[0, '#5E3A1E'], [.5, '#A9733A'], [1, '#D2A262']],                              // 狼毫，黄褐
  mixed: [[0, '#E6DCC4'], [.42, '#DCCDAA'], [.56, '#4E372B'], [1, '#2C1E1B']],          // 兼毫，外白内紫
  stained: [[0, '#D5C8AA'], [.45, '#ABA395'], [.8, '#56524F'], [1, '#2F2D2E']],         // 用过没洗净的羊毫，笔尖留着淡墨
};
const toneAt = (tones, s) => {
  for (let i = 1; i < tones.length; i++) if (s <= tones[i][0]) {
    return new THREE.Color(tones[i - 1][1]).lerp(new THREE.Color(tones[i][1]), (s - tones[i - 1][0]) / (tones[i][0] - tones[i - 1][0]));
  }
  return new THREE.Color(tones[tones.length - 1][1]);
};

// 一根毛：一条沿外形弯过去的细带子，越到尖越细。带子两边的法线略微分开，受光像一根圆的毛
function strand(shape, tones, segs) {
  const pos = [], nor = [], col = [], idx = [];
  for (let k = 0; k <= segs; k++) {
    const s = k / segs, a = Math.max(0, s - .01), b = Math.min(1, s + .01), slope = (shape(b) - shape(a)) / (b - a);
    const w = 1 - .85 * s ** 2.2, c = toneAt(tones, s);
    for (const side of [-1, 1]) {
      pos.push(shape(s), s, side * w); col.push(c.r, c.g, c.b);
      const n = new V3(1, -slope, side * .02).normalize();             // 宽向的分量很小：实例把宽度压到很细，法线变换时会把它放大回来
      nor.push(n.x, n.y, n.z);
    }
    if (k < segs) idx.push(k * 2, k * 2 + 1, k * 2 + 2, k * 2 + 1, k * 2 + 3, k * 2 + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  return geo;
}

// 笔头：count 根毛（实例化），根都扎在笔斗口的圆面上，沿外形聚向笔尖；里面垫一个实心的芯，免得从毛缝里看穿
function buildHead({ kind, r, len, count, tones, seed, segs = 6, y }) {
  const shape = SHAPES[kind], cfg = HAIR[kind], rand = stream(seed), wet = kind === 'wet', group = new THREE.Group();
  const mat = soft({ color: '#FFFFFF', vertexColors: true, roughness: wet ? .4 : .85, side: THREE.DoubleSide, ownNormal: true, rim: wet ? .07 : .1, rimColor: wet ? '#9FB4FF' : '#E9E2FF', rimPow: wet ? 2.4 : 3 });
  const hairs = new THREE.InstancedMesh(strand(shape, tones, segs), mat, count);
  // 每一绺有自己的倒向和深浅，毛在这个基础上再各自参差
  const locks = Array.from({ length: cfg.lock }, () => ({ out: (rand() - .35) * cfg.sway, tan: (rand() - .5) * cfg.sway, shade: pick(rand, .8, 1.08), r: pick(rand, .96, 1.03) }));
  const m = new THREE.Matrix4(), c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const th = rand() * TAU, lock = locks[Math.floor((th / TAU * cfg.lock + rand() * .9) % cfg.lock)], stray = rand() < cfg.stray;
    const r0 = r * lock.r * Math.max(.03, rand() ** .42), L = len * pick(rand, ...cfg.len) * (stray ? pick(rand, .55, .95) : 1);
    const out = (pick(rand, ...cfg.out) + lock.out * (.3 + .7 * r0 / r)) * (stray ? 2.4 : 1), tan = ((rand() - .5) * 2 * cfg.tan + lock.tan) * (stray ? 2.2 : 1);
    const w = cfg.w * pick(rand, .7, 1.3), phi = (rand() - .5) * 2.4, cs = Math.cos(th), sn = Math.sin(th);
    // 三根轴：毛的弯向（径向，缩到这根毛离轴心的距离）、毛的长向（带一点倒伏）、带子的宽向（各朝各的方向拧一点，哪个角度看都有宽度）
    const ax = [cs * r0, 0, sn * r0], ay = [(out * cs - tan * sn) * L, L, (out * sn + tan * cs) * L];
    const az = [(Math.sin(phi) * cs - Math.cos(phi) * sn) * w, 0, (Math.sin(phi) * sn + Math.cos(phi) * cs) * w];
    m.set(ax[0], ay[0], az[0], 0, ax[1], ay[1], az[1], y, ax[2], ay[2], az[2], 0, 0, 0, 0, 1);
    hairs.setMatrixAt(i, m);
    hairs.setColorAt(i, c.setScalar(lock.shade * pick(rand, .82, 1.12)));
  }
  hairs.receiveShadow = true;
  group.add(hairs);
  const core = [];
  for (let k = 0; k <= 24; k++) { const s = k / 24 * .97; core.push([r * shape(s) * (wet ? .93 : .86) * (wet ? 1 : 1 - .9 * s ** 4), y + s * len * .96]); }
  core.push([0, y + len * (wet ? .96 : .94)]);
  const coreMesh = mesh(turn([core], 28, 1), soft({ color: toneAt(tones, .5).multiplyScalar(wet ? .8 : .7), roughness: wet ? .4 : .9, rim: 0 }));
  group.add(coreMesh);
  return group;
}

// 笔杆上的画：竹的底色和纤维、竹节的深线、湘妃竹的斑、刻进去填了色的字。画布横向绕笔杆一圈，纵向从笔尾（下）到笔斗（上）
const SKIN = {
  gold: { base: PAL.bamboo, dark: '#8E7442', light: '#E4D2A0', spots: 0, ink: '#2F5E50' },
  spotted: { base: '#CDB27A', dark: '#8A6B3C', light: '#E6D4A2', spots: 46, ink: '#8E2A22' },
  purple: { base: '#4A3038', dark: '#2A1A22', light: '#77525C', spots: 0, ink: '#D9B46A' },
  red: { base: '#8E2F2B', dark: '#5E1A1C', light: '#B5503F', spots: 0, ink: '#E8BE6A' },
};
function shaftTex(skin, text, textU, nodes, seed) {
  const k = SKIN[skin], rand = stream(seed);
  return canvasTex(256, 2048, (g, w, h) => {
    g.fillStyle = k.base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {                                    // 竹的纤维：沿笔杆方向的细丝
      const x = rand() * w, y0 = rand() * h, len = pick(rand, 60, 420);
      g.strokeStyle = rand() < .5 ? k.dark : k.light; g.globalAlpha = pick(rand, .05, .22); g.lineWidth = pick(rand, .6, 2.2);
      g.beginPath(); g.moveTo(x, y0); g.lineTo(x + pick(rand, -3, 3), y0 + len); g.stroke();
    }
    for (let i = 0; i < k.spots; i++) {                                 // 湘妃竹的泪斑：紫褐色的晕，中间浅、边上深
      const x = rand() * w, y = rand() * h, rx = pick(rand, 8, 26), ry = rx * pick(rand, 1.3, 2.6);
      for (const dx of [-w, 0, w]) {
        const sp = g.createRadialGradient(x + dx, y, 0, x + dx, y, rx);
        sp.addColorStop(0, 'rgba(120,70,60,.25)'); sp.addColorStop(.7, 'rgba(70,30,40,.75)'); sp.addColorStop(1, 'rgba(70,30,40,0)');
        g.globalAlpha = pick(rand, .5, .95); g.fillStyle = sp;
        g.save(); g.translate(x + dx, y); g.scale(1, ry / rx); g.translate(-x - dx, -y); g.fillRect(x + dx - rx, y - rx, rx * 2, rx * 2); g.restore();
      }
    }
    for (const n of nodes) {                                           // 竹节：一道深线，上下各有一段颜色变化
      const y = h * (1 - n), band = g.createLinearGradient(0, y - 40, 0, y + 40);
      band.addColorStop(0, 'rgba(0,0,0,0)'); band.addColorStop(.42, k.dark); band.addColorStop(.5, '#2A1C14'); band.addColorStop(.6, k.light); band.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalAlpha = .75; g.fillStyle = band; g.fillRect(0, y - 40, w, 80);
    }
    g.globalAlpha = .95; g.fillStyle = k.ink; g.font = `bold 78px ${KAI}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    [...text].forEach((ch, i) => {                                      // 字从笔尾一侧往笔斗方向排，字头朝笔尾（挂起来看是正的）
      g.save(); g.translate(w * textU, h * (1 - .13) - i * 92); g.rotate(Math.PI); g.fillText(ch, 0, 0); g.restore();
    });
    g.globalAlpha = 1;
  });
}

const HORN = /* glsl */`float f = fbm(vec3(p.x * 3., p.y * .7, p.z * 3.) + 2.); col = mix(col * .55, col * 1.5, smoothstep(.3, .75, f));`;
const TRIM = {
  horn: () => soft({ color: '#2B2024', roughness: .5, rim: .22, rimColor: '#B9C4FF', albedo: HORN }),
  bone: () => soft({ color: '#E9E1CC', roughness: .5, rim: .3, albedo: 'col *= .9 + .2 * fbm(vec3(p.x * 4., p.y * 1.2, p.z * 4.));' }),
  brass: () => soft({ color: '#B08A48', roughness: .45, metalness: .7, rim: .25, rimColor: PAL.gold }),
};

// 一支笔。shaft 笔杆长，r 笔杆半径，ferrule 笔斗长，hairLen、hairR 笔头的长和笔根的半径；kind 笔头的样子，tones 毛色，count 毛的根数；
// skin 笔杆的样子，text 刻的字，textU 字刻在笔杆的哪一侧（绕一圈是 0 到 1，本地 -x 那侧是 .75），trim 笔顶和笔斗的材质，
// cord 挂绳的颜色（不给就没有挂绳）。fine 为假时用省一些的网格（笔筒里那些远处的笔）
export function buildBrush({ shaft = 15.4, r = .3, ferrule = 1.3, hairLen = 3.5, hairR = .44, kind = 'dry', tones = TONES.goat, count = 6000,
  skin = 'gold', text = '', textU = .75, trim = 'horn', cord, seed = 1, fine = true }) {
  const group = new THREE.Group(), rand = stream(seed + 40), cap = .5, trimMat = TRIM[trim]();
  // 笔杆：竹子，两三个竹节（一道凸起的环，上面一圈浅沟），往笔斗那头略粗一点
  const nodes = [pick(rand, .3, .38), pick(rand, .66, .74)], N = fine ? 300 : 90, line = [];
  for (let i = 0; i <= N; i++) {
    const k = i / N, y = cap * .8 + k * (shaft - cap * .8);
    let rad = r * (.93 + .07 * k);
    for (const n of nodes) { const d = (k - n) * shaft; rad += r * (.1 * Math.exp(-((d / .05) ** 2)) - .035 * Math.exp(-(((d - .1) / .035) ** 2))); }
    line.push([rad, y]);
  }
  group.add(mesh(turn([line], fine ? 24 : 14, 1), soft({ map: shaftTex(skin, text, textU, nodes, seed), color: '#FFFFFF', roughness: .58, rim: .3 })));
  // 笔顶：包住笔尾的小帽
  const rt = r * .93;
  group.add(mesh(turn([[[0, 0], [rt * .55, .01], [rt + .02, .1], [rt + .035, .28], [rt + .035, cap]], [[rt + .035, cap], [rt * .9, cap + .02]]], 24), trimMat));
  // 笔斗：从笔杆过渡到笔头的喇叭口，两道弦纹，口沿有厚度，里面是凹进去的
  const R = hairR + .06, y0 = shaft;
  group.add(mesh(turn([
    [[r * .98, y0 - .08], [r + .05, y0 - .04], [r + .05, y0 + .06]], [[r + .05, y0 + .06], [r + .03, y0 + .09]],
    [[r + .03, y0 + .09], [r + .05, y0 + ferrule * .3], [R * .86, y0 + ferrule * .62], [R, y0 + ferrule * .9], [R, y0 + ferrule]],
    [[R, y0 + ferrule], [R - .04, y0 + ferrule + .01], [R - .05, y0 + ferrule - .3]],
  ], fine ? 40 : 20), trimMat));
  const ring = new THREE.TorusGeometry(R * .93, .022, 6, fine ? 40 : 20).rotateX(Math.PI / 2).translate(0, y0 + ferrule * .72, 0);
  group.add(mesh(ring, trimMat));
  group.add(buildHead({ kind, r: hairR, len: hairLen, count, tones, seed: seed + 7, segs: fine ? 6 : 4, y: y0 + ferrule - .22 }));
  // 挂绳：从笔顶穿出来的一圈丝绳，软软地垂向一侧（朝本地 +x 垂），系一个小结
  if (cord) {
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40, s = Math.sin(Math.PI * t);
      pts.push(new V3(.24 * s * s + .02 * Math.sin(t * 9), -1.55 * s ** .85 + .03, .42 * Math.sin(TAU * t) * (.5 + .5 * s)));
    }
    const rope = soft({ color: cord, roughness: .85, rim: .25, albedo: 'col *= .75 + .5 * step(.5, fract(vUv.y * 9. + vUv.x * 2.));' });
    rope.defines = { ...rope.defines, USE_UV: '' };
    group.add(mesh(tube(pts, pts.map(() => .04), 6, { cap: false }), rope));
    group.add(mesh(new THREE.SphereGeometry(.085, 10, 8).translate(.01, -.16, 0), rope));
  }
  return { group, length: shaft + ferrule + hairLen - .22 };
}
