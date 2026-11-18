// 那团火：火苗（着色器画的一片始终朝着镜头的面）、灯周围空气里的光晕、照亮四周的两盏点光源。
// 火苗的摇曳和偶尔被气流带歪都由 flicker(t) 算出，只取决于时间。
import * as THREE from 'three';
import { rnd, TAU } from '../../anim.js';
import { NOISE, OUTPUT } from './shared.js';

const GAP = 6.5;                                                    // 平均每隔这么多秒来一阵气流
// 火苗此刻的状态。lean：焰尖被带偏了多少（世界坐标的 x、z，单位）；tall：火苗的长短；power：亮度。后两个在 1 上下
export function flicker(t) {
  const fine = .5 * Math.sin(t * 11.3 + 1.2) + .3 * Math.sin(t * 17.9 + .4) + .2 * Math.sin(t * 27.1 + 2.2);      // 细碎的抖
  const slow = .6 * Math.sin(t * 1.7 + .6) + .4 * Math.sin(t * .63 + 2);                                          // 缓慢的起伏
  let gx = 0, gz = 0;
  for (let k = Math.floor(t / GAP) - 1; k <= Math.floor(t / GAP); k++) {       // 每一格时间里来一阵气流，时刻、方向、力道各不相同
    const x = t - (k + .15 + .6 * rnd(k * 7.3 + 1)) * GAP;
    if (x <= 0) continue;
    const push = Math.min(1, x / .28), swing = x < .28 ? push * push * (3 - 2 * push) : Math.exp(-(x - .28) * 1.5) * Math.cos((x - .28) * 3.4);   // 先被推歪，再晃着回正
    const force = (.45 + .55 * rnd(k * 3.1 + 5)) * swing, dir = rnd(k * 5.7 + 2) * Math.PI * 2;
    gx += Math.cos(dir) * force; gz += Math.sin(dir) * force;
  }
  const blown = Math.min(1, Math.hypot(gx, gz));
  return {
    lean: [gx * .6 + .05 * slow + .02 * fine, gz * .6 + .04 * Math.sin(t * 1.1 + 4)],
    tall: 1 + .07 * slow + .035 * fine - .2 * blown,
    power: 1 + .05 * fine + .06 * slow - .2 * blown,
  };
}

