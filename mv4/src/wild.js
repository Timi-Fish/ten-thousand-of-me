// 外景「画里的山水」：分身飞进屏风的画里之后看到的世界。一座高峰、山顶小亭、云海、一条下山的石阶路、山下的湖，可以切换春夏秋冬。
// 这里是入口：按顺序装各部分，对外给出接口。各部分在 wild/ 目录下：
//   共用：noise 噪声 · seasons 四季的表 · clearing 雨停放晴时两套光色怎么混 · paint 上色的底子和共用的量 · road 路和溪的走向 · shots 机位
//   天和大气：sky 天穹 · skyclouds 天上的体积云和卷云 · stars 星和银河 · air 天色和三层雾 · shade 山影 · cloudnoise 云的噪声贴图 · clouds 云海
//             water 湖 · stream 溪、瀑布、水雾 · weather 花瓣、雨、落叶、雪和雁
//   山体和山路：land 天然地貌 · peak 主峰的山形（花岗岩的脊、沟、崖，山怎样让着路）· climb 登山道（山顶到小屋上方）的走线 · heights 高度场
//               terrain 地形网格 · terrainpaint 地形着色 · terrainbake 山影和凹凸的烘焙
//               roadmesh 石阶和石板路面 · roadside 路两侧的剖面 · roadwalls 条石基座和护坡 · stone 石块和石材质 · props 石灯、路碑、石凳 · rails 险处的栏杆（木栏、铁链桩、矮石栏）
//               wayside 登山道沿途的山门、歇脚的平台、经幡、山石 · lights 光和投影
//   建筑：kit 拼部件的工具和质地 · roof 瓦屋面 · pavilion 亭 · hut 屋 · bridge 桥 · railing 桥栏杆的雕工和石色 · structures 定位置、摆进场景
//   草木：plant 枝干和叶团的造型工具 · leaves 叶的图谱 · foliage 树的材质 · trees 树种总表和阔叶树 · evergreens 松和竹 · blossoms 桃、梅、垂柳
//         forest 种树 · roots 根脚 · herbs 草本 · rocks 山石 · ground 铺地被 · gorge 桥边溪谷里的崖石、挂草、水里的石头、两岸的草
//         夏天的溪谷（由 gorge 装进场景）：summerair 雨雾、光束、水汽 · summerlife 桥面的水花、滴水、蜻蜓
//   大远景的山形：scenerymap 底图（湖、孤山、梯田在哪）· sceneryrelief 支脊、侧谷、冲沟、垭口、石峰、湖岸和小洲 · scenerykeep 哪里不能动 · scenerystreams 山上流下来的溪 · sceneryskin 崖壁的细网格
//   大远景的布景：scenery 入口 · scenerysites 人烟摆在哪 · sceneryhouse 房子和院墙 · scenerylandmarks 塔、寺、牌坊、石桥、码头和船 · scenerywater 溪和瀑布的水、芦苇 · scenerymist 一层层的薄雾（含雪夜主峰的云腰） · sceneryforest 林分 · scenerypeak 主峰顶上的岩角、石笋、冰凌、崖松、亭的灯笼、石灯远看的柔光
//   山脊石阶一带的布景：ridge 入口 · ridgeplace 范围和贴地 · ridgeshade 四季取色和风 · ridgeground 贴地的一层 · ridgeherbs 草本 · ridgerocks 石头
//                       ridgeflora 灌木和秋树 · ridgestair 石阶边的细部和红绸 · ridgewind 横掠的落叶、草屑和贴坡的薄云
//   preview*.html、preview*.js 是出静帧自查用的，影片不加载它们
import * as THREE from 'three';
import { CLOUD_TOP, landHeight } from './wild/land.js';
import { buildRelief } from './wild/sceneryrelief.js';
import { buildScenery } from './wild/scenery.js';
import { buildRoad, buildCreek, HALF, CURB } from './wild/road.js';
import { buildTerrain } from './wild/terrain.js';
import { buildRoadMesh } from './wild/roadmesh.js';
import { buildSky } from './wild/sky.js';
import { buildClouds } from './wild/clouds.js';
import { buildWater } from './wild/water.js';
import { buildLights } from './wild/lights.js';
import { planStructures, buildStructures } from './wild/structures.js';
import { buildProps } from './wild/props.js';
import { buildWayside } from './wild/wayside.js';
import { buildForest } from './wild/forest.js';
import { buildGround } from './wild/ground.js';
import { buildGorge } from './wild/gorge.js';
import { buildWeather } from './wild/weather.js';
import { buildRidge } from './wild/ridge.js';
import { SEASONS, SEASON_NAMES } from './wild/seasons.js';
import { U, setSeasonUniforms } from './wild/paint.js';
import { seasonNow } from './wild/clearing.js';
import { buildShots } from './wild/shots.js';

