// 石栏杆的雕工和石色：桥上的望柱、栏板、寻杖、净瓶、地栿、抱鼓石都用这里的造型工具和材质。
// 是一座有年头的石桥：
//   栏板两面浅浮雕——四周一道宽边，里面一圈海棠角的池子，池心一朵八瓣莲，两边各一枝卷草；望柱四面起一圈盘线；抱鼓石的鼓面是一圈圈的旋纹。
//     浮雕是着色器里按「板面上的位置」算出来的高低，光从侧面来时棱上亮、池子里暗。
//   石色——每一段石料深浅冷暖不同；朝天的面被雨水冲得发白，立面上挂着一道道往下淌的水渍；池子的角落、地栿和柱脚积着泥和青苔，
//     朝天的面上长着一点点黄绿的地衣。雨里整体沉下去、发润，凹处存着水；放晴后迎着日头的棱上有几粒水光。冬天朝上的面压雪。
// 每个顶点带 aRail：x 种类（0 素面，1 栏板的雕面，2 望柱的柱身，3 鼓面），y 离桥面多高，z、w 在这一面上的位置（横、竖，以这一面的中心为原点，单位和世界一样）。
import * as THREE from 'three';
import { paint, seasonal } from './paint.js';
import { SEASONS } from './seasons.js';

export const FACE = { plain: 0, panel: 1, post: 2, drum: 3 };
const color = new THREE.Color(), M = new THREE.Matrix4(), P = new THREE.Vector3(), S = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), X = new THREE.Vector3(), Y = new THREE.Vector3(), Z = new THREE.Vector3();
const UNIT = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
// 各种雕面：由这个顶点在部件里的位置 p（已经乘上部件的尺寸）和朝向 n 定出 [种类, 横, 竖]；不是雕面的那几个面是素面
const MARK = {
  [FACE.plain]: () => [FACE.plain, 0, 0],
  [FACE.panel]: (p, n) => Math.abs(n.x) > .5 ? [FACE.panel, p.z * Math.sign(n.x), p.y] : [FACE.plain, 0, 0],
  [FACE.post]: (p, n) => Math.abs(n.y) > .5 ? [FACE.plain, 0, 0] : [FACE.post, Math.abs(n.x) > .5 ? p.z : p.x, p.y],
  [FACE.drum]: (p, n) => Math.abs(n.x) > .5 ? [FACE.drum, p.z, p.y] : [FACE.plain, 0, 0],
};

export class Carve {
  constructor() { this.pos = []; this.nor = []; this.col = []; this.rail = []; }
  // 加一个部件：几何体、石色、摆放的矩阵、桥面在这里多高、哪种雕面
  add(geo, hex, matrix, floor, face = FACE.plain) {
    const local = geo.index ? geo.toNonIndexed() : geo, lp = local.attributes.position, ln = local.attributes.normal, g = local.clone().applyMatrix4(matrix), p = g.attributes.position, n = g.attributes.normal;
    matrix.extractBasis(X, Y, Z); S.set(X.length(), Y.length(), Z.length());
    color.set(hex);
    for (let i = 0; i < p.count; i++) {
      const [kind, u, v] = MARK[face](P.fromBufferAttribute(lp, i).multiply(S), X.fromBufferAttribute(ln, i));
      this.pos.push(p.getX(i), p.getY(i), p.getZ(i)); this.nor.push(n.getX(i), n.getY(i), n.getZ(i)); this.col.push(color.r, color.g, color.b);
      this.rail.push(kind, p.getY(i) - floor, u, v);
    }
    return this;
  }
  box(w, h, d, hex, matrix, floor, face) { return this.add(UNIT, hex, M.copy(matrix).scale(S.set(w, h, d)), floor, face); }
  // 一根料：从 a 架到 b，截面宽 w、高 h；geo 是沿 z 方向单位长的截面形状（默认方料）
  beam(a, b, w, h, hex, floor, face, geo = UNIT) {
    M.lookAt(a, b, UP).setPosition(P.addVectors(a, b).multiplyScalar(.5));
    return this.add(geo, hex, M.scale(S.set(w, h, a.distanceTo(b))), floor, face);
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('aCol', new THREE.Float32BufferAttribute(this.col, 3)); g.setAttribute('aRail', new THREE.Float32BufferAttribute(this.rail, 4));
    return g;
  }
}

