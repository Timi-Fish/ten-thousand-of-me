// 第四段里「像喝过了 孟婆的汤」那个镜头（67.6 – 73.0）：小蟹在水盂边用吸管喝了三口汤。只给 d-verse2.js 用。
//   67.6  盂口的特写：吸管插在一盂深茶褐的汤里，汤面冒着几缕热气；它从画面左边小跑进来
//   68.25 跑到盂边站定，脸朝着镜头，歪头打量吸管；镜头往后拉、往左移，带到它在左、盂在右、「嘴—吸管—盂」同框
//   68.8  抬起靠盂那边的手扶住吸管，把管口送进嘴里，嘴唇撅成一圈裹住管子
//   69.05 第一口：腮帮往里一吸、眼睛挤紧、眉毛压下来、身子往前探；汤柱从盂里沿管子升上来（对焦跟着汤柱走），69.5 到嘴，
//         腮帮一鼓，一道「咽下去」从头滚到脚
//   69.76 第二口：三个鼓包一个接一个滚到嘴；70.25 第三口一大口，踮起脚；之后管里进了空气，「呼噜」两下
//   70.95 松开：「啵」——嘴唇圈弹开，吸管弹回口沿外颤几下，管口甩出两滴汤；71.21 打个嗝吐出一个小泡
//   71.45 转回正面，眼神放空，慢慢地晃；镜头平移到它的正前方，推到它的脸
// 镜头全程朝书案正后方看，不斜着拍：背景的笔架山是正的
import * as THREE from 'three';
import { D, lerp, prog, pulse, ease, key, stepAt } from '../anim.js';
import { pose, MOOD } from '../crab.js';
import { PROPS, DESK } from '../world/layout.js';
import { buildStraw } from './d-straw.js';
import { buildSoup } from './d-soup.js';
import { throb, hop } from './beat.js';
import { handOf } from './hold.js';

