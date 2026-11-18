// 一摞线装书。书脊朝着镜头：能看见订书的丝线一道道绕过书脊，两个书角包着绫子；书根（书页的下切口）朝着画面中间，上面写着书名。
// 每本书是一个长方块：上下是书衣（染色的纸），四周是书页的切口，一层层的纸边；封面左上贴着题签。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PROPS, DESK, PAL } from '../layout.js';
import { D } from '../../anim.js';
import { canvas2d, stream, tex, kaiFont, extend, shadowed } from './kit.js';
import { rod } from './geo.js';

const L = 10.4, WD = 6.8, PX = 98;                                 // 书的长（沿书脊）、宽；封面贴图每单位多少像素
const INDIGO = '#2A3A66', BRONZE = '#6B5236';
// 从下往上五本：四册《四时记》春夏秋冬，最上面一本《问月集》
const BOOKS = [
  { title: '四时记  冬', cover: INDIGO, t: .95, yaw: 2, dx: 0, dz: 0 },
  { title: '四时记  秋', cover: INDIGO, t: .8, yaw: -3, dx: .25, dz: .1 },
  { title: '四时记  夏', cover: INDIGO, t: 1.02, yaw: 3.5, dx: -.15, dz: -.12 },
  { title: '四时记  春', cover: INDIGO, t: .72, yaw: -5, dx: .3, dz: .2 },
  { title: '问月集', cover: BRONZE, t: .86, yaw: 9, dx: -.5, dz: .35 },
];
export const STACK = { x: PROPS.books.c[0] + 1.3, z: PROPS.books.c[1] - .9, top: DESK.top + BOOKS.reduce((s, b) => s + b.t, 0) };   // 书摞的中心和顶面高度

// 染色的书衣纸：底色上有深浅不匀、细小的纤维，边角磨得发白
function paperGround(g, w, h, color, rand) {
  g.fillStyle = color; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 260; i++) {
    const x = rand() * w, y = rand() * h, r = 20 + 90 * rand(), blot = g.createRadialGradient(x, y, 0, x, y, r), tone = rand() < .5 ? '255,255,255' : '0,0,0';
    blot.addColorStop(0, `rgba(${tone},${.03 + .05 * rand()})`); blot.addColorStop(1, `rgba(${tone},0)`);
    g.fillStyle = blot; g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  g.lineWidth = 1;
  for (let i = 0; i < 1800; i++) { const x = rand() * w, y = rand() * h, a = rand() * 6.28, len = 4 + 14 * rand(); g.strokeStyle = `rgba(255,255,255,${.04 + .08 * rand()})`; g.beginPath(); g.moveTo(x, y); g.lineTo(x + len * Math.cos(a), y + len * Math.sin(a)); g.stroke(); }
  for (const [x0, y0, x1, y1] of [[0, 0, 26, 0], [w, 0, w - 26, 0], [0, 0, 0, 26], [0, h, 0, h - 26]]) {   // 四边磨白
    const wear = g.createLinearGradient(x0, y0, x1, y1); wear.addColorStop(0, 'rgba(210,205,220,.38)'); wear.addColorStop(1, 'rgba(210,205,220,0)');
    g.fillStyle = wear; g.fillRect(0, 0, w, h);
  }
}
// 封面。按书立起来的样子画（书脊在右，题签在左上），再转到贴图上：贴图的右边是书首，下边是书脊
function coverCanvas(book, seed) {
  const w = Math.round(WD * PX), h = Math.round(L * PX), [up, g] = canvas2d(w, h), rand = stream(seed), name = [...book.title.replaceAll(' ', '')];
  paperGround(g, w, h, book.cover, rand);
  const lx = w * .07, ly = h * .05, lw = w * .17, lh = h * (.1 + .075 * name.length);
  g.fillStyle = '#E4D9C0'; g.fillRect(lx, ly, lw, lh);
  for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(120,95,60,${.03 + .06 * rand()})`; g.fillRect(lx + rand() * lw, ly + rand() * lh, 2 + 5 * rand(), 1 + 2 * rand()); }   // 题签的纸也旧了
  g.strokeStyle = 'rgba(40,30,30,.75)'; g.lineWidth = 2; g.strokeRect(lx + 7, ly + 7, lw - 14, lh - 14);
  g.fillStyle = PAL.ink; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `${lw * .7}px ${kaiFont()}`;
  name.forEach((ch, i) => g.fillText(ch, lx + lw / 2 + (rand() - .5) * 3, ly + lh * (i + .5) / name.length * .9 + lh * .05));
  const [c, gc] = canvas2d(h, w);
  gc.translate(h, 0); gc.rotate(Math.PI / 2); gc.drawImage(up, 0, 0);
  return c;
}
// 书页的切口：一层层的纸边，深浅略有不同；最上和最下各一线是书衣。label 给了字就横着写上去（书根字）
function edgeCanvas(book, seed, label) {
  const W = label ? 1024 : 256, H = 128, [c, g] = canvas2d(W, H), rand = stream(seed);
  for (let y = 0; y < H; y++) { const v = 206 + 34 * rand(); g.fillStyle = `rgb(${v},${v * .96},${v * .87})`; g.fillRect(0, y, W, 1); }
  for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(70,55,40,${.12 + .25 * rand()})`; g.fillRect(rand() * W, Math.floor(rand() * H), 30 + rand() * W * .6, 1); }   // 几页没压实，缝深一点
  const soil = g.createLinearGradient(0, 0, W, 0); soil.addColorStop(0, 'rgba(90,70,50,.25)'); soil.addColorStop(.2, 'rgba(90,70,50,0)'); soil.addColorStop(.8, 'rgba(90,70,50,0)'); soil.addColorStop(1, 'rgba(90,70,50,.25)');
  g.fillStyle = soil; g.fillRect(0, 0, W, H);
  g.fillStyle = book.cover; g.fillRect(0, 0, W, 7); g.fillRect(0, H - 7, W, 7);
  if (label) {
    g.fillStyle = 'rgba(27,26,34,.82)'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `${H * .5}px ${kaiFont()}`;
    g.save(); g.translate(W * .42, H / 2); g.scale(1.25, 1); g.fillText(label, 0, 0); g.restore();
  }
  return c;
}
// 订线：四个眼。封面上一道线贯通四眼，每个眼各有一道线绕过书脊，两头的眼再各有一道线绕过书首、书根。线是双股的
function stitches(t) {
  const y = t / 2 + .015, zs = WD / 2 - .55, zEdge = WD / 2 + .015, holes = [0, 1, 2, 3].map(i => -L / 2 + .85 + i * (L - 1.7) / 3), parts = [];
  for (const off of [-.026, .026]) {
    parts.push(rod([holes[0], y, zs + off], [holes[3], y, zs + off], .015));
    for (const x of holes) parts.push(rod([x + off, y, zs], [x + off, y, zEdge], .015), rod([x + off, y, zEdge], [x + off, -y, zEdge], .015));
    for (const s of [-1, 1]) { const xe = s * (L / 2 + .015); parts.push(rod([s * -holes[0], y, zs + off], [xe, y, zs + off], .015), rod([xe, y, zs + off], [xe, -y, zs + off], .015)); }
  }
  return mergeGeometries(parts);
}

