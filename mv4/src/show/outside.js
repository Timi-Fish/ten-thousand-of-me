// 外景的六个段落：镜头跟着光点进到屏风的画里，看分身们在四季的山水间赶路。排在节目单的最前面，时间一到就从书案切出来。
//   glimpse  19.86 – 24.45 「各看各的 春秋冬夏」：春、秋、冬、夏各一眼，每处有两只分身在路上
//   wind     34.4 – 36.3   「路上的风」：秋天的山脊上，一只分身迎着风跑下石阶
//   descent  39.6 – 45.9   「一万个我 下山去 / 一万张纸 回故乡」：雪夜，一个长镜头从小屋后上方的半空看着灯河流下山，缓缓推下来，落到小屋前一队蹦着下山的分身跟前；
//                           然后落日下一条纸的河从镜头身边流向主峰，一圈一圈绕着山盘旋下去（灯火、纸群见 vista-*.js）
//   again    91.2 – 96.7   第二遍副歌：春天的清晨，一大群分身从湖边的路上蹦过去；一条纸的河从镜头身边流向春山，绕着山盘旋下去
//   journey  110.6 – 130.4 间奏：四处旅程——春天的湖边、夏天的桥上、落日下的海边、雪夜的小屋前。每处一只分身，各自把看到的写成一张纸举起来
//   finale   158.9 – 164.5 最后一遍副歌：顺着灯河往下飞，四季一拍一换；然后漫山的薄纸从四面八方吹来，在主峰上空拼成一个「我」字，化成光，炸开成满屏的光点朝我们冲过来（回故乡）
import * as THREE from 'three';
import { D, lerp, prog, rnd, ease } from '../anim.js';
import { pose, MOOD } from '../crab.js';
import { bounce, throb, hop, UP, V, BEAT, BEAT_AT } from './beat.js';
import { makeTrek } from './trek.js';
import { WARM } from './moves.js';
import { KIND, SLIP } from './slips.js';
import { PUFF } from './puffs.js';
import { bodyNow, dims, place } from './hold.js';
import { vistaLights, glyphPoints, LOOK } from './vista-lights.js';
import { vistaGlow } from './vista-glow.js';
import { paperFlock } from './vista-paper.js';

// 外景里小蟹沿路蹦的快慢（每秒几个单位）：和它在书案上走动差不多快，不显得急。跑、赶路的在这上面加一两成
const PACE = 3.6;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const toward = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);

// 各段共用的准备：外景给的推荐机位、路上的定位、几种机位的算法
function scout(kit) {
  const { wild } = kit, { road, SHOTS } = wild, trek = makeTrek(kit);
  const near = (x, z) => { let best = 0, gap = Infinity; for (let i = 0; i <= 4000; i++) { const p = road.at(i / 4000), d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < gap) { gap = d; best = i / 4000; } } return best; };   // 路上离 (x, z) 最近的那一点
  const shot = pick => { const s = SHOTS.find(pick); if (!s) throw new Error('外景的推荐机位里没有要找的那一个'); return { ...s, u: near(s.q[0], s.q[2]) }; };
  return {
    trek, road, len: road.length,
    close: season => shot(s => s.season === season),                    // 每个季节的第一个机位是「小蟹在路上」的近景
    named: word => shot(s => s.name.includes(word)),
    // 一个固定的机位，缓缓往前推：v 是这个镜头开始后的秒数
    // 没有哪个镜头是完全静止的：v 是这个镜头开始后的秒数；speed 每秒往前推几成；orbit 每秒绕着看向的点横移多少度（正负分左右）；rise 每秒升高多少
    push: (s, v, speed = .012, orbit = 1, rise = 0) => {
      const a = orbit * v * D, k = 1 - speed * v, dx = s.p[0] - s.q[0], dz = s.p[2] - s.q[2];
      const p = [s.q[0] + (dx * Math.cos(a) - dz * Math.sin(a)) * k, s.q[1] + (s.p[1] - s.q[1]) * k + rise * v, s.q[2] + (dx * Math.sin(a) + dz * Math.cos(a)) * k];
      return { p, q: s.q, f: dist(p, s.q) };
    },
    // 横穿画面的一条航线：在镜头前 ahead 远的地方，从画面一侧到另一侧（half 是半程长），高度从 lift0 到 lift1
    across(s, ahead, half, lift0, lift1) {
      const dir = V(...s.q).sub(V(...s.p)).normalize(), side = V(dir.z, 0, -dir.x).normalize(), mid = V(...s.p).addScaledVector(dir, ahead);
      return { a: mid.clone().addScaledVector(side, -half).add(V(0, lift0, 0)), b: mid.clone().addScaledVector(side, half).add(V(0, lift1, 0)) };
    },
  };
}
// 举在头顶给我们看的那张纸，字朝着镜头（cam 是镜头位置）。纸的下沿按小蟹此刻真实的身体放在头饰上方一点：
// 身体带着弹性，蹦起落下时比姿势里写的位置慢半拍，按姿势放纸会被头顶撞上
function holdUp(kit, crab, poseAt, t, cam, kind, shown) {
  if (shown <= 0) return;
  const b = bodyNow(crab, poseAt, t), d = dims(b), size = 1.7 * b.s * ease.back(prog(shown, 0, .35));
  const { at } = place(b, { at: [0, d.crown + d.gap + (.1 + SLIP.h / 2 * size + .2 * (1 - shown) * (1 + Math.sin(shown * 9))) / b.s, 0], rot: [0, 0, 0] });
  kit.slips.put({ at, rot: [-6, Math.atan2(cam[0] - at[0], cam[2] - at[2]) / D, 0], size, kind, ink: prog(shown, 0, .3), glow: .12 * (1 - shown) });
}

