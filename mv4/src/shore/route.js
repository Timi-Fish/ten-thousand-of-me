// 小蟹在海边的位置：站着看海的那一点（矶头尖上那块平顶石）、看海的方向、从沙滩蹦上矶头的那段路，和推荐机位。
import * as THREE from 'three';
import { STAND } from './land.js';
import { SUN_DIR } from './palette.js';

// 路的折点（x, z）：沙滩 → 沙滩上来的那一级石头 → 矶头的根 → 矶头的背 → 尖上那块平顶石
const TURNS = [[9.2, 10.6], [7.6, 7.7], [4.9, 4.9], [2.6, 1.4], [.8, -2.0], [STAND.x, STAND.z]];

export function buildRoute(heightAt) {
  const stand = new THREE.Vector3(STAND.x, heightAt(STAND.x, STAND.z), STAND.z);
  const sea = new THREE.Vector3(SUN_DIR[0], 0, SUN_DIR[2]).normalize();
  const curve = new THREE.CatmullRomCurve3(TURNS.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
  const length = curve.getLength();
  const path = {
    length,
    // u 从 0（沙滩）到 1（stand），按路长均匀；返回贴着地面的点
    at(u) { const p = curve.getPointAt(Math.min(1, Math.max(0, u))); p.y = heightAt(p.x, p.z); return p; },
  };

  // 机位按 stand 和看海的方向摆：fwd 朝海，side 是朝海时的右手（右边是沙滩那个湾）
  const S = stand, fwd = sea, side = new THREE.Vector3(-sea.z, 0, sea.x);
  const at = (f, r, y) => [S.x + fwd.x * f + side.x * r, S.y + y, S.z + fwd.z * f + side.z * r].map(v => +v.toFixed(2));
  const SHOTS = [
    { name: '斜后方中景·越过小蟹看海和落日', p: at(-11, 4, 2), q: at(30, -1.5, 2.9) },
    { name: '侧前方·小蟹举纸，背景是海', p: at(2, 11, .9), q: at(0, 0, 1.9) },
    { name: '低机位·贴着水面看浪和光路', p: [5, 2.1, -16], q: [-40, 4.5, -200] },
    { name: '大远景·海和天', p: [22, 16, 38], q: [-14, 4, -90] },
    { name: '正面逆光·小蟹举纸，背后是落日和海', p: at(-9.5, -1.8, 1.4), q: at(0, 0, 2.5) },
  ];
  return { stand, sea, path, SHOTS };
}
