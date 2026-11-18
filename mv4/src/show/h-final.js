// 第八段（149.8 – 183.2 秒）：全片的高潮。主角发现自己手里也攥着一张白纸；最后一遍副歌在书案上的部分。
//   149.8 – 154.58 「低头一看 我手里」：正前方的近景，很安静。它望着油灯出神，低头，从身后摸出一直攥着的那张纸，捧到眼前——是白的。
//               镜头升高一点、往下摇到纸上（从上往下才看得见纸面）
//   154.58 – 158.9 「也攥着 白纸一张」：它吓得一蹦，瞪大了眼。镜头沿中轴急速后拉升高，脚下是整张写满歌词的宣纸（在画面里是正的）；它左看右看，
//               身体像心跳一样闪了两下虚影——自己也是一万个里的一个。一阵看不见的风吹动毫毛，它转身望向屏风
//   （158.9 – 164.5 是外景，不在这里）
//   164.5 – 169.4 「出发时候 一个样」：上千点一样的暖光从四幅画里涌出来，在宣纸上空聚成一条缓缓旋转的银河；主角在下面仰头转着圈看
//   169.4 – 175.72「回来各带 各的光」：从它正前方的低处仰拍主角和头顶的银河；唱到「各的光」，一道彩色的波浪从左到右扫过，每点光换成自己的颜色；
//               光落下来，落地「啵」地变回小蟹，头顶各提着一盏自己颜色的小灯，踩着拍子蹦；镜头贴着纸面从小蟹堆里穿过去，再升起来
//   175.72 – 179.35「我也是谁 一口气」：大家安静下来。一阵风从镜头这边吹过纸面，小蟹们依次被吹得一仰、毫毛飘起，
//               然后一起抬头望向风来的地方。镜头从主角正前方的近景沿中轴垂直升起
//   179.35 – 183.2「这首歌 是我那张」：正上方俯拍。主角把白纸转过来放到宣纸上，纸上显出歌名「一万个我」，发着光；
//               镜头继续升高，露出整张写着这首歌的宣纸，各色的光散在字里行间，跟着拍子一起闪
// 主角独占画面的近景都在它正前方（它面朝镜头，镜头朝书案正后方看，背景横平竖直）。它身边那摞纸（140 张，约 1.3 高）在它右前方，
// 比它矮、离它一个身位：正面拍时落在画面最右边，仰拍时在右下角，都不挡它。
import * as THREE from 'three';
import { D, TAU, lerp, prog, pulse, rnd, ease, key, mix, stepAt } from '../anim.js';
import { pose, MOOD } from '../crab.js';
import { BH, LEG } from '../crab/pose.js';
import { STAGE } from '../world/layout.js';
import { bounce, throb, hop, UP, V } from './beat.js';
import { arc, WARM, TINT, windowSpot } from './moves.js';
import { drawPile, stackSpot, PILE, KIND } from './slips.js';
import { bodyNow, dims, place, grip, along, blend, HANDS } from './hold.js';

export const span = [149.8, 183.2];
const STAY = [0, .9], BIG = 1.15, AWAY = 200, FRONT = 360;            // 主角留守的位置和大小；面朝屏风；转过一整圈后再面朝镜头记作 360（朝向要连续）。开头面朝镜头（朝向 0）
const GASP = 154.58, WAVE = 171.49, RAIN = 172.7, HUSH = 175.72, ABOVE = 179.35;   // 吓一跳；彩色的波浪扫过；光落下来；大家安静下来；镜头升到正上方（都在拍点上）
const PAGES = 140;                                                    // 那摞纸的张数
const kick = t => (1 - bounce(t)) ** 3;                               // 拍点上是 1，随即落回 0：光跟着拍子一闪
// 光的颜色：四季的光色之外再添五种（梅红、藤紫、青瓷、鹅黄、月白）。上千点光叠在一起时，原样的颜色会曝成一片白，
// 所以都先提纯（压掉最暗的那个分量）、把最亮的分量定在 1.25，叠起来仍然看得出各自的颜色
const vivid = c => { const low = .7 * Math.min(c.r, c.g, c.b), out = new THREE.Color(c.r - low, c.g - low, c.b - low); return out.multiplyScalar(1.25 / Math.max(out.r, out.g, out.b)); };
const PALETTE = [TINT.春, TINT.夏, TINT.秋, TINT.冬, new THREE.Color(2, .5, .32), new THREE.Color(1.25, .75, 2), new THREE.Color(.45, 1.65, 1.6), new THREE.Color(1.85, 1.55, .4), new THREE.Color(1.6, 1.5, 1.25)].map(vivid);
const SAME = WARM.clone().multiplyScalar(1.1);                        // 出发时大家都是这一个暖色

