// 天上的云（着色器代码，拼进 sky.js）。云层弯成球面用的 shellHit 在 air.js 里（云缝的光柱也要用）。两层：
//   低一层是有体积的云团——沿视线在云层的厚度里一步步走，每一步再朝日月走几步，看这一点被前面的云挡了多少光。
//     所以迎光的一侧亮、背光的一侧和云底沉下去偏冷；逆光看过去，薄的边缘被光打透，镶一道亮边。
//     云底是平的，云顶随云团的厚实程度长高，边缘被一粒粒小云包啃成菜花的轮廓。云层跟着大地一起弯下去，远处的云沉到天边后面。
//   高一层是卷云——很高很薄的丝缕，顺着一个方向拉得很长，只染上日月的颜色，不挡光。
// 云的平面分布（哪里有云）在 air.js 的 hiColumn 里：地上的云影、湖里的云影和这里是同一片云。
export const SKY_CLOUDS = /* glsl */`
uniform vec3 uHiLit, uHiShade, uHiRim;
const int HI_STEPS = 60, HI_SUN_STEPS = 5;

// 云的浓度，0 到 1。h：这一点在云层里的高度（0 云底，1 云层的顶）；lod：按远近取贴图的哪一级；fine：边缘啃不啃细节
// 边上的小云包随高度错开、随时间慢慢绕圈（云团在翻卷）；丝絮那一层流得快，边缘的丝一缕缕地生出来又散掉
float hiDensity(vec2 xz, float h, float lod, float fine, float more) {
  if (h <= 0. || h >= 1.) return 0.;
  vec2 q = hiCoord(xz);
  float col = hiColumn(q, lod, more);
  if (col <= 0.) return 0.;
  // 云顶一起一伏：两道走向、快慢不同的波（sin / cos）从云团上推过去，云头一鼓一落
  float billow = .09 * sin(dot(q, vec2(23., 9.)) - uTime * 1.1) + .06 * cos(dot(q, vec2(-11., 27.)) + uTime * .8);
  float d = min(min(h * 9., ((.22 + .78 * col) * (1. + billow) - h) * 3.2), col * 1.7);   // 云底平、收得急；云顶圆，越厚实的云柱长得越高
  if (d <= 0.) return 0.;
  float turn = uTime * .22;
  vec2 roll = vec2(cos(turn), sin(turn)) * .06;
  float puff = textureLod(uCloudMap, q * 5.3 + vec2(.83, -.47) * h * uHiQ.y + roll + uTime * vec2(.012, -.018), lod + 2.4).g;
  float wisp = textureLod(uCloudMap, q * 14.1 - vec2(.31, .59) * h * uHiQ.y - uTime * vec2(.027, .018), lod + 3.8).b;
  d -= ((1. - puff) * .62 + (1. - wisp) * (.14 + .12 * sin(uTime * .7 + puff * 9.))) * fine;
  return clamp(d * 2.6, 0., 1.);
}

// 沿视线走过云层。返回 rgb：云的颜色（已经乘了有多不透）；a：还剩几成能看到云后面。dist：看到的云平均离多远
vec4 hiClouds(vec3 ro, vec3 rd, float jitter, out float dist) {
  dist = 0.;
  if (rd.y < -.015 || uHiP.x <= 0.) return vec4(0., 0., 0., 1.);
  float span = HI_SPAN * uHiQ.y, t0 = shellHit(ro, rd, HI_BASE), t1 = min(shellHit(ro, rd, HI_BASE + span), t0 + 7000.);
  float ds = (t1 - t0) / float(HI_STEPS), t = t0 + ds * jitter, seen = 1., wsum = 0., curve = (1. - rd.y * rd.y) / (2. * HI_R);
  float sunward = max(dot(rd, uSunDir), 0.), s2 = sunward * sunward, fwd = s2 * s2 * s2;
  float more = uHiQ.w * exp(-rd.y * 5.) - .5 * pow(sunward, 48.);                      // 朝天边云多一些：远处的云连成一带；日月跟前让出一块，不把它盖死
  float sigma = .02 * uHiP.y;
  vec3 acc = vec3(0.);
  for (int i = 0; i < HI_STEPS; i++) {
    vec3 p = ro + rd * t;
    float h = (ro.y + rd.y * t + t * t * curve - HI_BASE) / span, lod = log2(t * 7e-5 / uHiQ.x);
    float dens = hiDensity(p.xz, h, lod, 1., more);
    if (dens > .004) {
      float tau = 0., reach = 0., seg = 46.;
      for (int j = 0; j < HI_SUN_STEPS; j++) {
        reach += seg;
        tau += hiDensity(p.xz + uSunDir.xz * reach, h + uSunDir.y * reach / span, lod + 1., .6, more) * seg;
        seg *= 1.7;
      }
      tau *= sigma;
      float lit = .68 * exp(-tau * .85) + .32 * exp(-tau * .13);                        // 透进来的光：大部分很快被挡掉，小部分在云里散开、透得深
      // 逆光的金边：薄处透光；边上流过一层细碎的浓淡，金边一闪一闪
      float shimmer = textureLod(uCloudMap, hiCoord(p.xz) * 11. + uTime * vec2(.0045, -.003), lod + 3.).g;
      float rim = fwd * exp(-tau * 1.5) * (.35 + .65 * (1. - dens)) * (1. + uLightFx.z * (1.1 * shimmer - .4));
      vec3 c = mix(uHiShade * mix(.74, 1.08, h), uHiLit, lit) + (uHiRim + uRayCol * .6 * uLightFx.z) * rim;
      float a = 1. - exp(-dens * sigma * ds);
      acc += seen * a * c; wsum += seen * a * t; seen *= 1. - a;
      if (seen < .012) break;
    }
    t += ds;
  }
  dist = wsum / max(1. - seen, 1e-4);
  return vec4(acc, seen);
}

// 卷云：只算一层薄片。返回 rgb：颜色；a：有多浓
vec4 hiCirrus(vec3 ro, vec3 rd) {
  if (rd.y < .005 || uHiP.z <= 0.) return vec4(0.);
  float t = shellHit(ro, rd, 4600.);
  vec2 p = ro.xz + rd.xz * t + uWind.xy * uTime * 150. * uHiP.w;
  vec2 q = vec2(dot(p, vec2(.906, .423)) * .36, dot(p, vec2(-.423, .906))) / 5200.;     // 顺着走向拉长近三倍
  float lod = log2(t * 6e-5);
  float sheet = textureLod(uCloudMap, q * .31 + vec2(.6, .2), lod - 1.7).b;             // 哪一片天有卷云
  q += (textureLod(uCloudMap, q * .7 + vec2(.15, .55) + uTime * vec2(.008, .005), lod - .5).ba - .5) * .16;   // 丝缕不是笔直的：整片地弯一弯，弯法慢慢在变
  float comb = textureLod(uCloudMap, q + vec2(sheet * .25, 0.), lod).b, fine = textureLod(uCloudMap, q * vec2(2.3, 3.7) + vec2(.2, comb * .12), lod + 1.5).a;
  float d = smoothstep(.56 - .3 * uHiP.z, .92 - .22 * uHiP.z, sheet * .5 + comb * .5) * (.45 + .75 * fine);
  d *= exp(-t / 26000.) * smoothstep(.005, .09, rd.y);
  float sunward = max(dot(rd, uSunDir), 0.), s2 = sunward * sunward;
  vec3 c = mix(uHiShade, uHiLit, .82) + uHiRim * (.2 * s2 + .5 * s2 * s2 * s2 * s2);
  return vec4(c, clamp(d, 0., 1.) * .62);
}`;
