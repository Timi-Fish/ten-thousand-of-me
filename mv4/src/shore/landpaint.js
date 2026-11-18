// 岸的上色：礁石、沙滩、岸坡的枯草，和被海水打湿、冲刷的那一圈。
// 礁石按国画山石来画：
//   陡的侧面是赭石底，上面一道道顺着坡往下的皴笔（斧劈皴：短、硬、斜着落笔），凹进去的地方墨更重；
//   朝天的顶面敷一层石青石绿（青绿山水的山头），浓淡不匀；凸起的棱留白、提亮，块面才分得清。
// 水边：
//   打湿——浪够得着的高度以下颜色深、发亮，映出天色；越往上越干，边上被浪花溅湿的地方斑斑点点。
//   冲刷——浪冲上来的水膜：按刚才几秒里海面到过的最高处往回退，所以水是「冲上来、慢慢退下去」的；水膜映着天，前沿一线白沫。
import { paint } from './paint.js';
import { WAVES_GLSL } from './waves.js';

const FRAGMENT_PARS = /* glsl */`
varying vec4 vG;
${WAVES_GLSL}
// 浪冲上来的水膜的高度：前几个时刻海面的高度，越早的那一次退得越多（水在往下淌）
float swash(vec2 xz, float damp) {
  float top = -9.;
  for (int k = 0; k < 5; k++) { float back = float(k) * .42; top = max(top, seaLevel(xz, uTime - back) * damp - back * .38); }
  return top + .1 * damp + .12 * (noise1(xz * 1.3 + uTime * .3) - .5);
}`;

const FRAGMENT = /* glsl */`
  float rock = vG.x, cav = vG.y, ridge = vG.z, tone = vG.w;
  // 一个像素盖住多大的地面：细的纹理在远处淡掉，不闪
  float fp = sqrt(length(dFdx(vWp)) * length(dFdy(vWp))), near = smoothstep(.3, .04, fp), mid = smoothstep(1.5, .2, fp);
  // 石面上细的起伏：只扰动朝向
  vec2 bumpAt = vWp.xz * 2.3 + vWp.y * 1.7;
  float b0 = fbm(bumpAt), bx = fbm(bumpAt + vec2(.2, 0.)), bz = fbm(bumpAt + vec2(0., .2));
  N = normalize(N + vec3(b0 - bx, 0., b0 - bz) * 1.3 * rock * near);
  vec3 Ng = normalize(vN);
  float steep = 1. - Ng.y;
  // 皴笔：在石面上铺坐标——u 沿着石面水平走，v 是高度。笔道顺着坡往下落（沿 v 拉长），一道道并排、断断续续、略带歪斜
  vec3 T = normalize(cross(vec3(0., 1., 0.), Ng) + vec3(1e-4, 0., 0.));
  float u = dot(vWp, T), v = vWp.y;
  // 斧劈皴：斜着拖下去的楔形笔触——坐标沿坡拉长、再斜一斜，噪声取高的那一截就是一笔一笔的楔子，大小两层
  vec2 w1 = vec2(u * 1.9 + v * .55, v * .5) + tone * 13., w2 = vec2(u * 4.6 + v * 1.2, v * 1.15) + tone * 7.;
  float axe = (smoothstep(.65, .73, noise1(w1)) * .6 + smoothstep(.68, .76, noise1(w2)) * .45 * near) * smoothstep(.2, .55, steep) * mid;
  // 干笔的飞白：顺着坡的细丝，深浅只差一成多
  float dry = (noise1(vec2(u * 9., v * 1.6)) - .5) * .3 * near * smoothstep(.15, .5, steep);
  // 苔点：顶面靠边的地方点几点墨
  float dots = smoothstep(.9, .93, noise1(vWp.xz * 10.3 + vWp.y * 4.)) * smoothstep(.45, .8, Ng.y) * smoothstep(.05, .3, ridge + (1. - Ng.y) * .4) * near;
  // 勾勒：面和面凹进去相交的那条折线，一道墨线
  float outline = smoothstep(.15, .55, vCrease) * mid;
  float ink = clamp(axe + (1. - cav) * 1.2 + outline * .9, 0., 1.);
  vec3 stone = mix(uRockA, uRockB, clamp(.15 + .35 * smoothstep(.3, .95, steep) + .3 * (tone - .5) + .15 * (fbm(vec2(u, v * 2.) * .7) - .5), 0., 1.));
  // 顶面的石青石绿：浓淡不匀、边上化开
  float mineral = smoothstep(.55, .85, Ng.y) * smoothstep(.32, .6, fbm(vWp.xz * .45 + tone * 11.)) * smoothstep(.6, 1.6, vWp.y);
  stone = mix(stone, mix(uRockTop, uRockBlue, smoothstep(.35, .65, noise1(vWp.xz * .3 + 4.))), mineral * .75);
  stone *= (1. - .55 * ink) * (1. + dry);
  stone *= 1. - .75 * dots;
  stone *= mix(.68, 1., smoothstep(-.3, 2.6, vWp.y));                                    // 石脚泡在潮气里，沉一些
  stone = mix(stone, stone * 1.25 + .05, clamp(ridge * 1.6, 0., 1.) * (1. - mineral) * (1. - axe));
  stone *= mix(.82, 1.06, smoothstep(-.5, .5, cav - .75 + ridge));                      // 每个面上亮下暗：受光的上沿留白，底下积墨
  // 沙：细的沙纹和零星的碎石子；岸坡上的枯草
  float ripple = sin(dot(vWp.xz, vec2(.5, 2.4)) + 2.5 * noise1(vWp.xz * .4)) * .5 + .5;
  vec3 sand = uSand * (.95 + (.1 * ripple - .05 + .12 * (noise1(vWp.xz * 3.1) - .5)) * near) * (1. - .35 * smoothstep(.72, .9, noise1(vWp.xz * 9.)) * near);
  float grass = smoothstep(.9, 2.2, vWp.y + 1.2 * (noise1(vWp.xz * .5) - .5)) * (1. - rock);
  vec3 turf = uGrass * (1. + .4 * (fbm(vWp.xz * 1.7) - .5) * mid + .3 * (noise1(vWp.xz * .07) - .5)) * mix(vec3(1.), vec3(.86, .96, .8), smoothstep(.4, .7, noise1(vWp.xz * .13)));
  albedo = mix(mix(sand, turf, grass), stone, rock);
  ao = mix(1., cav, .7);
`;

