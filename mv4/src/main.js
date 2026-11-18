// 《一万个我》MV 的总调度。全片分成若干段（show/program.js），每段是一个模块；这里只管：建场景和家当、按时刻找到当前那一段、
// 问它这一帧怎么演、渲染、叠上歌词。window.renderFrame(歌曲里的秒数) 画出一帧，逐帧渲染和带音频预览共用。
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { prog, ease } from './anim.js';
import { pose } from './crab.js';
import { buildWorld } from './world.js';
import { DepthOfFieldPass } from './post.js';
import { buildKit } from './show/kit.js';
import { LINES, DURATION, V } from './show/beat.js';
import { PROGRAM } from './show/program.js';
import { clashes } from './show/clash.js';

const W = 1920, H = 1080;
// 三维画面直接画在页面上那块画布里；歌词、暗角、片名画在另一块看不见的二维画布上，作为后期的最后一步叠上去。
// （不把三维画面拷到二维画布上再导出：几路渲染同时抢显卡时，那样拷出来的偶尔是上一帧）
const stage = document.getElementById('stage'), overlay = Object.assign(document.createElement('canvas'), { width: W, height: H }), g2 = overlay.getContext('2d');
const renderer = new THREE.WebGLRenderer({ canvas: stage, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
const camera = new THREE.PerspectiveCamera(36, W / H, .1, 900);

// 三个场景：书案（室内），和两处外景——画中山水（wild）、海边（shore）。window.MV_SETS 里不写 'wild' 就只装书案（开发时加载更快），外景的段落不上场
const SETS = window.MV_SETS ?? ['desk', 'wild'], OUTDOORS = SETS.includes('wild');
const desk = new THREE.Scene(), world = buildWorld(desk, renderer);
const wild = OUTDOORS ? (await import('./wild.js')).buildWild(renderer) : null, shore = OUTDOORS ? (await import('./shore.js')).buildShore(renderer) : null;
// 每个场景：scene、镜头的近远裁剪面、lens 平常的虚化有几成、每帧渲染前按这一帧的要求（out）把场景调好。
// 书案是贴着案面的微距，背景虚得厉害；外景里小蟹是行人大小，是一幅山水，远近都要看得清，远近的层次靠空气里的霭，不靠虚化
const STAGES = {
  desk: { scene: desk, clip: { near: .1, far: 900 }, lens: 1, prepare(out, t) { world.set(out); world.update(t); } },
  ...(OUTDOORS && {
    wild: { scene: wild.scene, clip: wild.clip, lens: .45, prepare(out, t) { wild.setSeason(out.season); wild.setWeather(out.weather); wild.focus(V(...out.cam.q)); wild.update(t); } },
    shore: { scene: shore.scene, clip: shore.clip, lens: .7, prepare(out, t) { shore.setSunset(out.sunset); shore.focus(V(...out.cam.q)); shore.update(t); } },
  }),
};

const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4, depthTexture: new THREE.DepthTexture(W, H) }));
const scenePass = new RenderPass(desk, camera), lens = new DepthOfFieldPass(camera, W, H);
composer.addPass(scenePass);
composer.addPass(lens);
const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), .32, .6, 1.1);
// 泛光往画面外面取样时照着画面里的样子镜像回来，不拿最边上那一列像素往外铺：亮窗、灯火贴着画面边移动时，光晕不会跟着边上那一列像素忽亮忽暗
[bloom.renderTargetBright, ...bloom.renderTargetsHorizontal, ...bloom.renderTargetsVertical].forEach(target => { target.texture.wrapS = target.texture.wrapT = THREE.MirroredRepeatWrapping; });
composer.addPass(bloom);
composer.addPass(new OutputPass());
const overlayMap = new THREE.CanvasTexture(overlay);
overlayMap.colorSpace = THREE.NoColorSpace; overlayMap.generateMipmaps = false; overlayMap.minFilter = THREE.LinearFilter;   // 这一步在调色之后，两边都已经是屏幕上的颜色，直接按透明度叠
const overlayPass = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, tOver: { value: null } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform sampler2D tDiffuse, tOver; varying vec2 vUv; void main() { vec4 over = texture2D(tOver, vUv); gl_FragColor = vec4(mix(texture2D(tDiffuse, vUv).rgb, over.rgb, over.a), 1.0); }',
});
overlayPass.uniforms.tOver.value = overlayMap;                       // 建好以后再交给它：建的时候它会把传进去的贴图另拷一份，拷出来的那份不会跟着更新
composer.addPass(overlayPass);

const kit = buildKit({ world, wild, shore, deskScene: desk });
const SECTIONS = PROGRAM.filter(mod => OUTDOORS || !mod.outdoor).map((mod, i) => ({ span: mod.span, ...mod.build({ ...kit, group: () => kit.group(i) }) }));   // 没装外景时，外景的段落不上场
// 没有哪一段管的时刻（只在开发中途出现）：主角站在纸上发呆
const IDLE = { cam: { p: [0, 4.6, 18.5], q: [0, 1.2, -1.5], f: 20 } }, idlePose = () => pose({ z: .6, s: 1.15 });

