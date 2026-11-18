// 屏风的木作和铜活用到的几何：带线脚的边梃和横枨（截面拉伸出来的棱柱）、委角的开光框、合页、包角、牙板。
// 尺寸都在屏风一扇的自身坐标里：x 向右，y 向上，z 朝看画的人；画心所在的平面是 z = 0。
import * as THREE from 'three';
import { mergeGeometries, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { grainUV, TAU } from './util.js';

export const FRONT = .24, BACK = -.48;                            // 边框的正面、背面相对画心平面的位置

// 把一个闭合截面（[a, z] 列表，逆时针）沿 y 从 y0 拉到 y1，得到一根棱柱；两端封口
export function prism(profile, y0, y1) {
  const pos = [], n = profile.length;
  for (let i = 0; i < n; i++) {
    const [ax, az] = profile[i], [bx, bz] = profile[(i + 1) % n];
    pos.push(ax, y0, az, bx, y1, bz, bx, y0, bz, ax, y0, az, ax, y1, az, bx, y1, bz);
  }
  const contour = profile.map(p => new THREE.Vector2(p[0], p[1]));
  for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(contour, [])) {
    const A = profile[a], B = profile[b], C = profile[c];
    pos.push(A[0], y1, A[1], C[0], y1, C[1], B[0], y1, B[1], A[0], y0, A[1], B[0], y0, B[1], C[0], y0, C[1]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return toCreasedNormals(g, .7);
}
// 一段圆弧上的点（不含起点）
const arc = (cx, cz, r, a0, a1, steps = 6) => Array.from({ length: steps }, (_, i) => { const a = a0 + (a1 - a0) * (i + 1) / steps; return [cx + r * Math.cos(a), cz + r * Math.sin(a)]; });
// 边梃的截面：宽 w（a 从 0 到 w，0 是挨着画心的里侧）。外侧的棱倒圆，里侧起一道圆线，圆线旁边压一道阴线
export function stileProfile(w) {
  const b = .075;
  return [[0, BACK], [w, BACK], [w, FRONT - .1], ...arc(w - .1, FRONT - .1, .1, 0, Math.PI / 2), [b * 2 + .07, FRONT], [b * 2 + .07, FRONT - .05], [b * 2, FRONT - .05], [b * 2, FRONT - .02],
    ...arc(b, FRONT - .02, b, 0, Math.PI, 8)];
}
// 横枨的截面：高 h，上下两个棱各起一道圆线
export function railProfile(h) {
  const b = .075;
  return [[0, BACK], [h, BACK], [h, FRONT - .02], ...arc(h - b, FRONT - .02, b, 0, Math.PI, 8), [h - b * 2, FRONT - .05], [h - b * 2 - .07, FRONT - .05], [h - b * 2 - .07, FRONT],
    [b * 2 + .07, FRONT], [b * 2 + .07, FRONT - .05], [b * 2, FRONT - .05], [b * 2, FRONT - .02], ...arc(b, FRONT - .02, b, 0, Math.PI, 8)];
}
// 竖着的边梃：x 从 xin（里侧）到 xout（外侧），可以在左也可以在右
export function stile(xin, xout, y0, y1) {
  const w = Math.abs(xout - xin), dir = Math.sign(xout - xin);
  const profile = stileProfile(w).map(([a, z]) => [xin + dir * a, z]);
  return grainUV(prism(dir > 0 ? profile : profile.reverse(), y0, y1), 1, .22, xin);
}
// 横着的枨：x 从 x0 到 x1，y 从 y0 到 y1
export function rail(x0, x1, y0, y1) {
  const g = prism(railProfile(y1 - y0), -(x1 - x0) / 2, (x1 - x0) / 2);
  g.rotateZ(Math.PI / 2);                                            // 截面的 a 变成 y，拉伸方向变成 x
  g.translate((x0 + x1) / 2, y0, 0);
  return grainUV(g, 0, .22, y0 * .37);
}
export function box(x0, x1, y0, y1, z0, z1, along = 1) {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).toNonIndexed();
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return grainUV(g, along, .22, x0 * .3 + y0 * .11);
}

// 委角长方：四个角各向里挖一个小圆弧
function notchedRect(path, x0, y0, x1, y1, r) {
  path.moveTo(x0 + r, y0); path.lineTo(x1 - r, y0); path.absarc(x1, y0, r, Math.PI, Math.PI / 2, true);
  path.lineTo(x1, y1 - r); path.absarc(x1, y1, r, -Math.PI / 2, Math.PI, true);
  path.lineTo(x0 + r, y1); path.absarc(x0, y1, r, 0, -Math.PI / 2, true);
  path.lineTo(x0, y0 + r); path.absarc(x0, y0, r, Math.PI / 2, 0, true);
  return path;
}
// 开光框：一圈委角的凸线，贴在板心上。范围 x0…y1，线宽 t，凸起 z0 到 z0 + rise
export function cartouche(x0, y0, x1, y1, r, t, z0, rise = .07) {
  const shape = notchedRect(new THREE.Shape(), x0, y0, x1, y1, r);
  shape.holes.push(notchedRect(new THREE.Path(), x0 + t, y0 + t, x1 - t, y1 - t, r));
  const g = new THREE.ExtrudeGeometry(shape, { depth: rise - .02, bevelEnabled: true, bevelSize: .02, bevelThickness: .02, bevelSegments: 2, curveSegments: 8 });
  g.translate(0, 0, z0);
  return grainUV(g, 0, .22);
}
// 牙板：上沿平直、下沿是壶门曲线（中间高、两肩有尖）的薄板，夹在两根腿之间
export function apron(x0, x1, yTop, yLow, z0, z1) {
  const w = x1 - x0, s = new THREE.Shape();
  s.moveTo(x0, yTop); s.lineTo(x1, yTop); s.lineTo(x1, yLow);
  s.bezierCurveTo(x1 - w * .06, yLow + (yTop - yLow) * .1, x1 - w * .1, yLow + (yTop - yLow) * .5, x1 - w * .2, yLow + (yTop - yLow) * .45);
  s.bezierCurveTo(x1 - w * .28, yLow + (yTop - yLow) * .42, x1 - w * .3, yLow + (yTop - yLow) * .72, x0 + w * .5, yLow + (yTop - yLow) * .78);
  s.bezierCurveTo(x0 + w * .3, yLow + (yTop - yLow) * .72, x0 + w * .28, yLow + (yTop - yLow) * .42, x0 + w * .2, yLow + (yTop - yLow) * .45);
  s.bezierCurveTo(x0 + w * .1, yLow + (yTop - yLow) * .5, x0 + w * .06, yLow + (yTop - yLow) * .1, x0, yLow);
  const g = new THREE.ExtrudeGeometry(s, { depth: z1 - z0, bevelEnabled: false, curveSegments: 10 });
  g.translate(0, 0, z0);
  return grainUV(g, 0, .22);
}

// 铜活都是薄片：一个轮廓拉出一点厚度，再点几颗钉头
function plate(shape, z, nails) {
  const parts = [new THREE.ExtrudeGeometry(shape, { depth: .022, bevelEnabled: true, bevelSize: .012, bevelThickness: .012, bevelSegments: 1, curveSegments: 8 })];
  for (const [x, y] of nails) { const nail = new THREE.SphereGeometry(.05, 8, 5, 0, TAU, 0, Math.PI / 2).toNonIndexed(); nail.rotateX(Math.PI / 2); nail.translate(x, y, .03); parts.push(nail); }
  const g = mergeGeometries(parts.map(p => { p.deleteAttribute('uv'); return p; }));
  g.translate(0, 0, z);
  return g;
}
// 合页的一片：竖长的铜片，上下两头是如意云头的尖。cx、cy 是中心，w、h 是宽高
export function hingeLeaf(cx, cy, w, h) {
  const s = new THREE.Shape(), x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2, t = h * .2;
  s.moveTo(x0, y0 + t); s.quadraticCurveTo(x0, y0 + t * .35, cx - w * .12, y0 + t * .3); s.quadraticCurveTo(cx, y0 + t * .25, cx, y0);
  s.quadraticCurveTo(cx, y0 + t * .25, cx + w * .12, y0 + t * .3); s.quadraticCurveTo(x1, y0 + t * .35, x1, y0 + t);
  s.lineTo(x1, y1 - t); s.quadraticCurveTo(x1, y1 - t * .35, cx + w * .12, y1 - t * .3); s.quadraticCurveTo(cx, y1 - t * .25, cx, y1);
  s.quadraticCurveTo(cx, y1 - t * .25, cx - w * .12, y1 - t * .3); s.quadraticCurveTo(x0, y1 - t * .35, x0, y1 - t);
  s.closePath();
  return plate(s, FRONT, [[cx, cy + h * .22], [cx, cy - h * .22], [cx, cy]]);
}
// 合页的轴：三节套筒叠成一根小圆柱，立在两扇相接的折缝上
export function hingeBarrel(h, r = .1) {
  const parts = [];
  for (let i = -1; i <= 1; i++) { const g = new THREE.CylinderGeometry(r, r, h / 3 - .03, 12).toNonIndexed(); g.translate(0, i * h / 3, 0); g.deleteAttribute('uv'); parts.push(g); }
  for (const s of [-1, 1]) { const cap = new THREE.SphereGeometry(r * 1.15, 10, 6).toNonIndexed(); cap.scale(1, .7, 1); cap.translate(0, s * h / 2, 0); cap.deleteAttribute('uv'); parts.push(cap); }
  return mergeGeometries(parts);
}
// 包角：贴在一扇的角上的曲尺形铜片，两条边的尽头收成云头。corner：角的位置；sx、sy：往哪边伸（±1）；w：边梃宽；h：横枨高；len：伸出多长
export function cornerPlate(corner, sx, sy, w, h, len) {
  const [cx, cy] = corner, s = new THREE.Shape(), X = d => cx + sx * d, Y = d => cy + sy * d;
  s.moveTo(X(0), Y(0)); s.lineTo(X(len), Y(0)); s.quadraticCurveTo(X(len + .12), Y(h * .5), X(len - .1), Y(h * .55));
  s.quadraticCurveTo(X(len - .25), Y(h * .6), X(len - .3), Y(h)); s.lineTo(X(w + .2), Y(h)); s.quadraticCurveTo(X(w), Y(h), X(w), Y(h + .2));
  s.lineTo(X(w), Y(len - .3)); s.quadraticCurveTo(X(w * .6), Y(len - .25), X(w * .55), Y(len - .1)); s.quadraticCurveTo(X(w * .5), Y(len + .12), X(0), Y(len));
  s.closePath();
  return plate(s, FRONT, [[X(w * .5), Y(h * .5)], [X(len * .7), Y(h * .45)], [X(w * .5), Y(len * .7)]]);
}
