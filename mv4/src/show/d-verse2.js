// 第四段（62.3 – 82.2 秒）：第二段主歌，全程清晨（油灯灭着）。主角一觉醒来什么都不记得，只有昨夜留下的字替它记着。
//   62.3 – 67.6 「天一亮就 全都忘记」：主角缩在那摞纸旁边睡着，背上盖着昨夜那页纸抖开成的被子。它醒来伸懒腰、打哈欠，被子从背上滑下去摊在身后；
//               四个带四季颜色的小光球踩着拍子从头顶飘出来，升上去「啵」地碎掉；它茫然地左看右看，抬头看最后一个光球灭掉，
//               然后歪头看着那摞纸，头顶冒出一个问号，挠挠头
//   67.6 – 73.0 「像喝过了 孟婆的汤」：水盂边（d-sip.js）。先是盂口的特写：一盂冒着热气的深色汤，插着一根浅青白的细芦苇管；
//               它小跑进画，扶住吸管含进嘴里吸了三口（一口比一口投入），汤柱从盂里升上来，每口是一串滚到嘴边的鼓包；
//               松开吸管「啵」的一声，打了个嗝（吐出一个小泡），转过脸来眼神放空，慢慢地晃
//   73.0 – 77.4 「只有枕边 昨夜的字」：回到纸上。枕边那张纸亮了起来，它吓一跳，凑过去弯腰捧起来，转回正面站直了读；
//               74.95 切到它眼前的纸（看得清「我是昨夜的你 / 别怕 接着走」）；76.5 切到它的正脸：眼眶一热，余光里那摞纸也亮了
//   77.4 – 82.2 「一笔一画 替我收藏」：那摞纸从上往下一张张飞起来，连成一条纸带绕着它转成两圈（朝镜头的一侧低、远的一侧高），
//               每张纸的墨迹从上往下显出来；它捧着留言在中间踩着拍子转圈看，星星眼；纸从最底下那张起一张张落回去叠好（仍是 90 张）；
//               最后它把留言翻过来贴在胸口抱住，腮红加深
import * as THREE from 'three';
import { D, TAU, lerp, prog, pulse, rnd, ease, key, mix, stepAt } from '../anim.js';
import { pose, MOOD } from '../crab.js';
import { buildSip } from './d-sip.js';
import { bounce, throb, hop, BEAT } from './beat.js';
import { TINT } from './moves.js';
import { stackSpot, kindOf, PILE, KIND } from './slips.js';
import { bodyNow } from './hold.js';
import { buildQuilt } from './quilt.js';

