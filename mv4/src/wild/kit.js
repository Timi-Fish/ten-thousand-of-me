// 造型工具：把一堆带颜色的小部件拼成一个网格（建筑、石灯、栏杆用），以及给它们上色的材质。
// 每个顶点带固有色（aCol）、自发光（aGlow：窗纸、灯芯，亮不亮跟季节表里的 uLamp 走）和质地（aMat：石、木、漆、粉墙、瓦、纸、金）。
// 质地决定着色器怎么画这块东西：木头有顺纹，漆面匀净只在棱上磨旧，粉墙挂着雨痕，瓦面一垄一垄深浅不一、背阴处长苔，石头有凿痕。
import * as THREE from 'three';
import { paint } from './paint.js';

export const MAT = { stone: 0, wood: 1, lacquer: 2, plaster: 3, tile: 4, paper: 5, gold: 6, rail: 7 };   // rail：风吹日晒的旧漆、铁件——近看和漆一样，远看褪成灰赭
const color = new THREE.Color(), M = new THREE.Matrix4(), E = new THREE.Euler(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
const UNIT = new THREE.BoxGeometry(1, 1, 1);
export const V = (x, y, z) => new THREE.Vector3(x, y, z);
// 位置、朝向（绕 y、x、z，弧度）、缩放 → 矩阵
export const place = (x, y, z, ry = 0, rx = 0, rz = 0, sx = 1, sy = sx, sz = sx) => new THREE.Matrix4().compose(P.set(x, y, z), Q.setFromEuler(E.set(rx, ry, rz, 'YXZ')), S.set(sx, sy, sz));

export class Kit {
  constructor() { this.pos = []; this.nor = []; this.col = []; this.glow = []; this.mat = []; this.kind = MAT.stone; }
  // 往后加的部件都是这种质地
  use(kind) { this.kind = kind; return this; }
  // 加一个部件：几何体、颜色、摆放的矩阵、自发光
  add(geo, hex, matrix = M.identity(), glow = 0) {
    const g = (geo.index ? geo.toNonIndexed() : geo.clone()).applyMatrix4(matrix), p = g.attributes.position, n = g.attributes.normal;
    color.set(hex);
    for (let i = 0; i < p.count; i++) { this.pos.push(p.getX(i), p.getY(i), p.getZ(i)); this.nor.push(n.getX(i), n.getY(i), n.getZ(i)); this.col.push(color.r, color.g, color.b); this.glow.push(glow); this.mat.push(this.kind); }
    return this;
  }
  // 一个长方块：宽、高、深，摆放的矩阵
  box(w, h, d, hex, matrix, glow = 0) { return this.add(UNIT, hex, M.copy(matrix).scale(S.set(w, h, d)), glow); }
  // 一根方料：从 a 架到 b，截面宽 w、高 h
  beam(a, b, w, h, hex, glow = 0) {
    M.lookAt(a, b, UP).setPosition(P.addVectors(a, b).multiplyScalar(.5));
    return this.add(UNIT, hex, M.scale(S.set(w, h, a.distanceTo(b))), glow);
  }
  // 直接加三角形：points 是 Vector3 的列表，每三个一个面（平的面，法线按面算）
  tris(points, hex, glow = 0) {
    color.set(hex);
    for (let i = 0; i < points.length; i += 3) {
      const [a, b, c] = [points[i], points[i + 1], points[i + 2]], n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
      for (const v of [a, b, c]) { this.pos.push(v.x, v.y, v.z); this.nor.push(n.x, n.y, n.z); this.col.push(color.r, color.g, color.b); this.glow.push(glow); this.mat.push(this.kind); }
    }
    return this;
  }
  // 四边形 a-b-c-d（逆时针看是正面）
  quad(a, b, c, d, hex, glow = 0) { return this.tris([a, b, c, a, c, d], hex, glow); }
  // 四边形，正面朝着 ref 那一侧
  face(a, b, c, d, hex, ref, glow = 0) {
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(d, a));
    return n.dot(ref) >= 0 ? this.quad(a, b, c, d, hex, glow) : this.quad(a, d, c, b, hex, glow);
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('aCol', new THREE.Float32BufferAttribute(this.col, 3)); g.setAttribute('aGlow', new THREE.Float32BufferAttribute(this.glow, 1)); g.setAttribute('aMat', new THREE.Float32BufferAttribute(this.mat, 1));
    return g;
  }
}

