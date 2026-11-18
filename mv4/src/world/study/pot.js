// 笔筒：一截粗竹做的留青竹刻笔筒——刻去的地子颜色深，留下的竹皮颜色浅，刻的是月下的竹子和两行歌词。
// 筒里插着七支粗细、毛色各不相同的笔，笔头朝上，各自斜靠在筒口。
import * as THREE from 'three';
import { PAL, PROPS } from '../layout.js';
import { D, TAU } from '../../anim.js';
import { TOP, V3, KAI, stream, pick, turn, mesh, soft, canvasTex } from './kit.js';
import { buildBrush, TONES } from './brush.js';

const R = 2.52, R_IN = 2.26, BASE = .28, FLOOR = .6, Y0 = 1.12, Y1 = 6.36, H = 6.52;   // 筒的外半径、内半径、木座厚、筒底厚、刻花那一段的下沿和上沿、筒高

// 筒身上的刻花。同一幅画画两遍：一遍是颜色，一遍是高低（留下的竹皮高，刻去的地子低）
function carve(g, w, h, tone) {
  const rand = stream(23);
  g.fillStyle = tone.ground; g.fillRect(0, 0, w, h);
  g.strokeStyle = tone.cut; g.lineWidth = 1.5;                       // 地子上细碎的刀痕
  for (let i = 0; i < 2600; i++) { const x = rand() * w, y = rand() * h, l = pick(rand, 6, 18); g.globalAlpha = pick(rand, .2, .6); g.beginPath(); g.moveTo(x, y); g.lineTo(x + pick(rand, -2, 2), y + l); g.stroke(); }
  g.globalAlpha = 1;
  g.fillStyle = tone.dim; g.beginPath(); g.arc(w * .635, h * .3, 96, 0, TAU); g.fill();   // 月：浅浅地留一层皮
  g.fillStyle = tone.skin; g.strokeStyle = tone.skin;
  const leaf = (x, y, ang, len) => {                                 // 一片竹叶：两头尖、中间略宽
    const tx = x + Math.cos(ang) * len, ty = y + Math.sin(ang) * len, nx = -Math.sin(ang) * len * .13, ny = Math.cos(ang) * len * .13;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo((x + tx) / 2 + nx * 1.3 - Math.cos(ang) * len * .12, (y + ty) / 2 + ny * 1.3 - Math.sin(ang) * len * .12, tx, ty);
    g.quadraticCurveTo((x + tx) / 2 - nx - Math.cos(ang) * len * .12, (y + ty) / 2 - ny - Math.sin(ang) * len * .12, x, y); g.fill();
  };
  const spray = (x, y, dir) => {                                     // 一小枝：细梗带出四五片朝下披的叶
    const ex = x + dir * pick(rand, 50, 110), ey = y - pick(rand, 10, 50);
    g.lineWidth = 4; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo((x + ex) / 2, y - 30, ex, ey); g.stroke();
    const n = 3 + Math.floor(rand() * 3);
    for (let i = 0; i < n; i++) leaf(ex, ey, Math.PI / 2 + dir * (-.5 + i / (n - 1) * 1.5) + pick(rand, -.15, .15), pick(rand, 80, 140));
  };
  for (const [x0, wd, lean] of [[w * .47, 44, .05], [w * .545, 28, -.04], [w * .74, 38, .03], [w * .82, 22, -.06], [w * .08, 34, .04]]) {   // 竹竿：一节一节往上
    let x = x0 - lean * h * .5, y = h + 10;
    while (y > -30) {
      const len = pick(rand, 150, 215), nx = x + lean * len;
      g.beginPath(); g.moveTo(x - wd / 2, y); g.quadraticCurveTo((x + nx) / 2 - wd / 2 + 3, y - len / 2, nx - wd / 2, y - len);
      g.lineTo(nx + wd / 2, y - len); g.quadraticCurveTo((x + nx) / 2 + wd / 2 - 3, y - len / 2, x + wd / 2, y); g.fill();
      if (rand() < .8) spray(nx + (rand() < .5 ? -1 : 1) * wd / 2, y - len + 6, rand() < .5 ? -1 : 1);
      x = nx; y -= len + 9;
    }
  }
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `bold 62px "Xingkai SC", ${KAI}`;   // 两行歌词，竖着刻
  ['一萬個我下山去', '一萬張紙回故鄉'].forEach((line, c) => [...line].forEach((ch, i) => g.fillText(ch, w * .36 - c * 84, 96 + i * 70)));
  g.fillStyle = tone.seal; g.fillRect(w * .36 - 84 - 26, 96 + 7 * 70 - 14, 52, 52);
  g.fillStyle = tone.skin; g.fillRect(0, 12, w, 5); g.fillRect(0, 24, w, 2); g.fillRect(0, h - 17, w, 5); g.fillRect(0, h - 26, w, 2);   // 上下各两道弦纹
}

