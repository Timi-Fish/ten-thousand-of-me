// 落日：日面、挡在它前面的两道横云、很淡的几道光柱（着色器代码，拼进 sky.js 的 SKY_GLSL；光晕在 air.js 的 sunGlow 里，因为霭也要用）。
// 日面是一张平的、亮度均匀的盘，不是一个球：盘面上没有从中心到边缘的明暗，没有亮点，边缘清楚（只在最外面一小圈里柔一下）。
//   颜色——只按离海平线多近变：隔着的空气越厚，蓝绿被削得越多，所以上缘金黄、下缘深橘红，整体越落越红；最底下化进海平线的亮霭里。
//   形状——大气折射把贴近海平线的东西抬高，越低抬得越多，所以日面下半边略被压扁；空气一层一层冷热不匀，
//           最贴近海平线的那一段边缘被错开一两个像素，慢慢在晃。沉到海平线以下的部分被海挡住。
//   发光的感觉来自日面外面的光（air.js），不来自日面里面的明暗。
// 横云：远在天边的两道又长又薄的云带，不跟着落日走——落日是从它们后面沉下去的。上缘虚、下缘齐，两头收尖。
//   云身背着光，是蒙着霭的紫灰；薄的边被从后面打透，离落日越近越亮；挡在日面前面的那一段不是黑的，是日面的光透过来剩下的深红。
// 光柱：以光的锚点（air.js）为中心、角度固定的几道宽而虚的淡光，是天的一部分：不转动，不跟着落日往下走，落日越低越淡。
export const SUN_GLSL = /* glsl */`
uniform vec3 uRayCol;
const vec3 THROUGH = vec3(.46, .2, .12);    // 日面的光透过横云最厚的地方，红、绿、蓝各剩几成

// 大气折射：在 el 这个高度看到的东西，其实在多高（越贴近海平线被抬得越多）
float unbend(float el) { return el - .011 * exp(-max(el, 0.) / .03); }

// 日面。az：偏离落日的方位多少；el：离海平线多高（弧度）。cover：这个像素在不在日面里
vec3 sunDisc(float az, float el, out float cover) {
  float es = asin(uSunDir.y);
  // 一层一层冷热不匀的空气把这一行日面上下错开一点；只在最贴近海平线的地方看得出来
  float y = el + exp(-max(el, 0.) / .03) * ((noise1(vec2(el * 240., uTime * .3)) - .5) * .004 + (noise1(vec2(el * 620. + 7., uTime * .45 + az * 14.)) - .5) * .0015);
  vec2 q = vec2(az * cos(el), unbend(y) - unbend(es)) / uDiscP.x;                         // 日面上的坐标：边上是 1，q.y 朝上
  cover = smoothstep(1., .95, length(q));
  return uDiscCol * exp(-(exp(-max(el, 0.) / .045) - exp(-es / .045)) * uSunExt);          // 霭：比日心低的地方更红，高的地方更黄
}

// 一道横云的浓度。B：多高、厚薄、中心偏离落日的方位多少、半长（都是弧度）
float cloudBar(float az, float el, vec4 B, float seed) {
  float u = (az - B.z) / B.w, taper = 1. - u * u;
  if (taper <= 0.) return 0.;
  float off = el - B.x - .008 * (noise1(vec2(az * 5. + seed, seed)) - .5) - .0024 * (noise1(vec2(az * 44. + seed * 7., seed * 3.)) - .5);
  float lump = noise1(vec2(az * 22. + seed * 3. + uTime * .01, seed * 1.7)), wisp = noise1(vec2(az * 75. - uTime * .015 + seed, el * 210. + seed));
  float thick = B.y * pow(taper, .7) * (.5 + .9 * lump) * (.3 + .7 * smoothstep(.12, .42, noise1(vec2(az * 8. + seed * 5., seed * 2.3))));   // 有几处薄下去、几乎断开
  float d = off > 0. ? smoothstep(thick * (1.1 + 1.1 * wisp), thick * .15, off) : smoothstep(thick * .8, thick * .25, -off);
  return d * (.68 + .32 * noise1(vec2(az * 33. + seed * 9. + uTime * .008, el * 95.)));                                                      // 云身有厚有薄
}
// 高的一道细，开始时横在日面上缘，落日沉下去就从它底下露出来；低的一道贴着海平线，开始时在日面下沿底下，落日往下沉就滑到它后面去
float sunBars(float az, float el) {
  return max(cloudBar(az, el, vec4(.084, .0045, .05, .30), 1.3), cloudBar(az, el, vec4(.014, .0045, -.12, .38), 4.7));
}
// 把横云盖到 c 上（c 是它后面的天，日面也在里面）。ang：离落日多远；cover：这个像素在不在日面里
vec3 barsOver(vec3 c, vec3 rd, float az, float el, float ang, float cover) {
  float d = sunBars(az, el);
  if (d <= 0.) return c;
  float near = exp(-ang / .14);
  vec3 body = mix(uHiShade * .75, hazeColor(rd), .45) + uHiLit * .12;                      // 背光的云身，远在天边所以蒙着霭
  c = mix(c * mix(vec3(1.), THROUGH, d), body, d * .8 * (1. - cover) * (1. - .5 * near));  // 离落日近的地方、日面前面：主要是透过来的光
  return c + uHiRim * (d * (1. - d) * (1. - d) * 6.75 * near * .9 * (1. - .7 * cover));    // 薄边被打透
}

// 光柱。返回 x：rd 这个方向在光柱里还是在两道光柱之间的暗缝里（0 到 1）；y：离锚点多近（光柱整体的衰减）
vec2 rayFan(vec3 rd) {
  vec3 hub = glowAnchor();
  float s = dot(rd, hub);
  if (s < .7) return vec2(0.);
  vec3 e1 = normalize(cross(hub, vec3(0., 1., 0.))), e2 = cross(e1, hub);
  vec2 around = normalize(vec2(dot(rd, e1), dot(rd, e2)) + 1e-5);
  // 贴图取得粗（只留大的浓淡）：几道宽而虚的光柱里夹着几道窄一些的，都不是一根根细线；再大的一层浓淡让有的一带光柱密、有的一带疏
  float veil = textureLod(uCloud, around * .3 + vec2(.41, .17), 3.).b * .75 + textureLod(uCloud, around * .8 + vec2(.73, .58), 1.8).b * .25;
  float bunch = smoothstep(.3, .6, textureLod(uCloud, around * .11 + vec2(.17, .83), 4.).b), ang = acos(min(s, 1.));
  return vec2(mix(.2, 1., smoothstep(.38, .66, veil) * (.45 + .55 * bunch)), exp(-ang / .25) * smoothstep(.7, .9, s) * smoothstep(1.6, 3.2, ang / uDiscP.x));
}`;
