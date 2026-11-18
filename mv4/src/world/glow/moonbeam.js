// 月光的光柱：月光从月洞窗斜照进屋，空气里的微尘把它显出形状来。
// 做法是把屋里的空气切成一摞朝着镜头的薄片，每个像素在自己那一片上算「这里有没有月光、有多浓」，一层层加起来就是体积光。
// 被屏风挡住的地方没有光；窗外的梅枝把光分成一道一道；光柱里的薄雾缓缓流动；逆着光看（朝月亮的方向）最亮。
// 很淡：贴近案面和贴近镜头的地方进一步收淡，不遮表演。
import * as THREE from 'three';
import { WALL } from '../layout.js';
import { BEAM, NOISE, OUTPUT, MOON_DIR, MOON_TINT, TOP } from './shared.js';

const LAYERS = 72, Z_FAR = WALL.z + 1.5, Z_NEAR = 15, SPACING = (Z_NEAR - Z_FAR) / LAYERS;
const VERT = /* glsl */`
varying vec3 vWp;
void main() { vWp = position; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.); }`;
const FRAG = /* glsl */`
${NOISE}
${BEAM}
uniform float uTime; uniform vec3 uTint;
varying vec3 vWp;
void main() {
  vec3 rd = normalize(vWp - cameraPosition);
  float along = ${SPACING.toFixed(4)} / max(abs(rd.z), .35);                                    // 这一片代表视线上的多长一段
  float jitter = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(.06711056, .00583715)))) - .5;
  vec3 p = vWp + rd * jitter * along;                                                           // 取样点沿视线前后错开，片与片之间的台阶化成极细的颗粒
  float m = beamMask(p);
  if (m < .003) discard;
  float mist = .75 + .5 * fbm(p * vec3(.15, .22, .15) + vec3(uTime * .022, -uTime * .016, uTime * .012));
  float toward = max(dot(rd, MOON_DIR), 0.), phase = .45 + .3 * pow(toward, 9.) + .35 * toward * toward;
  float clear = smoothstep(${TOP.toFixed(2)}, ${(TOP + 4.5).toFixed(2)}, p.y) * smoothstep(2., 10., distance(p, cameraPosition));
  gl_FragColor = vec4(uTint * (m * mix(.04, 1., beamStreak(p, uTime)) * mist * phase * clear * along * .0042), 1.);
  ${OUTPUT}
}`;

export function buildMoonbeam(parent) {
  // 每一片只盖住光柱在那个深度上的截面（月洞窗的圆沿月光方向平移过来），案面以下不要
  const pos = [], idx = [], [wx, wy] = WALL.window.c, R = WALL.window.r * 1.4;
  for (let i = 0; i < LAYERS; i++) {
    const z = Z_FAR + (i + .5) * SPACING, s = (z - WALL.z) / -MOON_DIR.z, cx = wx - MOON_DIR.x * s, cy = wy - MOON_DIR.y * s, y0 = Math.max(TOP, cy - R), y1 = cy + R;
    if (y1 <= y0) continue;
    const b = pos.length / 3;
    pos.push(cx - R, y0, z, cx + R, y0, z, cx + R, y1, z, cx - R, y1, z);
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx);
  const uniforms = { uTime: { value: 0 }, uTint: { value: MOON_TINT } };
  const beam = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  beam.frustumCulled = false; beam.renderOrder = 10;
  parent.add(beam);
  return { update(t) { uniforms.uTime.value = t; } };
}