const AFTER = /* glsl */`
  vec3 rd = normalize(vWp - cameraPosition), R = reflect(rd, N);
  R.y = abs(R.y);
  float fres = .04 + .96 * pow(1. - max(dot(-rd, N), 0.), 5.);
  // 浪够得着的地方：礁石的陡面上浪是全幅的，平缓的沙滩上浪已经散了
  float damp = mix(.32, 1., smoothstep(.15, .5, 1. - normalize(vN).y));
  float reach = 1.5 * damp + .3 + .6 * (noise1(vWp.xz * .7 + vWp.y) - .5) + .25 * (noise1(vWp.xz * 3.7 + vWp.y * 2.) - .5), y = vWp.y;
  float wet = smoothstep(reach + .08, reach - .1, y);                                     // 湿和干之间是一道毛糙的线
  wet = max(wet, smoothstep(.6, .8, noise1(vWp.xz * 4.3 + vWp.y * 3. + 2.)) * smoothstep(reach + 1.6, reach, y) * rock);   // 溅湿的斑点
  vec3 sheen = skyGradient(normalize(R)) * (RECIPROCAL_PI * 2.) ;
  c = mix(c, c * mix(.5, .42, rock) * vec3(.92, .95, 1.05) + sheen * (fres * .5 + .015), wet);
  // 冲上来的水膜：薄薄一层，底下的石头和沙更暗，只在斜着看的地方映出天
  if (y < reach + 1.) {
    float level = swash(vWp.xz, damp), film = smoothstep(.0, .05, level - y);
    vec3 water = c * .6 + sheen * (fres * .7 + .04);
    float s = max(dot(normalize(R), uSunDir), 0.);
    water += uDiscCol * pow(s, 300.) * .6 * sun;
    vec3 white = (uSkyCol * .9 + uSunCol * .55) * (RECIPROCAL_PI * GAIN) * uFoam;
    float lace = smoothstep(.18, .0, level - y) * film * smoothstep(.25, .6, texture2D(uCloud, vWp.xz * .09 + uTime * .02).a + .4 * noise1(vWp.xz * 2.));
    float trail = film * smoothstep(.55, .85, texture2D(uCloud, vWp.xz * .07 - vec2(0., uTime * .05)).a) * .5;
    c = mix(c, water, film * .85);
    c = mix(c, white, clamp(lace + trail, 0., 1.) * .9);
  }
`;

export function landMaterial() {
  return paint({
    vertexPars: 'attribute vec4 aGround; attribute float aCrease; varying vec4 vG; varying float vCrease;', vertex: 'vG = aGround; vCrease = aCrease;',
    fragmentPars: FRAGMENT_PARS + `varying float vCrease;\nuniform vec3 uRockA, uRockB, uRockTop, uRockBlue, uSand, uGrass, uFoam;`,
    fragment: FRAGMENT, after: AFTER,
  });
}
