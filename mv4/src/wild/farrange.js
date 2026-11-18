// 远山：云海外面一重重的山。山形分五遍做出来，不是一条公式直接算出轮廓：
//   一、山系——大尺度上哪里连成高高的一列、哪里塌下去一个缺口（低频噪声，坐标先扭一遍，山系的走向是弯的）；
//   二、棱线——山体上分出主脊、支脊、小支脊三级（脊状噪声），脊顶是磨圆的，不是折出来的尖棱；
//   三、崩塌——整片远山取样成格网，按各处岩石的休止角一遍遍让陡过头的坡往下滑（热力侵蚀）：
//             孤立的尖峰塌成山肩，坡脚堆出缓缓的裙坡，没有哪一面比那里的休止角更陡；
//   四、冲沟——崩塌之后在坡面上刻出一道道往下走的沟和肋（只长在坡上，脊顶和谷底不刻）；
//   五、取样——格网上按双三次插值（坡面是圆顺的，没有格子的折线），再叠一层很浅的碎起伏。
// 远山看上去的样子因此是：一重重有起有伏的山脊线，坡度二三十度到四十来度，山头是钝的。
import { vnoise, fbm, smooth, lerp, clamp } from './noise.js';

const GRID = { x0: -4800, z0: -4480, cell: 25, n: 385 };              // 和 heights.js 的远处格网同一片地方，格子细一半
const CENTER = { x: 0, z: 500 }, INNER = [950, 1500];                 // 远山从离湖心这么远起，到这么远长足
const SLIDES = 160;                                                   // 崩塌走多少遍

// 磨圆的脊状噪声，0 到 1：每层噪声折成脊，折的地方磨圆（round：磨多宽）；脊上再长小脊
function ridges(x, y, octaves, round = .12) {
  let sum = 0, amp = .5, norm = 0, weight = 1;
  for (let k = 0; k < octaves; k++) {
    const fold = 2 * vnoise(x, y) - 1, v = clamp(1 + round - Math.sqrt(fold * fold + round * round)) ** 2;
    sum += amp * v * weight; norm += amp; weight = clamp(v * 1.7); amp *= .5;
    const nx = 1.6 * x - 1.2 * y + 31.3; y = 1.2 * x + 1.6 * y + 11.9; x = nx;
  }
  return sum / norm;
}

// 一、二：还没崩塌过的山形
function raw(x, z) {
  const far = Math.hypot(x - CENTER.x, z - CENTER.z), grow = smooth(INNER[0], INNER[1], far);
  if (grow <= 0) return 0;
  const wx = x + 260 * (fbm(x / 900 + 1.3, z / 900 + 5.1, 3) - .5), wz = z + 260 * (fbm(x / 900 + 8.7, z / 900 + 2.9, 3) - .5);
  const lofty = .3 + 1.5 * smooth(.3, .72, fbm(x / 1500 + 6.1, z / 1500 + 3.7, 2));
  const mass = ridges(wx / 640 + 3.1, wz / 640 + 8.7, 3), side = ridges(wx / 230 + 7.9, wz / 230 + 1.3, 3), knob = fbm(x / 85 + 5.3, z / 85 + 2.7, 3);
  const crest = mass ** 1.3 * (.66 + .44 * side) + .08 * side * mass + .04 * knob * smooth(.25, .6, mass);
  return grow * (260 + 420 * smooth(1400, 4200, far)) * crest * (.45 + 1.1 * fbm(x / 2100 + 9.3, z / 2100 + 2.2, 2)) * lofty;
}

let H = null;
function build() {
  const { x0, z0, cell, n } = GRID, h = new Float32Array(n * n), talus = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = x0 + i * cell, z = z0 + j * cell, k = j * n + i;
    h[k] = raw(x, z);
    talus[k] = cell * (.58 + .62 * smooth(.3, .75, fbm(x / 520 + 4.7, z / 520 + 1.9, 3)));   // 这里的岩石站得住多陡的坡（一格的落差）：三十度出头到五十度
  }
  // 三：崩塌。每一遍里，一个点比它最低的邻点高出休止角允许的落差，就把多出来的一半滑给那个邻点；来回扫，不偏向哪一边
  const NEAR8 = [[-1, 0, 1], [1, 0, 1], [0, -1, 1], [0, 1, 1], [-1, -1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [1, 1, Math.SQRT2]];
  const hop = Int32Array.from(NEAR8, ([a, b]) => b * n + a), span = Float64Array.from(NEAR8, ([, , d]) => d), inner = n - 2, cells = inner * inner;
  for (let round = 0; round < SLIDES; round++) {
    const back = round & 1;
    for (let q = 0; q < cells; q++) {
      const p = back ? cells - 1 - q : q, k = (1 + Math.floor(p / inner)) * n + 1 + p % inner, here = h[k];
      if (here <= 0) continue;
      const rest = talus[k];
      let worst = 0, to = -1;
      for (let e = 0; e < 8; e++) { const over = (here - h[k + hop[e]]) / span[e] - rest; if (over > worst) { worst = over; to = k + hop[e]; } }
      if (to >= 0) { const slide = .5 * worst; h[k] -= slide; h[to] += slide; }
    }
  }
  // 四：冲沟。坡越陡沟越深；沟的纹路是磨圆的脊状噪声（脊是肋，脊之间是沟）
  const out = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = j * n + i, a = h[j * n + Math.max(0, i - 1)], b = h[j * n + Math.min(n - 1, i + 1)], c = h[Math.max(0, j - 1) * n + i], d = h[Math.min(n - 1, j + 1) * n + i];
    const slope = Math.hypot(b - a, d - c) / (2 * cell), x = x0 + i * cell, z = z0 + j * cell;
    const rib = ridges(x / 150 + 2.3, z / 150 + 6.7, 3, .2), fine = ridges(x / 62 + 9.1, z / 62 + 3.3, 2, .25);
    const far = Math.hypot(x - CENTER.x, z - CENTER.z);
    out[k] = Math.max(0, h[k] - (26 * (1 - rib) + 9 * (1 - fine)) * smooth(.18, .55, slope) * smooth(30, 140, h[k])) * smooth(INNER[0] - 70, INNER[0] + 10, far);   // 滑进湖那一圈以内的碎石不算
  }
  return out;
}

// 五：远山在 (x, z) 高出谷底多少
const cubic = (a, b, c, d, t) => b + .5 * t * (c - a + t * (2 * a - 5 * b + 4 * c - d + t * (3 * (b - c) + d - a)));
export function farRange(x, z) {
  H ??= build();
  const { x0, z0, cell, n } = GRID, fx = clamp((x - x0) / cell, 1, n - 2.0001), fz = clamp((z - z0) / cell, 1, n - 2.0001), i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
  const row = r => { const k = clamp(j + r, 0, n - 1) * n + i; return cubic(H[k - 1], H[k], H[k + 1], H[Math.min(k + 2, clamp(j + r, 0, n - 1) * n + n - 1)], u); };
  const h = Math.max(0, cubic(row(-1), row(0), row(1), row(2), v));
  return h + 7 * (fbm(x / 34 + 13.7, z / 34 + 2.1, 3) - .5) * smooth(25, 110, h);
}
