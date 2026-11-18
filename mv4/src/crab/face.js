// 表情：五官直接画在身体正面的皮肤上（按没变形时的坐标画，所以身体怎么压怎么鼓，脸都跟着走）。
// 每种眼神、嘴型是一个「离边缘多远」的算式，换表情时在两个算式之间过渡，中途先眯一下。
import { clamp } from '../anim.js';
import { FACE, MOOD } from './pose.js';

const SWITCH = .18;                                             // 换一种眼神要多久（秒）
const CAN_BLINK = [MOOD.open, MOOD.wow, MOOD.star];             // 这几种眼神是睁着的，眨眼才看得出来
const BROW = [[0, 0], [0, 0], [0, 0], [1, 1], [-.25, 1], [0, 0]];   // 每种眼神（按 MOOD 的编号）自带的眉毛：[八字(-) / 倒八字(+), 显不显]

export const FACE_GLSL = /* glsl */`
uniform vec4 uEye;      // [从哪种眼神, 换到哪种, 换到哪了, 睁开多少]
uniform vec4 uGaze;     // [视线 x, 视线 y, 单眨, 时间]
uniform vec4 uMouth;    // [张开, 噘, 猫嘴, 大笑]
uniform vec4 uFace;     // [眉形, 腮红, 眉毛显不显, 眉毛抬多高]
const vec3 INK = vec3(0.105, 0.04, 0.035), CHESTNUT = vec3(0.5, 0.17, 0.06), GOLD = vec3(1.0, 0.72, 0.2), GUM = vec3(0.3, 0.045, 0.04), TONGUE = vec3(1.0, 0.36, 0.33);

float sdSeg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)); }
float sdOval(vec2 p, vec2 r) { float k0 = length(p / r), k1 = length(p / (r * r)); return k0 * (k0 - 1.0) / max(k1, 1e-4); }
// 一段朝上拱的圆弧（∩）：span 半张角，r 半径
float sdArc(vec2 p, float span, float r) { p.x = abs(p.x); vec2 sc = vec2(sin(span), cos(span)); return sc.y * p.x > sc.x * p.y ? length(p - sc * r) : abs(length(p) - r); }
float sdStar(vec2 p, float r, float rf) {
  const vec2 k1 = vec2(0.809016994375, -0.587785252292), k2 = vec2(-0.809016994375, -0.587785252292);
  p.x = abs(p.x); p -= 2.0 * max(dot(k1, p), 0.0) * k1; p -= 2.0 * max(dot(k2, p), 0.0) * k2;
  p.x = abs(p.x); p.y -= r;
  vec2 ba = rf * vec2(-k1.y, k1.x) - vec2(0.0, 1.0);
  float h = clamp(dot(p, ba) / dot(ba, ba), 0.0, r);
  return length(p - ba * h) * sign(p.y * ba.x - p.x * ba.y);
}
float starShape(vec2 p) { float a = 0.18 * sin(uGaze.w * 5.0); p = mat2(cos(a), -sin(a), sin(a), cos(a)) * p; return sdStar(p / (1.0 + 0.07 * sin(uGaze.w * 9.0)), 0.165, 0.5) - 0.012; }
// 眼睛的墨线：q 是以眼睛为中心的坐标，x 朝脸的外侧为正
float eyeInk(float kind, vec2 q) {
  if (kind < 0.5) return sdOval(q, vec2(0.092, 0.185));                                          // 睁眼：竖着的椭圆
  if (kind < 1.5) return sdArc(q + vec2(0.0, 0.055), 1.3, 0.118) - 0.033;                        // 笑眼 ^^
  if (kind < 2.5) return sdArc(vec2(q.x, 0.06 - q.y), 1.3, 0.118) - 0.03;                        // 闭眼 ‿‿
  if (kind < 3.5) return min(sdSeg(q, vec2(0.095, 0.095), vec2(-0.085, 0.0)), sdSeg(q, vec2(0.095, -0.095), vec2(-0.085, 0.0))) - 0.03;   // 挤眼 ><
  if (kind < 4.5) return abs(length(q) - 0.135) - 0.021;                                         // 吃惊：一个圆圈，瞳仁另画
  return abs(starShape(q)) - 0.02;                                                               // 星星眼：星形的边
}
float kindWeight(float kind) { return (abs(uEye.x - kind) < 0.5 ? 1.0 - uEye.z : 0.0) + (abs(uEye.y - kind) < 0.5 ? uEye.z : 0.0); }
float fill(float d, float aa) { return 1.0 - smoothstep(-aa, aa, d); }

vec3 paintEye(vec3 col, vec2 p, float side, float aa) {
  float open = max(0.1, uEye.w * (1.0 - clamp(uGaze.z * side, 0.0, 1.0)));
  vec2 m = vec2(p.x * side, p.y), q = vec2(m.x, (m.y + (1.0 - open) * (2.2 * m.x * m.x - 0.012)) / open);     // 眯起来：竖向压扁成一条微微下弯的线
  float d = mix(eyeInk(uEye.x, q), eyeInk(uEye.y, q), uEye.z) * mix(open, 1.0, 0.35);
  float wOpen = kindWeight(0.0), wWow = kindWeight(4.0), wStar = kindWeight(5.0), wide = smoothstep(0.2, 0.5, open);   // 眼睛半睁时高光还在：没有高光的半睁眼像两个黑洞
  vec2 look = uGaze.xy * vec2(side, 1.0);
  col = mix(col, vec3(1.0), wWow * fill(length(q) - 0.135, aa));                                  // 吃惊：眼白
  col = mix(col, INK, wWow * fill(length(q - look * 0.05) - 0.058, aa));                          //       缩小的瞳仁
  float star = starShape(q);
  col = mix(col, mix(GOLD, vec3(1.0, 0.93, 0.6), smoothstep(0.02, -0.1, star)), wStar * fill(star, aa));   // 星星眼：金色的星，心是亮的
  col = mix(col, INK, fill(d, aa));
  float inEye = wOpen * fill(sdOval(q, vec2(0.092, 0.185)) + 0.012, aa);
  col = mix(col, CHESTNUT, inEye * 0.8 * smoothstep(0.03, -0.17, q.y));                           // 睁眼：瞳仁下半透出一点栗色
  vec2 g = p - uGaze.xy * vec2(0.012, 0.01);                                                       // 高光不镜像：两只眼的光都从画面左上来
  col = mix(col, vec3(1.3), inEye * wide * fill(length(g - vec2(-0.03, 0.078)) - 0.043, aa));    // 比白还亮一点：在暗处眼神也是亮的
  col = mix(col, vec3(1.2), inEye * wide * 0.9 * fill(length(g - vec2(0.036, -0.082)) - 0.019, aa));
  col = mix(col, vec3(1.0), wWow * wide * fill(length(p - uGaze.xy * 0.05 - vec2(-0.02, 0.022)) - 0.018, aa));
  // 星星眼旁边一闪一闪的小十字
  vec2 tw = p - vec2(0.2 * side, 0.2);
  float cross4 = pow(abs(tw.x), 0.6) + pow(abs(tw.y), 0.6) - pow(0.05 * (0.6 + 0.4 * sin(uGaze.w * 11.0 + side)), 0.6);
  col = mix(col, vec3(1.0, 0.95, 0.75), wStar * fill(cross4 * 0.2, aa));
  // 眉毛：一小截短粗的线
  vec2 b = m - vec2(0.0, 0.285 + uFace.w);
  float brow = sdSeg(b, vec2(-0.075, -0.04 * uFace.x), vec2(0.075, 0.04 * uFace.x)) - 0.021;
  return mix(col, INK, uFace.z * fill(brow, aa));
}

vec3 paintMouth(vec3 col, vec2 q, float aa) {
  float m = uMouth.x, pk = uMouth.y, lg = uMouth.w;
  // 闭着：一道上扬的弧；猫嘴是两道小弧并排
  float smile = sdArc(vec2(q.x, 0.085 - q.y), 0.82, 0.1) - 0.018;
  float cat = sdArc(vec2(abs(q.x) - 0.054, 0.04 - q.y), 1.25, 0.054) - 0.0165;
  float shut = mix(smile, cat, uMouth.z);
  // 张开：上沿平、下沿圆的半月；噘嘴时收成一个小圆；大笑时咧宽
  float w = mix(mix(0.1, 0.168, lg), 0.05, pk);
  float lower = mix(mix(0.014 + 0.115 * m, 0.03 + 0.16 * m, lg), 0.036 + 0.035 * m, pk), upper = mix(lower * mix(0.42, 0.2, lg), lower, pk);
  vec2 o = vec2(q.x, q.y - 0.022 + upper - 2.0 * (1.0 - pk) * q.x * q.x);                           // 嘴角往上翘
  float gap = sdOval(o, vec2(w, o.y > 0.0 ? upper : lower));
  float t = max(smoothstep(0.03, 0.12, m), pk);
  float inside = t * fill(gap, aa);
  col = mix(col, GUM, inside);
  vec2 tg = o - vec2(0.0, -lower * 0.78);
  col = mix(col, TONGUE, inside * smoothstep(0.045, 0.07, lower) * fill(sdOval(tg, vec2(w * 0.66, lower * 0.62)), aa));   // 舌头
  return mix(col, INK, fill(mix(shut, abs(gap) - 0.014, t), aa));
}

// 在皮肤的底色上画脸。at：没变形时的身体坐标
vec3 paintFace(vec3 col, vec3 at) {
  float aa = max(0.75 * (fwidth(at.x) + fwidth(at.y)), 1e-4);          // 不许是 0：身体侧面正好和视线平行时两个方向都不变，柔边的两头重合，算出来的不是数，会把整帧染黑
  if (at.z < 0.2 || at.y < 0.5) return col;
  float side = at.x < 0.0 ? -1.0 : 1.0;
  // 腮红：一团柔和的粉，上面三道小斜线
  vec2 c = vec2(abs(at.x) - ${FACE.cheekX}, at.y - ${FACE.cheekY});
  float soft = 1.0 - smoothstep(0.35, 1.0, length(c / vec2(0.17, 0.105)));
  col = mix(col, vec3(1.0, 0.36, 0.34), 0.5 * uFace.y * soft);
  float hx = c.x - 0.05 * clamp(floor(c.x / 0.05 + 0.5), -1.0, 1.0);
  col = mix(col, vec3(0.93, 0.2, 0.2), 0.5 * uFace.y * fill(sdSeg(vec2(hx, c.y), vec2(-0.012, -0.03), vec2(0.012, 0.03)) - 0.0085, aa));
  vec2 eye = vec2(at.x - side * ${FACE.eyeX} - uGaze.x * 0.03, at.y - ${FACE.eyeY} - uGaze.y * 0.022);
  col = paintEye(col, eye, side, aa);
  return paintMouth(col, vec2(at.x - uGaze.x * 0.012, at.y - ${FACE.mouthY}), aa);
}`;

// 这一刻的脸：p 当前姿势，dyn 是弹簧那边回看历史得到的东西（眼神从哪种换来、换了多久、抹平过的嘴型），结果写进 u
export function express(u, p, dyn, t) {
  const mood = Math.round(p.mood), k = clamp(dyn.moodAge / SWITCH), squint = 1 - .9 * Math.sin(Math.PI * k) * (dyn.moodFrom === mood ? 0 : 1);
  const mid = clamp((k - .35) / .3), open = (CAN_BLINK.includes(mood) ? 1 - clamp(p.blink) : 1) * squint;
  u.uEye.set(dyn.moodFrom, mood, mid * mid * (3 - 2 * mid), open);
  const s = dyn.face, [bx, by] = s.brow ? [s.brow, Math.min(1, Math.abs(s.brow) * 3)] : BROW[mood];
  u.uGaze.set(clamp(s.look[0], -1, 1), clamp(s.look[1], -1, 1), p.wink, t);
  u.uMouth.set(clamp(s.mouth), clamp(s.pucker), clamp(s.cat), clamp(s.laugh));
  u.uFace.set(bx, s.blush, by, mood === MOOD.wow ? .03 : 0);
}
