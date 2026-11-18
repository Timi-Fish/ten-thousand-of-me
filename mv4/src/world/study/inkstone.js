// 砚台和墨。砚是一方紫石的箕形砚：后高前低，前口敞开，从贴着案面的机位也看得到里面的墨。
// 最后面是雕着云和月的砚额；砚额前沿是一道弧，弧下是月牙形的墨池；往前是缓缓升起的砚堂。磨好的墨积在墨池和砚堂的后大半。
// 砚的右前方有一张小墨床，上面横搁一锭描金的墨。
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { PAL, PROPS } from '../layout.js';
import { D, TAU } from '../../anim.js';
import { TOP, KAI, stream, smooth, field, roundRect, mesh, soft, canvasTex, merge, moved } from './kit.js';
import { buildLiquid } from './liquid.js';

const W = 3.5, DP = 2.85, RC = .42, WALL = .34, ROUND = .1;        // 砚的半宽、半深、圆角、墙厚、边棱的圆角
const INK = .72;                                                    // 墨面的高度（从砚底算）
const wallH = z => .8 + .72 * smooth(2.3, -1.5, z);                 // 砚墙的高度：后高前低
const browZ = x => 2.0 - Math.sqrt(3.9 * 3.9 - x * x);              // 砚额的前沿：一道向后弯的弧

// 砚的顶面在 (x, z) 处的高度
function topH(x, z) {
  const rim = wallH(z), inside = Math.min(W - WALL - Math.abs(x), z - browZ(x));   // 离砚墙、砚额内沿多远（负的是在墙上、额上）
  const floor = .3 + .47 * smooth(-1.9, 2.6, z) + .05 * (x / 3.2) ** 2 + .04 * smooth(2.5, DP, z);   // 砚堂：从墨池往前口缓缓升高，前口有一道矮唇
  const h = rim + (floor - rim) * smooth(0, .2, inside);
  const qx = Math.abs(x) - (W - RC), qz = Math.abs(z) - (DP - RC);
  const edge = Math.min(1, Math.max(0, RC - Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) - Math.min(Math.max(qx, qz), 0)) / ROUND);
  return h - ROUND * (1 - Math.sqrt(1 - (1 - edge) ** 2));         // 外沿的棱磨圆
}

// 砚额上的雕刻和砚边的线。同一幅画画两遍：一遍是高低（给起伏用），一遍是颜色（凹处深、凸处浅）
function carve(g, w, h, tone) {
  const X = x => (x + W) / (2 * W) * w, Z = z => (z + DP) / (2 * DP) * h, S = w / (2 * W), rand = stream(71);
  g.fillStyle = tone.flat; g.fillRect(0, 0, w, h);
  g.save();                                                          // 只在砚额的范围里雕
  g.beginPath(); g.moveTo(X(-W + WALL + .1), Z(-DP + .22));
  g.lineTo(X(W - WALL - .1), Z(-DP + .22));
  for (let i = 0; i <= 40; i++) { const x = (W - WALL - .1) * (1 - i / 20); g.lineTo(X(x), Z(browZ(x) - .16)); }
  g.closePath(); g.clip();
  g.fillStyle = tone.ground; g.fillRect(0, 0, w, h);
  g.strokeStyle = tone.hatch; g.lineWidth = 1;                       // 地子：剔低之后留下的细密刀痕
  for (let y = 0; y < h * .5; y += 4) { g.beginPath(); g.moveTo(0, y + rand() * 1.5); g.lineTo(w, y + rand() * 1.5); g.stroke(); }
  g.lineCap = 'round'; g.lineJoin = 'round'; g.shadowColor = tone.raised; g.shadowBlur = 5;
  g.fillStyle = tone.raised; g.beginPath(); g.arc(X(.55), Z(-2.02), .47 * S, 0, TAU); g.fill();      // 月
  g.strokeStyle = tone.ground; g.shadowBlur = 0; g.lineWidth = 2.2; g.beginPath(); g.arc(X(.55), Z(-2.02), .37 * S, .2, 2.5); g.stroke();
  g.shadowBlur = 5; g.strokeStyle = tone.raised;
  // 云：一朵由几个卷头和一条拖尾组成，卷头是往里收的螺线
  const curl = (cx, cz, r, dir, turn) => {
    g.beginPath();
    for (let i = 0; i <= 40; i++) { const t = i / 40, a = turn + dir * t * 3.9, rr = r * (1 - .8 * t); g.lineTo(X(cx + Math.cos(a) * rr), Z(cz + Math.sin(a) * rr * .8)); }
    g.stroke();
  };
  const cloud = (cx, cz, s, dir) => {
    g.lineWidth = .075 * S * s;
    curl(cx, cz, .3 * s, dir, 0); curl(cx - dir * .42 * s, cz + .1 * s, .22 * s, -dir, Math.PI); curl(cx + dir * .34 * s, cz + .14 * s, .18 * s, dir, 1);
    g.beginPath(); g.moveTo(X(cx - dir * .62 * s), Z(cz + .24 * s));
    g.bezierCurveTo(X(cx - dir * .1 * s), Z(cz + .42 * s), X(cx + dir * .7 * s), Z(cz + .3 * s), X(cx + dir * 1.25 * s), Z(cz + .34 * s));
    g.stroke();
  };
  [[-2.4, -2.3, 1.05, 1], [-1.2, -2.05, .9, -1], [-.25, -2.35, .7, 1], [1.5, -2.25, .95, -1], [2.5, -1.95, 1, 1], [-2.75, -1.55, .7, -1], [2.85, -1.3, .6, 1], [1.05, -1.75, .55, 1]]
    .forEach(([x, z, s, d]) => cloud(x, z, s, d));
  g.restore();
  g.shadowBlur = 0; g.strokeStyle = tone.line; g.lineWidth = 2.4;    // 砚额前沿的一道线，和两侧砚墙顶上的边线
  g.beginPath(); for (let i = 0; i <= 40; i++) { const x = (W - WALL - .1) * (1 - i / 20); g.lineTo(X(x), Z(browZ(x) - .09)); } g.stroke();
  g.beginPath(); g.moveTo(X(-W + .13), Z(2.2)); g.lineTo(X(-W + .13), Z(-DP + .5)); g.quadraticCurveTo(X(-W + .13), Z(-DP + .13), X(-W + .5), Z(-DP + .13));
  g.lineTo(X(W - .5), Z(-DP + .13)); g.quadraticCurveTo(X(W - .13), Z(-DP + .13), X(W - .13), Z(-DP + .5)); g.lineTo(X(W - .13), Z(2.2)); g.stroke();
}

