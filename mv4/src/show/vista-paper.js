// 一万张纸回故乡：几千张薄纸真的在这片山水的空间里飞。纸片参加深度测试、过山水的雾：绕到山后的被山挡住，钻进云海的被云吃掉，
// 远处的隔着霭淡下去、小成细点，近处的看得清上面的字画。
// 每一张都是一张写了字、画了画的薄纸：会朝一个方向卷（纸不能拉伸，弯成一段圆弧），被风抖出小波浪；朝着日月的那面亮，背着的那面只有天光；
// 日月在纸的另一面时光透过来——偏暖，墨迹是暗的反字，纸厚的地方暗一点、薄的地方亮一点；贴到镜头跟前的那几张淡掉，不糊在镜头上。
// 两种飞法：
//   stream 一条纸的河：从镜头身边流出去，荡开一道弯流向山，并上一条悬在山外面、一圈一圈往下盘的螺旋；绕到山体背后的被山挡住，从山的一侧没进去、另一侧钻出来。
//          是一群各飞各的纸（中间密、边上散），大小和疏密从镜头身边到山上连续地变；镜头身边流过去的那几张看得清字画
//   glyph 一股股纸流从四面八方拧着弯汇过来，按笔画的先后一张张贴到位，拼成一个「我」字；到了拍点一张张亮起来、化成光点（光由 vista-lights.js 接着画）
// 一切按时刻现算，同一个 t 永远是同一群纸。
import * as THREE from 'three';
import { D, rnd, TAU, lerp, clamp } from '../anim.js';
import { COMMON, U } from '../wild/paint.js';
import { atlas, SLIP, PAPER, kindOf } from './slips.js';

export const PAPERS = 9000;                                            // 一群最多几张
const CORNER = .045;                                                   // 纸角圆多少（纸自己的尺寸里）

const VERT = /* glsl */`
#include <common>
${COMMON}
attribute vec4 aPaper;        // 种类、卷多少（曲率，正负是朝哪一面拱）、亮起来几成（化成光）、随机数
attribute vec3 aBend;         // 朝纸面里哪个方向卷（弧度，0 横着卷、π/2 竖着卷）、被风抖出的波浪多高、显出几成（贴到镜头跟前的淡掉）
varying vec2 vUv, vLocal; varying vec3 vWp, vN, vOwn;
void main() {
  float kind = floor(aPaper.x + .5);
  vUv = (vec2(mod(kind, 4.), 3. - floor(kind / 4.)) + uv) / 4.; vLocal = uv;
  // 沿纸面里的 dir 弯成一段圆弧，弧长不变；上面再叠一道顺着纸面跑的小波浪
  vec2 dir = vec2(cos(aBend.x), sin(aBend.x)), side = vec2(-dir.y, dir.x);
  float s = dot(position.xy, dir), w = dot(position.xy, side), th = aPaper.y * s;
  float sn = abs(th) < .02 ? 1. - th * th / 6. : sin(th) / th, cs = abs(th) < .02 ? .5 * th : (1. - cos(th)) / th;
  float wave = s * 6.5 + uTime * (7. + 5. * aPaper.w) + aPaper.w * 40., tilt = th + aBend.y * 6.5 * cos(wave);
  vec3 p = vec3(dir * (s * sn) + side * w, s * cs + aBend.y * sin(wave));
  mat4 M = modelMatrix * instanceMatrix;
  vec4 wp = M * vec4(p, 1.);
  vWp = wp.xyz; vN = normalize(mat3(M) * vec3(-dir * sin(tilt), cos(tilt))); vOwn = vec3(aPaper.z, aBend.z, aPaper.w);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const FRAG = /* glsl */`
