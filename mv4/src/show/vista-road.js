// 万点灯火走的路：山路是主干，几条从林子里、岔路上汇进来的支流，到了山脚湖边再分成几股散向四方（有几股一直漂到湖心），
// 最大的一股漂过湖、上了南岸的古道，穿过水口一路出山，走进云里。
// 每一条路烘成数据贴图的一行，灯火的位置由着色器按时间去查（vista-glsl.js）；这里同时给出每一盏灯的「走法」，
// 以及按同一套走法在 CPU 上算出的每一帧沿路的疏密（照亮山路的那层光用它，vista-glow.js）。
//
// 一盏灯的一趟：[支流（可以没有）] → 主干从汇入点走到山脚 → [散开的一股]。沿这一趟的里程 q = r0 + v·t（对全程取模），
// r0、v 按「一群一群」给：同一群的灯速度一样、挤在一起，群和群之间有疏有密，还有零零散散的落单的。
import * as THREE from 'three';
import { rnd, clamp, lerp } from '../anim.js';

export const PW = 2048;                                               // 每条路烘成多少个取样点
export const BINS = 512;                                              // 疏密沿每条路分成多少格
const MAIN_HALF = 6.5, BRIDGE_HALF = 1.6, BRIDGE = [[40, 446], [80, 450]];   // 主干上灯火铺开的半宽（漫出路面、漫到两边的坡上）；过桥时收窄到桥面上
// 支流：[从哪里来的几个 (x, z)]，最后汇进主干上离最后一点最近的地方。小屋门前的小径、西坡林子、桥东的岔路、半山的竹林、东坡
const TRIBS = [
  [[-142, 492], [-118, 474], [-92, 452], [-70, 438]],
  [[-196, 292], [-168, 318], [-130, 346], [-98, 366]],
  [[262, 418], [232, 446], [196, 470], [160, 488]],
  [[-12, 588], [26, 600], [62, 616], [96, 622]],
  [[318, 632], [282, 660], [244, 688], [200, 708]],
];
// 散开的几股：从山脚路的尽头出发。前两股沿湖岸往西、往北上坡，后三股漂到湖面上，最后一股绕西岸往南
const FANS = [
  [[-10, 812], [-58, 806], [-120, 794], [-190, 792], [-262, 806]],
  [[-10, 812], [-34, 790], [-74, 760], [-118, 728], [-160, 704]],
  [[-10, 812], [-24, 838], [-58, 884], [-96, 930], [-120, 972]],
  [[-10, 812], [-4, 842], [6, 896], [14, 948], [20, 990]],
  [[-10, 812], [16, 836], [62, 878], [112, 920], [150, 958]],
  [[-10, 812], [-70, 826], [-170, 848], [-236, 884], [-262, 930]],
];
const FAN_SPREAD = [22, 20, 18, 22, 18, 22];                          // 每一股走到头时散开多宽（半宽）
// 出山的那一股：从山脚路的尽头漂过湖，在南岸上了古道（山水给的中线，wild.scene.userData.scenery.sites.exit），穿过水口的牌坊，沿谷往南走进云里。
// 三成多的灯走这一股：灯河不是流进盆地就到头，是穿过人间、出了山口往外去
const CROSSING = [[-10, 812], [-7, 850], [-1, 905], [4, 960], [7, 1020], [8, 1060]], SHORE = 1075, INTO_CLOUD = 1570, EXIT_HALF = [15, 4.2], EXIT_SHARE = .34;   // 过湖的航线；过了这个 z 就上岸；走到这个 z（已经在云里）为止；湖上、古道上各铺多宽
export const ROWS = 1 + TRIBS.length + FANS.length + 1;

