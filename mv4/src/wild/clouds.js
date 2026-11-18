// 云海：填满山梁外面的谷地，一直铺到天边；山峰、支脉、岛和远山从云里露出头来。
// 做法：不建网格，整屏逐像素沿视线走进云里。
//   云面是一张起伏的高度场——大势（成百上千个单位的云团和云谷）上叠着一个个翻起来的云头（圆顶之间夹着尖沟），再叠一层细絮；
//   各层朝不同方向、以不同速度流动，云头就一边漂一边翻卷变形。
//   四道走向、波长、快慢不同的长浪（sin / cos）推着整片云面缓缓起落：浪顶上云头翻得高，浪谷里平；浪头还一涌一退（取样点被浪前后推），
//   一层慢慢流动的扭曲推着云头的形状一直在变。浪头上被风扯出一缕缕云絮，顺风拉长、往上卷、越高越淡。
//   贴着山的云一口一口地呼吸，漫上来又退下去，高处慢半拍，看着是顺着坡往上爬。
//   光：浪顶亮、浪谷沉，一道道明暗随浪推过去；迎着日月的浪坡上滚着高光；逆光时云头薄的边镶一道闪动的金边；云海上空的霭里叠着云缝的光柱。
//   视线先在云面上方大步走（离云面多高就迈多大），贴近云面后小步走进去，一路累积浓淡，所以云头的轮廓是虚的、层层遮挡的，
//   镜头贴着云面平视也立得住。
//   每一步的受光：朝日月方向再看三处，前面的云头高出这条光线多少就暗多少——低角度的光下，云头拖出长长的影子；
//   山挡住光的地方（shade.js 的山影顶）整片暗下去；云面朝着光的坡亮，沟里沉下去偏冷；逆光看过去，云头薄的边被打透。
//   云碰到山的地方：视线撞到地面就停，累积到的那一点薄云盖在山上，所以交界是虚的；贴着山的云还会往上漫一截。
//   云不是齐着山梁一刀切的（哪里有云、多高，由 outland.js 定，terrain.js 烤进贴图）：
//     湖的上空没有云（两臂山梁挡着）；水口外面是一片云湾，云面朝着水口一路低下去，露出谷和两道谷壁；
//     垭口上的云瀑、谷口的云舌是贴着地面的一层：翻过脊线顺着内坡往下淌，一缕一缕的，越往下越薄，到半坡化掉。
// 云没有自己的深度，这里把「视线最先碰到云的那一点」的深度写出去，和场景里别的东西正常遮挡（亭子在云前面就不会被云盖住）。
import * as THREE from 'three';
import { CLOUD_TOP } from './land.js';
import { BOWL } from './ranges.js';
import { COMMON, U, seasonal } from './paint.js';
import { SEASONS } from './seasons.js';

