// 被子：「月很圆」那一页抻大了，变成一条又宽又软的布被。c 段入睡时在空中抖开、落下来盖在小蟹背上，d 段醒来时从背上滑下去、摊在身后，e 段一直摊在那里。
// 一张细分的网格，每帧按小蟹此刻的身体重新算每个顶点：
//   · 盖着：从身体中心沿每个方向量出「顶面 → 侧面最宽处斜着垂下 → 地上」这条剖面（按 body.js 的近似身体，往外胀开一层厚度），
//     被子上离中心多远，就沿这条剖面走多远（布的长度不变）；垂下去的部分挤出几道顺着垂向的褶，落地处堆起几道小褶，边缘随方向长短不一。
//     被子的前沿停在头顶毫毛和头饰的后面，两角往前包住身体两侧；两手举起时把被子顶起来。
//   · 摊着：平铺在身后的纸面上，几道浅褶，靠近它的那个被角翻起来露出里子。
// 被面是 slips.js 拼图里「月很圆」那一格放大，再叠上细的经纬纹、淡淡的絮和绗缝的斜格（格子之间的絮微微鼓起）；前沿翻折出一道被头；
// 里子是略深的米色；四周一圈靛色滚边。
import * as THREE from 'three';
import { D, TAU, lerp, prog, ease, clamp, rnd } from '../anim.js';
import { atlas, cellRect, KIND, PAPER } from './slips.js';
import { handOf } from './hold.js';

const W = 7.0, L = 5.0, NX = 52, NZ = 44;                              // 被子的宽、长（世界单位），横竖各多少格
const FRONT = -.55, BEND = 1.2, CUFF = .35, ROLL = .05;                // 前沿在身体中心后面多远；两角往前包多少；被头翻折过来多宽、折处卷多粗
const CANVAS = [2048, 1536], STITCH = 340, PUFF = .055;                // 被面贴图多大（像素）；绗缝斜格的间距（像素）；两道针脚之间的絮鼓起多高
const PAD = { side: .17, top: 0 }, DROP = 1.1, ROUND = 2.7;            // 离身体表面留多厚：侧面和背后（含袍子鼓出来的那一截）、头顶；垂下来的部分最陡多陡（往下 DROP 往外 1，像 A 字裙那样张开）；
                                                                       // 身体的圆角按多圆来贴（body.js 的近似偏方，被子照它贴会浮在真正圆润的肩头上面）
const REST = { at: [0, 0, -3.6], yaw: 2, squeeze: .8 };               // 摊在身后时被子中心在哪、转多少度、横向褶起来以后剩几成宽（三段共用）
const SLIDE = 2.0, FLOOR = .025;                                       // 醒来时被子往后滑多远才离开身体；贴着纸面多高（和平躺的薄纸一样）
const K = 96, M = 64, DS = .06;                                        // 剖面：多少个方向、每个方向取多少点、点距
const NV = (NX + 1) * (NZ + 1);
export const FALLEN = 1.3;                                             // 抖开以后多少秒完全落定（之后就是 cover 的样子）
const LINING = new THREE.Color('#E2D3B6'), HEM = new THREE.Color('#4A4E6E');