// 风：从镜头这边（正前方）的高处吹向纸的远端。windAt 是风头扫到纸上某一点的时刻；gust 是被吹到之后身体歪多少（一仰、回弹、停住）；flutter 是毫毛抖动的那一阵
const WIND = V(0, 0, -1), windAt = (x, z) => 175.95 + (x * WIND.x + z * WIND.z + 14.5) / 22;
const gust = u => (u > 0 ? 1.95 * Math.exp(-2.4 * u) * Math.sin(5 * u) : 0), flutter = u => prog(u, 0, .15) * (1 - prog(u, .3, 1.5));
const GAZE = { yaw: 0, pitch: -34, look: [0, .95] };                 // 大家一起望向风来的地方（正前方的上方，镜头正从那里升起）时的朝向、后仰、视线

const eul = new THREE.Euler(), v3 = new THREE.Vector3(), UPWARD = V(0, 1, 0);
// 身体上的一点（身体自己的坐标，y 从身体底面量起）此刻在世界里的大致位置：只算歪、俯、朝向和大小，不算软体变形
function onBody(p, x, y, z) {
  v3.set(x, y, z).applyEuler(eul.set(p.pitch * D, 0, -p.lean * D));
  v3.y += LEG + p.y / p.s;
  v3.multiplyScalar(p.s).applyAxisAngle(UPWARD, p.yaw * D);
  return [v3.x + p.x, v3.y, v3.z + p.z];
}
const add = (a, b) => a.map((v, i) => v + b[i]);