const SIZE = 1.15;
const POT = [PROPS.waterPot.c[0], DESK.top, PROPS.waterPot.c[1] - .35];   // 盂底正中（文房把水盂往后让了 0.35）
const SPOT = [.95, -14.1], FROM = [-2.1, -13.1];                       // 喝汤时站的地方（离盂远一点，吸管有一长段横在它和盂之间）、跑过来的起点
const POT_YAW = Math.atan2(POT[0] - SPOT[0], POT[2] - SPOT[1]) / D;    // 从它站的地方看盂的方向
const SUCK_YAW = POT_YAW - 100, DAZE_YAW = 0;                          // 喝的时候盂在它右边偏后，脸朝着镜头（镜头在它和盂中间的正前方）；发呆时面朝正前方，镜头到它的正前方
const RIM = 1.62, LEVEL = [1.4, 1.17];                                 // 盂口沿的高度；汤面开始和喝完时的高度（都从盂底量）
const T = { arrive: 68.25, grab: [68.78, 69.02], letGo: [70.95, 71.03], burp: 71.21, daze: [71.45, 71.95] };
// 三口：pull 吸的那一段；beads 每个鼓包到嘴的时刻；size 鼓包多大；k 吸得多使劲（一口比一口投入）；drop 汤面因此降多少
const SIPS = [
  { pull: [69.05, 69.5], beads: [69.5, 69.63], size: .8, k: .7, drop: .05 },
  { pull: [69.76, 70.1], beads: [70.0, 70.13, 70.26], size: 1.05, k: .85, drop: .065 },
  { pull: [70.25, 70.55], beads: [70.55], size: 1.9, k: 1.15, drop: .095 },
];
const TRAVEL = .45, GURGLES = [70.58, 70.68], GULP_RUN = .22, AIR = .3;   // 鼓包从汤面走到嘴要多久；两段空气钻进管子的时刻、走到嘴要多久、多长
const BEADS = SIPS.flatMap(({ beads, size }) => beads.map(a => ({ a, size, from: a - TRAVEL })));
// 汤柱：u 是前沿走到哪（0 在汤面，1 在嘴里），back 是每口之间回落了多少（世界单位）
const FRONT = [[SIPS[0].pull[0], 0], [SIPS[0].pull[1], 1, 'lin'], [T.letGo[0] + .05, 1], [T.letGo[0] + .45, 0, 'in']];
const BACK = [[69.64, 0], [69.74, .45, 'out'], [69.8, .45], [69.98, 0, 'in'], [70.27, 0], [70.33, .22, 'out'], [70.36, .22], [70.52, 0, 'in']];
const INSIDE = .14, LIPPED = INSIDE + .04;                             // 管口含进嘴里多深；管长最后多少被嘴唇裹着（鼓包走到这里就进嘴了）
const FLOW = 3.2;                                                     // 吸的时候汤在管里走多快（条纹和气泡的速度）
const during = (t, [a, b]) => prog(t, a - .08, a + .06) * (1 - prog(t, b - .02, b + .1));
const bob = (t, at, half) => Math.sin(Math.PI * prog(t, at - half, at + half));
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export function buildSip(kit, props) {
  const { hero, lights } = kit, group = new THREE.Group();
  props.add(group);
  // 脚下案面的高度：这一带是毡的边，高低差一点，取脚下一圈里最高的那处。场景里器物的位置要到渲染过一帧才算好，所以到用的时候才量；
  // 按 0.05 的格子记住量过的地方（姿势一帧要回看几十次）
  const heights = new Map(), FOOT = [[0, 0], [.55, 0], [-.55, 0], [0, .55], [0, -.55]];
  const floor = (x, z) => {
    const cell = `${Math.round(x * 20)},${Math.round(z * 20)}`;
    if (!heights.has(cell)) heights.set(cell, Math.max(...FOOT.map(([dx, dz]) => kit.groundAt(x + dx, z + dz, 3))));
    return heights.get(cell);
  };

  // ———————————————— 小蟹 ————————————————
  const at = (...parts) => pose({ x: SPOT[0], z: SPOT[1], s: SIZE, yaw: SUCK_YAW }, ...parts);
  const HOLD = { aR: [35, .28, .38] }, SUCK = { pucker: 1, mouth: .1, look: [.25, -.15] };   // 靠盂那边的手抬到嘴前扶着吸管；含着吸管的嘴
  const KEYS = [
    [67.6, at({ x: FROM[0], z: FROM[1], yaw: 105, stride: .26 })],
    [T.arrive - .06, at({ stride: .26 }), 'out'], [T.arrive + .05, at()],                                                  // 跑到
    [68.45, at({ lean: -13, pitch: 6, look: [.65, .2], brow: .3 })], [68.66, at({ lean: -16, pitch: 8, look: [.75, .25], brow: .3 })],   // 歪着头打量吸管
    [T.grab[1], at(HOLD, SUCK)], [T.letGo[0], at(HOLD, SUCK)],                                                            // 扶住、含住
    [T.letGo[1] + .06, at({ sq: .05, cat: 1, aR: [-10, .3, .2] })],                                                       // 松开，抿着嘴
    [T.daze[0], at({ cat: 1 })],
    [T.daze[1], at({ yaw: DAZE_YAW + 3, mouth: .08, pucker: .75, brow: -.25, look: [.35, .3] })],                        // 转回正面，眼神越过镜头飘到远处
    [73.2, at({ yaw: DAZE_YAW - 3, mouth: .08, pucker: .75, brow: -.25, look: [.42, .34] })],
  ];
  // 一口汤到嘴以后：腮帮一鼓，接着「咽下去」从上往下滚过全身：先点头，再身子一沉，最后弹回来一点
  const gulp = (t, a, m) => ({ puff: .3 * m * bob(t, a + .05, .1), nod: 5 * m * bob(t, a + .14, .1), down: .12 * m * bob(t, a + .24, .11), up: .05 * m * bob(t, a + .38, .1) });
  const MOODS = [[0, MOOD.open], [69.08, MOOD.ouch], [69.56, MOOD.calm], [69.79, MOOD.ouch], [70.1, MOOD.calm], [70.27, MOOD.ouch], [70.62, MOOD.calm],
    [T.letGo[0], MOOD.open], [71.55, MOOD.wow]];                     // 吸的时候挤紧眼睛，咽下去时舒服地闭着；发呆：瞳仁缩成小点
  const heldAt = t => ease.io(prog(t, ...T.grab)) * (1 - ease.io(prog(t, ...T.letGo)));
  const suckAt = t => SIPS.reduce((v, s) => Math.max(v, s.k * during(t, s.pull)), 0) * heldAt(t);
  const gurgleAt = t => GURGLES.reduce((v, g) => v + bob(t, g + GULP_RUN, .06), 0);
  function act(t) {
    const p = pose(key(t, KEYS)), held = heldAt(t), suck = suckAt(t), dazed = prog(t, T.daze[0], T.daze[1] - .4), tip = Math.sin(Math.PI * prog(t, 70.3, 70.85));
    const g = BEADS.map(b => gulp(t, b.a, b.size)).reduce((v, b) => ({ puff: v.puff + b.puff, nod: v.nod + b.nod, down: v.down + b.down, up: v.up + b.up }), { puff: 0, nod: 0, down: 0, up: 0 });
    const gurgle = gurgleAt(t), burp = bob(t, T.burp + .06, .09);
    p.y += floor(p.x, p.z) + .2 * Math.abs(Math.sin(Math.PI * (t - 67.6) / .3)) * (1 - prog(t, T.arrive - .08, T.arrive - .04)) + .09 * tip + .14 * hop(t, T.burp, T.burp + .2);
    p.walk = (t - 67.6) / .6;
    p.puff += g.puff - .32 * suck + .12 * gurgle;
    p.sq += g.up - g.down + .05 * suck + .14 * tip + .2 * burp + throb(t) * (1 - held) * (1 - dazed);
    p.pitch += 7 * suck + g.nod;
    p.lean += 2.5 * Math.sin(t * 70) * gurgle + 5 * Math.sin((t - T.daze[0]) * 1.5) * dazed;   // 呼噜时抖一抖；发呆时慢慢地晃
    p.brow = lerp(p.brow, 1, Math.min(1, suck));
    p.blush += 1.1 * g.puff + .5 * suck;
    p.mouth += .5 * bob(t, T.burp + .08, .12);
    p.mood = stepAt(t, MOODS);
    p.look = [p.look[0] + .12 * Math.sin((t - T.daze[0]) * 1.9) * dazed, p.look[1]];
    p.blink = Math.max(.42 * dazed, pulse(t, 68.38, .09), pulse(t, 72.45, .16));
    return p;
  }

  // ———————————————— 吸管、汤 ————————————————
  const straw = buildStraw(group), soup = buildSoup(group, POT);
  const UP = new THREE.Vector3(0, 1, 0), OUT = new THREE.Vector3(SPOT[0] - POT[0], 0, SPOT[1] - POT[2]).normalize();
  const DIP = new THREE.Vector3(POT[0], 0, POT[2]).addScaledVector(OUT, .3);   // 吸管插进汤里的那一点（盂心朝它那边偏一点）
  const rimY = POT[1] + RIM;
  // 不扶着的时候：从汤里竖着伸出盂口，弯过口沿，外面那一截斜搭着往下垂
  const LOOSE = [[0, -.45], [0, rimY - .05 + .32], [.45, rimY + .3], [.85, rimY + .08], [1.15, rimY - .2], [1.32, rimY - .42]]
    .map(([out, y], i) => (i === 0 ? DIP.clone().addScaledVector(OUT, out).setY(0) : DIP.clone().addScaledVector(OUT, out).setY(y)));
  const levelAt = t => LEVEL[0] - SIPS.reduce((v, s) => v + s.drop * ease.io(prog(t, ...s.pull)), 0) - .03 * prog(t, GURGLES[0], GURGLES[1] + .1);
  const flowAt = t => FLOW * (SIPS.reduce((v, s) => v + Math.min(Math.max(t - s.pull[0], 0), s.pull[1] - s.pull[0] + .2), 0) + Math.min(Math.max(t - GURGLES[0], 0), .35));
  const face = new THREE.Vector3(), hand = new THREE.Vector3();
  const drops = [0, 1].map(i => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(.045 - .012 * i, 12, 8), new THREE.MeshLambertMaterial({ color: '#5C3316', emissive: '#2A1206' }));
    group.add(m);
    return m;
  });
  const BUBBLE = new THREE.Color(.75, 1.05, 1.3);
  let seen = null;                                                     // 这一帧算好的东西（给镜头对焦用），每帧重算

  function draw(t) {
    group.visible = t >= 67.6 && t < 73;
    if (!group.visible) return;
    const held = heldAt(t), level = levelAt(t), top = soup.y(level);
    LOOSE[0].setY(top - .45);
    // 主角这一帧已经摆好：嘴、脸朝的方向、扶管子那只手都是当下的
    face.set(0, 0, 1).transformDirection(hero.jelly.matrixWorld);
    hand.copy(handOf(hero, 1));                                        // 右手（aR）
    const lips = hero.lips;
    const HELD = [LOOSE[0], LOOSE[1], LOOSE[1].clone().lerp(hand, .5).setY(Math.max(rimY + .45, hand.y + .3)), hand.clone(), lips.clone().addScaledVector(face, .24), lips.clone().addScaledVector(face, -INSIDE)];
    // 松开以后弹回口沿外，颤几下：越靠外的点甩得越厉害
    const after = t - T.letGo[0], shake = after > 0 ? .2 * Math.exp(-after * 5) * Math.sin(after * 26) : 0;
    const pts = LOOSE.map((p, i) => p.clone().lerp(HELD[i], held).addScaledVector(UP, shake * Math.max(0, i - 1) / 4));
    const { line, s, total } = straw.lay(pts);
    const wet = s[line.findIndex(p => p.y > top)];                    // 出汤面的那一处
    const run = total - wet;
    // 汤柱：前沿、每口之间回落、最后两段空气
    const front = lerp(wet, total, key(t, FRONT)) - key(t, BACK);
    const gaps = GURGLES.map(g => { const head = wet + run * (t - g) / GULP_RUN; return [Math.max(wet, head - AIR), Math.min(total + .2, head)]; }).filter(([a, b]) => b > a && t > GURGLES[0] - .01 && a < total);
    straw.soup({ front, gaps, flow: flowAt(t), rush: Math.min(1, suckAt(t) + .6 * prog(t, GURGLES[0], GURGLES[0] + .05) * (1 - prog(t, T.letGo[0], T.letGo[0] + .05))) });
    const live = BEADS.map(b => [b.size, (t - b.from) / TRAVEL]).filter(([, u]) => u > 0 && u < 1.1);
    straw.beads(live.map(([m, u]) => [lerp(wet, total - LIPPED, u), .6 * m * prog(u, 0, .12) * (1 - prog(u, .9, 1.05))]));   // 走到嘴唇圈就收进嘴里
    // 嘴唇圈：含住时撅出来，吸的时候收紧；松开时「啵」地弹大一下，缩回脸上
    const pop = prog(t, T.letGo[0] + .02, T.letGo[0] + .14);
    const size = ease.back(prog(t, T.grab[1] - .08, T.grab[1] + .06)) * (1 + .5 * Math.sin(Math.PI * prog(t, T.letGo[0] - .02, T.letGo[0] + .08))) * (1 - pop);
    straw.lips(lips.clone().addScaledVector(face, .03 + .02 * Math.min(1, suckAt(t))), face, size, Math.min(1, suckAt(t)));
    // 汤面：每个鼓包、每段空气离开汤面时，吸管那里荡开一圈波纹
    const rings = [...BEADS.map(b => b.from), ...GURGLES].map(a => [(t - a) / .9, .9]).filter(([u]) => u > 0 && u < 1);
    soup.update(t, { level, dip: DIP.clone().setY(top), straw: straw.R, rings, heat: 1, cam: key(t, SHOTS).p });
    // 管口甩出来的两滴汤：吸管弹回去时从管口飞出，落到案面上就没了
    drops.forEach((m, i) => {
      const u = t - T.letGo[0] - .06 - .05 * i, v = OUT.clone().multiplyScalar(1.3 + .5 * i).addScaledVector(UP, 1.7 - .4 * i);
      m.position.copy(LOOSE[5]).addScaledVector(v, u).addScaledVector(UP, -6 * u * u);
      m.visible = u > 0 && m.position.y > POT[1];
    });
    // 打嗝吐出来的小泡：从嘴边晃着升上去，「啵」地碎成六粒小光点，四散着暗下去
    const b = t - T.burp - .08, rise = Math.min(b, .9), burst = prog(b, .9, 1.2);
    const bubble = [lips.x + face.x * .15 + .08 * Math.sin(rise * 9), lips.y + 1.1 * ease.out(rise / .9), lips.z + face.z * .15];
    if (b > 0 && b < .9) lights.put(bubble, (.05 + .07 * ease.out(prog(b, 0, .3))) * (1 + pulse(b, .88, .05)), BUBBLE);
    else if (b >= .9 && burst < 1) for (let n = 0; n < 6; n++) {
      const a = (n * 60 + 20) * D, r = .08 + .34 * ease.out(burst);            // 在正对它脸的那个面里散开
      lights.put([bubble[0] + r * Math.cos(a) * face.z, bubble[1] + r * Math.sin(a), bubble[2] - r * Math.cos(a) * face.x], .055 * (1 - burst), BUBBLE);
    }
    seen = { lips: lips.toArray(), front: line[s.findIndex(v => v >= Math.min(front, total - .01))].toArray() };
  }

  // ———————————————— 镜头 ————————————————
  // 镜头都朝书案正后方看（p 和 q 的 x 一样），背景是正的：ahead(x, y, z, to, fov) 是站在 [x, y, z]、看向正前方 to 那么高那么远的机位
  const ahead = (x, y, z, to, fov = 36) => ({ p: [x, y, z], q: [x, to[1], to[2]], fov });
  const orbit = (a, d, y) => [SPOT[0] + d * Math.sin(a * D), y, SPOT[1] + d * Math.cos(a * D)];   // 它站的地方周围的一点：a 方位（度，同 yaw），d 多远，y 多高
  const MOUTH = [POT[0], rimY - .1, POT[2]], PAIR = orbit(SUCK_YAW, .3, 1.55).map((v, i) => lerp(v, MOUTH[i], .42)), FACE = orbit(DAZE_YAW, .6, 1.5);
  // 这段时间这一带有三片梅瓣在落（world/glow/petals.js，位置只由时间定）：一片 68.3 – 69.1 从 [1, 3.4, -9.5] 飘到 [2.2, 2.7, -8.8]、再往 +z 去；
  // 一片 69 – 71 从 [-.4, 4.1, -11] 飘到 [2, 2.2, -9.8]；一片在右边 [5 到 6, 3 到 4, -10.9 到 -9.4]。拉开后的机位始终比它们靠里（z 更小）、
  // 或者离它们一个身位以上，梅瓣都从镜头身后和两侧过，不进画面。挪这几个机位之前先量梅瓣在哪
  const SHOTS = [
    [67.6, ahead(4.45, 3.25, -12.9, [0, 1.4, -15.6])],                                                            // 盂口的特写：看得见汤面、热气、吸管；慢慢往左移
    [68.3, ahead(4.1, 2.9, -12.3, [0, 1.38, -15.35]), 'lin'],
    [69.0, ahead(2.4, 2.8, -9.8, [0, 1.2, PAIR[2]], 42), 'io'],                                                   // 拉开：它在左、盂在右，嘴—吸管—盂同框（高一点，看得见盂口里的汤）
    [70.85, ahead(1.9, 2.45, -10.5, [0, 1.85, PAIR[2]], 50), 'lin'],                                               // 它一口比一口投入，镜头慢慢朝它推近（离得近了，视角放宽：盂仍在画里，它踮起脚时簪子也不出画）
    [71.75, ahead(SPOT[0], 2.0, SPOT[1] + 3.7, FACE, 40), 'io'],                                                  // 平移到它的正前方，推到发呆的脸
    [73, ahead(SPOT[0], 1.9, SPOT[1] + 3.5, FACE), 'lin'],
  ];
  // 对焦：特写对着盂口；拉开以后对着嘴；第一口时先跳到盂口，再跟着汤柱的前沿一路走到嘴
  function cam(t) {
    const { p, q, fov } = key(t, SHOTS), rack = prog(t, 68.95, SIPS[0].pull[0]) * (1 - prog(t, SIPS[0].pull[1], SIPS[0].pull[1] + .1));
    const f = lerp(lerp(dist(p, MOUTH), dist(p, seen.lips), prog(t, 68.6, 68.95)), dist(p, seen.front), rack);
    return { p, q, f, fov };
  }
  return { act, draw, cam };
}
