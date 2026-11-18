// 万点灯火的走法（着色器）：每一盏灯在 t 时刻的位置全在顶点着色器里按时间算。走法和 vista-road.js 的 planCrowd 是同一套：
// 一趟的里程 q = r0 + v·t，查数据贴图得到脚下的点；半拍一蹦（落地踩在拍点和半拍上），蹦多高看「蹦起来的波」此刻盖没盖到它；
// 最后一遍副歌里还能在半空聚成一个字、再炸开朝镜头四散（form）。
import { BEAT, BEAT_AT } from './beat.js';
import { PW } from './vista-road.js';

// 蹦起来的波：每隔两拍从山顶的小亭出发一道，沿路往下传。speed 每秒传多远，width 一道波盖住多长一段路
export const WAVE = { speed: 300, gap: 300 * 2 * BEAT, width: 46 };
export function crest(g, t) {
  const y = (g - WAVE.speed * (t - BEAT_AT)) / WAVE.gap, d = (y - Math.floor(y + .5)) * WAVE.gap;
  return Math.exp(-d * d / (WAVE.width * WAVE.width));
}
export const CRAB_H = 2;                                              // 小蟹的身高（外景里约 2 个单位，相当于一个行人）

// 叠加上去的光隔着空气要淡多少（远霭、低雾、云气三层的透过率）。要拼在山水的 COMMON 后面
export const AIR_PASS = /* glsl */`
float airPass(vec3 wp) {
  vec3 v = wp - cameraPosition; float d = max(length(v), 1e-3); vec3 rd = v / d, ro = cameraPosition;
  float open = .5 * (outsideBowl(ro.xz) + outsideBowl(wp.xz));
  return exp(-hazeDepth(ro, rd, d) - .8 * mistDepth(ro, rd, d) - valeDepth(ro, rd, d) * mix(uVale.w, 1., open));
}`;