// 被面：「月很圆」那一格画到一张横的大画布中间（字不变形），两边补上同样的纸色，再叠布纹和絮。三段共用一张
let faceMap = null;
function quiltFace() {
  if (faceMap) return faceMap;
  const sheet = atlas(), [sx, sy, sw, sh] = cellRect(KIND.moon), canvas = document.createElement('canvas'), g = canvas.getContext('2d');
  [canvas.width, canvas.height] = CANVAS;
  const CW = canvas.width, CH = canvas.height, k = CH / sh, cw = sw * k;
  g.fillStyle = PAPER; g.fillRect(0, 0, CW, CH);
  g.drawImage(sheet.image, sx + 2, sy + 2, sw - 4, sh - 4, (CW - cw) / 2, 0, cw, CH);   // 让开格子边上的一线，免得把相邻格子的颜色带进来
  sheet.dispose();
  // 两边补的纸色和格子之间的接缝：用一层很淡的同色晕开盖住
  for (const x of [(CW - cw) / 2, (CW + cw) / 2]) {
    const fade = g.createLinearGradient(x - 60, 0, x + 60, 0);
    fade.addColorStop(0, 'rgba(244, 236, 217, 0)'); fade.addColorStop(.5, 'rgba(244, 236, 217, .9)'); fade.addColorStop(1, 'rgba(244, 236, 217, 0)');
    g.fillStyle = fade; g.fillRect(x - 60, 0, 120, CH);
  }
  for (let i = 0; i < 900; i++) {                                     // 纸的纤维（同 slips.js 的画法，铺满整张）
    const x = CW * rnd2(i * 1.7), y = CH * rnd2(i * 2.9 + 5), a = TAU * rnd2(i * 5.1), len = 20 + 40 * rnd2(i * 3.7);
    g.strokeStyle = `rgba(${150 + 60 * rnd2(i)}, ${130 + 50 * rnd2(i * 2.3)}, 96, .14)`; g.lineWidth = 3;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + len * Math.cos(a), y + len * Math.sin(a)); g.stroke();
  }
  for (let i = 0; i < 260; i++) {                                     // 絮：一团团很淡的亮斑和暗斑
    const x = CW * rnd2(i * 7.3 + 1), y = CH * rnd2(i * 3.1 + 2), r = 30 + 90 * rnd2(i * 9.7), lit = rnd2(i * 4.4) > .45;
    const blot = g.createRadialGradient(x, y, 0, x, y, r);
    blot.addColorStop(0, lit ? 'rgba(255, 252, 240, .16)' : 'rgba(170, 150, 120, .07)'); blot.addColorStop(1, 'rgba(255, 252, 240, 0)');
    g.fillStyle = blot; g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  g.globalCompositeOperation = 'multiply';                           // 整张比案上的宣纸暖一点、厚一点，铺在纸上分得出来
  g.fillStyle = '#FBEBD0'; g.fillRect(0, 0, CW, CH);
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = 'rgba(90, 70, 50, .06)';                              // 经纬纹
  for (let y = 0; y < CH; y += 5) g.fillRect(0, y, CW, 2);
  for (let x = 0; x < CW; x += 5) g.fillRect(x, 0, 2, CH);
  g.strokeStyle = 'rgba(74, 78, 110, .22)'; g.lineWidth = 56; g.strokeRect(28, 28, CW - 56, CH - 56);   // 沿边一道浅靛色的镶边
  g.strokeStyle = 'rgba(74, 78, 110, .34)'; g.lineWidth = 4; g.setLineDash([16, 12]);   // 绗缝的针脚：一圈沿边，再几道斜格
  g.strokeRect(80, 80, CW - 160, CH - 160);
  for (let c = -CH; c < CW; c += STITCH) {
    g.beginPath(); g.moveTo(c, 0); g.lineTo(c + CH, CH); g.stroke();
    g.beginPath(); g.moveTo(c + CH, 0); g.lineTo(c, CH); g.stroke();
  }
  faceMap = new THREE.CanvasTexture(canvas);
  faceMap.colorSpace = THREE.SRGBColorSpace; faceMap.anisotropy = 8;
  return faceMap;
}
const rnd2 = n => rnd(n + 517.3);                                      // 画布上的打散：和别处用到的 rnd 错开种子

