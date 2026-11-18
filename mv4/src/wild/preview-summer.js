// 夏天的预览：只看夏天这一处（桥、瀑布、潭、崖、荷塘、下山的大远景），可以选天气停到几成。出静帧自查用，影片不加载。
// window.renderFrame(n)：n 的整数部分选机位（下面的 VIEWS）；小数第一位是放晴到几成（0 下着雨，9 全晴）；小数第二位是场景时间（秒）。
// 例如 1.93 是「雨停了」那个机位、全晴、第 3 秒。
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildWild } from '../wild.js';
import { Crab, pose, MOOD, KIT_NAMES } from '../crab.js';

const W = 1920, H = 1080, canvas = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
renderer.info.autoReset = false;

const started = performance.now(), wild = buildWild(renderer), { road } = wild;
const camera = new THREE.PerspectiveCamera(36, W / H, wild.clip.near, wild.clip.far);
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 }));
composer.addPass(new RenderPass(wild.scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), .32, .6, 1.1));
composer.addPass(new OutputPass());
let total = 0;
wild.scene.traverse(o => { if (o.isMesh) total += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : o.geometry.isInstancedBufferGeometry ? o.geometry.instanceCount : 1); });
let rail = 0;
wild.scene.traverse(o => { if (o.isMesh && o.geometry.attributes.aRail) rail += o.geometry.attributes.position.count / 3; });
console.log(`外景：建好用了 ${Math.round(performance.now() - started)} 毫秒，整个场景 ${Math.round(total)} 个三角形（其中桥栏杆 ${rail} 个）`);

// 路上离 (x, z) 最近的那一点的 u
const nearestU = (x, z) => { let best = 0, gap = Infinity; for (let k = 0; k <= 4000; k++) { const p = road.at(k / 4000), d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < gap) { gap = d; best = k / 4000; } } return best; };
const bridge = wild.SHOTS.find(s => s.name.includes('过桥')), vista = wild.SHOTS.find(s => s.name.includes('沿路往下看')), lotus = wild.SHOTS.find(s => s.name.includes('荷花'));
const uBridge = nearestU(bridge.q[0], bridge.q[2]), stand = road.at(uBridge), deckY = wild.heightAt(stand.x, stand.z);
// 「雨停了」那个镜头：从推荐机位朝小蟹靠近六成、升高 2（和 show/outside.js 里的算法一致）
const closeUp = paper => { const aim = [stand.x, deckY + 1.7 + 1.2 * paper, stand.z], e = bridge.p.map((v, i) => v + (aim[i] - v) * (.68 - .1 * paper)); e[1] += 2; return { p: e, q: aim }; };
const VIEWS = [
  { ...bridge, name: '过桥（影片 23.3 秒的机位）' },
  { name: '雨停了（影片 115 – 120 秒的机位）', ...closeUp(1) },
  { ...vista, name: '沿路往下看（影片 159.5 秒的机位）' },
  { name: '从桥上看瀑布和潭', p: [stand.x + 2, deckY + 3.2, stand.z - 6], q: [82, 196, 372] },
  { name: '从下游看桥的侧面', p: [50, 162, 505], q: [72, 182, 400] },
  { name: '贴着桥面看栏杆和石板', p: [stand.x + 2.2, deckY + 1.5, stand.z + 1.4], q: [stand.x + 9, deckY + .7, stand.z - 1.6] },
  { ...lotus, name: '湖湾荷花' },
  { name: '崖壁近看', p: [66, 186, 418], q: [92, 196, 386] },
  { name: '雨停了（举纸以前，镜头还没后退）', ...closeUp(0) },
];

const crabs = [new Crab(KIT_NAMES[2], 24), new Crab('pin', 42)];
crabs.forEach(c => wild.scene.add(c.root));
function castAt(t) {
  crabs.forEach((crab, i) => {
    const poseAt = time => {
      const u = uBridge - (i * 4.2 - .4 * time * (i ? 1 : 0)) / road.length, at = road.at(u), d = road.dir(u), len = Math.hypot(d.x, d.z), x = at.x - d.z / len * i * 1.3, z = at.z + d.x / len * i * 1.3;
      return pose({ x, z, y: wild.heightAt(x, z), yaw: Math.atan2(d.x, d.z) * 180 / Math.PI, walk: i ? time * 1.5 : 0, stride: .3, mood: i ? MOOD.open : MOOD.joy });
    };
    crab.update(poseAt, t);
  });
}

window.renderFrame = n => {
  const index = Math.floor(n + 1e-6), view = VIEWS[index], digits = Math.round((n - index) * 100), clear = Math.floor(digits / 10) / 9, t = digits % 10;
  camera.position.set(...view.p); camera.lookAt(...view.q);
  wild.setSeason('夏'); wild.setWeather(1 - clear);
  wild.update(t);
  castAt(t);
  wild.focus(new THREE.Vector3(...view.q));
  renderer.info.reset();
  const t0 = performance.now();
  composer.render();
  const gl = renderer.getContext();
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));       // 读回一个像素，等显卡真的画完再掐表
  const info = renderer.info.render;
  console.log(`机位 ${index}「${view.name}」放晴 ${clear.toFixed(2)} t=${t}：${(performance.now() - t0).toFixed(0)} 毫秒，${info.triangles} 个三角形，${info.calls} 次绘制`);
};
window.renderFrame(0);
window.mvReady = true;