// 紫石：深浅不匀的紫褐底子、几片淡晕、细长的石线、细碎的星点。靠近墨面的地方被墨润湿，颜色发黑、发亮
const STONE = /* glsl */`
  float m = fbm(p * 1.1), cloud = smoothstep(.55, .78, fbm(p * .7 + 9.));
  col *= .74 + .55 * m;
  col = mix(col, vec3(.40, .33, .46), cloud * .32);
  col = mix(col, vec3(.70, .62, .48), hair(abs(fbm(p * .5 + 3.) - .5), .0009) * .28);
  col += vec3(.06, .06, .08) * smoothstep(.72, .95, vnoise(p * 55.)) * smoothstep(.45, .6, vnoise(p * 9. + 2.));
  gBump = vnoise(p * 30.) * .4 + m;`;
const stoneMat = extra => soft({ color: '#4A3F52', roughness: .72, rim: .22, rimColor: '#B7B4F2', rimPow: 3, bump: .004, albedo: STONE, ...extra });

function buildStone() {
  const group = new THREE.Group();
  const top = field(160, 130, (u, v) => { const [x, z] = roundRect(u * W, v * DP, W, DP, RC); return [x, topH(x, z), z]; });
  const tones = { height: { flat: '#808080', ground: '#3A3A3A', hatch: '#4A4A4A', raised: '#D8D8D8', line: '#303030' }, color: { flat: '#FFFFFF', ground: '#B9AFC0', hatch: '#A79DB0', raised: '#FFFFFF', line: '#8E8496' } };
  group.add(mesh(top, stoneMat({
    map: canvasTex(1024, 832, (g, w, h) => carve(g, w, h, tones.color)), bumpMap: canvasTex(1024, 832, (g, w, h) => carve(g, w, h, tones.height), { color: false }), bumpScale: 2.2,
    uniforms: { uInk: { value: INK } }, head: 'uniform float uInk;',
    albedo: `${STONE}
      float wet = smoothstep(uInk + .09, uInk + .005, p.y) * (.75 + .5 * fbm(p * 4.));
      col = mix(col, vec3(.02, .02, .035), clamp(wet, 0., 1.) * .9); gRough = 1. - .12 * clamp(wet, 0., 1.);`,
  })));
  // 四面的砚墙：沿外轮廓一圈，上沿接着顶面，底下收一道小小的倒角
  const N = 240, pos = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const a = i / N * TAU, c = Math.cos(a), s = Math.sin(a), k = 1 / Math.max(Math.abs(c), Math.abs(s));
    const [x, z] = roundRect(c * k * W, s * k * DP, W, DP, RC), y = topH(x, z), l = Math.hypot(x, z);
    pos.push(x, y, z, x, .08, z, x - x / l * .07, 0, z - z / l * .07);
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < 2; j++) { const p = i * 3 + j, q = p + 3; idx.push(p, q, p + 1, p + 1, q, q + 1); }
  const wall = new THREE.BufferGeometry();
  wall.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  wall.setIndex(idx); wall.computeVertexNormals();
  group.add(mesh(wall, stoneMat()));
  // 墨：一整片平的液面，比砚堂高的石头自然把它挡住，露出来的就是墨池和砚堂后大半
  const ink = buildLiquid(new THREE.PlaneGeometry(2 * (W - WALL) + .2, 2 * DP - .5).rotateX(-Math.PI / 2).translate(0, INK, -.05),
    { centre: new THREE.Vector3(0, INK, -.35), reach: 1.25, base: '#04040A', sky: '#1B1F52' });
  group.add(ink.mesh);
  return { group, ink };
}

