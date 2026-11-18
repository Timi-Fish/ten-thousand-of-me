// 外景「海边」：带回「见过海了」那张纸的分身看到的海。落日贴着海平线，一道矶头伸进海里，小蟹站在尖上看海。
// 和山里秋天是同一个黄昏（同一套天色、云和光），看起来是同一个世界。
// 这里是入口：按顺序装各部分，对外给出接口。各部分在 shore/ 目录下：
//   共用：noise 噪声和贴图 · palette 黄昏的颜色、落日和海风 · air 天色、落日照亮的空气和霭 · paint 上色的底子 · waves 海浪的表
//   天和海：sky 天穹、云、远岛 · sun 日面、落日跟前的横云、光柱 · sea 海面 · spray 拍岸的飞沫和风里的浮沫
//   岸：land 礁石、沙滩、岸坡的高度场 · landpaint 岸的上色 · pine 海风吹歪的松 · reeds 芦苇和芒草
//   点景：far 远帆和归鸟 · lights 光、投影和雾 · route 站的地方、路和机位
//   preview.html、preview.js 是出静帧自查用的，影片不加载它们
import * as THREE from 'three';
import { U, setDusk, shadowed } from './shore/paint.js';
import { buildSky } from './shore/sky.js';
import { buildLand } from './shore/land.js';
import { landMaterial } from './shore/landpaint.js';
import { buildSea } from './shore/sea.js';
import { buildSpray } from './shore/spray.js';
import { buildPine } from './shore/pine.js';
import { buildReeds } from './shore/reeds.js';
import { buildFar } from './shore/far.js';
import { buildLights } from './shore/lights.js';
import { buildRoute } from './shore/route.js';

// renderer 是接口约定的参数；这个模块自己不向它要任何东西（投影、色调映射由拍它的人设置）
export function buildShore(renderer) {
  const scene = new THREE.Scene(), land = buildLand(), mat = landMaterial();
  const lights = buildLights(scene), route = buildRoute(land.heightAt), far = buildFar(route.stand, route.sea);
  scene.add(
    buildSky(), buildSea(land.bedTex, land.bedRect),
    shadowed(new THREE.Mesh(land.fine, mat), false, true), new THREE.Mesh(land.coarse, mat),
    buildPine(land.heightAt), buildReeds(land.heightAt), far.group, buildSpray(land.heightAt).mesh,
  );

  const shore = {
    scene, clip: { near: .3, far: 20000 },
    update(t) { U.uTime.value = t; far.update(t); },
    // 日落的进度：0 落日的下沿略高于海平线，1 下面四分之一沉进海平线。落日的位置、日面、天色、云、海上的光路、打在礁石和小蟹身上的光一起变。每帧在 update 之前调
    setSunset(k) { setDusk(k); lights.dusk(); },
    focus(point) { lights.focus(point); },
    heightAt: land.heightAt,
    stand: route.stand, sea: route.sea, path: route.path, SHOTS: route.SHOTS,
  };
  shore.setSunset(0); shore.update(0); shore.focus(route.stand);
  return shore;
}