// 落地的小动静（puffs.js）：各处脚下带起什么、那里有多亮（雪夜里颗粒压暗一点）
const FOOTING = { 春: [PUFF.dust, 1], 夏: [PUFF.splash, 1], 秋: [PUFF.leaf, 1], 冬: [PUFF.snow, .75], 海: [PUFF.spray, 1] };
// 这只沿路蹦的小蟹最近两次落地，脚边各带起一小圈。upTo：只算这个时刻之前的落地（它停下来以后就不再有）
function kick(kit, walk, t, [kind, light], upTo = Infinity) {
  for (let back = 0; back < 2; back++) {
    const land = walk.landed(Math.min(t, upTo), back);
    kit.puffs.put([land.x, land.y, land.z], t - land.t, kind, { s: land.s, power: land.power, light });
  }
}

// ———————————————— 「各看各的 春秋冬夏」————————————————
export const glimpse = {
  span: [19.86, 24.45], outdoor: true,
  build(kit) {
    const o = scout(kit);
    const LOOKS = [[19.86, '春', 1, 4], [21.0, '秋', 3, 0], [22.15, '冬', 0, 5], [23.3, '夏', 2, 1]].map(([from, season, lead, pal]) => {   // [开始, 季节, 领头的分身, 跟着的分身]
      const at = o.close(season);
      return { from, season, at, cast: [[kit.full[lead], o.trek.walker({ u0: at.u - 3.3 / o.len, t0: from, speed: PACE, extra: { mood: MOOD.star } })],
        [kit.full[pal], o.trek.walker({ u0: at.u - 7.5 / o.len, t0: from, speed: PACE, side: 1.3, s: .9, lag: .5 })]] };
    });
    return {
      frame(t) {
        const look = LOOKS.findLast(l => t >= l.from);
        look.cast.forEach(([crab, walk]) => { kit.act(crab, walk); kick(kit, walk, t, FOOTING[look.season]); });
        return { set: 'wild', season: look.season, cam: o.push(look.at, t - look.from, .03, look.from % 2 > 1 ? 2.5 : -2.5) };
      },
    };
  },
};

// ———————————————— 「路上的风」————————————————
export const wind = {
  span: [34.4, 36.3], outdoor: true,
  build(kit) {
    const o = scout(kit), ridge = o.named('山脊'), runner = kit.full[4];
    // 张开手迎着风往下蹦：一拍一蹦、一蹦一级，从容地下
    const run = o.trek.walker({ u0: ridge.u - 2.2 / o.len, t0: 34.4, speed: PACE, every: 1, extra: { mood: MOOD.joy, mouth: .8, laugh: .8, aL: [70, .34, -.1], aR: [70, .34, -.1] } });
    // 镜头不跟着它一蹦一蹦地颠：只跟它「走到了哪一级」——取前后两次落地之间匀速滑过去的位置，不取它蹦在半空里的位置
    const glide = t => { const a = run.landed(t), b = run.landing(t), k = b.t > a.t ? ease.io((t - a.t) / (b.t - a.t)) : 0; return [lerp(a.x, b.x, k), lerp(a.y, b.y, k), lerp(a.z, b.z, k)]; };
    return {
      frame(t) {
        kit.act(runner, run);
        kick(kit, run, t, FOOTING.秋);
        const g = glide(t), aim = [g[0], g[1] + 1.6, g[2]], eye = toward(ridge.p, [g[0], g[1] + 2.5, g[2]], .5 + .03 * (t - 34.4));   // 机位往它那边靠近一半，缓缓跟着它摇
        return { set: 'wild', season: '秋', cam: { p: eye, q: aim, f: dist(eye, aim) } };
      },
    };
  },
};