#include <common>
${COMMON}
uniform sampler2D uMap;
uniform vec4 uPaperLight;     // 天光、日光、透光、整体再乘
uniform vec3 uPaperLamp;      // 山下的灯火从底下托上来的暖光
varying vec2 vUv, vLocal; varying vec3 vWp, vN, vOwn;
const vec3 PAPER = vec3(${new THREE.Color(PAPER).toArray().map(v => v.toFixed(3)).join(', ')});
void main() {
  // 四个角略圆
  float corner = length(max((abs(vLocal - .5) - .5) * vec2(${SLIP.w.toFixed(2)}, ${SLIP.h.toFixed(2)}) + ${CORNER}, 0.));
  float alpha = vOwn.y * (1. - smoothstep(${CORNER} - fwidth(corner), ${CORNER}, corner));
  if (alpha < .02) discard;
  // pass：这一处透过多少光（墨迹挡光，彩墨把光染上色）。纸小的时候细笔画会淡成一片灰，把墨色压重一点，远一些也看得出纸上有字
  vec3 pass = pow(clamp(texture2D(uMap, vUv, -.8).rgb / PAPER, 0., 1.), vec3(1.7)), ink = PAPER * pass;
  vec3 albedo = gl_FrontFacing ? ink : PAPER * mix(vec3(1.), pass, .3);     // 背面只透出淡淡的字影
  vec3 n = normalize(vN) * (gl_FrontFacing ? 1. : -1.), view = normalize(vWp - cameraPosition);
  // 手抄的纸有厚有薄：纤维一团一团的，透光时看得出来
  vec2 f = vLocal * vec2(4., 6.) + vOwn.z * 61.;
  float fibre = .65 * noise1(f) + .35 * noise1(f * 3.7 + 9.);
  float nl = dot(n, uSunDir), lit = smoothstep(-.15, .75, nl), back = smoothstep(.05, .85, -nl), toward = max(dot(view, uSunDir), 0.);
  vec3 c = albedo * (mix(uGndCol, uSkyCol, .8 + .2 * n.y) * uPaperLight.x + uSunCol * uPaperLight.y * lit);   // 纸在半空，地面的反光只托上来一点
  // 透光：日月在纸的另一面时，光穿过纸透过来；迎着日月看（逆光）时最亮——这时不管纸朝哪边都被照得发亮，纸边再勾一道亮
  float t3 = toward * toward * toward;
  c += PAPER * (.12 + .88 * pass) * uSunCol * vec3(1., .9, .74) * (uPaperLight.z * (back * (.3 + .9 * t3) + .5 * t3 * toward) * (.7 + .6 * fibre));
  c += uSunCol * (pow(1. - abs(dot(n, view)), 3.) * toward * toward * uPaperLight.z * .35);
  c += albedo * uPaperLamp * (.6 - .4 * n.y);
  c = wildFog(c * uPaperLight.w, vWp);
  c = mix(c, vec3(1., .74, .42) * (1. + .3 * vOwn.x), vOwn.x * .75);       // 化成光：一张张亮起来
  gl_FragColor = vec4(c, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const shared = new WeakMap();
function prepare(wild) {
  if (shared.has(wild)) return shared.get(wild);
  const geo = new THREE.PlaneGeometry(SLIP.w, SLIP.h, 4, 8), own = new THREE.InstancedBufferAttribute(new Float32Array(PAPERS * 4), 4), bend = new THREE.InstancedBufferAttribute(new Float32Array(PAPERS * 3), 3);
  geo.setAttribute('aPaper', own); geo.setAttribute('aBend', bend);
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide, alphaToCoverage: true,
    uniforms: { ...U, uMap: { value: atlas() }, uPaperLight: { value: new THREE.Vector4() }, uPaperLamp: { value: new THREE.Vector3() } } });
  const it = { geo, own, bend, mat };
  shared.set(wild, it);
  return it;
}

const euler = new THREE.Euler(0, 0, 0, 'YXZ'), quat = new THREE.Quaternion(), m4 = new THREE.Matrix4(), at3 = new THREE.Vector3(), size3 = new THREE.Vector3();
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), UP = V(0, 1, 0);
const smooth = k => k * k * (3 - 2 * k), ramp = (x, a, b) => smooth(clamp((x - a) / (b - a)));
// 一张纸在空中怎么翻（俯仰的度数；-90 是平躺）：翻跟头的、平着滑的（一头翘起一头落下地晃）、迎着风扇的。[占几成, 俯仰]
const WAYS = [
  [.38, (s, t) => 360 * (s.spin * t + s.ph)],
  [.36, (s, t, flap) => -72 + 30 * flap],
  [.26, (s, t, flap) => -24 + 42 * flap],
];
const wayOf = r => WAYS.find(([share]) => (r -= share) < 0)[1];

