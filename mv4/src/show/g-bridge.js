// 第七段（130.4 – 149.8 秒）：桥段，全在油灯脚下的案面上。全曲最安静的一段，动作都小，只有点灯那一下是亮的。
//   130.4 – 135.6 「旧柴烧尽 化成灰」：火苗的特写，越烧越小，灰和暗红的火星往上飘；镜头退下来，越过主角的背影看那盏高高的灯。
//                 火只剩一豆，屋里只剩月光。主角回过头来（八字眉、吃惊的眼神），镜头落到它的正前方；最后一粒火星飘下来，它踮脚接住，捧在胸前
//   135.6 – 140.4 「新柴接过 这团火」：分身一只踩一只叠成一座摇摇晃晃的塔，主角举着火种最后跳上塔顶；整座塔朝灯歪过去，
//                 它伸长了手把灯芯点着（138.46，「火」字上），火光蹿起来把整座塔照暖，塔往回一弹，大家踩着拍子欢呼
//   140.4 – 145   「名字没换 柴已换」：灯左边的案面上站着一排。从主角头上的簪开始，火种一只递给下一只（每拍递一次）；
//                 递出去的那只慢慢变成月光色的虚影，散成几点光飘走。最后接住的是另一只戴着同样的簪的小蟹，镜头一直推到它的簪的特写
//   145 – 149.8   「这团火 是不是我」：它正前方的近景。它捧着火种，低头看火，抬头看灯，最后看向镜头，头微微一歪。镜头极慢地推近
// 拍单独一只的近景（接火星、最后这一问）镜头都在它正前方、朝书案正后方看，它面朝镜头，背景的屏风和笔筒是正的。
import * as THREE from 'three';
import { D, TAU, clamp, lerp, prog, pulse, rnd, ease, key, mix, bez } from '../anim.js';
import { pose, MOOD } from '../crab.js';
import { BH, LEG } from '../crab/pose.js';
import { PROPS } from '../world/layout.js';
import { bounce, UP, BEAT, BEAT_AT } from './beat.js';
import { drawPile } from './slips.js';

export const span = [130.4, 149.8];
const CUTS = [130.4, 135.6, 140.4, 145];                               // 四个镜头各自开始的时刻
const [LX, LZ] = PROPS.lamp.c;
const GONE = pose({ s: 0 }), HOLD = [200, .28, .6], DOWN = [-30, .24, .1];   // 不在场；两手往前、往中间捧着；两手垂着
const EMBER = new THREE.Color(2.6, 1.45, .42), EMBER_TIP = new THREE.Color(1.8, .6, .1), MOONLIT = new THREE.Color(.6, .85, 1.9);
// 油灯的火势：一路烧下去，中间回光返照两次，只剩一豆；138.46 被重新点着，蹿高，再落回平常
const LIT = 138.46;
const LAMP = [[130.4, 1], [131, 1], [132, .6], [132.3, .7], [133.1, .36], [133.35, .45], [133.9, .2], [134.25, .1], [LIT, .1], [LIT + .14, 1.35, 'out'], [139.6, 1]];