// 一队沿路往下蹦的分身，每只头顶提着一点灯火、落地时脚边带起一小圈。返回 frame(t)；frame.mid(t) 是这一队中间那只此刻的位置
function parade(kit, o, crabs, { u0, t0, speed, gap, size = .8, footing }) {
  const walkers = crabs.map((crab, i) => ({ crab, walk: o.trek.walker({ u0: u0 - i * gap / o.len, t0, speed, side: 2.1 * (rnd(i * 3.7) - .5) * 2, s: size * (.85 + .3 * rnd(i * 5.3)), lag: rnd(i * 2.9) }) }));
  const frame = t => walkers.forEach(({ crab, walk }) => {
    kit.act(crab, walk);
    kick(kit, walk, t, footing);
    const p = walk(t);
    kit.lights.put([p.x, p.y + 2.6 * p.s, p.z], .16, WARM);
  });
  frame.mid = t => walkers[walkers.length >> 1].walk(t);
  return frame;
}
// 机位不钻进山里：脚下的地面以上至少留 gap
const above = (kit, p, gap) => [p[0], Math.max(p[1], kit.wild.heightAt(p[0], p[2]) + gap), p[2]];
// 万点灯火和照亮山路的那层光，一段表演一份
function vista(kit) {
  const group = kit.group(), lamps = vistaLights(kit, group), glow = vistaGlow(kit, group, lamps.routes);
  return {
    lamps,
    frame(t, opts, ground = {}) { group.visible = true; glow.frame(lamps.frame(t, opts), LOOK[opts.season], ground); },
    hide() { group.visible = false; },                                  // 这一段里不拍灯火的镜头：整组藏起来（每帧开头总调度会把它重新打开）
  };
}

