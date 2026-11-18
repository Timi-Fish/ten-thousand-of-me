// 空气：天的底色、雾、和「山挡没挡住光」。这一段着色器代码拼在 paint.js 的 COMMON 里，外景所有的材质都带着它，
// 所以天、云海、水、山、树用的是同一套空气——远山淡进去的颜色正好就是它背后那片天的颜色。
//
// 天的底色（skyBase）：从天顶到半空到天边连续过渡，没有分界线；朝着日月的那一侧天边更亮更暖、亮的那一带也更高；
//   背着日月的那一侧在低空有一抹淡淡的回光（黄昏时东边天上的粉紫）。日月周围另有一大团被照亮的空气（sunWash）。
// 雾分三层，都沿视线积分：
//   远霭——到处都有，越高越稀；远处额外加浓一些，把一重重山的层次拉开。
//   云气——浮在云海面上的一层：远山的山脚化在里面，山头露在外面，一重山和下一重山之间就隔着一道白。
//   低雾——贴着湖面和山脚，随高度很快变稀；里面有缓缓流动的丝缕；朝着日月看过去更亮。
// 光柱：视线上的空气只有照得到日月的那几段才发亮。山挡住光的地方按「山影的顶」（shade.js 预先算好的贴图）一查就知道，
//   所以清晨和黄昏，光从山脊的缺口里一道一道漏出来。
// 云缝里的光柱（rayFan）：从一个方向沿着弧往日月那边看几处，天在哪里被高空云挡住、哪里敞开——
//   敞开的那几条线上漏下光来，一道道从日月那里散开；云在动，光柱跟着转、跟着明暗。天上、远山前的霭里、云海上空的霭里都叠这一层。
// 日月周围那团光（sunWash）随时间轻轻一明一暗，像有薄云从日月跟前飘过。
// 高空云的平面分布（hiColumn）也放在这里：天上画云、地上落云影、湖里映云、云缝的光柱，四处查的是同一片云。
// 云团自己也在长、在消：两层慢慢错动的浓淡推着云团的边进进出出，不只是整片平移。
export const AIR = /* glsl */`
uniform sampler2D uCloudMap, uShadeTop, uShadeFar;
uniform vec3 uSkyGlow, uAntiSun, uRayCol;
uniform vec4 uAirP, uVale, uHiP, uHiQ, uLightFx, uWeather;
// uAirP：远处的霭加浓几倍、高处的霭剩几成、光柱的深浅、云影的深浅；uVale：云气的浓度、厚薄、浮在多高、湖那一圈山梁里面只算几成；
// uHiP：高空云的云量、浓度、卷云多少、流动快慢；uHiQ：云团大小、云层厚薄、顺风拉长几倍、朝天边多出来的云量
// uRayCol：光柱和逆光金边的颜色；uLightFx：云缝光柱多浓、云海浪头的高光、云边逆光金边闪动的强弱、日月辉光呼吸的幅度
// uWeather：x 这一季的天气还剩几成（1 照常，0 停了）；y 雨停后放晴了几成（不下雨的季节总是 0）；z 彩虹有多显

// 天边的颜色：朝着日月的那一侧更亮更暖
vec3 horizonColor(vec3 rd) {
  float toward = .5 + .5 * dot(normalize(rd.xz + 1e-5), normalize(uSunDir.xz));
  return mix(uHorizon, uHorizonSun, toward * toward * toward);
}
// 天的底色（不含日月周围那团光）。只看方向的高低和方位，rd 不必是单位向量的 y 也行（雾里用压扁的方向来取天边附近的颜色）
vec3 skyBase(vec3 rd) {
  float y = max(rd.y, 0.), toward = .5 + .5 * dot(normalize(rd.xz + 1e-5), normalize(uSunDir.xz)), t3 = toward * toward * toward, away = 1. - toward;
  vec3 c = mix(uZenith, uSkyMid, exp(-2.7 * y));
  c = mix(c, mix(uHorizon, uHorizonSun, t3), exp(-y * mix(12., 6.5, t3)));
  float belt = (y - .13) / .09;
  return c + uAntiSun * away * away * exp(-belt * belt);
}
// 日月的辉光一明一暗的节拍：几道慢慢错开的起伏叠在一起，不成规律；只跟时间有关
float sunBreath() {
  float t = uTime;
  return 1. + uLightFx.w * (.09 * sin(t * .47 + 1.3) + .06 * sin(t * 1.03 + .4) + .035 * sin(t * 1.7 + 2.2));
}
// 日月周围被照亮的空气：一大片柔和的光，越靠近越亮
vec3 sunWash(vec3 rd) {
  float s = max(dot(rd, uSunDir), 0.), s4 = s * s * s * s, s16 = s4 * s4 * s4 * s4;
  return uSkyGlow * (.3 * s4 * s4 + .5 * s16 * s16) * sunBreath();
}
vec3 skyGradient(vec3 rd) { return skyBase(rd) + sunWash(rd); }
// 空气本身的颜色（雾把东西染成的颜色）：取那个方向上天边附近的天色，所以远山化进去之后和背后的天接得上
vec3 airColor(vec3 rd) { return skyBase(vec3(rd.x, .75 * max(rd.y, 0.), rd.z)); }

// 山挡没挡住日月（立体的：空中的一点也能查）。近处查细的那张，出了范围查粗的
float sunSeen(vec3 p) {
  vec2 uv = landUv(p.xz), e = min(uv, 1. - uv);
  float top = min(e.x, e.y) > .004 ? dot(texture2D(uShadeTop, uv), uPick) : dot(texture2D(uShadeFar, (p.xz - uFarRect.xy) * uFarRect.zw), uPick);
  return smoothstep(-3., 11., p.y - top);
}
// 视线上从 ro 出发 d 远的这一段空气，有几成照得到日月（等距取八处平均；山影的边本来就是虚的，不用抖动取样点，画面上不起噪点）
float airLit(vec3 ro, vec3 rd, float d) {
  float reach = min(d, 1600.), sum = 0.;
  for (int i = 0; i < 8; i++) sum += sunSeen(ro + rd * reach * (float(i) + .5) / 8.);
  return mix(1., sum / 8., reach / d);
}

// 远霭沿这段视线有多厚。高处的空气更清（在视线上取三点平均）；远处另外加浓
float airThin(float y) { return mix(uAirP.y, 1., exp(-max(y - 105., 0.) / 190.)); }
float hazeDepth(vec3 ro, vec3 rd, float d) {
  float thin = (airThin(ro.y + rd.y * d * .2) + airThin(ro.y + rd.y * d * .55) + airThin(ro.y + rd.y * d * .9)) / 3.;
  return uFogP.x * d * thin * (1. + uAirP.x * smoothstep(250., 2600., d));
}
// 低雾沿这段视线有多厚：浓度随高度指数衰减，沿视线积分
float mistDepth(vec3 ro, vec3 rd, float d) {
  float k = uFogP.w * rd.y, span = abs(k) > 1e-5 ? (1. - exp(clamp(-k * d, -30., 30.))) / k : d;
  return uFogP.y * exp(clamp(-uFogP.w * (ro.y - uFogP.z), -30., 4.)) * span;
}
// 低雾里的丝缕：两层大小不同、流速不同的浓淡，0.3 到 1.7
float mistWisp(vec3 p) {
  vec2 q = p.xz * .0019 + uWind.xy * uTime * .004;
  float a = texture2D(uCloudMap, q + p.y * .0011).b, b = texture2D(uCloudMap, q * 3.3 - uWind.yx * uTime * .007 + p.y * .0037).b;
  return .3 + 1.4 * smoothstep(.22, .78, a * .62 + b * .38);
}
// 云气沿这段视线有多厚：浮在云海面上的一层，离那个高度越远越稀（往上往下都是），沿视线积分
float valeDepth(vec3 ro, vec3 rd, float d) {
  float h = uVale.y, a = ro.y - uVale.z, b = a + rd.y * d;
  float ga = h * sign(a) * (1. - exp(-abs(a) / h)), gb = h * sign(b) * (1. - exp(-abs(b) / h));
  return uVale.x * (abs(rd.y) > 1e-4 ? (gb - ga) / rd.y : d * exp(-abs(a) / h));
}
// 在不在抱湖的那圈山梁外面：1 在外面（云海那一侧），0 在里面
float outsideBowl(vec2 xz) {
  vec2 uv = landUv(xz), e = min(uv, 1. - uv);
  return min(e.x, e.y) > 0. ? texture2D(uLand, uv).b : 1.;
}
// 把一段贴地的空气（低雾和云气）盖到颜色 c 上。lit：这段空气有几成照得到日月（airLit 的结果，不算光柱就给 1）；
// open：这段视线算不算在山梁外面（云气主要在外面，湖那一圈里只有淡淡一点）
vec3 lowAirOver(vec3 c, vec3 ro, vec3 rd, float d, float lit, float open) {
  float sunward = max(dot(rd, uSunDir), 0.), s2 = sunward * sunward, glow = s2 * s2 * lit;
  float mist = 1. - exp(-mistDepth(ro, rd, d) * .5 * (mistWisp(ro + rd * d * .62) + mistWisp(ro + rd * d)));
  c = mix(c, uMistCol * (.8 + .2 * lit) + (uMistCol * .35 + uSkyGlow * .4) * glow, mist);
  float vale = 1. - exp(-valeDepth(ro, rd, d) * mix(uVale.w, 1., open));
  return mix(c, mix(airColor(rd), uMistCol, .4) * (.85 + .15 * lit) + sunWash(rd) * lit * .7, vale);
}
// 把一段空气（低雾、云气和远霭）盖到颜色 c 上
vec3 airOver(vec3 c, vec3 ro, vec3 rd, float d, float lit) {
  float open = .5 * (outsideBowl(ro.xz) + outsideBowl(ro.xz + rd.xz * d)), haze = 1. - exp(-hazeDepth(ro, rd, d));
  // 霭薄的时候先染上半空的天色（近一些的山发青、发紫），浓了才化成天边的颜色——一重山一个颜色，层次靠它拉开
  vec3 tint = mix(mix(uSkyMid, airColor(rd), .4), airColor(rd), smoothstep(.3, .9, haze));
  return mix(lowAirOver(c, ro, rd, d, lit, open), tint + sunWash(rd) * lit * .6, haze);
}
// 高空云。云底离地 HI_BASE，云层最厚 HI_SPAN；云随风整片地移动，顺着一个固定的走向拉长成条
const float HI_BASE = 2600., HI_SPAN = 1100.;
const float HI_R = 60000.;                  // 大地的半径（比真的小得多，云层才弯得看得出来）
// 视线和「离地 h 高」那层球面的交点有多远（人在球面里面）
float shellHit(vec3 ro, vec3 rd, float h) {
  float r0 = HI_R + ro.y, b = r0 * rd.y, c = r0 * r0 - (HI_R + h) * (HI_R + h);
  return -b + sqrt(b * b - c);
}
vec2 hiCoord(vec2 xz) {
  vec2 p = xz + uWind.xy * uTime * 90. * uHiP.w;                                         // 比真的云快：两三秒的镜头里要看得出云在走
  return vec2(dot(p, vec2(.94, .342)) / uHiQ.z, dot(p, vec2(-.342, .94))) / (4400. * uHiQ.x);
}
// 这一柱云有多厚实：0 没有云，1 云团的正中。大片的疏密盖在一朵朵的云团上，天上才有成群的云和成片的晴空。
// 一层慢慢流过的浓淡把云团的形状推得来回变（云团在长、在消）；云量随季节表走（雨停放晴时表里的云量减少，云缝张开）
float hiColumn(vec2 q, float lod, float more) {
  vec2 drift = uTime * vec2(.017, -.013);
  vec2 warp = (textureLod(uCloudMap, q * .55 + vec2(.21, .63) - drift, lod - 1.).ba - .5) * .11;
  float big = textureLod(uCloudMap, q * .19 + vec2(.37, .11) + drift * .3, lod - 2.4).b, puff = textureLod(uCloudMap, q + warp, lod).r;
  return clamp((puff + (big - .5) * .8 - 1. + uHiP.x + more) * 2.4, 0., 1.);
}
// 云影：地上这一点朝日月看过去，被高空云挡了多少
float hiShade(vec3 wp) {
  vec2 at = wp.xz + uSunDir.xz * ((HI_BASE + .35 * HI_SPAN * uHiQ.y - wp.y) / max(uSunDir.y, .12));
  return 1. - uAirP.w * smoothstep(.05, .75, hiColumn(hiCoord(at), 2., 0.));
}

// 从镜头朝 d 看过去，天有几成没被高空云挡住（只查云的平面分布，便宜）。日月跟前和天边按天上画云的同一套规矩多让一块、多添一些
float skyOpen(vec3 d) {
  d.y = max(d.y, .025);
  float t = shellHit(cameraPosition, normalize(d), HI_BASE + .3 * HI_SPAN * uHiQ.y), sunward = max(dot(normalize(d), uSunDir), 0.);
  float col = hiColumn(hiCoord(cameraPosition.xz + normalize(d).xz * t), log2(t * 7e-5 / uHiQ.x) + 1., uHiQ.w * exp(-d.y * 5.) - .5 * pow(sunward, 48.));
  return 1. - smoothstep(.0, .4, col);
}
// 云缝里的光柱：从 rd 沿弧往日月那边取 n 处，平均天敞开了几成。敞开的那几条线上亮，被云挡住的那几条线上暗——光柱从日月那里一道道散开。
// 日月跟前看不见的薄云也挡光：绕着日月一圈有疏有密的一层浓淡（随时间慢慢转、慢慢变），光柱才一道一道分得清。
// 返回 x：rd 这个方向在光柱里还是在两道光柱之间的暗缝里（0 到 1）；y：离日月多近（光柱整体的衰减，0 到 1）。离日月太远的方向不算（省掉）
vec2 rayFan(vec3 rd, int n) {
  float s = dot(rd, uSunDir);
  if (uLightFx.x <= 0. || s < .3) return vec2(0.);
  float open = 0.;
  for (int i = 0; i < 12; i++) {
    if (i >= n) break;
    open += skyOpen(mix(rd, uSunDir, (float(i) + .5) / float(n) * .92));
  }
  open /= float(n);
  vec3 e1 = normalize(cross(uSunDir, vec3(0., 1., 0.))), e2 = cross(e1, uSunDir);
  vec2 around = normalize(vec2(dot(rd, e1), dot(rd, e2)) + 1e-5);
  float veil = textureLod(uCloudMap, around * .45 + uTime * vec2(.0042, -.003) + vec2(.41, .17), 0.).b * .7
             + textureLod(uCloudMap, around * 1.2 - uTime * vec2(.0027, .0048) + vec2(.73, .58), 0.).b * .3;
  float lanes = smoothstep(.4, .64, veil);
  float ang = acos(min(s, 1.));
  return vec2(open * open * (.2 + .8 * lanes), exp(-ang / .55) * smoothstep(.3, .62, s));
}
// 光柱的颜色和亮度
vec3 rayLight(vec2 fan) { return uRayCol * (uLightFx.x * .4 * fan.x * fan.y); }
vec3 rayGlow(vec3 rd, int n) { return rayLight(rayFan(rd, n)); }

// 虹：以背着日头的方向为心、半径约 42° 的一圈，外面一道更淡的副虹（颜色反过来）。红、绿、蓝各是一条宽的光带，叠在一起还掺一点白
vec3 bowBands(float u) {
  vec3 b = vec3(u - .82, u - .5, u - .16) / .26;
  return exp(-b * b) * smoothstep(-.1, .12, u) * smoothstep(1.1, .88, u);
}
// 山前的虹：虹是挂在空气里的，隔着的空气越厚越显，近在眼前的东西上没有。所以它横在溪谷和远山前面，脚落在谷里
vec3 bowInAir(vec3 rd, float d) {
  if (uWeather.z <= 0.) return vec3(0.);
  float a = degrees(acos(clamp(dot(rd, -uSunDir), -1., 1.)));
  vec3 bow = bowBands((a - 39.2) / 4.2) + .25 * bowBands((54.5 - a) / 4.6);
  // 水汽不匀，虹也跟着一段显一段淡；越靠近谷底水汽越重，虹脚最显
  float patchy = .5 + .5 * smoothstep(.3, .7, texture2D(uCloudMap, rd.xz * 1.7 + rd.y * 2.3 + uTime * vec2(.004, -.003)).b) + .5 * smoothstep(.25, -.2, rd.y);
  return mix(bow, vec3(dot(bow, vec3(.333))), .42) * uSunCol * (.16 * RECIPROCAL_PI * uWeather.z * patchy * smoothstep(8., 75., d));
}
// 雾：外景里所有东西最后都过这一道。wp 是这个像素在世界里的位置。霭厚的地方（远山前）叠上云缝的光柱
vec3 wildFog(vec3 c, vec3 wp) {
  vec3 v = wp - cameraPosition; float d = length(v); vec3 rd = v / d, ro = cameraPosition;
  float lit = 1.;
  if (uAirP.z > 0.) lit = mix(1., airLit(ro, rd, d), uAirP.z);
  return airOver(c, ro, rd, d, lit) + rayGlow(rd, 6) * lit * (1. - exp(-hazeDepth(ro, rd, d) * 1.5)) + bowInAir(rd, d) * lit;
}`;
