// 光：天光（半球光）、落日（平行光，投影）、一盏从真正的落日那个方向贴着海面打过来的逆光（平行光，不投影，亮度是落日的 RIM 倍）和给小蟹用的雾。
// 逆光是给小蟹勾轮廓的：镜头迎着落日拍它时，它朝着落日的那一侧边上亮一线落日的颜色（礁石的同一道轮廓光在 paint.js 的 backRim 里）。
// 海边自己的着色器直接用 paint.js 里的 U 算受光，这几盏灯是给小蟹的着色器读的：每次日落的进度变了，就从 U 里把同样的值抄过来，两边始终一致。
// 投影罩住焦点周围 REACH 个单位，一个像素约 0.016 个单位：小蟹的脚、触角在礁石上都有干净的影子。
// 投影的方向比真正的落日抬高到 MIN_ELEV：落日只有几度高，照实投的话两个单位高的小蟹要拖出二十多个单位长的影子，
// 脚下反而看不出影子；抬高之后影子落在脚边两三步之内，方位不变。落日一路往下落都低于这个角度，所以影子不跟着动；
// 景物自己的明暗仍按真正的落日算。（山里外景也是这样做的）
import * as THREE from 'three';
import { U } from './paint.js';

const REACH = 16, MAP = 2048, BACK = 120, MIN_ELEV = 23 * Math.PI / 180, RIM = .55;
const UP = new THREE.Vector3(0, 1, 0);

export function buildLights(scene) {
  const hemi = new THREE.HemisphereLight(), sun = new THREE.DirectionalLight(), rim = new THREE.DirectionalLight();
  sun.castShadow = true; sun.shadow.mapSize.set(MAP, MAP);
  Object.assign(sun.shadow.camera, { left: -REACH, right: REACH, top: REACH, bottom: -REACH, near: 10, far: 2 * BACK });
  sun.shadow.bias = -.0002; sun.shadow.normalBias = .02; sun.shadow.radius = 2;
  scene.add(hemi, sun, sun.target, rim);
  scene.fog = new THREE.FogExp2('#FFFFFF', .0075);                     // 小蟹用的雾：浓度让二三十个单位外的小蟹淡进去一点点

  const shade = U.uSunDir.value.clone().setY(0).normalize().multiplyScalar(Math.cos(MIN_ELEV)).setY(Math.sin(MIN_ELEV));
  const right = new THREE.Vector3().crossVectors(UP, shade).normalize(), up = new THREE.Vector3().crossVectors(shade, right), center = new THREE.Vector3();
  const texel = 2 * REACH / MAP;
  return {
    sun,
    // 日落的进度变了以后调：灯的颜色和亮度照 U 里的抄（U 里的颜色已经乘过亮度）；逆光从真正的落日那边来（它照向原点，所以位置就是方向）；
    // 雾的颜色取天边（朝落日那侧掺三成）
    dusk() {
      sun.color.copy(U.uSunCol.value); hemi.color.copy(U.uSkyCol.value); hemi.groundColor.copy(U.uGndCol.value);
      rim.color.copy(U.uSunCol.value).multiplyScalar(RIM); rim.position.copy(U.uSunDir.value);
      scene.fog.color.copy(U.uHorizon.value).lerp(U.uHorizonSun.value, .3);
    },
    // 把投影对准 point。对准的位置按投影贴图的像素取整：镜头连续移动时影子的边缘不会一格一格地爬
    focus(point) {
      center.set(0, 0, 0).addScaledVector(right, Math.round(point.dot(right) / texel) * texel).addScaledVector(up, Math.round(point.dot(up) / texel) * texel).addScaledVector(shade, point.dot(shade));
      sun.target.position.copy(center);
      sun.position.copy(center).addScaledVector(shade, BACK);
    },
  };
}