const FLAME_VERT = /* glsl */`
uniform vec3 uBase; uniform vec2 uSize;
varying vec2 vP; varying vec3 vRight;
void main() {
  vec3 fw = cameraPosition - uBase; fw.y = 0.; fw = normalize(fw);          // 只绕竖轴转向镜头，火苗始终直立
  vRight = vec3(fw.z, 0., -fw.x);
  vP = position.xy * uSize;                                                // 以灯芯顶为原点的平面坐标，单位和场景一致
  gl_Position = projectionMatrix * viewMatrix * vec4(uBase + vRight * vP.x + vec3(0., vP.y, 0.) + fw * .08, 1.);
}`;
const FLAME_FRAG = /* glsl */`
uniform float uTime, uTall, uPower; uniform vec2 uLean;
varying vec2 vP; varying vec3 vRight;
${NOISE}
void main() {
  float H = 1.72 * uTall, y = clamp((vP.y + .1) / (H + .1), 0., 1.);         // y：0 在灯芯顶略下方（火苗包住灯芯），1 在焰尖
  float n = vnoise(vec3(vP.x * 2.6, vP.y * 1.9 - uTime * 3.2, uTime * .7)), n2 = vnoise(vec3(vP.x * 6., vP.y * 4. - uTime * 6.5, 3. + uTime));
  float cx = dot(uLean, vRight.xz) * (y * y * .85 + y * .15) + (n - .5) * .1 * y * y + sin(vP.y * 5.5 - uTime * 7.) * .012 * y;   // 中线：越往上越被气流带偏
  float w = .37 * pow(y, .42) * pow(1. - y, 1.05) / .415 * (1. + (n2 - .5) * .16 * y);     // 水滴形：下圆上尖
  float d = abs(vP.x - cx) / max(w, 1e-3);
  float edge = (1. - smoothstep(.6, 1., d)) * step(-.1, vP.y) * step(vP.y, H);
  float body = 1. - smoothstep(.05, .72, d);
  float mid = smoothstep(.16, .44, y) * (1. - .85 * smoothstep(.5, .96, y));
  vec3 col = mix(vec3(1.05, .19, .015), vec3(1.6, .62, .09), 1. - smoothstep(.2, .85, d));  // 外焰：边上橙红，往里转橙黄
  col = mix(col, vec3(2.5, 1.5, .46), body * mid);                                          // 内焰：最亮的一段，亮黄，不到发白
  col *= mix(vec3(1.), vec3(1., .58, .32), smoothstep(.55, 1., y));                         // 焰尖转红
  float core = (1. - smoothstep(.15, .9, d / max(1. - y / .46, .05))) * (1. - smoothstep(.26, .46, y));  // 焰心：灯芯上方没烧透的一小团，水滴形，暗而偏棕
  col = mix(col, vec3(.4, .13, .035), core * .85);
  float blue = (1. - smoothstep(.02, .2, y)) * smoothstep(.3, .8, d);                       // 根部贴着灯芯的一圈蓝
  col = mix(col, vec3(.14, .32, 1.15), blue * .85);
  float a = edge * (1. - .55 * smoothstep(.7, 1., y)) * (1. - .3 * core);
  gl_FragColor = vec4(col * a * uPower, a * mix(.5, .96, body) * min(1., uPower));   // 焰身挡住大半身后的东西（背后是亮的屏风时火苗才立得住），外沿透；火灭了就什么都不挡
  ${OUTPUT}
}`;
const HALO_VERT = /* glsl */`
uniform vec3 uBase; uniform float uSize;
varying vec2 vP;
void main() {
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]), up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vP = position.xy * uSize;
  // 光晕画在火苗朝镜头一侧 2.6 远的一个面上：整盏灯都在它后面，不会被它切出一道线
  gl_Position = projectionMatrix * viewMatrix * vec4(uBase + normalize(cameraPosition - uBase) * 2.6 + right * vP.x + up * vP.y, 1.);
}`;
const HALO_FRAG = /* glsl */`
uniform float uPower, uSize;
varying vec2 vP;
void main() {
  float r = length(vP), glow = .27 * exp(-r * r / 1.3) + .07 / (1. + r * r * .3);   // 贴着火苗的一小团，加上向外很淡很远的一层
  glow *= 1. - smoothstep(uSize * .3, uSize, r);
  glow *= .94 + .12 * fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(.06711056, .00583715))));   // 掺一点极细的颗粒，平滑的渐变才不会在成片里显出一圈圈色阶
  gl_FragColor = vec4(vec3(1., .55, .2) * glow * uPower, 1.);
  ${OUTPUT}
}`;

// 灯花：灯芯上偶尔爆出一粒火星，往上蹿一小段、划个弧落下去就灭了。第 i 粒每隔几秒爆一次，每次的方向和力道由（第几粒、第几次）决定
const SPARKS = 5;
function spark(i, t, wick, out) {
  const every = 6 + 5 * rnd(i * 2.3 + 7), at = t + rnd(i * 4.7 + 3) * every, n = Math.floor(at / every), age = at - n * every, seed = n * 3.1 + i * 17;
  const life = .55 + .4 * rnd(seed), dir = TAU * rnd(seed + 1), side = (1.2 + 1.1 * rnd(seed + 2)) * age, rise = (2.6 + 1.8 * rnd(seed + 3)) * age - 5 * age * age;
  out.set(wick.x + Math.cos(dir) * side, wick.y + .15 + rise, wick.z + Math.sin(dir) * side);
  return age < life ? (1 - age / life) ** 1.5 : 0;                                // 亮度：越烧越暗，寿命到了就没有
}
const SPARK_VERT = /* glsl */`
attribute float aGlow; uniform float uViewH; varying float vGlow;
void main() {
  vGlow = aGlow;
  gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.);
  gl_PointSize = max(2., .06 * projectionMatrix[1][1] * uViewH * .5 / gl_Position.w);
}`;
const SPARK_FRAG = /* glsl */`
varying float vGlow;
void main() {
  float r = length(gl_PointCoord * 2. - 1.);
  gl_FragColor = vec4(vec3(2.4, .9, .18) * vGlow * exp(-r * r * 4.), 1.);
  ${OUTPUT}
}`;

