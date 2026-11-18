// 外景里共用的走法：小蟹沿路往前蹦、跟着路摆的机位。
// 路在哪由 land 给出：land.road 是路的中线（at(u)、dir(u)、length，u 从 0 起点到 1 终点），land.heightAt(x, z) 是地面的高度。
// 不给 land 就是画中山水的那条山路（u 从山顶到山脚）。
import { D, lerp, clamp } from '../anim.js';
import { pose, MOOD } from '../crab.js';
import { BH } from '../crab/pose.js';
import { BEAT, BEAT_AT, V } from './beat.js';

export const HOP = .45;                                               // 平路上每一蹦离地多高（按个头的倍数）
// 蹦的节奏：每 every 拍一蹦（不写是半拍：落地踩在拍点和半拍上；1 是一拍一蹦，慢一倍）。每个周期先在地上待 SET 成（落地缓冲、接着压一下起跳），其余在空中
const SET = .2;
const SCAN = .04, EDGE = .04;                                        // 找台阶的棱：沿路每隔 SCAN 量一次路面高，相邻两次差超过 EDGE 就是一道棱
const CLEAR = .06;                                                   // 空中脚底至少高出路面多少（按个头的倍数）
const BEFORE = 4, AFTER = 26;                                        // 落点表覆盖 t0 之前、之后多少秒；表外站在头尾的落点上不动
// 落点离踏面后沿（身后那级台阶的立面）、前沿（往下的棱）至少多远：按踏面深度的几成，夹在上下限之间。
// 落点偏在踏面靠前的那一截：弧线最后要越过身后那级台阶的棱，落点离它越远，弧线越不用拔高、落得越不陡；
// 小蟹又比一级踏面宽，落点靠前，身体后半截才不会戳进身后那级台阶
const BACK = [.6, .16, .6], FRONT = [.22, .13, .25];
const margin = ([k, lo, hi], w) => clamp(k * w, lo, hi);
// 小蟹身体、身形两根弹簧的硬度和阻尼（和 crab/spring.js 的 BODY、SHAPE 一致，那边按 1/60 秒一步重演）。
// KEEP：弹簧改掉的身高抵回来几成；NOD：身子前后弯抵回来几成（留一半，空中身子往后拖、落地往前一冲，看得出惯性）
const BODY = [260, 9], SHAPE = [420, 9], KEEP = .95, NOD = .5;
const turn = (a, b, k) => a + (((b - a) % 360 + 540) % 360 - 180) * k;   // 角度插值，取近的那一边转
const ease = k => k * k * (3 - 2 * k);

