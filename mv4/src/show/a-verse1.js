// 第一段（0 – 28.6 秒）：开场和第一段主歌。
//   0 – 9.6    开场：月夜的书房全景，片名；镜头落到书案上，一只小蟹背对着我们望月
//   9.6 – 19.86 「拔下毫毛 吹一口气 / 一万个我 落向四方」：转身、蹦两下、鼓成球，「啵」地 1 → 2 → 4 → 8 → 16，再爆成满纸；
//               大家朝外散开，各自化成一点光飞进屏风的四季画里，一只骑着祥云飞向月亮，只留下主角
//   19.86 – 24.45「各看各的 春秋冬夏」：镜头跟进画里看外景（在 outside.js，不在这里）
//   24.45 – 28.6「回来只交 薄纸一张」：回到书案，光点从画里飞回来，落到主角身边变成一张张薄纸，叠成一摞；主角拿起一张看
import * as THREE from 'three';
import { D, lerp, prog, pulse, rnd, ease, key, mix, stepAt } from '../anim.js';
import { pose, MOOD } from '../crab.js';
import { MOON, STAGE } from '../world/layout.js';
import { bounce, throb, hop, UP, V } from './beat.js';
import { makeSplit, SIZE } from './split.js';
import { arc, WARM, windowSpot, flyOut, flyAt } from './moves.js';
import { stackSpot, kindOf, PILE, KIND } from './slips.js';
import { bodyNow, place, grip, blend, HANDS } from './hold.js';

export const span = [0, 28.6];
const SPLITS = [12.61, 13.21, 13.82, 14.42], MOONWARD = 164, RIDER = 9;   // 分裂时刻（都在拍点上）；面朝月亮时的朝向；骑祥云飞向月亮的那一只
const OUTSIDE = [19.86, 24.45];                                        // 这段时间镜头在画里

