// 天、云海、水、天气的检查机位：共用的预览页（preview.js）里没有的角度——贴着云面平视、仰看天空、湖面的光路、瀑布近看等。
// 出静帧自查用，影片不加载。后期和共用的预览页一样（泛光、ACES）。
// window.renderFrame(n)：n 的整数部分 = 机位 × 4 + 季节（0 春 1 夏 2 秋 3 冬）；小数部分 × 100 是场景时间（秒）。
// 机位里写 toSun 的，镜头朝着当季日月的方位看（不写 pitch 就对着日月的高度；写了 back 的先背着日月退开那么远）。
// weather 是交给 setWeather 的天气（不写就是 1，照常）；写了 ramp 的，天气在十秒里从 1 落到 0（看雨停的过程）。
// 例：夏天（季节 1）雨停了、背着日头看彩虹 = 机位 14 → renderFrame(14 * 4 + 1 + 0.05)
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildWild } from '../wild.js';
import { SEASONS, SEASON_NAMES } from './seasons.js';

const W = 1920, H = 1080, canvas = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;

const started = performance.now(), wild = buildWild(renderer);
const camera = new THREE.PerspectiveCamera(36, W / H, wild.clip.near, wild.clip.far);
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 }));
composer.addPass(new RenderPass(wild.scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), .32, .6, 1.1));
composer.addPass(new OutputPass());
console.log(`外景：建好用了 ${Math.round(performance.now() - started)} 毫秒`);

// p 镜头位置；q 看向的点；或者 toSun：朝日月的方位看，turn 再偏开多少度，pitch 俯仰（不写就对着日月的高度）
const VIEWS = [
  { name: '贴着云面平视（朝日月）', p: [260, 132, -330], toSun: true, pitch: -.02 },
  { name: '云海上空俯看', p: [520, 250, -420], q: [-100, 95, 60] },
  { name: '仰看天空（朝日月）', p: [0, 470, 30], toSun: true, fov: 60 },
  { name: '仰看天空（背着日月）', p: [0, 470, 30], toSun: true, turn: 180, pitch: .45, fov: 60 },
  { name: '湖面的光路', p: [0, 9, 900], back: 150, toSun: true, pitch: .02, fov: 44 },
  { name: '瀑布近看', p: [66, 196, 404], q: [86, 208, 356] },
  { name: '远山的层次（主峰顶上往外看）', p: [0, 462, 40], toSun: true, turn: 100, pitch: -.03 },
  { name: '溪', p: [78, 160, 500], q: [50, 146, 474] },
  { name: '湖岸平视看山', p: [120, 5, 940], q: [0, 120, 400] },
  { name: '山路上（半山，看天气）', p: [-70, 212, 352], q: [-100, 204, 380] },
  { name: '云海贴山（主峰西侧）', p: [-300, 150, -160], q: [-120, 110, -40] },
  { name: '天顶', p: [0, 470, 30], q: [10, 600, 60], fov: 70 },
  { name: '背着日月看天边（彩虹的方向），天气照常', p: [0, 470, 30], toSun: true, turn: 180, pitch: .16, fov: 70, weather: 1 },
  { name: '背着日月看天边，天气停了一半', p: [0, 470, 30], toSun: true, turn: 180, pitch: .16, fov: 70, weather: .5 },
  { name: '背着日月看天边，天气停了', p: [0, 470, 30], toSun: true, turn: 180, pitch: .16, fov: 70, weather: 0 },
  { name: '山路上（半山），天气停了', p: [-70, 212, 352], q: [-100, 204, 380], weather: 0 },
  { name: '湖面的光路，天气停了', p: [0, 9, 900], back: 150, toSun: true, pitch: .02, fov: 44, weather: 0 },
  { name: '天气停下来的过程（十秒里从 1 落到 0），背着日月看', p: [0, 470, 30], toSun: true, turn: 180, pitch: .16, fov: 70, ramp: true },
  { name: '朝着日月看光柱（大远景）', p: [520, 300, 300], toSun: true, pitch: .05, fov: 50 },
];
const D = Math.PI / 180;

window.renderFrame = n => {
  const index = Math.floor(n + 1e-6), view = VIEWS[Math.floor(index / 4)], name = SEASON_NAMES[index % 4], t = ((n + 1e-6) % 1) * 100;
  camera.position.set(...view.p);
  if (view.toSun) {
    const sun = new THREE.Vector3(...SEASONS[name].sunDir).normalize(), az = Math.atan2(sun.z, sun.x) + (view.turn === undefined ? 0 : view.turn * D);
    const pitch = view.pitch === undefined ? Math.asin(sun.y) : view.pitch;
    if (view.back !== undefined) { camera.position.x -= Math.cos(az) * view.back; camera.position.z -= Math.sin(az) * view.back; }   // 从 p 背着日月退开这么远
    camera.lookAt(camera.position.x + Math.cos(az) * 100, camera.position.y + Math.tan(pitch) * 100, camera.position.z + Math.sin(az) * 100);
  } else camera.lookAt(...view.q);
  camera.fov = view.fov === undefined ? 36 : view.fov; camera.updateProjectionMatrix();
  wild.setSeason(name);
  wild.setWeather(view.ramp ? Math.max(0, 1 - t / 10) : view.weather === undefined ? 1 : view.weather);
  wild.update(t);
  wild.focus(wild.road.at(.5));
  const t0 = performance.now();
  composer.render();
  const gl = renderer.getContext();
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));       // 读回一个像素，等显卡真的画完再掐表
  console.log(`机位 ${Math.floor(index / 4)}「${view.name}」${name} t=${t.toFixed(1)}：${(performance.now() - t0).toFixed(0)} 毫秒`);
};
window.renderFrame(0);
window.mvReady = true;
