// 外景的预览：装好整片山水，沿路摆几只真的小蟹当比例尺，按机位出图。出静帧自查用，影片不加载。
// window.renderFrame(n)：n 的整数部分选机位（先是模块导出的 SHOTS，再是下面的检查机位 CHECKS），同时切到那个机位的季节；小数部分 ×10 是场景时间（秒）。
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
console.log(`外景：建好用了 ${Math.round(performance.now() - started)} 毫秒，路长 ${road.length.toFixed(0)}，整个场景 ${Math.round(total)} 个三角形`);

// 检查机位：不属于影片，用来看布局和各处的细节。u：这个机位看的是路上哪一段（小蟹摆在那儿）
const by = (u, ahead, side, up) => { const at = road.at(u), d = road.dir(u), len = Math.hypot(d.x, d.z); return [at.x + d.x / len * ahead - d.z / len * side, at.y + up, at.z + d.z / len * ahead + d.x / len * side]; };
const CHECKS = [
  { name: '检查·俯视全图', season: '夏', p: [0, 2500, 451], q: [0, 0, 450] },
  { name: '检查·从南面平视', season: '夏', p: [0, 170, 1750], q: [0, 210, 0] },
  { name: '检查·山顶小亭', season: '春', p: [17, 451, 36], q: [0, 446, 0] },
  { name: '检查·桥和瀑布', season: '夏', p: [50, 162, 505], q: [72, 182, 400] },
  { name: '检查·山脊石阶近看', season: '春', p: by(.06, 8, 2.4, 2.4), q: by(.06, 0, 0, .9) },
  { name: '检查·小屋白天', season: '秋', p: by(.3, 0, 12, 5), q: by(.3, 0, -12, 3) },
  { name: '检查·东面看主峰', season: '秋', p: [800, 260, 150], q: [0, 250, 150] },
  { name: '检查·湖岸芦苇', season: '秋', p: [-90, 4, 835], q: [-200, 20, 700] },
  ...['春', '秋', '冬'].map(season => ({ name: `检查·桥和瀑布（${season}）`, season, p: [50, 162, 505], q: [72, 182, 400] })),
  ...ridgeChecks(wild.SHOTS),
  ...sceneryChecks(wild.SHOTS),
];
// 大远景布景的检查机位（排在最后）：「沿路往下看」四季各一个，再从谷里几处近一点看村子、田、塔、湖岸
function sceneryChecks(S) {
  const down = S.find(s => s.name.includes('沿路往下看'));
  return [
    ...['春', '夏', '秋', '冬'].map(season => ({ name: `检查·景·沿路往下看（${season}）`, season, p: down.p, q: down.q })),
    { name: '检查·景·谷里的村子和田', season: '春', p: [-60, 150, 520], q: [-230, 20, 760] },
    { name: '检查·景·湖南岸', season: '秋', p: [60, 120, 760], q: [-20, 10, 1040] },
    { name: '检查·景·雪夜村子', season: '冬', p: [-60, 150, 520], q: [-230, 20, 760] },
    { name: '检查·景·西山梁', season: '夏', p: [100, 260, 700], q: [-420, 120, 820] },
    ...peakChecks(S),
    ...basinChecks(),
  ];
}
// 盆地的来龙去脉（排在最后）：正上方看山梁、水口、出谷和云湾的平面；从主峰上空往南看、抬到看得见天边（四季）；
// 水口和古道近看；从出谷里回望；三个云瀑的垭口；从东南、正西的高空看两臂山梁怎么接到远山
function basinChecks() {
  const far = { p: [50, 640, -230], q: [-10, 190, 800] };
  return [
    { name: '检查·盆·正上方', season: '春', p: [0, 3300, 900.01], q: [0, 0, 900] },
    ...['冬', '春', '夏', '秋'].map(season => ({ name: `检查·盆·往南看到天边（${season}）`, season, ...far })),
    { name: '检查·盆·水口和古道', season: '春', p: [130, 170, 900], q: [-40, 0, 1330] },
    { name: '检查·盆·水口雪夜', season: '冬', p: [130, 170, 900], q: [-40, 0, 1330] },
    { name: '检查·盆·出谷里回望', season: '秋', p: [70, 46, 1470], q: [-20, 110, 700] },
    { name: '检查·盆·西垭口的云瀑', season: '春', p: [-120, 170, 690], q: [-430, 90, 790] },
    { name: '检查·盆·东鞍的云瀑', season: '秋', p: [130, 200, 660], q: [395, 100, 595] },
    { name: '检查·盆·东面第二个垭口的云瀑', season: '冬', p: [120, 200, 760], q: [430, 100, 865] },
    { name: '检查·盆·东南高空', season: '春', p: [1250, 760, 1900], q: [0, 40, 820] },
    { name: '检查·盆·正西高空', season: '秋', p: [-1500, 420, 950], q: [0, 100, 800] },
    { name: '检查·盆·古道近看', season: '春', p: [-10, 60, 1130], q: [0, 0, 1420] },
    { name: '检查·盆·古道雪夜', season: '冬', p: [-10, 60, 1130], q: [0, 0, 1420] },
    { name: '检查·盆·往南看到天边（高一些）', season: '冬', p: [70, 760, -330], q: [-10, 150, 900] },
  ];
}
// 主峰（月出峰后）的检查机位：影片那个机位；往峰顶挪近四成；从偏西一些、偏东一些看；仰得更高（「我」字悬在峰顶上空时镜头是仰着的）；白天看一眼
function peakChecks(S) {
  const moon = S.find(s => s.name.includes('月出峰后')), mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
  return [
    { name: '检查·峰·月出峰后', season: '冬', p: moon.p, q: moon.q },
    { name: '检查·峰·挪近', season: '冬', p: mix(moon.p, [0, 400, 0], .4), q: [0, 400, 0] },
    { name: '检查·峰·偏西', season: '冬', p: [-560, 230, -120], q: [0, 380, 0] },
    { name: '检查·峰·偏东', season: '冬', p: [-260, 250, -470], q: [0, 380, 0] },
    { name: '检查·峰·仰看', season: '冬', p: moon.p, q: [0, 700, 120] },
    { name: '检查·峰·秋天', season: '秋', p: moon.p, q: moon.q },
  ];
}
// 登山道（山顶到小屋上方）的检查机位，编号从 CLIMB_FROM 起：两个远看的（春天从西南、雪夜从峰顶背后俯瞰），再逐段近一点看
const CLIMB_CHECKS = [
  { name: '检查·登山道·春天从西南远看', season: '春', p: [-370, 253, 510], q: [0, 300, 60] },
  { name: '检查·登山道·雪夜从峰顶背后俯瞰', season: '冬', p: [55, 585, -96], q: [14, 150, 540] },
  { name: '检查·登山道·十八盘（从南面上空）', season: '春', p: [30, 500, 300], q: [16, 385, 110] },
  { name: '检查·登山道·天街和山门', season: '春', p: [24, 452, 86], q: [0, 441, 46] },
  { name: '检查·登山道·台地和歇脚的平台', season: '春', p: [-20, 352, 262], q: [-62, 308, 204] },
  { name: '检查·登山道·鲫鱼背侧看', season: '秋', p: [-190, 318, 300], q: [-79, 284, 254] },
  { name: '检查·登山道·松林里的折返', season: '夏', p: [-40, 320, 440], q: [-52, 236, 330] },
  { name: '检查·登山道·西南半空', season: '春', p: [-250, 400, 380], q: [-20, 345, 130] },
  { name: '检查·登山道·秋天从正南', season: '秋', p: [-20, 330, 560], q: [-20, 330, 100] },
  { name: '检查·登山道·东南半空', season: '春', p: [260, 420, 360], q: [0, 350, 120] },
  // 大远景里看整条登山道的几个角度（纸群绕山、雪夜灯河、顺着路往下飞这类镜头可以用的机位）
  { name: '检查·远景·春天西南（平视）', season: '春', p: [-400, 300, 520], q: [-10, 330, 110] },
  { name: '检查·远景·春天西南（略俯）', season: '春', p: [-330, 380, 450], q: [-15, 340, 125] },
  { name: '检查·远景·雪夜西南半空', season: '冬', p: [-250, 400, 380], q: [-20, 345, 130] },
  { name: '检查·远景·雪夜正南上空', season: '冬', p: [-60, 470, 430], q: [-20, 330, 150] },
  { name: '检查·远景·雪夜从峰顶上空往下', season: '冬', p: [20, 560, -40], q: [0, 300, 230] },
  { name: '检查·远景·顺着路往下飞的半途', season: '秋', p: [96, 502, 80], q: [28, 100, 645] },
  // 沿登山道走一遍（编号 CLIMB_FROM + 16 起）：每隔一段从下山方向十几步外回头看，查路面、路基、栏杆、石灯和山接得上接不上
  ...[52, 78, 112, 150, 196, 236, 290, 330, 372, 410, 428, 452, 480, 512, 548, 590, 640, 700].map((s, i) => ({ name: `检查·登山道·走到 ${s}`, season: ['春', '秋', '冬'][i % 3], p: by((s + 15) / road.length, 0, i % 2 ? 4.5 : -4.5, 5.5), q: by(s / road.length, 0, 0, 1.2) })),
];
const shots = [...wild.SHOTS, ...CHECKS];
const CLIMB_FROM = 900;                                              // 登山道的检查机位从这个编号起（前面的编号随别的检查机位增减，这一组不跟着挪）
// 山脊石阶一带的检查机位（排在上面那些之后）：两个近景机位四季各一个（山脊那个按影片里镜头朝小蟹挪近一半的位置），再从远处、贴近各看一眼
function ridgeChecks(S) {
  const ridge = S.find(s => s.name.includes('山脊')), maple = S.find(s => s.season === '秋'), half = (p, q, k) => p.map((v, i) => v + (q[i] - v) * k);
  const film = { p: half(ridge.p, [ridge.q[0], ridge.q[1] + .3, ridge.q[2]], .55), q: [ridge.q[0], ridge.q[1] - .6, ridge.q[2]] };
  let uR = 0;
  for (let k = 0, bd = Infinity; k <= 4000; k++) { const a = road.at(k / 4000), d = (a.x - ridge.q[0]) ** 2 + (a.z - ridge.q[2]) ** 2; if (d < bd) { bd = d; uR = k / 4000; } }
  return [
    ...['春', '夏', '秋', '冬'].map(season => ({ name: `检查·山脊石阶（${season}）`, season, ...film })),
    ...['春', '夏', '秋', '冬'].map(season => ({ name: `检查·红叶石阶（${season}）`, season, p: maple.p, q: maple.q })),
    { name: '检查·山脊石阶·百步外', season: '秋', p: [ridge.q[0] + 95, ridge.q[1] + 18, ridge.q[2] + 60], q: [ridge.q[0] - 10, ridge.q[1] - 12, ridge.q[2] + 5] },
    { name: '检查·山脊石阶·贴近坡', season: '秋', p: [ridge.q[0] - 7, ridge.q[1] + 1.2, ridge.q[2] + 13], q: [ridge.q[0] - 14, ridge.q[1] - 1, ridge.q[2] - 2] },
    { name: '检查·山脊石阶·对面看', season: '春', p: [ridge.q[0] - 120, ridge.q[1] + 10, ridge.q[2] + 40], q: [ridge.q[0], ridge.q[1] - 8, ridge.q[2]] },
    ...['秋', '冬'].map(season => ({ name: `检查·山脊石阶·踏面和栏杆（${season}）`, season, p: by(uR + 14 / road.length, -3.5, .6, 2.6), q: by(uR + 14 / road.length, 1.5, -2.6, .1) })),
  ];
}

