// 全场的光和雾：屋里的环境光、从月洞窗照进来的光（投影）、镜头一侧的暖色补光、远处的暗。
// 各模块共用这一套，自己只加局部的小灯（例如油灯的火光）。
// 有两套光：月夜（靛紫的冷光）和清晨（从同一扇窗照进来的桃色晨光）。setDawn(k) 在两者之间过渡。
import * as THREE from 'three';
import { MOON, STAGE } from './layout.js';
import { MOON_TINT } from './glow/shared.js';

const NIGHT = { sky: '#6E74D8', ground: '#3A2A66', hemi: 1.1, key: '#C9D2FF', keyPower: 2.4, fill: '#FFDDBE', fillPower: 1.2, fog: '#1C1A4A', haze: .0085, beam: '#C9D2FF' };
const DAWN = { sky: '#F6CDBE', ground: '#8A6470', hemi: 1.75, key: '#FFD3A6', keyPower: 3.3, fill: '#FFE9D6', fillPower: 1.5, fog: '#7A5A7C', haze: .0055, beam: '#FFC79A' };
const tone = (a, b, k) => new THREE.Color(a).lerp(new THREE.Color(b), k);

export function buildLights(scene) {
  scene.fog = new THREE.FogExp2(NIGHT.fog, NIGHT.haze);
  const hemi = new THREE.HemisphereLight(NIGHT.sky, NIGHT.ground, NIGHT.hemi);
  const moon = new THREE.DirectionalLight(NIGHT.key, NIGHT.keyPower);
  moon.position.copy(MOON).normalize().multiplyScalar(60).add(new THREE.Vector3(0, 0, STAGE.z));
  moon.target.position.set(0, 0, STAGE.z - 6);
  moon.castShadow = true;
  moon.shadow.mapSize.set(4096, 4096);
  Object.assign(moon.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, near: 5, far: 150 });
  moon.shadow.bias = -.0004; moon.shadow.normalBias = .03;
  const fill = new THREE.DirectionalLight(NIGHT.fill, NIGHT.fillPower);
  fill.position.set(-7, 9, 16);
  scene.add(hemi, moon, moon.target, fill);
  return {
    // k：0 月夜，1 清晨
    setDawn(k) {
      const mixed = name => tone(NIGHT[name], DAWN[name], k), level = name => NIGHT[name] + (DAWN[name] - NIGHT[name]) * k;
      hemi.color.copy(mixed('sky')); hemi.groundColor.copy(mixed('ground')); hemi.intensity = level('hemi');
      moon.color.copy(mixed('key')); moon.intensity = level('keyPower');
      fill.color.copy(mixed('fill')); fill.intensity = level('fillPower');
      scene.fog.color.copy(mixed('fog')); scene.fog.density = level('haze');
      MOON_TINT.copy(mixed('beam'));                                  // 光柱和浮尘用的是同一个颜色
    },
  };
}
