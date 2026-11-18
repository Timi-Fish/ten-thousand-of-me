// 动画用的小工具：数学、缓动、姿势过渡。姿势就是一组数字，动作是姿势之间带缓动的过渡。
export const TAU = Math.PI * 2, D = Math.PI / 180;
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const prog = (t, a, b) => clamp((t - a) / (b - a));
export const pulse = (t, at, half) => 1 - clamp(Math.abs(t - at) / half);          // 在 at 时刻为 1，前后 half 秒内落到 0
export const rnd = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
export const ease = {
  lin: k => k,
  io: k => k * k * (3 - 2 * k),
  out: k => 1 - (1 - k) ** 3,
  in: k => k ** 3,
  back: k => { const c = 1.9; return 1 + (c + 1) * (k - 1) ** 3 + c * (k - 1) ** 2; },   // 冲过头再回来
};
export function mix(a, b, k) {
  if (typeof a === 'number') return lerp(a, b, k);
  if (Array.isArray(a)) return a.map((v, i) => mix(v, b[i], k));
  const o = {};
  for (const key in a) o[key] = key in b ? mix(a[key], b[key], k) : a[key];
  return o;
}
// key(t, [[时刻, 姿势, 缓动], ...]) 返回 t 时刻的姿势
export function key(t, frames) {
  if (t <= frames[0][0]) return frames[0][1];
  for (let i = 1; i < frames.length; i++) {
    const [t1, p1, e = 'io'] = frames[i], [t0, p0] = frames[i - 1];
    if (t <= t1) return mix(p0, p1, ease[e](prog(t, t0, t1)));
  }
  return frames[frames.length - 1][1];
}
// 阶梯轨道：[[时刻, 值], ...]，返回 t 时刻生效的那个值（不做过渡）
export const stepAt = (t, track) => track.reduce((v, [at, val]) => (t >= at ? val : v), track[0][1]);
export const bez = (a, c, b, k) => a.map((_, i) => (1 - k) ** 2 * a[i] + 2 * (1 - k) * k * c[i] + k * k * b[i]);   // 二次贝塞尔上的点
