// 小蟹的检查表：只有灯光、一张纸当地面，和按表摆好的小蟹。出静帧用。
// window.renderFrame(n)：n 的整数部分选哪张表，小数部分 ×10 是时间（秒）。
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildLights } from '../world/lights.js';
import { Crab, pose, MOOD, KIT_NAMES } from '../crab.js';
import { SHEETS } from './preview-sheets.js';

const W = 1920, H = 1080, canvas = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(36, W / H, .1, 900);
scene.background = new THREE.Color('#141440');
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 }));
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), .32, .6, 1.1));
composer.addPass(new OutputPass());
renderer.info.autoReset = false;
buildLights(scene);
const paper = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({ color: '#F3EAD6', roughness: .95 }));
paper.rotation.x = -Math.PI / 2; paper.receiveShadow = true;
scene.add(paper);

// 每张表第一次用到时才把小蟹造出来；不在这张表上的藏起来
const built = new Map();
function sheet(i) {
  if (!built.has(i)) {
    const def = SHEETS[i]({ pose, MOOD, KIT_NAMES }), group = new THREE.Group();
    scene.add(group);
    const cast = def.cast.map(({ kit = 'pin', steps = 42, at }) => { const crab = new Crab(kit, steps); group.add(crab.root); return { crab, at }; });
    const extra = def.extra ? def.extra(group, cast.map(c => c.crab)) : null;
    built.set(i, { ...def, group, cast, extra });
  }
  built.forEach((s, k) => { s.group.visible = k === i; });
  return built.get(i);
}

window.renderFrame = n => {
  const s = sheet(Math.floor(n + 1e-6)), t = ((n + 1e-6) % 1) * 10, cam = typeof s.cam === 'function' ? s.cam(t) : s.cam;
  camera.position.set(...cam.p); camera.lookAt(...cam.q);
  const t0 = performance.now();
  s.cast.forEach(({ crab, at }) => crab.update(u => at(u), t));
  if (s.extra) s.extra(t);
  const t1 = performance.now();
  renderer.info.reset();
  composer.render();
  const gl = renderer.getContext();
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));       // 读回一个像素，等显卡真的画完再掐表
  const t2 = performance.now(), info = renderer.info.render;
  console.log(`表 ${Math.floor(n + 1e-6)}「${s.name}」t=${t.toFixed(2)}：${s.cast.length} 只，摆姿势 ${(t1 - t0).toFixed(1)} 毫秒，画 ${(t2 - t1).toFixed(1)} 毫秒，${info.triangles} 个三角形，${info.calls} 次绘制`);
};
window.renderFrame(0);
window.mvReady = true;
