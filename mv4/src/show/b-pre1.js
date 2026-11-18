// 第二段（28.6 – 39.6 秒）：「纸上的字 我都看见 / 路上的风 吹不到脸」。主角一张一张地看分身交回来的纸；纸上写着风，它却感觉不到。
//   28.6 – 29.53  正前方的近景（接上一段）：捧着第一张纸，星星眼，凑近了一行一行地看；然后把纸举远一点、身子往后一仰，端详
//   29.53 – 32.55 「纸上的字 我都看见」：从它头顶正上方往下看，看清它手里的纸。春 → 夏 → 秋，两拍一张：
//                 看完的用左手拨到身边（摊成一把扇面），右手从那摞上再拿一张。夏：吓一跳，原地一蹦；秋：美得左右直晃
//   32.55 – 34.4  换到正面：它在画面左边，那摞纸在右边，顶上露出冬的雪山。它拿起来，轻轻「哇」一声，凑近了看；
//                 再一瞥，那摞上的下一张写着「路上有风」，焦点带过去
//   34.4 – 36.3   （外景：一只分身在山路上迎着风跑。不在这里）
//   36.3 – 39.6   「吹不到脸」：切回它的正前方，它怀里那张纸上写着「路上有风」。它踮起脚、仰起脸、闭上眼，等风——
//                 头顶的毫毛一动不动。睁开一只眼瞄了瞄，用小短手戳了两下自己的脸；眉毛耷拉下来，慢慢转头望向屏风
// 机位都在书案的中轴方向上（朝正后方看，背景横平竖直）：主角独占画面时镜头在它正前方；要同时交代那摞纸时镜头平移到两者中间，不斜着拍。
import { TAU, lerp, prog, pulse, ease, key, mix, stepAt } from '../anim.js';
import { pose, MOOD } from '../crab.js';
import { BEAT, throb, hop } from './beat.js';
import { stackSpot, drawPile, PILE, KIND } from './slips.js';
import { bodyNow, place, grip, blend, HANDS } from './hold.js';

export const span = [28.6, 39.6];
const HOME = [0, .9], S = 1.15;                                       // 主角留守的位置和大小
const PILED = 39;                                                     // 一直留在那摞上的张数；再往上的五张是这一段要看的

