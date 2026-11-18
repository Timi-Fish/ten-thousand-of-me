// 海边的预览：装好海边，在 stand 上放一只真的小蟹，头顶举一块白板（那张纸的替身），按机位出图。出静帧自查用，影片不加载。
// window.renderFrame(n)：n 的整数部分选机位（先是模块导出的 SHOTS，再是下面的检查机位），小数部分 ×10 是这一场开始后的秒数。
// 和影片里一样：这一场从歌曲的 T0 秒开始，落日在 SPAN 秒里从海平线上方匀速沉到海平线（所以小数部分同时定了日落的进度）。
// 机位名字里有「举纸」的，小蟹转过来面朝镜头、把板举过头顶；其余的面朝海。
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildShore } from '../shore.js';
import { Crab, pose, MOOD } from '../crab.js';

const W = 1920, H = 1080, canvas = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
renderer.info.autoReset = false;

const started = performance.now(), shore = buildShore(renderer), { stand, sea, path } = shore;
const built = performance.now() - started;
const camera = new THREE.PerspectiveCamera(36, W / H, shore.clip.near, shore.clip.far);
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 }));
composer.addPass(new RenderPass(shore.scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), .32, .6, 1.1));
composer.addPass(new OutputPass());
let total = 0;
shore.scene.traverse(o => { if (o.isMesh || o.isPoints) total += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : o.geometry.isInstancedBufferGeometry ? o.geometry.instanceCount : 1); });
console.log(`海边：建好用了 ${Math.round(built)} 毫秒，路长 ${path.length.toFixed(1)}，stand ${stand.toArray().map(v => v.toFixed(2))}，sea ${sea.toArray().map(v => v.toFixed(3))}，整个场景 ${Math.round(total)} 个三角形`);

// 检查机位：不属于影片。fov 是视角（度）
const T0 = 119.8, SPAN = 4.6, FOV = 36;
const S = stand.toArray(), mid = path.at(.45).toArray();
const CHECKS = [
  { name: '检查·俯看矶头和路', p: [16, 22, 18], q: [2, 2, -2], fov: FOV },
  { name: '检查·礁石脚下的浪', p: [-5, 2.6, -15], q: [-1, .6, -8], fov: FOV },
  { name: '检查·沙滩和湾', p: [24, 4, 18], q: [10, 0, 4], fov: FOV },
  { name: '检查·路上半途', p: [mid[0] + 7, mid[1] + 3, mid[2] + 6], q: mid, fov: FOV },
  { name: '检查·长焦看落日', p: [S[0], S[1] + 2, S[2]], q: [S[0] + sea.x * 100, S[1] + 2 + 5.4, S[2] + sea.z * 100], fov: 11 },
];
const shots = [...shore.SHOTS.map(shot => ({ ...shot, fov: FOV })), ...CHECKS];
console.log(`路上每隔一成的点：${Array.from({ length: 11 }, (_, i) => path.at(i / 10).toArray().map(v => v.toFixed(2)).join(',')).join(' | ')}`);
console.log(`SHOTS：${JSON.stringify(shore.SHOTS)}`);

const crab = new Crab('crown', 42);
const board = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.3), new THREE.MeshLambertMaterial({ color: '#FFFFFF', side: THREE.DoubleSide }));
board.castShadow = true;
shore.scene.add(crab.root, board);
const seaYaw = Math.atan2(sea.x, sea.z) * 180 / Math.PI;

window.renderFrame = n => {
  const index = Math.floor(n + 1e-6), shot = shots[index], t = ((n + 1e-6) % 1) * 10;
  camera.fov = shot.fov; camera.updateProjectionMatrix();
  camera.position.set(...shot.p); camera.lookAt(...shot.q);
  shore.setSunset(Math.min(1, t / SPAN)); shore.update(T0 + t);
  const show = /举纸/.test(shot.name), yaw = show ? Math.atan2(shot.p[0] - S[0], shot.p[2] - S[2]) * 180 / Math.PI : seaYaw;
  crab.update(() => pose({ x: S[0], y: S[1], z: S[2], yaw, mood: show ? MOOD.joy : MOOD.open, aL: show ? [80, .3, .05] : [-30, .24, .1], aR: show ? [80, .3, .05] : [-30, .24, .1] }), t);
  board.visible = show;
  board.position.set(S[0], S[1] + 2.25 + 1.15, S[2]);
  board.rotation.set(0, yaw * Math.PI / 180, 0);
  shore.focus(stand);
  renderer.info.reset();
  const t0 = performance.now();
  composer.render();
  const gl = renderer.getContext();
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));       // 读回一个像素，等显卡真的画完再掐表
  const info = renderer.info.render;
  console.log(`机位 ${index}「${shot.name}」t=${t.toFixed(1)}：${(performance.now() - t0).toFixed(0)} 毫秒，${info.triangles} 个三角形，${info.calls} 次绘制`);
};
window.renderFrame(0);
window.mvReady = true;