// wick：灯芯顶端；center：火苗中心。warm：{ value }，写入此刻的亮度，供器物材质用
// gain：{ value }，表演给的火势（1 正常，0 熄灭，大于 1 更旺），火苗的长短、亮度、照出去的光都跟着它
export function buildFlame(parent, { wick, center, warm, setPower, gain }) {
  const u = { uBase: { value: wick }, uSize: { value: new THREE.Vector2(.95, 2.5) }, uTime: { value: 0 }, uTall: { value: 1 }, uPower: { value: 1 }, uLean: { value: new THREE.Vector2() } };
  const fire = new THREE.Mesh(new THREE.PlaneGeometry(2, 1.2, 1, 1).translate(0, .45, 0),
    new THREE.ShaderMaterial({ uniforms: u, vertexShader: FLAME_VERT, fragmentShader: FLAME_FRAG, transparent: true, premultipliedAlpha: true, depthWrite: false }));
  const hu = { uBase: { value: center }, uSize: { value: 11 }, uPower: u.uPower };
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({ uniforms: hu, vertexShader: HALO_VERT, fragmentShader: HALO_FRAG, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  fire.frustumCulled = halo.frustumCulled = false;                   // 顶点位置在着色器里才定，不能按原始包围球剔除
  halo.renderOrder = 11; fire.renderOrder = 14;
  // 近光照亮灯下的一圈案面和旁边的器物，衰减快；远光很弱，够到表演区给小蟹勾一道暖边
  const near = new THREE.PointLight('#FFB25E', 170, 0, 2), far = new THREE.PointLight('#FFA452', 13, 60, 1);
  const sparkGeo = new THREE.BufferGeometry(), sparkPos = new THREE.BufferAttribute(new Float32Array(SPARKS * 3), 3), sparkGlow = new THREE.BufferAttribute(new Float32Array(SPARKS), 1);
  sparkGeo.setAttribute('position', sparkPos); sparkGeo.setAttribute('aGlow', sparkGlow);
  const su = { uViewH: { value: 1080 } }, view = new THREE.Vector4(), at = new THREE.Vector3();
  const sparks = new THREE.Points(sparkGeo, new THREE.ShaderMaterial({ uniforms: su, vertexShader: SPARK_VERT, fragmentShader: SPARK_FRAG, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  sparks.onBeforeRender = renderer => { su.uViewH.value = renderer.getCurrentViewport(view).w; };
  sparks.frustumCulled = false; sparks.renderOrder = 14;
  parent.add(fire, halo, sparks, near, far);
  return {
    update(t) {
      for (let i = 0; i < SPARKS; i++) { sparkGlow.setX(i, spark(i, t, wick, at) * Math.min(1, gain.value)); sparkPos.setXYZ(i, at.x, at.y, at.z); }
      sparkPos.needsUpdate = sparkGlow.needsUpdate = true;
      const raw = flicker(t), lean = raw.lean, power = raw.power * gain.value, tall = raw.tall * (.25 + .75 * Math.min(1.3, gain.value));
      u.uTime.value = t; u.uTall.value = tall; u.uPower.value = power; u.uLean.value.set(...lean);
      warm.value = power; setPower(power);
      near.intensity = 170 * power * power; far.intensity = 13 * (1 + (power - 1) * .6);
      near.position.set(center.x + lean[0] * .4, center.y + (tall - 1) * .8, center.z + lean[1] * .4);
      far.position.set(center.x + lean[0] * .2, center.y + .5, center.z + lean[1] * .2);
    },
  };
}