// 栏板雕面的半长、半高由桥定（bridge.js），写进着色器
export function railMaterial(panelHalf) {
  return paint({
    uniforms: seasonal(SEASONS.春.u, 'uMoss', 'uSoil'),
    vertexPars: 'attribute vec3 aCol; attribute vec4 aRail; varying vec3 vCol; varying vec4 vRail;',
    vertex: 'vCol = aCol; vRail = aRail;',
    fragmentPars: /* glsl */`
      uniform vec3 uMoss, uSoil; varying vec3 vCol; varying vec4 vRail;
      const vec2 PANEL = vec2(${panelHalf.map(v => v.toFixed(3)).join(', ')});
      float sdBox(vec2 q, vec2 b) { vec2 d = abs(q) - b; return length(max(d, 0.)) + min(max(d.x, d.y), 0.); }
      // 栏板：返回 x 这一点雕得多高（0 池底，1 板面），y 离池子的边多近（池角积泥长苔的地方）
      vec2 panelRelief(vec2 q) {
        vec2 field = PANEL - vec2(.11, .09);
        float pool = max(sdBox(q, field), .06 - length(abs(q) - field));              // 海棠角的池子：四个角各让进去一个圆
        float h = smoothstep(-.014, .014, pool);
        h = max(h, .45 * smoothstep(.011, .0, abs(pool + .045)));                    // 池子里面再压一道线
        float r = length(q), ang = atan(q.y, q.x);
        float lotus = smoothstep(.012, -.012, r - (.105 + .04 * pow(abs(cos(ang * 4.)), .7)));   // 池心的莲：八瓣
        lotus *= 1. - .5 * smoothstep(.012, .0, abs(r - .07)) - .35 * smoothstep(.02, .0, abs(fract(ang * 1.2732 + .5) - .5) * r);   // 莲心一圈、瓣与瓣之间的线
        float x = abs(q.x) - .2, along = step(0., x) * step(abs(q.x), field.x - .1);
        float stem = q.y - .075 * sin(x * 9.4) * sign(q.x);
        float vine = smoothstep(.02, .004, abs(stem)) * along;                       // 卷草的茎
        vec2 cell = vec2((fract((x - .167) / .334 + .5) - .5) * .334, q.y - .13 * sign(sin(x * 9.4)) * sign(q.x));
        float leaf = smoothstep(.012, -.008, length(cell * vec2(1., 1.4)) - .05) * along;   // 每个弯的顶上一片叶
        h = max(h, .8 * max(lotus, max(vine, leaf)) * step(pool, -.03));
        return vec2(h, smoothstep(-.09, -.01, pool) * (1. - smoothstep(-.012, .01, pool)));
      }
      // 望柱：四面各起一圈盘线
      float postRelief(vec2 q) { float d = sdBox(q - vec2(0., -.02), vec2(.125, .5)); return 1. - .4 * smoothstep(.03, .0, abs(d)); }
      // 鼓面：一圈边，里面是旋纹
      float drumRelief(vec2 q) {
        float r = length(q), ang = atan(q.y, q.x);
        float swirl = smoothstep(.3, .7, fract(ang * .477 + r * 4.2)) * smoothstep(.46, .4, r) * smoothstep(.1, .16, r);
        return 1. - .5 * smoothstep(.02, .0, abs(r - .48)) - .45 * swirl - .5 * smoothstep(.02, .0, abs(r - .12));
      }
      // 按高低把法线推歪（不用切线：直接用屏幕上的差分）
      vec3 embossed(vec3 N, float h, float depth) {
        vec3 dpx = dFdx(vWp), dpy = dFdy(vWp), r1 = cross(dpy, N), r2 = cross(N, dpx);
        float det = dot(dpx, r1);
        return normalize(N - depth * (dFdx(h) * r1 + dFdy(h) * r2) * sign(det) / max(abs(det), 1e-7));
      }`,
    fragment: /* glsl */`
      float kind = vRail.x, lift = vRail.y, close = smoothstep(90., 10., distance(vWp, cameraPosition)), upward = smoothstep(.5, .9, N.y), upright = 1. - smoothstep(.2, .6, abs(N.y));
      float blot = fbm(vWp.xz * .55 + vWp.y * .7), grain = noise1(vWp.xz * 7.1 + vWp.y * 6.3) * .6 + noise1(vWp.xz * 19. + vWp.y * 17.) * .4, piece = fbm(floor(vWp.xz * .43 + vWp.y * .2) * 3.7 + 1.3);
      // 雕工
      float h = 1., nook = 0.;
      if (kind > .5 && kind < 1.5) { vec2 pr = panelRelief(vRail.zw); h = pr.x; nook = pr.y; }
      else if (kind > 1.5 && kind < 2.5) h = postRelief(vRail.zw);
      else if (kind > 2.5) h = drumRelief(vRail.zw);
      h = mix(h, .8, .5 * smoothstep(.45, .8, blot) * step(.5, kind));                               // 风化：有的地方雕工磨平了
      N = embossed(N, h + (grain - .5) * .05 + (blot - .5) * .12, .03 * close);
      // 石色：一段一个深浅冷暖，面上有云一样的斑，细看是颗粒
      vec3 stone = vCol * (.8 + .34 * piece) * mix(vec3(.96, 1., 1.03), vec3(1.05, 1., .92), fract(piece * 7.3 + blot * .6)) * (.84 + .3 * blot) * (.9 + .2 * grain);
      // 朝天的面冲得发白；立面上一道道往下淌的水渍，越靠上越重
      float run = smoothstep(.5, .85, noise1(vec2(dot(vWp.xz, vec2(5.3, 4.1)), vWp.y * .35)) * .7 + noise1(vec2(dot(vWp.xz, vec2(13.7, 9.9)), vWp.y * .9)) * .3);
      stone *= mix(1., 1.13, upward) * (1. - .34 * run * upright * smoothstep(.1, .9, lift));
      stone *= mix(.8, 1., h) * (1. - .16 * nook);                                                 // 雕下去的地方暗一层
      // 泥和青苔：池角、柱脚、地栿上；地衣：朝天的面上一点点
      float low = smoothstep(.3, .04, lift + (blot - .5) * .3), mossy = clamp(nook * .9 + low * .9 + (1. - h) * .12, 0., 1.) * smoothstep(.42, .66, blot + .3 * grain);
      stone = mix(stone, uSoil * .5, .3 * clamp(nook + low * .7, 0., 1.));
      stone = mix(stone, uMoss * (.5 + .4 * grain), mossy * .65 * (1. - uSnow));
      float lichen = smoothstep(.72, .8, fbm(vWp.xz * 2.3 + vWp.y * 1.9 + 4.)) * (.35 + .65 * upward);
      stone = mix(stone, mix(vec3(.74, .76, .56), vec3(.62, .68, .6), piece) * (.8 + .3 * grain), lichen * .5 * (1. - uSnow));
      // 雨里：颜色沉下去，凹处和朝天的面存着水更深；放晴后棱上、朝天的面上有几粒水光
      albedo = soak(stone * mix(1., .9, uWet * (.4 + .6 * max(upward, 1. - h))), uWet * .65);
      glow = uSunCol * dewGlint(vWp, N, .05) * .16 * uWet * close;
      albedo = mix(albedo, vec3(.9, .93, 1.), uSnow * smoothstep(.45, .8, N.y + (blot - .5) * .5));
      ao = mix(.62, 1., h) * mix(.7, 1., smoothstep(0., .3, lift)) * (1. - .25 * nook);
      sun *= bakedSun(vWp.xz);`,
  });
}
