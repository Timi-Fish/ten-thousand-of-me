// 窗外的天：夜空（渐变、远处的云影、星）、满月（月面明暗）、月晕、飘过月前的两层薄云。
// 这些都只从月洞窗里看得到，全部不受屋里的雾影响。
import * as THREE from 'three';
import { MOON, MOON_R, MOON_EYE, MOON_DIR } from '../layout.js';
import { fbm, pixelCanvas, toTexture, clamp, smooth, stream } from './util.js';

const NOISE_GLSL = `
  float hash21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash21(i), hash21(i + vec2(1,0)), f.x), mix(hash21(i + vec2(0,1)), hash21(i + vec2(1,1)), f.x), f.y); }
  float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a * vnoise(p); p = p * 2.03 + vec2(17.1, 9.7); a *= 0.5; } return s; }
`;

// 月面：暖白的高地、灰蓝的月海、几个带辐射纹的亮坑。图案是程序随机长出来的，不照任何真实月面图
function moonCanvas(size = 768) {
  const rs = stream(41), spots = [];
  for (let i = 0; i < 5; i++) spots.push({ x: rs.range(.25, .75), y: rs.range(.3, .8), r: rs.range(.012, .022), turn: rs() * 6 });
  return pixelCanvas(size, size, (px, py, out) => {
    const u = px / size, v = py / size, wx = u * 4.2 + 1.5 * fbm(u * 3 + 3, v * 3 + 8, 3), wy = v * 4.2 + 1.5 * fbm(u * 3 + 11, v * 3 + 2, 3);
    const side = smooth(.66, .12, Math.hypot(u - .40, v - .40));                                    // 月海偏在左上一侧
    const mare = smooth(.42, .60, fbm(wx, wy, 5) * .66 + side * .34) * (.7 + .6 * fbm(u * 17 + 5, v * 17, 3));
    let light = 1 - .30 * mare + .07 * (fbm(u * 30, v * 30, 4) - .5) + .04 * (fbm(u * 80, v * 80, 3) - .5);
    for (const c of spots) {                                                                        // 亮坑：一个柔和的亮点，四周几道很淡的辐射纹
      const dx = u - c.x, dy = v - c.y, d = Math.hypot(dx, dy);
      light += .07 * Math.exp(-((d / c.r) ** 2)) + .03 * Math.exp(-d / (c.r * 5)) * Math.max(0, Math.sin(Math.atan2(dy, dx) * 7 + c.turn)) ** 2;
    }
    out[0] = clamp(244 * light * (1 - .05 * mare), 0, 255); out[1] = clamp(238 * light * (1 - .025 * mare), 0, 255); out[2] = clamp(220 * light * (1 + .06 * mare), 0, 255);
  });
}

