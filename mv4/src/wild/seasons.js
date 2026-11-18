// 四季：同一片山水在四个季节、四个时辰里的全部差别都写在这张表里。换季 = 把表里那一季的值写进着色器和灯。
// 和屏风上的四幅画呼应：春山如笑（清晨，薄雾、桃花、垂柳、嫩绿）、夏山如滴（山中骤雨，雨停后斜阳放晴；青绿、瀑布、荷塘）、
// 秋山如妆（黄昏，落日晚霞、红枫、芦苇、一行雁）、冬山如睡（雪夜，冷灰蓝、月亮、寒林、红梅、小屋的灯）。
// 每一季：
//   sunDir 指向日（月）的方向；sunCol、sunPower 主光（figurePower：小蟹和纸受到的日光强度，不写就和 sunPower 相同）；skyCol、gndCol、hemiPower 天光和地面反光；lampPower 石灯和窗里的灯火；weather 飘落的东西
//   u 是交给着色器的量（名字就是着色器里的名字）
//   clear（只有下雨的季节有）：天气停了以后的光和颜色，只写和平常不一样的那些
export const SEASON_NAMES = ['春', '夏', '秋', '冬'];

export const SEASONS = {
  春: {
    sunDir: [.80, .42, .42], sunCol: '#FFE0B4', sunPower: 3.5, skyCol: '#CFE3F2', gndCol: '#A9B58E', hemiPower: 1.9, lampPower: 0, weather: 'petal', geese: false,
    u: {
      uZenith: '#5A98D6', uSkyMid: '#A6CEE6', uHorizon: '#DCE6E4', uHorizonSun: '#FFE9CC',
      uDiscCol: ['#FFF2D0', 5], uDiscP: [.024, .5, .55, 0], uHiLit: ['#FFF4E6', 1.05], uHiShade: '#B9C6DA', uHiP: [.27, .8, .6, 1], uStars: 0,
      uSkyGlow: ['#FFE6BE', .5], uAntiSun: ['#D6DDEA', .1], uHiRim: ['#FFF0D2', 1.5], uHiQ: [1, .5, 1.6, .3],
      uAirP: [.4, .4, .7, .2], uVale: [.0008, 60, 108, .1], uCloudRim: ['#FFE8C8', 1], uWaterP: [.8, 1, 0],
      uRayCol: ['#FFEFD6', .55], uLightFx: [.5, .45, .55, .5],
      uFogP: [.00021, .0012, 12, .045], uMistCol: ['#EFF1EA', .95], uWind: [.8, .6, .55, .05], uSnow: 0, uWet: 0, uLamp: 0,
      uRockA: '#C4BEAC', uRockB: '#4A5856', uGrassA: '#9CC866', uGrassB: '#62A050', uSoil: '#A8906C', uTint: '#56A498',
      uCloudLit: ['#FFF4E6', 1.05], uCloudShade: '#8496BA', uCloudDeep: '#5E749E',
      uWaterDeep: '#3D7C80', uWaterShallow: '#9ACDBC', uReflLand: '#5F8C6E', uFlow: [.7, 0],
      uPave: '#B9B1A2', uPaveDark: '#6E6A66', uMoss: '#86AA5A',
      uPineA: '#2F6650', uPineB: '#7DB06A', uPineOn: 1, uBroadA: '#5A9E4A', uBroadB: '#C6E47C', uBroadOn: 1, uPeachA: '#6FAE52', uPeachB: '#BFE082', uPeachOn: .3,
      uWillowA: '#8CC054', uWillowB: '#D8EE90', uWillowOn: 1, uPlumA: '#5E9E52', uPlumB: '#A9CF74', uPlumOn: 1, uBambooA: '#3E8850', uBambooB: '#A6D070', uBambooOn: 1,
      uPeachBloomA: '#EE7FA0', uPeachBloomB: '#FDDDE4', uPeachBloom: 1, uPlumBloomA: '#D83A2C', uPlumBloomB: '#F4705A', uPlumBloom: 0,
      uBladeA: '#5E9A48', uBladeB: '#C2E07E', uBladeScale: .9, uFlowerA: '#F7BDD0', uFlowerB: '#FFFFFF', uFlowerC: '#FFE074', uFlowerScale: 1,
      uReedA: '#8DB45E', uReedB: '#C9D89A', uLotusLeaf: '#8CC27A', uLotusFlower: '#F6B6C8', uLotusP: [.45, 0, 0], uLitterA: '#F6B4C6', uLitterB: '#FBDDE2', uLitterOn: 1,
    },
  },
  夏: {
    // 山中骤雨：日头在东南偏低的地方，被雨云滤成一片柔光；空气里是雨雾，山一层层淡出去。颜色是青绿山水的石青、石绿，土和石脚带赭。
    // 日头的方位是按桥上那个机位定的：光从镜头的右后方斜着来，光束是侧着看的（看得出一束一束），虹正好落在画面左边的溪谷里
    sunDir: [.324, .5, .803], sunCol: '#EEF3EE', sunPower: 1.5, figurePower: 1.5, skyCol: '#C6D8DC', gndCol: '#8E9E8E', hemiPower: 3.3, lampPower: 0, weather: 'rain', geese: false,
    u: {
      uZenith: '#6E8996', uSkyMid: '#A6BCC2', uHorizon: '#D4DEDA', uHorizonSun: '#E6ECE2',
      uDiscCol: ['#F2F4EC', 1.2], uDiscP: [.02, .4, .35, 0], uHiLit: ['#EAF0EE', .95], uHiShade: '#7E8E9C', uHiP: [.62, 1, .1, 1.4], uStars: 0,
      uSkyGlow: ['#EEF2EC', .25], uAntiSun: ['#FFFFFF', 0], uHiRim: ['#FFFFFF', .6], uHiQ: [1.5, 1.2, 1.3, .7],
      uAirP: [.35, .45, .25, .15], uVale: [.0009, 60, 108, .2], uCloudRim: ['#FFFFFF', .5], uWaterP: [1, .5, 1],
      uRayCol: ['#F4F2E4', .3], uLightFx: [.2, .3, .4, .3],
      uFogP: [.00044, .001, 30, .022], uMistCol: ['#DCE8E4', .95], uWind: [.8, .6, .8, .07], uSnow: 0, uWet: 1, uLamp: 0,
      uRockA: '#B6AE9C', uRockB: '#3C5058', uGrassA: '#78B070', uGrassB: '#2C7C68', uSoil: '#98785A', uTint: '#2E8C92',
      uCloudLit: ['#EEF2F0', .95], uCloudShade: '#8898A8', uCloudDeep: '#5E7288',
      uWaterDeep: '#1D5860', uWaterShallow: '#5CA8A2', uReflLand: '#2C6456', uFlow: [1, 0],
      uPave: '#B6B2A4', uPaveDark: '#5C625E', uMoss: '#5C984E',
      uPineA: '#1C5048', uPineB: '#5A9A6C', uPineOn: 1, uBroadA: '#1E6252', uBroadB: '#82BC62', uBroadOn: 1, uPeachA: '#3A8A56', uPeachB: '#9CCA68', uPeachOn: 1,
      uWillowA: '#5C9E52', uWillowB: '#B2D46C', uWillowOn: 1, uPlumA: '#32785A', uPlumB: '#7CB060', uPlumOn: 1, uBambooA: '#2A7656', uBambooB: '#9CC866', uBambooOn: 1,
      uPeachBloomA: '#EE7FA0', uPeachBloomB: '#FDDDE4', uPeachBloom: 0, uPlumBloomA: '#D83A2C', uPlumBloomB: '#F4705A', uPlumBloom: 0,
      uBladeA: '#2A7A56', uBladeB: '#9CCC66', uBladeScale: 1.1, uFlowerA: '#FFFFFF', uFlowerB: '#C8A8F0', uFlowerC: '#FFD86A', uFlowerScale: .8,
      uReedA: '#56965A', uReedB: '#A8C880', uLotusLeaf: '#3C9668', uLotusFlower: '#F890B4', uLotusP: [1, 1, 0], uLitterA: '#000000', uLitterB: '#000000', uLitterOn: 0,
    },
    // 雨停放晴之后的样子（setWeather 降到 0）：云开了，斜照的日头是暖的，天露出蓝，空气清了一半，剩下的水汽被照成暖色。
    // 这里只写和上面不一样的量；天气在 0 和 1 之间时两套值按比例混（clearing.js）。和时间相乘的量（风、云的大小和流速）两套必须相同，否则过渡时云和雨会横着窜
    clear: {
      sunCol: '#FFD6A0', sunPower: 4.7, figurePower: 3.2, skyCol: '#BAD2EC', gndCol: '#8AA272', hemiPower: 2,
      u: {
        uZenith: '#3C7CC0', uSkyMid: '#8ABADE', uHorizon: '#E4E2D0', uHorizonSun: '#FFE8C0',
        uDiscCol: ['#FFEAB8', 7], uHiLit: ['#FFF4E0', 1.1], uHiShade: '#909EBA', uHiP: [.42, 1, .35, 1.4],
        uSkyGlow: ['#FFE2B0', .8], uHiRim: ['#FFE4B0', 1.8], uHiQ: [1.5, 1, 1.3, .5],
        uAirP: [.6, .45, .4, .15], uVale: [.0008, 55, 108, .12], uCloudRim: ['#FFE8C0', 1.2], uWaterP: [1, 1.3, 1],
        uRayCol: ['#FFE0AC', 1.2], uLightFx: [1.1, .7, .9, .6],
        uFogP: [.0003, .0008, 30, .022], uMistCol: ['#F4ECD8', .95], uWet: .85,
        uCloudLit: ['#FFF2DC', 1.05], uCloudShade: '#8A98B8', uCloudDeep: '#5A6E98',
      },
    },
  },
  秋: {
    sunDir: [-.88, .16, .44], sunCol: '#FFB272', sunPower: 3.3, skyCol: '#A2AAEC', gndCol: '#8A7A84', hemiPower: 2.3, lampPower: .5, weather: 'leaf', geese: true,
    u: {
      uZenith: '#384486', uSkyMid: '#A8749A', uHorizon: '#EC965A', uHorizonSun: '#FFB24A',
      uDiscCol: ['#FF6A24', 4.2], uDiscP: [.036, .55, .5, 0], uHiLit: ['#FF9C5E', 1.1], uHiShade: '#765A88', uHiP: [.3, .8, .8, .8], uStars: 0,
      uSkyGlow: ['#FF9A3C', .9], uAntiSun: ['#D88AA0', .45], uHiRim: ['#FFD070', 2.2], uHiQ: [1.1, .5, 3.2, .4],
      uAirP: [.3, .4, 1, .15], uVale: [.0012, 60, 108, .12], uCloudRim: ['#FFC060', 1.4], uWaterP: [.6, 1.3, 0],
      uRayCol: ['#FFB65C', 1.15], uLightFx: [1, 1, 1, 1],
      uFogP: [.00038, .0009, 25, .025], uMistCol: ['#D8A6A6', .8], uWind: [.8, .6, .8, .07], uSnow: 0, uWet: 0, uLamp: .45,
      uRockA: '#BCAE9A', uRockB: '#4E4856', uGrassA: '#B8A85E', uGrassB: '#84844E', uSoil: '#94765A', uTint: '#6E8A7C',
      uCloudLit: ['#FFBE8A', 1.08], uCloudShade: '#A6788E', uCloudDeep: '#5C4E80',
      uWaterDeep: '#3A4868', uWaterShallow: '#C8885A', uReflLand: '#7A4A3A', uFlow: [.4, 0],
      uPave: '#B4A692', uPaveDark: '#665C58', uMoss: '#A08A4A',
      uPineA: '#34604A', uPineB: '#728E54', uPineOn: 1, uBroadA: '#C8361E', uBroadB: '#F8B030', uBroadOn: 1, uPeachA: '#C88A32', uPeachB: '#EED070', uPeachOn: .8,
      uWillowA: '#C8AE46', uWillowB: '#EEDC7E', uWillowOn: .85, uPlumA: '#B88A40', uPlumB: '#D8B860', uPlumOn: .7, uBambooA: '#4A8048', uBambooB: '#A8BC60', uBambooOn: 1,
      uPeachBloomA: '#EE7FA0', uPeachBloomB: '#FDDDE4', uPeachBloom: 0, uPlumBloomA: '#D83A2C', uPlumBloomB: '#F4705A', uPlumBloom: 0,
      uBladeA: '#A8863E', uBladeB: '#EACC72', uBladeScale: 1, uFlowerA: '#FFD24A', uFlowerB: '#FFF0C0', uFlowerC: '#F0A040', uFlowerScale: .5,
      uReedA: '#C2A45A', uReedB: '#FBF0D4', uLotusLeaf: '#A88A4E', uLotusFlower: '#8A6A40', uLotusP: [.8, 0, 1], uLitterA: '#D8482A', uLitterB: '#F2A634', uLitterOn: 1,
    },
  },
  冬: {
    sunDir: [.62, .42, .66], sunCol: '#BCCFFF', sunPower: 2.5, skyCol: '#7284C0', gndCol: '#5E6A90', hemiPower: 1.3, lampPower: 1, weather: 'snow', geese: false,
    u: {
      uZenith: '#0D1736', uSkyMid: '#1D2B56', uHorizon: '#485884', uHorizonSun: '#7080AA',
      uDiscCol: ['#F6F3E2', 3], uDiscP: [.036, .5, .55, 1], uHiLit: ['#5A6A9C', .8], uHiShade: '#1C2646', uHiP: [.28, .75, .5, .6], uStars: 1,
      uSkyGlow: ['#8AA0D8', .35], uAntiSun: ['#FFFFFF', 0], uHiRim: ['#DCE6FF', 1.3], uHiQ: [.9, .4, 1.8, .3],
      uAirP: [1, .4, .5, .2], uVale: [.0014, 60, 108, .12], uCloudRim: ['#DCE6FF', .9], uWaterP: [.5, 1, 0],
      uRayCol: ['#C4D6FF', .6], uLightFx: [.65, .6, .85, .7],
      uFogP: [.00046, .002, 25, .022], uMistCol: ['#8492BA', .8], uWind: [.8, .6, .45, .04], uSnow: 1, uWet: 0, uLamp: 1.3,
      uRockA: '#8E98AC', uRockB: '#2C3246', uGrassA: '#9A9C92', uGrassB: '#7E8078', uSoil: '#6E6A68', uTint: '#5A7088',
      uCloudLit: ['#C6D4F2', .8], uCloudShade: '#5C6C98', uCloudDeep: '#38446E',
      uWaterDeep: '#15213C', uWaterShallow: '#3A4E72', uReflLand: '#2A3654', uFlow: [.15, 1],
      uPave: '#9098A8', uPaveDark: '#4A5062', uMoss: '#7A8088',
      uPineA: '#26463E', uPineB: '#4A7060', uPineOn: 1, uBroadA: '#7A583A', uBroadB: '#A88A58', uBroadOn: .03, uPeachA: '#000000', uPeachB: '#000000', uPeachOn: 0,
      uWillowA: '#8A8A70', uWillowB: '#B0AE90', uWillowOn: .12, uPlumA: '#000000', uPlumB: '#000000', uPlumOn: 0, uBambooA: '#3A6A50', uBambooB: '#7EA070', uBambooOn: 1,
      uPeachBloomA: '#000000', uPeachBloomB: '#000000', uPeachBloom: 0, uPlumBloomA: '#C8281E', uPlumBloomB: '#F2604A', uPlumBloom: .9,
      uBladeA: '#8E8A70', uBladeB: '#C8C2A4', uBladeScale: .45, uFlowerA: '#000000', uFlowerB: '#000000', uFlowerC: '#000000', uFlowerScale: 0,
      uReedA: '#9A927A', uReedB: '#E6E2D4', uLotusLeaf: '#000000', uLotusFlower: '#000000', uLotusP: [0, 0, 1], uLitterA: '#000000', uLitterB: '#000000', uLitterOn: 0,
    },
  },
};
