// 地形的着色：石、土、草、雪怎样铺在山上。画法带一点青绿山水的笔意：
//   石头分块面——每一块石面有自己的深浅和朝向（和 land.js 里分石柱的是同一套格子），块与块的棱上是断断续续的墨线；
//   顺着山势往下是拉长的皴纹；朝上的石面和山头染石青石绿，山脚偏赭；陡壁脚下的缓坡是碎石；
//   草长在缓坡上，草和石头之间露一圈土；路肩贴着墙脚是碎石，往外是踩实的土，再往外才是草；
//   冬天雪积在朝上的面和凹处，陡壁和棱上露出深色的石头。
// 近处的网格每个顶点带 aRoad（离路中线多远）；远处的网格（FAR）没有块面和路肩，一色的青。
import { paint, seasonal, VILLAGE_LIGHTS } from './paint.js';
import { SEASONS } from './seasons.js';
import { FACET_BIG, FACET_SMALL } from './land.js';
import { CREEK, FALL } from './road.js';
import { WATER } from './scenerymap.js';

const facetArgs = ({ size, ox, oz }) => `${size.toFixed(1)}, vec2(${ox.toFixed(2)}, ${oz.toFixed(2)})`;
// 瀑布口和落水处（着色器里的 vec3）
const [LIP, POOL] = [CREEK[FALL.lip], CREEK[FALL.pool]];
const FALL_TOP = [LIP[0], LIP[2], LIP[1]].map(v => v.toFixed(1)).join(', '), FALL_FOOT = [LIP[0] + (POOL[0] - LIP[0]) * .82, POOL[2], LIP[1] + (POOL[1] - LIP[1]) * .82].map(v => v.toFixed(1)).join(', ');

const VERT_PARS = /* glsl */`
#ifndef FAR
attribute float aRoad; varying float vRoad;
#else
attribute float aCav; varying float vCav;
#endif`;
const VERT = /* glsl */`
#ifndef FAR
vRoad = aRoad;
#else
vCav = aCav;
#endif`;

