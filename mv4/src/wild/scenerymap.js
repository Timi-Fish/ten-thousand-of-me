// 大远景布景的底图：抱湖那两臂山梁的极坐标，谷底的孤山、湖和小洲、梯田在哪。只有数据和纯函数，雕地形、种树、摆村子的都读这里。
import { fbm, smooth, clamp } from './noise.js';
import { BOWL, D2R, crestR, crestH, crestWidth, mouthOpen } from './ranges.js';
import { valeAt, MOUTH_Z } from './outland.js';

export { D2R, crestR, crestH, crestWidth, mouthOpen };               // 脊线离湖心多远、多高、内坡多宽、水口敞开几成（ranges.js）
// 极坐标：φ 从正北顺时针量（正东 90°），rho 离湖心 BOWL 多远。和 ranges.js 同一套
export const polar = (x, z) => { const dx = x - BOWL.x, dz = z - BOWL.z; return { phi: Math.atan2(dx, -dz), rho: Math.hypot(dx, dz) }; };
export const fromPolar = (phi, rho) => [BOWL.x + rho * Math.sin(phi), BOWL.z - rho * Math.cos(phi)];
export const southOf = phi => (1 - Math.cos(phi)) / 2;

// 谷底的孤山：[x, z, 半径, 高, 崖朝哪（°）]。南面两座一左一右守着水口
export const KNOLLS = [[-190, 640, 46, 78, 200], [-330, 955, 52, 64, 120], [275, 1060, 40, 52, 290], [130, 1110, 32, 40, 30], [-158, 1150, 38, 48, 330], [330, 940, 30, 34, 250]];
// 湖：中心、东西和南北的半径；湖汊（从哪到哪、多宽）
export const LAKE = { x: -20, z: 925, rx: 235, rz: 118, arm: [[-200, 950], [-300, 1005], 40] };
// 湖面那张面片铺到哪（比湖大，岸线由地形的高度定）。出了它的南缘，低过湖面的地面是出谷的谷底，不是湖底：照样长草木、积雪、住人
export const WATER = { x0: -470, x1: 470, z0: 730, z1: 1160 };
// 小洲：[x, z, 半径, 高]
export const ISLES = [[-70, 955, 24, 7], [120, 985, 13, 5], [-215, 915, 11, 4], [20, 1005, 9, 3.5]];

// 湖：(x, z) 在湖里多深（正，按半径的几成算）或离岸多远（负）
export function lakeDepth(x, z) {
  const dx = (x - LAKE.x) / LAKE.rx, dz = (z - LAKE.z) / LAKE.rz, a = Math.atan2(dz, dx), r = Math.hypot(dx, dz);
  const edge = 1 + .2 * Math.sin(3 * a + 1.1) + .1 * Math.sin(5 * a + 2.3) + .14 * (fbm(Math.cos(a) * 1.7 + 4.1, Math.sin(a) * 1.7 + 8.3, 3) - .5);
  let s = 1 - r / edge;
  const [[ax, az], [bx, bz], w] = LAKE.arm, ex = bx - ax, ez = bz - az, k = clamp(((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez)), arm = Math.hypot(x - ax - ex * k, z - az - ez * k);
  return Math.max(s, (1 - arm / (w * (1 - .45 * k))) * .45);
}

// 梯田：一级多高；这一处有几成是梯田（0 到 1）。地形和着色器用同一个函数
export const TERRACE = 2.2;
export function fieldMask(x, z, h) {
  const patch = smooth(.45, .56, fbm(x / 140 + 61.3, z / 140 + 17.9, 3)), low = Math.max(smooth(2.5, 7, h) * smooth(70, 45, h), inVale(x, z));   // 出谷的谷底整条都能种
  return patch * low * smooth(240, 300, polar(x, z).rho) * inBowl(x, z) * smooth(560, 620, z) * smooth(-.02, -.12, lakeDepth(x, z));
}
// 在不在出谷的谷底上（1 在谷底，往两岸渐渐到 0；只算水口内外、云还没盖住的那一段）
export const VALE_END = 1470;                                     // 出谷里的田、人家、路边的石灯到这里为止（再往南云舌漫上来了）
export function inVale(x, z) {
  if (z < MOUTH_Z - 190 || z > VALE_END) return 0;
  const v = valeAt(z);
  return smooth(v.half + 26, v.half - 8, Math.abs(x - v.x)) * smooth(VALE_END, VALE_END - 90, z);
}
// 在不在人住的地方（1 在山梁以内，离脊线往里 40 以上，或在出谷的谷底；0 在梁上或梁外的云海那一侧）
export function inBowl(x, z) {
  const { phi, rho } = polar(x, z);
  return Math.max(smooth(-20, -60, rho - crestR(phi)), inVale(x, z));
}