// ———————————————— 第一遍副歌：雪夜下山，纸飞过云海 ————————————————
// 39.6 起一个长镜头：从半空看着灯河流下山，缓缓推下来，落到小屋前一队蹦着下山的分身跟前，身后的路上灯火接着流；
// 43.05 落日下一条纸的河流向主峰，绕着山一圈一圈盘旋下去
export const descent = {
  span: [39.6, 45.9], outdoor: true,
  build(kit) {
    const o = scout(kit), hut = o.close('冬'), v = vista(kit), papers = paperFlock(kit, kit.group(), { count: 9000 });
    // 一个长镜头，从大景落到路上，中间不切，也不俯冲：
    //   起点就在小屋前那个近景机位的正后上方（顺着它的视线往后退 BACK、抬高 LIFT），视角放宽、镜头抬着看：雪坡上的小屋、屋后一折一折流下来的灯河、背后的山都在画面里；
    //   然后沿着同一条视线一口气缓缓推下来，一边推一边把镜头压低，LAND 时正好落成那个近景，接着只剩极慢的前推。
    //   全程只有一个进度 s 管着位置、朝向和视角（三样一起动、一起停，不会走一段顿一下）；离它们的远近按倍数匀着缩（不按距离匀着走）：越近走得越慢，画面里看是匀速推近，不会到跟前猛地刹住
    const LAND = 42.75, WIDE = 46, CLOSE = 36, BACK = 105, LIFT = 58, UPHILL = [-75, 290, 250], SPEED = 1.15 * PACE;
    const behind = V(...hut.p).sub(V(...hut.q)).setY(0).normalize(), START = V(...hut.p).addScaledVector(behind, BACK).add(V(0, LIFT, 0)).toArray();
    const NEARER = dist(hut.p, hut.q) / dist(START, hut.q);            // 推到底时离它们的远近是起点的几分之一
    const SKYWARD = V(...UPHILL).sub(V(...START)).normalize();         // 起点的朝向：抬头看着山上流下来的灯河
    const march = parade(kit, o, kit.lite.slice(0, 16), { u0: hut.u + (4 - SPEED * 2.6) / o.len, t0: 39.6, speed: SPEED, gap: 3.4, footing: FOOTING.冬 });   // 镜头落下来的时候领头的正好蹦到小屋前
    // 看纸河的机位：在主峰东北的远处越过云海迎着落日看，整座主峰连同脚下的云海、背后一重重的远山都在画面里；落日在画面上方。
    // 纸河从画面右边、镜头身边流出去（只有几张，大），往右荡开一道弯，折回来流到山的右侧，绕到山后被山挡住，再从山的左侧转出来、从山前横过去，一圈比一圈低，最后没进云海。
    // 山不撑满画面：山脚落在云海里，两边留出云海和远山，纸河那道弯有地方展开
    const dusk = { p: [700, 455, -320], q: [0, 372, 40] }, DUSK_FOV = 42;
    const river = papers.course({ eye: dusk.p, look: dusk.q, axis: [10, 70], top: 385, bottom: 250, turns: 1.8, hand: -1, join: 90, clear: 30, near: 10, drop: 8, sweep: 70 });
    return {
      frame(t) {
        if (t < 43.05) {
          march(t); papers.hide();
          const me = march.mid(t), s = ease.io(prog(t, 39.6, LAND)), settled = o.push(hut, t - LAND, .025, .6);   // settled：落定以后那个极慢的前推（落定之前也照它算，两段接上时速度是连着的）
          v.frame(t, { season: '冬', hole: [me.x, me.y, me.z, 30], gain: lerp(1, .4, s), near: lerp(7, 40, s) }, { gain: lerp(1, .6, s) });   // 靠近以后：成片的灯火收暗，贴到镜头跟前的不画，真的小蟹站的那一段让出来
          // 朝向按角度匀着转（从抬头看山转到平视它们，一共二十来度），不按「看向的点」挪：离得近了，看向的点挪一点镜头就要甩一大下
          const p = toward(START, settled.p, (1 - NEARER ** s) / (1 - NEARER)), f = dist(p, settled.q), look = SKYWARD.clone().lerp(V(...settled.q).sub(V(...settled.p)).normalize(), s).normalize();
          return { set: 'wild', season: '冬', cam: { p, q: p.map((x, i) => x + look.getComponent(i) * f), f, fov: lerp(WIDE, CLOSE, s) } };
        }
        v.hide();
        const cam = { ...o.push(dusk, t - 43.05, .012, 0, 1.5), fov: DUSK_FOV };   // 顺着纸河的方向缓缓往落日推（不横移：纸河就贴在镜头旁边）
        // 逆着落日看：纸的背光面是冷的，透过来的光是暖的
        papers.stream(t, river, { eye: cam.p, speed: 46, width: [12, 21], thick: .8, wander: 9, size: [1.4, 2.6], grow: [60, 320], light: [.25, .4, .4, .9], lamp: [0, 0, 0] });
        return { set: 'wild', season: '秋', cam };
      },
    };
  },
};

