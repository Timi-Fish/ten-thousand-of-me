// 空气：天的底色、落日照亮的空气和霭（着色器代码，拼进 paint.js 的 COMMON，海边所有的材质都带着它）。
// 天和霭用同一套函数：远处的海、远岛、礁石化进去的颜色，正好就是它背后那一片天在海平线上的颜色，所以海天交界没有缝。
//   skyBase：天顶 → 半空 → 天边连续过渡；朝着落日的一侧天边更亮更暖；背着落日的一侧低空有一抹粉紫（地影上方那条带）。
//   亮霭：贴着海平线一条薄薄的亮霭，天从上面落下来、海从下面远上去，都化进这一条里。
//   sunGlow：落日照亮的空气。大片的光钉在海平线上落日那个方位，不跟着落日上下走；只有紧贴日面的一小圈亮晕跟着它（见函数前的说明）。
//            霭里也有这一层，所以落日脚下最远的那一线海是亮的。
//   霭：沿视线积分，越低越浓（贴着海面的空气最厚）；薄的时候先染上半空的紫，浓了才化成天边的颜色。
export const AIR = /* glsl */`
uniform vec3 uZenith, uSkyMid, uHorizon, uHorizonSun, uSkyGlow, uAntiSun, uHazeP, uDiscCol, uGlowIn, uGlowOut, uSunExt;
uniform vec4 uDiscP;
uniform float uDusk;

float towardSun(vec3 rd) { return .5 + .5 * dot(normalize(rd.xz + 1e-5), normalize(uSunDir.xz)); }
// 这个方向偏离落日的方位多少（弧度，带正负）
float sunAzimuth(vec3 rd) { vec2 h = normalize(rd.xz + 1e-6), s = normalize(uSunDir.xz); return atan(h.x * s.y - h.y * s.x, dot(h, s)); }
// 天的底色（不含落日照亮的空气）。y 低于 0 的方向按海平线算
vec3 skyBase(vec3 rd) {
  float y = max(rd.y, 0.), toward = towardSun(rd), t3 = toward * toward * toward, away = 1. - toward;
  vec3 c = mix(uZenith, uSkyMid, exp(-2.7 * y));
  c = mix(c, mix(uHorizon, uHorizonSun, t3 * t3), exp(-y * mix(12., 6.5, t3)));
  float belt = (y - .13) / .09;
  return c + uAntiSun * away * away * exp(-belt * belt);
}
// 贴着海平线的那一条亮霭：颜色是天边的颜色提亮一点，朝落日那边更暖
vec3 horizonBand(vec3 rd) {
  float y = max(rd.y, 0.), toward = towardSun(rd), t2 = toward * toward;
  return mix(uHorizon, uHorizonSun * 1.15, t2 * t2 * t2) * uHazeP.z * exp(-y * 55.);
}
// 光的锚点：海平线上落日那个方位、离海平线 ANCHOR_EL（弧度）高的一个固定方向——落日从它上面一点落到它下面一点。
// 天上大片的光都以它为中心，钉在海平线上：落日往下沉，是沉进这片光里去，光自己不跟着它上下走
const float ANCHOR_EL = .035;
vec3 glowAnchor() { vec2 h = normalize(uSunDir.xz); return normalize(vec3(h.x, ANCHOR_EL, h.y)); }
// 落日照亮的空气。c 是没有落日时这个方向的天色。
// 钉在海平线上的（位置不随日落变，只是越落越红、范围略收）：
//   漫开的一大片暖光（加上去的）→ 光霭：一大圈橘红，横向比纵向宽；贴着海平线的那层空气最厚，所以沿海平线还拉出扁扁的一道 →
//   落日脚下海平线上的一点亮光（海上的光路就接在这里）和它正上方一道很淡的日柱。
// 跟着日面走的只有紧贴它的一圈亮晕：不到一个半径宽，下半边被海平线的霭吃掉。
// 除了第一层，都是把天色「往光的颜色上带」，不是往上加：再近也只到那个颜色为止，所以亮而不白
vec3 sunGlow(vec3 c, vec3 rd) {
  float s = max(dot(rd, glowAnchor()), 0.), s4 = s * s * s * s, s16 = s4 * s4 * s4 * s4;
  c += uSkyGlow * (.3 * s4 * s4 + .5 * s16 * s16);
  float az = sunAzimuth(rd), el = asin(clamp(rd.y, -1., 1.)), reach = 1. - .2 * uDusk;
  float aureole = exp(-length(vec2(az / 1.5, el - ANCHOR_EL)) / (.17 * reach)), river = exp(-abs(az) / (.42 * reach)) * exp(-abs(el) / .034);
  c = mix(c, uGlowOut, uDiscP.z * min(aureole + .7 * river, 1.));
  float foot = exp(-abs(az) / (uDiscP.x * .9 * reach)) * exp(-abs(el) / .014), pillar = exp(-abs(az) / (uDiscP.x * .55)) * exp(-abs(el) / .16);
  c = mix(c, uGlowIn, min(.45 * foot + uDiscP.w * pillar, .8));
  float ang = acos(clamp(dot(rd, uSunDir), -1., 1.));
  return mix(c, uGlowIn, uDiscP.y * exp(-max(ang / uDiscP.x - .95, 0.) / .4) * smoothstep(-.004, .03, el));
}
// 天（不含日面、云、远岛）
vec3 skyGradient(vec3 rd) { return sunGlow(skyBase(rd) + horizonBand(rd), rd); }
// 霭的颜色：这个方向上海平线处的天色。在海平线上和 skyGradient 正好相等
vec3 hazeColor(vec3 rd) { vec3 h = vec3(rd.x, 0., rd.z); return sunGlow(skyBase(h) + horizonBand(h), rd); }

// 沿这段视线霭有多厚：浓度随高度指数变稀，沿视线积分
float hazeDepth(vec3 ro, vec3 rd, float d) {
  float k = uHazeP.y * rd.y, span = abs(k) > 1e-5 ? (1. - exp(clamp(-k * d, -30., 30.))) / k : d;
  return uHazeP.x * exp(-uHazeP.y * max(ro.y, 0.)) * span;
}
// 把一段空气盖到颜色 c 上
vec3 airOver(vec3 c, vec3 ro, vec3 rd, float d) {
  float haze = 1. - exp(-hazeDepth(ro, rd, d));
  vec3 far = hazeColor(rd), tint = mix(mix(uSkyMid, far, .45), far, smoothstep(.25, .85, haze));
  return mix(c, tint, haze);
}
// 雾：所有东西最后都过这一道
vec3 shoreFog(vec3 c, vec3 wp) {
  vec3 v = wp - cameraPosition; float d = length(v);
  return airOver(c, cameraPosition, v / d, d);
}`;