const FRAG_PARS = /* glsl */`
uniform vec3 uRockA, uRockB, uGrassA, uGrassB, uSoil, uTint, uPave;
#ifndef FAR
varying float vRoad;
#else
varying float vCav;
#endif
// 块面：返回这一块的两个随机数（xy）和离块的边界多远（z）。和 land.js 的 facet 是同一个算法、同一张噪声表
vec3 facet(vec2 xz, float size, vec2 o) {
  vec2 p = xz / size + o, ip = floor(p), id = vec2(0.);
  float d1 = 1e9, d2 = 1e9;
  for (int b = -1; b <= 1; b++) for (int a = -1; a <= 1; a++) {
    vec2 g = ip + vec2(float(a), float(b)); vec4 h = texture2D(uNoise, (g + .5) / 256.);
    vec2 f = g + .15 + .7 * h.rg - p; float d = dot(f, f);
    if (d < d1) { d2 = d1; d1 = d; id = h.ba; } else if (d < d2) d2 = d;
  }
  return vec3(id, (sqrt(d2) - sqrt(d1)) * size);
}
// 皴：顺着山势往下拉长的墨痕。朝东西的坡面和朝南北的坡面各取一份，按朝向混合
float streaks(vec3 wp, vec3 N) {
  vec2 w = abs(N.xz) / (abs(N.x) + abs(N.z) + 1e-4);
  float a = noise1(vec2(wp.z * .3, wp.y * .04)) * .6 + noise1(vec2(wp.z * 1.05, wp.y * .15 + 7.)) * .4;
  float b = noise1(vec2(wp.x * .3 + 31., wp.y * .04)) * .6 + noise1(vec2(wp.x * 1.05 + 5., wp.y * .15 + 3.)) * .4;
  return a * w.x + b * w.y;
}
#ifndef FAR
// 崖面上一层层垒着的石头。u 沿崖面横着量，y 是高度。层理是起伏、略带倾斜的；每层按不等的长度断成一块块，块与块之间是竖的裂隙（有的地方断开）。
// 返回 x 这块石头的深浅，y 缝（层间的缝和竖的裂隙），z 这块的顶沿（长苔、挂草、积雪的地方），w 这块的面朝上还是朝下（上沿朝上、下沿朝里收）
vec4 strata(float u, float y) {
  float wob = (noise1(vec2(u * .035, 3.1)) - .5) * 6. + (noise1(vec2(u * .16, 7.7)) - .5) * 1.4;
  float t = (y + wob + u * .07) / 2.7, band = floor(t), f = fract(t);
  vec4 hb = texture2D(uNoise, (vec2(band, 11.) + .5) / 256.);
  float v = u / (2.6 + 5. * hb.y) + hb.z * 7., g = fract(v);
  vec4 hs = texture2D(uNoise, (vec2(floor(v), band + 40.) + .5) / 256.);
  float bed = smoothstep(.1, .0, f) * (.55 + .45 * noise1(vec2(u * .6, band * 3.)));
  float crack = smoothstep(.07, .0, min(g, 1. - g)) * step(.3, hs.x) * smoothstep(.0, .2, f);
  return vec4(hs.y, max(bed, crack), smoothstep(.72, .98, f), hs.z - .5 + (f - .45) * .8);
}
uniform vec4 uVillages[${VILLAGE_LIGHTS}];
// 夜里村子的灯照在四周的地上（雪上）有多亮
float villageGlow(vec2 xz) {
  float warm = 0.;
  for (int i = 0; i < ${VILLAGE_LIGHTS}; i++) { vec4 v = uVillages[i]; vec2 d = xz - v.xy; warm += v.w * exp(-dot(d, d) / (v.z * v.z)); }
  return warm;
}
// 隔着几百个单位看崖壁：一层层的层理（厚薄不一、顺着山势略斜），竖的节理把层断成一块块，斜着劈下来的斧劈皴，每层的上沿是一道朝上的窄面。
// u 沿崖面横着量，y 是高度。返回 x：墨有多重（0 到 1），y：这里是不是层的上沿
vec2 cliffInk(float u, float y) {
  // 层：厚薄不一（每层 7 到 19），层面起伏、顺山势斜；层面的线断断续续，只有一段一段露出来
  float t = (y + (noise1(vec2(u * .011, 5.3)) - .5) * 26. + (noise1(vec2(u * .05, 2.1)) - .5) * 5. + u * .06) / 13., band = floor(t), f = fract(t);
  vec4 hb = texture2D(uNoise, (vec2(band, 71.) + .5) / 256.);
  f = pow(f, .6 + .8 * hb.x);
  float shown = smoothstep(.42, .62, noise1(vec2(u * .035 + band * 3.1, band * 1.7)));
  float bed = smoothstep(.1, .0, f) * shown * (.4 + .6 * hb.y);
  // 竖的节理：把一层断成一根根石柱，有的一直贯通好几层
  float jv = u / (4. + 9. * hb.z) + hb.w * 5. + .25 * noise1(vec2(y * .05, u * .01)), jg = fract(jv);
  float joint = smoothstep(.1, .0, min(jg, 1. - jg)) * step(.35, noise1(vec2(floor(jv) * 3.7, y * .02)));
  // 斧劈皴：从上往下斜着劈下来的一道道墨，长的、短的、浓的、淡的
  float axe = smoothstep(.55, .82, noise1(vec2(u * .09 + y * .035, y * .009))) * (.4 + .6 * noise1(vec2(u * .3 + y * .1, y * .04)));
  axe = max(axe, .7 * smoothstep(.62, .85, noise1(vec2(u * .21 - y * .06, y * .02 + 9.))));
  return vec2(clamp(bed * .45 + joint * .55 + axe * .7, 0., 1.), smoothstep(.86, .98, f) * shown * step(.5, hb.y));
}
// 离瀑布的水帘多近（水平距离），雾气和溅起的水把这一圈石头打湿
float nearFall(vec3 p) {
  vec3 a = vec3(${FALL_TOP}), b = vec3(${FALL_FOOT}), ab = b - a;
  vec3 q = a + ab * clamp(dot(p - a, ab) / dot(ab, ab), 0., 1.);
  return length(p.xz - q.xz) + max(0., p.y - a.y - 4.) * .5;
}
#endif`;