// ———————————————— 第二遍副歌：春天的清晨 ————————————————
// 91.2 一大群分身从湖边的路上蹦过去；93.75 一条纸的河流向春山，绕着山一圈一圈盘旋下去
export const again = {
  span: [91.2, 96.7], outdoor: true,
  build(kit) {
    const o = scout(kit), lake = o.close('春'), papers = paperFlock(kit, kit.group(), { count: 9000 });
    // 看纸河的机位：在主峰西南的远处、高过山腰的半空略俯着看，整座山连同两边的云海和远山都在画面里——峰顶的亭子和山门、山沟里的十八盘、歇脚的平台；日头在镜头的右前方，山一面受光一面在影里。
    // [开始时在哪, 结束时在哪, 看向哪]，镜头顺着纸河的方向缓缓往前推
    const VIEW = [[-576, 411, 705], [-556, 418, 679], [-15, 325, 125]], SPRING_FOV = 42;
    // 纸河和秋天那条同一个走法：从画面右边、镜头身边流出去，往右荡开一道弯，折回来流到山的右侧，绕到山后，再从山的左侧转出来、从山前横过去，一圈比一圈低
    const river = papers.course({ eye: VIEW[0], look: VIEW[2], axis: [-5, 85], top: 380, bottom: 240, turns: 1.8, hand: -1, join: 90, clear: 30, near: 10, drop: 8, sweep: 70 });
    const march = parade(kit, o, [...kit.full, ...kit.lite.slice(0, 9)], { u0: lake.u + 6 / o.len, t0: 91.2, speed: 1.25 * PACE, gap: 2.6, size: .9, footing: FOOTING.春 });
    return {
      frame(t) {
        if (t < 93.75) { march(t); papers.hide(); return { set: 'wild', season: '春', cam: o.push(lake, t - 91.2, .03, -2.5) }; }
        const k = prog(t, 93.75, 96.7), p = above(kit, VIEW[0].map((x, i) => lerp(x, VIEW[1][i], k)), 12), cam = { p, q: VIEW[2], f: dist(p, VIEW[2]), fov: SPRING_FOV };
        papers.stream(t, river, { eye: cam.p, speed: 46, width: [12, 22], thick: .8, wander: 9, size: [1.5, 2.9], grow: [60, 320], light: [.45, .42, .3, .74], lamp: [0, 0, 0] });   // 春天的纸比云海暗一点、比山亮一点：衬着白云也分得出一张张纸
        return { set: 'wild', season: '春', cam };
      },
    };
  },
};

