// 山体、山路和建筑的特写预览：机位贴着台阶侧面、亭屋桥跟前、崖壁底下，专门用来近看这几样东西。出静帧自查用，影片不加载。
// window.renderFrame(n)：n 的整数部分选下面 SHOTS 里的机位；小数部分 ×10 选季节（0 用机位自带的，1 春 2 夏 3 秋 4 冬）。
// window.dumpRoad() 返回路上各点的位置和高度（比对山路有没有被挪动用）。
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
const trisOf = root => { let n = 0; root.traverse(o => { if (o.isMesh) n += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : o.geometry.isInstancedBufferGeometry ? o.geometry.instanceCount : 1); }); return Math.round(n); };
// 场景里各部分依次是：光（几盏灯）、天、地形、路、水、云海、建筑、路边的东西、树、草石、飘落的东西
console.log(`外景：建好用了 ${Math.round(performance.now() - started)} 毫秒，路长 ${road.length.toFixed(0)}，整个场景 ${trisOf(wild.scene)} 个三角形；各部分 ${wild.scene.children.map(trisOf).filter(n => n > 0).join('、')}`);

// 路上 u 处附近的一点：沿下山方向往前 ahead、往右 side、抬高 up
const by = (u, ahead, side, up) => { const at = road.at(u), d = road.dir(u), len = Math.hypot(d.x, d.z); return [at.x + d.x / len * ahead - d.z / len * side, at.y + up, at.z + d.z / len * ahead + d.x / len * side]; };
const uOf = (x, z) => { let best = 0, bd = Infinity; for (let k = 0; k <= 4000; k++) { const p = road.at(k / 4000), d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; best = k / 4000; } } return best; };
const off = (p, dx, dy, dz) => [p[0] + dx, p[1] + dy, p[2] + dz];
const ridge = uOf(20, 150), lake = uOf(70, 793), bridge = uOf(60, 448), maple = uOf(128, 478), hut = uOf(-50, 432), bend = uOf(-108, 398), low = uOf(150, 522);
const hutAt = (() => { const best = wild.SHOTS[3].q; return best; })();
// u：小蟹摆在路上哪儿
const SHOTS = [
  { name: '石阶侧面·贴近看基座', season: '秋', u: ridge, p: by(ridge, 3, -8.5, 1.2), q: by(ridge, 0, -1, .4) },
  { name: '石阶侧面·从下往上看', season: '春', u: ridge, p: by(ridge, 9, 9.5, -1.5), q: by(ridge, -2, 0, 1) },
  { name: '石阶正面·贴着踏面', season: '春', u: ridge, p: by(ridge, 6.5, .6, .2), q: by(ridge, 0, 0, 1.4) },
  { name: '石板路·俯看路面', season: '春', u: lake, p: by(lake, 5, 1.5, 3.2), q: by(lake, 0, 0, .2) },
  { name: '石板路·贴地', season: '夏', u: low, p: by(low, 7, -2.5, .9), q: by(low, 0, .5, .8) },
  { name: '山坡上的石阶·护坡', season: '秋', u: bend, p: by(bend, 8, 9, 3.5), q: by(bend, 0, 0, 1) },
  { name: '山顶小亭·近看', season: '春', u: 0, p: [15, 447.5, 22], q: [0, 446, 0] },
  { name: '山顶小亭·仰看檐下', season: '秋', u: 0, p: [-7, 442.2, 11], q: [1, 448, -1] },
  { name: '小屋·近看', season: '冬', u: hut, p: off(hutAt, 9, 3.2, 11), q: off(hutAt, -1, .6, -3) },
  { name: '小屋·白天侧面', season: '春', u: hut, p: off(hutAt, -14, 4.5, 8), q: off(hutAt, 0, 1, -4) },
  { name: '石拱桥·从溪谷看', season: '夏', u: bridge, p: [50, 159, 474], q: [60, 166, 449] },
  { name: '石拱桥·桥头', season: '春', u: bridge, p: by(bridge, -16, 2.2, 2.4), q: by(bridge, -2, 0, 1.2) },
  { name: '主峰·仰看崖壁', season: '春', u: 0, p: [150, 130, 120], q: [10, 330, 40] },
  { name: '主峰·西面近看', season: '秋', u: 0, p: [-190, 330, 90], q: [0, 380, 30] },
  { name: '石峰·近看', season: '夏', u: 0, p: [330, 270, -120], q: [235, 250, -30] },
  { name: '主峰·北面冬夜', season: '冬', u: 0, p: [120, 380, -260], q: [0, 380, 0] },
  { name: '石灯', season: '冬', u: 1154 / road.length, p: by(1154 / road.length, 6, 0, 1.7), q: by(1154 / road.length, 0, -4.2, 1.1) },
  { name: '路碑', season: '春', u: 209 / road.length, p: by(209 / road.length, 5, .5, 1.8), q: by(209 / road.length, 0, 4.3, .9) },
  { name: '石凳', season: '秋', u: 569 / road.length, p: by(569 / road.length, 6, 0, 2), q: by(569 / road.length, 0, -4.3, .5) },
  { name: '山脊·从空中看整条石阶', season: '夏', u: ridge, p: [150, 420, 250], q: [20, 330, 130] },
];