export function build(kit) {
  const { hero, twin, full, lite, lights } = kit, { wick } = kit.world, props = kit.group();
  const FLOOR = kit.groundAt(LX - 3, LZ + 2);                          // 这一段都在灯周围的案面上（宣纸外面），同一个高度
  const front = (p, far = 1, up = .62) => { const a = p.yaw * D; return [p.x + Math.sin(a) * far * p.s, p.y + up * p.s, p.z + Math.cos(a) * far * p.s]; };   // 捧在身前的东西在哪

  // ———————————————— 道具：火种、灰、火星 ————————————————
  // 火种：一小团暖光，带一盏小灯照亮捧着它的那张脸。小灯在 3.4 以内亮度不随远近变（贴着脸也不会过曝），再远就没有了
  const glow = new THREE.PointLight('#FFAA55', 0, 3.4, 0);
  props.add(glow);
  function ember(at, t, k = 1) {
    const f = 1 + .12 * Math.sin(t * 29) * Math.sin(t * 13.7 + 1);
    lights.put(at, .085 * k * f, EMBER);
    lights.put([at[0] + .02 * Math.sin(t * 8.3), at[1] + .1 * k * f, at[2]], .05 * k * f, EMBER_TIP);
    glow.position.set(at[0], at[1] + .1, at[2]); glow.intensity = .7 * k * f;
  }
  // 灰：从灯芯上飘起来的深色碎片，打着转往上散开
  const ASH = Array.from({ length: 44 }, (_, i) => ({ born: 130.9 + 3.5 * rnd(i * 3.3) ** .8, life: 2 + 1.6 * rnd(i * 5.7), dir: TAU * rnd(i * 7.1), spread: .25 + .6 * rnd(i * 2.9),
    rise: .8 + .7 * rnd(i * 4.3), spin: 3 + 5 * rnd(i * 6.5), size: .6 + .8 * rnd(i * 8.9) }));
  const ash = new THREE.InstancedMesh(new THREE.PlaneGeometry(.1, .07), new THREE.MeshBasicMaterial({ color: '#3A3640', side: THREE.DoubleSide }), ASH.length);
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), eu = new THREE.Euler(), at3 = new THREE.Vector3(), size3 = new THREE.Vector3(), tint = new THREE.Color();
  ash.frustumCulled = false; props.add(ash);
  function drawAsh(t) {
    ASH.forEach((a, i) => {
      const age = Math.max(0, t - a.born), k = age / a.life, live = k > 0 && k < 1 ? Math.min(1, age / .15) * (1 - k ** 3) : 0;
      const r = a.spread * (1 - Math.exp(-age * .9)), ang = a.dir + .8 * Math.sin(age * 1.7 + i);
      at3.set(wick.x + r * Math.cos(ang), wick.y + .3 + a.rise * age - .1 * age * age, wick.z + r * Math.sin(ang));
      ash.setMatrixAt(i, m4.compose(at3, q4.setFromEuler(eu.set(a.spin * age, i, a.spin * .6 * age)), size3.setScalar(a.size * live)));
    });
    ash.instanceMatrix.needsUpdate = true;
  }
  // 火星：火苗每挣扎一次就迸出一小撮暗红的火星（heat 1）；重新点着那一下迸出一圈亮的（heat 1.7）
  const spray = (n, when, heat, speed) => Array.from({ length: n }, (_, i) => ({ born: when(i), heat, life: .8 + 1.1 * rnd(i * 2.3 + heat), dir: TAU * rnd(i * 6.1 + heat),
    out: speed * (.3 + .9 * rnd(i * 3.9 + heat)), rise: speed * (1 + 1.1 * rnd(i * 8.7 + heat)), sway: 9 * rnd(i * 5.5) }));
  const SPARKS = [...spray(36, i => [131.4, 132.2, 133.25, 133.85, 134.2][i % 5] + .5 * rnd(i * 4.1), 1, 1.1), ...spray(22, i => LIT + .12 * rnd(i * 7.7), 1.7, 2.4)];
  function drawSparks(t) {
    SPARKS.forEach(s => {
      const age = t - s.born, k = age / s.life;
      if (k <= 0 || k >= 1) return;
      const r = s.out * (1 - Math.exp(-age * 1.6)) + .06 * Math.sin(age * 7 + s.sway);
      lights.put([wick.x + r * Math.cos(s.dir), wick.y + .25 + s.rise * age - .45 * age * age, wick.z + r * Math.sin(s.dir)], .04 * (1 - .6 * k),
        tint.setRGB(s.heat * (1.7 * (1 - k) + .25), s.heat * (.5 * (1 - k) ** 2 + .03), .08 * (1 - k)));
    });
  }

  // ———————————————— 一、主角在灯下看着火熄下去，接住最后一粒火星 ————————————————
  const WATCH = { x: LX - 1.6, z: LZ + 4.4, y: FLOOR, s: 1.15 }, FALL = [134.3, 135.12];   // 主角站的地方；最后一粒火星从灯芯飘到它手里的起止时刻
  const wp = (...parts) => pose(WATCH, { mood: MOOD.wow, brow: -1 }, ...parts), half = [30, .28, .2], reach = [72, .3, .35];
  const WATCH_KEYS = [
    [130.4, wp({ yaw: 162, pitch: -14, sq: .08, aL: half, aR: half, look: [0, .8] })], [133.75, wp({ yaw: 162, pitch: -14, sq: .08, aL: half, aR: half, look: [0, .8] })],   // 踮着脚仰头看灯
    [134.15, wp({ yaw: 162, pitch: -5, sq: -.1, look: [0, .5] })], [134.3, wp({ yaw: 162, pitch: -5, sq: -.1, look: [0, .5] })],                                           // 火只剩一豆：泄了气
    [134.78, wp({ mouth: .1, pucker: .7 })],                                                                                                                                // 回过头来，面朝正前方的镜头
    [134.98, wp({ pitch: -10, sq: .13, aL: reach, aR: reach, look: [0, .9], mouth: .25, pucker: .5 })], [FALL[1], wp({ pitch: -10, sq: .13, aL: reach, aR: reach, look: [0, .9], mouth: .25, pucker: .5 })],   // 看见飘下来的火星，踮脚去接
    [135.42, wp({ pitch: 5, sq: -.05, aL: HOLD, aR: HOLD, look: [0, -.3], mouth: .3, brow: 0 })],                                                                           // 接住了，捧到胸前，松了口气
    [135.6, wp({ pitch: 0, aL: HOLD, aR: HOLD, look: [.1, .6], brow: .6 })],                                                                                                // 抬眼看灯：有主意了
  ];
  function watcher(t) {
    const p = pose(key(t, WATCH_KEYS)), fret = 1 - prog(t, 133.75, 134.15);
    p.mood = t < FALL[1] + .06 ? MOOD.wow : t < 135.32 ? MOOD.joy : MOOD.open;
    p.lean += 2.6 * Math.sin(t * 4.7) * fret; p.sq += .02 * Math.sin(t * 2.6) + .03 * Math.abs(Math.sin(t * 4.7)) * fret - .14 * pulse(t, FALL[1] + .08, .12);   // 着急地左右挪；接住时一沉
    p.blink = Math.max(pulse(t, 132.9, .1), pulse(t, 134.55, .12));
    return p;
  }
  function firstShot(t, act) {
    act(hero, watcher);
    drawSparks(t);
    if (t < FALL[0]) return;
    const k = prog(t, ...FALL), p = watcher(t), caught = front(p, .5, 1.95), held = front(p), settle = ease.io(prog(t, FALL[1], 135.42));
    const drift = [wick.x + .3 * Math.sin(k * 8) * (1 - k), wick.y + .1, wick.z + .2 * Math.sin(k * 5 + 1) * (1 - k)];   // 像羽毛一样晃着飘下来
    ember(k < 1 ? mix(drift, caught, ease.io(k)) : mix(caught, held, settle), t, .75 + .25 * settle);
  }

  // ———————————————— 二、叠罗汉点灯 ————————————————
  // 塔在灯的左前方（小蟹的脸背着火，只被火光勾出一道亮边，不会被近处的灯照得发白），从下到上四只分身加主角；
  // 最底下两只开场就站好了，后面三只依次从地上跳上去。TOWER：塔脚的位置；AIM：从塔指向灯的方向（单位向量 [x, z]）
  // SIZE：从下到上各只的大小。每只都坐在下一只的头饰上面，塔比只算身体时高一截，所以下面四只做得小一点，塔顶的主角仍然够得着灯芯
  const TOWER = [LX - 2.3, LZ + 2], AIM = [.754, -.656], WHO = [full[1], full[3], full[5], full[4], hero], SIZE = [1.04, .92, .82, .74, .95], TOP = SIZE.length - 1;
  const CROWN = .45, SEAT = .2;                                       // 头顶毫毛和头饰占多高（身体的尺寸，同 body.js）；上一只的身体底面离下一只的头饰再留多少缝（落上来、被压时身体会弹，弹高的那一下也要让得开）
  const LAND = [130, 130, 135.85, 136.45, 137.05], AIR = [.5, .5, .5, .5, .6], FACING = [8, -6, 10, -5, 4];      // 各自落到塔上的时刻（都在拍点上）、跳在空中多久、朝向
  const QUEUE = [TOWER, TOWER, [LX - 5.4, LZ + 3.2], [LX - 5.9, LZ + 1.6], [LX - 6.2, LZ + 3.4]], RUN_FROM = [LX - 9.5, LZ + 4.2];   // 起跳前在地上等的地方；主角从哪里跑过来
  const lean = t => key(t, [[137.1, 0], [137.55, -3.5], [138.35, 11], [LIT + .05, 12], [138.85, -6], [139.35, 2.5], [140.4, 0]]);   // 整座塔朝灯歪过去多少度（塔顶）：先往后让一下，够到，点着后弹回来
  const wobble = t => 1.2 + LAND.reduce((a, at) => a + (t > at ? 5 * Math.exp(-(t - at) / .45) : 0), 0);                             // 晃的幅度：每落上来一只就晃得厉害一阵
  const STRAIN = [{ mood: MOOD.ouch, brow: .9 }, { mood: MOOD.open, brow: .6, look: [0, .5] }, { mood: MOOD.wow, brow: -.6, look: [.4, .8], mouth: .2 }, { mood: MOOD.open, look: [.5, .9], mouth: .25 }, {}];
  const CHEER = [{ mood: MOOD.star, mouth: .5, look: [.5, .8] }, { mood: MOOD.joy, mouth: .55 }, { mood: MOOD.star, mouth: .5, look: [.5, .7] }, { mood: MOOD.joy, mouth: .6 }, { mood: MOOD.joy, mouth: .65 }];
  // 塔上每一层此刻的落脚点、歪多少、压扁多少、朝哪（不管这一层的小蟹到了没有）。上面每多一只，下面的就再扁一点；整座塔像一根芦苇，越往上歪得越多。
  // 上一只「坐」在下一只的头顶上：它的身体底面落在下一只此刻（压扁后）的头顶、再让开头顶的毫毛和头饰（CROWN）的地方，腿垂在头饰两边
  function tower(t) {
    const amp = wobble(t), tip = lean(t), party = prog(t, LIT + .3, LIT + .6);
    const levels = SIZE.map((s, k) => {
      const load = LAND.reduce((a, at, j) => a + (j > k ? prog(t, at, at + .12) : 0), 0), hit = LAND.reduce((a, at, j) => a + (j > k ? pulse(t, at + .12, .25) : 0), 0), w = (k + 1) / SIZE.length;
      return { lean: (tip * AIM[0] + amp * Math.sin(7 * t - .55 * k)) * w, pitch: (tip * AIM[1] + .5 * amp * Math.sin(5.3 * t + 1 - .4 * k)) * w, yaw: FACING[k] + 5 * Math.sin(t * 1.9 + k),
        sq: -.05 - .035 * load - .1 * hit + .05 * party * Math.sin(TAU * (t - BEAT_AT) / BEAT - .6 * k) - .26 * pulse(t - LAND[k], .06, .12) };   // 最后一项：自己刚落上来时一沉
    });
    const legs = k => SIZE[k] * LEG * clamp(1 + 1.2 * levels[k].sq, .35, 1);                    // 脚底到身体底面有多高（同 crab.js）
    let x = TOWER[0], y = FLOOR, z = TOWER[1];
    return levels.map((level, k) => {
      Object.assign(level, { x, y, z });
      if (k === TOP) return level;
      // 从这一只的身体底面，沿着它歪、俯以后的竖轴走过身体和头饰，到上一只的身体底面；再往下垂上一只的腿，就是上一只的脚底
      const reach = SIZE[k] * (BH * (1 + level.sq) + CROWN) + SEAT, l = level.lean * D, p = level.pitch * D, a = level.yaw * D;
      const side = reach * Math.sin(l), front = reach * Math.cos(l) * Math.sin(p);                // 在这一只自己的朝向里：往右、往前偏多少
      x += side * Math.cos(a) + front * Math.sin(a); z += front * Math.cos(a) - side * Math.sin(a);
      y += legs(k) + reach * Math.cos(l) * Math.cos(p) - legs(k + 1);
      return level;
    });
  }
  const balance = (t, k) => [8 + 26 * Math.max(0, Math.sin(7 * t - .55 * k)), .27, .1];              // 晃的时候伸手找平衡
  function stacker(k, t) {
    const at = tower(t)[k], s = SIZE[k], u = t - LAND[k], lit = t > LIT + .1, up = lit && bounce(t) > .4, top = k === TOP;
    if (u < 0) {                                                       // 还没上塔：在地上等着，然后一蹲、跳起来
      const run = top ? prog(t, 135.6, 136.3) : 1, from = top ? mix(RUN_FROM, QUEUE[k], ease.io(run)) : QUEUE[k], k1 = prog(t, LAND[k] - AIR[k], LAND[k]), high = at.y - FLOOR;
      return pose(top || k1 > 0 ? UP : {}, { s, x: lerp(from[0], at.x, k1 ** 1.5), z: lerp(from[1], at.z, k1 ** 1.5), yaw: lerp(top ? 80 - 40 * run : 55, FACING[k], k1),
        y: FLOOR + high * k1 + (high * .25 + .9) * 4 * k1 * (1 - k1) + .4 * Math.abs(Math.sin(TAU * run)) * (1 - run), look: [.3, .8],
        sq: -.24 * pulse(t, LAND[k] - AIR[k] - .04, .16) + .2 * Math.sin(Math.PI * k1) + .03 * Math.sin(t * 9 + k), mouth: .4 * k1, brow: .5 });
    }
    const p = pose(lit ? CHEER[k] : STRAIN[k], up ? UP : { aL: balance(t + .45, k), aR: balance(t, k) },
      { s, x: at.x, y: at.y, z: at.z, lean: at.lean, pitch: at.pitch, sq: at.sq, yaw: at.yaw, blink: pulse(t, 137.4 + .23 * k, .09) });
    if (!top) return p;
    // 塔顶的主角：站稳，往下看一眼（好高），然后盯着灯芯，伸长了身子和手去够；点着以后举着火种在塔顶上蹦
    const out = ease.io(prog(t, 137.55, 138.3)) * (1 - ease.io(prog(t, 138.6, 139.1))), dizzy = pulse(t, 137.33, .2);
    return pose(p, lit ? {} : { mood: dizzy > .3 ? MOOD.wow : MOOD.open, brow: lerp(-.8 * dizzy, .9, out), look: mix(mix([0, .2], [0, -.9], dizzy), [.9, -.25], out), mouth: .3 * dizzy + .2 * out,
      aL: mix(UP.aL, [66, .3, 0], out), aR: mix(UP.aR, [6, .42, -.25], out) },
    { lean: p.lean + 7 * out * AIM[0], pitch: p.pitch + 7 * out * AIM[1], sq: p.sq + .16 * out, y: p.y + .32 * bounce(t) * prog(t, LIT + .35, LIT + .5) });
  }
  // 主角举着的火种：平时举过头顶，够灯芯时递到伸出去的那只手上
  function torch(t) {
    const p = stacker(TOP, t), out = ease.io(prog(t, 137.55, 138.3)) * (1 - ease.io(prog(t, 138.6, 139.1))), ax = p.lean * D, az = p.pitch * D, tilt = Math.hypot(ax, az);
    const side = 1.5 * out, high = lerp(2.2, .45, out);
    return [p.x + p.s * (side * AIM[0] + high * Math.sin(ax)), p.y + p.s * (high * Math.cos(tilt) - side * Math.sin(tilt)), p.z + p.s * (side * AIM[1] + high * Math.sin(az) + .3 * (1 - out))];
  }
  // 塔下看热闹的几只小不点：先仰着头替上面捏把汗，灯亮了就踩着拍子蹦
  // 各自脚下的高度按那一点的案面量（灯座边上的案面不是一样高）；最左那只让开主角跑过来的路
  const FANS = [[LX - 7.7, LZ + 2.1, .56], [LX - 6.9, LZ + 5.2, .5], [LX + .2, LZ + 4.8, .58], [LX + 1.1, LZ + 3.9, .5]].map(([x, z, s], i) => ({ crab: lite[i], x, z, s, yaw: x < TOWER[0] ? 50 : -38, ground: kit.groundAt(x, z) }));
  const fan = ({ ground, ...f }, i, t) => (t > LIT + .15
    ? pose(bounce(t) > .4 ? UP : {}, { ...f, y: ground + .5 * f.s * bounce(t + .05 * i) + .3, mood: MOOD.joy, mouth: .6, look: [0, .7] })
    : pose({ ...f, y: ground, pitch: -12, look: [0, .9], mood: MOOD.wow, brow: -.7, mouth: .2, sq: .04 * Math.sin(t * 3.1 + i * 2), lean: 3 * Math.sin(t * 2.3 + i) }));
  function secondShot(t, act) {
    WHO.forEach((crab, k) => act(crab, u => stacker(k, u)));
    FANS.forEach((f, i) => act(f.crab, u => fan(f, i, u)));
    drawSparks(t);
    const at = torch(t);
    ember(at, t, 1 + .5 * pulse(t, LIT, .25));
    const k = prog(t, LIT - .16, LIT);                                 // 一点火从手上跳到灯芯上
    if (k > 0 && k < 1) lights.put(bez(at, [(at[0] + wick.x) / 2, at[1] + .35, (at[2] + wick.z) / 2], [wick.x, wick.y + .15, wick.z], k), .07, EMBER);
  }

  // ———————————————— 三、一只递给下一只 ————————————————
  // 灯左边的案面上从左到右站着一排：主角、三只分身、另一只戴簪的。火种从左往右递，最后停在离灯最近的那一只手里
  const ROW = [hero, full[0], full[2], full[5], twin], ROW_SIZE = [1, .92, .97, .9, 1], LAST = ROW.length - 1, PASS = [141.28, 141.89, 142.49, 143.1], FLY = .3;   // PASS：每次递出去的时刻（拍点）
  const spot = k => [LX - 12.4 + 2.5 * k, LZ + 2.8 + .4 * Math.sin(Math.PI * k / LAST)];
  const gotAt = k => (k ? PASS[k - 1] + FLY : 0), gaveAt = k => (k < LAST ? PASS[k] : 1e9);
  function bearer(k, t) {
    const [x, z] = spot(k), s = ROW_SIZE[k], got = gotAt(k), v = t - gaveAt(k), has = t >= got && v < 0;
    const ready = k ? ease.io(prog(t, got - .45, got - .1)) : 1, turn = ease.io(prog(t, k ? got + .08 : 140.85, gaveAt(k) - .1));
    const fade = ease.io(prog(v, .3, 1)), gone = ease.in(prog(v, 1, 1.4)), reach = t < got ? ready : 1 - prog(v, .2, .5);    // 变成虚影几成；散掉几成；两手往前伸几成
    const yaw = v > 0 ? lerp(38, 10, ease.io(prog(v, .3, .9))) : t < got ? -36 * ready : k === LAST ? lerp(-36, 8, ease.io(prog(t, got + .25, got + .8))) : lerp(k ? -36 : 0, 38, turn);
    const sad = k === LAST ? ease.io(prog(t, 143.95, 144.2)) : 0, after = k === LAST ? ease.io(prog(t, 144.5, 144.85)) : 0;                 // 最后那只：看着左边那只散掉，目送光点飘上去
    return pose({ x, z, y: FLOOR + .3 * fade + .5 * gone, s: s * (1 - gone), yaw, ghost: fade, aL: mix(DOWN, HOLD, reach), aR: mix(DOWN, HOLD, reach),
      sq: -.13 * pulse(t, got + .06, .13) - .1 * pulse(v, -.1, .1) + .1 * pulse(v, .04, .15) + .3 * gone + .015 * Math.sin(t * 2.3 + k), pitch: has ? 6 : 0, lean: 6 * pulse(v, .04, .2),
      look: v > 0 ? [.7, 0] : t < got ? [-.75, -.1] : mix(mix(mix([0, -.6], [.6, -.25], k === LAST ? 0 : turn), [-.9, .1], sad), [-.5, .8], after),
      mood: v > .45 ? MOOD.calm : has && t < got + .3 && k ? MOOD.joy : MOOD.open, mouth: .3 * pulse(t, got + .1, .2) + .15 * after, brow: -.6 * sad,
      blink: Math.max(pulse(t, 140.75, .09), pulse(t, got + .75 + .1 * k, .09)), cat: v > .45 ? .5 : 0 });
  }
  // 火种此刻在哪：在某一只手里，或者正从一只手递到下一只手
  function relay(t) {
    const j = PASS.findLastIndex(at => t >= at);
    if (j < 0 || t >= PASS[j] + FLY) return front(bearer(j + 1, t));
    const a = front(bearer(j, PASS[j])), b = front(bearer(j + 1, PASS[j] + FLY));
    return bez(a, [(a[0] + b[0]) / 2, Math.max(a[1], b[1]) + .45, (a[2] + b[2]) / 2], b, ease.io(prog(t, PASS[j], PASS[j] + FLY)));
  }
  // 递出去的那几只散成的光点：月光色，从身上各处升起来，晃着往上飘
  function drawWisps(t) {
    for (let k = 0; k < LAST; k++) for (let i = 0; i < 9; i++) {
      const n = k * 10 + i, age = t - gaveAt(k) - 1 - .04 * i, life = 1.3 + .9 * rnd(n * 3.1), [x, z] = spot(k);
      if (age <= 0 || age >= life) continue;
      lights.put([x + 1.5 * ROW_SIZE[k] * (rnd(n * 2.7) - .5) + .25 * Math.sin(age * 3 + n), FLOOR + .5 + 1.2 * rnd(n * 5.3) + (.7 + .7 * rnd(n * 1.9)) * age, z + rnd(n * 4.1) - .5],
        .09 * (1 - age / life) ** .7 * Math.min(1, age / .12), MOONLIT);
    }
  }
  function thirdShot(t, act) {
    ROW.forEach((crab, k) => act(crab, u => bearer(k, u)));
    drawWisps(t);
    ember(relay(t), t);
  }

  // ———————————————— 四、「这团火 是不是我」 ————————————————
  const [AX, AZ] = spot(LAST), ap = (...parts) => pose({ x: AX, z: AZ, y: FLOOR, s: 1, aL: HOLD, aR: HOLD }, ...parts);                 // 面朝正前方的镜头
  const ASK_KEYS = [
    [145, ap({ pitch: 8, look: [0, -.75], brow: -.2 })], [146.2, ap({ pitch: 8, look: [0, -.75], brow: -.2 })],                         // 低头看手里的火
    [146.8, ap({ yaw: 10, pitch: -16, sq: .05, look: [.25, 1], brow: -.5 })], [147.45, ap({ yaw: 10, pitch: -16, sq: .05, look: [.25, 1], brow: -.5 })],               // 抬头看灯（灯在它右后方的高处）
    [148.2, ap({ lean: 5, look: [0, 0], brow: -.6 })], [149.8, ap({ lean: 6.5, look: [0, 0], brow: -.6 })],                             // 看向镜头，头微微一歪
  ];
  function asker(t) {
    const p = pose(key(t, ASK_KEYS));
    p.sq += .018 * Math.sin(t * 2.4); p.blink = Math.max(pulse(t, 146.35, .11), pulse(t, 147.8, .11), pulse(t, 149.2, .12));
    return p;
  }
  function fourthShot(t, act) {
    act(twin, asker);
    drawWisps(t);
    const at = front(asker(t));
    ember([at[0], at[1] + .02 * Math.sin(t * 2.4), at[2]], t);
  }

  // ———————————————— 镜头 ————————————————
  const CAM = [
    [130.4, { p: [-12.6, 6.7, -8.9], q: [-13.95, 7.05, -13], f: 4.4, fov: 36 }], [131.8, { p: [-12.45, 6.6, -8.4], q: [-13.95, 6.95, -13], f: 4.9, fov: 36 }, 'lin'],  // 火苗的特写，慢慢退
    [133.7, { p: [-13.6, 3, .5], q: [-14.5, 3.55, -12], f: 14.5, fov: 40 }], [134.25, { p: [-13.65, 2.95, .2], q: [-14.5, 3.5, -12], f: 14, fov: 40 }, 'lin'],         // 退到主角身后，越过它看那盏高高的灯
    [134.9, { p: [WATCH.x, 1.25, WATCH.z + 4.6], q: [WATCH.x, 1.45, WATCH.z], f: 4.5, fov: 40 }], [135.6, { p: [WATCH.x, 1.3, WATCH.z + 4.3], q: [WATCH.x, 1.42, WATCH.z], f: 4.2, fov: 40 }, 'lin'],   // 落到它的正前方，看它的脸（从头顶的簪到捧在胸前的火种都在画里）
    [135.6, { p: [-16.2, 2.4, 3], q: [-15.9, 3.2, -11.5], f: 14.5, fov: 40 }], [137.1, { p: [-16, 3.9, 1.5], q: [-15.7, 4.9, -11.5], f: 13, fov: 40 }],                // 叠罗汉：跟着塔往上升
    [138.3, { p: [-15.6, 5.8, -2.2], q: [-15.1, 6.4, -11.8], f: 9.6, fov: 40 }], [LIT + .1, { p: [-15.6, 5.85, -2.3], q: [-15.1, 6.45, -11.8], f: 9.5, fov: 40 }, 'lin'],   // 推到塔顶和灯芯
    [140.4, { p: [-16.1, 3.4, 2.5], q: [-15.7, 4.3, -11.5], f: 14, fov: 40 }],                                                                                          // 灯亮了，拉开看整座塔
    [140.4, { p: [-25.9, 2, -5.6], q: [-26.3, 1.5, -10.2], f: 4.7, fov: 36 }], [141, { p: [-25.4, 2, -4], q: [-25.6, 1.2, -10.1], f: 6.2, fov: 36 }],                  // 主角头上的簪
    [143.6, { p: [-17.3, 2, -3.7], q: [-17.6, 1.15, -10], f: 6.4, fov: 36 }], [145, { p: [AX, 2.25, AZ + 2.6], q: [AX, 1.8, AZ + .2], f: 2.5, fov: 36 }],             // 跟着火种往右移，最后一直推到另一支簪的特写（比下一个镜头近一倍：两个都在它正前方，景别差开了切过去才不跳）
    [145, { p: [AX, 1.25, AZ + 4.4], q: [AX, 1.05, AZ], f: 4.4, fov: 36 }], [149.8, { p: [AX, 1.2, AZ + 3.3], q: [AX, 1.1, AZ], f: 3.3, fov: 36 }, 'lin'],             // 它正前方的近景，极慢地推近
  ];
  const SHOTS = [firstShot, secondShot, thirdShot, fourthShot];

  return {
    frame(t) {
      // 每个镜头管到下一个切点那一刻为止（含）：CAM 里同一时刻的两个关键帧，前一个也是管到这一刻；演员和镜头一起换，正好落在切点上的那一帧才不会是新演员配旧镜头
      const shot = Math.max(0, CUTS.findLastIndex(c => t > c)), act = (crab, poseAt) => kit.act(crab, u => (u < CUTS[shot] ? GONE : poseAt(u)));   // 换了镜头，上一个镜头里的站位不算数（弹性从头算）
      glow.intensity = 0;
      drawAsh(t);
      SHOTS[shot](t, act);
      drawPile(kit.slips, 140);
      const cam = key(t, CAM), shake = t > LIT ? Math.exp(-(t - LIT) / .1) : 0;
      return { cam: { ...cam, p: [cam.p[0] + .05 * shake * Math.sin(t * 80), cam.p[1] + .04 * shake * Math.cos(t * 67), cam.p[2]] }, lamp: key(t, LAMP) };
    },
  };
}