// 歌词：楷体，一个字一个字落到画面上（每个字从略高、略大的地方落定，像刚写下去），整句唱完一起淡出。
// 每个字底下先铺一层晕开的墨影，再描一道细边：亮的外景上也读得清
const LYRIC = { font: '78px "Kaiti SC", "STKaiti", "KaiTi", serif', gap: 12, space: 40, y: 996, ink: '#17123E', paper: '#FFF4E2' };
function drawLyric(t, [a, b, text]) {
  const out = 1 - prog(t, b + .1, b + .45);
  if (t < a - .15 || out <= 0) return;
  g2.save();
  g2.font = LYRIC.font; g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.lineJoin = 'round';
  const chars = [...text], widths = chars.map(c => (c === ' ' ? LYRIC.space : g2.measureText(c).width + LYRIC.gap));
  const inked = chars.filter(c => c !== ' ').length, spread = Math.min(.9, (b - a) * .45);   // 一句的字在开头这么长的时间里依次落下
  let x = W / 2 - widths.reduce((sum, w) => sum + w, 0) / 2, n = 0;
  chars.forEach((c, i) => {
    const cx = x + widths[i] / 2;
    x += widths[i];
    if (c === ' ') return;
    const start = a - .15 + spread * n++ / inked, k = ease.out(prog(t, start, start + .26));
    if (k <= 0) return;
    const scale = 1 + .16 * (1 - k);
    g2.setTransform(scale, 0, 0, scale, cx, LYRIC.y - 14 * (1 - k));
    g2.globalAlpha = k * out;
    g2.shadowColor = 'rgba(16, 12, 52, .9)'; g2.shadowBlur = 18; g2.fillStyle = 'rgba(16, 12, 52, .55)'; g2.fillText(c, 0, 0);
    g2.shadowBlur = 0; g2.strokeStyle = LYRIC.ink; g2.lineWidth = 9; g2.strokeText(c, 0, 0);
    g2.fillStyle = LYRIC.paper; g2.fillText(c, 0, 0);
  });
  g2.restore();
}

function drawOverlay(t, out) {
  g2.clearRect(0, 0, W, H);
  const vg = g2.createRadialGradient(W / 2, H / 2, H * .5, W / 2, H / 2, H * 1.05);
  vg.addColorStop(0, 'rgba(7,6,32,0)'); vg.addColorStop(1, 'rgba(7,6,32,.55)');
  g2.fillStyle = vg; g2.fillRect(0, 0, W, H);
  if (out.paint) out.paint(g2, W, H);                                 // 这一段自己要叠在画面上的东西（片名）
  LINES.forEach(line => drawLyric(t, line));
  if (out.fade > 0) { g2.fillStyle = `rgba(11,10,34,${out.fade})`; g2.fillRect(0, 0, W, H); }
  overlayMap.needsUpdate = true;
}

const up = new THREE.Vector3();
// 把 t 时刻摆好（谁在哪、镜头在哪），但还不画
function stageAt(t) {
  const i = SECTIONS.findIndex(s => t >= s.span[0] && t < s.span[1]);
  kit.begin(i);
  if (i < 0) kit.act(kit.hero, idlePose);
  // 一段每帧交回来的东西：set 在哪个场景（desk / wild / shore），season 山水的季节（只有 wild 要），cam 镜头（p 位置，q 看向的点，f 对焦距离，fov 视角，roll 侧倾的度数，blur 在这个场景平常的虚化上再乘几倍），
  // dawn 书案的天色（0 月夜、1 清晨），lamp 油灯的火势，weather 外景的天气（1 这个季节平常的样子，0 雨雪花叶都停了），sunset 海边日落的进度（0 到 1），fade 画面压黑多少，paint(g2, W, H) 自己往画面上叠的东西
  const out = { set: 'desk', dawn: 0, lamp: 1, fade: 0, weather: 1, sunset: 0, ...(i < 0 ? IDLE : SECTIONS[i].frame(t)) }, cam = { fov: 36, roll: 0, blur: 1, ...out.cam }, set = STAGES[out.set];
  if (![...cam.p, ...cam.q, cam.f, cam.fov, cam.roll, cam.blur].every(Number.isFinite)) throw new Error(`${t} 秒的镜头有无效的数：${JSON.stringify(cam)}`);
  set.scene.add(kit.root);
  set.prepare(out, t);
  Object.assign(camera, set.clip, { fov: cam.fov });
  camera.up.copy(up.set(Math.sin(cam.roll * Math.PI / 180), Math.cos(cam.roll * Math.PI / 180), 0));
  camera.position.set(...cam.p); camera.lookAt(...cam.q); camera.updateProjectionMatrix();
  lens.focus = cam.f; lens.gain = cam.blur * set.lens; lens.material.uniforms.uNear.value = camera.near; lens.material.uniforms.uFar.value = camera.far;
  kit.end(t);
  scenePass.scene = set.scene;
  return out;
}
window.renderFrame = t => {
  if (renderer.getContext().isContextLost()) throw new Error('显卡的绘图环境丢了，这一帧画不出来（重新打开页面即可）');   // 不报错的话，之后每一帧都会是全黑
  drawOverlay(t, stageAt(t));
  composer.render();
};
// 穿模检查：只摆不画，返回 t 时刻的问题清单（见 show/clash.js）
window.mvClash = t => clashes(kit, stageAt(t).set);window.renderFrame(0);
window.mvReady = true;

if (!new URLSearchParams(location.search).has('render')) {         // 带音频的实时预览：点击画面播放/暂停；网址里 ?t=秒数 从那里开始
  const audio = new Audio('/song/v4/final.mp3');
  audio.currentTime = Number(new URLSearchParams(location.search).get('t'));
  stage.onclick = () => (audio.paused ? audio.play() : audio.pause());
  const loop = () => { window.renderFrame(Math.min(audio.currentTime, DURATION)); requestAnimationFrame(loop); };
  loop();
}