const FRAG = /* glsl */`
  float dist = distance(vWp, cameraPosition), near = smoothstep(700., 120., dist), close = smoothstep(70., 8., dist);
  vec3 N0 = N;
  float big = fbm(vWp.xz * .012), fine = fbm(vWp.xz * .07 + 40.), tone = .5, joint = 0.;
  #ifdef FAR
  float cav = vCav;
  #else
  vec2 uv = landUv(vWp.xz);
  float cav = texture2D(uLand, uv).g, creekK = texture2D(uLand2, uv).g;
  sun = bakedSun(vWp.xz);
  // 块面：陡的地方才分块。每块的朝向略偏一点，受光就有了一块一块的转折；棱上的墨线离得越近画得越细
  vec3 fb = facet(vWp.xz, ${facetArgs(FACET_BIG)}), fs = facet(vWp.xz, ${facetArgs(FACET_SMALL)});
  float stony = smoothstep(.2, .46, 1. - N.y), line = clamp(dist * .0045, .1, 1.6);
  N = normalize(N + stony * (vec3(fb.x - .5, 0., fb.y - .5) * .55 + vec3(fs.x - .5, 0., fs.y - .5) * .36));
  tone = fb.y * .6 + fs.x * .4;
  joint = max(smoothstep(line, line * .2, fb.z), .7 * near * smoothstep(line * .7, line * .15, fs.z)) * (.3 + .7 * smoothstep(.25, .6, noise1(vWp.xz * .09 + vWp.y * .07))) * stony;
  #endif
  vec2 bump = (noise4(vWp.xz * .23).rg - .5) * near * .3 + (noise4(vWp.xz * .04).ba - .5) * .28 + (noise4(vWp.xz * 1.7).rg - .5) * close * .3;
  N = normalize(N + vec3(bump.x, 0., bump.y));
  float slope = 1. - N.y, str = streaks(vWp, N0);
  str = mix(str, fbm(vWp.xz * .21 + vWp.y * .33), .4 * near);                                              // 近看时长长的皴纹里掺进碎一些的石纹，不显得是抹出来的
  // 石头：亮面和墨色随皴纹来回，凹处、背光的块面墨重一些；山头染石青石绿，山脚偏赭
  // 墨分三层（亮面、中间调、墨色），层与层的边界远看是利落的笔触，近看化开
  float value = str * .6 + big * .16 + cav * .3 + (tone - .5) * .2 + .12, soft = mix(.035, .15, close);
  vec3 rock = mix(uRockB, uRockA, .45 * smoothstep(.4 - soft, .4 + soft, value) + .55 * smoothstep(.58 - soft, .58 + soft, value));
  rock = mix(rock, uTint, .58 * smoothstep(.2, .85, vWp.y / 420. + cav * .35 + (big - .5) * .5) * smoothstep(.8, .3, slope));
  rock = mix(rock, uSoil, .4 * smoothstep(170., 30., vWp.y));
  rock *= 1. - .6 * joint;
  // 近看：石面上顺着竖向的细纹，和几道细细的裂纹，贴到崖壁跟前也不是一片平色
  float along = dot(vWp.xz, vec2(.8, .6)), across = dot(vWp.xz, vec2(.6, -.8));
  rock *= mix(1., .76 + .48 * fbm(vec2(along * 1.1, vWp.y * .3)), near * smoothstep(.15, .45, 1. - N0.y));
  rock *= 1. - .4 * near * smoothstep(.2, .5, 1. - N0.y) * smoothstep(.03, 0., abs(noise1(vec2(across * .33, vWp.y * .11)) * .6 + noise1(vec2(along * .5, vWp.y * .2 + 9.)) * .4 - .5));
  float ledge = 0., wetRock = 0.;
  #ifndef FAR
  // 崖壁走近了看：一层层垒着的石块，块块深浅不一、上沿朝上鼓、下沿往里收；层间的缝和竖的裂隙是暗的；上沿长苔、挂草。
  // 朝东西的崖面和朝南北的崖面各量一份，按朝向混合
  float wall = smoothstep(.28, .55, 1. - N0.y) * smoothstep(220., 60., dist);
  vec2 wsel = abs(N0.xz) / (abs(N0.x) + abs(N0.z) + 1e-4);
  vec4 st = strata(vWp.z, vWp.y) * wsel.x + strata(vWp.x + 61., vWp.y) * wsel.y;
  rock *= mix(1., (.7 + .55 * st.x) * (1. - .62 * st.y), wall);
  N = normalize(N + wall * vec3(0., st.w * .9, 0.) - wall * N0 * .25 * st.y);
  ledge = st.z * wall * smoothstep(130., 40., dist) * smoothstep(.45, .7, noise1(vec2(dot(vWp.xz, wsel.yx) * .13, vWp.y * .2)));   // 只有一段一段的上沿长苔
  // 湿：瀑布四周一圈被水雾打得透湿发黑；下雨时崖面上一道道往下淌的水痕
  float u = dot(vWp.xz, vec2(wsel.y, wsel.x));
  wetRock = max(smoothstep(30., 5., nearFall(vWp)), uWet * wall * smoothstep(.5, .78, noise1(vec2(u * 1.2, vWp.y * .025)) * .7 + noise1(vec2(u * 3.1, vWp.y * .06)) * .3));
  rock = mix(rock, rock * vec3(.42, .46, .46), wetRock);
  // 大远景：崖壁读得出层理、节理和斧劈皴，层的上沿亮一道
  float vista = smoothstep(110., 320., dist), macro = texture2D(uLand, uv).a, sheer = smoothstep(.3, .62, 1. - N0.y) * vista;
  vec2 ink = cliffInk(u, vWp.y);
  rock *= 1. - sheer * ink.x * .58;
  rock = mix(rock, mix(rock, uRockA, .6) * 1.15, sheer * ink.y * .55);
  #else
  float vista = 0., macro = 0.;
  #endif
  // 碎石坡：陡壁脚下凹进去的缓坡，一粒一粒深浅不一
  float speck = noise1(vWp.xz * .9) * .6 + noise1(vWp.xz * 2.3) * .4;
  rock = mix(rock, mix(uRockB * 1.3, uRockA, smoothstep(.35, .65, speck)), .7 * near * smoothstep(.26, .4, slope) * smoothstep(.64, .5, slope) * smoothstep(.02, -.25, cav));
  // 草木：缓坡上才有，成片地深浅不一；草和石头之间露一圈土
  float patchy = fbm(vWp.xz * .31 + 7.);                                                                   // 几步见方的斑驳：近看草坡不是一色的
  float veg = smoothstep(.46, .2, slope + (big - .5) * .3 - cav * .08 + (fine - .5) * .1 + (patchy - .5) * .3 * near + .22 * smoothstep(160., 270., vWp.y + 40. * (big - .5)));   // 越高石头露得越多
  vec3 grass = mix(uGrassB, uGrassA, smoothstep(.3, .7, big * .4 + fine * .35 + patchy * .25 + cav * .25)) * (.78 + .44 * fine) * (1. + (speck - .5) * .3 * close);
  grass = mix(grass, grass * vec3(1.06, 1.14, .82), uPick.x * smoothstep(90., 15., vWp.y));                 // 春天山脚一片新绿
  vec3 soil = uSoil * (.7 + .45 * fine) * mix(1., .78 + .5 * speck, close);
  albedo = mix(rock, soil, .6 * smoothstep(0., .4, veg));
  albedo = mix(albedo, grass, smoothstep(.25, .8, veg));
  albedo = mix(albedo, soil, .55 * near * smoothstep(.56, .74, patchy + (fine - .5) * .3) * smoothstep(.12, .3, slope));   // 坡上一块块草盖不住的土
  #ifdef FAR
  // 远山不分草木石头，大体一色的青；隔着霭还读得出结构：山脊亮、沟壑暗，顺着山势的皴纹，背阴的块面沉一些。越远越淡、越近天色
  albedo = mix(albedo, uTint * .7, .6) * (.82 + .5 * clamp(cav * .9 + .35, 0., 1.)) * (.86 + .28 * str);
  albedo = mix(albedo, uHorizon * .55, .3 * smoothstep(1500., 5200., dist));
  #else
  // 路肩：贴着墙脚一圈碎石，往外是踩实的土，边缘参差着咬进草里
  float rag = noise1(vWp.xz * .55) * .6 + noise1(vWp.xz * 1.9) * .4;
  float pebble = mix(.5, smoothstep(.3, .7, noise1(vWp.xz * 5.3) * .5 + noise1(vWp.xz * 12.7) * .5), close);
  albedo = mix(albedo, uSoil * (.74 + .36 * fine), .85 * smoothstep(7.4, 4.8, vRoad + (rag - .5) * 2.8));
  albedo = mix(albedo, mix(uSoil * .86, uPave * .9, pebble) * (.9 + .2 * rag), .6 * smoothstep(5.7, 4.5, vRoad + (rag - .5) * 1.5));
  albedo = mix(albedo, uRockB * 1.3, .45 * smoothstep(.55, .95, creekK));                                  // 溪边湿的石头
  // 梯田：一块块的田（块块深浅不一），田面随季节换——春天灌满了水照着天、夏天青的秧、秋天黄的稻、冬天盖着雪；台壁是一道道土埂
  float field = texture2D(uLand2, uv).b;
  if (field > .01) {
    vec2 plot = floor(vWp.xz / vec2(19., 13.) + noise1(vWp.xz * .03) * .8);
    vec4 hp = texture2D(uNoise, (plot + .5) / 256.);
    float rows = .5 + .5 * sin(dot(vWp.xz, vec2(.6, .8)) * 1.9 + hp.x * 6.), sprig = smoothstep(.3, .7, noise1(vWp.xz * .7));
    vec3 paddy = uPick.x * mix(mix(uHorizon, uSkyMid, .35) * 1.05, uGrassA * 1.1, .18 * rows * sprig)
               + uPick.y * mix(uGrassB, uGrassA * 1.15, .5 + .3 * rows) * (.9 + .2 * hp.y)
               + uPick.z * mix(vec3(.86, .66, .3), vec3(.74, .6, .32), hp.y) * (.9 + .15 * rows)
               + uPick.w * uSoil * .9;
    paddy *= .88 + .24 * hp.z;
    glow += uPick.x * mix(uHorizon, uSkyMid, .4) * .16 * field * smoothstep(.12, .02, slope);                // 春天田里的水照着天
    float bund = smoothstep(.1, .28, slope);
    albedo = mix(albedo, mix(paddy, mix(uSoil * .8, uGrassB, .45), bund), field);
  }
  #endif
  float lakeside = smoothstep(${(WATER.z1 + 40).toFixed(1)}, ${(WATER.z1 - 10).toFixed(1)}, vWp.z);       // 在不在湖那一带（出了湖面的南缘，低处是出谷的谷底，不是湖岸）
  albedo = mix(albedo, uSoil * .7, .8 * smoothstep(1.3, .2, vWp.y) * (1. - uSnow) * lakeside);             // 湖岸的湿泥
  albedo = soak(albedo * mix(1., .8, smoothstep(.5, .9, slope)) * mix(1., .88, uWet), uWet * .8);
  // 崖上每层石头的上沿：一溜青苔（湿的地方更厚）
  albedo = mix(albedo, mix(uGrassB * .62, uGrassA * .7, fine) * (1. - .25 * wetRock), ledge * smoothstep(.35, .62, patchy + .3 * wetRock) * (1. - uSnow));
  // 放晴后，湿的石面和草叶上迎着日头有几粒水光
  glow += uSunCol * dewGlint(vWp, N, .12) * .1 * uWet * close;
  // 雪：朝上的面和凹处积得住，凸出来的棱和陡壁露着石头；崖上每层石头的上沿也压着一溜
  //     远看：脊上和缓处白，陡壁是露出来的深色石头，崖上一层层的上沿压着一溜雪
  float snow = uSnow * max(smoothstep(.62, .32, slope - (fine - .5) * .22 + cav * .2 + joint * .25 - .1 * macro * vista), .85 * ledge * smoothstep(.3, .6, fine)) * max(smoothstep(-.4, .6, vWp.y), 1. - lakeside);
  #ifndef FAR
  snow *= 1. - .55 * field * smoothstep(.1, .28, slope);                                                  // 梯田的土埂上雪薄，一道道露出来
  snow = max(snow, uSnow * sheer * ink.y * .45 * smoothstep(.4, .7, fine));
  albedo = mix(albedo, albedo * .62, uSnow * sheer * (1. - snow));                                         // 雪夜里陡壁的石头显得更深
  #endif
  albedo = mix(albedo, vec3(.9, .93, 1.), snow);
  ao = clamp(.84 + cav * .5, .5, 1.12) * (1. - .25 * joint);
  #ifndef FAR
  // 大远景：整道山脊亮起来，侧谷、冲沟沉下去
  albedo *= 1. + vista * macro * .2;
  ao *= clamp(1. + vista * macro * .35, .6, 1.25);
  if (uLamp > 0.) glow += vec3(1., .66, .36) * albedo * min(villageGlow(vWp.xz), 1.2) * uLamp * .06 * smoothstep(80., 200., dist);   // 只在远看时（近景里有真的灯照着）
  // 雪夜逆着月亮看过去：山的轮廓、石柱和岩棱的边上被月光勾出一道冷白的亮边（迎着月亮那一侧更亮）
  vec3 toEye = normalize(cameraPosition - vWp);
  float rimK = pow(1. - max(dot(N, toEye), 0.), 3.) * smoothstep(.2, .85, dot(-toEye, uSunDir)) * (.45 + .55 * max(N.y, 0.)) * (.6 + .8 * max(dot(N, uSunDir), 0.));
  glow += uSunCol * mix(albedo, vec3(1.), .45) * rimK * vista * uSnow * .55;
  // 背着日月的一面：天光映出来的冷蓝层次，雪面比岩面亮得多（雪夜里两者才分得开）
  glow += uSkyCol * albedo * uSnow * vista * .16 * (.6 + .4 * N.y) * smoothstep(-.1, .4, dot(-toEye, uSunDir)) * (1. - sun);
  #endif`;

// 近处和远处各一个材质
export function terrainMaterials() {
  const uniforms = seasonal(SEASONS.春.u, 'uRockA', 'uRockB', 'uGrassA', 'uGrassB', 'uSoil', 'uTint', 'uPave');
  const make = defines => paint({ vertexPars: VERT_PARS, vertex: VERT, fragmentPars: FRAG_PARS, fragment: FRAG, uniforms, defines });
  return { near: make({}), far: make({ FAR: '' }) };
}