// 一个取样点：[x, 中线的地面高, z, 半宽, 左沿、左半、右半、右沿的地面高]。湖面在 y = 0：湖上（floats）地面低于水面的地方浮在水上
const ACROSS = [-1, -.5, .5, 1];
function sample(heightAt, x, z, dx, dz, half, floats = true) {
  const h = Math.hypot(dx, dz), rx = -dz / h, rz = dx / h, y = (a, b) => (floats ? Math.max(0, heightAt(a, b)) : heightAt(a, b)) + .05;
  return [x, y(x, z), z, half, ...ACROSS.map(k => y(x + rx * k * half, z + rz * k * half))];
}
// 把一串 (x, z) 连成平滑的路，按水平里程均匀取 PW 个点；高度贴地。floats(z)：这一处是不是在湖上
function bakeLine(points, heightAt, halfAt, floats = () => true) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
  const len = curve.getLength(), out = [];
  for (let i = 0; i < PW; i++) {
    const k = i / (PW - 1), p = curve.getPointAt(k), d = curve.getTangentAt(k);
    out.push(sample(heightAt, p.x, p.z, d.x, d.z, halfAt(k, p.z), floats(p.z)));
  }
  return { len, pts: out };
}

export function bakeRoutes(wild) {
  const { road, heightAt } = wild, L = road.length;
  // 主干：按路的里程均匀取点（road.at 的 u 就是按里程的）。桥上收窄
  const near = ([x, z]) => { let best = 0, gap = Infinity; for (let i = 0; i <= 4000; i++) { const p = road.at(i / 4000), d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < gap) { gap = d; best = i / 4000; } } return best; };
  const b0 = near(BRIDGE[0]) * L, b1 = near(BRIDGE[1]) * L;
  const halfAtS = s => lerp(MAIN_HALF, BRIDGE_HALF, clamp((s - b0 + 6) / 6) * clamp((b1 + 6 - s) / 6));
  const main = { len: L, pts: [] };
  for (let i = 0; i < PW; i++) {
    const u = i / (PW - 1), p = road.at(u), d = road.dir(u), s = sample(heightAt, p.x, p.z, d.x, d.z, halfAtS(u * L));
    s[1] = p.y;                                                        // 中线上就是路面（石阶一级一级的高）
    main.pts.push(s);
  }
  const tribs = TRIBS.map(list => {
    const join = near(list[list.length - 1]), end = road.at(join);
    return { ...bakeLine([...list, [end.x, end.z]], heightAt, k => lerp(3, MAIN_HALF, k)), join: join * L };
  });
  const way = wild.scene.userData.scenery.sites.exit.filter((p, i) => i % 5 === 0 && p[2] < INTO_CLOUD).map(p => [p[0], p[2]]);   // 古道中线每 20 个单位取一点
  const exit = bakeLine([...CROSSING, ...way], heightAt, (k, z) => lerp(lerp(MAIN_HALF, EXIT_HALF[0], clamp(k * 8)), EXIT_HALF[1], clamp((z - SHORE + 60) / 60)), z => z < SHORE);
  const fans = [...FANS.map((list, f) => bakeLine(list, heightAt, k => lerp(MAIN_HALF, FAN_SPREAD[f], Math.pow(k, .8)))), exit];
  const rows = [main, ...tribs, ...fans];
  // 数据贴图：每行一条路。uPath 存 [x, 中线高, z, 半宽]，uSide 存 [左沿、左半、右半、右沿的地面高]
  const pathData = new Float32Array(PW * ROWS * 4), sideData = new Float32Array(PW * ROWS * 4);
  rows.forEach((row, r) => row.pts.forEach((p, i) => {
    pathData.set(p.slice(0, 4), (r * PW + i) * 4);
    sideData.set(p.slice(4, 8), (r * PW + i) * 4);
  }));
  const tex = data => { const t = new THREE.DataTexture(data, PW, ROWS, THREE.RGBAFormat, THREE.FloatType); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; };
  // 沿某条路 d 远处的点（CPU 上用：机位、照亮的那层网格）
  const pointAt = (r, d) => {
    const row = rows[r], f = clamp(d / row.len) * (PW - 1), i = Math.min(PW - 2, Math.floor(f)), a = row.pts[i], b = row.pts[i + 1];
    return new THREE.Vector3(lerp(a[0], b[0], f - i), lerp(a[1], b[1], f - i), lerp(a[2], b[2], f - i));
  };
  const halfAt = (r, d) => { const row = rows[r], i = Math.round(clamp(d / row.len) * (PW - 1)); return row.pts[i][3]; };
  return { L, rows, tribs, fans, bridge: [b0, b1], pathTex: tex(pathData), sideTex: tex(sideData), pointAt, halfAt };
}

