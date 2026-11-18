// 第三段（39.6 – 62.3 秒）：第一遍副歌在书案上的部分，和之后的间奏。
//   39.6 – 45.9   （外景：「一万个我 下山去 / 一万张纸 回故乡」。不在这里）
//   45.9 – 47.65  「一生只换 一页纸」：正面的中景。光点拖着尾巴成群飞回来，落到那摞纸上，落一点光多一张纸（44 → 90）。
//                 主角的眼睛跟着光转到那摞纸上，高兴得一蹦；这时有一点光没去那摞纸，径直朝它飞来
//   47.65 – 51.28 近景：那点光停在它面前，光里是一只小小的分身的虚影，踩着拍子蹦，朝它挥手。主角吓一跳，认出来，迟疑地抬手也挥了挥——
//                 虚影鞠了一躬，散成一圈光屑，原地只剩一张纸，墨迹从上往下显出来：「月很圆」。纸飘进主角怀里，它抱紧，闭上眼
//   51.28 – 55.5  「哪个是我 问月光」：镜头在它背后低处。它抱着纸转身望向月亮，把纸举起来对着月光看，又慢慢放回怀里，歪一歪头；焦点从它身上移到月亮上
//   55.5 – 62.3   间奏：夜深了。镜头不切，从月亮摇下来；它转回来正对镜头，打个大哈欠，把那张纸举过头顶甩出去，纸在空中抖开成一条宽宽的被子落到背上（quilt.js），
//                 它在那摞纸旁边趴下睡着，被子跟着一起一伏地呼吸。油灯渐渐暗下去，镜头一路沿中轴升高拉远成全景；57 秒起天色渐亮，到 62.3 秒天亮、灯灭
// 机位都朝书案正后方看（背景横平竖直）：主角独占画面时镜头在它的中轴上；它侧身对着那点光里的分身时（两只面对面）镜头不跟着绕过去。
import { D, TAU, lerp, prog, pulse, ease, key, mix, stepAt, rnd, bez } from '../anim.js';
import { pose, MOOD, REST } from '../crab.js';
import { throb, hop } from './beat.js';
import { arc, WARM, windowSpot } from './moves.js';
import { stackSpot, kindOf, drawPile, PILE, KIND } from './slips.js';
import { bodyNow, dims, place, grip, along, blend, HANDS } from './hold.js';
import { buildQuilt, FALLEN } from './quilt.js';

export const span = [39.6, 62.3];
const HOME = [0, .9], S = 1.15, MOONWARD = 164;                       // 主角留守的位置和大小；面朝月亮时的朝向
const BEFORE = 44, AFTER = 90;                                        // 那摞纸原有的张数、光点都落完以后的张数

