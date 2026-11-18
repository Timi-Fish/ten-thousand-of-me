// 香炉里升起的一缕青烟。烟不是几何体拼的：只有一条始终朝着镜头的窄带，烟的形状全在片元着色器里沿视线一步步积分出来。
// 烟被看成两片叠在一起的薄绸：贴着炉盖是细细的一线，越往上越宽，绸面绕着中线拧转、边上卷起、起细褶；
// 视线顺着绸面穿过去的地方积得厚，所以卷边和褶子会亮起来。整缕烟被屋里的气流带着斜向表演区一侧，升进月光里的部分更亮。
// 形状只取决于时间：花纹随烟一起以 RISE 的速度上升，同一时刻永远是同一个样子。
import * as THREE from 'three';
import { BEAM, NOISE, OUTPUT } from './shared.js';

const PLUME = /* glsl */`
uniform vec3 uOrigin; uniform float uTime;
const float HS = 13., RISE = 1.05;                                   // 烟柱的高度、上升的速度（单位每秒）
// 这个高度上烟柱中线偏离出烟口多少（水平方向）
// （h 先夹到 0 到 1：开了多重采样时，面片边缘的像素拿到的插值会略微出界，负数进 pow 会算出非数）
vec2 plumeCenter(float y) {
  float h = clamp(y / HS, 0., 1.), ph = y - RISE * uTime;
  vec2 wander = vec2(sin(ph * .55 + 1.3) + .55 * sin(ph * 1.27 + 4.1) + .3 * sin(ph * 2.9 + .7), cos(ph * .48 + 2.1) + .55 * sin(ph * 1.13 + 1.7) + .3 * cos(ph * 2.6 + 3.3));
  vec2 draft = vec2(-7., 1.) * pow(h, 1.3) + vec2(sin(uTime * .21 + h * 2.), cos(uTime * .17 + h * 2.6)) * h * h * .9;
  return wander * HS * .07 * smoothstep(.02, .6, h) + draft;
}
// 烟的宽度：出炉盖时是从几个孔里漫出来的一小团，很快收成一线，再慢慢散开
float plumeWidth(float h) { h = clamp(h, 0., 1.); return .06 + .42 * exp(-h * 48.) + 1.9 * pow(h, 1.45); }`;

const VERT = /* glsl */`
${PLUME}
varying vec3 vWp; varying float vH;
void main() {
  vH = position.y;
  vec2 c = plumeCenter(vH * HS);
  vec3 mid = uOrigin + vec3(c.x, vH * HS, c.y), fw = cameraPosition - mid;
  fw.y = 0.; fw = normalize(fw);
  vWp = mid + vec3(fw.z, 0., -fw.x) * position.x * (3. * plumeWidth(vH) + .1);
  gl_Position = projectionMatrix * viewMatrix * vec4(vWp, 1.);
}`;

const FRAG = /* glsl */`
${PLUME}
${NOISE}
${BEAM}
varying vec3 vWp; varying float vH;
float density(vec3 p) {
  float y = p.y - uOrigin.y, h = y / HS;
  if (h <= 0. || h >= 1.) return 0.;
  vec2 q = p.xz - uOrigin.xz - plumeCenter(y);
  float W = plumeWidth(h), ph = y - RISE * uTime, r = length(q) / W, loose = smoothstep(.08, .55, h), d = 0.;
  if (r > 3.2) return 0.;
  for (int i = 0; i < 2; i++) {
    float fi = float(i);
    float twist = 1.7 * sin(ph * .37 + fi * 2.4) + ph * .21 + fi * 1.9 + .8 * sin(uTime * .13 + fi);       // 整片绸子随高度慢慢拧转
    float curl = (.4 + 2.5 * loose) * sin(ph * .61 + fi * 4.3 + 1.);                                       // 越往外卷得越多
    float a = twist + curl * r;
    vec2 e = vec2(cos(a), sin(a));
    float across = dot(q, e), along = dot(q, vec2(-e.y, e.x));                                              // 离绸面多远、在绸面上的哪里
    float fold = .2 * W * sin(along / W * 3.1 + ph * .9 + fi * 2.) * loose;                                 // 细褶
    float off = (across - fold) / (.016 + .08 * W), span = along / (W * (1. - .3 * fi));
    float sheet = exp(-off * off - span * span * 1.2);
    float strand = .5 + .5 * vnoise(vec3(along / W * 4.5 + fi * 9., ph * .5, fi * 3.));                      // 顺着上升方向的丝缕
    d += sheet * mix(1., .35 + strand, loose) * (1. - .35 * fi);
  }
  d *= smoothstep(.06, .15, h) / (.55 + W * 2.6);
  if (h < .16) {                                                       // 贴着炉盖：烟从镂空的三处各漫出细细的一缕，绕过盖顶的小钮，在上方并成一股
    float gather = 1. - smoothstep(.045, .15, h), w = .035 + .5 * h, last = 1. - smoothstep(.09, .16, h);
    for (int i = 0; i < 3; i++) {
      float an = float(i) * 2.094 + .9;
      vec2 dq = q - vec2(cos(an), sin(an)) * (.5 * gather + .06 * sin(ph * 2.3 + an * 3.) * h * 8.);
      d += exp(-dot(dq, dq) / (w * w)) * mix(.25, .5, gather) * last;
    }
  }
  return d * smoothstep(0., .012, h) * (1. - smoothstep(.55, 1., h));
}
void main() {
  vec3 rd = normalize(vWp - cameraPosition);
  float reach = (3. * plumeWidth(vH) + .1) / max(length(rd.xz), .3), dt = reach * 2. / 72.;
  float jitter = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(.06711056, .00583715))));
  float sum = 0.;
  for (int i = 0; i < 72; i++) sum += density(vWp + rd * (-reach + (float(i) + jitter) * dt));
  float depth = sum * dt * 5.5, a = 1. - exp(-depth);
  float moon = beamMask(vWp) * mix(.45, 1., beamStreak(vWp, uTime));
  float toward = pow(max(dot(rd, MOON_DIR), 0.), 5.);                                                        // 逆着月光看，烟被照得透亮
  vec3 lit = vec3(.2, .23, .33) + vec3(.62, .7, .95) * moon * (.55 + 1.3 * toward);
  gl_FragColor = vec4(lit * a, a * .55);
  ${OUTPUT}
}`;

export function buildSmoke(parent, origin) {
  const uniforms = { uOrigin: { value: origin }, uTime: { value: 0 } };
  const plume = new THREE.Mesh(new THREE.PlaneGeometry(2, 1, 1, 96).translate(0, .5, 0),
    new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG, transparent: true, premultipliedAlpha: true, depthWrite: false, side: THREE.DoubleSide }));
  plume.frustumCulled = false; plume.renderOrder = 13;
  parent.add(plume);
  return { update(t) { uniforms.uTime.value = t; } };
}
