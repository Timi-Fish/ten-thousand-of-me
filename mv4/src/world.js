// 场景「月夜书案」的总装：先布光，再按固定顺序装四个模块（背景 → 书案 → 文房 → 灯火）。
// 后装的模块能从 ctx 里拿到先装的模块导出的东西。
import * as THREE from 'three';
import { buildLights } from './world/lights.js';
import * as backdrop from './world/backdrop.js';
import * as desk from './world/desk.js';
import * as study from './world/study.js';
import * as glow from './world/glow.js';

export function buildWorld(scene, renderer) {
  const lights = buildLights(scene);
  const ctx = { renderer }, parts = [backdrop, desk, study, glow].map(mod => { const part = mod.build(scene, ctx); Object.assign(ctx, part); return part; });
  return {
    panels: ctx.panels, perches: ctx.perches, branchTips: ctx.branchTips,   // 四扇屏风的画心；镇尺顶面的落脚点；梅枝上开花的地方
    flame: ctx.flame, wick: ctx.wick,                                       // 油灯火苗的中心；灯芯顶端
    // 这一帧的天色、灯火和镜头位置：dawn 0 月夜、1 清晨；lamp 油灯的火势（1 正常，0 熄灭）；cam.p 镜头在哪（月亮按它摆到天上）。每帧在 update 之前调
    set({ dawn, lamp, cam }) { lights.setDawn(dawn); ctx.setDawn(dawn); ctx.setLamp(lamp); ctx.setEye(new THREE.Vector3(...cam.p)); },
    update(t) { parts.forEach(p => p.update(t)); },
  };
}