export function buildSky(scene) {
  const uniforms = { uTime: { value: 0 }, uMoon: { value: MOON.clone() }, uMoonR: { value: MOON_R }, uDawn: { value: 0 } };   // uDawn：0 月夜，1 清晨（天色转成桃色的晨光，星隐去，月亮淡下去）

  // 夜空：一个大球的内壁。按视线仰角渐变，靠近月亮的方向被月光照亮一圈（月晕），再叠远处缓慢移动的云影和星
  const sky = new THREE.Mesh(new THREE.SphereGeometry(420, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, fog: false, depthWrite: false, uniforms,
    vertexShader: `varying vec3 vWorld; void main(){ vWorld = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0); }`,
    fragmentShader: `uniform float uTime, uMoonR, uDawn; uniform vec3 uMoon; varying vec3 vWorld;
      ${NOISE_GLSL}
      // 一层星：把天球按经纬切成小格，每格至多一颗，位置、亮度、闪烁的快慢都由格子编号决定
      float starLayer(vec2 sph, float cell, float keep, float size){
        vec2 g = sph / cell, id = floor(g), f = fract(g) - 0.5;
        float h = hash21(id);
        vec2 at = (vec2(hash21(id + 7.7), hash21(id + 3.1)) - 0.5) * 0.7;
        float d = length(f - at) * cell;
        float twinkle = 0.78 + 0.22 * sin(uTime * (0.8 + 2.2 * hash21(id + 1.3)) + 40.0 * h);
        return step(keep, h) * (0.35 + 0.65 * hash21(id + 5.9)) * twinkle * exp(-d * d / (size * size));
      }
      void main(){
        vec3 dir = normalize(vWorld - cameraPosition), toMoon = uMoon - cameraPosition;
        float moonDist = length(toMoon), ang = acos(clamp(dot(dir, toMoon / moonDist), -1.0, 1.0));
        float r = ang / asin(uMoonR / moonDist);                         // 离月心几个月亮半径
        float h = dir.y;
        // 这里的颜色都是线性光的数值（比看上去的暗得多）
        vec3 c = mix(vec3(0.020, 0.019, 0.085), vec3(0.006, 0.008, 0.040), smoothstep(0.02, 0.42, h));   // 低处偏紫、高处深靛
        c = mix(c, mix(vec3(0.74, 0.34, 0.22), vec3(0.20, 0.25, 0.52), smoothstep(-0.02, 0.36, h)), uDawn);   // 清晨：天边桃红，往上转成淡青
        vec2 sph = vec2(atan(dir.x, -dir.z), asin(clamp(dir.y, -1.0, 1.0)));
        // 远处的云影：很淡的一层，比薄云更远更慢
        float bank = fbm(sph * vec2(5.0, 11.0) + vec2(uTime * 0.004, 0.0));
        c += vec3(0.012, 0.013, 0.034) * smoothstep(0.42, 0.78, bank);
        // 星：月亮附近被月光盖住
        float stars = starLayer(sph, 0.034, 0.52, 0.0016) + 0.55 * starLayer(sph + 3.3, 0.015, 0.62, 0.0011);
        c += vec3(1.0, 0.96, 0.88) * 1.3 * stars * smoothstep(1.3, 3.6, r) * (1.0 - uDawn);
        // 天边两重远山：只占地平线上一点点高度，始终在月轮下沿以下。山脚浸在夜雾里，远的一重更淡
        float farTop = 0.018 + 0.036 * fbm(vec2(sph.x * 13.0 + 3.0, 1.7)), nearTop = 0.002 + 0.030 * fbm(vec2(sph.x * 19.0 + 9.0, 5.1));
        vec3 haze = mix(vec3(0.030, 0.032, 0.095), vec3(0.66, 0.40, 0.34), uDawn);
        c = mix(c, mix(haze, mix(vec3(0.014, 0.016, 0.056), vec3(0.30, 0.24, 0.40), uDawn), smoothstep(0.0, farTop, sph.y)), smoothstep(farTop + 0.0012, farTop - 0.0012, sph.y));
        c = mix(c, mix(haze, mix(vec3(0.006, 0.007, 0.028), vec3(0.16, 0.14, 0.30), uDawn), smoothstep(-0.01, nearTop, sph.y)), smoothstep(nearTop + 0.0012, nearTop - 0.0012, sph.y));
        // 月晕：贴着月轮一圈亮，往外很快淡下去，再拖一片很宽很淡的光；外面一圈极淡的晕环
        float near = exp(-max(r - 1.0, 0.0) * 2.6), wide = exp(-max(r - 1.0, 0.0) * 0.55);
        float ring = exp(-pow((r - 2.75) / 0.2, 2.0));
        c += (vec3(0.30, 0.34, 0.56) * (0.42 * near + 0.11 * wide) + vec3(0.30, 0.32, 0.46) * 0.022 * ring) * mix(1.0, 0.45, smoothstep(farTop + 0.002, farTop - 0.002, sph.y)) * (1.0 - 0.8 * uDawn);
        gl_FragColor = vec4(c, 1.0);
      }`,
  }));
  sky.renderOrder = -10;
  scene.add(sky);

  // 月亮：一张朝着屋里的圆盘。边缘略暗、带一点柔边；亮度压在泛光阈值附近，月海看得清
  const moon = new THREE.Mesh(new THREE.CircleGeometry(MOON_R * 1.03, 96), new THREE.ShaderMaterial({
    fog: false, transparent: true, depthWrite: false,
    uniforms: { map: { value: toTexture(moonCanvas()) }, uR: { value: 1 / 1.03 }, uDawn: uniforms.uDawn },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform sampler2D map; uniform float uR, uDawn; varying vec2 vUv;
      void main(){
        vec2 p = (vUv - 0.5) * 2.0 / uR; float r = length(p);
        vec3 face = texture2D(map, p * 0.5 * 0.985 + 0.5).rgb;
        float limb = mix(0.80, 1.0, sqrt(max(1.0 - r * r, 0.0)));         // 边缘稍暗，显出球的体积
        vec3 c = face * limb * vec3(1.12, 1.09, 1.0);
        gl_FragColor = vec4(mix(c, vec3(1.0, 0.93, 0.9), 0.5 * uDawn), smoothstep(1.0, 0.975, r) * (1.0 - 0.62 * uDawn));   // 清晨只剩一轮淡淡的残月
      }`,
  }));
  moon.renderOrder = -8;
  scene.add(moon);

  // 薄云：两层透明的面，在月亮和墙之间。云的形状是随时间平移的分形噪声；离月亮近的云被照亮，远的只是一抹暗影
  const cloudMat = (seed, scale, speed, cover, alpha) => new THREE.ShaderMaterial({
    fog: false, transparent: true, depthWrite: false,
    uniforms: { ...uniforms, uSeed: { value: seed }, uScale: { value: scale }, uSpeed: { value: speed }, uCover: { value: cover }, uAlpha: { value: alpha } },
    vertexShader: `varying vec3 vWorld; varying vec2 vUv; void main(){ vUv = uv; vWorld = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0); }`,
    fragmentShader: `uniform float uTime, uMoonR, uSeed, uSpeed, uCover, uAlpha, uDawn; uniform vec2 uScale; uniform vec3 uMoon; varying vec3 vWorld; varying vec2 vUv;
      ${NOISE_GLSL}
      void main(){
        vec2 p = vWorld.xy * uScale + vec2(uSeed - uTime * uSpeed, uSeed * 1.7 + uTime * uSpeed * 0.12);
        float warp = fbm(p * 0.6 + 5.0);
        float d = fbm(p + vec2(warp * 1.6, warp * 0.5));
        float body = smoothstep(uCover, uCover + 0.30, d);
        float edge = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x) * smoothstep(0.0, 0.2, vUv.y) * smoothstep(1.0, 0.8, vUv.y);
        vec3 toMoon = uMoon - cameraPosition; float moonDist = length(toMoon);
        float r = acos(clamp(dot(normalize(vWorld - cameraPosition), toMoon / moonDist), -1.0, 1.0)) / asin(uMoonR / moonDist);
        float lit = exp(-max(r - 0.8, 0.0) * 0.9);
        vec3 c = mix(vec3(0.012, 0.013, 0.050), vec3(0.50, 0.54, 0.78), lit * (0.35 + 0.65 * body));
        c = mix(c, vec3(0.95, 0.56, 0.44) * (0.55 + 0.45 * body), uDawn);                           // 清晨的云被染成桃色
        gl_FragColor = vec4(c, body * uAlpha * edge * mix(1.0, 0.62, smoothstep(1.2, 0.6, r)));   // 正挡在月面上的那部分更透，月亮不被盖死
      }`,
  });
  const clouds = [
    { z: MOON.z + 1.6, mat: cloudMat(3.7, new THREE.Vector2(.050, .125), .019, .50, .62) },
    { z: MOON.z + 3.4, mat: cloudMat(11.2, new THREE.Vector2(.034, .095), .030, .56, .50) },
  ].map(({ z, mat }, i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(130, 100), mat);
    m.position.set(MOON.x, MOON.y, z); m.renderOrder = -6 + i;
    scene.add(m);
    return m;
  });

  // 月亮在天上：每帧把圆盘摆到「从镜头出发、朝 MOON_DIR 很远」的地方，面朝镜头，放大到看着和原来一样大；
  // 天和云里按「离月心多远」算的月晕、云的受光，也跟着用同一个方向（uMoon 是这个方向上离镜头 SPAN 远的那一点）
  const SPAN = MOON.distanceTo(MOON_EYE), AWAY = 380;
  const setEye = eye => {
    moon.position.copy(eye).addScaledVector(MOON_DIR, AWAY); moon.scale.setScalar(AWAY / SPAN); moon.lookAt(eye);
    uniforms.uMoon.value.copy(eye).addScaledVector(MOON_DIR, SPAN);
  };
  setEye(MOON_EYE);
  return { update(t) { uniforms.uTime.value = t; }, setDawn(k) { uniforms.uDawn.value = k; }, setEye, moon, clouds };
}