// 建筑的材质：固有色上按质地画出纹理和风雨留下的痕迹，朝上的面冬天积雪，窗和灯夜里亮
export const builtMaterial = (opts = {}) => paint({
  vertexPars: 'attribute vec3 aCol; attribute float aGlow, aMat; varying vec3 vCol; varying float vGlow, vMat;',
  vertex: 'vCol = aCol; vGlow = aGlow; vMat = aMat;',
  fragmentPars: /* glsl */`
    varying vec3 vCol; varying float vGlow, vMat;
    float isMat(float k) { return step(abs(vMat - k), .5); }`,
  fragment: /* glsl */`
    float close = smoothstep(80., 8., distance(vWp, cameraPosition));
    float worn = fbm(vWp.xz * .9 + vWp.y * 1.3), stain = fbm(vec2(vWp.x + vWp.z, vWp.y * .25) * 1.7), fine = noise1(vWp.xz * 5.3 + vWp.y * 4.1);
    float run = noise1(vec2((vWp.x - vWp.z) * 3.1, vWp.y * .22));                                                  // 顺着墙面往下淌的雨痕
    float fiber = noise1(vec2((vWp.x + vWp.z) * 7.3, vWp.y * .7)) * .6 + noise1(vec2((vWp.x - vWp.z) * 1.1, vWp.y * 9.)) * .4;   // 木纹：竖的料顺着长，横的料一道道
    albedo = vCol * (.8 + .34 * worn) * (.9 + .16 * stain);
    albedo = mix(albedo, vCol * (.84 + .26 * fine) * (.88 + .22 * worn), isMat(0.));                               // 石：细的颗粒
    albedo = mix(albedo, vCol * (.74 + .5 * fiber) * (.9 + .16 * stain), isMat(1.));                               // 木
    vec3 lacquer = mix(vCol, vCol * vec3(.78, .74, .72), smoothstep(.5, .8, worn + .3 * fiber)) * (.94 + .1 * fine);
    albedo = mix(albedo, lacquer, isMat(2.));                                                                      // 漆：大体匀净，一片片地褪色
    albedo = mix(albedo, mix(lacquer, mix(vec3(dot(lacquer, vec3(.3, .5, .2))), lacquer, .4) * vec3(.8, .78, .76), smoothstep(50., 240., distance(vWp, cameraPosition))), isMat(7.));   // 旧漆：远看褪成灰赭，不抢眼
    albedo = mix(albedo, vCol * (.92 + .1 * worn) * mix(1., .8, smoothstep(.45, .8, run * .7 + stain * .5)), isMat(3.));   // 粉墙：雨痕
    albedo = mix(albedo, vCol * (.9 + .18 * worn) * (.92 + .16 * fine), isMat(4.));                                // 瓦：深浅不一
    albedo = mix(albedo, vec3(.34, .44, .3) * (.7 + .5 * fine), isMat(4.) * .22 * smoothstep(.6, .8, stain + .2 * worn) * (1. - uSnow));   // 瓦上的苔
    albedo = mix(albedo, vCol * (.96 + .08 * fine), isMat(5.) + isMat(6.));                                        // 纸、金：干净
    N = normalize(N + vec3(noise4(vWp.xz * 3.3 + vWp.y * 2.9).rg - .5, 0.).xzy * .12 * close * (1. - isMat(5.)));
    albedo = mix(albedo, vec3(.9, .93, 1.), uSnow * smoothstep(.45, .8, N.y + (worn - .5) * .5) * step(vGlow, .01));
    glow = vCol * vGlow * uLamp * 2.4;
    sun *= bakedSun(vWp.xz);
    // 雪夜远看、背着月亮的时候：檐角、屋脊这些棱上被勾一道亮边（近处不加）
    vec3 toEye = normalize(cameraPosition - vWp);
    float rim = pow(1. - max(dot(N, toEye), 0.), 2.5) * smoothstep(.2, .85, dot(-toEye, uSunDir)) * (.5 + .5 * max(N.y, 0.));
    glow += uSunCol * mix(albedo, vec3(1.), .3) * rim * uSnow * smoothstep(110., 260., distance(vWp, cameraPosition)) * .45;`,
  ...opts,
});
