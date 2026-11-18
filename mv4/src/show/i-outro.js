// 第九段（183.2 – 202.41 秒）：尾声，把满纸的小蟹和它们的光慢慢收回去。
//   183.2 – 190.4 「柴换过了 火还亮」：油灯火苗的特写，稳稳地亮着；镜头拉开到书案全景：纸上的小蟹从外圈到里圈，一只接一只
//                 转身望月、跳进自己头顶那点光里，光缓缓升起，汇成一条彩色的光河穿过月洞窗流向月亮。主角在中间挥手送它们，最后转身望月
//   190.4 – 197   「哪个是我 问月光」：和开头 9.6 秒同一个机位（从背后越过它看月亮），纸上只剩主角。它回头看了我们一眼，转回去，
//                 化成一点光飞向月亮；它站过的地方飘下一张纸，写着「一万个我」。镜头低头看纸，纸旁边「啵」地冒出一只新的小蟹，
//                 它低头看看纸，抬头望向月亮，镜头回到开头的构图
//   197 – 202.41  书房全景，镜头缓缓后退（开场镜头倒着走）。片名淡入；新的小蟹转过身来蹦了两下——和开场一样，又是新的一轮。
//                 200.6 – 202.2 压黑
import * as THREE from 'three';
import { D, lerp, prog, pulse, rnd, ease, key, mix } from '../anim.js';
import { pose, MOOD } from '../crab.js';
import { MOON, STAGE } from '../world/layout.js';
import { bounce, throb, hop, UP } from './beat.js';
import { WARM, TINT } from './moves.js';
import { drawPile, KIND } from './slips.js';

export const span = [183.2, 202.41];
const STAY = [0, .9], MOONWARD = 164, GONE = pose({ s: 0 });           // 主角留守的位置；面朝月亮时的朝向
const HUES = [TINT.春, TINT.夏, TINT.秋, TINT.冬, new THREE.Color(1.5, .8, 2), new THREE.Color(.55, 1.6, 1.8), new THREE.Color(2, 1.5, .45), new THREE.Color(2, .75, .7)];   // 各自的光色：四季，加上紫、青、金、粉
const FLY = 193.35, BORN = 195.05, LOOP = 189.6;                       // 主角化成光的时刻；新的小蟹冒出来的时刻；结尾重演开场动作时，比开场晚多少秒
const NEWCOMER = [STAY[0] - 1.75, STAY[1]], LEAF = [STAY[0] + .1, .03, STAY[1] + .1];   // 新的小蟹站在哪；那张纸最后躺在哪
const cubic = (a, b, c, d, k) => a.map((_, i) => (1 - k) ** 3 * a[i] + 3 * (1 - k) ** 2 * k * b[i] + 3 * (1 - k) * k * k * c[i] + k ** 3 * d[i]);

// 183.2 秒（这一段开始）时纸上的站位：主角在中间，15 只分身围成两圈，40 只人群在外圈和两条镇尺上；每只有自己的光色。
// 返回 [{ x, z, y0 脚底高度, s 大小, yaw 朝向, hue 光色 }]，顺序是 15 只分身、40 只人群。上一段的结尾可以用它对齐站位
export function gathering(perches) {
  const near = (deg, r) => [STAY[0] + r * Math.cos(deg * D), STAY[1] - r * Math.sin(deg * D)], far = (deg, r) => [r * Math.cos(deg * D), STAGE.z - r * Math.sin(deg * D)];
  const full = [...[15, 55, 95, 135, 175, 215].map(d => near(d, 3.3)), ...Array.from({ length: 9 }, (_, i) => near(-20 + 27.5 * i, 5.9))].map(([x, z], i) => ({ x, z, y0: 0, s: .8 + .1 * rnd(i * 3.1) }));
  const lite = Array.from({ length: 40 }, (_, i) => {
    if (i < 8) { const at = perches[i * 3]; return { x: at.x, z: at.z, y0: at.y, s: .42 }; }
    const [x, z] = far(-28 + 236 * (i - 7.5) / 32 + 3 * (rnd(i * 2.3) - .5), (i % 2 ? 9.3 : 7.7) + .3 * (rnd(i * 4.9) - .5));
    return { x, z, y0: 0, s: .42 + .08 * rnd(i * 6.1) };
  });
  return [...full, ...lite].map((c, i) => ({ ...c, yaw: 24 * (rnd(i * 7.3) - .5) - c.x * 2, hue: HUES[i % HUES.length] }));
}