export const MOTION = /* glsl */`
#define PW ${PW.toFixed(1)}
#define BEAT ${BEAT.toFixed(6)}
#define BEAT_AT ${BEAT_AT.toFixed(6)}
#define CRAB_H ${CRAB_H.toFixed(2)}
uniform sampler2D uPath, uSide;
uniform float uClock, uMainLen;
uniform vec3 uWave;
uniform vec4 uHole;           // 这个球里不画（真的小蟹在那里）：xyz 球心，w 半径
uniform vec4 uForm;           // 化光成字：x 亮起来的时刻，y 炸开的时刻，z 一点光冲到镜头要多久，w 1 开 / 0 关
uniform vec4 uBurstFrom, uBurstTo;     // 炸开：从哪（字的中心，w 字高）、冲向哪（镜头的位置，w 掠过镜头时散开多宽）
attribute vec4 aRoute;        // 从哪条支流来（-1 从山顶来）、支流多长、在主干哪里汇入、散向哪一股
attribute vec4 aRun;          // 那一股多长、t = 0 时的里程、速度、在路面上偏左偏右（-1 到 1）
attribute vec4 aLook;         // 大小、蹦的节奏错开多少秒、两个随机数
attribute vec3 aGlyph;        // 聚字时它站在字的哪一点

void pathAt(float row, float d, float len, out vec4 c, out vec4 side) {
  float f = clamp(d / len, 0., 1.) * (PW - 1.), i = min(floor(f), PW - 2.), k = f - i;
  ivec2 a = ivec2(int(i), int(row)), b = ivec2(int(i) + 1, int(row));
  c = mix(texelFetch(uPath, a, 0), texelFetch(uPath, b, 0), k);
  side = mix(texelFetch(uSide, a, 0), texelFetch(uSide, b, 0), k);
}
// 横着偏 lat（-1 到 1）处的地面高：中线、半宽处、边沿五个点之间按直线连
float acrossAt(float lat, float mid, vec4 side) {
  float a = abs(lat);
  vec2 s = lat < 0. ? side.yx : side.zw;
  return a < .5 ? mix(mid, s.x, a * 2.) : mix(s.x, s.y, a * 2. - 1.);
}
struct Walk { vec3 foot; vec3 dir; float g; float edge; float wet; vec2 at; };
// 沿这一趟走到 t 时刻在哪：脚下的点、走的方向、从山顶量起的总里程、在一趟的头尾（刚出来、快走完）淡进淡出、是不是漂在水上
Walk walkAt(float t) {
  float eL = aRoute.y, js = aRoute.z, span = uMainLen - js, xL = aRun.x, total = eL + span + xL;
  float q = mod(aRun.y + aRun.z * t, total), row, d, len, g;
  if (q < eL) { row = aRoute.x; d = q; len = eL; g = js - (eL - q); }
  else if (q < eL + span) { row = 0.; d = js + q - eL; len = uMainLen; g = d; }
  else { row = aRoute.w; d = q - eL - span; len = xL; g = uMainLen + d; }
  vec4 c, a, b, side, s2;
  pathAt(row, d, len, c, side); pathAt(row, d - 1.2, len, a, s2); pathAt(row, d + 1.2, len, b, s2);
  vec3 dir = vec3(b.x - a.x, 0., b.z - a.z) + vec3(1e-4, 0., 0.);
  dir = normalize(dir);
  float lat = aRun.w;
  vec3 foot = vec3(c.x, 0., c.z) + vec3(-dir.z, 0., dir.x) * lat * c.w;
  foot.y = acrossAt(lat, c.y, side);
  Walk w; w.foot = foot; w.dir = dir; w.g = g; w.at = vec2(clamp(d / len, 0., 1.), row);
  w.edge = smoothstep(0., 10., q) * smoothstep(total, total - 40., q);
  w.wet = 1. - smoothstep(.15, .8, abs(foot.y));                      // 只有贴着湖面（y = 0）的才是漂在水上；出山的谷底比湖面低，那里是走在地上
  return w;
}
float crestAt(float g, float t) {
  float y = (g - uWave.x * (t - BEAT_AT)) / uWave.y, d = (y - floor(y + .5)) * uWave.y;
  return exp(-d * d / (uWave.z * uWave.z));
}
struct Lamp { vec3 foot; vec3 lamp; vec3 dir; float crest; float edge; float squash; float stretch; float wet; float form; float burst; vec2 at; };
// 一盏灯 t 时刻的样子：脚下、头顶那点灯火、走的方向、波、压扁拉长
Lamp lampAt(float t) {
  Walk w = walkAt(t);
  float h = CRAB_H * aLook.x, cr = crestAt(w.g, t);
  float ph = fract((t - BEAT_AT + aLook.y) / (BEAT * .5)), air = clamp((ph - .2) / .8, 0., 1.);
  float hop = 4. * air * (1. - air) * h * (.24 + .85 * cr) * (1. - w.wet);
  Lamp l;
  l.squash = ph < .2 ? sin(3.14159 * ph / .2) * (.6 + .8 * cr) : 0.;
  l.stretch = sin(3.14159 * air) * (1. - w.wet);
  l.foot = w.foot + vec3(0., hop + w.wet * .2 * sin(t * 2.1 + aLook.w * 40.), 0.);
  float sway = sin(t * 3.3 + aLook.z * 30.) * .12 * h;
  l.lamp = l.foot + vec3(w.dir.z * sway, h * (1.22 - .12 * l.squash) + .15 * h * l.stretch, -w.dir.x * sway);
  l.dir = w.dir; l.crest = cr; l.edge = w.edge; l.wet = w.wet; l.form = 0.; l.burst = 0.; l.at = w.at;
  if (uForm.w > .5) {
    // 纸拼成的字化成光：到了那一拍（错开不到 0.2 秒）在字上自己的那一点亮起来，轻轻浮动；
    // 然后整个字炸开：每一点光从自己那一点出发，朝四面八方散着冲向镜头（字心先动，外圈跟上），从镜头的上下左右各处掠过去——
    // 画面上是以字为中心朝四周放射的一道道光，越近越快
    float r0 = aLook.w, r1 = aLook.z, lit = uForm.x + .16 * r1;
    float k = smoothstep(lit + .02, lit + .16, t);                    // 纸先亮起来、缩没了，光点接着在原处亮起
    vec3 p = aGlyph + vec3(sin(t * 3.1 + r0 * 50.), cos(t * 2.7 + r1 * 40.), sin(t * 2.3 + r0 * 20.)) * .45;
    vec3 off = aGlyph - uBurstFrom.xyz, back = normalize(uBurstTo.xyz - uBurstFrom.xyz);
    off -= back * dot(off, back);                                     // 这一点在字面里离字心多远、在哪个方向
    float reach = length(off), turn = (fract(r0 * 7.31 + r1 * 3.17) - .5) * 1.5, cs = cos(turn), sn = sin(turn);
    vec3 out1 = reach > .01 ? off / reach : normalize(cross(back, vec3(0., 1., 0.))), out2 = cross(back, out1);
    vec3 fan = out1 * cs + out2 * sn;                                 // 它散开的方向：大致背着字心，各自再偏一点
    float u = clamp((t - uForm.y - .1 * r0 - .14 * clamp(reach / (.6 * uBurstFrom.w), 0., 1.)) / uForm.z, 0., 1.35);
    float wide = pow(fract(r1 * 5.77 + r0 * 2.3), 1.6);              // 这一点散得多开：多数贴着视线直冲过来（字心不会空成一个圈），少数远远地甩到画面边上
    vec3 pass = uBurstTo.xyz + back * 30. + fan * uBurstTo.w * wide;  // 它从镜头身边哪里掠过去（已经在镜头身后）
    vec3 burst = mix(aGlyph, pass, u * u * (.55 + .45 * u)) + fan * 9. * wide * smoothstep(0., .3, u);       // 先往外一绽，再越来越快地冲过来
    l.lamp = mix(p, burst, smoothstep(0., .08, u));
    l.edge = k * (1. - smoothstep(1.05, 1.35, u));
    l.form = k; l.burst = u;
  }
  return l;
}`;