export function build(kit) {
  const { world, hero, full, lite, lights, slips } = kit, props = kit.group();

  // ———————————————— 主角 ————————————————
  const hp = (...parts) => pose({ x: STAY[0], z: STAY[1], s: BIG }, ...parts);
  // 小短手的几种摆法（纸攥在 aL 那只手里，在画面左边）：藏在身后、从身侧绕出来、两手捧在身前、垂在身侧、高高举起、往前递到地上
  const HIDE = [-40, .15, -.8], OUT = [-15, .34, .1], HOLD = HANDS.read, SIDE = [-22, .3, .12], HIGH = [62, .32, .08], GIVE = [-150, .3, .7], both = arm => ({ aL: arm, aR: arm });
  const peek = { yaw: -28, look: [-.7, -.4], pitch: 8, mouth: .3, pucker: .4, ...both(HOLD) }, awe = { yaw: FRONT, pitch: -17, look: [0, .9], mouth: .45, aL: SIDE };
  const whee = { yaw: FRONT, pitch: -12, look: [0, .9], mouth: .75, laugh: .7, aL: HIGH, aR: UP.aR }, glee = { mouth: .6, laugh: .6, aL: HIGH }, up = { yaw: FRONT + GAZE.yaw, pitch: -30, look: GAZE.look, mouth: .22, ...both(HOLD) };
  const bow = { yaw: FRONT, pitch: 32, look: [0, -.9], sq: -.1, ...both(GIVE) }, smile = { yaw: FRONT, pitch: -32, look: GAZE.look, mouth: .55, laugh: .5 };
  const HERO = [
    [149.8, hp({ look: [-.55, .3], aL: HIDE })], [150.45, hp({ look: [-.55, .3], aL: HIDE })],                                          // 面朝镜头，眼睛还望着油灯那边出神
    [150.85, hp({ aL: HIDE }), 'io'], [151.15, hp({ aL: HIDE })],
    [151.75, hp({ look: [-.55, -.8], pitch: 10, sq: -.05, lean: -5, aL: HIDE }), 'io'],                                                 // 低头：手里好像有东西
    [152.05, hp({ look: [-.6, -.85], pitch: 11, sq: -.05, lean: -6, aL: HIDE })],
    [152.45, hp({ look: [-.6, -.8], pitch: 12, aL: OUT }), 'io'],                                                                       // 从身侧绕出来
    [152.95, hp({ look: [0, -.9], pitch: 14, ...both(HOLD) }), 'io'],                                                                   // 两只手捧到眼前
    [154.2, hp({ look: [0, -.95], pitch: 17, lean: 3, ...both(HOLD) }), 'lin'],
    [154.46, hp({ look: [0, -.95], pitch: 20, sq: -.17, pucker: .7, ...both(HOLD) }), 'io'],                                            // 一缩
    [154.66, hp({ look: [0, -.6], pitch: 2, sq: .2, mouth: .5, pucker: .7, ...both(HOLD) }), 'out'],                                    // 吓得一蹦
    [154.98, hp({ look: [0, -.75], pitch: 8, mouth: .4, pucker: .6, ...both(HOLD) }), 'io'],
    [155.32, hp(peek), 'io'], [155.46, hp(peek)],                                                                                       // 看左边的字
    [155.84, hp(peek, { yaw: 26, look: [.7, -.4] }), 'io'], [155.96, hp(peek, { yaw: 26, look: [.7, -.4] })],                           // 看右边的字
    [156.3, hp({ look: [0, -.9], pitch: 15, mouth: .2, ...both(HOLD) }), 'io'], [157.3, hp({ look: [0, -.9], pitch: 15, mouth: .2, ...both(HOLD) })],   // 再看手里的纸，看自己
    [157.7, hp({ pitch: -5, look: [0, .2], aL: SIDE }), 'io'], [158.2, hp({ pitch: -5, look: [0, .2], aL: SIDE })],                     // 起风了：直起身子
    [158.8, hp({ yaw: AWAY, pitch: -12, look: [0, .7], aL: SIDE }), 'io'],                                                              // 转身望向屏风
    [165.6, hp({ yaw: AWAY, pitch: -15, look: [.3, .8], mouth: .4, aL: SIDE })],
    [169.0, hp(awe), 'io'], [171.45, hp(awe)],                                                                                          // 仰着头跟着银河转一圈
    [171.8, hp(whee), 'out'], [172.75, hp(whee)],                                                                                       // 换颜色了！
    [173.15, hp(glee, { yaw: FRONT - 30, look: [-.5, -.1] }), 'io'], [173.7, hp(glee, { yaw: FRONT - 30, look: [-.5, -.1] })],          // 左边落下来了
    [174.2, hp(glee, { yaw: FRONT + 28, look: [.5, -.1] }), 'io'], [174.7, hp(glee, { yaw: FRONT + 28, look: [.5, -.1] })],             // 右边也是
    [175.2, hp(glee, { yaw: FRONT }), 'io'], [175.6, hp(glee, { yaw: FRONT })],
    [HUSH, hp({ yaw: FRONT, aL: SIDE })], [177.5, hp({ yaw: FRONT, pitch: -2, aL: SIDE })],                                             // 安静下来
    [178.4, hp(up), 'io'], [179.45, hp(up)],                                                                                            // 抬头望向风来的地方
    [179.95, hp(bow), 'io'], [180.25, hp(bow)],                                                                                         // 弯下腰，把纸放到宣纸上
    [180.7, hp({ yaw: FRONT, pitch: 14, look: [0, -.9], mouth: .15 }), 'io'], [181.6, hp({ yaw: FRONT, pitch: 14, look: [0, -.9], mouth: .3 })],   // 看着字显出来
    [182.05, hp(smile), 'io'], [183.2, hp(smile)],                                                                                      // 抬头笑了
  ];
  const HERO_MOOD = [[149.8, MOOD.open], [GASP, MOOD.wow], [157.45, MOOD.calm], [158.25, MOOD.open], [164.5, MOOD.wow], [166.6, MOOD.star], [172.9, MOOD.joy], [HUSH, MOOD.open], [176.5, MOOD.calm], [177.35, MOOD.open], [181.95, MOOD.joy]];
  const HERO_BLINK = [150.7, 152.2, 153.1, 153.45, 156.2, 165.3, 178.9, 180.9], HERO_GUST = windAt(...STAY), BEATS = [156.39, 156.99];   // BEATS：虚影闪的那两下
  function heroPose(t) {
    const p = pose(key(t, HERO)), party = prog(t, 173.3, 173.5) * (1 - prog(t, HUSH - .4, HUSH - .1)), cheer = prog(t, 182.05, 182.3), calm = 1 - prog(t, GASP - .4, GASP);
    const beat = Math.max(...BEATS.map(at => (t > at ? Math.exp(-(t - at) * 5.5) * prog(t, at, at + .06) : 0))), early = pulse(t, 157.75, .6), u = t - HERO_GUST;
    p.mood = stepAt(t, HERO_MOOD);
    p.y = .5 * hop(t, GASP, GASP + .36) + .3 * hop(t, WAVE + .05, WAVE + .4) + .4 * bounce(t) * party + .16 * bounce(t) * cheer;
    if (party > .5 && bounce(t) > .4) p.aR = UP.aR;
    if (cheer > .5 && bounce(t) > .4) Object.assign(p, UP);
    p.sq += lerp(throb(t), .02 * Math.sin(t * 1.6), calm) + .09 * beat;                                 // 安静的时候只是轻轻呼吸
    p.puff = .3 * beat; p.ghost = .5 * beat;                                                            // 心跳似的两下：身体一鼓，闪成虚影
    p.brow = -.6 * prog(t, 151.6, 152) * (1 - prog(t, 157.3, 157.7));
    p.lean += 6 * Math.sin((t - 157.3) * 6.5) * early + 1.4 * Math.sin(t * 41) * (early + flutter(u)) + 9 * gust(u) * WIND.x;   // 被风吹得晃：晃得快的那一层是为了带动毫毛
    p.pitch += 9 * gust(u) * WIND.z;
    p.blink = Math.max(...HERO_BLINK.map(at => pulse(t, at, .1)));
    return p;
  }

  // 主角手里那张纸的几种拿法，按它此刻的身体算（hold.js）：藏在身后（被身体整个挡住）、绕到身侧（左手拿着，纸面朝着正前方的镜头）、
  // 两手捧在身前（字朝着自己，纸的远沿在嘴下面）、竖在身侧、举高了挥（都在左手边，靠身体的那条边贴着身侧）
  const GRIP = {
    back: (b, H) => grip.around(b, 180, .45 * H),
    out: (b, H) => grip.beside(b, 1, -1, .5 * H),
    read: b => grip.read(b, 1, -70, .4),
    side: (b, H) => grip.beside(b, 1, -1, .55 * H),
    high: (b, H) => grip.beside(b, 1, -1, .95 * H),
  };
  const CURL = { back: 0, out: .05, read: .1, side: .06, high: .08 };
  const GRIPS = [[149.8, 'back'], [152.05, 'back'], [152.45, 'out'], [152.95, 'read'], [157.3, 'read'], [157.7, 'side'], [171.5, 'side'], [171.85, 'high'], [175.6, 'high'], [HUSH, 'side'], [177.6, 'side'], [178, 'out'], [178.4, 'read']];
  const LAID = { at: [0, .03, 3.3], rot: [-90, 0, 0], size: 1.7 }, LAY = [179.55, 180.15], INK = [180.3, 181.3];   // 放到宣纸上之后：位置、朝向（转过来，字头朝纸的远端）、大小（落下后舒展开一些，俯拍才看得清字）；放下的时间；字显出来的时间
  function drawHeld(t) {
    const b = bodyNow(hero, heroPose, t), { H } = dims(b), spots = Object.fromEntries(Object.entries(GRIP).map(([name, at]) => [name, at(b, H)]));
    const held = place(b, along(t, GRIPS.map(([at, name]) => [at, spots[name]]), b, .6)), lay = ease.io(prog(t, ...LAY)), shown = prog(t, ...INK);
    const wave = (.5 * Math.sin(t * 9) + .5) * prog(t, 172, 172.4) * (1 - prog(t, HUSH - .5, HUSH));
    held.rot[2] += -22 * wave + 5 * Math.sin(t * 23) * flutter(t - HERO_GUST);
    const spot = lay < 1 ? blend(held, LAID, lay) : LAID;
    slips.put({ ...spot, size: lerp(1, LAID.size, ease.back(prog(t, LAY[1] - .1, LAY[1] + .45))), kind: lay < 1 ? KIND.blank : KIND.title, ink: shown,
      glow: lerp(.35, .12, lay) + .3 * pulse(t, LAY[1], .3) + .06 * shown * kick(t),                    // 背着月光拿在手里时自己透一点暖光，才看得出是张白纸；字显出来以后收暗，免得把墨色冲淡
      curl: key(t, GRIPS.map(([at, name]) => [at, CURL[name]])) * (1 - lay) + .12 * flutter(t - HERO_GUST) * Math.sin(t * 17) });
  }

  // ———————————————— 回来的一万个：55 只小蟹站满宣纸、两条镇尺和那摞纸的顶上 ————————————————
  const SPOTS = [], LANES = [[[-10.4, 7.3], [-1.5, 4.3]], [[-2.9, 7.2], [-.5, 2]]];   // 两条不站小蟹、不落萤火的空道：镜头贴着纸面穿过去的那条路；主角左前方的一条（它左手举着的那张纸前面没有东西挡着）
  const offLanes = (x, z) => Math.min(...LANES.map(([a, b]) => { const k = Math.min(1, Math.max(0, ((x - a[0]) * (b[0] - a[0]) + (z - a[1]) * (b[1] - a[1])) / ((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2))); return Math.hypot(x - lerp(a[0], b[0], k), z - lerp(a[1], b[1], k)); }));
  const free = (x, z, s) => Math.hypot(x, z - STAGE.z) < 9.9 - s && Math.hypot(x - STAY[0], z - STAY[1]) > 1.8 + 1.4 * s && Math.hypot(x - PILE[0], z - PILE[2]) > .9 + s
    && !(Math.abs(x) < 1.3 + s && z > STAY[1] && z < 9) && offLanes(x, z) > .6 + s                      // 主角和正前方的镜头之间也留一条空道
    && SPOTS.every(o => Math.hypot(x - o.x, z - o.z) > 1.1 * (s + o.s) + .2);
  // 在以 center 为圆心、半径 ring 的环里，给 n 只小蟹各找一个互不相碰的站位
  const scatter = (n, size, center, ring, seed) => Array.from({ length: n }, (_, i) => {
    const s = size(i);
    for (let k = 0; k < 300; k++) {
      const a = TAU * rnd(seed + i * 7.1 + k * 3.3), r = lerp(ring[0], ring[1], Math.sqrt(rnd(seed + i * 2.9 + k * 5.1))), spot = { x: center[0] + r * Math.cos(a), z: center[1] + r * Math.sin(a), y0: 0, s };
      if (free(spot.x, spot.z, s)) { SPOTS.push(spot); return spot; }
    }
    throw new Error('纸上站不下这么多小蟹');
  });
  const near = scatter(full.length, i => .62 + .18 * rnd(i * 6.1), STAY, [2.8, 6.6], 1);               // 戴头饰的 15 只围在主角身边
  const perched = Array.from({ length: 12 }, (_, i) => { const at = world.perches[i * 2]; return { x: at.x, z: at.z, y0: at.y, s: .4 }; });
  const onPile = { x: PILE[0], z: PILE[2], y0: stackSpot(PILE, PAGES).at[1], s: .42 };                 // 有一只落在那摞纸的顶上
  const far = scatter(lite.length - 13, i => .4 + .12 * rnd(i * 4.3), [0, STAGE.z], [0, 9.6], 50);
  const CROWD = [...near, ...perched, onPile, ...far].map((spot, i) => ({
    ...spot, crab: i < full.length ? full[i] : lite[i - full.length], hue: PALETTE[i % PALETTE.length], yaw: 24 * (rnd(i * 7.3) - .5) - spot.x * 2, pep: rnd(i * 3.9),
    born: RAIN - .2 + .95 * (spot.x + 11) / 22 + .16 * rnd(i * 5.3), wind: windAt(spot.x, spot.z), gaze: 177.45 + .3 * rnd(i * 8.9), blinkAt: 176 + 5 * rnd(i * 2.1),   // 从左到右一片接一片地落地
  }));
  function crowdPose(c, t) {
    const u = t - c.born;
    if (u < 0) return pose({ s: 0 });
    const party = prog(u, .45, .6) * (1 - prog(t, HUSH - .25, HUSH + .1)), cheer = prog(t, 181.9, 182.2), jump = ((.26 + .2 * c.pep) * party + .12 * cheer) * bounce(t), w = t - c.wind, lifted = ease.io(prog(t, c.gaze, c.gaze + .8));
    const c0 = Math.cos(c.yaw * D), s0 = Math.sin(c.yaw * D), blown = gust(w), spin = c.pep > .8 ? 360 * ease.io(prog(t, 174.51, 175.12)) : 0;   // 最来劲的几只转一个圈
    return pose(jump > .1 ? UP : {}, {
      x: c.x, z: c.z, s: c.s * ease.back(prog(u, 0, .35)), y: c.y0 + 1.2 * c.s * hop(u, 0, .45) + jump,
      yaw: lerp(c.yaw + 14 * Math.sin(t * 2.3 + c.pep * 9) * party + spin, GAZE.yaw + spin, lifted),
      sq: .24 * pulse(u, .08, .12) - .2 * pulse(u, .48, .1) + throb(t) * (party + cheer),
      lean: 10 * blown * (WIND.x * c0 - WIND.z * s0) + 1.5 * Math.sin(t * 43 + c.pep * 20) * flutter(w),
      pitch: 10 * blown * (WIND.x * s0 + WIND.z * c0) + GAZE.pitch * lifted, look: mix([0, 0], GAZE.look, lifted),
      mood: party > .5 || cheer > .5 ? MOOD.joy : w > .05 && w < .8 ? MOOD.calm : MOOD.open, mouth: .5 * party + .2 * lifted + .3 * cheer,
      blink: Math.max(pulse(t, c.blinkAt, .09), pulse(t, c.blinkAt + 2.6, .09)),
    });
  }
  const lanternAt = (c, t) => { const p = crowdPose(c, t - .05); return add(onBody(p, 0, BH, 0), [0, (.5 + .07 * Math.sin(t * 2.4 + c.pep * 30)) * p.s + .08, 0]); };   // 小灯浮在头顶上方，跟着头走

  // ———————————————— 光：银河 → 各换各的颜色 → 落下来 ————————————————
  // 银河是宣纸上空的一个旋臂盘，靠镜头的一边翘高：镜头在低处，看见的是它的底面，衬着暗的屋子。里圈转得快，外圈转得慢。
  // 前 55 点是小蟹们的光，换色时正好转到各自落点的上空
  const CORE = [0, 6.6, -1.5], TILT = -15 * D, SPIN_FROM = 164, OVERHEAD = 171.9;
  const omega = r => .34 / (.6 + r / 7);
  function orbit(s, t) {
    const a = s.a0 + omega(s.r) * (t - SPIN_FROM), flat = s.r * Math.sin(a);
    return [CORE[0] + s.r * Math.cos(a), CORE[1] + s.h + .12 * Math.sin(t * 1.3 + s.phase) - flat * Math.sin(TILT), CORE[2] + flat * Math.cos(TILT)];
  }
  const STARS = Array.from({ length: 1100 }, (_, i) => {
    const soul = CROWD[i], s = { phase: i * 1.7, from: windowSpot(i + 900), launch: 163.3 + 3.5 * rnd(i * 8.3) ** 1.2, lift: 2 + 7 * rnd(i * 7.9) };
    if (soul) {
      const flat = (soul.z * .9 - CORE[2]) / Math.cos(TILT), x = soul.x * .9;
      Object.assign(s, { r: Math.hypot(x, flat), h: 0, size: .1, hue: soul.hue, soul }); s.a0 = Math.atan2(flat, x) - omega(s.r) * (OVERHEAD - SPIN_FROM);
    } else {
      const r = 1.2 + 8.6 * Math.sqrt(rnd(i * 3.1)), inArm = rnd(i * 9.7) < .7;                          // 三条旋臂，另有三成散在旋臂之间
      Object.assign(s, { r, h: 1.5 * (rnd(i * 4.7) - .5) * Math.exp(-r / 9), size: .04 + .06 * rnd(i * 3.7) ** 2, hue: PALETTE[Math.floor(rnd(i * 6.3) * PALETTE.length)],
        a0: inArm ? i % 3 * TAU / 3 + 2.4 * Math.log(1 + r / 2.5) + .5 * (rnd(i * 5.7) + rnd(i * 2.3) - 1) : TAU * rnd(i * 1.9) });
    }
    s.land = s.launch + 1.7 + .7 * rnd(i * 9.9);
    s.turn = WAVE + .95 * (orbit(s, OVERHEAD)[0] + 11) / 22;                                             // 波浪扫到它的时刻（从左到右）
    s.drop = soul ? soul.born - .75 : s.turn + .5 + .5 * rnd(i * 4.1); s.top = orbit(s, s.drop);
    const floor = [0, 1, 2, 3, 4, 5].map(k => [22 * (rnd(i * 5.9 + k) - .5), .14 + .5 * rnd(i * 7.1) ** 2, -12.5 + 23 * rnd(i * 8.7 + k)]).find(at => offLanes(at[0], at[2]) > 1.1);
    if (!soul && i < 400 && floor) Object.assign(s, { floor, settle: s.drop + 1.3 + .8 * rnd(i * 3.3), small: .028 + .024 * rnd(i * 2.7) });   // 落到字里行间的萤火
    return s;
  });
  const tint = new THREE.Color();
  function drawStars(t) {
    const flash = kick(t);
    STARS.forEach(s => {
      if (t < s.launch) return;
      const hued = ease.io(prog(t, s.turn, s.turn + .22)), crest = pulse(t, s.turn + .1, .2);
      tint.copy(SAME).lerp(s.hue, hued).multiplyScalar(1 + .35 * crest);
      if (t < s.drop) {                                                                                 // 从画里飞出来，汇进银河
        const { at, k } = arc(s.from, orbit(s, t), s.launch, s.land, t, s.lift);
        lights.put(at, lerp(.17, s.size, k * k) * (1 + .5 * crest), tint);                             // 刚出画时离镜头远，画大一点才看得见
      } else if (s.soul) {                                                                              // 小蟹的光：落到地上「啵」地一闪，然后成了头顶的小灯
        const c = s.soul, fall = ease.in(prog(t, s.drop, c.born)), u = t - c.born;
        if (u < 0) { lights.put(mix(s.top, [c.x, c.y0 + .15, c.z], fall).map((v, n) => v + (n === 1 ? 0 : .5 * (1 - fall) * Math.sin(t * 7 + s.phase + n))), s.size * (1 + .6 * fall), tint); return; }
        lights.put(lanternAt(c, t), (.07 + .1 * c.s) * (1 + 1.5 * pulse(u, .06, .2) + .3 * flash), tint.multiplyScalar(1.15 + .45 * flash));
      } else if (s.floor) {                                                                             // 落到纸面上的萤火：风来时被吹得一偏
        const k = ease.io(prog(t, s.drop, s.settle)), push = 1.4 * gust(t - windAt(s.floor[0], s.floor[2]));
        const at = mix(s.top, s.floor, k); at[0] += .2 * Math.sin(t * .9 + s.phase) * k + push * WIND.x; at[1] += .05 * Math.sin(t * 1.7 + s.phase) * k; at[2] += push * WIND.z;
        lights.put(at, lerp(s.size, s.small, k) * (1 + .5 * flash * k), tint.multiplyScalar(1 + .4 * flash * k));
      } else {                                                                                          // 其余的往上飘散，越来越小
        const v = t - s.drop, gone = prog(v, .5, 2.6);
        if (gone < 1) lights.put([s.top[0] * (1 + .12 * v), s.top[1] + 2.2 * v * v / (v + 1), s.top[2] + (s.top[2] - CORE[2]) * .12 * v], s.size * (1 - gone), tint);
      }
    });
  }

  // 每只小蟹落地的那一下：纸面上荡开一圈它自己颜色的涟漪
  const rings = new THREE.InstancedMesh(new THREE.TorusGeometry(1, .03, 6, 48).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ fog: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), CROWD.length);
  rings.frustumCulled = false; rings.renderOrder = 19; props.add(rings);
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), size3 = new THREE.Vector3(), at3 = new THREE.Vector3();
  function drawRings(t) {
    CROWD.forEach((c, i) => {
      const u = prog(t, c.born + .05, c.born + .75), live = u > 0 && u < 1;
      rings.setMatrixAt(i, m4.compose(at3.set(c.x, c.y0 + .04, c.z), q4.identity(), size3.setScalar(live ? c.s * (.9 + 2.2 * ease.out(u)) : 0)));
      rings.setColorAt(i, tint.copy(c.hue).multiplyScalar(.45 * (1 - u)));
    });
    rings.instanceMatrix.needsUpdate = rings.instanceColor.needsUpdate = true;
  }

  // 光晕：每盏小灯、还有显出歌名的那张纸，外面各罩一团朝着镜头的柔光（中间亮、边上淡），看上去才是灯
  const soft = document.createElement('canvas'), pen = soft.getContext('2d');
  soft.width = soft.height = 64;
  const fade = pen.createRadialGradient(32, 32, 0, 32, 32, 32);
  [[0, 1], [.22, .5], [.55, .14], [1, 0]].forEach(([at, a]) => fade.addColorStop(at, `rgba(255, 255, 255, ${a})`));
  pen.fillStyle = fade; pen.fillRect(0, 0, 64, 64);
  const halos = new THREE.InstancedMesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(soft), fog: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), CROWD.length + 1);
  halos.frustumCulled = false; halos.renderOrder = 21; props.add(halos);
  const facing = new THREE.Quaternion(), FLAT = new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), -Math.PI / 2), GOLD = new THREE.Color(1, .8, .45);
  function drawHalos(t, cam) {
    const flash = kick(t), shown = prog(t, ...INK);
    facing.setFromRotationMatrix(m4.lookAt(at3.fromArray(cam.p), v3.fromArray(cam.q), UPWARD));
    CROWD.forEach((c, i) => {
      halos.setMatrixAt(i, m4.compose(at3.fromArray(lanternAt(c, t)), facing, size3.setScalar(t > c.born ? (.07 + .1 * c.s) * 3.4 * (1 + .35 * flash) : 0)));
      halos.setColorAt(i, tint.copy(c.hue).multiplyScalar(.5));
    });
    halos.setMatrixAt(CROWD.length, m4.compose(at3.set(LAID.at[0], .015, LAID.at[2]), FLAT, size3.setScalar(4.4 * shown * (1 + .25 * flash))));   // 这一团平铺在那张纸的底下，只从纸的四周透出来，不冲淡纸上的墨色
    halos.setColorAt(CROWD.length, tint.copy(GOLD).multiplyScalar(.75));
    halos.instanceMatrix.needsUpdate = halos.instanceColor.needsUpdate = true;
  }

  // ———————————————— 镜头 ————————————————
  // p 镜头位置，q 镜头看向的点，f 对焦距离（离镜头多远的东西最清楚），fov 视角
  const C = (p, q, f, fov = 36) => ({ p, q, f, fov });
  const CAM = [
    [149.8, C([0, 1.7, 6.5], [0, 1.25, .9], 5.6, 30)], [151.4, C([0, 1.65, 6.3], [0, 1.2, .9], 5.4, 30), 'lin'],                   // 正前方的近景（长焦），慢慢推近；那摞纸虚在画面最右边
    [152.45, C([-.45, 1.8, 6.3], [-.45, 1.1, 1], 5.4, 31), 'io'],                                                                  // 纸从它左手边绕出来：镜头跟着往左平移一点，纸不出画
    [153.3, C([0, 2.45, 6.2], [0, .6, 1.3], 5.2, 33), 'io'], [GASP, C([0, 2.55, 6.3], [0, .65, 1.3], 5.2, 33), 'lin'],             // 回到正中、升高一点，跟着它的视线往下摇到手里的纸上：脸在上、纸在下，看得见纸面是白的（右边那摞是写了字的）
    [156.2, C([0, 10, 11], [0, .3, -.3], 14.6), 'out'], [158.9, C([0, 15, 13], [0, 0, -1.5], 20), 'lin'],                          // 沿中轴急速后拉、升高：脚下是整张写满字的纸
    [164.5, C([.6, 1.4, 6.2], [-7, 7.5, -25], 6, 48)], [165.4, C([.4, 1.7, 7], [-5.5, 7, -22], 7, 48), 'lin'],                    // 从主角身后仰看：光从屏风里涌出来
    [167.8, C([0, 3.5, 22], [0, 6, -2], 24, 40), 'io'], [169.4, C([.3, 3.6, 22.6], [0, 6, -2], 24.5, 40), 'lin'],                 // 退成低处的全景：银河在宣纸上空旋转，主角在下面
    [169.4, C([-.5, .8, 6.3], [-.5, 2.75, -2], 5.5, 46)], [WAVE, C([-.5, 1, 7], [-.5, 2.85, -2], 6.2, 46), 'lin'],                 // 正前方的低处仰拍：主角和它头顶的银河（镜头往左让 0.5：它和左手举着的那张纸一起居中，右下角那摞纸少占一点）
    [WAVE, C([0, 2.6, 19.6], [0, 5.6, -2], 21.5, 40)], [RAIN, C([0, 3, 18.6], [0, 5, -2], 20.5, 40), 'lin'],                       // 正面的全景：彩色的波浪从左到右扫过，光开始往下落
    [RAIN, C([-10.2, .6, 7.4], [-3, 1, 2], 3.5, 46)], [174.6, C([-4.4, .95, 5.5], [0, 1.2, .9], 4.5, 46), 'io'],                   // 贴着纸面从小蟹堆里穿过去
    [HUSH, C([-2.5, 6.5, 13.5], [0, 1, -1.5], 15.5, 40), 'io'],                                                                    // 升起来
    [HUSH, C([-.3, 1.6, 6.5], [-.3, 1.35, .9], 5.7, 30)], [176.8, C([-.3, 2.2, 6.3], [-.3, 1.3, 1], 5.5, 30), 'lin'],              // 主角正前方的近景（镜头往左让 0.3，给它左手举着的那张纸留出地方）
    [ABOVE, C([0, 11.5, 3.7], [0, 0, 2.4], 11.4), 'io'],                                                                           // 沿中轴垂直升起，升到它的正上方
    [181.4, C([0, 12.5, 3.7], [0, 0, 2.4], 12.4), 'lin'], [183.2, C([0, 40, 2], [0, 0, -1], 40), 'io'],                            // 看着字显出来，再升高：整张写着这首歌的宣纸
  ];

  return {
    frame(t) {
      kit.act(hero, heroPose);
      CROWD.forEach(c => kit.act(c.crab, u => crowdPose(c, u)));
      drawPile(slips, PAGES); drawHeld(t); drawStars(t); drawRings(t);
      const cam = key(t, CAM), jolt = t > GASP ? Math.exp(-(t - GASP) / .1) : 0;
      drawHalos(t, cam);
      return { cam: { ...cam, p: [cam.p[0] + .05 * jolt * Math.sin(t * 80), cam.p[1] + .04 * jolt * Math.cos(t * 67), cam.p[2]] } };
    },
  };
}