const LOW = CLOUD_TOP - 37, SWELL = 60, CEIL = CLOUD_TOP + 48;        // 云面最低处、起伏的幅度；云面（连同漫上山的那一截）不会高过 CEIL
const DROP = 150, FALL = 36;                                         // 云海只有几成的地方云面降多少（没有云海的地方降这么多）；贴地的云最厚多少
const REACH = 9000, STEPS = 190;                                      // 最远画到多远；一条视线最多走几步
const VERT = /* glsl */`
varying vec3 vRay;
void main() {
  gl_Position = vec4(position.xy, 0., 1.);
  vec4 view = inverse(projectionMatrix) * vec4(position.xy, 1., 1.);
  vRay = transpose(mat3(viewMatrix)) * (view.xyz / view.w);            // 这个像素的视线方向（世界坐标）
}`;
const FRAG = /* glsl */`
#include <common>
${COMMON}
uniform vec3 uCloudLit, uCloudShade, uCloudDeep, uCloudRim;
uniform mat4 projectionMatrix;
varying vec3 vRay;

float pixelNoise(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(.06711056, .00583715)))); }

// 一道长浪：dir 走向，len 波长，period 周期（秒），amp 高低。浪头一涌一退：取样点顺着走向前后推（推多少和浪高同相位错开四分之一），
// 浪就一侧陡一侧缓、浪头往前翻。bend 把整排浪扭弯；浪长短于一个像素盖住的范围时淡掉，远处不闪
void swellWave(inout vec3 s, vec2 p, vec2 dir, float len, float period, float amp, float bend, float foot) {
  float ph = dot(p, dir) * 6.2832 / len - uTime * 6.2832 / period + bend * 6.2832 * 1300. / len;
  amp *= smoothstep(len * .5, len * .15, foot);
  s += vec3(dir * cos(ph) * amp * len * .045, sin(ph) * amp);
}
// 云浪：四道走向、波长、快慢各不相同的长浪叠起来。返回 xy：取样点被浪推开多远；z：浪把云面抬高多少（约 -1 到 1）。
// 最长的一道八九秒一起一落，最短的三秒——比真的云快：影片里一个云海的镜头只有两三秒，在这两三秒里要看得出浪在推。L：远近（远处的短浪淡掉）
vec3 seaSwell(vec2 p, float L) {
  float bend = textureLod(uCloudMap, p / 5200. + vec2(.13, .57), L - 12.).b - .5, foot = exp2(L - 9.4);
  vec3 s = vec3(0.);
  swellWave(s, p, vec2(.8, .6), 1500., 8.5, .42, bend, foot);
  swellWave(s, p, vec2(.28, .96), 780., 6., .3, bend * 1.3, foot);
  swellWave(s, p, vec2(.97, -.24), 440., 4.2, .2, -bend, foot);
  swellWave(s, p, vec2(.62, .78), 230., 3.1, .11, bend * .7, foot);
  return s;
}
// 云面的高度。L：按远近取贴图哪一级的基数（远处自动抹平）；
// fine：小于 0 只要大形（云团、云浪和云头）；否则再加中等的翻卷，以及按 fine（0 到 1）加细絮——细絮只在近处要，远处加了只是一片碎点。
// 云头随浪升降：浪顶上的云头翻得高，浪谷里平；云头的形状被一层慢慢流动的扭曲推着变（一边漂一边翻卷，不只是平移）
float seaTop(vec2 p, float L, float fine) {
  vec2 w = uWind.xy * uTime;
  vec3 wave = seaSwell(p, L);
  vec2 q = p - wave.xy;
  float swell = textureLod(uCloudMap, p / 2900. + w * .0012, L - 11.5).b;
  vec2 churn = (textureLod(uCloudMap, p / 1900. + vec2(uTime * .0105, -uTime * .0078), L - 11.).ga - .5) * .16;
  float heads = textureLod(uCloudMap, q / 820. + w * .011 + swell * .2 + churn, L - 9.7).a;
  float rise = .5 + .5 * wave.z;
  float h = .08 + .8 * (swell * .42 + heads * (.24 + .24 * swell + .3 * rise)) + .3 * wave.z;   // 云团高的地方、浪顶上云头翻得高，云谷和浪谷里平一些
  if (fine >= 0.) {
    float rolls = textureLod(uCloudMap, q / 370. - w.yx * .014 + heads * .12 + churn * 1.5, L - 8.5).r, fluff = textureLod(uCloudMap, q / 118. + w * .035 + churn * 2., L - 6.9).g;
    float fuzz = textureLod(uCloudMap, q / 43. - w * .06 + fluff * .2, L - 5.4).g;
    h += (rolls - .5) * .3 + ((fluff - .5) * .17 + (fuzz - .5) * .07) * fine;
  }
  return ${LOW.toFixed(1)} + ${SWELL.toFixed(1)} * h;
}
// 这里是不是浪头：0 浪谷，1 浪顶（给高光和云絮用；只算浪，不算云头）
float seaCrest(vec2 p, float L) { return smoothstep(-.25, .75, seaSwell(p, L).z); }
// 云海有几成：1 完整的云海，0 没有（湖的上空、水口外的云湾里）。近处查细的那张，出了范围查粗的
float seaMask(vec2 p) {
  vec2 uv = landUv(p), e = min(uv, 1. - uv);
  return min(e.x, e.y) > 0. ? texture2D(uLand, uv).b : texture2D(uFar, (p - uFarRect.xy) * uFarRect.zw).g;
}
// 贴地的云（垭口的云瀑、谷口的云舌）：0 到 0.5 是快到了，0.5 到 1 是云层的厚薄
float seaFall(vec2 p) {
  vec2 uv = landUv(p), e = min(uv, 1. - uv);
  return min(e.x, e.y) > 0. ? texture2D(uLand2, uv).a : 0.;
}
// 云里一点的颜色。top：这里的云面高度；sink：这一柱云面比云海本来的面低了（负）或高了多少（云湾、云瀑）；bump：细处比大形鼓出来多少（负的是小沟）；
// depth：在云面以下多深；soft：云面虚的那一层有多厚
vec3 seaShade(vec3 p, float top, float sink, float bump, float depth, float soft, float L, float fine, vec3 rd) {
  float flat_ = length(uSunDir.xz), rise = uSunDir.y / flat_;                              // rise：光线每往前一个单位升高多少
  vec2 toSun = uSunDir.xz / flat_;
  // 朝着日月的坡亮：看云面往日月那边是升还是降
  // 受光按这一柱云的云面算（不按视线走到多深算），同一朵云从外到里是一个颜色，轮廓才干净
  float reach = 5. + soft, ahead = seaTop(p.xz + toSun * reach, L, fine) + sink, slope = (ahead - top) / reach;
  float facing = smoothstep(-.35, .55, (uSunDir.y - slope * flat_) / sqrt(1. + slope * slope));
  // 前面的云头挡光：近、中、远三处。光越斜，影子拖得越长
  float lit = 1. - .55 * smoothstep(0., 6., ahead - (top + reach * rise));
  lit *= 1. - .7 * smoothstep(0., 12., seaTop(p.xz + toSun * 34., L + 1., 0.) + sink - (top + 34. * rise));
  lit *= 1. - .8 * smoothstep(0., 22., seaTop(p.xz + toSun * 120., L + 2., -1.) + sink - (top + 120. * rise));
  lit *= sunSeen(vec3(p.x, top + 5., p.z)) * hiShade(p);                                    // 山的影子、天上流云的影子
  float crown = smoothstep(${(LOW + 10).toFixed(1)}, ${(LOW + SWELL - 4).toFixed(1)}, top - sink);  // 云头高处亮，云谷里沉
  float open = smoothstep(-9., 8., bump);                                                   // 鼓出来的小云包迎着天光，小沟里暗
  vec3 c = mix(uCloudDeep, uCloudShade, .5 * crown + .5 * open);
  c += uSkyGlow * .22 * smoothstep(.1, -.5, slope) * open;                                  // 背光的时候，朝着亮的那片天的坡也被天光映亮一点
  c = mix(c, uCloudLit, lit * facing * (.45 + .55 * open));
  float sunward = max(dot(rd, uSunDir), 0.), s2 = sunward * sunward, crest = seaCrest(p.xz, L);
  c *= .76 + .36 * crest;                                                                  // 浪顶迎着天光亮，浪谷沉下去：远远看去一道道明暗随浪推过去
  // 逆光：云头薄的边透光，镶一道金边；边上流过一层细碎的浓淡，金边一闪一闪
  float shimmer = textureLod(uCloudMap, p.xz / 61. + uTime * vec2(.006, -.0042), L - 5.9).g;
  float edge = smoothstep(soft, -soft, depth) * (.3 + .7 * crown) * (1. + uLightFx.z * (1.4 * shimmer - .5));
  c += (uCloudRim + uRayCol * .5 * uLightFx.z) * s2 * s2 * (.25 + .75 * lit) * edge * .5;
  // 浪头上的高光：迎着日月的浪坡被照得最亮，随浪一起滚过去；逆着光看时更显
  c += uRayCol * uLightFx.y * crest * crest * facing * lit * (.12 + .5 * s2 * s2) * (.5 + .5 * open);
  return c;
}

void main() {
  vec3 ro = cameraPosition, rd = normalize(vRay);
  if (ro.y > ${CEIL.toFixed(1)} && rd.y >= 0.) discard;
  float t = ro.y > ${CEIL.toFixed(1)} ? (ro.y - ${CEIL.toFixed(1)}) / -rd.y : 0.;
  float tEnd = rd.y > 0. ? min(${REACH.toFixed(1)}, (${CEIL.toFixed(1)} - ro.y) / rd.y) : ${REACH.toFixed(1)};
  if (t > tEnd) discard;
  t += pixelNoise(gl_FragCoord.xy) * max(1.5, t * .008);
  float squash = .5 * min(1. / max(abs(rd.y), .05), 7.);                                    // 视线越贴着云面，一个像素盖住的云面拉得越长，贴图就取得越糊（不然远处全是噪点）
  float seen = 1., first = -1., wsum = 0., gapWas = 1e3;
  vec3 acc = vec3(0.);
  // 上一步累积之前的样子和上一步加进去的东西：撞到山的时候，最后那一步只算到山为止的那一截（不然贴山的地方会出一圈圈台阶）
  float seenWas = 1., wsumWas = 0., lastA = 0., lastT = 0.;
  vec3 accWas = vec3(0.), lastC = vec3(0.);
  for (int i = 0; i < ${STEPS}; i++) {
    if (t > tEnd) break;
    vec3 p = ro + rd * t;
    float ground = groundAt(p.xz), gap = p.y - ground;
    if (gap < 0.) {
      float a = 1. - pow(1. - lastA, gapWas / (gapWas - gap));
      acc = accWas + seenWas * a * lastC; wsum = wsumWas + seenWas * a * lastT; seen = seenWas * (1. - a);
      break;
    }
    gapWas = gap; lastA = 0.; accWas = acc; seenWas = seen; wsumWas = wsum;
    float L = log2(t * .31 * squash + 1.), soft = 2. + t * .0035, pace = max(1., t * .0045);
    float top0 = seaTop(p.xz, L, -1.), fine = 1. / (1. + t / 420.);
    float fall = gap < 120. ? seaFall(p.xz) : 0., lay = max(fall * 2. - 1., 0.);            // 贴地的云只在离地近的时候查
    if (top0 - p.y > -soft - 34. || lay > 0.) {                                             // 留出贴山漫上来的那截和浪头上的云絮
      float sea = seaMask(p.xz), mask = smoothstep(.02, .35, sea);
      if (mask < .01 && lay <= 0.) { t += fall > 0. ? max(pace, gap * .3 + 1.5) : 6. + pace * 2.; continue; }
      // 云湾：云面朝着水口一路低下去，浪也跟着平下去（低处是一池静的雾）
      float raw = seaTop(p.xz, L, fine), bump = raw - top0, top = mix(${(LOW + SWELL * .53).toFixed(1)}, raw, sea) - ${DROP.toFixed(1)} * (1. - sea);
      // 贴着山的云往上漫一截，漫得有高有低。山有多近按周围四点的平均高度算（只看脚下这一点的话，崖壁上一格一跳，云边会跟着出一圈圈纹）
      float around = .25 * (groundAt(p.xz + vec2(8., 8.)) + groundAt(p.xz + vec2(-8., 8.)) + groundAt(p.xz + vec2(8., -8.)) + groundAt(p.xz - vec2(8., 8.)));
      // 还会一口一口地呼吸：漫上来、退下去，高处比低处慢半拍，看着是顺着山坡往上爬
      float creep = textureLod(uCloudMap, p.xz / 210. + uWind.xy * uTime * .009, L - 7.7).b;
      float breath = .5 + .5 * sin(uTime * .55 - around * .05 + creep * 5.);
      top = min(top + 24. * sea * smoothstep(60., 10., top - around) * (.3 + .7 * creep) * (.35 + .65 * breath), ${(CEIL - 2).toFixed(1)});   // 云湾里云面低而平，漫得也少
      // 云瀑和云舌：贴着地面的一层，顺着朝湖心的方向一缕一缕往里淌；越往下越薄，化掉
      if (lay > 0.) {
        vec2 fromLake = p.xz - vec2(${BOWL.x.toFixed(1)}, ${BOWL.z.toFixed(1)});
        float strand = textureLod(uCloudMap, vec2(atan(fromLake.x, fromLake.y) * 13., (length(fromLake) + uTime * 11.) / 170.), L - 6.4).b;
        float poured = around + ${FALL.toFixed(1)} * lay * (.6 + .4 * smoothstep(.2, .8, strand)) * (.75 + .25 * breath);
        if (poured > top) { top = poured; mask = smoothstep(0., .22, lay) * (.7 + .3 * strand); }
      }
      float sink = top - raw;
      float wisp = textureLod(uCloudMap, p.xz / 37. + p.y * vec2(.023, .014) + uWind.xy * uTime * .03, L - 5.2).b;
      // 云絮：浪头上被风扯出去的一缕缕，顺风拉长；越往上越往前卷、越淡，最后散掉
      vec2 gust = normalize(uWind.xy), tear = p.xz - uWind.xy * uTime * 11. - gust * (p.y - top) * 2.2;
      float streak = textureLod(uCloudMap, vec2(dot(tear, gust) / 230., dot(tear, vec2(-gust.y, gust.x)) / 64.) + (p.y - top) * vec2(.006, -.004), L - 6.6).b;
      float lift = min(16. * seaCrest(p.xz, L) * smoothstep(.48, .8, streak), ${(CEIL - 1).toFixed(1)} - top);
      float above = clamp((p.y - top) / max(lift, 1.), 0., 1.);
      float depth = top + lift * (1. - above * above * .3) - p.y + (wisp - .5) * 2.6 * soft * (.25 + .75 * fine);   // 云面不是一张光滑的皮：近看边缘被细絮啃得毛茸茸的
      if (depth > -soft) {
        float dens = smoothstep(-soft, soft, depth) * mask * (1. - .6 * above);
        lastA = 1. - exp(-dens * pace * 2.2 / soft); lastC = seaShade(p, top, sink, bump, depth, soft, L, fine, rd); lastT = t;
        acc += seen * lastA * lastC; wsum += seen * lastA * t; seen *= 1. - lastA;
        if (first < 0. && lastA > 0.) first = t - pace - 3.;                               // 深度取最先碰到云的地方再往前一点：只有真在云前面的东西才挡得住云（山的网格和高度图差着一两个单位，不留余量会在崖壁上闪出条纹）
        if (seen < .02) break;
        t += pace;
      } else t += max(pace, -(depth + soft) * .5);
    } else { float stride = max(pace, (p.y - top0 - soft - 34.) * .55 + 3.); t += fall > 0. ? min(stride, max(pace, gap * .3 + 1.5)) : stride; }
  }
  float alpha = 1. - seen;
  if (alpha < .01 || first < 0.) discard;
  float dist = wsum / alpha;
  // 云海自己只蒙远霭（云气和低雾是给山用的：云海本身就是那层白）
  float lit = mix(1., airLit(ro, rd, dist), uAirP.z);
  float haze = 1. - exp(-hazeDepth(ro, rd, dist) * .6);
  vec3 c = mix(acc / alpha, airColor(rd) + sunWash(rd) * lit * .6, haze) + rayGlow(rd, 8) * lit * (.25 + .75 * haze);   // 云缝的光柱斜斜地落在云海上空  alpha *= smoothstep(${REACH.toFixed(1)}, ${(REACH * .7).toFixed(1)}, dist);                // 最远处淡出，接到天边的霭里
  vec4 clip = projectionMatrix * viewMatrix * vec4(ro + rd * max(first, 1.5), 1.);
  gl_FragDepth = clip.z / clip.w * .5 + .5;
  gl_FragColor = vec4(c, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function buildClouds() {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));        // 一个盖住整屏的三角形
  const uniforms = { ...U, ...seasonal(SEASONS.春.u, 'uCloudLit', 'uCloudShade', 'uCloudDeep', 'uCloudRim') };
  const sea = new THREE.Mesh(geo, new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, transparent: true, depthWrite: false }));
  sea.frustumCulled = false; sea.renderOrder = 10;
  return sea;
}