// renderer 是接口约定的参数；这个模块自己不向它要任何东西（投影、色调映射由拍它的人设置）
export function buildWild(renderer) {
  const scene = new THREE.Scene(), road = buildRoad(), creek = buildCreek(), plan = planStructures(road);
  // 大远景的山形：离路、溪、建筑和近景机位都远的地方在天然地貌上再雕一遍（近景机位的位置这时只要个大概，先按天然地貌算）
  const relief = buildRelief(road, creek, plan.pads, buildShots(road, landHeight, plan));
  const terrain = buildTerrain(road, creek, plan.pads, relief), tmp = new THREE.Vector3();
  // 地面的高度：路面（含石阶、桥面）和路缘石按路算，其余查地形
  const heightAt = (x, z) => {
    const on = road.locate(x, z);
    if (on && on.d <= HALF) return road.surface(on.s);
    if (on && on.d <= HALF + CURB) return road.at0(on.s, tmp).y + .2 + .24 * road.stepsAt(on.s) + road.humpAt(on.s);
    return terrain.groundAt(x, z);
  };
  const lights = buildLights(scene), structures = buildStructures(plan, road), SHOTS = buildShots(road, heightAt, plan);
  // 登山道沿途的山门、歇脚的平台、经幡、山石（它的大石灯也算进灯火里，要种的松交给种树的人）
  const wayside = buildWayside(road, terrain.groundAt, SHOTS), props = buildProps(road, terrain.groundAt, [...structures.spots, ...wayside.spots]);
  // 大远景的布景：谷里的人烟、山上流下来的溪、湖边的芦苇、一层层的薄雾（先定下人烟占哪儿，种树时让开）
  const scenery = buildScenery(road, terrain, relief, SHOTS, plan, props.spots);
  scenery.sites.trees.push(...wayside.trees);
  const forest = buildForest(road, terrain, plan, creek, SHOTS, relief, scenery.sites), ground = buildGround(road, terrain), gorge = buildGorge(road, terrain, creek), weather = buildWeather();
  scene.add(buildSky(U), terrain.group, buildRoadMesh(road), buildWater(creek), buildClouds(), structures.group, props.group, forest.group, ground.group, gorge.group, weather.group);
  // 山脊石阶一带的布景（坡上的草木、石头、石阶边的细部、风里的落叶和薄云）
  const ridge = buildRidge(road, terrain, SHOTS);
  scene.add(ridge.group, scenery.group, wayside.group);
  scene.userData.scenery = { relief, sites: scenery.sites, roadLamps: [...props.spots, ...scenery.roadLamps], windows: scenery.windows, peak: scenery.peak };   // 自查页和探针用（影片不读）
  // 路边、桥边溪谷、山脊坡上的草、花、落叶、石块只在镜头附近画：每次渲染前按镜头位置开关
  const culled = [...ground.culled, ...gorge.culled, ...ridge.culled];
  // 谷里的房子按镜头远近换精细度
  scene.onBeforeRender = (_renderer, _scene, camera) => { for (const c of culled) c.mesh.visible = camera.position.distanceToSquared(c.at) < c.reach * c.reach; scenery.choose(camera); };

  let season = null, weatherLeft = 1;
  // 这一季此刻的光和颜色：下雨的季节随雨停放晴，在「雨中」和「雨后」两套值之间走（clearing.js）
  const look = () => { const now = seasonNow(SEASONS[season], weatherLeft); setSeasonUniforms(now.u); lights.setSeason(now); };
  const wild = {
    scene, clip: { near: 1, far: 12000 }, heightAt, cloudTop: CLOUD_TOP,
    road: { at: road.at, dir: road.dir, length: road.length },
    // 每帧都可以调：季节没变就什么也不做
    setSeason(name) {
      if (name === season) return;
      if (!(name in SEASONS)) throw new Error(`没有这个季节：${name}`);
      season = name;
      U.uPick.value.set(0, 0, 0, 0).setComponent(SEASON_NAMES.indexOf(name), 1);
      weather.setSeason(SEASONS[name]); look();
    },
    update(t) { U.uTime.value = t; },
    // 天气：k 从 1（这一季照常）到 0（停了）。夏天是雨停、放晴、出彩虹，别的季节是花瓣、落叶、雪的多少。每帧都可以调：没变就什么也不做
    setWeather(k) {
      if (k === weatherLeft) return;
      weather.setWeather(k); weatherLeft = k; look();
    },
    focus(point) { lights.focus(point, props.spots); },
    SHOTS,
  };
  wild.setSeason('春'); wild.focus(road.at(0));
  return wild;
}