// 筒里的七支笔：粗细、长短、毛色、笔杆各不相同
const BRUSHES = [
  { shaft: 8.4, r: .4, ferrule: 1.5, hairLen: 3.5, hairR: .72, kind: 'bushy', tones: TONES.goat, count: 3200, skin: 'red', trim: 'brass' },
  { shaft: 9.6, r: .26, ferrule: 1.1, hairLen: 2.4, hairR: .33, kind: 'point', tones: TONES.wolf, count: 1800, skin: 'gold', trim: 'horn' },
  { shaft: 10.2, r: .24, ferrule: 1.0, hairLen: 2.2, hairR: .3, kind: 'point', tones: TONES.mixed, count: 1800, skin: 'spotted', trim: 'bone' },
  { shaft: 9.0, r: .17, ferrule: .8, hairLen: 1.4, hairR: .19, kind: 'point', tones: TONES.wolf, count: 1000, skin: 'purple', trim: 'bone' },
  { shaft: 10.6, r: .28, ferrule: 1.15, hairLen: 2.8, hairR: .4, kind: 'dry', tones: TONES.stained, count: 2400, skin: 'gold', trim: 'horn' },
  { shaft: 9.8, r: .3, ferrule: 1.2, hairLen: 3.0, hairR: .42, kind: 'point', tones: TONES.goat, count: 2400, skin: 'purple', trim: 'horn' },
  { shaft: 8.2, r: .2, ferrule: .9, hairLen: 1.8, hairR: .24, kind: 'dry', tones: TONES.wolf, count: 1300, skin: 'gold', trim: 'bone' },
];

export function buildBrushPot() {
  const group = new THREE.Group(), rand = stream(57);
  const tones = {
    color: { ground: '#4C2E1E', cut: '#2E1A10', dim: '#8E6C42', skin: '#CDAE76', seal: PAL.cinnabar },
    height: { ground: '#2A2A2A', cut: '#101010', dim: '#8A8A8A', skin: '#E8E8E8', seal: '#B0B0B0' },
  };
  const bamboo = extra => soft({ color: '#FFFFFF', roughness: .62, rim: .25, rimColor: '#C9C0F0', albedo: 'col *= .86 + .28 * fbm(vec3(p.x * 5., p.y * .7, p.z * 5.));', ...extra });
  const band = [];
  for (let i = 0; i <= 24; i++) { const k = i / 24; band.push([R - .02 * Math.sin(k * Math.PI), Y0 + k * (Y1 - Y0)]); }
  group.add(mesh(turn([band], 128, 1), bamboo({
    map: canvasTex(2048, 680, (g, w, h) => carve(g, w, h, tones.color)), bumpMap: canvasTex(2048, 680, (g, w, h) => carve(g, w, h, tones.height), { color: false }), bumpScale: 2.5,
  })));
  // 筒身不刻花的部分：底足、靠下的一道竹节、口沿、里壁和筒底
  const plain = bamboo({ color: '#8E6034' });
  group.add(mesh(turn([
    [[R - .04, 0], [R + .05, 0], [R + .07, .1]], [[R + .07, .1], [R + .02, .5], [R, .86]], [[R, .86], [R + .09, .98], [R, Y0]],
  ], 96), plain));
  group.add(mesh(turn([[[R, Y1], [R + .03, Y1 + .06], [R + .02, H - .04], [R - .1, H], [R_IN + .02, H - .03]], [[R_IN + .02, H - .03], [R_IN, 3.2], [R_IN, FLOOR]], [[R_IN, FLOOR], [0, FLOOR]]], 96), bamboo({ color: '#6E4A2A' })));
  group.children.forEach(m => { m.position.y = BASE; m.scale.z = .96; });   // 竹子不是正圆的
  const wood = soft({ color: '#3A1E22', roughness: .6, rim: .22, albedo: 'col *= .6 + .8 * fbm(vec3(p.x * 2., p.y * 9., p.z * 2.));' });
  group.add(mesh(turn([[[0, 0], [R + .12, 0], [R + .24, .06]], [[R + .24, .06], [R + .26, .16], [R + .14, BASE], [0, BASE]]], 96), wood));
  // 笔：笔尾落在筒底，笔杆斜靠在筒口
  BRUSHES.forEach((spec, i) => {
    const brush = buildBrush({ ...spec, seed: 60 + i * 7, fine: false }), a = (i / BRUSHES.length + pick(rand, -.04, .04)) * TAU, a0 = a + pick(rand, -.5, .5);
    const rb = pick(rand, .5, 1.5), foot = new V3(Math.sin(a0) * rb, BASE + FLOOR + .02, Math.cos(a0) * rb * .96);
    const lip = new V3(Math.sin(a) * (R_IN - spec.r - .03), BASE + H - .05, Math.cos(a) * (R_IN - spec.r - .03) * .96);
    brush.group.quaternion.setFromUnitVectors(new V3(0, 1, 0), lip.sub(foot).normalize()).multiply(new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), rand() * TAU));
    brush.group.position.copy(foot);
    group.add(brush.group);
  });
  const [cx, cz] = PROPS.brushPot.c;
  group.position.set(cx, TOP, cz);
  group.rotation.y = 208 * D;                                         // 把刻着月和竹的那一面转向镜头
  return { group, update() {} };
}