// 一群一群的灯：N 盏，按群排在各条「一趟」上。返回每一盏灯的着色器属性，以及 CPU 上算这一帧沿路疏密的函数
export function planCrowd(routes, N) {
  const { L, tribs, fans } = routes;
  const aRoute = new Float32Array(N * 4), aRun = new Float32Array(N * 4), aLook = new Float32Array(N * 4);
  const fanPick = r => { const w = [...[.22, .2, .11, .13, .12, .22].map(x => x * (1 - EXIT_SHARE)), EXIT_SHARE]; let acc = 0; for (let f = 0; f < w.length; f++) { acc += w[f]; if (r < acc) return f; } return w.length - 1; };   // 最后一股是出山的
  // 路上的「人潮」：一趟里程上的几处特别密的地段（一拨一拨），其余地方稀一些
  const throng = (q, phase) => .1 + .9 * Math.pow(.5 + .5 * Math.sin(q / 205 * 6.2832 + phase), 4) * (.35 + .65 * (.5 + .5 * Math.sin(q / 61 + phase * 2.3)) ** 2);
  let i = 0, k = 0;
  // 支流的灯占三成，其余都从山顶小亭出来
  const share = [.7, ...tribs.map(() => .3 / tribs.length)];
  share.forEach((part, e) => {
    const end = Math.round(i + part * N), trib = e > 0 ? tribs[e - 1] : null, eLen = trib ? trib.len : 0, join = trib ? trib.join : 0;
    while (i < end) {
      // 群的大小：一半的群是一两只落单的，其余几十只到一百多只
      const roll = rnd(k * 3.17 + 1.3), n = Math.min(end - i, roll < .45 ? 1 + Math.floor(rnd(k * 5.1) * 3) : 12 + Math.floor(Math.pow(rnd(k * 7.9), 1.6) * 150));
      const f = fanPick(rnd(k * 2.71 + .4)), xLen = fans[f].len, total = eLen + (L - join) + xLen;
      let q = 0;
      for (let tries = 0; tries < 120; tries++) { q = rnd(k * 9.13 + tries * 1.7) * total; if (rnd(k * 4.4 + tries * 2.3) < throng(q + join, e * 1.9)) break; }
      // 大家走得差不多快：一拨一拨的人潮整片往下挪，过了两分多钟也不会匀成一条线
      const v = 11 + .3 * (rnd(k * 6.7) - .5), spread = 1.2 + .55 * Math.sqrt(n);
      const lane = (rnd(k * 8.3 + .6) * 2 - 1) * .75;                 // 这一群偏在路的哪一侧（按半宽的倍数）
      for (let j = 0; j < n; j++, i++) {
        const g = (rnd(i * 1.37 + .2) + rnd(i * 2.11 + .7) + rnd(i * 3.53 + .1) - 1.5) * 2;   // 近似正态
        aRoute.set([trib ? e : -1, eLen, join, 1 + tribs.length + f], i * 4);
        // 横向：落单的在路中间一带随便走；成群的围着自己那一群的位置聚成一团（横竖两个方向都是中间密、边上稀），
        // 这样散到湖面、岸上那几股宽的路上时，一群是一团，不是横着的一条方块
        const solo = rnd(i * 4.7) * 2 - 1, g2 = (rnd(i * 5.31 + .4) + rnd(i * 6.77 + .9) + rnd(i * 8.19 + .3) - 1.5) * 2;
        const across = n === 1 ? .5 * Math.sign(solo) * Math.abs(solo) ** 1.4 : clamp(lane + .22 * g2, -1, 1);
        aRun.set([xLen, q + g * spread - v * 100, v, across], i * 4);
        aLook.set([.82 + .3 * rnd(i * 5.9), .035 * rnd(i * 6.3), rnd(i * 7.1), rnd(i * 9.7)], i * 4);
      }
      k++;
    }
  });
  // 这一帧沿每条路的疏密：和着色器同一套走法，把每盏灯落进它所在那条路的格子里，再抹匀。
  // 返回的贴图每格：r 灯的多少（盏数），g 这一格正被「蹦起来的波」盖着几成
  const dens = new Float32Array(BINS * ROWS), soft = new Float32Array(BINS * ROWS), texData = new Uint16Array(BINS * ROWS * 4);
  const densTex = new THREE.DataTexture(texData, BINS, ROWS, THREE.RGBAFormat, THREE.HalfFloatType);
  densTex.minFilter = densTex.magFilter = THREE.LinearFilter; densTex.wrapS = densTex.wrapT = THREE.ClampToEdgeWrapping;
  const sums = new Float64Array(BINS + 1);
  function where(n, t) {                                                // 第 n 盏灯 t 时刻在哪条路的多远处：[行, 里程, 从山顶量起的总里程]
    const eLen = aRoute[n * 4 + 1], join = aRoute[n * 4 + 2], xLen = aRun[n * 4], span = L - join, total = eLen + span + xLen;
    let q = (aRun[n * 4 + 1] + aRun[n * 4 + 2] * t) % total; if (q < 0) q += total;
    if (q < eLen) return [aRoute[n * 4], q, join - (eLen - q)];
    if (q < eLen + span) return [0, join + q - eLen, join + q - eLen];
    return [aRoute[n * 4 + 3], q - eLen - span, L + q - eLen - span];
  }
  function density(t, crest) {
    dens.fill(0);
    for (let n = 0; n < N; n++) {
      const [r, d] = where(n, t), f = clamp(d / routes.rows[r].len) * (BINS - 1), b = Math.floor(f);
      dens[r * BINS + b] += 1 - (f - b); if (b + 1 < BINS) dens[r * BINS + b + 1] += f - b;
    }
    // 抹匀的宽度按路上的实际长短算（每一格约合多少单位不同）：沿路抹开二十来个单位，照亮的那层光才不会一道一道的
    for (let r = 0; r < ROWS; r++) {
      const reach = Math.max(2, Math.round(9 / (routes.rows[r].len / BINS)));   // 前后各抹开约 9 个单位
      sums[0] = 0; for (let b = 0; b < BINS; b++) sums[b + 1] = sums[b] + dens[r * BINS + b];
      for (let b = 0; b < BINS; b++) {                                 // 两层不一样宽的平均叠起来，近似一个钟形
        const box = n => { const a = Math.max(0, b - n), c = Math.min(BINS, b + n + 1); return (sums[c] - sums[a]) / (c - a); };
        soft[r * BINS + b] = .5 * box(reach) + .5 * box(reach >> 1);
      }
    }
    for (let r = 0; r < ROWS; r++) {
      const row = routes.rows[r], base = r === 0 ? 0 : r <= tribs.length ? tribs[r - 1].join - row.len : L;
      for (let b = 0; b < BINS; b++) {
        const o = (r * BINS + b) * 4;
        texData[o] = THREE.DataUtils.toHalfFloat(soft[r * BINS + b] * BINS / row.len * 10);   // 每 10 个单位路上有几盏
        texData[o + 1] = THREE.DataUtils.toHalfFloat(crest(base + b / (BINS - 1) * row.len, t));
      }
    }
    densTex.needsUpdate = true;
    return densTex;
  }
  return { N, aRoute, aRun, aLook, where, density, densTex };
}
