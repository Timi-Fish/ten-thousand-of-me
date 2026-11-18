// 树和地被的自查页：装好整片山水，把镜头对准每种树的单株、树脚、树冠，和贴着草丛的低机位。出静帧自查用，影片不加载。
// window.renderFrame(n)：n 的整数部分选下面 shots 里的机位（顺序见 LIST），小数部分 ×10 是场景时间（秒）。
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

// 数三角形：整个场景、树林（含树脚）、地被
const count = root => { let n = 0; root.traverse(o => { if (o.isMesh) n += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1); }); return Math.round(n); };
const forest = wild.scene.children.find(o => o.userData.trees), ground = wild.scene.children.find(o => o.userData.ground), trees = forest.userData.trees;
const tally = Object.fromEntries(trees.map(t => [`${t.kind} ${t.tier}`, [0, 0]]));
for (const t of trees) tally[`${t.kind} ${t.tier}`][0]++;
forest.traverse(o => { if (o.isInstancedMesh && o.name in tally) tally[o.name][1] += o.geometry.attributes.position.count / 3 * o.count; });   // 每种、每档：[几棵, 几个三角形]
console.log(`外景：建好用了 ${Math.round(performance.now() - started)} 毫秒；整个场景 ${count(wild.scene)} 个三角形，其中树林 ${count(forest)}、地被 ${ground ? count(ground) : '（没找到）'}；树 ${trees.length} 棵`);
console.log(JSON.stringify(tally));

const nearestU = (x, z) => { let best = 0, bd = Infinity; for (let k = 0; k <= 2000; k++) { const p = road.at(k / 2000), d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; best = k / 2000; } } return best; };
// 找一棵近景的树当标本：周围别的树越少越好。spec 是「树种」或「树种/长相」
function specimen(spec, pick = 0) {
  const [kind, form] = spec.split('/'), mine = trees.filter(t => t.kind === kind && t.tier === 'near' && (!form || t.form === form));
  if (!mine.length) throw new Error(`近景里没有这种树：${spec}`);
  const crowd = t => trees.reduce((n, o) => n + (o !== t && Math.hypot(o.x - t.x, o.z - t.z) < 13 ? 1 : 0), 0);
  return mine.map(t => ({ t, c: crowd(t) })).sort((a, b) => a.c - b.c)[pick].t;
}
// 对着标本的机位：镜头离树 dist，看树上 aim 这么高的地方。绕着树试十六个方向，挑视线上别的树最少、又不太俯不太仰的那个
function look(spec, season, dist, aim, raise, pick = 0) {
  const t = specimen(spec, pick), target = [t.x, t.y + aim * t.scale, t.z];
  let best = null;
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2, x = t.x + Math.cos(a) * dist, z = t.z + Math.sin(a) * dist, y = Math.max(wild.heightAt(x, z) + 1.4, t.y + raise);
    const blocked = trees.reduce((n, o) => { const k = THREE.MathUtils.clamp(((o.x - x) * (t.x - x) + (o.z - z) * (t.z - z)) / (dist * dist), 0, .8); return n + (o !== t && Math.hypot(o.x - x - (t.x - x) * k, o.z - z - (t.z - z) * k) < 4.5 ? 1 : 0); }, 0);
    const score = blocked * 10 + Math.abs(y - target[1]);
    if (!best || score < best.score) best = { score, p: [x, y, z] };
  }
  return { name: `${spec} ${season}`, season, p: best.p, q: target };
}
const by = (u, ahead, side, up) => { const at = road.at(u), d = road.dir(u), len = Math.hypot(d.x, d.z); return [at.x + d.x / len * ahead - d.z / len * side, at.y + up, at.z + d.z / len * ahead + d.x / len * side]; };
const SEASONS = ['春', '夏', '秋', '冬'], KINDS = ['pine', 'broad', 'peach', 'willow', 'plum', 'bamboo'], TALL = { pine: 14, broad: 13, peach: 7, willow: 12, plum: 6.5, bamboo: 13 };
const LIST = [
  ...KINDS.flatMap(k => SEASONS.map(s => look(k, s, TALL[k] * 2.1, TALL[k] * .5, 3))),                 // 0–23：六种树 × 四季，整株
  ...KINDS.map(k => look(k, k === 'plum' ? '冬' : '春', 7.5, 1.6, 2.2)),                               // 24–29：树脚（根、树皮、脚下的草）
  ...KINDS.map(k => look(k, k === 'plum' ? '冬' : '秋', TALL[k] * .9, TALL[k] * .72, TALL[k] * .5)),   // 30–35：树冠近看
  ...['pine/lean', 'pine/crag', 'broad/maple', 'broad/smoke'].map(k => look(k, '秋', 26, 6.5, 3)),     // 36–39：别的长相
  ...[.42, .55, .7, .86].flatMap(u => SEASONS.map(s => ({ name: `贴地 ${u} ${s}`, season: s, p: by(u, 9, 4.6, .9), q: by(u, 0, -1, 1) }))),   // 40–55：贴着路边草丛的低机位
  { name: '芦苇近看', season: '秋', p: [-82, 2.2, 842], q: [-110, 3, 820] },                           // 56
  { name: '荷花近看', season: '夏', p: [30, 3.2, 868], q: [18, .5, 850] },                             // 57
  { name: '荷塘残荷', season: '秋', p: [30, 3.2, 868], q: [18, .5, 850] },                             // 58
  { name: '林冠俯瞰', season: '秋', p: [260, 260, 760], q: [60, 60, 560] },                            // 59
  { name: '林冠俯瞰', season: '冬', p: [260, 260, 760], q: [60, 60, 560] },                            // 60
  { name: '林冠平视', season: '夏', p: [-40, 60, 900], q: [100, 90, 560] },                            // 61
  { name: '亭边的松', season: '春', p: [-30, 446, 34], q: [-10.4, 446, 6.4] },                         // 62
  { name: '亭边的松', season: '冬', p: [-34, 449, -8], q: [-10.4, 446, 6.4] },                         // 63
  ...SEASONS.map(s => ({ name: `路边的灌木 ${s}`, season: s, p: by(.62, 14, 3, 2.4), q: by(.62, 0, -5, 1.4) })),   // 64–67
];

const KITS = ['pin', KIT_NAMES[2], KIT_NAMES[1]], crabs = KITS.map((kit, i) => new Crab(kit, i === 0 ? 42 : 24));
crabs.forEach(c => wild.scene.add(c.root));
const LANE = [[0, 0], [3.2, 2], [-2.8, -1.9]];
function castAt(u0, t) {
  crabs.forEach((crab, i) => {
    const poseAt = time => {
      const u = u0 + (LANE[i][0] + 1.6 * time) / road.length, at = road.at(u), d = road.dir(u), len = Math.hypot(d.x, d.z), x = at.x - d.z / len * LANE[i][1], z = at.z + d.x / len * LANE[i][1];
      return pose({ x, z, y: wild.heightAt(x, z), yaw: Math.atan2(d.x, d.z) * 180 / Math.PI, walk: time * 1.5 + i * .3, stride: .3, mood: i === 1 ? MOOD.joy : MOOD.open });
    };
    crab.update(poseAt, t);
  });
}

window.renderFrame = n => {
  const index = Math.floor(n + 1e-6), shot = LIST[index], t = ((n + 1e-6) % 1) * 10;
  camera.position.set(...shot.p); camera.lookAt(...shot.q);
  wild.setSeason(shot.season);
  wild.update(t);
  const u0 = nearestU(shot.q[0], shot.q[2]);
  castAt(u0, t);
  wild.focus(road.at(u0));
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