export function build(kit) {
  const { hero, slips } = kit;

  // ———————————————— 要看的五张纸 ————————————————
  // got：到手的时刻；put：放下的时刻。拿起比到手早 LIFT 秒，放下后 LAY 秒落到身边。前四张都落在拍点上，两拍一张
  const SHEETS = [
    { kind: KIND.spring, got: 26, put: 30.13 }, { kind: KIND.summer, got: 30.73, put: 31.34 }, { kind: KIND.autumn, got: 31.94, put: 32.55 },
    { kind: KIND.winter, got: 33.15, put: 34.9 }, { kind: KIND.wind, got: 35.5, put: 99 },
  ];
  const LIFT = .5, LAY = .45, SWAPS = SHEETS.slice(0, 3).map(s => s.put);
  // 看完的纸摊在它左手边，一张压一张地错开，像一把扇面
  const aside = i => ({ at: [-1.8 - .3 * i, .03 + .022 * i, 1.95 + .3 * i], rot: [-90, 164 + 22 * i, 0] });

  // ———————————————— 主角：看纸（到 34.4 秒） ————————————————
  const HOLD = HANDS.read, REACH = [4, .72, .45], SWEEP = [-18, .56, .5];   // 两手在身前捏着纸的下边；右手伸向那摞纸；左手把看完的拨到身边
  const sweeping = t => SWAPS.reduce((k, at) => k + ease.io(prog(t, at, at + .18)) * (1 - ease.io(prog(t, at + .28, at + .5))), 0);
  const reaching = t => SWAPS.reduce((k, at) => k + ease.io(prog(t, at + .1, at + .32)) * (1 - ease.io(prog(t, at + .4, at + .6))), 0);
  const admire = t => ease.io(prog(t, 28.95, 29.5)) * (1 - ease.io(prog(t, 32.3, 32.85)));   // 把纸举远、身子后仰着端详（头顶那个机位才看得全纸）
  function readPose(t) {
    const left = sweeping(t), right = reaching(t), far = admire(t), sway = t - 31.94, next = ease.io(prog(t, 33.8, 34.15));   // next：瞥见那摞上的下一张
    const caught = SHEETS.reduce((k, s) => k + pulse(t, s.got + .04, .1), 0);                 // 纸到手的那一下，身子一沉
    return pose({
      x: HOME[0], z: HOME[1], s: S,
      y: .3 * hop(t, 30.75, 31.07),
      sq: 1.3 * throb(t) - .07 * caught + .16 * pulse(t, 30.83, .13) - .12 * pulse(t, 31.09, .09),
      lean: -7 * left + 9 * right + 6.5 * Math.sin(TAU * sway / BEAT) * prog(sway, 0, .12) * (1 - prog(sway, .45, .75)) + 5 * next,
      yaw: -8 * left + 16 * right + 13 * next,
      pitch: lerp(9, -6, far) + 3 * pulse(t, 28.92, .16) + 8 * prog(t, 33.2, 33.55) * (1 - next),
      look: mix(mix(mix([.32 * Math.sin((t - 28.6) * 5.2), -.75], [-.6, -.6], left), [.7, -.55], right), [.8, -.5], next),
      aL: mix([HOLD[0], HOLD[1], HOLD[2] + .2 * far], SWEEP, left), aR: mix([HOLD[0], HOLD[1], HOLD[2] + .2 * far], REACH, right),
      mood: stepAt(t, [[0, MOOD.star], [30.76, MOOD.wow], [31.97, MOOD.joy], [32.8, MOOD.open]]),
      mouth: .3 * pulse(t, 29.15, .3) + .4 * prog(t, 30.76, 30.85) * (1 - prog(t, 31.3, 31.5)) + .55 * prog(t, 31.97, 32.05) * (1 - prog(t, 32.6, 32.85)) + .5 * prog(t, 33.2, 33.35) * (1 - .8 * next),
      pucker: .8 * prog(t, 30.76, 30.85) * (1 - prog(t, 31.3, 31.5)) + .5 * prog(t, 33.2, 33.35) * (1 - next),
      laugh: .7 * prog(t, 31.97, 32.05) * (1 - prog(t, 32.6, 32.85)),
      blush: 1 + .5 * prog(t, 31.97, 32.1) * (1 - prog(t, 32.6, 32.9)) + .4 * prog(t, 33.2, 33.5),
      blink: pulse(t, 33.84, .09),
    });
  }

  // ———————————————— 主角：等风（36.3 秒起） ————————————————
  const HUG = HANDS.hug, POKE = [147, .46, .6];                 // 两手把纸按在胸前；右手戳自己的脸
  function windPose(t) {
    const up = ease.io(prog(t, 36.38, 36.9)) * (1 - ease.io(prog(t, 37.8, 38.1)));           // 仰着脸
    const poke = Math.max(pulse(t, 38.22, .13), pulse(t, 38.52, .13)), reach = ease.io(prog(t, 38.0, 38.15)) * (1 - ease.io(prog(t, 38.6, 38.8)));
    const sad = ease.io(prog(t, 38.55, 39)), turn = ease.io(prog(t, 38.8, 39.75));
    return pose({
      x: HOME[0], z: HOME[1], s: S,
      sq: -.08 * pulse(t, 36.4, .1) + .07 * up + .015 * Math.sin((t - 36.3) * 2.2) - .06 * sad,
      puff: -.3 * sad,
      pitch: -13 * up + 5 * sad,
      lean: 3 * poke,
      yaw: -50 * turn,
      look: mix(mix([0, .1], [0, .45], up), [-.9, .25], prog(t, 38.75, 39.1)),                // 眼睛先转过去，身子再跟上
      aL: HUG, aR: mix(HUG, [POKE[0], POKE[1], POKE[2] + .25 * (1 - poke)], reach),
      mood: stepAt(t, [[0, MOOD.open], [36.86, MOOD.calm], [37.82, MOOD.open]]),
      wink: prog(t, 37.82, 37.83) * (1 - prog(t, 38.04, 38.05)),
      brow: -.35 * prog(t, 37.55, 37.8) - .65 * sad,
      pucker: .5 * reach * (1 - sad),
      cat: prog(t, 36.6, 36.9) * (1 - prog(t, 37.4, 37.75)),
      blush: 1 - .5 * sad,
      blink: pulse(t, 38.95, .1),
    });
  }
  const CUT_BACK = 35.3;                                              // 外景中途换成等风的那套动作；切回来时（36.3）它已经站定了
  const heroPose = t => (t < CUT_BACK ? readPose(t) : windPose(t));

  // ———————————————— 纸 ————————————————
  // 手里那张纸的位置和朝向：按它此刻的身体算（hold.js），跟着身体的转、歪、蹦、压扁走。看纸时捧在身前、字朝着它自己（端详时递远一点）；等风时抱在胸前、字朝外
  function inHands(t) {
    const b = bodyNow(hero, heroPose, t);
    return place(b, t < CUT_BACK ? grip.read(b, 1, -76, .5, .25 * admire(t)) : grip.hug(b, 1));
  }
  function drawSheets(t) {
    const hands = inHands(t);
    SHEETS.forEach((s, i) => {
      const up = ease.io(prog(t, s.got - LIFT, s.got)), down = ease.io(prog(t, s.put, s.put + LAY)), held = up * (1 - down);
      const spot = blend(blend(stackSpot(PILE, PILED + SHEETS.length - 1 - i), hands, up), aside(i), down);
      spot.at[1] += .1 * Math.sin(Math.PI * up) + .25 * Math.sin(Math.PI * down);
      spot.at[2] += .35 * (Math.sin(Math.PI * up) + Math.sin(Math.PI * down));            // 拿起、放下的路上往身前绕一点，不擦着身子的棱角过
      slips.put({ ...spot, kind: s.kind, curl: .12 * held, glow: held * (.07 + .02 * Math.sin(t * 6)) + .05 * pulse(t, s.got + .15, .3) });   // 被它看着的那张微微发光，刚到手时亮一下
    });
  }

  // ———————————————— 镜头 ————————————————
  const CAM = [
    [28.6, { p: [0, 1.7, 6.4], q: [0, 1.05, 1.5], f: 5.2 }], [29.53, { p: [0, 2.4, 6.0], q: [0, 1.15, 1.5], f: 4.9 }, 'io'],                 // 正前方的近景：它在看纸。它把纸举远、往后仰时镜头跟着升一点，从纸的上沿看过去，纸不挡嘴
    [29.53, { p: [0, 5.7, 1.0], q: [0, 1, 2.75], f: 4.9 }], [32.55, { p: [0, 5.2, 1.1], q: [0, 1, 2.75], f: 4.4 }, 'lin'],                  // 头顶正上方往下看：看清纸上的画（纸在画面里是正的）
    [32.55, { p: [.9, 2.7, 7], q: [.9, 1.0, 1.7], f: 5.4 }], [33.7, { p: [.9, 2.4, 6.6], q: [.9, 1.1, 1.6], f: 5 }, 'lin'],                 // 正面、略高，朝书案正后方看：它在左，那摞纸在右（镜头只往右平移了不到一个身位，看它仍是正脸）
    [34.4, { p: [1, 2.2, 6.3], q: [1, 1.05, 1.7], f: 4.6 }, 'io'],                                                                          // 焦点带到那摞纸顶上的下一张
    [36.3, { p: [0, 1.4, 6.8], q: [0, .95, 1.2], f: 5.7 }], [38.7, { p: [0, 1.45, 6.1], q: [0, 1, 1.2], f: 5 }, 'lin'],                    // 正前方的近景：等风。纸在字幕上方
    [39.6, { p: [.5, 1.6, 6.2], q: [-.5, 1.15, .9], f: 5.4 }, 'io'],                                                                        // 它转头望向屏风，镜头跟着往那边带一点
  ];

  return {
    frame(t) {
      kit.act(hero, heroPose);
      drawPile(slips, PILED);
      drawSheets(t);
      return { cam: key(t, CAM) };
    },
  };
}