function book(spec, seed) {
  const group = new THREE.Group(), soft = (canvas, o = {}) => extend(new THREE.MeshStandardMaterial({ map: tex(canvas, { srgb: true }), roughness: .9, ...o }), { gloss: '.4' });
  const pages = soft(edgeCanvas(spec, seed, null)), cover = soft(coverCanvas(spec, seed + .3)), plain = extend(new THREE.MeshStandardMaterial({ color: spec.cover, roughness: .9 }), { gloss: '.4' });
  group.add(new THREE.Mesh(new THREE.BoxGeometry(L, spec.t, WD), [pages, soft(edgeCanvas(spec, seed + .6, spec.title)), cover, plain, pages, pages]));
  group.add(new THREE.Mesh(stitches(spec.t), new THREE.MeshStandardMaterial({ color: '#D9D2C2', roughness: .8 })));
  const silk = new THREE.MeshStandardMaterial({ color: spec.cover === INDIGO ? '#8C93B4' : '#B49A6C', roughness: .7 });
  for (const s of [-1, 1]) {                                        // 包角：书脊两头各包一小块绫子，颜色比书衣浅
    const corner = new THREE.Mesh(new THREE.BoxGeometry(.34, spec.t + .008, .36), silk);
    corner.position.set(s * (L / 2 - .17 + .004), 0, WD / 2 - .18 + .004);
    group.add(corner);
  }
  return group;
}

export function buildBooks() {
  const stack = new THREE.Group();
  let y = DESK.top;
  BOOKS.forEach((spec, i) => {
    const b = book(spec, 80 + i);
    b.position.set(STACK.x + spec.dx, y + spec.t / 2, STACK.z + spec.dz); b.rotation.y = spec.yaw * D;
    y += spec.t;
    stack.add(b);
  });
  return shadowed(stack);
}
