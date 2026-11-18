// 喝孟婆汤用的那根吸管，和含着它的那圈撅起来的嘴唇。只给 d-sip.js 用。
// 吸管是一根浅青白的细芦苇管：半透，顺着管长有细纹，两处节，中段一截可弯的波纹节。
// 中线每帧现算（一头插在汤里，一头跟着嘴走），管壁按中线重新铺一遍顶点；粗细的变化全在顶点着色器里：
//   管壁：节处鼓一圈，波纹节一道道起伏，每一口汤是一个沿管长走的鼓包，鼓包处管壁被撑开、变薄（更透）；
//   汤柱：管里一层深茶褐色的汤，从插在汤里的那头一直到「前沿」，前沿和每段空气的两头都收成圆头（弯月面），
//         吸的时候汤里有往嘴那边跑的明暗条纹和小气泡。
import * as THREE from 'three';
import { TAU } from '../anim.js';
import { SKIN } from '../crab/palette.js';

const RINGS = 260, SIDES = 14, R = .072, BEADS = 12, GAPS = 3;     // 沿管长几圈顶点、一圈几个顶点、管子半径；同时最多几个鼓包、几段空气
const WIDTH = .17, SOUP = .74;                                      // 鼓包沿管长的宽度（世界单位）；汤柱比管壁细多少（按半径的比例）
const NODES = [.2, .8], BELLOWS = [.43, .56], PLEAT = .055;         // 两处节、波纹节的起止（按管长的几成）；波纹一道多长
const V = () => new THREE.Vector3();

const VERT_HEAD = /* glsl */`
attribute float aS; attribute float aA; attribute vec3 aT;
uniform vec2 uBead[${BEADS}]; uniform vec2 uGap[${GAPS}]; uniform vec2 uNode; uniform vec2 uBell;
uniform float uR, uFront, uSoup;
varying float vS, vA, vBump, vDepth;
float bumpAt(float s) { float b = 0.; for (int i = 0; i < ${BEADS}; i++) { float d = (s - uBead[i].x) / ${WIDTH.toFixed(3)}; b += uBead[i].y * exp(-d * d); } return b; }
float bellAt(float s) { return smoothstep(uBell.x - .03, uBell.x + .03, s) * (1. - smoothstep(uBell.y - .03, uBell.y + .03, s)); }
float nodeAt(float s) { return max(exp(-pow((s - uNode.x) / .03, 2.)), exp(-pow((s - uNode.y) / .03, 2.))); }
// 离汤柱的边多远（在汤里为正，在空气里为负）：汤从管底一直到前沿，中间扣掉几段空气
float soupDepth(float s) {
  float d = uFront - s;
  for (int i = 0; i < ${GAPS}; i++) {
    vec2 g = uGap[i];
    if (g.y <= g.x) continue;
    d = min(d, s < g.x ? g.x - s : s > g.y ? s - g.y : -min(s - g.x, g.y - s));
  }
  return d;
}
// 这一圈的半径
float radiusAt(float s) {
  float bump = bumpAt(s), bell = bellAt(s), pleat = .5 + .5 * cos(s * ${(TAU / PLEAT).toFixed(3)});
  float wall = uR * (1. + bump * (1. + .35 * bell) + .2 * nodeAt(s) + bell * (.08 + .1 * bump) * pleat);   // 鼓包经过波纹节时节被撑开
  if (uSoup < .5) return wall;
  float r = uR * ${SOUP.toFixed(2)} * (1. + bump), d = soupDepth(s) / (r * 1.25);
  float m = 1. - min(d, 1.);
  return d <= 0. ? 0. : r * sqrt(1. - m * m);                                                       // 两头收成圆头
}`;
// 粗细的坡让法线往管长方向倒：光影跟着鼓包走，看得出是鼓起来的
const VERT_NORMAL = /* glsl */`
vS = aS; vA = aA; vBump = bumpAt(aS); vDepth = soupDepth(aS);
float slope = (radiusAt(aS + .008) - radiusAt(aS - .008)) / .016;
vec3 objectNormal = normalize(normal - aT * slope);`;
const VERT_MOVE = /* glsl */`
vec3 transformed = position + normal * (radiusAt(aS) - uR);`;

