// 海浪：一组 Gerstner 波（每一道是一列朝一个方向推进的正弦波，水点沿圆走，所以浪峰尖、浪谷缓）。
// 同一张表三处用：海面网格的起伏（顶点着色器）、海面的朝向和浪沫（片元着色器）、岸上的冲刷和飞沫的时机（land、spray）。
//   大的八道真的推动网格：涌浪从海上斜着朝岸推（+z），大小、方向、快慢各不相同，叠在一起就有一组一组的「浪群」。
//   片元里再多算二十道小波（只管朝向），和随风跑的细纹，近处看得见波纹，远处按一个像素盖住多大的水面自动抹平。
// 波速按深水的色散关系：波长越长走得越快（ω² = g·k）。g 按「1 个单位 ≈ 0.85 米」折算。
const G = 11.5;
// [波长, 振幅, 方向（度，从 +z 量起，正的偏 +x）, 浪尖有多尖（0 到 1）, 初相]
const TABLE = [
  [46, .6, 8, .95, 0], [29, .4, -14, .95, 1.7], [19, .24, 24, .85, 4.1], [12.5, .13, -31, .8, 2.6],
  [8.1, .058, 39, .75, 5.3], [5.3, .036, -6, .7, .9], [3.4, .021, 56, .6, 3.8], [2.2, .013, -45, .6, 2.2],
];
export const WAVES = TABLE.map(([L, A, deg, sharp, phase]) => {
  const k = 2 * Math.PI / L, a = deg * Math.PI / 180;
  return { L, A, k, w: Math.sqrt(G * k), dx: Math.sin(a), dz: Math.cos(a), sharp, phase };
});
// 最大的那一道：飞沫按它的浪峰拍到礁石的时刻溅起来
export const MAIN = WAVES[0];

// 海面（不算水平的挪动）在 (x, z) 处、t 秒时的高度
export function seaHeight(x, z, t) {
  let y = 0;
  for (const v of WAVES) y += v.A * Math.sin(v.k * (v.dx * x + v.dz * z) - v.w * t + v.phase);
  return y;
}

const f = x => x.toFixed(5);
// 每一道波：vec4(方向 x, 方向 z, 波数, 振幅)，vec3(角频率, 尖, 初相)，以及波长
const each = fn => WAVES.map(v => fn(`vec4(${f(v.dx)}, ${f(v.dz)}, ${f(v.k)}, ${f(v.A)})`, `vec3(${f(v.w)}, ${f(v.sharp)}, ${f(v.phase)})`, f(v.L))).join('\n  ');

export const WAVES_GLSL = /* glsl */`
// 一道 Gerstner 波对位置的贡献。fade：这道波留几成（网格太粗、像素太大时抹掉）
void gerstner(vec2 xz, float t, vec4 W, vec3 P, float fade, inout vec3 pos) {
  float th = W.z * dot(W.xy, xz) - P.x * t + P.z, a = W.w * fade;
  pos.xz += W.xy * (P.y * a * cos(th));
  pos.y += a * sin(th);
}
// 网格的起伏。spacing：这一带网格的间距（比它短的波画不出来，抹掉）；damp：浅水处把浪压低几成
vec3 swellOffset(vec2 xz, float t, float spacing, float damp) {
  vec3 pos = vec3(0.);
  ${each((W, P, L) => `gerstner(xz, t, ${W}, ${P}, damp * smoothstep(2., 4.5, ${L} / spacing), pos);`)}
  return pos;
}
// 海面在这一点的高度（不算水平的挪动），岸上算冲刷用
float seaLevel(vec2 xz, float t) {
  vec3 pos = vec3(0.);
  ${each((W, P) => `gerstner(xz, t, ${W}, ${P}, 1., pos);`)}
  return pos.y;
}

// 一道波对朝向的贡献：坡度（x、z）累加到 g.xy，浪尖收紧累加到 g.z；被抹掉的那部分坡度记进 g.w（远处的水面因此显得「毛」，落日的倒影拉成一条光路）
void slopeOf(vec2 xz, float t, vec4 W, vec3 P, float fade, inout vec4 g) {
  float th = W.z * dot(W.xy, xz) - P.x * t + P.z, ka = W.z * W.w;
  g.xy += W.xy * (ka * cos(th) * fade);
  g.z += P.y * ka * sin(th) * fade;
  g.w += .5 * ka * ka * (1. - fade);
}
// 水面的坡度。footprint：一个像素盖住多大的水面。返回 xy：坡度；z：浪尖收紧了多少（浪沫看它）；w：被抹掉的坡度的方差
vec4 seaSlope(vec2 xz, float t, float footprint, float damp) {
  vec4 g = vec4(0.);
  ${each((W, P, L) => `slopeOf(xz, t, ${W}, ${P}, damp * smoothstep(1.5, 5., ${L} / footprint), g);`)}
  // 二十道小波：只管朝向。波长从 1.6 一路缩到 0.06，方向围着风向散开
  float L = 1.6;
  for (int i = 0; i < 20; i++) {
    float fi = float(i), ang = (fract(fi * .618034 + .13) * 2. - 1.) * 1.25 + .35, k = 6.2832 / L;
    vec4 W = vec4(sin(ang), cos(ang), k, L * .0065);
    slopeOf(xz, t, W, vec3(sqrt(${G.toFixed(1)} * k), 0., fi * 2.39), smoothstep(1.5, 5., L / footprint) * mix(1., damp, .5), g);
    L *= .84;
  }
  g.z *= damp;
  return g;
}`;