export function makeTrek(kit, land = kit.wild) {
  const { road } = land;
  // 山路上的一个位置。u 沿路的进度；side 偏离中线多远（正数在下山方向的右手边）。返回脚下的点、朝下山方向时的朝向、下山方向和右手方向
  function spot(u, side = 0) {
    const c = road.at(u), dir = road.dir(u), x = c.x - dir.z * side, z = c.z + dir.x * side;
    return { x, z, y: land.heightAt(x, z), yaw: Math.atan2(dir.x, dir.z) / D, dir, right: V(-dir.z, 0, dir.x) };
  }

  // 一只小蟹这一趟的全部落点。d 是沿中线走过的路程（u × 路长），落点在偏离中线 side 的那条线上
  function planHops({ u0, t0, speed, side, s, lag, treads, every }) {
    const L = road.length, d0 = u0 * L, PER = BEAT * every;
    const lane = d => { const u = clamp(d / L), c = road.at(u), dir = road.dir(u); return [c.x - dir.z * side, c.z + dir.x * side]; };
    const ground = d => land.heightAt(...lane(d));
    // 第 k 次落地在 BEAT_AT - lag + k·PER。名义路程按匀速 speed 推进（只用来估这一趟大概走到哪，好去量那一段路上的台阶）
    const k0 = Math.floor((t0 - BEFORE - BEAT_AT + lag) / PER), k1 = Math.ceil((t0 + AFTER - BEAT_AT + lag) / PER);
    const landAt = k => BEAT_AT - lag + k * PER;
    const nominal = k => clamp(d0 + speed * (landAt(k) + SET * PER / 2 - t0), 0, L);

    // 这一趟要走的路上所有台阶的棱：先粗量找到高度跳变的那一格，再二分到很准
    const lo = Math.max(0, nominal(k0) - 3), hi = Math.min(L, nominal(k1) + 3), edges = [];
    for (let a = lo, ya = ground(a); a < hi; ) {
      const b = Math.min(hi, a + SCAN), yb = ground(b);
      if (Math.abs(ya - yb) > EDGE) {
        let p = a, q = b, yp = ya, yq = yb;
        for (let i = 0; i < 14; i++) { const m = (p + q) / 2, ym = ground(m); if (Math.abs(yp - ym) > Math.abs(ym - yq)) { q = m; yq = ym; } else { p = m; yp = ym; } }
        edges.push((p + q) / 2);
      }
      a = b; ya = yb;
    }
    // 能落脚的区间：两道棱之间的踏面去掉前后的余量；第一道棱之前、最后一道棱之后是平路，整段都能落。
    // 路程 d 是沿中线的三维弧长，陡处比水平距离长；余量按水平距离量，再折回路程
    const stretch = d => { const [xa, za] = lane(d - .25), [xb, zb] = lane(d + .25); return .5 / Math.hypot(xb - xa, zb - za); };   // 这一带每单位水平距离合多少路程
    const spots = [];
    const bounds = [lo - 1e3, ...edges, hi + 1e3];
    for (let i = 0; i + 1 < bounds.length; i++) {
      const a = bounds[i], b = bounds[i + 1];
      const from = i === 0 ? a : a + margin(BACK, (b - a) / stretch(a)) * stretch(a), to = i + 2 === bounds.length ? b : b - margin(FRONT, (b - a) / stretch(b)) * stretch(b);
      if (to > from) spots.push([from, to]);
    }
    // 路程 n 落在第几个落脚区间（夹在两个区间之间的，算离它近的那个）；把 n 挪进第 i 个区间里最近的那一点
    const spotOf = n => {
      let best = 0, gap = Infinity;
      spots.forEach(([a, b], i) => { const g = n < a ? a - n : n > b ? n - b : 0; if (g < gap) { gap = g; best = i; } });
      return best;
    };
    const into = (n, i) => clamp(n, spots[i][0], spots[i][1]);
    // 从落点 d 往前（dir 1）或往回（dir -1）蹦一下落在哪：平路上走 speed × 一蹦的时间；石阶上一蹦最多下 treads 级——
    // 落点一级一级地对着踏面，不会一步跨过好几级（那样看着是在石阶上飞，比平路上快一大截）
    const hopFrom = (d, dir) => {
      const n = clamp(d + dir * speed * PER, 0, L), i = spotOf(d), j = spotOf(n);
      return into(n, dir * (j - i) > treads ? i + dir * treads : j);
    };
    // 落点表：离 t0 最近的那次落地按匀速算该在哪就在哪（一队小蟹各自的节奏错开，彼此的间距也不会乱），
    // 往后一蹦一蹦推出去，往前一蹦一蹦倒回去
    const ka = clamp(Math.round((t0 - SET * PER / 2 - BEAT_AT + lag) / PER), k0, k1), ds = [];
    ds[ka - k0] = into(nominal(ka), spotOf(nominal(ka)));
    for (let k = ka + 1; k <= k1; k++) ds[k - k0] = hopFrom(ds[k - 1 - k0], 1);
    for (let k = ka - 1; k >= k0; k--) ds[k - k0] = hopFrom(ds[k + 1 - k0], -1);
    const lands = ds.map((d, i) => {
      const [x, z] = lane(d), [xa, za] = lane(d - 1.2), [xb, zb] = lane(d + 1.2);
      return { t: landAt(k0 + i), d, x, z, y: land.heightAt(x, z), yaw: Math.atan2(xb - xa, zb - za) / D };
    });
    // 每一蹦的弧线：脚底 = 起落两点连线 + 4h·τ(1-τ)。h 取「好看的高度」和「越过沿途每一道棱所需的高度」里大的那个。
    // 落差大的时候好看的高度压低：下陡坡蹦得平、落得深
    const hops = [];
    for (let i = 0; i + 1 < lands.length; i++) {
      const A = lands[i], B = lands[i + 1], run = Math.hypot(B.x - A.x, B.z - A.z), drop = A.y - B.y;
      // 沿连线取样量路面；两个取样点之间可能正好有一道棱，所以每一点要同时高过自己和左右邻点的路面
      const n = Math.max(2, Math.ceil(run / .03)), floor = Array.from({ length: n + 1 }, (_, j) => land.heightAt(lerp(A.x, B.x, j / n), lerp(A.z, B.z, j / n)));
      let need = 0;
      for (let j = 1; j < n; j++) {
        const k = j / n, bump = 4 * k * (1 - k), top = Math.max(floor[j - 1], floor[j], floor[j + 1]);
        need = Math.max(need, (top + CLEAR * s * Math.min(1, 2 * bump) - lerp(A.y, B.y, k)) / bump);
      }
      const look = HOP * s / (1 + .6 * Math.max(0, drop) / s);
      hops.push({ h: Math.max(look, need), drop, slope: drop / Math.max(run, 1e-3) });
    }
    return { lands, hops, k0 };
  }

  return {
    spot,
    // 一只沿路往下蹦的小蟹。u0：t0 时刻在路的哪里；speed：平路上每秒走多远；side：偏离中线；s：大小；lag：蹦的节奏错开多少秒；
    // treads：石阶上一蹦最多下几级（1 就是一蹦一级；路面坑洼、不是真台阶的地方给 Infinity，不限）；every：几拍一蹦；extra：叠在上面的姿势；
    // until：蹦到这个时刻或之后的第一次落地就站住不再蹦（落地那一下的缓冲照样做完，抵弹簧的 sq 也按站住来算）。不写就一直蹦
    // 返回 poseAt(t)。poseAt.landing(t) 给出 t 时刻或之后第一次落地：{ t, d, x, y, z, yaw }（调用方要在落地时停下来时用）
    walker({ u0, t0, speed = 6, side = 0, s = 1, lag = 0, treads = 1, every = .5, until = Infinity, extra = {} }) {
      const { lands, hops, k0 } = planHops({ u0, t0, speed, side, s, lag, treads, every }), last = hops.length - 1, PER = BEAT * every;
      const halt = clamp(Math.ceil((until + lag - BEAT_AT) / PER - k0 - 1e-9), 0, last + 1);   // 站住的那次落地是第几个落点
      // 前俯的角度：这一蹦的坡度越陡，身体越往前俯。左右歪每蹦换一边（cycle 是第几蹦加上这一蹦的进度，连续变化）
      const bow = i => 10 * clamp(hops[clamp(i, 0, last)].slope / .7);
      const tilt = (cycle, pitch) => ({ pitch, lean: 3 * Math.sin(Math.PI * cycle) });
      const arms = (lift, flare) => { const a = [lerp(-30, 60, lift) + 25 * flare, lerp(.24, .32, lift), .1]; return { aL: a, aR: a }; };
      // t 时刻在第几蹦（i）、这一蹦到了哪（phase：0 落地，SET 起跳，1 下一次落地）。开头之前站在第一个落点上；到了站住的那个落点（不写 until 就是最后一个）做完落地的缓冲就一直站着
      const when = t => { const f = (t + lag - BEAT_AT) / PER - k0, k = Math.floor(f); return k < 0 ? [0, 0] : k >= halt ? [halt, Math.min(f - halt, .999 * SET)] : [k, f - k]; };
      const air = phase => (phase - SET) / (1 - SET);
      // 脚底在哪、身体朝哪：在地上就是落点；在空中沿两个落点的连线走，高度是抛物线，朝向从这一个落点的转到下一个的
      const foot = (i, phase) => {
        const A = lands[i];
        if (phase < SET) return [A.x, A.y, A.z, A.yaw];
        const B = lands[i + 1], tau = air(phase);
        return [lerp(A.x, B.x, tau), lerp(A.y, B.y, tau) + 4 * hops[i].h * tau * (1 - tau), lerp(A.z, B.z, tau), turn(A.yaw, B.yaw, ease(tau))];
      };
      // 想要的压扁拉长：落地压扁（落差越大压得越狠）再弹起来、顺势压一下起跳；空中拉长
      const hit = i => clamp(hops[clamp(i - 1, 0, last)].drop / (1.2 * s));
      const look = (i, phase) => phase < SET ? -(.07 + .05 * hit(i)) * Math.sin(Math.PI * phase / SET) : .1 * Math.sin(Math.PI * air(phase)) * (1.25 - .5 * air(phase));
      // 小蟹身上的弹簧（见 crab.js 的 update、crab/spring.js）：身体落后脚底多少，身子就压扁拉长、往后弯多少；sq 变得快时还会冲过头。
      // 蹦下石阶时脚底上下、前后都动得很快，不管它就会在空中扁成一张饼、落地时整个往前扑。这里把这几根弹簧沿整趟按 1/60 秒走一遍，
      // 每一步反解出该给多少 sq 才能让身高正好是想要的样子，再用前俯的角度抵掉身子前后弯的量（分别抵回 KEEP、NOD 成，留一点弹性）
      const from = lands[0].t, n = Math.ceil((lands[last + 1].t - from) * 60) + 1, sqs = new Float32Array(n), nods = new Float32Array(n), beta = SHAPE[0] / 3600;
      for (let j = 0, body = foot(...when(from)).slice(0, 3), vel = [0, 0, 0], qs = 0, vs = 0; j < n; j++) {
        const [i, phase] = when(from + j / 60), [x, y, z, yaw] = foot(i, phase), want = look(i, phase);
        [x, y, z].forEach((w, k) => { vel[k] += (BODY[0] * (w - body[k]) - BODY[1] * vel[k]) / 60; body[k] += vel[k] / 60; });
        const sag = 1.1 * clamp((body[1] - y) / s, -.55, .55) / BH, next = qs + vs * (1 - SHAPE[1] / 60) / 60 - beta * qs;   // next + beta·sq 是 sq 弹簧这一步之后的位置
        const sq = clamp(lerp(want, ((1 + want) / (1 - sag) - 1 + .6 * next) / (1.6 - .6 * beta), KEEP), -.45, .7);   // 夹在身高 0.55 到 1.7 能表达的范围里
        vs += (SHAPE[0] * (sq - qs) - SHAPE[1] * vs) / 60; qs += vs / 60;
        const ahead = clamp(((body[0] - x) * Math.sin(yaw * D) + (body[2] - z) * Math.cos(yaw * D)) / s, -.55, .55);   // 身子顶上比脚底靠前多少（身体自己的尺寸）
        sqs[j] = sq; nods[j] = -NOD * Math.asin(ahead / BH) / D;
      }
      const table = (list, t) => { const f = clamp((t - from) * 60, 0, n - 1), j = Math.min(n - 2, Math.floor(f)); return lerp(list[j], list[j + 1], f - j); };
      // 在地上：身子从上一蹦的前俯回到下一蹦的；落差大时手甩开、嘴张大
      const grounded = (i, phase) => {
        const c = phase / SET, dip = Math.sin(Math.PI * c), h = hit(i);
        return { ...tilt(i + phase, lerp(1.2 * bow(i - 1), .6 * bow(i), ease(c))), ...arms(.25 * (1 - dip), .8 * h * dip), mouth: .45 + .35 * h * dip, laugh: .4 * h * dip };
      };
      // 在空中：越往下落越往前俯，手举起来
      const flying = (i, phase) => ({ ...tilt(i + phase, bow(i) * lerp(.6, 1.2, air(phase))), ...arms(.25 + .75 * Math.sin(Math.PI * air(phase)), 0), mouth: .45 });
      const poseAt = t => {
        const [i, phase] = when(t), [x, y, z, yaw] = foot(i, phase);
        const p = pose({ x, y, z, s, yaw, sq: table(sqs, t), mood: MOOD.joy }, phase < SET ? grounded(i, phase) : flying(i, phase), extra);
        p.pitch += table(nods, t);                                    // 抵弹簧的前俯加在 extra 之后，调用方给的前俯照样起作用
        return p;
      };
      poseAt.landing = t => { const A = lands[clamp(Math.ceil((t + lag - BEAT_AT) / PER - k0 - 1e-9), 0, lands.length - 1)]; return { t: A.t, d: A.d, x: A.x, y: A.y, z: A.z, yaw: A.yaw }; };
      // t 时刻之前最近的 back + 1 次落地里，往回数第 back 次（0 是最近的一次）：{ t, x, y, z, s 个头, power 这一下落得多重 }。给落地的尘、雪沫、水花用
      poseAt.landed = (t, back = 0) => {
        const i = clamp(Math.floor((t + lag - BEAT_AT) / PER - k0 + 1e-9) - back, 0, lands.length - 1), A = lands[i];
        return { t: A.t, x: A.x, y: A.y, z: A.z, s, power: hit(i) };
      };
      return poseAt;
    },
    // 跟着路摆的机位：站在路上 u 处往下山方向退 back、往右 side、升高 up，看向路上 u + ahead 处离地 eye 高的一点
    view(u, { back = 0, side = 0, up = 2, ahead = .01, eye = 1.4 } = {}) {
      const here = spot(u), there = spot(u + ahead), p = V(here.x, here.y + up, here.z).addScaledVector(here.dir, -back).addScaledVector(here.right, side), q = V(there.x, there.y + eye, there.z);
      return { p: p.toArray(), q: q.toArray(), f: p.distanceTo(q) };
    },
  };
}
