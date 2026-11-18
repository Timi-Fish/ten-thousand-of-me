// 光：天光（半球光）、日或月（平行光，投影）、三盏跟着焦点走的灯火（点光，不投影）、和给小蟹用的雾。
// 外景自己的着色器直接用 paint.js 里的 U 算受光，这几盏灯是给小蟹的着色器读的，两边的值一致（季节表另给了 figurePower 的那一季，小蟹受到的日光按它算）。
// 投影分两层（山的大影子另有预先烘好的贴图）：
//   近层只罩住焦点周围 NEAR_REACH 个单位，一个像素约 0.02 个单位，小蟹的脚、触角、栏杆的横档在石阶上都有干净的影子；
//   远层罩住 WIDE_REACH 个单位，接住路两旁的树影。远层那盏灯是黑的、和日光同向：只借它的投影，不给任何东西添光
//   （小蟹的着色器对同向的黑灯算出来的明暗和日光一样，颜色加的是零）。
// 投影的方向比真正的日月抬高到至少 MIN_ELEV：黄昏的太阳只有九度高，照实投的话两个单位高的小蟹要拖出十几个单位长的影子，
// 脚下反而看不出影子；抬高之后影子落在脚边两三步之内，方位不变。景物自己的明暗仍按真正的日月方向算。
import * as THREE from 'three';
import { U } from './paint.js';

const NEAR_REACH = 21, WIDE_REACH = 74, LAMPS = 3, MAP = 2048, BACK = 320;
const MIN_ELEV = 23 * Math.PI / 180;
const UP = new THREE.Vector3(0, 1, 0);

function shadowLight(reach, bias, normalBias, radius) {
  const light = new THREE.DirectionalLight();
  light.castShadow = true; light.shadow.mapSize.set(MAP, MAP);
  Object.assign(light.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach, near: 20, far: 2 * BACK });
  light.shadow.bias = bias; light.shadow.normalBias = normalBias; light.shadow.radius = radius;
  light.userData.texel = 2 * reach / MAP;
  return light;
}

export function buildLights(scene) {
  const hemi = new THREE.HemisphereLight(), sun = shadowLight(NEAR_REACH, -.0002, .022, 2.2), wide = shadowLight(WIDE_REACH, -.0005, .08, 1.6);
  wide.color.set('#000000');
  const lamps = Array.from({ length: LAMPS }, () => new THREE.PointLight('#FFB45A', 0, 30, 2));
  scene.add(hemi, sun, sun.target, wide, wide.target, ...lamps);
  scene.fog = new THREE.FogExp2('#FFFFFF', .001);
  const dir = new THREE.Vector3(), shade = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3(), center = new THREE.Vector3();
  const sky = new THREE.Color(), ground = new THREE.Color();
  // 把一盏投影灯对准 point。对准的位置按投影贴图的像素取整：镜头连续移动时影子的边缘不会跟着一格一格地爬
  const aim = (light, point) => {
    const texel = light.userData.texel;
    center.set(0, 0, 0).addScaledVector(right, Math.round(point.dot(right) / texel) * texel).addScaledVector(up, Math.round(point.dot(up) / texel) * texel).addScaledVector(shade, point.dot(shade));
    light.target.position.copy(center);
    light.position.copy(center).addScaledVector(shade, BACK);
  };
  return {
    sun,
    setSeason(S) {
      dir.fromArray(S.sunDir).normalize();
      U.uSunDir.value.copy(dir);
      // 投影用的方向：方位照旧，仰角不低于 MIN_ELEV
      shade.copy(dir); shade.y = Math.max(shade.y, Math.hypot(shade.x, shade.z) * Math.tan(MIN_ELEV)); shade.normalize();
      right.crossVectors(UP, shade).normalize(); up.crossVectors(shade, right);
      // 小蟹和它举的纸是平涂的，日头从镜头背后正照过来时比景物容易发白：季节表里可以另给它们一个日光强度（figurePower），不给就和景物一样
      const { figurePower = S.sunPower } = S;
      sun.color.set(S.sunCol); sun.intensity = figurePower; U.uSunCol.value.set(S.sunCol).multiplyScalar(S.sunPower);
      hemi.color.set(S.skyCol); hemi.groundColor.set(S.gndCol); hemi.intensity = S.hemiPower;
      U.uSkyCol.value.copy(sky.set(S.skyCol)).multiplyScalar(S.hemiPower); U.uGndCol.value.copy(ground.set(S.gndCol)).multiplyScalar(S.hemiPower);
      lamps.forEach(lamp => { lamp.intensity = 34 * S.lampPower; });
      // 小蟹用的雾：颜色取天边，浓度按「150 个单位远处和外景的远霭一样浓」折算
      const [haze, mist] = S.u.uFogP;
      scene.fog.color.copy(U.uHorizon.value).lerp(U.uHorizonSun.value, .3);
      scene.fog.density = Math.sqrt((haze + mist * .12) / 150);
    },
    // spots：能亮的灯火的位置（石灯、小屋的窗）。离焦点最近的三处各配一盏点光
    focus(point, spots) {
      aim(sun, point); aim(wide, point);
      const nearest = [...spots].sort((a, b) => a.distanceToSquared(point) - b.distanceToSquared(point));
      lamps.forEach((lamp, i) => lamp.position.copy(nearest[i]));
    },
  };
}
