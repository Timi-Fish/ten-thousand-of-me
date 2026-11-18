// 一层层的薄雾：几张水平的雾幕铺在不同的高度上，每一张只在比它低的洼处显出来。
//   谷里——贴着湖面、谷底、山腰：雾积在湖上、侧谷里、孤山和支脊的腰间，山头和脊梁从雾里露出来，近、中、远隔开一层层。春天清晨最浓，秋天黄昏、冬夜薄一些。
//   主峰的山腰——只在雪夜：几条云带缠在主峰和四周石峰的腰上（云腰），把山托住，峰顶和亭子从云上露出来。
// 雾的浓淡是两层慢慢流动的云纹叠起来的，边是散的。受光：照得到日月的地方亮，山影里暗。
// 夜里村子和峰顶亭子四周的雾被灯映暖（读 U.uVillages）。离镜头近的不画：近景机位里看不见它。
import * as THREE from 'three';
import { COMMON, U, VILLAGE_LIGHTS } from './paint.js';

const BOWL = { x0: -620, x1: 620, z0: 300, z1: 1820 }, PEAK = { x0: -640, x1: 640, z0: -560, z1: 250 };   // 主峰的云腰只铺到 z = 250（小屋在它南边，小屋前的镜头看不见它）
// 每一张：铺在哪、高度、雾纹多大、多浓、相位、四季各多浓（春夏秋冬）
const SHEETS = [
  ...[[7, 1, .6, 0], [22, 1.3, .5, 3.1], [44, 1.7, .42, 7.7], [72, 2.2, .34, 1.9], [104, 2.6, .26, 5.3]].map(s => [BOWL, ...s, [1, .5, .3, .45], [0, 0, 1e5, 2e5, 150]]),
  ...[[230, 1.5, 2, 2.2], [290, 1.9, 1.8, 6.1], [345, 2.3, 1.3, 4.4]].map(s => [PEAK, ...s, [0, 0, 0, 1], [0, 0, 260, 430, 420]]),
];
// 最后一项：只在哪一圈里显出来 [圆心 x, z, 全浓的半径, 淡没的半径]，和比地面高出多少以内还算「洼处」（主峰的云腰要一直垂到云海里）

const VERT = /* glsl */`
varying vec3 vWp;
void main() { vWp = (modelMatrix * vec4(position, 1.)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vWp, 1.); }`;
const FRAG = /* glsl */`
#include <common>
${COMMON}
uniform vec4 uSheet;        // 高度、雾纹多大、多浓、相位
uniform vec4 uSheetSeason;  // 四季各多浓
uniform vec4 uSheetRing;    // 只在这一圈里显出来：圆心、全浓的半径、淡没的半径
uniform float uSheetDeep;   // 比地面高出多少以内还算洼处
uniform vec4 uVillages[${VILLAGE_LIGHTS}];
varying vec3 vWp;
void main() {
  float season = dot(uPick, uSheetSeason);
  if (season <= 0.) discard;
  float below = uSheet.x - groundAt(vWp.xz), dist = distance(vWp, cameraPosition);
  float pool = smoothstep(3., 20., below) * smoothstep(uSheetDeep, uSheetDeep * .4, below) * smoothstep(uSheetRing.w, uSheetRing.z, distance(vWp.xz, uSheetRing.xy));   // 只在比它低的洼处显出来
  vec2 drift = uWind.xy * uTime * .9, q = vWp.xz / (420. * uSheet.y) + uSheet.w;
  float n = texture2D(uCloudMap, q + drift * .0011).b * .62 + texture2D(uCloudMap, q * 2.9 - drift.yx * .0017 + .37).b * .38;
  float a = min(smoothstep(.45, .85, n) * pool * uSheet.z * season * smoothstep(90., 260., dist) * .62, .85);
  if (a < .003) discard;
  vec3 rd = normalize(vWp - cameraPosition);
  float lit = sunSeen(vWp);
  vec3 c = uMistCol * (.62 + .38 * lit) + sunWash(rd) * lit * .45;
  // 夜里村子的灯映在雾里
  float warm = 0.;
  for (int i = 0; i < ${VILLAGE_LIGHTS}; i++) { vec4 v = uVillages[i]; vec2 d = vWp.xz - v.xy; warm += v.w * exp(-dot(d, d) / (v.z * v.z * 2.2)); }
  c += vec3(1., .6, .28) * warm * uLamp * .12;
  c = wildFog(c, vWp);
  gl_FragColor = vec4(c, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function buildMist() {
  const group = new THREE.Group();
  SHEETS.forEach(([area, y, size, power, phase, seasons, [rx, rz, r0, r1, deep]], i) => {
    const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: { ...U, uSheet: { value: new THREE.Vector4(y, size, power, phase) }, uSheetSeason: { value: new THREE.Vector4(...seasons) }, uSheetRing: { value: new THREE.Vector4(rx, rz, r0, r1) }, uSheetDeep: { value: deep } }, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(area.x1 - area.x0, area.z1 - area.z0).rotateX(-Math.PI / 2), mat);
    mesh.position.set((area.x0 + area.x1) / 2, y, (area.z0 + area.z1) / 2); mesh.renderOrder = 6 + i;
    group.add(mesh);
  });
  return { group };
}
