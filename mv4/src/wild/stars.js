// 冬夜的星和银河（着色器代码，拼进 sky.js）。
// 星：把天球按立方体的六个面分成小格，少数格子里有一颗，位置、亮度、冷暖、闪烁的快慢各不相同。
//   两层：稀而亮的大星，密而暗的碎星；银河那一带碎星格外密。
// 银河：斜跨天空的一条光带，里面有疏密，正中有几道暗的尘带。
// 靠近天边的星被霭吃掉，月亮周围的星被月光盖掉。
export const STARS = /* glsl */`
const vec3 MILKY_POLE = vec3(.4214, .3813, -.8228);          // 银河所在的大圆的法线

// 一层星。n：每个面分成几格；chance：有星的格子占几成；radius：星的大小（按格宽算）；shift：换一套随机数
vec3 starLayer(vec3 rd, float n, float chance, float radius, vec2 shift) {
  vec3 a = abs(rd); vec2 uv; float face;
  if (a.y >= a.x && a.y >= a.z) { uv = rd.xz / a.y; face = rd.y > 0. ? 0. : 1.; }
  else if (a.x >= a.z) { uv = rd.yz / a.x; face = rd.x > 0. ? 2. : 3.; }
  else { uv = rd.xy / a.z; face = rd.z > 0. ? 4. : 5.; }
  vec2 g = uv * n, cell = floor(g);
  vec4 h = texture2D(uNoise, (cell + shift + face * vec2(41., 67.) + .5) / 256.);
  float mag = h.a * h.a, r = radius * (.55 + .9 * mag);
  float spot = smoothstep(r, r * .2, length(fract(g) - .5 - (h.gb - .5) * .56)) * step(h.r, chance);
  float twinkle = .7 + .3 * sin(uTime * (1.3 + 4. * h.b) + h.a * 50.);
  return mix(vec3(1., .84, .68), vec3(.7, .83, 1.), h.g) * spot * twinkle * (.35 + 1.9 * mag * mag);
}

// 银河。返回 rgb：光带的颜色；a：这里的碎星该多密（0 到 1）
vec4 milkyWay(vec3 rd) {
  float b = dot(rd, MILKY_POLE);
  vec3 e1 = normalize(cross(MILKY_POLE, vec3(0., 1., 0.))), e2 = cross(MILKY_POLE, e1);
  vec2 q = vec2(atan(dot(rd, e2), dot(rd, e1)) / 6.2832 * 2., b * .85);
  float cloud = textureLod(uCloudMap, q + vec2(.13, .4), 1.).b, knots = textureLod(uCloudMap, q * 2.6 + vec2(.5, .1), 0.).a, dust = textureLod(uCloudMap, q * vec2(1.4, 2.4) + vec2(.71, .27), 0.).b;
  float wide = b / (.2 + .1 * cloud), core = b / .075;
  float band = exp(-wide * wide) * (.3 + 1.1 * smoothstep(.3, .8, cloud * .6 + knots * .4));
  band *= 1. - .78 * smoothstep(.46, .66, dust) * exp(-core * core);
  vec3 c = mix(vec3(.42, .55, 1.), vec3(1., .88, .76), exp(-core * core) * .7) * band * .085;
  return vec4(c, band);
}

// 整片星空。moonAng：这个方向离月亮多远（弧度）
vec3 starSky(vec3 rd, float moonAng) {
  vec4 mw = milkyWay(rd);
  vec3 c = mw.rgb + starLayer(rd, 46., .07, .06, vec2(0.)) * 1.5 + starLayer(rd, 150., .1 + .5 * mw.a, .13, vec2(113., 29.)) * (.5 + .5 * mw.a);
  return c * smoothstep(-.02, .32, rd.y) * (1. - .85 * exp(-moonAng / .22));
}`;