// 墨锭：长方的一锭，棱角略圆。朝上的一面描金写着墨名，朝前的侧面是描金的回纹和小字；磨过的一头是湿的
function buildStick() {
  const L = 5.2, WD = 1.45, T = .6, group = new THREE.Group();
  group.add(mesh(new RoundedBoxGeometry(L, T, WD, 4, .07), soft({
    color: '#16151B', roughness: .8, rim: .3, rimColor: '#9AA6E8', bump: .003,
    albedo: 'float wet = smoothstep(1.9, 2.4, p.x); col *= .8 + .4 * fbm(p * 5.); col = mix(col, vec3(.01, .01, .02), wet); gRough = 1. - .15 * wet; gBump = fbm(p * 14.);',
  })));
  const gilt = draw => new THREE.MeshStandardMaterial({ map: draw, transparent: true, roughness: .7, metalness: .2, emissive: PAL.gold, emissiveMap: draw, emissiveIntensity: .12, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const face = canvasTex(1024, 288, (g, w, h) => {
    g.strokeStyle = PAL.gold; g.fillStyle = PAL.gold; g.lineWidth = 5; g.strokeRect(22, 22, w - 190, h - 44); g.lineWidth = 2; g.strokeRect(34, 34, w - 214, h - 68);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    [...'問月光'].forEach((ch, i) => { g.save(); g.translate(170 + i * 215, h / 2); g.rotate(-Math.PI / 2); g.font = `bold 176px ${KAI}`; g.fillText(ch, 0, 8); g.restore(); });
    g.save(); g.translate(735, h / 2); g.rotate(-Math.PI / 2); g.fillStyle = PAL.cinnabar; g.fillRect(-46, -40, 92, 80);   // 一方小小的朱印
    g.fillStyle = PAL.gold; g.font = `bold 60px ${KAI}`; g.fillText('墨', 0, 4); g.restore();
  });
  const top = new THREE.Mesh(new THREE.PlaneGeometry(L - .16, WD - .16).rotateX(-Math.PI / 2).translate(0, T / 2 + .002, 0), gilt(face));
  const band = canvasTex(1024, 96, (g, w, h) => {
    g.strokeStyle = PAL.gold; g.fillStyle = PAL.gold; g.lineWidth = 3;
    for (let x = 30; x < w - 260; x += 44) { g.beginPath(); g.moveTo(x, 70); g.lineTo(x, 26); g.lineTo(x + 30, 26); g.lineTo(x + 30, 56); g.lineTo(x + 14, 56); g.lineTo(x + 14, 42); g.stroke(); }   // 回纹
    g.beginPath(); g.moveTo(20, 82); g.lineTo(w - 250, 82); g.stroke();
    g.font = `bold 58px ${KAI}`; g.textBaseline = 'middle'; g.fillText('松煙', w - 235, h / 2 + 2);
  });
  const side = new THREE.Mesh(new THREE.PlaneGeometry(L - .2, T - .16).translate(0, 0, WD / 2 + .002), gilt(band));
  group.add(top, side);
  group.position.y = T / 2;
  return group;
}

// 墨床：一张乌木小几，两头卷起，底下两道横档
function buildBed() {
  const wood = soft({ color: '#2A1C22', roughness: .8, rim: .25, rimColor: '#B9B0EE', albedo: 'float g = fbm(vec3(p.x * 1.5, p.y * 8., p.z * 5.)); col *= .6 + .8 * g;' });
  const parts = [moved(new RoundedBoxGeometry(3.5, .12, 1.85, 3, .05), 0, .24, 0)];
  for (const s of [-1, 1]) {
    parts.push(moved(new THREE.CylinderGeometry(.13, .13, 1.85, 16), s * 1.72, .3, 0, Math.PI / 2, 0, 0));
    parts.push(moved(new RoundedBoxGeometry(.22, .2, 1.6, 2, .04), s * 1.15, .1, 0));
  }
  return mesh(merge(parts), wood);
}

export function buildInkstone() {
  const [cx, cz] = PROPS.inkstone.c, root = new THREE.Group(), stone = buildStone();
  stone.group.position.set(cx + .3, TOP, cz - 2.5);
  stone.group.rotation.y = 4 * D;
  const rest = new THREE.Group(), stick = buildStick();
  stick.position.y += .3;
  rest.add(buildBed(), stick);
  rest.position.set(cx + 3.2, TOP, cz + 3.1);
  rest.rotation.y = 9 * D;
  root.add(stone.group, rest);
  return { group: root, update: t => stone.ink.setTime(t) };
}