export const span = [62.3, 82.2];
const SIZE = 1.15, STAY = [0, .9], SHEETS = 90;                        // 主角的个头、留守的位置、那摞纸的张数
const CUTS = { pot: 67.6, find: 73, read: 74.95, face: 76.5, keep: 77.4 };   // 每次切镜头的时刻
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const eye = (p, q, on = q) => ({ p, q, f: dist(p, on) });             // 一个机位：p 镜头位置，q 看向的点，on 对焦在哪（不写就是 q）
const ahead = (p, d, y) => [p.x + d * Math.sin(p.yaw * D), p.y + y, p.z + d * Math.cos(p.yaw * D)];   // 小蟹身前 d、脚底往上 y 的那一点
const bob = (t, at, half) => Math.sin(Math.PI * prog(t, at - half, at + half));   // at 前后 half 秒里鼓起又落下的一下（比 pulse 圆润）
export function build(kit) {
  const { hero, lights, slips } = kit, props = kit.group(), quilt = buildQuilt(props);
  const HOME = { x: STAY[0], z: STAY[1], s: SIZE }, hp = (...parts) => pose(HOME, ...parts);

  // ———————————————— 一、醒来（62.3 – 67.6）————————————————
  const ORB_AT = [0, 1, 2, 3].map(i => 63.96 + BEAT * i), ORB_LIFE = 1, ASK = 66.95;   // 四个光球冒出来的时刻（都在拍点上）、各活多久；冒问号的时刻
  const ASLEEP = { sq: -.3, lean: 12, pitch: 5, aL: [-60, .2, .05], aR: [-60, .2, .05] };
  const WAKE_KEYS = [
    [63.0, hp(ASLEEP)], [63.4, hp(ASLEEP, { sq: -.37, lean: 15 })],                                                         // 先蜷紧一下
    [63.95, hp({ sq: .32, lean: -5, pitch: -10, mouth: .95, aL: [74, .34, .05], aR: [64, .34, .05] })],                      // 伸懒腰，打哈欠：慢慢起、慢慢到头
    [64.45, hp({ sq: .27, lean: 5, pitch: -8, mouth: .8, aL: [80, .34, .05], aR: [70, .34, .05] })],
    [64.75, hp({ sq: -.12 })], [64.95, hp()],                                                                                // 落回来
    [65.2, hp({ yaw: -24, look: [-.8, .1] })], [65.6, hp({ yaw: -24, look: [-.8, .1] })],                                   // 左看
    [65.85, hp({ yaw: 22, look: [.8, .1] })], [66.2, hp({ yaw: 22, look: [.8, .1] })],                                      // 右看
    [66.45, hp({ yaw: 6, look: [.15, .85], pitch: -9 })], [66.8, hp({ yaw: 6, look: [.15, .85], pitch: -9 })],              // 抬头看最后一个光球
    [67.08, hp({ yaw: 36, lean: 13, look: [.6, -.35], brow: -.7, aL: [72, .33, .14] })],                                    // 歪头看那摞纸，抬手挠头
    [67.6, hp({ yaw: 40, lean: 15, look: [.6, -.35], brow: -.7, aL: [72, .33, .14] })],
  ];
  function wake(t) {
    const p = pose(key(t, WAKE_KEYS)), awake = prog(t, 64.8, 65), scratch = prog(t, 67.05, 67.15);
    p.mood = stepAt(t, [[0, MOOD.calm], [64.7, MOOD.open]]);
    p.sq += .03 * Math.sin(t * 2.6) * (1 - prog(t, 63, 63.4)) + throb(t) * awake - .1 * bob(t, 66.86, .1);              // 睡着时慢慢呼吸；光球「啵」的时候缩一下脖子
    p.lean += 1.6 * Math.sin(t * 60) * bob(t, 64.2, .28);                                                              // 懒腰伸到头，抖一抖
    p.aL = [p.aL[0] + 13 * Math.sin(t * 34) * scratch, p.aL[1], p.aL[2]];
    p.blink = Math.max(.5 * awake * (1 - prog(t, 65, 66.3)), pulse(t, 64.98, .09), pulse(t, 65.2, .09), pulse(t, 66.86, .1), pulse(t, 67.2, .09));   // 刚醒时眼皮还半搭着
    return p;
  }
  // 被子：昨夜「月很圆」那一页抖开成的布被（quilt.js），盖在背上，和上一段结尾同一个样子，跟着呼吸一起一伏。
  // 伸懒腰时被身体和举起的两手顶起来，伸到头就从背上往后滑下去，摊平在身后，之后一直在那里
  const SLIDE = [64.2, 65.6];                                          // 从背上滑下去、摊平，从几时到几时
  function drawQuilt(t, body) {
    if (t < SLIDE[0]) quilt.cover(body);
    else if (t < SLIDE[1]) quilt.slide(body, prog(t, ...SLIDE));
    else quilt.rest();
  }
  // 昨夜的记忆：四个带四季颜色的小光球，从头顶一个个飘出来，晃晃悠悠升上去，「啵」地碎成几粒
  // 颜色比光点用的四季色压暗一些：清晨的画面亮，太亮的球会泛成白的，看不出是哪一季
  const ORBS = ['春', '夏', '秋', '冬'].map((season, i) => ({ born: ORB_AT[i], tint: TINT[season].clone().multiplyScalar(.6), top: [(i % 2 ? 1 : -1) * (.55 + .3 * i), 3.5 + .3 * i, STAY[1] + .2] }));
  function drawOrbs(t) {
    ORBS.forEach((o, i) => {
      const u = t - o.born, v = prog(u, ORB_LIFE, ORB_LIFE + .3);
      if (u < 0 || v >= 1) return;
      if (u < ORB_LIFE) {
        const k = u / ORB_LIFE, at = [STAY[0] + o.top[0] * ease.io(k) + .1 * Math.sin(u * 7 + i), lerp(2.05, o.top[1], ease.out(k)), o.top[2]];
        lights.put(at, .21 * ease.out(prog(u, 0, .3)) * (1 + .08 * Math.sin(u * 11)) * (1 + .9 * pulse(u, ORB_LIFE, .07)), o.tint);
        return;
      }
      for (let n = 0; n < 6; n++) lights.put([STAY[0] + o.top[0] + .6 * ease.out(v) * Math.cos(n * TAU / 6 + i), o.top[1] + .6 * ease.out(v) * Math.sin(n * TAU / 6 + i), o.top[2]], .055 * (1 - v), o.tint);
    });
  }
  // 问号：画在一小块贴图上，总是正对镜头
  const mark = (() => {
    const canvas = document.createElement('canvas'), g = canvas.getContext('2d');
    canvas.width = canvas.height = 160;
    g.font = '900 132px "Songti SC", "STSong", serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    g.strokeStyle = '#3A1810'; g.lineWidth = 20; g.strokeText('?', 80, 86);
    g.fillStyle = '#FFF4E2'; g.fillText('?', 80, 86);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, fog: false }));
    mesh.renderOrder = 21; props.add(mesh);
    return mesh;
  })();
  function drawMark(t, cam) {
    mark.visible = t >= ASK && t < CUTS.pot;
    if (!mark.visible) return;
    mark.position.set(STAY[0] + 1.0, 2.8 + .07 * Math.sin(t * 6), STAY[1] + .5);
    mark.scale.setScalar(1.35 * ease.back(prog(t, ASK, ASK + .22)));
    mark.lookAt(...cam.p); mark.rotateZ((-14 + 5 * Math.sin(t * 6)) * D);
  }

  // ———————————————— 二、水盂边（67.6 – 73.0）：用吸管喝孟婆汤，见 d-sip.js ————————————————
  const sip = buildSip(kit, props);

  // ———————————————— 三、枕边的字（73.0 – 77.4）————————————————
  // 留言在它睡觉的地方左边，从 SEEN（切到这个镜头的那一刻）起才出现在画面里；接着亮起来，它转过去（朝 TURN 的方向）凑近、弯腰，
  // 捧起来的同时转回正面站直了读：读字的那两个镜头（眼前的纸、它的脸）都在它正前方的中轴上，背景是正的
  const SEEN = 73, TURN = -52;
  const NOTE = { at: [-1.75, .025, 1.5], rot: [-90, -20, 0] }, NEAR = { x: -.22, z: .68, s: SIZE }, np = (...parts) => pose(NEAR, ...parts);   // NEAR：凑过去以后站的地方
  const CARRY = { aL: [-150, .3, .62], aR: [-150, .3, .62] }, HUG = { aL: [160, .34, .74], aR: [160, .34, .74] };   // 捧着纸、抱着纸时的两只手
  const READ = [1.75, .8, -60], HELD = [1.14, .74, -7];                // 捧着读、贴在胸口时纸的位置：[身前多远, 多高, 俯仰]。抱着时纸的上沿在眼睛下面：眼睛从纸上面露出来
  const PICK = [74.45, 74.9], EMBRACE = [81.3, 81.75];                 // 捧起来、抱进怀里各从几时到几时
  const FRONT = [74.64, 74.9];                                         // 捧着纸转回正面从几时到几时：等纸离了地、举到身前再转，身子的棱角不扫到还贴着地的纸
  const FIND_KEYS = [
    [73.5, hp({ look: [.1, .15], mouth: .12, pucker: .45 })],                                                              // 还在发呆
    [73.72, hp({ look: [-.85, -.45], sq: .13 })], [73.95, hp({ look: [-.85, -.45] })],                                      // 余光里有东西亮了：吓一跳
    [74.42, np({ yaw: TURN, pitch: 17, look: [0, -.7], stride: .25, aL: [-25, .3, .5], aR: [-25, .3, .5] })],               // 转身凑过去，俯身
    [74.9, np(CARRY, { pitch: 9, look: [0, -.75] })], [76.4, np(CARRY, { pitch: 9, look: [0, -.75] })],                     // 捧起来，转回正面读
    [76.85, np(CARRY, { pitch: 3, look: [-.1, -.3], brow: -.5, blush: 1.5, mouth: .16 })],                                  // 抬起眼：眼眶一热
    [77.05, np(CARRY, { pitch: 3, look: [-.1, -.3], brow: -.5, blush: 1.5, mouth: .16 })],
    [77.3, np(CARRY, { look: [.85, .1], blush: 1.5, mouth: .3 })],                                                          // 余光里那摞纸也亮了
  ];
  function find(t) {
    const p = pose(key(t, FIND_KEYS)), reading = prog(t, 74.9, 75.1) * (1 - prog(t, 76.4, 76.5));
    if (t > 74.42) p.yaw = TURN * (1 - ease.io(prog(t, ...FRONT)));
    p.y += .18 * hop(t, 73.66, 73.9) + .12 * Math.abs(Math.sin(Math.PI * (t - 73.95) / .235)) * prog(t, 73.95, 74) * (1 - prog(t, 74.38, 74.42));
    p.walk = (t - 73.95) / .47;
    p.sq += throb(t) * (1 - reading) + .012 * Math.sin(t * 3) * reading;
    p.look = [p.look[0] + .22 * Math.sin((t - 75) * 2.4) * reading, p.look[1]];                                           // 眼睛顺着两列字来回
    p.mood = stepAt(t, [[0, MOOD.open], [73.68, MOOD.wow], [74.5, MOOD.open]]);
    p.blink = Math.max(.3 * (1 - prog(t, 73.5, 73.68)), pulse(t, 75.7, .09), pulse(t, 76.72, .11), pulse(t, 76.98, .1));
    return p;
  }
  // 那张留言：唱到「只有枕边 昨夜的字」的那个镜头里才第一次出现（在这之前画面里没有它）：躺在枕边 → 被捧起来 → 最后翻过来贴在胸口
  function drawNote(t, p) {
    if (t < SEEN) return;
    const lit = prog(t, 73.15, 73.5), took = ease.io(prog(t, ...PICK)), hug = ease.io(prog(t, ...EMBRACE));
    // 从地上捧起来、在胸前翻面时，纸要转半圈，转的时候先往前送一点，纸边不会扫进身体里
    const [d, y, tilt] = mix(READ, HELD, hug), at = mix(NOTE.at, ahead(p, d + .55 * Math.sin(Math.PI * took) + .55 * Math.sin(Math.PI * hug), y), took);
    slips.put({ at: [at[0], at[1] + .35 * Math.sin(Math.PI * took), at[2]], rot: mix(NOTE.rot, [tilt, p.yaw + 180 + 180 * hug, 1.5 * Math.sin(t * 3.1)], took * took), kind: KIND.note,
      size: lerp(1, 1.18, took - hug), glow: lit * lerp(.26 + .16 * Math.sin(t * 5.2), .1, took) + .2 * (took - hug), curl: .08 * took });   // 捧着读时纸背朝着我们：晨光从窗那边透过薄纸，纸背是暖的
  }

  // ———————————————— 四、一笔一画（77.4 – 82.2）————————————————
  // 纸带：第 n 个起飞的纸排在第 n 个位置，一共绕两圈、越绕越大；整条带子慢慢转，朝镜头的一侧低、远的一侧高，不挡住中间的主角
  const RING = { c: [-.2, .9], out: 77.45, back: 80.15, spin: 70, flyUp: .75, flyDown: .6 };
  const PAPERS = Array.from({ length: SHEETS }, (_, i) => {
    const n = SHEETS - 1 - i;                                           // 最上面那张最先飞
    return { ...stackSpot(PILE, i), kind: kindOf(i), go: RING.out + .0165 * n, home: RING.back + .0085 * i, a0: (n * 8 + 180) % 360 - 180, r: 3.1 + .0145 * n, phase: TAU * rnd(i * 7.7) };
  });
  function ringSpot(s, t) {
    const deg = s.a0 + RING.spin * (t - RING.out), a = deg * D;         // a = 0 是朝镜头的那一侧
    return { at: [RING.c[0] + s.r * Math.sin(a), 2.25 - 1.5 * Math.cos(a) + .12 * Math.sin(t * 2.3 + s.phase), RING.c[1] + s.r * Math.cos(a)], rot: [-8, deg + 180, 6 * Math.sin(t * 1.7 + s.phase)] };
  }
  // 从摞上飞到纸带里（和落回去）的路：绕着纸带中心转过去，半径、角度、高度各自过渡，不会从中间主角站的地方横穿过去
  const polar = ([x, y, z]) => [Math.hypot(x - RING.c[0], z - RING.c[1]), Math.atan2(x - RING.c[0], z - RING.c[1]), y];
  function around(a, b, k) {
    const [ra, aa, ya] = polar(a), [rb, ab, yb] = polar(b), turn = ((ab - aa + Math.PI) % TAU + TAU) % TAU - Math.PI, r = lerp(ra, rb, k), ang = aa + turn * k;
    return [RING.c[0] + r * Math.sin(ang), lerp(ya, yb, k), RING.c[1] + r * Math.cos(ang)];
  }
  function drawPapers(t) {
    PAPERS.forEach(s => {
      const k = ease.io(prog(t, s.go, s.go + RING.flyUp)) * (1 - ease.io(prog(t, s.home, s.home + RING.flyDown))), ring = ringSpot(s, t), at = around(s.at, ring.at, k);
      const waiting = t < s.go, ink = waiting ? 1 : prog(t, s.go + .6, s.go + 1.5);
      // 起飞前整摞先亮起来；起飞时闪一下，显墨迹时亮着，落回去时再闪一下
      const glow = waiting ? .35 * prog(t, 77, 77.4) : .5 * pulse(t, s.go + .08, .25) + .3 * Math.sin(Math.PI * ink) + .1 * k + .35 * pulse(t, s.home + RING.flyDown + .05, .3);
      slips.put({ at: [at[0], at[1] + .9 * Math.sin(Math.PI * k), at[2]], rot: mix(s.rot, ring.rot, k), kind: s.kind, ink, glow, curl: .12 * k });
    });
  }
  const SPIN = [78.5, 80.4];                                            // 它转一整圈的时间
  const KEEP_KEYS = [
    [77.4, np(CARRY, { look: [.85, .1], blush: 1.5, mouth: .3 })],
    [77.95, np(CARRY, { yaw: 40, look: [.4, .6], mouth: .5, pitch: -5 })], [SPIN[0], np(CARRY, { yaw: 67, look: [.2, .75], mouth: .55, pitch: -8 })],   // 仰头看纸一张张飞起来
    [SPIN[1], hp(CARRY, { yaw: 427, look: [.2, .75], mouth: .55, pitch: -8 }), 'lin'],                                                                  // 转着圈看
    [80.85, hp(CARRY, { yaw: 392, look: [.5, .2], mouth: .3 })], [81.25, hp(CARRY, { yaw: 392, look: [.6, -.1], mouth: .2 })],                           // 目送它们落回去
    [EMBRACE[1], hp(HUG, { yaw: 360, sq: -.06, blush: 2, lean: -5 })], [82.4, hp(HUG, { yaw: 360, sq: -.06, blush: 2, lean: 5 })],                       // 抱住留言，轻轻地晃
  ];
  function keep(t) {
    const p = pose(key(t, KEEP_KEYS)), dance = prog(t, 78.3, SPIN[0]) * (1 - prog(t, SPIN[1], 80.6));
    p.y += .26 * bounce(t) * dance;
    p.sq += throb(t) + .07 * bob(t, EMBRACE[1], .16);
    p.mood = stepAt(t, [[0, MOOD.open], [77.42, MOOD.wow], [78.4, MOOD.star], [EMBRACE[0] + .15, MOOD.joy]]);
    p.blink = pulse(t, 80.95, .09);
    return p;
  }

  // ———————————————— 镜头 ————————————————
  // 机位都朝书案正后方看（p 和 q 的 x 一样），背景横平竖直：主角独占画面时镜头在它正前方；要同时交代那摞纸或留言时，镜头平移到两者中间
  const along = (d, y) => [NEAR.x, y, NEAR.z + d];                       // 读字时它正前方 d 远、y 高的点
  const PAGE = along(READ[0], READ[1]), FACE = along(.6, 1.2);
  const CAM = [
    [62.3, eye([0, 2.5, 6.4], [0, .8, 1.1], [0, 1, 1.4])], [63.5, eye([0, 2.4, 7.0], [0, .95, 1.1], [0, 1, 1.4]), 'lin'],                                 // 它的正前方、略高一点看它睡：看得见背上的被子
    [64.5, eye([0, 2.1, 9.4], [0, 2.1, .9], [0, 1.3, 1.4])], [66.7, eye([0, 2.3, 10.2], [0, 2.3, .9], [0, 1.3, 1.4]), 'lin'],                             // 伸懒腰时拉开，给头顶的光球留出地方
    [CUTS.pot, eye([.6, 2.0, 9.1], [.6, 1.6, 1.2], [0, 1.3, 1.4])],                                                                                        // 它歪头看那摞纸：镜头往右平移一点，把那摞纸带进来
    [CUTS.find, eye([-.5, 1.7, 8.3], [-.5, 1.0, 1.1], [0, 1.1, 1.6])], [CUTS.read, eye([-1, 1.5, 7.1], [-1, .9, 1.2], [-.6, 1, 1.6]), 'lin'],             // 回到纸上：它在右，枕边的留言在左
    [CUTS.read, eye(along(1.15, 4.7), PAGE)], [CUTS.face, eye(along(1.3, 3.9), PAGE), 'lin'],                                                              // 它眼前的纸（镜头在它额头上方，几乎垂直往下看）
    [CUTS.face, eye(along(5.6, 1.55), FACE)], [CUTS.keep, eye([.2, 1.5, NEAR.z + 5], [.2, 1.2, NEAR.z + .6], FACE), 'lin'],                               // 它的脸：正前方，慢慢推近；末了往右平移一点，让出亮起来的那摞纸
    [CUTS.keep, eye([.5, 4.6, 14.2], [.5, 2.1, .6], [0, 2, 2])], [80.4, eye([-.6, 5.3, 13.4], [-.6, 2.2, .6], [0, 2, 2]), 'lin'],                          // 满屋的纸：高处的正面全景，一边升一边往左平移
    [82.2, eye([0, 1.9, 6.7], [0, 1.25, .9], [0, 1.2, 1.7])],                                                                                              // 推近到它的正前方：它抱着留言
  ];
  // 每个镜头里主角怎么演、那摞纸怎么画
  const ACTS = [[0, wake], [CUTS.pot, sip.act], [CUTS.find, find], [CUTS.keep, keep]];
  // 每段时间的镜头：水盂边那个镜头由 d-sip.js 自己给（它的对焦要跟着吸管里的汤走）
  const onDesk = t => key(t, CAM), CAMS = [[0, onDesk], [CUTS.pot, sip.cam], [CUTS.find, onDesk]];

  return {
    frame(t) {
      const act = stepAt(t, ACTS);
      kit.act(hero, act);
      // 先把这一帧的主角摆好：被子、吸管、手里的纸都要贴着它此刻的身体和嘴放。总调度随后会用同样的姿势再摆一遍，结果一样
      const body = bodyNow(hero, act, t);
      drawQuilt(t, body); drawOrbs(t); drawMark(t, key(t, CAM)); sip.draw(t); drawNote(t, act(t)); drawPapers(t);
      return { cam: stepAt(t, CAMS)(t), dawn: 1, lamp: 0 };
    },
  };
}