const FRAG_HEAD = /* glsl */`
uniform vec2 uNode; uniform vec2 uBell; uniform float uFlow, uRush;
varying float vS, vA, vBump, vDepth;
float hash1(float n) { return fract(sin(n * 91.37 + 7.1) * 43758.55); }`;
// 管壁：浅青白，顺着管长的细纹；节是一圈更绿、更不透的箍；波纹节的沟深一点；鼓包处被撑薄，更透
const WALL_COLOR = /* glsl */`
#include <color_fragment>
float node = max(exp(-pow((vS - uNode.x) / .03, 2.)), exp(-pow((vS - uNode.y) / .03, 2.)));
float bell = smoothstep(uBell.x - .03, uBell.x + .03, vS) * (1. - smoothstep(uBell.y - .03, uBell.y + .03, vS));
float groove = bell * smoothstep(.55, 1., .5 - .5 * cos(vS * ${(TAU / PLEAT).toFixed(3)}));
float grain = .5 + .5 * sin(vA * ${(TAU * 18).toFixed(3)} + 2.3 * sin(vS * 7.));
diffuseColor.rgb *= (.9 + .1 * grain) * (1. - .28 * groove);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.55, .72, .6), .55 * node);
diffuseColor.a = mix(diffuseColor.a, .9, node) * (1. - .55 * clamp(vBump, 0., 1.)) + .25 * groove;`;
// 管壁的两侧（斜着看过去的地方）更白、更不透：中间透出里面的汤，两边勾出管子的轮廓
const WALL_EDGE = /* glsl */`
float edge = pow(1. - abs(dot(normalize(normal), normalize(vViewPosition))), 2.);
outgoingLight = mix(outgoingLight, vec3(.93, 1., .97), .4 * edge);
diffuseColor.a = mix(diffuseColor.a, .65, edge);
#include <opaque_fragment>`;
// 汤：深茶褐。吸的时候（uRush）条纹和小气泡往嘴那边跑；鼓包处更亮（汤更显）；圆头的边上一圈亮边（弯月面的反光）
const SOUP_COLOR = /* glsl */`
#include <color_fragment>
float flow = vS - uFlow;
float stripe = .5 + .5 * sin(flow * ${(TAU / .2).toFixed(3)} + 1.4 * sin(vA * ${TAU.toFixed(3)}));
diffuseColor.rgb *= mix(1., .7 + 1.1 * stripe, uRush);
float cell = floor(flow / .13), here = hash1(cell);
vec2 bub = vec2(fract(flow / .13) - (.25 + .5 * here), (fract(vA + hash1(cell + 3.) ) - .5) * 1.6);
float bubble = step(.45, here) * (1. - smoothstep(.07, .13, length(bub)));
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1., .9, .7), .8 * bubble * uRush);
diffuseColor.rgb *= 1. + 1.2 * clamp(vBump, 0., 1.);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.95, .8, .58), .6 * (1. - smoothstep(.0, .05, vDepth)));`;

// 管子：一张按中线现铺的网格，两种材质各画一遍（汤柱、外面半透的管壁）
function tube() {
  const n = RINGS * SIDES, geo = new THREE.BufferGeometry(), index = [];
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  geo.setAttribute('aT', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  geo.setAttribute('aS', new THREE.BufferAttribute(new Float32Array(n), 1));
  geo.setAttribute('aA', new THREE.BufferAttribute(new Float32Array(n).map((_, i) => (i % SIDES) / SIDES), 1));
  for (let r = 0; r < RINGS - 1; r++) for (let k = 0; k < SIDES; k++) {
    const a = r * SIDES + k, b = r * SIDES + (k + 1) % SIDES, c = a + SIDES, d = b + SIDES;
    index.push(a, c, b, b, c, d);
  }
  geo.setIndex(index);
  return geo;
}

function material(uniforms, wall) {
  const mat = new THREE.MeshLambertMaterial(wall
    ? { color: '#D2EDE0', emissive: '#22332F', transparent: true, opacity: .17, depthWrite: false, side: THREE.DoubleSide }
    : { color: '#5C1E04', emissive: '#2E0D02', side: THREE.DoubleSide });
  mat.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms, { uSoup: { value: wall ? 0 : 1 } });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_HEAD}`)
      .replace('#include <beginnormal_vertex>', VERT_NORMAL)
      .replace('#include <begin_vertex>', VERT_MOVE);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_HEAD}`)
      .replace('#include <color_fragment>', wall ? WALL_COLOR : SOUP_COLOR);
    if (wall) shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', WALL_EDGE);
  };
  mat.customProgramCacheKey = () => (wall ? 'straw-wall' : 'straw-soup');   // 两种材质的着色器不一样，不能共用一份编译结果
  return mat;
}

// 撅起来的嘴唇：一圈肤色的小圆环裹着管子，外面一圈深色的描边（往外胀一点、只画背面）
function lipRing(group) {
  const ring = new THREE.Group();
  const skin = new THREE.Mesh(new THREE.TorusGeometry(1, .44, 14, 36), new THREE.MeshLambertMaterial({ color: SKIN.body, emissive: '#5A2414' }));
  const line = new THREE.Mesh(new THREE.TorusGeometry(1, .56, 14, 36),new THREE.MeshBasicMaterial({ color: '#2A120C', side: THREE.BackSide }));
  const gloss = new THREE.Mesh(new THREE.TorusGeometry(.95, .08, 6, 24, 1.6), new THREE.MeshBasicMaterial({ color: '#FFD9C4', transparent: true, opacity: .7 }));
  gloss.position.z = .35; gloss.rotation.z = .8;                   // 上唇一小道亮光
  ring.add(line, skin, gloss);
  group.add(ring);
  return ring;
}