export function build(kit) {
  const { world, hero, twin, full, lite, lights, slips } = kit, props = kit.group();

  // ———————————————— 光：每只小蟹头顶一点，出发后汇成光河流向月亮 ————————————————
  // 一点光：T 时刻从 from 出发，缓缓升起，经过表演区后上方，穿过月洞窗，落到月亮上。hover：出发前是否浮在原地等着；dur：飞多久；rush：越大起步越慢
  const glint = (from, T, hue, n, size, hover, dur = 5.6 + 1.4 * rnd(n * 3.3), rush = 1.8) => ({ from, T, hue, n, size, hover, dur, rush, via: [from[0] * .7 + 1, 6.5 + 2.5 * rnd(n * 5.1), from[2] * .7 - 4],
    gate: [11 + 4 * (rnd(n * 2.7) - .5), 13 + 2.5 * (rnd(n * 6.3) - .5), -36], to: [MOON.x + 3 * (rnd(n * 4.9) - .5), MOON.y + 3 * (rnd(n * 8.1) - .5), MOON.z] });
  function glintAt(e, t) {
    const v = t - e.T, bob = .1 * Math.sin(t * 2.1 + e.n);
    if (v <= 0) return [e.from[0], e.from[1] + bob, e.from[2]];
    const q = prog(v, 0, e.dur) ** e.rush, at = cubic(e.from, e.via, e.gate, e.to, q);               // 起步很慢，越飞越快
    return [at[0] + .4 * Math.sin(v * 2.3 + e.n) * (1 - q), at[1] + bob * (1 - q), at[2]];
  }
  function drawGlint(e, t) {
    const v = t - e.T, k = prog(v, 0, e.dur);
    if (k >= 1 || (v <= 0 && !e.hover)) return;
    const size = e.size * (1 + .7 * pulse(v, .28, .22)) * lerp(1, 3.2, k ** e.rush) * (1 - prog(k, .94, 1));   // 小蟹跳进来时胀一下；飞远了放大一点才看得见；到月亮上就融进去
    lights.put(glintAt(e, t), size, e.hue);
    const tail = prog(v, .5, 1.8);                                                                             // 飞快了才拖出一条小尾巴
    if (tail > 0) for (let j = 1; j <= 3; j++) lights.put(glintAt(e, t - .1 * j), size * (.55 - .13 * j) * tail, e.hue);
  }

  // ———————————————— 满纸的小蟹，一只接一只变成光 ————————————————
  const overhead = c => [c.x, c.y0 + c.s * 2.45, c.z];
  const CROWD = gathering(world.perches).map((c, i) => ({ ...c, crab: i < 15 ? full[i] : lite[i - 15], n: i, far: Math.hypot(c.x - STAY[0], c.z - STAY[1]) + 1.5 * rnd(i * 5.7) }));
  [...CROWD].sort((a, b) => b.far - a.far).forEach((c, rank) => { c.T = lerp(186.6, 190.05, rank / (CROWD.length - 1)); });      // 离主角远的先走
  CROWD.forEach(c => { c.glint = glint(overhead(c), c.T + .25, c.hue, c.n, .13 + .06 * c.s, true); });
  const MINE = glint(overhead({ x: STAY[0], z: STAY[1], y0: 0, s: 1.15 }), FLY + .25, WARM, 77, .3, true, 4.6, 1.25);            // 主角自己的那点光：大一点，走得干脆一点，镜头要目送它
  // 没有小蟹的散光：从纸上各处升起来（只在纸的中后部，离望月的机位远一些），让光河更密
  const STRAY = Array.from({ length: 110 }, (_, i) => glint([9 * (rnd(i * 3.7) - .5) * 2, .4 + rnd(i * 9.1), STAGE.z - 3.5 + 6 * (rnd(i * 5.3) - .5) * 2], 186.5 + 5.7 * rnd(i * 2.9), HUES[i % HUES.length], 100 + i, .05 + .05 * rnd(i * 6.7), false));
  // 一只小蟹：先跟着拍子轻轻晃；临走前转身望月、举手、一蹲，跳进头顶那点光里
  function goer(c, t) {
    const v = t - c.T, face = ease.io(prog(v, -.9, -.35)), k = prog(v, 0, .3);
    if (k >= 1) return GONE;
    return pose(v > -.3 ? UP : {}, { x: c.x, z: c.z, s: c.s * (1 - ease.in(k)), yaw: lerp(c.yaw, MOONWARD + 30 * (rnd(c.n * 1.9) - .5), face), pitch: -8 * face,
      y: c.y0 + .22 * c.s * bounce(t + .07 * c.n) * (1 - face) + (c.s * 1.9 + .4) * ease.out(k), sq: throb(t) - .22 * pulse(v, -.1, .12) + .3 * k,
      look: mix([.5 * Math.sin(t * .9 + c.n), .5], [0, .9], face), mood: v > -.9 ? MOOD.joy : c.n % 3 ? MOOD.open : MOOD.joy, mouth: .2 + .3 * face, blink: pulse(t, 184 + 5.3 * rnd(c.n * 8.3), .09) });
  }
  // 主角：站在中间目送大家，左看看右看看，挥手，最后转身望月；回头看我们一眼，转回去，化成光
  const HERO_YAW = [[183.2, 0], [185.7, 0], [186.5, -55], [187.3, -55], [188.2, 48], [188.9, 48], [189.9, MOONWARD], [191.95, MOONWARD], [192.45, 286], [192.9, 286], [193.25, MOONWARD]];
  function keeper(t) {
    const wave = prog(t, 186.3, 186.6) * (1 - prog(t, 188.9, 189.3)), back = ease.io(prog(t, 189.2, 189.9)), glance = prog(t, 192.1, 192.45) * (1 - prog(t, 192.9, 193.15)), k = prog(t, FLY, FLY + .3);
    if (k >= 1) return GONE;
    return pose({ x: STAY[0], z: STAY[1], s: 1.15 * (1 - k) ** 1.5, yaw: key(t, HERO_YAW), pitch: -10 * back * (1 - glance), y: 1.7 * ease.out(k),
      sq: throb(t) * (1 - back) + .02 * Math.sin(t * 1.6) * back - .24 * pulse(t, FLY - .1, .12) + .3 * k, look: mix(mix([0, .6], [0, .4], back), [.85, 0], glance),
      aR: mix([-30, .24, .1], [52 + 22 * Math.sin(t * 9.5), .3, .1], wave), mood: wave > .5 ? MOOD.joy : MOOD.open, mouth: .35 * wave + .12 * glance, brow: -.5 * glance,
      blink: Math.max(pulse(t, 185.2, .1), pulse(t, 190.9, .1), pulse(t, 192.7, .1)) }, t > FLY - .25 ? UP : {});
  }

  // ———————————————— 那张纸，和新的小蟹 ————————————————
  // 纸从主角化成的那点光里飘出来，正面朝着我们晃着落下，最后平躺在它站过的地方
  function drawLeaf(t) {
    const u = prog(t, FLY + .25, FLY + 1.25);
    if (u <= 0) return;
    const fall = ease.io(u), sway = Math.sin(u * 9) * (1 - u);
    slips.put({ at: [LEAF[0] + .45 * sway, lerp(2.5, LEAF[1], fall), LEAF[2] + .5 * (1 - fall)], rot: [lerp(-25, -90, ease.in(u)), 8 + 30 * sway, 14 * sway], size: lerp(.2, 1.4, ease.back(prog(u, 0, .3))),
      kind: KIND.title, glow: .5 * (1 - prog(t, FLY + .25, FLY + 2.2)), curl: .2 * (1 - u) });
  }
  const NEW_KEYS = [
    [BORN, { yaw: -12, pitch: 0, look: [0, 0] }], [195.5, { yaw: -12, pitch: 0, look: [-.4, .1] }], [195.75, { yaw: 30, pitch: 4, look: [.7, -.4] }],      // 冒出来，左右看看
    [196.05, { yaw: 62, pitch: 13, look: [.3, -.85] }], [196.4, { yaw: 62, pitch: 13, look: [.3, -.85] }],                                                // 低头看那张纸
    [196.95, { yaw: MOONWARD, pitch: -10, look: [0, .5] }], [LOOP + 10.02, { yaw: MOONWARD, pitch: -10, look: [0, .5] }], [LOOP + 10.36, { yaw: 0, pitch: 0, look: [0, 0] }],   // 抬头望月；最后像开场那样转过身来
  ];
  function newcomer(t) {
    const u = t - BORN, jump = .7 * hop(t, LOOP + 10.48, LOOP + 10.8) + .95 * hop(t, LOOP + 11.06, LOOP + 11.4);
    if (u < 0) return GONE;
    return pose(key(t, NEW_KEYS), jump > .05 || u < .4 ? UP : {}, { x: NEWCOMER[0], z: NEWCOMER[1], s: 1.15 * ease.back(prog(u, 0, .35)), y: .6 * hop(u, 0, .4) + .55 * hop(t, LOOP + 10.04, LOOP + 10.38) + jump,
      sq: .25 * pulse(u, .12, .14) - .2 * pulse(u, .45, .12) + .02 * Math.sin(t * 1.5), mood: u < .5 ? MOOD.wow : t > LOOP + 10.3 ? MOOD.joy : MOOD.open, mouth: .35 * pulse(u, .2, .3) + (jump > .05 ? .6 : 0),
      blink: Math.max(pulse(u, .62, .08), pulse(u, .85, .08), pulse(t, 198.4, .1)) });
  }
  // 「啵」的一下：纸面上荡开一圈很淡的暖色涟漪
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1, .02, 6, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.15, .95, .7), fog: false, transparent: true, depthWrite: false }));
  ring.rotation.x = Math.PI / 2; ring.renderOrder = 20; ring.position.set(NEWCOMER[0], .04, NEWCOMER[1]); props.add(ring);
  function drawRing(t) {
    const u = prog(t, BORN + .1, BORN + .7);
    ring.visible = u > 0 && u < 1;
    ring.scale.setScalar(1.15 * (.8 + 1.6 * ease.out(u))); ring.material.opacity = .55 * (1 - u);
  }

  // ———————————————— 镜头 ————————————————
  const CAM = [
    [183.2, { p: [-12.7, 6.9, -9.2], q: [-13.95, 7.1, -13], f: 4.4 }], [185, { p: [-12.3, 6.8, -8], q: [-13.9, 7, -13], f: 5.6 }, 'lin'],          // 火苗的特写
    [189.4, { p: [.5, 4.4, 19.5], q: [1, 3.2, -3], f: 22 }], [190.4, { p: [.7, 4.3, 20.3], q: [1, 3.2, -3], f: 23 }, 'lin'],                       // 拉开到书案全景：左边是灯，右上是月亮
    [190.4, { p: [-1.6, 1.5, 7.6], q: [1.2, 2.7, -6], f: 6.9 }], [193.3, { p: [-1.3, 1.55, 7.3], q: [1.2, 2.7, -6], f: 6.7 }, 'lin'],              // 开头的机位：从背后越过它看月亮
    [194.3, { p: [-1.2, 1.6, 7.2], q: [1.3, 2.9, -6], f: 30 }],                                                                                      // 目送那点光飞远
    [195, { p: [-1.4, 3.3, 7.8], q: [-.8, 1.2, .9], f: 7.4 }], [196.1, { p: [-1.45, 3.2, 7.9], q: [-.85, 1.2, .9], f: 7.4 }, 'lin'],               // 低头看那张纸和新冒出来的小蟹
    [197, { p: [-2.6, 1.6, 7.6], q: [.4, 2.6, -6], f: 7 }],                                                                                          // 回到开头的构图
    [197, { p: [-10, 2.9, 38], q: [6, 9.5, -40], f: 62 }], [202.41, { p: [-12, 2.6, 44], q: [6, 9.5, -40], f: 70 }, 'lin'],                                 // 书房全景，缓缓后退
  ];
  // 片名：比开场的小、靠下；下面 H × .62 处留着一行小字的位置。字后面压一团很淡的暗影，垫住片名和那行小字（背后是梅枝和笔架山，太花）
  function title(t) {
    const alpha = prog(t, 197.9, 199.1);
    return alpha <= 0 ? undefined : (g, W, H) => {
      g.save(); g.globalAlpha = alpha;
      g.save(); g.translate(W / 2, H * .56); g.scale(1, .34);
      const shade = g.createRadialGradient(0, 0, 0, 0, 0, W * .3);
      shade.addColorStop(0, 'rgba(11, 10, 34, .5)'); shade.addColorStop(.6, 'rgba(11, 10, 34, .32)'); shade.addColorStop(1, 'rgba(11, 10, 34, 0)');
      g.fillStyle = shade; g.fillRect(-W * .3, -W * .3, W * .6, W * .6);
      g.restore();
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#FFF4E2'; g.shadowColor = 'rgba(10, 8, 40, .8)'; g.shadowBlur = 24;
      g.font = '120px "Kaiti SC", "STKaiti", serif'; g.letterSpacing = '28px'; g.fillText('一万个我', W / 2 + 14, H * .52);
      g.globalAlpha = alpha * prog(t, 198.6, 199.6);                                                   // 片名下面的两行小字：谁做了什么
      g.font = '30px "Songti SC", "STSong", serif'; g.letterSpacing = '6px'; g.shadowBlur = 12;
      g.fillText('歌词 · 分镜 · 画面由 Claude Fable 5.2 与 Opus 5.5 用代码完成', W / 2 + 3, H * .615);
      g.fillText('人声与伴奏由 MiniMax 音乐模型合成', W / 2 + 3, H * .662);
      g.restore();
    };
  }

  return {
    frame(t) {
      CROWD.forEach(c => { kit.act(c.crab, u => goer(c, u)); drawGlint(c.glint, t); });
      kit.act(hero, keeper); kit.act(twin, newcomer);
      drawGlint(MINE, t); STRAY.forEach(e => drawGlint(e, t));
      drawLeaf(t); drawRing(t);
      drawPile(slips, 140);
      return { cam: key(t, CAM), fade: prog(t, 200.6, 202.2), paint: title(t) };
    },
  };
}
