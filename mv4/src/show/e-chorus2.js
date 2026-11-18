// 第五段（82.2 – 110.6 秒）：「昨夜的我 今晨的我」和第二遍副歌在书案上的部分。91.2 – 96.7 秒切到外景，不归这一段管。
//   82.2 – 87.4 「昨夜的我 今晨的我」（清晨）：主角把留言揣进怀里。左边一群淡蓝的光点旋着聚成一团，光里现出一只月光色的虚影：昨夜的自己。
//               镜头从近景拉开成两只一左一右的中景。主角吓一跳，转过去；然后像照镜子：它歪头，虚影也歪头；它举手挥一挥，
//               虚影举起对面那只手；它一蹲一挺，虚影也一蹲一挺（虚影总是慢半拍，脚不沾地地浮着）
//   87.4 – 91.2 「隔一场梦 是不是我」：镜头跟着推近（不切）。两只凑近，把小短手伸向对方；88.73 碰到的一瞬间，虚影鼓了一下散成一群淡蓝的光点，
//               流进主角的胸口（留言揣在那里）。它看看自己的手，转回正面，眉头一拧，一蹲、深吸一口气鼓成球；91.2 整「啵」的那一下切到外景
//   96.7 – 101.8「一夜只剩 几个字」：回到书案（正面的中景），天色暗下来成月夜，油灯重新亮起。光点成群从月洞窗飞回来落成纸，那摞纸从 90 张长到 140 张。
//               主角侧身朝着光来的右边、踩着拍子迎着，踮脚接住飞向它的那一点光，光在它手里变成一张纸，它转回正面捧着读；
//               98.95 切到它眼前的纸：只有「我很好」三个字；100.35 切到它的正脸：它轻轻地笑，把纸翻过来贴在胸口抱住
//   101.8 – 110.6「哪个是我 问月光」：它蹦上那摞纸的顶上坐下（两条腿垂在两边），朝月亮探起身、张嘴问。镜头在它身后偏右，慢慢升起、越过它，
//               朝月洞窗推过去；最后两秒多月亮占满画面，几点暖色的光从月亮前面横着飞过。结束在月亮上
import * as THREE from 'three';
import { D, TAU, lerp, prog, pulse, rnd, ease, key, mix, stepAt, bez } from '../anim.js';
import { pose, MOOD } from '../crab.js';
import { MOON } from '../world/layout.js';
import { bounce, throb, hop, UP } from './beat.js';
import { arc, WARM, windowSpot } from './moves.js';
import { stackSpot, kindOf, drawPile, PILE, KIND } from './slips.js';
import { bodyNow, place, grip, along, HANDS } from './hold.js';
import { buildQuilt } from './quilt.js';

export const span = [82.2, 110.6];
const SIZE = 1.15, STAY = [0, .9], MOONWARD = 164, POP = 91.2;         // 主角的个头、留守的位置、面朝月亮时的朝向；「啵」的时刻（从这里切到外景）
const CUTS = { home: 96.7, page: 98.95, smile: 100.35, gaze: 101.8 };   // 每次切镜头的时刻
const MOONLIGHT = new THREE.Color(.55, .8, 1.5);                       // 虚影散成的光点的颜色（清晨的画面亮，再亮就泛成白的了）
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const eye = (p, q, on = q) => ({ p, q, f: dist(p, on), fov: 36 });    // 一个机位：p 镜头位置，q 看向的点，on 对焦在哪（不写就是 q）
const aim = (p, at, f, fov = 36) => ({ p, q: p.map((v, i) => v + (at[i] - v) * 30 / dist(p, at)), f, fov });   // 朝很远的 at 看的机位：q 取在视线上 30 远处，这样在机位之间过渡时视线转得均匀
const ahead = (p, d, y) => [p.x + d * Math.sin(p.yaw * D), p.y + y, p.z + d * Math.cos(p.yaw * D)];   // 小蟹身前 d、脚底往上 y 的那一点
const bob = (t, at, half) => Math.sin(Math.PI * prog(t, at - half, at + half));   // at 前后 half 秒里鼓起又落下的一下