export function build(kit) {
  const { world, hero, full, lite, lights, slips } = kit, props = kit.group();
  const actor = i => (i ? full[i - 1] : hero);

  // ———————————————— 分裂之前，独自一只：背对镜头望月 → 转身 → 蹦两下 → 鼓气 ————————————————
  const SOLO = { x: 0, z: .6, s: SIZE[0] }, sp = (...parts) => pose(SOLO, ...parts);
  const SOLO_KEYS = [
    [9.6, sp({ yaw: MOONWARD, pitch: -10 })], [9.84, sp({ yaw: MOONWARD, pitch: -10 })],
    [10.04, sp({ yaw: MOONWARD, pitch: -6, sq: -.16 }), 'io'],                                             // 先往下一蹲，蓄一下力
    [10.36, sp(), 'io'],                                                                                   // 一蹦，转过身来
    [11.62, sp()],
    [11.78, sp({ sq: -.18 }), 'io'],                                                                       // 一缩
    [12.08, sp(UP, { puff: 1.25, sq: .05, pitch: -8, pucker: 1, mouth: .25 }), 'out'],                     // 吸气，鼓成球
    [12.52, sp(UP, { puff: 1.75, pitch: -9, pucker: 1, mouth: .25 })],
    [12.61, sp({ sq: -.32 }), 'in'],                                                                       // 啵
  ];
  const SOLO_MOOD = [[0, MOOD.open], [10.3, MOOD.joy], [11.6, MOOD.open], [11.95, MOOD.calm]];
  function soloPose(t) {
    const p = pose(key(t, SOLO_KEYS)), jump = .7 * hop(t, 10.48, 10.8) + .95 * hop(t, 11.06, 11.4);
    p.mood = stepAt(t, SOLO_MOOD);
    p.y += .55 * hop(t, 10.04, 10.38) + jump;                                            // 转身时顺势一跳；然后踩着拍子蹦两下
    if (jump > .05) Object.assign(p, UP, { mouth: .6 });
    p.lean += 2.2 * Math.sin(t * 70) * prog(t, 12.25, 12.55);                             // 鼓到极限时发抖
    p.sq += throb(t) * (1 - prog(t, 11.7, 12)) * prog(t, 9, 9.6) + .02 * Math.sin(t * 1.5) * (1 - prog(t, 9, 9.6));   // 开场时只是轻轻呼吸
    p.blink = Math.max(pulse(t, 3.1, .1), pulse(t, 7.4, .1));
    return p;
  }
  const split = makeSplit({ at: SPLITS, origin: [0, .6], solo: soloPose }), FINAL = Array.from({ length: split.count }, (_, i) => split.home(i));

  // ———————————————— 散开 ————————————————
  const toMoon = home => MOON.clone().sub(V(home[0], 1, home[1])).normalize();
  function ride(home, v) {                                              // 蹲一下、跳上祥云、朝月亮飞去
    const w = Math.max(0, v - .7), q = w * w / (w + .6), dir = toMoon(home), fly = prog(v, .55, .9);
    return { x: home[0] + dir.x * 17 * q, z: home[1] + dir.z * 17 * q, y: .7 * ease.out(prog(v, .3, .6)) + .4 * hop(v, .3, .7) + dir.y * 17 * q + .1 * Math.sin(w * 3) * prog(w, 0, .5),
      sq: -.2 * pulse(v, .22, .22) + .14 * pulse(v, .48, .2), yaw: MOONWARD * ease.io(prog(v, .9, 1.7)), ...UP, mouth: .65 * fly, mood: MOOD.joy };
  }
  // 留下的那一只（主角）：别人都走了，它蹦回纸中间，转过去目送光点飞进屏风；光点回来时迎上去，纸落成一摞，它拿起一张看
  const STAY = [0, .9], leaveAt = i => 16.7 + .055 * i, TAKE = 26.55;   // STAY：主角留守的位置；TAKE：拿起一张纸的时刻
  function stayPose(p, t) {
    const k = ease.io(prog(t, 17.3, 18.5)), cheer = prog(t, 25.3, 25.5) * (1 - prog(t, 26.3, 26.55)), read = ease.io(prog(t, TAKE, TAKE + .5));
    return pose(p, cheer > .5 && bounce(t) > .4 ? UP : {}, {
      x: lerp(FINAL[0][0], STAY[0], k), z: lerp(FINAL[0][1], STAY[1], k), s: lerp(p.s, SIZE[0], ease.io(prog(t, 17.3, 19.2))),   // 分出去的都走了，它慢慢长回原来的个头
      y: .45 * Math.abs(Math.sin(Math.PI * (t - 17.3) * 2.5)) * prog(t, 17.3, 17.4) * (1 - prog(t, 18.4, 18.5)) + .3 * bounce(t) * cheer,
      yaw: key(t, [[18.5, 0], [19.3, MOONWARD, 'io'], [24.3, MOONWARD], [24.45, 60, 'lin'], [25.2, 60], [25.9, 34, 'io'], [26.4, 34], [26.9, 0, 'io']]),   // 目送大家飞出窗；纸从窗外回来时迎着看
      look: key(t, [[24.45, [.5, .7]], [25.2, [.4, .5]], [25.9, [.3, -.5], 'io'], [26.5, [.3, -.5]], [27, [0, -.75], 'io']]),
      aL: mix([-30, .24, .1], HANDS.read, read), aR: mix([-30, .24, .1], HANDS.read, read), pitch: 9 * read,   // 两手在身前捏着纸（下一段开头就是这个拿法）
      mouth: .5 * cheer + .3 * pulse(t, 27.5, .5), sq: throb(t) * (1 + .3 * read),   // 捧着纸看时的呼吸、朝向、手势都和下一段开头一样，两段接上时身子不会跳一下
      mood: stepAt(t, [[17, MOOD.open], [25.3, MOOD.joy], [26.4, MOOD.open], [27.4, MOOD.star]]), blink: Math.max(pulse(t, 19, .1), pulse(t, 26.95, .1)),
    });
  }
  function clonePose(i, t) {
    const p = split.pose(i, t), v = t - leaveAt(i);
    if (v <= 0 || p.s === 0) return p;
    if (i === 0) return stayPose(p, t);
    if (t > OUTSIDE[0]) return pose({ s: 0 });
    return i === RIDER ? pose(p, ride(FINAL[i], v)) : flyOut(p, FINAL[i], 0, v, WAY[i]);
  }
  const WAY = FINAL.map((_, i) => i);                                   // 这 16 只飞出窗各走哪一条弧线（moves.js 的 flyAt 按号码给弧线）

  // ———————————————— 满纸的小蟹（「一万个我」）————————————————
  // 像爆米花一样，一只接一只从那 16 只身上蹦出来，落到纸上各处（前 8 只落在两条镇尺上），踩着拍子蹦；然后和大家一起散开
  const around = (deg, r) => V(r * Math.cos(deg * D), 0, STAGE.z - r * Math.sin(deg * D));   // 表演区圆心周围的一点
  // 落点先随机撒，再互相推开（站在镇尺上的不动）：谁也不和谁挤在一起，也不挤到那 16 只身上
  const SPOTS = lite.map((_, i) => {
    const perch = i < 8, at = perch ? world.perches[i * 3] : around(-20 + 220 * rnd(i * 2.3), 6.4 + 2.7 * rnd(i * 4.9));
    return { perch, x: at.x, z: at.z, y: at.y, s: perch ? .4 : .4 + .1 * rnd(i * 6.1) };
  });
  const ROOM = 1.22, TAKEN = FINAL.map(([x, z]) => ({ x, z, s: SIZE[4] }));   // 两只之间至少隔开各自个头的多少倍
  for (let round = 0; round < 60; round++) SPOTS.filter(a => !a.perch).forEach(a => [...SPOTS, ...TAKEN].forEach(b => {
    const dx = a.x - b.x, dz = a.z - b.z, gap = Math.hypot(dx, dz), need = ROOM * (a.s + b.s);
    if (a !== b && gap < need) { a.x += dx * (need - gap) / gap; a.z += dz * (need - gap) / gap; }
  }));
  const CROWD = lite.map((crab, i) => {
    const at = SPOTS[i];
    const born = 15.03 + 1.25 * i / 40;
    return { crab, n: i, mom: i % 16, from: FINAL[i % 16], home: [at.x, at.z], y0: at.y, s: at.s, yaw: 25 * (rnd(i * 7.3) - .5) - at.x * 2,
      born, leave: Math.max(16.6 + 1.1 * rnd(i * 3.7), born + .95), way: 20 + i };   // 落稳了才动身；way：飞出窗走哪一条弧线
  });
  function crowdPose(c, t) {
    const u = t - c.born, v = t - c.leave;
    if (u < 0 || t > OUTSIDE[0]) return pose({ s: 0 });
    const k = ease.io(prog(u, 0, .55)), landed = prog(u, .55, .7);      // 先蹿高、再往外飞：从别的小蟹头顶上越过去
    const p = pose(UP, { x: lerp(c.from[0], c.home[0], k), z: lerp(c.from[1], c.home[1], k), s: c.s * ease.back(prog(u, 0, .4)), yaw: c.yaw, mood: MOOD.joy, mouth: .5,
      y: c.y0 * k + 2.6 * hop(u, 0, .55) + .34 * bounce(t) * landed * (1 - prog(v, -.2, 0)), sq: .2 * pulse(u, .1, .15) - .22 * pulse(u, .6, .1) + throb(t) });
    return v > 0 ? flyOut(p, c.home, c.y0, v, c.way) : p;
  }
  // 半空里别撞上：沿这一段每 1/30 秒走一遍（身子当成一个球来量），哪两只叠到一起，正飞着的就给其中一只换一条弧线，
  // 刚蹦出来还没落稳的就让后出来的那只晚一点出来；一轮轮排，直到谁也不撞谁
  const ROUND = 1.02, HATCH = .7, CAST = [
    ...FINAL.map((_, i) => ({ at: t => clonePose(i, t), flying: t => i !== 0 && i !== RIDER && t > leaveAt(i), hatching: () => false, kin: () => false, swap() { WAY[i] += 37; } })),
    ...CROWD.map(c => ({ at: t => crowdPose(c, t), flying: t => t > c.leave, hatching: t => t < c.born + HATCH, kin: (j, t) => j === c.mom && t < c.born + .45, late: 0,
      swap() { c.way += 37; }, wait() { if (this.late < 6) { this.late++; c.born += .04; c.leave = Math.max(c.leave, c.born + .95); } } })),
  ];
  for (let round = 0; round < 80; round++) {
    const fix = new Map();
    for (let t = 15; t < OUTSIDE[0]; t += 1 / 30) {
      const balls = CAST.map(e => { const p = e.at(t); return p.s > .05 ? [p.x, p.y + p.s, p.z, ROUND * p.s] : null; });
      balls.forEach((a, i) => a && balls.forEach((b, j) => {
        if (j <= i || !b || CAST[j].kin(i, t) || Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) > a[3] + b[3]) return;
        const [late, early] = [CAST[j], CAST[i]];                       // 先动后出来的那一只；它动不了（已经站稳了）才动另一只
        const who = late.flying(t) || late.hatching(t) ? late : early, how = who.flying(t) ? 'swap' : who.hatching(t) ? 'wait' : null;
        if (how) fix.set(who, how);
      }));
    }
    if (!fix.size) break;
    fix.forEach((how, who) => who[how]());
  }

  // ———————————————— 特效 ————————————————
  // 每次分裂「啵」的一下：纸面上荡开一圈很淡的暖色涟漪
  const RING = new THREE.TorusGeometry(1, .02, 6, 64);
  const POPS = split.pops.map(p => {
    const ring = new THREE.Mesh(RING, new THREE.MeshBasicMaterial({ color: new THREE.Color(1.15, .95, .7), fog: false, transparent: true, depthWrite: false }));
    ring.rotation.x = Math.PI / 2; ring.renderOrder = 20; props.add(ring);
    return { ...p, ring };
  });
  function drawPops(t) {
    POPS.forEach(p => {
      const u = prog(t, p.at + .15, p.at + .7);
      p.ring.visible = u > 0 && u < 1;
      if (p.ring.visible) { p.ring.position.set(p.x, .04, p.z); p.ring.scale.setScalar(p.size * (.8 + 1.6 * ease.out(u))); p.ring.material.opacity = .55 * (1 - u); }
    });
  }
  // 飞出去的小蟹身后各拖着一小串光屑
  const FLYERS = [...FINAL.map((home, i) => ({ home, y0: 0, leave: leaveAt(i), n: WAY[i], solo: i === 0 || i === RIDER })).filter(f => !f.solo), ...CROWD.map(c => ({ home: c.home, y0: c.y0, leave: c.leave, n: c.way }))];
  function drawTrails(t) {
    FLYERS.forEach(f => {
      for (let j = 1; j <= 5; j++) {
        const { at, q } = flyAt(f.home, f.y0, t - f.leave - .07 * j, f.n);
        if (q > .04 && q < 1.25) lights.put([at[0] + .12 * Math.sin(t * 9 + j + f.n), at[1] + .25, at[2]], .075 * (1 - j / 6) * (1 - prog(q, 1, 1.25)), WARM);
      }
    });
  }
  // 回来的纸：一张张从月洞窗外飞进来，翻着落到主角身边那摞纸上。
  // 最上面的五张是下一段里它要一张张看的（从下往上：路上有风、冬、秋、夏、春），所以最后落下、被它拿起来的那一张是春。
  // 最后一张也赶在 TAKE 之前落定：它是从摞上被拿起来的，不是半路变到手里的
  const LAST = [KIND.wind, KIND.winter, KIND.autumn, KIND.summer, KIND.spring];
  const BACK = Array.from({ length: 44 }, (_, i) => ({ from: windowSpot(i + 500), launch: 22.4 + 2.05 * rnd(i * 6.3), lift: 2 + 5 * rnd(i * 2.7), spin: i * 1.9 }))
    .map(s => ({ ...s, land: s.launch + 2 })).sort((a, b) => a.land - b.land).map((s, i, all) => ({ ...s, ...stackSpot(PILE, i), kind: i < all.length - LAST.length ? kindOf(i) : LAST[i - all.length + LAST.length] }));
  const TOP = BACK.length - 1;                                          // 最上面那一张后来被主角拿起来
  function drawBack(t) {
    BACK.forEach((s, i) => {
      if (t < s.launch) return;
      if (t < s.land) {                                                // 还在飞：越近翻得越慢，最后放平
        const { at, k } = arc(s.from, s.at, s.launch, s.land, t, s.lift), loose = 1 - ease.io(prog(k, .8, 1));
        slips.put({ at, rot: [-90 + 70 * Math.sin(t * 6 + s.spin) * loose, s.rot[1] + 300 * (1 - k) + s.spin * 40, 40 * Math.sin(t * 4.3 + s.spin) * loose], kind: s.kind, glow: .25 * loose, curl: .3 * Math.sin(t * 7 + s.spin) * loose });
        return;
      }
      const fresh = t - s.land, take = i === TOP ? ease.io(prog(t, TAKE, TAKE + .55)) : 0;
      let spot = s;                                                    // 最上面那张被拿起来：从摞上划一道弧，到主角身前捧着读的位置（按它此刻的身体算，hold.js）
      if (take > 0) {
        const b = bodyNow(hero, u => clonePose(0, u), t);
        spot = blend(s, place(b, grip.read(b, 1, -76, .5, 0)), take);
        spot.at[1] += .5 * Math.sin(Math.PI * take); spot.at[2] += .55 * Math.sin(Math.PI * take);   // 弧往上、往身前鼓出去：从身子前面绕过来，不擦着身子
      }
      slips.put({ at: spot.at, rot: spot.rot, kind: s.kind, glow: .3 * (1 - prog(fresh, 0, .6)) + take * (.07 + .02 * Math.sin(t * 6)), curl: .12 * take });   // 到手以后微微发光、略卷，和下一段开头一样
    });
  }
  // 接那一只的祥云
  const cloud = new THREE.Group(), BALL = new THREE.SphereGeometry(1, 16, 12);
  props.add(cloud);
  [[0, 0, 0, .9], [-.8, -.05, .1, .62], [.8, -.05, .1, .62], [-.4, .15, -.3, .6], [.45, .12, .3, .6], [0, -.1, .5, .55]].forEach(([x, y, z, r]) => {
    const m = new THREE.Mesh(BALL, new THREE.MeshStandardMaterial({ color: '#FFF7EA', emissive: '#C9B8F0', emissiveIntensity: .45, roughness: 1 }));
    m.position.set(x, y, z); m.scale.set(r, r * .55, r); cloud.add(m);
  });
  function drawCloud(t) {
    const v = t - leaveAt(RIDER);
    cloud.visible = v > -.7 && t < OUTSIDE[0];
    if (!cloud.visible) return;
    const p = clonePose(RIDER, t), k = ease.out(prog(v, -.7, .25));             // 从右边飞来停到它脚下，然后一直托着它
    cloud.position.set(lerp(p.x + 9, p.x, k), lerp(3, p.y - .05, k) + .05 * Math.sin(t * 5), lerp(p.z + 2, p.z, k));
    cloud.scale.setScalar(.7);
  }

  // ———————————————— 镜头 ————————————————
  // p 镜头位置，q 镜头看向的点，f 对焦距离（离镜头多远的东西最清楚）
  const CAM = [
    [0, { p: [-12, 2.6, 44], q: [6, 9.5, -40], f: 70 }], [4.6, { p: [-10, 2.9, 38], q: [6, 9.5, -40], f: 62 }, 'lin'],                     // 书房全景：贴着案面的高度往里看，月亮在窗里偏上（从高处是看不到月亮的）
    [4.6, { p: [0, 22, 30], q: [0, 3, -9], f: 36 }], [9.6, { p: [-.6, 9, 19], q: [.4, 2.2, -5], f: 20 }, 'io'],                              // 从高处落向书案
    [9.6, { p: [-1.6, 1.5, 7.6], q: [1.2, 2.7, -6], f: 60 }], [10.1, { p: [-1.4, 1.5, 7.4], q: [1.2, 2.7, -6], f: 40 }, 'lin'],           // 从背后越过它看月亮：先对焦在窗外
    [11.0, { p: [0, 1.9, 7.4], q: [0, 1.4, .6], f: 6.8 }, 'io'], [12.55, { p: [0, 1.9, 7.8], q: [0, 1.5, .6], f: 7.2 }, 'lin'],           // 摆到它的正前方（正脸，不偏），焦点拉回它身上
    [13.15, { p: [0, 2.6, 10.6], q: [0, 1.1, .5], f: 10.3 }, 'io'], [14.35, { p: [0, 3.7, 14.6], q: [0, 1.0, 0], f: 15.2 }, 'io'],       // 每分裂一次就拉远一点
    [15.3, { p: [0, 4.6, 18.5], q: [0, 1.2, -1.5], f: 20.3 }, 'io'], [16.7, { p: [-1.2, 4.2, 18], q: [0, 1.4, -1.5], f: 20 }, 'lin'],     // 全景
    [19.86, { p: [-1.4, 1.7, 9], q: [13, 12, -50], f: 60 }, 'io'],                                                                           // 降到纸面的高度，从梅枝底下仰头跟着大家飞向月洞窗（高了会被那枝梅挡住）
    [24.45, { p: [-6.5, 2.6, 11], q: [7, 6, -14], f: 16 }], [26.5, { p: [.7, 2.5, 9.6], q: [.7, 1.15, 1.2], f: 8.9 }, 'io'],                // 回到书案：先朝月洞窗看纸飞回来，再摆正（朝书案正后方看），主角和那摞纸一左一右
    [28.6, { p: [0, 1.7, 6.4], q: [0, 1.05, 1.5], f: 5.2 }, 'io'],                                                                          // 推近到它的正前方：它在看那张纸
  ];
  // 片名
  function title(t) {
    const alpha = Math.min(prog(t, 1.3, 2.3), 1 - prog(t, 4, 4.6));
    return alpha <= 0 ? undefined : (g, W, H) => {
      g.save(); g.globalAlpha = alpha; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#FFF4E2'; g.shadowColor = 'rgba(10, 8, 40, .8)'; g.shadowBlur = 28;
      g.font = '170px "Kaiti SC", "STKaiti", serif'; g.letterSpacing = '36px'; g.fillText('一万个我', W / 2 + 18, H * .44);
      g.restore();
    };
  }

  return {
    frame(t) {
      kit.act(hero, u => clonePose(0, u));
      full.forEach((crab, i) => kit.act(crab, u => clonePose(i + 1, u)));
      CROWD.forEach(c => {
        kit.act(c.crab, u => crowdPose(c, u));
        if (t >= c.born && t < c.born + .4) kit.merge(actor(c.mom), c.crab);   // 刚从那一只身上蹦出来
      });
      split.pairs(t).forEach(([a, b, u]) => kit.bond(actor(a), actor(b), u));
      drawPops(t); drawCloud(t);
      if (t < OUTSIDE[0]) drawTrails(t); else drawBack(t);
      const cam = key(t, CAM), shake = t > SPLITS[0] ? Math.exp(-(t - SPLITS[0]) / .09) : 0;
      // 大家飞向窗口时把虚化加重：对焦在窗口那么远，近处横在画面里的那枝梅虚成一团团色斑，不挡飞出去的小蟹
      const blur = 1 + 2.2 * ease.io(prog(t, 17.2, 18.4)) * (1 - prog(t, OUTSIDE[0], OUTSIDE[0] + .01));
      return { cam: { ...cam, blur, p: [cam.p[0] + .05 * shake * Math.sin(t * 80), cam.p[1] + .04 * shake * Math.cos(t * 67), cam.p[2]] }, fade: 1 - prog(t, 0, 1.2), paint: title(t) };
    },
  };
}
