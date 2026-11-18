// 平如镜的液面：砚里的墨、水盂里的水。液面本身是暗的，掠着看时映出夜色，中间映着一轮月亮。
// 月影用简单的做法：不追真实的反射光路（那样从贴着案面的低机位根本照不见月亮），
// 而是每帧按镜头的位置把月影放在「从镜头看过去正好落在液面中央」的方向上，大小跟着液面在画面里的大小走，
// 所以不管机位在哪，月亮总是完整地浮在液面里。
import * as THREE from 'three';
import { V3, NOISE } from './kit.js';

const VERT = /* glsl */`
varying vec3 vWorld;
#include <fog_pars_vertex>
void main() {
  vec4 world = modelMatrix * vec4(position, 1.);
  vWorld = world.xyz;
  vec4 mvPosition = viewMatrix * world;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const FRAG = /* glsl */`
uniform vec3 uBase, uSky, uMoon, uMoonDir;
uniform float uSize, uTime, uRipple;
varying vec3 vWorld;
#include <fog_pars_fragment>
${NOISE}
void main() {
  vec3 V = normalize(cameraPosition - vWorld);
  // 液面几乎不动，只有极轻的一点起伏，月影的边因此微微地颤
  vec2 q = vWorld.xz * 1.1;
  vec3 N = normalize(vec3((vnoise(vec3(q, uTime * .35)) - .5) * uRipple, 1., (vnoise(vec3(q + 7.3, uTime * .35 + 4.)) - .5) * uRipple));
  vec3 R = reflect(-V, N);
  float graze = pow(1. - max(dot(N, V), 0.), 4.);
  vec3 col = mix(uBase, uSky, .05 + .7 * graze);
  float a = acos(clamp(dot(R, uMoonDir), -1., 1.)) / uSize;                 // 离月影中心几个月亮半径
  float disc = 1. - smoothstep(.9, 1., a);
  vec3 side = normalize(cross(uMoonDir, vec3(0., 1., 0.))), up = cross(side, uMoonDir);
  vec2 face = vec2(dot(R, side), dot(R, up)) / uSize;                          // 月面上的位置，画几块淡淡的月海
  float sea = smoothstep(.42, .68, fbm(vec3(face * 1.5 + 3., 1.7)));
  col += uMoon * disc * (1. - .3 * sea) * (.8 + .2 * (1. - a * a));
  col += uMoon * (.1 * exp(-max(a - 1., 0.) * 3.) + .025 * exp(-max(a - 1., 0.) * .8)) * (1. - disc);   // 月亮周围的一圈晕
  gl_FragColor = vec4(col, 1.);
  #include <fog_fragment>
}`;

// geo：液面的网格（本地坐标里是水平的）。centre：液面中央（本地坐标）；reach：液面从中央到边的大致距离；
// base 液体的颜色，sky 掠射时映出的夜色，moon 月影的颜色（可以超过 1，后期会让它微微泛光），ripple 起伏的幅度
export function buildLiquid(geo, { centre, reach, base, sky = '#2B2F7A', moon = '#FFF3D0', gain = 1.05, ripple = .004, maxSize = .04 }) {
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    uBase: { value: new THREE.Color(base) }, uSky: { value: new THREE.Color(sky) }, uMoon: { value: new THREE.Color(moon).multiplyScalar(gain) },
    uMoonDir: { value: new V3(0, 1, 0) }, uSize: { value: .03 }, uTime: { value: 0 }, uRipple: { value: ripple },
  }]);
  const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG, fog: true }));
  const mid = new V3(), eye = new V3(), toEye = new V3();
  mesh.onBeforeRender = (renderer, scene, camera) => {
    mesh.localToWorld(mid.copy(centre));
    toEye.subVectors(eye.setFromMatrixPosition(camera.matrixWorld), mid);
    const dist = toEye.length();
    toEye.divideScalar(dist);
    uniforms.uMoonDir.value.set(-toEye.x, toEye.y, -toEye.z);                  // 镜头看液面中央的视线，经水平的液面反射后的方向
    uniforms.uSize.value = Math.max(.002, Math.min(maxSize, .62 * reach * toEye.y / dist));   // 液面在画面里有多高，月影就占其中六成
  };
  return { mesh, setTime: t => { uniforms.uTime.value = t; } };
}