// ———————————————— 间奏：四季的旅程 ————————————————
export const journey = {
  span: [110.6, 130.4], outdoor: true,
  build(kit) {
    const o = scout(kit), SPAN = 4.6, SPEED = PACE, WALK = 1.9;        // 每一处待多久；蹦得多快；蹦多久以后停下来看
    // 停下以后（v 是停下后的秒数）：抬头看一眼 → 转过来朝着镜头 → 原地一蹦、把纸举过头顶。纸一举起来字就在上面，留一秒多给人看清
    const TURN = [.4, .85], JUMP = [.75, 1.15], RAISE = [.8, 1.5], FRAME = [.4, 1.1];   // 转身；那一蹦；纸举起来；镜头给纸让位置（赶在纸举起来之前）
    // 蹦到哪一刻停：某一蹦落地的那一刻，不会在半空中定住
    const stopOf = (walk, from) => walk.landing(from + WALK).t;
    // 跟拍看的不是它一蹦一蹦的身子，而是它在落点之间匀速滑过去的一点，再把前后一小段时间抹平（它停下来时镜头缓缓停住）。
    // 镜头照着身子一蹦一蹦地摇的话，每一蹦画面都往回晃一下，卡在画面边上的亮窗、灯火会跟着一进一出，看上去像灯在闪。返回 t 时刻的 [x, z]
    const TAPS = [-.3, -.15, 0, .15, .3];
    const follow = (walk, stop) => t => {
      const spots = TAPS.map(d => { const u = Math.min(t + d, stop), a = walk.landed(u), b = walk.landing(u), k = b.t > a.t ? prog(u, a.t, b.t) : 0; return [lerp(a.x, b.x, k), lerp(a.z, b.z, k)]; });
      return [0, 1].map(n => spots.reduce((sum, spot) => sum + spot[n], 0) / TAPS.length);
    };
    // 山里的一处：沿山路蹦过来；机位从推荐的位置朝它靠近 near 成、再升高 lift，一路跟着它摇；举起纸以后再往左摇 pan 度（把它身后的景让进画面）；
    // blur 背景虚化是平常的几成（雪夜那一处调小：「山下有灯」，它身后的石灯、小屋檐下的灯笼要看得出是一盏盏灯，虚成一团淡淡的光斑就不对了）
    const hill = (season, at, { near = .5, lift = 0, pan = 0, blur = 1 } = {}) => from => {
      const walk = o.trek.walker({ u0: at.u - (SPEED * WALK + .6) / o.len, t0: from, speed: SPEED, until: from + WALK }), stop = stopOf(walk, from);   // 停下来时正好在推荐机位看的那一点前面一点
      const track = follow(walk, stop), floorAt = t => kit.wild.heightAt(...track(t));
      const eye = t => {                                                // 看向它脚下往上一点（举起纸以后往上抬、往后退一点，把纸让进画面）；脚下的高度取前后一小段的平均，下石阶时镜头不跟着一级一级地颠
        const [x, z] = track(t), paper = ease.io(prog(t, stop + FRAME[0], stop + FRAME[1]));
        const aim = [x, (floorAt(t - .3) + floorAt(t) + floorAt(t + .3)) / 3 + 1.7 + 1.2 * paper, z], e = toward(at.p, aim, near + .012 * (t - from) - .1 * paper);
        e[1] += lift;
        const a = pan * paper * D, dx = aim[0] - e[0], dz = aim[2] - e[2];
        return { p: e, q: [e[0] + dx * Math.cos(a) + dz * Math.sin(a), aim[1], e[2] - dx * Math.sin(a) + dz * Math.cos(a)], f: dist(e, aim), blur };
      };
      return { out: () => ({ set: 'wild', season }), walk, stop, eye, footing: FOOTING[season] };
    };
    // 海边：从沙滩那头沿矶头蹦到尖上那块平顶石，正好停在那里看海。机位先在它斜后方越过它看海和落日，
    // 等它转过身来，绕到它正面：它举着纸，背后是落日和海
    const { shore } = kit, { stand, sea, path } = shore, right = V(-sea.z, 0, sea.x);
    const coast = makeTrek(kit, { heightAt: shore.heightAt, road: { length: path.length, at: path.at, dir: u => path.at(Math.min(1, u + .01)).sub(path.at(Math.max(0, u - .01))).setY(0).normalize() } });
    const by = (ahead, side, up) => stand.clone().addScaledVector(sea, ahead).addScaledVector(right, side).add(V(0, up, 0));   // 以站的那块石头为准的一点：朝海多远、往右多远、高出多少
    const seaside = from => {
      const walk = coast.walker({ u0: 1 - SPEED * (WALK - .2) / path.length, t0: from, speed: SPEED, treads: Infinity, until: from + WALK }), stop = stopOf(walk, from);   // 礁石上的坑洼不是台阶，不按「一蹦一级」限   // 提前一点到：最后一蹦落在路的尽头
      const p0 = by(-17, 6.5, 3.4), p1 = by(-8.5, -2.3, 1.5), far = by(30, -1.5, 2.9);   // 正面的机位偏在它右手边一点：落日从它身侧露出来，不被钳子挡住
      const track = follow(walk, stop);
      const eye = t => {                                                // 开头一半看海、一半看它（它从画面一侧蹦进来，镜头跟着摇向海）；绕到正面时整个看向它和它举的纸
        const k = ease.io(prog(t, from + 1, stop + 1.4)), [x, z] = track(t), body = V(x, stand.y + lerp(1.5, 2.5, k), z);
        const p = p0.clone().lerp(p1, k).addScaledVector(sea, .25 * (t - from)), f = p.distanceTo(body);
        const look = far.clone().sub(p).normalize().lerp(body.clone().sub(p).normalize(), lerp(.5, 1, k)).normalize();
        return { p: p.toArray(), q: p.clone().addScaledVector(look, f).toArray(), f, blur: lerp(1, .6, k) };   // 绕到正面以后少虚一点：它身后的落日要看得清
      };
      return { out: t => ({ set: 'shore', sunset: prog(t, from, from + SPAN) }), walk, stop, eye, footing: FOOTING.海 };   // 这一处的几秒里，落日匀速沉向海平线
    };
    // 四处：在哪、哪只分身、它写下的那张纸
    const LEGS = [[hill('春', o.close('春')), 1, KIND.bloom], [hill('夏', o.close('夏'), { near: .64, lift: 2, pan: 4 }), 2, KIND.rain], [seaside, 3, KIND.sea], [hill('冬', o.close('冬'), { blur: .4 }), 0, KIND.lamp]].map(([place, who, kind], i) => {
      const from = 110.6 + SPAN * i, { out, walk, stop, eye, footing } = place(from), here = walk(stop), ground = here.y;
      const facing = (() => { const e = eye(stop + 1.5).p; return Math.atan2(e[0] - here.x, e[2] - here.z) / D; })();   // 停下以后转过来朝着镜头的朝向
      const turn = here.yaw + ((facing - here.yaw + 540) % 360 - 180);  // 取近的那一边转过去
      return { out, kind, from, stop, eye, walk, here, footing, crab: kit.full[who],
        act(t) {
          if (t < stop) return walk(t);
          const v = t - stop, show = prog(v, JUMP[0], JUMP[0] + .2), rest = walk(t), calm = ease.io(prog(v, .1, .5));   // 站住以后还拿步行器的姿势打底：落地那一下的缓冲、抵弹簧的压扁都在里面，身子不会一帧扁下去
          return pose(rest, show ? UP : {}, { y: ground + .45 * hop(v, ...JUMP) + .28 * bounce(t) * prog(v, JUMP[1] + .1, JUMP[1] + .3), yaw: lerp(here.yaw, turn, ease.io(prog(v, ...TURN))),
            pitch: rest.pitch * (1 - calm) - 12 * calm * (1 - prog(v, .45, .8)), look: [0, .7 * (1 - prog(v, .45, .8))], mood: v < JUMP[0] ? MOOD.wow : MOOD.joy, mouth: .35 + .3 * show, sq: rest.sq + throb(t) * calm, lean: rest.lean * (1 - calm) });
        } };
    });
    const moon = o.named('月出峰后'), LAST = 110.6 + SPAN * 4;         // 最后一眼：雪夜的月亮（下一段从油灯的火苗开始）
    return {
      frame(t) {
        if (t >= LAST) return { set: 'wild', season: '冬', cam: { ...o.push(moon, t - LAST, .03, 1.5, 5), fov: 44 } };
        const leg = LEGS.findLast(l => t >= l.from), cam = leg.eye(t);
        kit.act(leg.crab, leg.act);
        kick(kit, leg.walk, t, leg.footing, leg.stop);
        kit.puffs.put([leg.here.x, leg.here.y, leg.here.z], t - leg.stop - JUMP[1], leg.footing[0], { s: leg.here.s, power: .6, light: leg.footing[1] });   // 举纸前原地那一蹦落地
        holdUp(kit, leg.crab, leg.act, t, cam.p, leg.kind, prog(t, leg.stop + RAISE[0], leg.stop + RAISE[1]));
        return { ...leg.out(t), cam, weather: leg.kind === KIND.rain ? 1 - ease.io(prog(t, leg.stop - .8, leg.stop + 1.6)) : 1 };   // 它停下来之前雨就小了，举起「雨停了」时云开日出：放晴的光要有两秒多才看得清
      },
    };
  },
};