export function buildStraw(group) {
  const uniforms = {
    uBead: { value: Array.from({ length: BEADS }, () => new THREE.Vector2()) }, uGap: { value: Array.from({ length: GAPS }, () => new THREE.Vector2()) },
    uR: { value: R }, uNode: { value: new THREE.Vector2() }, uBell: { value: new THREE.Vector2() }, uFront: { value: 0 }, uFlow: { value: 0 }, uRush: { value: 0 },
  };
  const geo = tube(), soup = new THREE.Mesh(geo, material(uniforms, false)), wall = new THREE.Mesh(geo, material(uniforms, true));
  soup.frustumCulled = wall.frustumCulled = false;
  wall.renderOrder = 2;                                               // 半透的管壁画在里面的汤之后
  wall.castShadow = true;
  group.add(soup, wall);
  const ring = lipRing(group), Z = new THREE.Vector3(0, 0, 1);

  const pos = geo.attributes.position, nor = geo.attributes.normal, tan = geo.attributes.aT, along = geo.attributes.aS;
  const t3 = V(), n3 = V(), b3 = V(), ref = V(), p3 = V();
  return {
    R,
    // points：中线经过的几个点（THREE.Vector3，从汤里那头到嘴那头）。返回中线的取样点和各点离汤里那头的管长
    lay(points) {
      const line = new THREE.CatmullRomCurve3(points, false, 'centripetal').getSpacedPoints(RINGS - 1), s = [0];
      line.forEach((p, r) => { if (r) s.push(s[r - 1] + p.distanceTo(line[r - 1])); });
      ref.set(0, 0, 1);
      line.forEach((p, r) => {
        t3.subVectors(line[Math.min(r + 1, RINGS - 1)], line[Math.max(r - 1, 0)]).normalize();
        n3.crossVectors(ref, t3).normalize(); b3.crossVectors(t3, n3); ref.copy(b3);   // 沿着中线平移出来的一组正交方向，管子不会拧
        for (let k = 0; k < SIDES; k++) {
          const a = k / SIDES * TAU, i = r * SIDES + k;
          p3.copy(n3).multiplyScalar(Math.cos(a)).addScaledVector(b3, Math.sin(a));
          nor.setXYZ(i, p3.x, p3.y, p3.z); tan.setXYZ(i, t3.x, t3.y, t3.z); along.setX(i, s[r]);
          pos.setXYZ(i, p.x + R * p3.x, p.y + R * p3.y, p.z + R * p3.z);
        }
      });
      [pos, nor, tan, along].forEach(a => { a.needsUpdate = true; });
      const total = s[RINGS - 1];
      uniforms.uNode.value.set(NODES[0] * total, NODES[1] * total);
      uniforms.uBell.value.set(BELLOWS[0] * total, BELLOWS[1] * total);
      return { line, s, total };
    },
    // 管里的汤：front 汤柱前沿离管底多远；gaps 几段空气 [[起, 止], ...]；flow 条纹走到哪了（管长）；rush 0–1 正在吸的劲
    soup({ front, gaps, flow, rush }) {
      if (gaps.length > GAPS) throw new Error(`吸管里同时的空气超过了 ${GAPS} 段`);
      uniforms.uFront.value = front; uniforms.uFlow.value = flow; uniforms.uRush.value = rush;
      uniforms.uGap.value.forEach((v, i) => (i < gaps.length ? v.set(...gaps[i]) : v.set(0, 0)));
    },
    // beads：[[沿管长的位置, 大小], ...]，最多 BEADS 个
    beads(list) {
      if (list.length > BEADS) throw new Error(`吸管里同时的鼓包超过了 ${BEADS} 个`);
      uniforms.uBead.value.forEach((v, i) => (i < list.length ? v.set(...list[i]) : v.set(0, 0)));   // 没用上的槽位大小为 0，不起作用
    },
    // 嘴唇圈：at 圈心，axis 管子从嘴里伸出来的方向（单位向量），size 圈的大小（0 不显示），squeeze 0–1 收紧
    lips(at, axis, size, squeeze) {
      ring.visible = size > .01;
      if (!ring.visible) return;
      const r = (R + .052) * (1 - .12 * squeeze);
      ring.position.copy(at); ring.quaternion.setFromUnitVectors(Z, axis);
      ring.scale.set(r * size, r * size, r * (1 + .5 * squeeze));
    },
  };
}