export function paperFlock(kit, group, { count }) {
  if (count > PAPERS) throw new Error(`一群纸最多 ${PAPERS} 张`);
  const { geo, own, bend, mat } = prepare(kit.wild);
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.frustumCulled = false; mesh.renderOrder = 12; group.add(mesh);
  const seeds = Array.from({ length: count }, (_, i) => {
    const r = Math.sqrt(rnd(i * 2.17 + .3)), a = TAU * rnd(i * 3.71 + .9);
    return { b: r * Math.cos(a), c: r * Math.sin(a), kind: kindOf(i), pitch: wayOf(rnd(i * 5.3) * .999), spin: (.5 + 1.1 * rnd(i * 6.1)) * (rnd(i * 7.7) < .5 ? -1 : 1), ph: rnd(i * 8.9), size: .8 + .4 * rnd(i * 9.4),
      arch: (.35 + 1.1 * rnd(i * 1.3)) * (rnd(i * 4.7) < .5 ? -1 : 1), roll: TAU / 4 + 1.1 * (rnd(i * 3.1) - .5), shake: .008 + .022 * rnd(i * 2.9), loose: rnd(i * 7.3) < .12 ? 2.2 + 1.3 * rnd(i * 8.1) : 1 };   // loose：流成河时，一成多的纸离河心远两三倍（散兵）
  });
  // 一张纸飞着时的样子：大致顺着飞的方向（heading 度），一边翻一边晃；卷的深浅跟着扇动一松一紧
  const flying = (s, t, heading) => {
    const flap = Math.sin(t * (5 + 3 * s.ph) + s.ph * 30);
    return { rot: [s.pitch(s, t, flap), heading + 50 * Math.sin(t * 1.3 + s.ph * 20), 30 * Math.sin(t * 2.1 + s.ph * 17)], curl: s.arch * (.6 + .4 * Math.sin(t * (2.6 + 2 * s.ph) + s.ph * 50)) + .45 * flap };
  };
  // curl 卷多少，glow 亮起来几成，show 显出几成
  const put = (i, at, rot, size, s, curl, glow, show) => {
    mesh.setMatrixAt(i, m4.compose(at3.copy(at), quat.setFromEuler(euler.set(rot[0] * D, rot[1] * D, rot[2] * D)), size3.setScalar(size)));
    own.setXYZW(i, s.kind, curl, glow, s.ph); bend.setXYZ(i, s.roll, s.shake, show);
  };
  const done = (light, lamp) => { mat.uniforms.uPaperLight.value.set(...light); mat.uniforms.uPaperLamp.value.set(...lamp); mesh.instanceMatrix.needsUpdate = own.needsUpdate = bend.needsUpdate = true; group.visible = true; };
  const NEAR = [6, 14];                                                 // 离镜头这么近以内的纸淡掉（从 14 淡到 6）

  // 流成一条河的时候，每张纸在河道的哪一段（0 到 1）：按「一团一团」挑，疏密跟着整条河一起往前流（看得出纸在往哪边流）
  const lineSeeds = seeds.map((s, i) => {
    let u = 0;
    for (let k = 0; k < 60; k++) { u = rnd(i * 4.13 + k * 1.91); if (rnd(i * 6.7 + k * 2.3) < .22 + .78 * Math.pow(.5 + .5 * Math.sin(TAU * 31 * u + 1.1), 2)) break; }
    return u;
  });
  const STEP = 6, REACH = 420, SPARSE = .5;                            // 河道上每隔多远记一个点；找山体时从轴心往外最远量到哪（再远就量到别的山上去了）；镜头身边那一段的纸是山上的几成密
  return {
    hide() { group.visible = false; },                                // 这一段里不拍纸群的镜头：整组藏起来（每帧开头总调度会把它重新打开）
    // 一条纸河的河道。分三截，是一条连着的线，纸的大小和疏密一路连续地变（近大远小，近疏远密），中间没有哪里突然跳一下：
    //   镜头身边——从镜头身后贴着镜头的一侧流出去，只有几张，大，看得清字画；
    //   半路——不直直地冲着山去（顺着视线看一条河，只看得见一团），而是先往外荡开一个弯（sweep），再折回来，在画面里是一道看得出长短的弧；
    //   山上——在山的侧边并上一条螺旋，绕到山后被山挡住，从另一侧转出来、从山前横过去，一圈比一圈低，最后没进云海。
    // 螺旋不贴在山皮上：离山体留 clear 远、走一个抹圆了的圈，和山之间看得见空当，是悬在山外面绕的一圈纸，不是山腰上画的一道白线。
    // 山有多宽是量出来的（每个方位、每个高度上从外往里找到山体）。谁挡谁全凭和山体比深度。
    // cfg：eye 镜头位置，look 镜头看向的点；axis 山的轴心 [x, z]；top、bottom 螺旋最上、最下一圈的高度；turns 盘几圈；hand 绕的方向（1 从 +x 朝 +z，-1 反过来）；
    // join 河在螺旋的哪里并上去：过了离镜头最近的那一点之后多少度（90 是山的侧边：并上去就绕到山后，再从山的另一侧转出来）；
    // clear 离山体多远；near 河从镜头旁边多远流过、drop 比镜头低多少；sweep 半路往外荡开多远
    course({ eye, look, axis, top, bottom, turns, hand, join, clear, near, drop, sweep }) {
      const ground = kit.wild.heightAt, e = V(...eye), fwd = V(...look).sub(e).normalize(), right = fwd.clone().cross(UP).normalize();
      const rock = (a, y) => { let r = REACH; while (r > 0 && ground(axis[0] + r * Math.cos(a), axis[1] + r * Math.sin(a)) < y) r -= 4; return r; };
      const n = Math.ceil(turns * 90), a0 = Math.atan2(e.z - axis[1], e.x - axis[0]) + hand * join * D, at = j => [a0 + hand * j * 4 * D, lerp(top, bottom, j / n)];
      let radius = Array.from({ length: n + 1 }, (_, j) => rock(at(j)[0], at(j)[1] - 10) + clear);
      const window = (list, half, pick) => list.map((_, j) => pick(list.slice(Math.max(0, j - half), j + half + 1)));
      radius = window(radius, 4, part => Math.max(...part));           // 先取附近最宽的（凸出来的岩角不会戳进纸里），再抹匀几遍：圈是圆顺的，不跟着山的每一道沟拐
      for (let pass = 0; pass < 4; pass++) radius = window(radius, 9, part => part.reduce((a, b) => a + b) / part.length);
      const spiral = radius.map((r, j) => { const [a, y] = at(j); return V(axis[0] + r * Math.cos(a), y, axis[1] + r * Math.sin(a)); });
      // 河：从镜头身后出发，贴着镜头的一侧流出去，往那一侧荡开一个弯，再顺着螺旋开头的方向并上去（merge 是并上去之前对准的那一点）
      const heading = spiral[1].clone().sub(spiral[0]).normalize(), merge = spiral[0].clone().addScaledVector(heading, -230), side = Math.sign(merge.clone().sub(e).dot(right));
      const river = new THREE.CubicBezierCurve3(
        e.clone().addScaledVector(fwd, -40).addScaledVector(right, side * near * .8).addScaledVector(UP, -drop * .6),
        e.clone().addScaledVector(fwd, 150).addScaledVector(right, side * (near * 1.5 + .35 * sweep)).addScaledVector(UP, -drop * 1.8),   // 镜头身边那一截还在画面里（不一出来就荡到画外去）
        merge.clone().addScaledVector(right, side * 1.3 * sweep), spiral[0]).getSpacedPoints(60);                                          // 弯主要荡在后半程
      const whole = new THREE.CatmullRomCurve3([...river.slice(0, -1), ...spiral], false, 'centripetal');
      whole.arcLengthDivisions = 3000;                                 // 河道很长，量得细一点，记下来的点才间隔均匀
      const length = whole.getLength(), points = whole.getSpacedPoints(Math.round(length / STEP)), cells = points.length - 1, step = length / cells;
      // 一路上的疏密：镜头身边疏（纸大，几张就够），顺着河一路慢慢密起来，上了山最密。同样多的纸流过每一处，所以疏的地方流得快、密的地方流得慢。
      // spot[k]：从源头数起第 k / cells 成的纸在河道的第几个点上（带小数）
      const riverLength = new THREE.CatmullRomCurve3(river).getLength(), dense = d => lerp(SPARSE, 1, ramp(d, .12 * riverLength, riverLength + 100));
      const upTo = [0];
      for (let j = 0; j < cells; j++) upTo.push(upTo[j] + dense((j + .5) * step));
      const spot = new Float32Array(cells + 1);
      for (let k = 0, j = 0; k <= cells; k++) { const m = k / cells * upTo[cells]; while (j < cells - 1 && upTo[j + 1] < m) j++; spot[k] = j + (m - upTo[j]) / (upTo[j + 1] - upTo[j]); }
      return { points, length, step, spot, mass: upTo[cells] * step, river: riverLength };
    },
    // 纸顺着河道流，流到头的回到源头再来。整条河是一群各飞各的纸，不是一根带子：
    //   截面是一团（镜头身边圆滚滚的，上了山略扁、竖着），中间密、边上疏，另有一成多的纸散在外圈当散兵（loose），河的边缘是毛的；
    //   整条河被风吹得一路缓缓地摆（wander），一团一团有疏有密。
    // cfg：eye 镜头位置；speed 在山上每秒流多远（镜头身边疏，流得快）；width [镜头身边, 山上] 多宽，thick 上了山以后这一团的厚薄（宽的几成）；wander 整条河左右上下摆多远；
    // size [近处, 远处] 纸多大，在离镜头 grow [从, 到] 之间过渡（远处放大，隔着霭还看得出是一张张纸）；light [天光, 日光, 透光, 整体]，lamp 灯火托上来的暖光 [红, 绿, 蓝]
    stream(t, course, cfg) {
      const eye = V(...cfg.eye), { points, length, step, spot } = course, cells = points.length - 1, c = V(), ahead = V(), out = V();
      for (let i = 0; i < count; i++) {
        const s = seeds[i], share = (lineSeeds[i] + cfg.speed * (.94 + .12 * s.ph) * t / course.mass) % 1 * cells, k = Math.min(Math.floor(share), cells - 1);
        const f = Math.min(lerp(spot[k], spot[k + 1], share - k), cells - .001), j = Math.floor(f), d = f * step;
        c.lerpVectors(points[j], points[j + 1], f - j); ahead.subVectors(points[j + 1], points[j]).normalize(); out.set(ahead.z, 0, -ahead.x).normalize();
        const landed = ramp(d, 60, course.river), w = lerp(cfg.width[0], cfg.width[1], landed) * (.7 + .3 * Math.sin(d / 70 + .3 * t)) * s.loose, thick = lerp(1, cfg.thick, landed);
        const twist = TAU / 4 + .6 * Math.sin(d / 90 + .7 * t), cw = Math.cos(twist), sw = Math.sin(twist), sway = cfg.wander * ramp(d, 40, 260);
        c.addScaledVector(out, (s.b * cw - s.c * thick * sw) * w + sway * Math.sin(d / 140 + .45 * t)).addScaledVector(UP, (s.b * sw + s.c * thick * cw) * w + .5 * sway * Math.cos(d / 95 - .3 * t) + 2 * Math.sin(t * 1.7 + s.ph * 40));
        const gap = c.distanceTo(eye), { rot, curl } = flying(s, t, Math.atan2(ahead.x, ahead.z) / D);
        put(i, c, rot, lerp(cfg.size[0], cfg.size[1], ramp(gap, ...cfg.grow)) * s.size, s, curl, 0, ramp(gap, ...NEAR) * ramp(d, 0, 30) * (1 - ramp(d, length - 90, length)));
      }
      done(cfg.light, cfg.lamp);
    },
    // 拼字的计划：points、uv 是字上的点和它在字形画布里的位置（vista-lights.js 的 glyphPoints）；center 字心，normal 字面朝着哪（单位向量，指向看字的人）；
    // arrive [最早, 最晚] 贴到位的时刻（按笔画先后：字形画布里从左上到右下）；flight [最短, 最长] 一张飞多久；light 那一拍化成光的时刻；
    // streams 一股股纸流：{ from 源头 [往右, 往上, 往字背后]（从字心量，以看字的人为准）, swirl 一路绕着拧过多少度, width 这一股多宽, sway 被风吹得左右摆多远, count 这一股只要这么几张 }。
    // 不写 count 的那几股把其余的纸分掉：把字顺着笔画先后的方向切成一条条，每一股写一条（哪一股写哪一条，按它来的方向排）——
    // 这样每一股从头到尾一直有纸落下，是一条长流；落点顺着那一条从左上写到右下，纸流一直到跟前才散开
    planGlyph({ points, uv, center, normal, arrive, flight, light, streams }) {
      const yaw = Math.atan2(normal.x, normal.z) / D, pitch = -Math.asin(clamp(normal.y, -1, 1)) / D;
      const fwd = normal.clone().negate(), right = fwd.clone().cross(UP).normalize(), up = right.clone().cross(fwd).normalize();
      const ALONG = [.55, .45], ACROSS = [.45, -.55];                  // 字形画布里：笔画先后的方向（左上到右下）、和它垂直的方向（左下到右上）
      const flows = streams.map(({ from: [r, u, d], swirl, width, sway, count }) => ({ radius: Math.hypot(r, u), angle: Math.atan2(u, r), depth: d, swirl: swirl * D, width, sway, count,
        // 流线朝哪一点收拢：写一条的那几股直接朝纸自己在字上的那一点；只有几张的那几股先朝字心，后半程才散向各自的那一点
        aim: count ? (to, k) => center.clone().lerp(to, ramp(k, .5, 1)) : to => to.clone() }));
      const few = flows.flatMap(f => f.count ? Array(f.count).fill(f) : []);
      const side = f => ACROSS[0] * Math.cos(f.angle + f.swirl) - ACROSS[1] * Math.sin(f.angle + f.swirl);   // 这一股最后从字的哪一侧来（左下小、右上大；画布的纵轴朝下）
      const lanes = flows.filter(f => !f.count).sort((a, b) => side(a) - side(b));
      const queue = seeds.map((_, i) => i).slice(few.length).sort((a, b) => ACROSS[0] * (uv[a * 2] - uv[b * 2]) + ACROSS[1] * (uv[a * 2 + 1] - uv[b * 2 + 1]));
      const flowOf = [...few];
      queue.forEach((i, rank) => { flowOf[i] = lanes[Math.floor(rank * lanes.length / queue.length)]; });
      const plan = seeds.map((s, i) => {
        const order = clamp(ALONG[0] * uv[i * 2] + ALONG[1] * uv[i * 2 + 1] + .12 * (rnd(i * 3.3) - .5));
        return { to: V().fromArray(points, i * 3), land: lerp(arrive[0], arrive[1], order), fly: lerp(flight[0], flight[1], rnd(i * 5.9)), flow: flowOf[i], lit: light + .16 * rnd(i * 6.6),
          rest: [pitch + 10 * (rnd(i * 2.2) - .5), yaw + 14 * (rnd(i * 3.9) - .5), 30 * (rnd(i * 5.1) - .5)] };
      });
      // 这张纸飞了 k 成（0 在源头，1 贴到字上；负的在更上游，顺着同一条流线飞过来）时在哪：这一股是一条被风吹得左右摆的绸带，一边拧着弯一边收拢、越近越窄，到位时收成一点
      plan.along = (g, s, k) => {
        const f = g.flow, e = k < 0 ? 1.3 * k : 1 - (1 - Math.min(k, 1)) ** 1.3, out = 1 - e, a = f.angle + f.swirl * e, twist = f.angle * 3 + 4 * e, w = f.width * (.45 + .55 * out) * (1 - ramp(k, .75, 1));
        const lat = (s.b * Math.cos(twist) - s.c * .4 * Math.sin(twist)) * w + f.sway * out * Math.sin(7.5 * e + f.angle * 5), deep = (s.b * Math.sin(twist) + s.c * .4 * Math.cos(twist)) * w, rad = f.radius * out;
        return f.aim(g.to, k).addScaledVector(right, Math.cos(a) * rad - Math.sin(a) * lat).addScaledVector(up, Math.sin(a) * rad + Math.cos(a) * lat).addScaledVector(fwd, f.depth * out + deep);
      };
      return plan;
    },
    // cfg：eye 镜头位置；size [贴在字上, 飞在近处, 飞在远处] 纸多大（飞着时在离镜头 grow [从, 到] 之间过渡）；light、lamp 同 orbit
    glyph(t, plan, cfg) {
      const eye = V(...cfg.eye);
      for (let i = 0; i < count; i++) {
        const s = seeds[i], g = plan[i], k = (t - (g.land - g.fly)) / g.fly;
        if (t > g.lit + .14) { mesh.setMatrixAt(i, m4.makeScale(0, 0, 0)); continue; }   // 化成光以后纸就没了
        const at = plan.along(g, s, k), ahead = plan.along(g, s, k + .01).sub(at), gap = at.distanceTo(eye);
        const settle = ramp(k, .82, 1), air = flying(s, t, Math.atan2(ahead.x, ahead.z) / D);
        const wave = Math.sin(t * 4 + s.ph * 20) * 8 * (1 - .6 * settle);  // 贴到位以后还在轻轻扇
        const rot = [lerp(air.rot[0], g.rest[0] + wave, settle), lerp(air.rot[1], g.rest[1], settle), lerp(air.rot[2], g.rest[2], settle)];
        const glow = ramp(t, g.lit - .1, g.lit), shrink = 1 - ramp(t, g.lit, g.lit + .14);
        // 飞在半空时大一点（远处也看得出是一张张纸），贴到位时收成字上的一片
        const size = lerp(lerp(cfg.size[1], cfg.size[2], ramp(gap, ...cfg.grow)), cfg.size[0], settle) * s.size * shrink;
        put(i, at, rot, size, s, lerp(air.curl, .12 * Math.sin(t * 3 + s.ph * 9), settle), glow, ramp(gap, ...NEAR));
      }
      done(cfg.light, cfg.lamp);
    },
  };
}