export function build(kit) {
  const { world, hero, lite, lights, slips } = kit, ghost = lite[0], quilt = buildQuilt(kit.group());

  // ———————————————— 时刻 ————————————————
  const MEET = [-1.55, 1.7, 2.3];                                     // 那点光停在主角面前的位置
  const ARRIVE = 47.65, BOW = 49.05, GONE = 49.46;                    // 光到面前；虚影鞠躬；虚影散尽（纸在这时显形）
  const CATCH = 50.45, UNHUG = 57.35, COVERED = 58.05;                // 纸飘进怀里；从怀里拿出来；举过头顶甩出去（纸在这一刻抖开成被子）

  // ———————————————— 主角 ————————————————
  // 两只手：抱纸、举纸用 hold.js 配好的手势；拉被子时右手捏着纸从右侧举上去、举过头顶甩出去；睡着以后和下一段开头一样垂着
  const WAVE = [58, .34, .25], STRETCH = [78, .42, .1], ASLEEP_ARM = [-60, .2, .05];
  const PULL_R = [[UNHUG, HANDS.hug], [UNHUG + .25, [-10, .36, .1]], [UNHUG + .5, [62, .44, 0]], [COVERED, [96, .5, -.05]], [58.6, ASLEEP_ARM]];   // 右手拉被子
  const PULL_L = [[UNHUG, HANDS.hug], [UNHUG + .3, [-40, .26, .12]], [58.6, ASLEEP_ARM]];
  const bump = (t, a, b) => Math.sin(Math.PI * prog(t, a, b));        // a 到 b 之间鼓起来又落回去
  function heroPose(t) {
    const waving = ease.io(prog(t, 48.5, 48.8)) * (1 - ease.io(prog(t, 49.7, 50.3)));        // 迟疑地抬起左手，也挥了挥；虚影散了，手还举着
    const hug = ease.io(prog(t, CATCH - .35, CATCH)), pulling = t > UNHUG;
    const raise = ease.io(prog(t, 52.4, 52.95)) * (1 - ease.io(prog(t, 53.5, 54.3)));        // 把纸举向月亮
    const moon = ease.io(prog(t, 52.2, 52.9)) * (1 - prog(t, 55.5, 55.6));                   // 仰着脸望月
    const yawn = ease.io(prog(t, 56.25, 56.7)) * (1 - ease.io(prog(t, 57.15, 57.55)));
    const down = ease.io(prog(t, 57.7, 58.6)), asleep = prog(t, 58.6, 59.4), slump = ease.io(prog(t, 58.6, 59.8));   // slump：睡沉了，身子歪向一边（下一段开头就是这个样子）
    const stepping = bump(t, 51.35, 52.35) + bump(t, 55.55, 56.3);                           // 转身时挪着小碎步
    // 左手挥手；然后都抱着纸、举纸；打哈欠时右手伸懒腰；把纸拉过头顶；睡着了垂下来
    const arm = side => (pulling ? key(t, side < 0 ? PULL_L : PULL_R)
      : mix(mix(mix(side < 0 ? mix(REST.aL, [WAVE[0] + 16 * Math.sin(t * 13), WAVE[1], WAVE[2]], waving) : REST.aR, HANDS.hug, hug), HANDS.lift, raise), STRETCH, side > 0 ? yawn : 0));
    return pose({
      x: HOME[0], z: HOME[1], s: S,
      y: .26 * hop(t, 46.44, 46.76) + .12 * hop(t, ARRIVE, ARRIVE + .22),
      sq: throb(t) * (1 - prog(t, 49, 49.5)) + .1 * pulse(t, ARRIVE + .08, .12) - .07 * pulse(t, CATCH + .1, .16) + .05 * raise + .2 * yawn - .08 * pulse(t, 57.6, .14)
        - .3 * down + .03 * Math.sin(t * 2.6) * asleep,                                      // 睡着后的呼吸和下一段开头的一样
      puff: .25 * yawn,
      // 朝向：先看屏风那边，跟着光转向那摞纸，再转向来到面前的那点光；之后一路往左转——转去望月（164 度就是 -196 度），再转回正面（-360 就是 0）
      yaw: key(t, [[45.9, -30], [46.7, 26, 'io'], [47.05, 26], [47.6, -45, 'io'], [51.35, -45], [52.35, MOONWARD - 360, 'io'], [55.55, MOONWARD - 360], [56.3, -360, 'io']]),
      walk: t * 3.6, stride: .11 * stepping,
      pitch: -9 * moon - 11 * yawn + 4 * pulse(t, 50.7, .5) + 5 * down,
      lean: 7 * bump(t, 54.2, 55.5) + 12 * slump,
      look: key(t, [[45.9, [-.5, .6]], [46.7, [.3, -.25], 'io'], [47.05, [.3, -.25]], [47.6, [-.2, .3], 'io'], [49.5, [-.2, .25]], [50.4, [0, -.45], 'io'], [52, [0, -.4]], [52.7, [0, .6], 'io'], [55.5, [0, .5]], [56.2, [0, 0], 'io']]),
      aL: arm(-1), aR: arm(1),
      mood: stepAt(t, [[0, MOOD.open], [ARRIVE - .2, MOOD.wow], [48.2, MOOD.open], [50.8, MOOD.calm], [51.7, MOOD.open], [58.0, MOOD.calm]]),
      mouth: .2 * bump(t, 46.4, 47) + .3 * prog(t, ARRIVE - .2, ARRIVE - .1) * (1 - prog(t, 48.1, 48.4)) + .22 * waving * (1 - prog(t, GONE - .15, GONE + .15)) + .14 * bump(t, GONE, GONE + .7) + yawn,
      pucker: .6 * prog(t, ARRIVE - .2, ARRIVE - .1) * (1 - prog(t, 48.1, 48.4)) + .4 * bump(t, GONE, GONE + .7) + .7 * yawn,   // 打哈欠时嘴张成圆的
      brow: -.5 * prog(t, GONE - .2, GONE + .3) * (1 - prog(t, 51.6, 52.2)),
      blush: 1 + .4 * waving + .3 * hug,
      blink: Math.max(pulse(t, 46.15, .09), pulse(t, 49.0, .09), pulse(t, 55.95, .1), prog(t, 56.35, 56.55) * (1 - .4 * prog(t, 57.4, 57.6))),   // 打哈欠闭着眼，打完半睁着，困了
    });
  }

  // ———————————————— 回来的光点：落到那摞纸上，落一点光多一张纸 ————————————————
  const BACK = Array.from({ length: AFTER - BEFORE }, (_, i) => ({ from: windowSpot(i + 900), launch: 45 + 4.6 * rnd(i * 6.3) ** 1.2, lift: 3 + 4 * rnd(i * 2.7) }))
    .map(s => ({ ...s, land: s.launch + 1.3 })).sort((a, b) => a.land - b.land).map((s, i) => ({ ...s, ...stackSpot(PILE, BEFORE + i), kind: kindOf(BEFORE + i) }));
  function drawBack(t) {
    BACK.forEach(s => {
      if (t < s.launch) return;
      if (t >= s.land) { const fresh = t - s.land; slips.put({ at: s.at, rot: s.rot, size: lerp(.3, 1, ease.back(prog(fresh, 0, .3))), kind: s.kind, glow: .4 * (1 - prog(fresh, 0, .6)) }); return; }
      [0, .07, .14].forEach((lag, n) => {                                                    // 每点光拖两点小的当尾巴
        const { at, k } = arc(s.from, s.at, s.launch, s.land, t - lag, s.lift);
        if (t - lag >= s.launch) lights.put(at, lerp(.24, .14, k) * (1 - .32 * n), WARM);
      });
    });
  }
  // 跟着一起回来的小光点：飞到那摞纸的上空就化掉，凑成一群
  const ESCORTS = Array.from({ length: 90 }, (_, i) => ({ from: windowSpot(i + 1300), launch: 44.8 + 4 * rnd(i * 8.7), lift: 2 + 5 * rnd(i * 3.3), size: .05 + .08 * rnd(i * 5.9),
    to: [PILE[0] + 2.4 * (rnd(i * 4.1) - .5), 1.2 + 2.2 * rnd(i * 6.7), PILE[2] + 2.4 * (rnd(i * 2.9) - .5)] })).map((s, i) => ({ ...s, land: s.launch + 1.2 + .5 * rnd(i * 1.9) }));
  function drawEscorts(t) {
    ESCORTS.forEach(s => {
      if (t < s.launch || t >= s.land) return;
      const { at, k } = arc(s.from, s.to, s.launch, s.land, t, s.lift);
      lights.put(at, s.size * (1 - prog(k, .75, 1)), WARM);
    });
  }

  // ———————————————— 那一点光、光里的分身、它换来的那页纸 ————————————————
  const ENVOY = { from: windowSpot(77), launch: 46.15 }, hover = t => .06 * Math.sin((t - ARRIVE) * 3.1);
  const GHOST_YAW = Math.atan2(HOME[0] - MEET[0], HOME[1] - MEET[2]) / D;                     // 虚影面朝主角
  function ghostPose(t) {
    const here = ease.back(prog(t, ARRIVE - .1, ARRIVE + .25)) * (1 - ease.in(prog(t, BOW + .1, GONE))), bow = ease.io(prog(t, BOW - .25, BOW + .1));
    return pose({
      x: MEET[0], z: MEET[2], y: MEET[1] - .2 + hover(t) + .1 * hop(t, 48.26, 48.5) + .1 * hop(t, 48.86, 49.1), s: .21 * here, yaw: GHOST_YAW, ghost: 1,
      aR: mix([62 + 26 * Math.sin((t - ARRIVE) * 15), .34, .15], REST.aR, bow), aL: REST.aL, pitch: 28 * bow, sq: .1 * pulse(t, 48.3, .1) + .1 * pulse(t, 48.9, .1),
      mood: MOOD.joy, mouth: .5 * (1 - bow),
    });
  }
  function drawEnvoy(t) {
    if (t < ENVOY.launch || t > GONE + .8) return;
    if (t < ARRIVE) { const { at, k } = arc(ENVOY.from, MEET, ENVOY.launch, ARRIVE, t, 4); lights.put(at, lerp(.22, .16, k), WARM); return; }
    const fade = 1 - prog(t, BOW + .1, GONE), burst = prog(t, BOW + .15, GONE + .7);
    if (fade > 0) {
      lights.put([MEET[0] - .03, MEET[1] + .02 + hover(t), MEET[2] - .45], .36 * fade * (1 + .06 * Math.sin(t * 9)), WARM);          // 虚影背后的一团光，衬出它的轮廓
      for (let i = 0; i < 5; i++) { const a = t * 2.4 + i * TAU / 5; lights.put([MEET[0] + .42 * Math.cos(a), MEET[1] + hover(t) + .16 * Math.sin(a * 1.7 + i), MEET[2] + .42 * Math.sin(a)], .028 * fade, WARM); }
    }
    if (burst > 0 && burst < 1) for (let i = 0; i < 18; i++) {                                                                       // 散成一圈光屑，往上飘
      const a = i * TAU / 18 + rnd(i * 3.1), r = (.15 + .9 * ease.out(burst)) * (.6 + .4 * rnd(i * 5.7));
      lights.put([MEET[0] + r * Math.cos(a), MEET[1] + r * Math.sin(a) + .5 * burst * burst, MEET[2] + .3 * (rnd(i * 7.9) - .5)], .05 * (1 - burst), WARM);
    }
  }
  // 那页纸在哪：显形 → 飘进怀里 → 举向月亮 → 放回怀里 → 举过头顶甩出去，在空中抖开成被子（quilt.js）。拿在身上时都按主角此刻的身体算（hold.js）
  // 举纸走右侧：先滑到身体右侧、竖着贴住，再沿右侧举高——不从脸前过，也不穿过头顶的簪和花
  const tossed = b => { const { crown } = dims(b); return place(b, { at: [.35, crown + .8, -.25], rot: [-82, 0, 0] }); };   // 甩出去的那一刻纸在哪：头顶上方（让开毫毛和头饰），差不多平着、字朝上
  function drawPage(t) {
    if (t < GONE - .26) return;
    const from = t >= COVERED && t < COVERED + FALLEN ? tossed(bodyNow(hero, heroPose, COVERED)).at : null;   // 被子从哪里抖开（先量，再按此刻的姿势摆好主角）
    const b = bodyNow(hero, heroPose, t);
    if (t < COVERED) quilt.hide();
    else if (from) quilt.fall(b, t, from, COVERED);
    else quilt.cover(b);                                                                     // 睡着：和下一段开头同一个样子
    if (t >= COVERED + .14) return;
    const size = lerp(.08, 1, ease.io(prog(t, GONE - .26, GONE + .26))) * (1 - ease.in(prog(t, COVERED, COVERED + .14)));   // 从虚影散开的那团光里慢慢长出来；甩出去以后纸缩没了，被子从同一处展开
    const hug = grip.hug(b, size), side = grip.hug(b, size, 65), { H } = dims(b);
    const held = along(t, [[52.4, hug], [52.95, grip.lift(b, size)], [53.5, grip.lift(b, size)], [54.3, hug],                      // 举向月亮，再放回怀里
      [UNHUG, hug], [UNHUG + .25, side], [UNHUG + .5, grip.around(b, 65, .8 * H)]], b, .5);   // 滑到右前侧 → 沿右侧举高
    // 然后举到头顶上方：先往上、再往里，举到比头饰高了才挪到头顶，不从头上蹭过去
    const up = ease.io(prog(t, UNHUG + .5, COVERED)), onHero = up > 0 ? blend(place(b, held), tossed(b), ease.io(prog(up, .3, 1))) : place(b, held);
    onHero.at[1] += .7 * Math.sin(Math.PI * up);
    const drift = ease.io(prog(t, GONE + .15, CATCH)), flutter = Math.sin(Math.PI * drift);
    const born = { at: [MEET[0] - .25, MEET[1] - .05, MEET[2] + .3], rot: [-12, -30, 5] };          // 在虚影身前一点显形，不和它叠在一起；斜着一点，看得出是一张有厚薄的纸
    const spot = { at: bez(born.at, [MEET[0] - .25, .7, MEET[2] + .3], onHero.at, drift), rot: blend(born, onHero, drift).rot };   // 先贴着画面左边往下飘，再滑进怀里，不从它脸前过
    spot.at[0] += .15 * Math.sin(drift * 7) * flutter; spot.rot[2] += 14 * Math.sin(drift * 7 + 1) * flutter;
    const raise = ease.io(prog(t, 52.4, 52.95)) * (1 - ease.io(prog(t, 53.5, 54.3)));
    slips.put({ ...spot, kind: KIND.moon, size, ink: prog(t, GONE, GONE + .75), glow: .5 * (1 - prog(t, GONE, GONE + 1)) + .1 * raise, curl: .1 * flutter + .12 * (1 - drift) });
  }

  // ———————————————— 镜头 ————————————————
  const CAM = [
    [45.9, { p: [1, 2.2, 12.4], q: [1, 2.6, -3], f: 11.6 }], [47.65, { p: [.7, 2.1, 11.2], q: [.7, 1.7, .5], f: 10.4 }, 'io'],              // 中景，朝书案正后方看：它在左，那摞纸在右，光点从右上的月洞窗飞回来（比下一个近景远一倍，两个都是正面，切过去不跳）
    [47.65, { p: [-.9, 1.75, 6.5], q: [-.9, 1.4, 1.6], f: 4.6 }], [49.4, { p: [-.9, 1.7, 6], q: [-.9, 1.4, 1.6], f: 4.1 }, 'lin'],          // 近景：光里的那只分身在左，它侧过身对着它（两只面对面，所以它不是正脸）；镜头仍朝正后方看
    [51.28, { p: [-.5, 1.6, 5.8], q: [-.5, 1.2, 1.5], f: 4.5 }, 'io'],                                                                      // 纸飘进怀里
    [51.28, { p: [-1.9, 1.3, 7.9], q: [.9, 2.5, -6], f: 7.4 }], [55.5, { p: [-1.2, 1.9, 7], q: [1.4, 2.9, -6], f: 7 }, 'lin'],              // 从背后越过它看月亮
    [56.3, { p: [0, 2.6, 6.2], q: [0, 1.15, 1.2], f: 5.2 }, 'io'], [57.6, { p: [0, 4, 8], q: [0, 1.05, 1.2], f: 7.4 }, 'io'],               // 不切：它转回来的时候，镜头从月亮摇下来落到它脸上、摆到它的正前方（高过怀里那张纸的上沿，看得见打哈欠张着的嘴），再一路拉开、升高
    [62.3, { p: [0, 11.5, 16], q: [0, .6, -1.4], f: 20 }, 'io'],                                                                            // 接着沿中轴升高拉远成全景（往下看，看得见盖在背上、拖到地上的被子；宣纸在画面里是正的）
  ];
  const MOON_FOCUS = [53.3, 55.1];                                    // 这段时间焦点从它身上移到月亮上（按对焦距离的倒数过渡，虚实变得匀）

  return {
    frame(t) {
      kit.act(hero, heroPose);
      if (t > ARRIVE - .2 && t < GONE) kit.act(ghost, ghostPose);
      drawPile(slips, BEFORE);
      drawBack(t); drawEscorts(t); drawEnvoy(t); drawPage(t);
      const cam = key(t, CAM), far = ease.io(prog(t, ...MOON_FOCUS)) * (1 - ease.io(prog(t, 55.5, 56.1)));   // 望月时焦点留在月亮上；镜头摇下来的时候焦点跟着回到它身上
      return { cam: { ...cam, f: 1 / lerp(1 / cam.f, 1 / 75, far) }, dawn: prog(t, 57, 62.3), lamp: key(t, [[55.5, 1], [60, .3, 'lin'], [62.3, 0, 'lin']]) };
    },
  };
}