// 身体（body.js 的圆角方块，不含头顶那块毫毛和头饰：被子的前沿本来就停在它们后面）往外胀 pad 以后，世界里 (x, z) 这一竖线上最高的那一点有多高；不在身体上方就是 0
function surface(b, pad) {
  const [hx, hy, hz] = b.half, e = Math.min(b.e, ROUND), m = b.inv.elements, ax = hx + pad.side / b.s, ay = hy + pad.top / b.s, az = hz + pad.side / b.s;
  const inside = (x, y, z) => {
    const lx = m[0] * x + m[4] * y + m[8] * z + m[12], ly = m[1] * x + m[5] * y + m[9] * z + m[13], lz = m[2] * x + m[6] * y + m[10] * z + m[14];
    return (Math.abs(lx) / ax) ** e + (Math.abs(ly - hy) / ay) ** e + (Math.abs(lz) / az) ** e < 1;
  };
  const cx = b.at.x, cz = b.at.z, reach = Math.hypot(ax, az) * b.s, top = b.at.y + 1.3 * ay * b.s + .05;
  return (x, z) => {
    if (Math.hypot(x - cx, z - cz) > reach) return 0;
    for (let y = top; y > 0; y -= .05) {
      if (!inside(x, y, z)) continue;
      let lo = y, hi = y + .05;
      for (let n = 0; n < 7; n++) { const mid = (lo + hi) / 2; if (inside(x, mid, z)) lo = mid; else hi = mid; }
      return lo;
    }
    return 0;
  };
}
// 身体此刻的水平朝向：c 中心（世界 x、z），f 脸朝的方向，r 它的右手边
function frameOf(b) {
  const f = new THREE.Vector3(0, 0, 1).transformDirection(b.out).setY(0).normalize();
  return { c: [b.at.x, b.at.z], f: [f.x, f.z], r: [f.z, -f.x] };
}
const restFrame = (() => { const a = REST.yaw * D; return { c: [REST.at[0], REST.at[2]], f: [Math.sin(a), Math.cos(a)], r: [Math.cos(a), -Math.sin(a)] }; })();
const toWorld = (F, x, y, z, out, i) => { out[3 * i] = F.c[0] + F.r[0] * x + F.f[0] * z; out[3 * i + 1] = y; out[3 * i + 2] = F.c[1] + F.r[1] * x + F.f[1] * z; };

// 被子上第 (i, j) 个点在被子自己平面里的位置：X 横向（从它左手边到右手边），Z 前后（0 是被子中心，+ 朝它的脸）
const restX = i => (i / NX - .5) * W, restZ = j => (.5 - j / NZ) * L;

