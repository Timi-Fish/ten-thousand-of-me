// 书案模块共用的造型工具：沿矩形一圈扫出线脚、沿直线拉出截面、车出回转体。
import * as THREE from 'three';

function finish(pos, uv, index) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}
const arcLength = pts => pts.reduce((arc, p, i) => { arc.push(i ? arc[i - 1] + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0); return arc; }, []);

// 沿矩形（x0..x1, z0..z1）的四条边扫出线脚，四角斜接。profile：[[向外的偏移, 高度, 明暗], ...]，从上往下。
// 明暗写进顶点色：凸出来常被摸到的棱大于 1（磨亮了），凹进去的槽小于 1（积灰、背光）。
// uv：u 沿着边走，v 沿着截面走，都按 uvScale 个单位一格；四条边各用一段不同的木纹
export function sweepRect(profile, x0, x1, z0, z1, uvScale = 1) {
  const pos = [], uv = [], color = [], index = [], arc = arcLength(profile);
  [[x0, z1, x1, z1], [x1, z1, x1, z0], [x1, z0, x0, z0], [x0, z0, x0, z1]].forEach(([ax, az, bx, bz], side) => {
    const len = Math.hypot(bx - ax, bz - az), tx = (bx - ax) / len, tz = (bz - az) / len, nx = -tz, nz = tx, base = pos.length / 3;
    profile.forEach(([o, y, shade], i) => {
      pos.push(ax + (nx - tx) * o, y, az + (nz - tz) * o, bx + (nx + tx) * o, y, bz + (nz + tz) * o);
      uv.push(-o / uvScale, arc[i] / uvScale + side * .37, (len + o) / uvScale, arc[i] / uvScale + side * .37);
      color.push(shade, shade, shade, shade, shade, shade);
    });
    for (let i = 0; i < profile.length - 1; i++) { const a = base + i * 2; index.push(a, a + 2, a + 3, a, a + 3, a + 1); }
  });
  const geo = finish(pos, uv, index);
  geo.setAttribute('color', new THREE.Float32BufferAttribute(color, 3));
  return geo;
}
// 给没有顶点色的造型补上全白的顶点色（和带顶点色的造型共用一个材质时要用）
export function whiten(geo) {
  geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 3).fill(1), 3));
  return geo;
}

// 把一个闭合截面沿 z 拉成一段管子（从 z0 到 z1，两头不封口）。section：[[x, y], ...]，从 +z 一侧看是逆时针。
// uv：u 沿着长度从 0 到 1，v 沿着截面的周长从 0 到 1
export function extrudeZ(section, z0, z1) {
  const pos = [], uv = [], index = [], n = section.length, loop = [...section, section[0]], arc = arcLength(loop), total = arc[n];
  loop.forEach(([x, y], i) => { pos.push(x, y, z0, x, y, z1); uv.push(0, arc[i] / total, 1, arc[i] / total); });
  for (let i = 0; i < n; i++) { const a = i * 2; index.push(a, a + 2, a + 3, a, a + 3, a + 1); }
  return finish(pos, uv, index);
}
// 管子的封口：截面在 z 处的一片，facing = 1 朝 +z，-1 朝 -z。uv 把截面的外接矩形铺满 0 到 1（朝 -z 的一面左右翻过来，图案不会反）
export function capZ(section, z, facing) {
  const pos = [], uv = [], index = [], xs = section.map(p => p[0]), ys = section.map(p => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const tris = THREE.ShapeUtils.triangulateShape(section.map(([x, y]) => new THREE.Vector2(x, y)), []);
  const [p, q, r] = tris[0].map(i => section[i]), ccw = (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]) > 0;   // 三角剖分给出的绕向
  section.forEach(([x, y]) => { const u = (x - x0) / (x1 - x0); pos.push(x, y, z); uv.push(facing > 0 ? u : 1 - u, (y - y0) / (y1 - y0)); });
  for (const [a, b, c] of tris) index.push(a, ccw === facing > 0 ? b : c, ccw === facing > 0 ? c : b);
  return finish(pos, uv, index);
}

// 回转体：profile 是 [[半径, 高度], ...]。uv：u 绕一圈，v 沿截面按长度从 0 到 1。
// planar 给一个半径时，改用从上往下看的平面 uv（圆心在贴图正中，planar 对应贴图的边），画在盖面、盘面上的图案用这个
export function lathe(profile, segments = 48, planar = 0) {
  const geo = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 1e-4), y)), segments), uv = geo.attributes.uv, pos = geo.attributes.position, arc = arcLength(profile), n = profile.length;
  for (let i = 0; i < uv.count; i++) {
    if (planar) uv.setXY(i, .5 + pos.getX(i) / planar / 2, .5 - pos.getZ(i) / planar / 2);
    else uv.setY(i, arc[i % n] / arc[n - 1]);
  }
  return geo;
}
// 一条带子：沿着 points（[[x, y, z], ...]）走的平滑曲线，宽 width，带面大致朝上
export function ribbon(points, width, samples = 24) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), pos = [], uv = [], index = [], up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i <= samples; i++) {
    const k = i / samples, p = curve.getPoint(k), side = curve.getTangent(k).cross(up);
    if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
    side.normalize().multiplyScalar(width / 2);
    pos.push(p.x - side.x, p.y - side.y, p.z - side.z, p.x + side.x, p.y + side.y, p.z + side.z); uv.push(0, k, 1, k);
    if (i) { const a = i * 2 - 2; index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  return finish(pos, uv, index);
}
// 从 a 到 b 的一根圆头小棍，半径 r
export function rod(a, b, r) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), geo = new THREE.CapsuleGeometry(r, va.distanceTo(vb), 3, 8);
  geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize()));
  geo.translate(...va.clone().add(vb).multiplyScalar(.5).toArray());
  return geo;
}
// 一个椭球：中心 c，三个方向的半径 s，绕 y 转 yaw
export function blob(c, s, yaw = 0) {
  const geo = new THREE.SphereGeometry(1, 18, 12);
  geo.scale(...s); geo.rotateY(yaw); geo.translate(...c);
  return geo;
}

// 把圆角一段段描出来：从 a0 到 a1（弧度）、半径 r、圆心 (cx, cy)，分 n 段，返回点列（含两端）
export function arcPoints(cx, cy, r, a0, a1, n = 6) {
  return Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; });
}
