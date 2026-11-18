// 场景模块的预览工具：只装指定的模块，摆上几只小蟹当比例尺，按影片的机位出图。
// 页面里先设 window.PARTS（要装的模块名，如 ['arch']），再加载本文件。
// window.renderFrame(t)：t 的整数部分选机位（先是影片的 6 个机位，再是各模块自己导出的 SHOTS），小数部分 ×10 是场景时间（秒）。
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { buildLights } from './lights.js';
import { SHOTS, PAPER } from './layout.js';

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
renderer.info.autoReset = false;                                   // 一帧要画好几遍（投影、主画面、后期），统计时合在一起算
buildLights(scene);

// 按固定顺序装模块：背景 → 书案 → 文房 → 灯火。后装的能拿到先装的导出的东西（ctx）
const ORDER = ['backdrop', 'desk', 'study', 'glow'], ctx = { renderer }, parts = [], shots = [...SHOTS];
for (const name of ORDER.filter(n => window.PARTS.includes(n))) {
  const started = performance.now(), mod = await import(`./${name}.js`), part = mod.build(scene, ctx);
  Object.assign(ctx, part);
  parts.push(part);
  if (mod.SHOTS) shots.push(...mod.SHOTS);
  console.log(`${name}：建好用了 ${Math.round(performance.now() - started)} 毫秒`);
}
if (!window.PARTS.includes('desk')) {                               // 没装书案时，放一块素色的板顶替宣纸和案面，方便看比例
  const sheet = new THREE.Mesh(new THREE.BoxGeometry(PAPER.x1 - PAPER.x0, .1, PAPER.z1 - PAPER.z0), new THREE.MeshStandardMaterial({ color: '#D9CCB0', roughness: .95 }));
  sheet.position.set((PAPER.x0 + PAPER.x1) / 2, -.05, (PAPER.z0 + PAPER.z1) / 2); sheet.receiveShadow = true;
  const board = new THREE.Mesh(new THREE.BoxGeometry(88, .4, 42), new THREE.MeshStandardMaterial({ color: '#2A1C22', roughness: .8 }));
  board.position.set(0, -.32, -6); board.receiveShadow = true;
  scene.add(sheet, board);
}
// 比例尺：几块和小蟹一样大的橙色方块，站在小蟹表演时站的位置（主角 1.15 倍，分身 0.56 倍）
const blockGeo = new RoundedBoxGeometry(1.9, 1.5, 1.5, 8, .5), blockMat = new THREE.MeshStandardMaterial({ color: '#E58462', roughness: .8 });
for (const [x, z, s] of [[0, .6, 1.15], [-3.5, 2.5, .56], [3.5, 2.5, .56], [-2.1, -2.3, .56], [4.9, -2.3, .56]]) {
  const block = new THREE.Mesh(blockGeo, blockMat);
  block.position.set(x, 1.01 * s, z); block.scale.setScalar(s); block.castShadow = true;
  scene.add(block);
}

window.renderFrame = t => {
  const shot = shots[Math.floor(t)], time = (t % 1) * 10;
  camera.position.set(...shot.p); camera.lookAt(...shot.q);
  parts.forEach(p => p.update(time));
  renderer.info.reset();
  composer.render();
  const info = renderer.info.render;
  console.log(`机位 ${Math.floor(t)}「${shot.name}」：${info.triangles} 个三角形，${info.calls} 次绘制`);
};
window.renderFrame(3);
window.mvReady = true;
