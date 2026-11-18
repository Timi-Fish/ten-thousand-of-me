// 造型用的小工具：生成网格、扫出管子和带子、上色、合并。
// 小蟹身上所有部件用同一套顶点属性，这样可以合成一个网格、一次画完：
//   aCol 底色，aTint 纹样的颜色，aFx = [纹样编号, 描边粗细倍数, 慢摆的幅度, 快摆的幅度]，aId 归属（软体：1 = 皮肤；四肢：骨头编号），aHull 描边往哪个方向胀。
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const shades = new Map();
// 颜色（'#rrggbb'）转成着色用的线性 [r, g, b]
export function rgb(hex) {
  if (!shades.has(hex)) { const c = new THREE.Color(hex); shades.set(hex, [c.r, c.g, c.b]); }
  return shades.get(hex);
}
const linear = c => (typeof c === 'string' ? rgb(c) : c);
// 两个颜色（'#rrggbb' 或线性 [r, g, b]）之间取一个
export const blend = (a, b, k) => { const p = linear(a), q = linear(b); return [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k, p[2] + (q[2] - p[2]) * k]; };

// 把共用同一个位置的顶点的法线取平均，写进 name 属性：接缝和尖顶不留折痕，描边胀开时不裂
export function weld(geo, name = 'normal') {
  const P = geo.attributes.position, N = geo.attributes.normal, sums = new Map(), keys = [];
  for (let i = 0; i < P.count; i++) {
    const key = `${Math.round(P.getX(i) * 2e3)},${Math.round(P.getY(i) * 2e3)},${Math.round(P.getZ(i) * 2e3)}`;
    if (!sums.has(key)) sums.set(key, [0, 0, 0]);
    const s = sums.get(key);
    s[0] += N.getX(i); s[1] += N.getY(i); s[2] += N.getZ(i);
    keys.push(key);
  }
  const out = new Float32Array(P.count * 3);
  keys.forEach((key, i) => { const s = sums.get(key), len = Math.hypot(...s); out.set(len > 1e-6 ? [s[0] / len, s[1] / len, s[2] / len] : [N.getX(i), N.getY(i), N.getZ(i)], i * 3); });
  geo.setAttribute(name, new THREE.BufferAttribute(out, 3));
  return geo;
}

// 网格面：f(a, b) 返回一个点 [x, y, z]，a、b 各从 0 走到 1。uv(a, b) 给纹样坐标
export function grid(nu, nv, f, uv = (a, b) => [a, b]) {
  const pos = [], uvs = [], idx = [], row = nu + 1;
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { pos.push(...f(i / nu, j / nv)); uvs.push(...uv(i / nu, j / nv)); }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * row + i; idx.push(a, a + 1, a + row + 1, a, a + row + 1, a + row); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return weld(geo);
}

// 沿一串点扫出一根管子。radius：数字，或 s => 半径（s 从 0 到 1）；flat：截面压扁成带子（厚 / 宽）；
// wide：带子宽的那个方向大致朝哪；两头收成圆头
export function tube(points, radius, { seg = 16, sides = 8, flat = 1, wide = [1, 0, 0] } = {}) {
  const pts = points.map(p => V(...p)), curve = pts.length > 2 ? new THREE.CatmullRomCurve3(pts) : new THREE.LineCurve3(pts[0], pts[1]);
  const rad = typeof radius === 'function' ? radius : () => radius, thin = typeof flat === 'function' ? flat : () => flat;
  let side = V(...wide);
  const frame = s => {                                              // 截面的两个方向：side 贴着 wide，一路顺着曲线带过去，不突然翻面
    const tan = curve.getTangent(s);
    side = side.clone().addScaledVector(tan, -side.dot(tan));
    if (side.lengthSq() < 1e-8) side = Math.abs(tan.y) < .9 ? V(0, 1, 0).cross(tan) : V(1, 0, 0).cross(tan);
    side.normalize();
    return { at: curve.getPoint(s), tan, side: side.clone(), up: tan.clone().cross(side) };
  };
  const geo = grid(sides, seg + 2, (a, b) => {                      // 首尾各多一圈，缩成一个点当圆头
    const s = Math.min(1, Math.max(0, (b * (seg + 2) - 1) / seg)), cap = b === 0 ? -1 : b === 1 ? 1 : 0, f = frame(s), r = rad(s);
    if (cap) return f.at.addScaledVector(f.tan, cap * r * .7 * Math.min(1, thin(s) * 2)).toArray();
    const ang = a * 2 * Math.PI;
    return f.at.addScaledVector(f.side, Math.cos(ang) * r).addScaledVector(f.up, Math.sin(ang) * r * thin(s)).toArray();
  }, (a, b) => [b, a]);
  return geo;
}

// 绕 y 轴旋出来的形状。profile：[[半径, 高度], ...] 从下往上
export const lathe = (profile, seg = 24) => weld(new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg));
export const ball = (r = 1, seg = 14) => { const g = new THREE.SphereGeometry(1, seg, Math.max(6, Math.round(seg * .7))); const [x, y, z] = Array.isArray(r) ? r : [r, r, r]; g.scale(x, y, z); g.computeVertexNormals(); return weld(g); };
export const torus = (R, r, seg = 24, sides = 8) => new THREE.TorusGeometry(R, r, sides, seg);
// 摆放：位置、转角（弧度，先 x 再 y 再 z）、缩放
export function put(geo, { at = [0, 0, 0], rot = [0, 0, 0], scale = 1 } = {}) {
  const s = Array.isArray(scale) ? scale : [scale, scale, scale];
  return geo.applyMatrix4(new THREE.Matrix4().compose(V(...at), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), V(...s)));
}

const each = (v, at, uv) => (typeof v === 'function' ? v(at, uv) : v);
// 给部件上色并补齐属性。col / tint：'#rrggbb'、[r, g, b]，或 (位置, uv) => 两者之一；flex：数字（慢摆）、[慢, 快]，或 (位置, uv) => 两者之一；
// pat：纹样编号；uv：把部件原有的 uv 换算成纹样坐标
export function dress(geo, { col = '#ffffff', tint = col, pat = 0, ink = 1, flex = 0, id = 0, uv: remap = st => st } = {}) {
  const src = geo.index ? geo : mergeVertices(geo), P = src.attributes.position, U = src.attributes.uv, n = P.count;
  const aCol = new Float32Array(n * 3), aTint = new Float32Array(n * 3), aFx = new Float32Array(n * 4), aId = new Float32Array(n), uv = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const at = [P.getX(i), P.getY(i), P.getZ(i)], st = U ? [U.getX(i), U.getY(i)] : [0, 0], f = each(flex, at, st);
    aCol.set(linear(each(col, at, st)), i * 3); aTint.set(linear(each(tint, at, st)), i * 3);
    aFx.set([pat, each(ink, at, st), ...(Array.isArray(f) ? f : [f, 0])], i * 4);
    aId[i] = each(id, at, st); uv.set(remap(st), i * 2);
  }
  const out = new THREE.BufferGeometry();
  out.setIndex(src.index);
  out.setAttribute('position', P); out.setAttribute('normal', src.attributes.normal);
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setAttribute('aCol', new THREE.BufferAttribute(aCol, 3)); out.setAttribute('aTint', new THREE.BufferAttribute(aTint, 3));
  out.setAttribute('aFx', new THREE.BufferAttribute(aFx, 4)); out.setAttribute('aId', new THREE.BufferAttribute(aId, 1));
  return out;
}
// 把上好色的部件合成一个网格
export function join(...parts) {
  const geo = mergeGeometries(parts.flat(Infinity).filter(Boolean));
  return weld(geo, 'aHull');
}