// 盖在身上：slide 是被子往后挪了多远，bend 是两角往前包多少（1 就是盖好的样子）
function drape(b, out, slide = 0, bend = 1) {
  const F = frameOf(b), top = surface(b, PAD), hands = [handOf(b.crab, -1), handOf(b.crab, 1)];
  const height = (x, z) => {
    let h = top(x, z);
    for (const p of hands) { const d2 = (x - p.x) ** 2 + (z - p.z) ** 2; h = Math.max(h, p.y + .16 - 2.5 * d2); }   // 举起来的手把被子顶起来
    return h;
  };
  // 每个方向一条剖面：沿水平方向走 s 远，被子在 h 那么高；A 是走到这里时布已经用了多长
  const prof = Array.from({ length: K }, (_, d) => {
    const a = d / K * TAU, dx = Math.sin(a), dz = Math.cos(a), s = new Float32Array(M), h = new Float32Array(M), A = new Float32Array(M);
    const steep = DROP * lerp(1, 3, clamp(dz * 2 + .2));              // 靠脸的两侧垂得陡一些，不铺到枕边那张留言上
    let foot = M - 1;
    for (let k = 0; k < M; k++) {
      s[k] = k * DS; h[k] = height(F.c[0] + (F.r[0] * dx + F.f[0] * dz) * s[k], F.c[1] + (F.r[1] * dx + F.f[1] * dz) * s[k]);
      if (k) h[k] = Math.max(h[k], h[k - 1] - steep * DS, 0);        // 布垂不了那么陡：出了身体以后斜着往外张开落地
      if (k) A[k] = A[k - 1] + Math.hypot(DS, h[k] - h[k - 1]);
      if (foot === M - 1 && k && h[k] <= 0) foot = k;
    }
    return { s, h, A, foot };
  });
  // 布走了 rho 远时落在剖面的哪里：[水平距离, 高度, 剖面往外的法向（水平分量, 竖直分量）]；落到地上以后按 spread 摊开（朝脸那一侧的两角收在身边，堆起来）
  const along = (p, rho, spread) => {
    const { s, h, A, foot } = p;
    if (rho >= A[foot]) return [s[foot] + (rho - A[foot]) * spread, 0, 0, 1];
    let k = 1;
    while (A[k] < rho) k++;
    const w = (rho - A[k - 1]) / (A[k] - A[k - 1]), len = A[k] - A[k - 1];
    return [lerp(s[k - 1], s[k], w), lerp(h[k - 1], h[k], w), (h[k - 1] - h[k]) / len, DS / len];
  };
  for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) {
    const X = restX(i), u = Math.abs(X) / (W / 2), front = FRONT + bend * BEND * u * u * u - slide, e = j / NZ * L;   // e：离前沿多远（沿着布量）
    // 前沿往背上翻折出一道被头：翻折线在 cuff 处，翻过来的那一条卷过折线、反铺在上面；往两角去越翻越窄，到垂下去的两角就不翻了
    const cuff = CUFF * clamp((.85 - u) / .3), q = cuff - e, roll = Math.min(Math.max(q, 0) / ROLL, Math.PI);
    const Z = q > 0 ? front - cuff + (roll < Math.PI ? ROLL * Math.sin(roll) : -(q - Math.PI * ROLL)) : front - e;
    const rho = Math.hypot(X, Z), a = Math.atan2(X, Z), f = (a / TAU * K + K) % K, d0 = Math.floor(f) % K, w = f - Math.floor(f);
    const spread = lerp(1, .35, clamp(Math.cos(a) * 2.5)) * (.84 + .12 * Math.sin(4 * a + 2) + .06 * Math.sin(9 * a));
    const p0 = along(prof[d0], rho, spread), p1 = along(prof[(d0 + 1) % K], rho, spread);
    const s = lerp(p0[0], p1[0], w), y = lerp(p0[1], p1[1], w), ns = lerp(p0[2], p1[2], w), ny = lerp(p0[3], p1[3], w);
    // 往剖面外面让多少：褶（布比它绕过的那一圈长，多出来的挤成褶——垂下去的部分往外鼓出几道顺着垂向的褶，落地处堆起来）、
    // 绗缝之间鼓起的絮、翻折过来的那一层
    const squeeze = clamp(1 - s / rho, 0, .6), fold = .5 + .5 * Math.sin(8 * a + 1.7 * Math.sin(3 * a + 1) + .9 * rho);
    const off = .5 * squeeze * fold * (ny > .9 ? fold : 1) + PUFF * puff(i, j) + (q > 0 ? ROLL * (1 - Math.cos(roll)) + .02 : 0);
    const r = s + off * ns + (ny > .9 ? .3 * squeeze * (fold - .5) : 0);   // 落地处的褶让边缘一进一出
    toWorld(F, r * Math.sin(a), Math.max(y + off * ny, FLOOR), r * Math.cos(a), out, i + j * (NX + 1));
  }
  return top;
}
// 绗缝的针脚处是 0，两道针脚之间鼓起来是 1（和被面贴图上的斜格对齐）
function puff(i, j) {
  const px = i / NX * CANVAS[0], py = (1 - j / NZ) * CANVAS[1];
  return Math.sqrt(Math.abs(Math.sin(Math.PI * (px - py + CANVAS[1]) / STITCH) * Math.sin(Math.PI * (px + py) / STITCH)));
}
// 摊在身后：几道浅褶，靠近它的右前角翻起来（flip 0 到 1：翻起多少）
function lay(out, flip = 1) {
  const R = .06, LAST = 150 * D, DEEP = 1.25;                         // 卷边的半径、翻过去的角度、被角从多深处折起
  for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) {
    const X = restX(i) + .07 * Math.sin(1.9 * restZ(j) + 1), Z = restZ(j) + .07 * Math.sin(1.4 * restX(i) + 2);   // 四边不是笔直的
    // 横着褶起来的几道软褶（所以宽度只剩 squeeze 那么多），再加一道斜着的长褶
    let x = X, z = Z, y = FLOOR + .1 * (.5 + .5 * Math.sin(5.6 * X + 1.1 * Math.sin(1.3 * Z) + .5)) ** 2 + .08 * Math.exp(-((X + 1.2 - .35 * Z) ** 2) / .06) * clamp(1.2 - Math.abs(Z) / 2) + PUFF * puff(i, j);
    const e = DEEP - ((W / 2 - X) + (L / 2 - Z)) / Math.SQRT2;          // 离折线多远（往被角那边为正）
    if (e > 0 && flip > 0) {
      const end = LAST * flip, th = Math.min(e / R, end), rest = e - R * th;
      const back = R * Math.sin(th) + rest * Math.cos(end), up = R * (1 - Math.cos(th)) + rest * Math.sin(end);
      x = X - (e - back) / Math.SQRT2; z = Z - (e - back) / Math.SQRT2; y += up;
    }
    toWorld(restFrame, x * REST.squeeze, y, z, out, i + j * (NX + 1));
  }
}