const KITS = ['pin', KIT_NAMES[2], KIT_NAMES[1]], crabs = KITS.map((kit, i) => new Crab(kit, i === 0 ? 42 : 24));
crabs.forEach(c => wild.scene.add(c.root));
const LANE = [[0, 0], [3.2, 2], [-2.8, -1.9]];                      // 三只各自：沿路往前多少、往右偏多少
function castAt(u0) {
  crabs.forEach((crab, i) => {
    const u = u0 + LANE[i][0] / road.length, at = road.at(u), d = road.dir(u), len = Math.hypot(d.x, d.z), x = at.x - d.z / len * LANE[i][1], z = at.z + d.x / len * LANE[i][1];
    crab.update(() => pose({ x, z, y: wild.heightAt(x, z), yaw: Math.atan2(d.x, d.z) * 180 / Math.PI, walk: i * .3, stride: .3, mood: i === 1 ? MOOD.joy : MOOD.open }), 0);
  });
}

const PICK = ['春', '夏', '秋', '冬'];
window.renderFrame = n => {
  const index = Math.floor(n + 1e-6), shot = SHOTS[index], pick = Math.round(((n + 1e-6) % 1) * 10), season = pick === 0 ? shot.season : PICK[pick - 1];
  camera.position.set(shot.p[0], Math.max(shot.p[1], wild.heightAt(shot.p[0], shot.p[2]) + .7), shot.p[2]); camera.lookAt(...shot.q);   // 镜头不钻到地里
  wild.setSeason(season);
  wild.update(0);
  castAt(shot.u);
  wild.focus(new THREE.Vector3(...shot.q));
  renderer.info.reset();
  const t0 = performance.now();
  composer.render();
  const gl = renderer.getContext();
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
  console.log(`机位 ${index}「${shot.name}」${season}：${(performance.now() - t0).toFixed(0)} 毫秒，${renderer.info.render.triangles} 个三角形，${renderer.info.render.calls} 次绘制`);
};
// 路上 2001 个点：中线的位置、中线上的地面高度、中线两侧 ±2 和路缘石上（±3.65）的地面高度
window.dumpRoad = () => {
  const out = [];
  for (let k = 0; k <= 2000; k++) {
    const u = k / 2000, at = road.at(u);
    out.push(at.x, at.y, at.z, wild.heightAt(at.x, at.z), ...[-3.65, -2, 2, 3.65].map(side => { const [x, , z] = by(u, 0, side, 0); return wild.heightAt(x, z); }));
  }
  return out;
};
console.log('路的数据：' + JSON.stringify(window.dumpRoad().map(v => Math.round(v * 1e5) / 1e5)));
// 各部分头一次画要多久（编译着色器、上传贴图）：先全藏起来，再一部分一部分放出来各画一帧
{
  const parts = wild.scene.children.filter(o => !o.isLight && !crabs.some(c => c.root === o)), gl = renderer.getContext(), cost = [];
  parts.forEach(o => { o.visible = false; });
  camera.position.set(60, 420, 300); camera.lookAt(0, 380, 60); wild.setSeason('春'); wild.focus(new THREE.Vector3(10, 400, 60));
  for (const o of parts) {
    o.visible = true;
    const t0 = performance.now();
    renderer.render(wild.scene, camera); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    cost.push(Math.round(performance.now() - t0));
  }
  console.log(`各部分头一帧的毫秒数（天、地形、路、水、云海、建筑、路边的东西、树、草石、飘落的东西）：${cost.join('、')}`);
}
window.renderFrame(0);
window.mvReady = true;