export function build(kit) {
  const { world, hero, twin, lights, slips } = kit;
  const HOME = { x: STAY[0], z: STAY[1], s: SIZE }, hp = (...parts) => pose(HOME, ...parts);
  const HUG = { aL: [160, .34, .74], aR: [160, .34, .74] };            // 开场揣着留言时的两只手（接上一段的结尾）
  const CARRY = { aL: HANDS.read, aR: HANDS.read }, EMBRACED = { aL: HANDS.hug, aR: HANDS.hug };   // 捧着纸读、把纸抱在胸前时的两只手（配 hold.js 的拿法）
  const HELD = [1.14, .74, -7];                                        // 开场那张留言贴在胸口的位置：[身前多远, 多高, 俯仰]（接上一段的结尾）

  // ———————————————— 一、照镜子，碰手，鼓气（82.2 – 91.2）————————————————
  // 两只隔着 x = AXIS 这面「镜子」相对：主角在右，朝左前方；虚影是主角的镜像，慢 LAG 秒
  const AXIS = -1.65, LAG = .12, SEEN = 83.9, TOUCH = 88.73, NEAR_X = -.42;   // SEEN：虚影从这时起跟着主角动；TOUCH：碰到手的时刻；NEAR_X：凑近以后主角站在哪
  // 照镜子时半侧着身（看得见脸）；伸手时转成几乎正对着对方，两只才凑得近、手才够得着
  const TURNED = { yaw: -62 }, REACH = { yaw: -80, aL: [8, .28, .72], aR: [8, .28, .72] }, near = (...parts) => pose(HOME, TURNED, { x: NEAR_X }, ...parts);
  const MEET_KEYS = [
    [82.2, hp(HUG, { sq: -.06, blush: 2, lean: 3 })], [82.75, hp({ blush: 1.5 })],                                          // 把留言揣进怀里
    [83.0, hp({ look: [-.85, .1], blush: 1.3 })],                                                                           // 余光里左边亮了
    [83.5, hp(TURNED, { sq: .14, look: [0, .1] })], [SEEN, hp(TURNED)],                                                     // 转过去，吓得一挺
    [84.2, hp(TURNED, { lean: 14 })], [84.75, hp(TURNED, { lean: 14 })],                                                    // 歪头
    [85.0, hp(TURNED, { aR: [64, .32, .15] })], [85.75, hp(TURNED, { aR: [64, .32, .15] })],                                // 举起靠镜头的那只手，挥一挥
    [85.95, hp(TURNED, { sq: -.3 })], [86.2, hp(TURNED, { sq: .22 })], [86.5, hp(TURNED)],                                  // 一蹲，一挺
    [87.3, hp(TURNED, { pitch: 7, brow: -.5 })], [87.75, hp(TURNED, { pitch: 7, brow: -.5 })],                              // 探身端详
    [88.5, near(REACH, { pitch: 5, brow: -.4, stride: .22 })], [TOUCH, near(REACH, { pitch: 6, brow: -.4 })],               // 凑近，伸手
    [89.15, near(REACH, { sq: .1 })],                                                                                       // 光流进胸口
    [89.55, near({ yaw: -30, aR: [35, .3, .5], look: [.6, -.35], brow: -.5 })], [89.92, near({ yaw: -30, aR: [35, .3, .5], look: [.6, -.35], brow: -.5 })],   // 看看自己的手
    [90.28, hp({ brow: .9, look: [0, .15] })],                                                                              // 转回正面站回原处，眉头一拧
    [90.38, hp({ brow: .9, sq: -.2 })],                                                                                     // 一蹲
    [90.68, hp(UP, { brow: .9, puff: 1.25, sq: .05, pitch: -8, pucker: 1, mouth: .25 }), 'out'],                            // 吸气，鼓成球
    [POP - .09, hp(UP, { brow: .9, puff: 1.75, pitch: -9, pucker: 1, mouth: .25 })],
    [POP, hp({ sq: -.32 }), 'in'],                                                                                          // 啵
  ];
  function meet(t) {
    const p = pose(key(t, MEET_KEYS)), wave = prog(t, 85, 85.15) * (1 - prog(t, 85.6, 85.75)), creep = prog(t, 87.75, 87.8) * (1 - prog(t, 88.45, 88.5));
    p.aR = [p.aR[0] + 16 * Math.sin(t * 16) * wave, p.aR[1], p.aR[2]];
    p.y += .2 * hop(t, 83.28, 83.55) + .1 * Math.abs(Math.sin(Math.PI * (t - 87.75) / .25)) * creep + .22 * hop(t, 90, 90.28);
    p.walk = (t - 87.75) / .5;
    p.sq += throb(t) * (1 - prog(t, 90.28, 90.38)) + .1 * bob(t, TOUCH + .75, .3);                                         // 光流进来时胸口一鼓
    p.lean += 2.2 * Math.sin(t * 70) * prog(t, POP - .35, POP - .05);                                                      // 鼓到极限时发抖
    p.mood = stepAt(t, [[0, MOOD.joy], [82.7, MOOD.open], [83.05, MOOD.wow], [SEEN, MOOD.open], [TOUCH, MOOD.wow], [89.3, MOOD.open], [90.55, MOOD.calm]]);
    p.blink = Math.max(pulse(t, 84.05, .09), pulse(t, 86.75, .09), pulse(t, 89.72, .1), pulse(t, 90.1, .09));
    return p;
  }
  // 虚影：主角的镜像。从一团光里长出来；碰到手以后鼓一下，缩没了（这时光点从它身上散出来）
  function ghost(t) {
    const m = meet(Math.max(t - LAG, SEEN)), gone = prog(t, TOUCH, TOUCH + .4);
    return pose(m, { x: 2 * AXIS - m.x, yaw: -m.yaw, lean: -m.lean, aL: m.aR, aR: m.aL, look: [-m.look[0], m.look[1]], ghost: 1, brow: 0, mouth: 0,
      y: m.y + .1 + .05 * Math.sin(t * 2.1), s: SIZE * ease.back(prog(t, 82.98, 83.5)) * (1 - gone * gone), puff: .5 * ease.out(gone),
      mood: stepAt(t, [[0, MOOD.open], [88.25, MOOD.joy]]), blink: pulse(t, 85.4, .1) });
  }
  // 现身：一群光点旋着聚到一处，聚成一团柔光，虚影从光里长出来
  const GHOST_AT = [2 * AXIS - STAY[0], 1.1, STAY[1]];
  const WISPS = Array.from({ length: 44 }, (_, i) => ({ a: TAU * rnd(i * 3.3), r: 1.6 + 1.6 * rnd(i * 5.1), h: .3 + 1.9 * rnd(i * 7.9), born: 82.4 + .55 * rnd(i * 2.7), size: .05 + .05 * rnd(i * 6.1) }));
  function drawWisps(t) {
    WISPS.forEach(w => {
      const k = prog(t, w.born, w.born + .65);
      if (k <= 0 || k >= 1) return;
      const r = w.r * (1 - ease.in(k)), a = w.a + 3.2 * k;
      lights.put([GHOST_AT[0] + r * Math.cos(a), lerp(w.h, GHOST_AT[1], ease.in(k)), GHOST_AT[2] + r * Math.sin(a)], w.size * Math.min(1, k * 5), MOONLIGHT);
    });
    const orb = ease.out(prog(t, 82.85, 83.1)) * (1 - ease.io(prog(t, 83.1, 83.45)));
    if (orb > 0) lights.put(GHOST_AT, .32 * orb, MOONLIGHT);
  }
  // 散开：虚影身上的一群光点，先后动身，绕一道弯流进主角的胸口
  const HEART = ahead(near(REACH), .8, 1.05), FINGERS = [AXIS, 1.08, STAY[1] + 1.2];   // 光流进去的地方（主角胸口）；两只靠镜头的手碰到的地方
  const MOTES = Array.from({ length: 110 }, (_, i) => ({
    from: [2 * AXIS - NEAR_X + 2 * (rnd(i * 3.1) - .5), .3 + 1.7 * rnd(i * 5.7), STAY[1] + 1.8 * (rnd(i * 7.3) - .5)],
    bend: [1.6 * (rnd(i * 1.9) - .5), .6 + 1.4 * rnd(i * 8.3), 1.6 * (rnd(i * 6.7) - .3)], wait: .04 + .55 * rnd(i * 2.3) ** 1.4, fly: .5 + .3 * rnd(i * 9.1), size: .03 + .04 * rnd(i * 4.7),
  }));
  function drawMotes(t) {
    const u = t - TOUCH;
    if (u < 0 || u > 1.6) return;
    MOTES.forEach((m, i) => {
      const k = prog(u, m.wait, m.wait + m.fly);
      if (k >= 1) return;
      const mid = m.from.map((v, n) => (n === 1 ? Math.max(v, HEART[1]) : (v + HEART[n]) / 2) + m.bend[n]), at = bez(m.from, mid, HEART, ease.in(k));
      lights.put([at[0], at[1] + .06 * Math.sin(u * 6 + i), at[2]], m.size * Math.min(1, u / .12) * (1 - .5 * k), MOONLIGHT);
    });
    const spark = pulse(u, .03, .16), warm = bob(u, .8, .5);            // 碰到的一瞬间指尖一闪；光流进去时胸口亮一下
    if (spark > 0) lights.put(FINGERS, .26 * spark, MOONLIGHT);
    if (warm > 0) lights.put(HEART, .16 * warm, MOONLIGHT);
  }
  // 上一段末尾抱在胸口的那张留言：往下一滑，揣进怀里。清晨这一段里，它早上掀掉的那条被子（昨夜「月很圆」那一页抖开成的）还摊在身后原处
  const quilt = buildQuilt(kit.group());
  function drawTuck(t, p) {
    if (t < POP) quilt.rest(); else quilt.hide();
    const k = ease.in(prog(t, 82.3, 82.75));
    if (k < 1) slips.put({ at: ahead(p, lerp(HELD[0], 1, k), lerp(HELD[1], .8, k)), rot: [HELD[2], p.yaw, 1.5 * Math.sin(t * 3.1)], kind: KIND.note, size: 1 - .85 * k, glow: .1, curl: .08 });
  }

  // ———————————————— 二、纸回来了（96.7 – 101.8）————————————————
  const CATCH = 98.55, EMBRACE = [101.0, 101.4], ABOVE = [.5, 2.5];   // 接住那点光的时刻；把纸抱进怀里从几时到几时；那点光落到哪（身前多远、多高：举起的两手上方）
  const MINE_YAW = 22;                                                 // 接住那一刻它的朝向（还半朝着光飞来的右边）
  const READ_TILT = -75, READ_HANDS = .35;                             // 捧着读时纸的俯仰、手捏的那条边多高（hold.js 的 read）：纸放得平，切到它的脸时纸的远沿在嘴下面
  const GREET_KEYS = [
    [97.8, hp({ yaw: 42, look: [.35, .6], mouth: .45, aL: [25, .28, .1], aR: [25, .28, .1] })],                             // 侧过身朝着右边：光点从右后方的月洞窗飞回来，落到它右手边那摞纸上
    [98.2, hp(UP, { yaw: 32, look: [.15, .85], sq: .16, pitch: -8, mouth: .5 })],                                           // 有一点光朝它来：踮起脚迎
    [CATCH, hp(UP, { yaw: MINE_YAW, look: [0, .7], sq: .2, pitch: -8, mouth: .5 })],
    [CATCH + .25, hp(CARRY, { yaw: 5, sq: -.1, look: [0, -.6] })],                                                          // 接住，一沉
    [CUTS.page, hp(CARRY, { pitch: 9, look: [0, -.75] })], [100.25, hp(CARRY, { pitch: 9, look: [0, -.75] })],              // 转到正面，捧着读
    [100.7, hp(CARRY, { pitch: 2, look: [0, -.25], blush: 1.5, cat: .6 })],                                                 // 抬起眼
    [EMBRACE[0], hp(CARRY, { pitch: 2, look: [0, -.1], blush: 1.6, cat: .6 })],
    [EMBRACE[1], hp(EMBRACED, { blush: 1.9, sq: -.06, lean: 4, cat: .6 })], [102, hp(EMBRACED, { blush: 1.9, sq: -.06, lean: -4, cat: .6 })],   // 抱住，轻轻地晃
  ];
  function greet(t) {
    const p = pose(key(t, GREET_KEYS)), cheer = 1 - prog(t, 97.7, 97.9), reading = prog(t, CUTS.page, 99.1) * (1 - prog(t, 100.25, 100.4));
    p.y += .28 * bounce(t) * cheer + .15 * hop(t, 98.2, CATCH);
    p.sq += throb(t) * (1 - reading) + .012 * Math.sin(t * 3) * reading + .07 * bob(t, EMBRACE[1], .16);
    p.look = [p.look[0], p.look[1] + .12 * Math.sin((t - 99) * 3) * reading];                                             // 眼睛顺着那一列字上下
    p.mood = stepAt(t, [[0, MOOD.joy], [97.85, MOOD.open], [100.85, MOOD.joy]]);
    p.blink = Math.max(pulse(t, 99.7, .09), pulse(t, 100.55, .1));
    return p;
  }
  // 回来的光点：从月洞窗飞进来，落到那摞纸上，落一点光就多一张纸（第 90 到 139 张）
  const GROWN = 50;
  const BACK = Array.from({ length: GROWN }, (_, i) => ({ from: windowSpot(i + 900), launch: 95.6 + 2.9 * rnd(i * 6.3), lift: 3 + 4 * rnd(i * 2.7) }))
    .map(s => ({ ...s, land: s.launch + 1.35 })).sort((a, b) => a.land - b.land).map((s, i) => ({ ...s, ...stackSpot(PILE, 90 + i), kind: kindOf(90 + i) }));
  function drawBack(t) {
    BACK.forEach(s => {
      if (t < s.launch) return;
      if (t < s.land) { const { at, k } = arc(s.from, s.at, s.launch, s.land, t, s.lift); lights.put(at, lerp(.2, .12, k), WARM); return; }
      const fresh = t - s.land;
      slips.put({ at: s.at, rot: s.rot, size: lerp(.3, 1, ease.back(prog(fresh, 0, .3))), kind: s.kind, glow: .4 * (1 - prog(fresh, 0, .6)) });
    });
  }
  // 飞向主角的那一点光：飞得慢、拱得高，落进它举起的手里，变成写着「我很好」的那张纸
  const MINE = { from: windowSpot(77), launch: 96.75, lift: 6, to: ahead(hp({ yaw: MINE_YAW }), ABOVE[0], ABOVE[1]) };
  function drawMine(t) {
    if (t < MINE.launch || t > CUTS.gaze) return;
    if (t < CATCH) { const { at, k } = arc(MINE.from, MINE.to, MINE.launch, CATCH, t, MINE.lift); lights.put(at, lerp(.24, .17, k) * (1 + .15 * Math.sin(t * 14)), WARM); return; }
    // 接住时举在头顶上前方（字朝着它自己）→ 落到身前捧着读 → 翻过来抱在胸前（字朝外）。都按它此刻的身体算（hold.js）
    const b = bodyNow(hero, greet, t), size = lerp(1.18, 1, ease.io(prog(t, ...EMBRACE))) * lerp(.3, 1, ease.back(prog(t, CATCH, CATCH + .3)));
    const spot = place(b, along(t, [[CATCH, grip.lift(b, size)], [CATCH + .3, grip.read(b, size, READ_TILT, READ_HANDS)], [EMBRACE[0], grip.read(b, size, READ_TILT, READ_HANDS)], [EMBRACE[1], grip.hug(b, size)]], b, .45));
    spot.rot[2] += 1.5 * Math.sin(t * 3.1);
    slips.put({ ...spot, kind: KIND.fine, size, glow: .06 + .5 * (1 - prog(t, CATCH, CATCH + .38)), curl: .08 });
  }

  // ———————————————— 三、问月光（101.8 – 110.6）————————————————
  // 它坐在那摞纸（140 张）的顶上：身子落在纸上，腿垂在纸摞两边
  const SEAT = stackSpot(PILE, 140).at[1] - .3, PERCH = { x: PILE[0], z: PILE[2], y: SEAT, s: SIZE, yaw: MOONWARD }, CROUCH = { x: .6, z: 2.7, s: SIZE, yaw: 150 };
  const ASKING = { pitch: -12, sq: .17, look: [0, .8], mouth: .35, aL: [38, .3, .12], aR: [38, .3, .12] };
  const GAZE_KEYS = [
    [101.8, pose(CROUCH, { sq: -.08 })], [102.05, pose(CROUCH, { sq: -.26 })],                                              // 在纸摞旁边一蹲
    [102.6, pose(PERCH, UP, { sq: .22 }), 'out'], [102.78, pose(PERCH, { sq: -.26 })],                                       // 蹦上去，坐稳
    [103.05, pose(PERCH, { sq: .05, pitch: -5, look: [0, .5] })], [104.2, pose(PERCH, { pitch: -7, look: [0, .6] })],        // 望月
    [105.0, pose(PERCH, ASKING)], [106.3, pose(PERCH, ASKING)],                                                             // 「问月光」：朝月亮探起身
    [107.2, pose(PERCH, { pitch: -8, look: [0, .6] })],
  ];
  function gaze(t) {
    const p = pose(key(t, GAZE_KEYS)), settled = prog(t, 103, 103.4);
    p.y += 1.5 * hop(t, 102.05, 102.6);
    p.sq += .015 * Math.sin(t * 1.9) * settled;
    p.lean += 2.5 * Math.sin(t * .9) * settled;
    return p;
  }
  // 最后从月亮前面横着飞过的几点暖光
  const HEAD = [PILE[0], SEAT + 2, PILE[2]], FAR = dist(HEAD, MOON.toArray()), TO_MOON = MOON.toArray().map((v, i) => (v - HEAD[i]) / FAR), FLAT = Math.hypot(TO_MOON[0], TO_MOON[2]);
  // 从它头顶到月亮的那条线上的点：s 沿线走多远，up 再往上多少，right 再往右多少
  const way = (s, up, right) => [HEAD[0] + TO_MOON[0] * s - TO_MOON[2] / FLAT * right, Math.max(.75, HEAD[1] + TO_MOON[1] * s + up), HEAD[2] + TO_MOON[2] * s + TO_MOON[0] / FLAT * right];   // 镜头不低于贴着纸面的高度
  const FLOCK = Array.from({ length: 9 }, (_, i) => ({ start: 108.2 + 1.2 * rnd(i * 4.1), h: 6 * (rnd(i * 7.7) - .5), size: .3 + .25 * rnd(i * 2.9) }));
  function drawFlock(t) {
    FLOCK.forEach((f, i) => {
      const k = prog(t, f.start, f.start + 1.7);
      if (k > 0 && k < 1) lights.put(way(58, f.h + .8 * Math.sin(k * Math.PI + i), -14 + 28 * k), f.size, WARM);
    });
  }

  // ———————————————— 镜头 ————————————————
  // 书案上的机位都朝正后方看（p 和 q 的 x 一样），背景横平竖直：主角独占画面时镜头在它正前方；两只面对面时镜头在两只中间那面「镜子」上
  const READING = hp(), PAGE = ahead(READING, 2.15, .9), FACE = ahead(READING, .6, 1.2), MOON_AT = MOON.toArray();   // READING：读字时它站在留守点、面朝正前方
  const CAM = [
    [82.2, eye([0, 1.9, 6.7], [0, 1.25, .9], [0, 1.2, 1.7])],                                                                                            // 接上一段：正前方，它抱着留言的近景
    [83.7, eye([AXIS, 1.75, 9.8], [AXIS, 1.2, .9])], [86.9, eye([AXIS, 1.58, 9.28], [AXIS, 1.16, .9]), 'lin'],                                          // 拉开：两只一左一右，镜头在两只正中间
    [88.3, eye([-1.62, 1.5, 7.5], [-1.62, 1.15, .9]), 'io'], [89.0, eye([-1.6, 1.5, 7.2], [-1.6, 1.15, .9]), 'lin'],                                    // 跟着它凑近的步子一路推近（不切）：伸手
    [90.2, eye([-.1, 1.6, 6.3], [-.1, 1.2, .9])], [POP, eye([0, 1.75, 6.0], [0, 1.35, .9]), 'lin'],                                                     // 跟到它的正前方
    [CUTS.home, eye([1, 2.6, 11.2], [1, 2.5, -4], [0, 1.2, .9])], [CUTS.page, eye([.7, 2.2, 9.2], [.7, 1.4, 1.2], [0, 1.2, .9])],                       // 回到书案，正面中景：它在左，那摞纸在右，光点从右上的月洞窗飞回来
    [CUTS.page, eye(ahead(READING, 1.15, 4.7), PAGE)], [CUTS.smile, eye(ahead(READING, 1.3, 3.9), PAGE), 'lin'],                                        // 它眼前的纸（镜头在它额头上方，几乎垂直往下看）
    [CUTS.smile, eye(ahead(READING, 5.5, 1.6), FACE)], [CUTS.gaze, eye(ahead(READING, 4.8, 1.5), FACE), 'lin'],                                         // 它的正脸
    [CUTS.gaze, aim(way(-12, -1.3, -.4), [2.4, 2.85, 0], 11)], [103, aim(way(-9.4, -1.2, .2), [2.9, 4.5, -2], 9), 'out'],                             // 从低处看它蹦上纸摞
    [105.6, aim(way(-7, .3, 1.3), MOON_AT, 7.2)],                                                                                                       // 升到它身后偏右：它在左下，月亮在中间
    [107.2, aim(way(1.5, 1.6, 1), MOON_AT, 60)],                                                                                                        // 越过它
    [108.5, aim(way(17, .5, 0), MOON_AT, FAR - 17, 24)], [110.6, aim(way(22, 0, 0), MOON_AT, FAR - 22, 20), 'lin'],                                     // 推向月洞窗，月亮占满画面
  ];
  const ACTS = [[0, meet], [CUTS.home, greet]];                        // 每个镜头里主角怎么演（问月光那个镜头在 frame 里单独判）

  return {
    frame(t) {
      // 问月光：CAM 里 CUTS.gaze 那一刻的前一个关键帧管到这一刻为止（含），这一刻之后才切；姿势也在这一刻之后才换（101.8 正好落在整帧上，早一步换就是新姿势配旧镜头）
      const act = t > CUTS.gaze ? gaze : stepAt(t, ACTS), p = act(t), dusk = ease.io(prog(t, CUTS.home, 101));
      kit.act(hero, act); kit.act(twin, ghost);
      drawPile(slips, 90);
      drawWisps(t); drawMotes(t); drawTuck(t, p); drawBack(t); drawMine(t); drawFlock(t);
      return { cam: key(t, CAM), dawn: 1 - dusk, lamp: ease.io(prog(t, 97.6, 99.6)) };
    },
  };
}