export function buildQuilt(group) {
  // 被子的网格：(i, j) 第 i 列（从左到右）第 j 行（从前沿到后沿），正面朝上；贴图的上方在后沿
  const geo = new THREE.BufferGeometry(), pos = new Float32Array(3 * NV), uv = new Float32Array(2 * NV), index = [];
  for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) { const n = i + j * (NX + 1); uv[2 * n] = i / NX; uv[2 * n + 1] = j / NZ; }
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) { const a = i + j * (NX + 1), b = a + 1, c = a + NX + 1, d = c + 1; index.push(a, b, c, b, d, c); }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setIndex(index);
  const mat = new THREE.MeshLambertMaterial({ map: quiltFace(), side: THREE.DoubleSide });
  mat.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      if (!gl_FrontFacing) diffuseColor.rgb = vec3(${LINING.toArray().map(v => v.toFixed(3)).join(', ')});   // 里子`);
  };
  const cloth = new THREE.Mesh(geo, mat);
  // 滚边：沿被子四周一圈细管子，每帧跟着被子的边走
  const RING = 6, HEM_R = .032, rim = [];
  for (let i = 0; i <= NX; i++) rim.push(i);
  for (let j = 1; j <= NZ; j++) rim.push(NX + j * (NX + 1));
  for (let i = NX - 1; i >= 0; i--) rim.push(i + NZ * (NX + 1));
  for (let j = NZ - 1; j >= 1; j--) rim.push(j * (NX + 1));
  const hemGeo = new THREE.BufferGeometry(), hemPos = new Float32Array(3 * rim.length * RING), hemNor = new Float32Array(3 * rim.length * RING), hemIdx = [];
  rim.forEach((_, n) => { const m = (n + 1) % rim.length; for (let r = 0; r < RING; r++) { const a = n * RING + r, b = n * RING + (r + 1) % RING, c = m * RING + r, d = m * RING + (r + 1) % RING; hemIdx.push(a, c, b, b, c, d); } });
  hemGeo.setAttribute('position', new THREE.BufferAttribute(hemPos, 3)); hemGeo.setAttribute('normal', new THREE.BufferAttribute(hemNor, 3)); hemGeo.setIndex(hemIdx);
  const hem = new THREE.Mesh(hemGeo, new THREE.MeshLambertMaterial({ color: HEM }));
  for (const m of [cloth, hem]) { m.castShadow = m.receiveShadow = true; m.frustumCulled = false; m.visible = false; group.add(m); }

  const P = new THREE.Vector3(), T = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3(), Q = new THREE.Vector3();
  function commit() {
    geo.attributes.position.needsUpdate = true; geo.computeVertexNormals();
    const nor = geo.attributes.normal.array;
    rim.forEach((v, n) => {
      const prev = rim[(n + rim.length - 1) % rim.length], next = rim[(n + 1) % rim.length];
      P.fromArray(pos, 3 * v); N.fromArray(nor, 3 * v); T.fromArray(pos, 3 * next).sub(Q.fromArray(pos, 3 * prev)).normalize(); B.crossVectors(T, N).normalize();
      for (let r = 0; r < RING; r++) {
        const a = r / RING * TAU, o = 3 * (n * RING + r);
        Q.copy(N).multiplyScalar(Math.cos(a)).addScaledVector(B, Math.sin(a));
        hemNor[o] = Q.x; hemNor[o + 1] = Q.y; hemNor[o + 2] = Q.z;
        hemPos[o] = P.x + N.x * .02 + HEM_R * Q.x; hemPos[o + 1] = Math.max(P.y + N.y * .02 + HEM_R * Q.y, .002); hemPos[o + 2] = P.z + N.z * .02 + HEM_R * Q.z;
      }
    });
    hemGeo.attributes.position.needsUpdate = hemGeo.attributes.normal.needsUpdate = true;
    cloth.visible = hem.visible = true;
  }
  // 过渡中的被子不能穿进身体、不能陷进纸面：低于（胀开以后的）身体顶面的点抬到顶面上
  function keepOut(top) {
    for (let n = 0; n < NV; n++) pos[3 * n + 1] = Math.max(pos[3 * n + 1], top(pos[3 * n], pos[3 * n + 2]), FLOOR);
  }
  const tmp = new Float32Array(3 * NV), flat = new Float32Array(3 * NV);

  return {
    hide() { cloth.visible = hem.visible = false; },
    // 盖在身上（睡着时、醒来伸懒腰时都是这个样子：b 是 hold.js 的 bodyNow）
    cover(b) { drape(b, pos); commit(); },
    // 抖开、落下：t0 时刻纸在 from（世界坐标）变成一小团被子，0.3 秒里展开变大、飘到背的上方，然后从中间往外一圈圈落到身上，
    // 落下时中间先鼓一下气再服帖，边缘晚一点落地。FALLEN 秒以后和 cover 完全一样
    fall(b, t, from, t0) {
      const u = t - t0, top = drape(b, tmp), F = frameOf(b), grow = lerp(.22, 1, ease.out(prog(u, 0, .32)));
      const lift = top(F.c[0], F.c[1]) + .9, mid = FRONT - L / 2 + .35;   // 在空中时被子中心有多高、在身体中心后面多远
      const to = [F.c[0] + F.f[0] * mid, lift, F.c[1] + F.f[1] * mid], k = ease.io(prog(u, 0, .38));
      const c = [0, 1, 2].map(n => lerp(from[n], to[n], k) + (n === 1 ? .3 * Math.sin(Math.PI * k) : 0));
      const billow = .3 * Math.sin(Math.PI * prog(u, .4, 1.2));
      for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) {
        const n = i + j * (NX + 1), X = restX(i) * grow, Z = (restZ(j)) * grow, r = Math.hypot(restX(i), FRONT - j / NZ * L) / Math.hypot(W / 2, FRONT - L);
        // 抖开的那一下：一道波从前往后传过去；后沿高、前沿低（被面朝着它的前上方张开）；四边往下坠
        const ripple = (.16 * Math.sin(2.5 * j / NZ * Math.PI - 14 * u) + .06 * Math.sin(3 * i / NX * Math.PI + 9 * u)) * (1 - prog(u, .2, .7)) - .25 * Z - .5 * r * r;
        const land = ease.in(prog(u, .3 + .3 * r, .55 + .35 * r)), o = 3 * n;
        const ax = c[0] + F.r[0] * X + F.f[0] * Z, ay = c[1] + ripple * grow, az = c[2] + F.r[1] * X + F.f[1] * Z;
        pos[o] = lerp(ax, tmp[o], land); pos[o + 2] = lerp(az, tmp[o + 2], land);
        pos[o + 1] = lerp(ay, tmp[o + 1], land) + billow * Math.max(0, 1 - r * 1.8) * land;   // 落到背上的那一片先鼓一下气
      }
      keepOut(top); commit();
    },
    // 从背上往后滑下去：k 从 0（盖着）到 1（摊平在身后，和 rest 完全一样）
    slide(b, k) {
      const top = drape(b, tmp, SLIDE * ease.io(prog(k, 0, .8)), 1 - .7 * k), w = ease.io(prog(k, .4, 1));
      lay(flat, prog(k, .6, 1));
      for (let n = 0; n < 3 * NV; n++) pos[n] = lerp(tmp[n], flat[n], w);
      for (let n = 0; n < NV; n++) pos[3 * n + 1] += .25 * Math.sin(Math.PI * w) * (1 - n / NV);   // 前沿滑下来的时候被风兜起来一点
      keepOut(top); commit();
    },
    // 摊在身后（d 段醒来以后、e 段，同一个样子）
    rest() { lay(pos); commit(); },
  };
}