// 小蟹：每个近景机位看的那段路上摆三只，朝下山方向走；大远景里它们站在山顶小亭前
const KITS = ['pin', KIT_NAMES[2], KIT_NAMES[1]], crabs = KITS.map((kit, i) => new Crab(kit, i === 0 ? 42 : 24));
crabs.forEach(c => wild.scene.add(c.root));
const nearestU = q => { let best = 0, bd = Infinity; for (let k = 0; k <= 2000; k++) { const p = road.at(k / 2000), d = (p.x - q[0]) ** 2 + (p.z - q[2]) ** 2; if (d < bd) { bd = d; best = k / 2000; } } return best; };
const LANE = [[0, 0], [3.2, 2], [-2.8, -1.9]];                      // 三只各自：沿路往前多少、往右偏多少
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
  const index = Math.floor(n + 1e-6), shot = index >= CLIMB_FROM ? CLIMB_CHECKS[index - CLIMB_FROM] : shots[index], t = ((n + 1e-6) % 1) * 10;
  camera.position.set(...shot.p); camera.lookAt(...shot.q);
  wild.setSeason(shot.season);
  wild.update(t);
  const u0 = nearestU(shot.q), focus = road.at(u0);
  castAt(u0, t);
  wild.focus(focus);
  renderer.info.reset();
  const t0 = performance.now();
  composer.render();
  const gl = renderer.getContext();
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));       // 读回一个像素，等显卡真的画完再掐表
  const info = renderer.info.render;
  console.log(`机位 ${index}「${shot.name}」${shot.season} t=${t.toFixed(1)}：${(performance.now() - t0).toFixed(0)} 毫秒，${info.triangles} 个三角形，${info.calls} 次绘制`);
};
window.renderFrame(0);
window.mvReady = true;