// ———————————————— 最后一遍副歌：四季一拍一换，漫山的光涌回来 ————————————————
export const finale = {
  span: [158.9, 164.5], outdoor: true,
  build(kit) {
    const o = scout(kit), RISE = 161.45, ORDER = ['春', '夏', '秋', '冬'], v = vista(kit), papers = paperFlock(kit, kit.group(), { count: 2600 });
    // 拍点：第 n 拍在 BEAT_AT + n·BEAT。四季在 159.41、160.01、160.62 三个拍点上换；
    // 纸从四面八方吹来，161.75 – 162.9 按笔画先后一张张贴成「我」；163.03 的拍点上整个字化成光，停一拍；163.64 的拍点上字炸开，光点朝四面八方散着冲向镜头，满屏都是
    const beatOf = t => Math.floor((t - BEAT_AT) / BEAT), first = beatOf(158.9), on = n => BEAT_AT + n * BEAT;
    const LIT = on(beatOf(RISE) + 3), FLOW = on(beatOf(RISE) + 4);
    // 沿着山路往下飞：从山顶背后的高处顺着灯河往下、往前推到半山桥那一带的上空，四季一拍一换
    const E0 = [42.7, 631.6, -157.4], E1 = [150, 372, 318], F0 = [10, 170, 520], F1 = [46, 30, 770];
    const fly = k => above(kit, E0.map((x, i) => lerp(x, E1[i], k)), 20);
    // 桥边溪谷那一带的崖石、挂草和夏天的雨雾，镜头离溪谷中心 SEEN 以内才画（wild/gorge.js）。航线定成正好在夏换秋的那一拍跨过这条线：
    // 换季盖住它们的出现，夏天那一拍里也没有溪谷里那层雨雾挡着灯河。线的两边各让开 MARGIN：那一拍之前停在线外，之后已在线内，不会有哪一帧落在线上
    const GORGE = V(66, 162, 432), SEEN = 540, MARGIN = 6, CUT = on(first + 2);
    const reach = gap => { let a = 0, b = 1; for (let n = 0; n < 30; n++) { const m = (a + b) / 2; if (V(...fly(m)).distanceTo(GORGE) > gap) a = m; else b = m; } return b; };   // 飞到几成时离溪谷中心正好这么远（越飞越近）
    const K_OUT = reach(SEEN + MARGIN), K_IN = reach(SEEN - MARGIN);
    // 雪夜：镜头在山背后偏西的地方仰看主峰，只缓缓往前推一点。视角放宽到 WIDE，主峰压在画面正下方当底座；字立在峰顶正上方的半空、画面的正中，朝着镜头；月亮让到画面右边，从侧后给它打逆光
    const N0 = [-713, 250, -273], N1 = [-698, 258, -265], cam = V(...N0).lerp(V(...N1), .5);
    const toPeak = V(0, 440, 0).sub(cam).normalize(), right = toPeak.clone().cross(V(0, 1, 0)).normalize(), up = right.clone().cross(toPeak).normalize();
    const aim = (r, u, d) => cam.clone().add(toPeak.clone().addScaledVector(up, u).addScaledVector(right, r).normalize().multiplyScalar(d));
    const WIDE = 42, center = aim(-.008, .248, 340), NQ = aim(0, .133, 500).toArray(), HIGH = 120, look = V(...NQ).sub(cam).normalize();
    v.lamps.setGlyph(center, cam, HIGH);
    // 一股股纸流的源头（从字心量：往右、往上、往字背后）：四面八方七股，都朝同一边拧着弯汇过来，各落在字上朝着它的那一片；
    // 另有两小股从镜头身后贴着镜头飞过去（就那么几十张，大，看得清字画）
    const STREAMS = [
      { from: [345, -289, 140], swirl: 85, width: 14, sway: 16 }, { from: [453, 80, 30], swirl: 85, width: 15, sway: 18 }, { from: [210, 364, 110], swirl: 85, width: 13, sway: 16 }, { from: [-144, 395, -70], swirl: 85, width: 13, sway: 14 },
      { from: [-413, 150, 60], swirl: 85, width: 14, sway: 18 }, { from: [-381, -220, -40], swirl: 85, width: 13, sway: 16 }, { from: [-75, -423, 90], swirl: 85, width: 14, sway: 16 },
      { from: [40, -22, -700], swirl: 20, width: 16, sway: 6, count: 26 }, { from: [-14, -34, -680], swirl: -20, width: 14, sway: 6, count: 20 },
    ];
    const plan = papers.planGlyph({ ...glyphPoints(2600, center, cam, HIGH, 7.7), center, normal: cam.clone().sub(center).normalize(), arrive: [161.8, 162.95], flight: [1.2, 2.6], light: LIT, streams: STREAMS });
    const SPREAD = 60;                                                  // 字炸开以后，光点从镜头四周多远以内掠过去
    return {
      frame(t) {
        if (t < RISE) {
          papers.hide();
          const season = ORDER[Math.min(3, beatOf(t) - first)], smooth = ease.io(prog(t, 158.9, RISE)), k = t < CUT ? Math.min(smooth, K_OUT) : Math.max(smooth, K_IN), p = fly(k), q = F0.map((x, i) => lerp(x, F1[i], k));
          v.frame(t, { season, bodies: true });
          return { set: 'wild', season, cam: { p, q, f: dist(p, q) } };
        }
        const k = ease.io(prog(t, RISE, 164.5)), p = N0.map((x, i) => lerp(x, N1[i], k));
        papers.glyph(t, plan, { eye: p, size: [1.7, 2.4, 2.6], grow: [30, 200], light: [.42, .5, .3, .95], lamp: [.6, .4, .2] });   // 纸被山下的灯火托着一点暖色，和冷白的雪分得开
        v.frame(t, { season: '冬', form: [LIT, FLOW, .72], burst: { from: [...center.toArray(), HIGH], to: [...p, SPREAD] }, bodies: false }, { gain: 0 });
        const flash = prog(t, 164.05, 164.5) ** 2;                    // 最后光涌满画面，白成一片，切回书案
        return { set: 'wild', season: '冬', cam: { p, q: NQ, f: dist(p, NQ), fov: WIDE }, paint: flash > 0 ? (g, W, H) => { g.fillStyle = `rgba(255, 240, 214, ${.9 * flash})`; g.fillRect(0, 0, W, H); } : undefined };
      },
    };
  },
};
