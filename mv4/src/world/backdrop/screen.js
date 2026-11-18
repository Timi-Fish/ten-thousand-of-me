// 四季屏风：四扇折屏立在书案后面的地上，从左到右春、夏、秋、冬。
// 每扇自上而下：帽枨、眉板（描金花卉）、画心、腰板、裙板（浅浮雕）、牙板和两条腿；扇与扇之间是折缝和铜合页，四角包铜。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SCREEN } from '../layout.js';
import { D, toTexture, grainUV } from './util.js';
import { FRONT, BACK, stile, rail, box, cartouche, apron, hingeLeaf, hingeBarrel, cornerPlate } from './joinery.js';
import { woodCanvas, brassCanvas, browBoard, reliefBoard } from './carving.js';

const RAIL = .75, CAP = .95, SEAM = .03;                           // 横枨的高、帽枨的高、折缝留的空
const HINGES = [22.4, 5.6, -13, -31, -47];                         // 合页的高度

export function buildScreen(scene, paintings) {
  const P = SCREEN.panels, group = new THREE.Group();
  scene.add(group);
  const yaw0 = P[0].yaw * D, half = Math.hypot(P[1].c[0] - P[0].c[0], P[1].c[2] - P[0].c[2]) / 2 / Math.cos(yaw0);   // 一扇的半宽：相邻两扇的折缝正好对上
  const grain = woodCanvas(), woodMap = toTexture(grain, { repeat: [1, 1] });
  const wood = new THREE.MeshStandardMaterial({ map: woodMap, bumpMap: toTexture(grain, { color: false, repeat: [1, 1] }), bumpScale: .25, color: '#C8B4BC', roughness: .58 });
  const patina = brassCanvas(), brass = new THREE.MeshStandardMaterial({ map: toTexture(patina, { repeat: [1, 1] }), bumpMap: toTexture(patina, { color: false, repeat: [1, 1] }), bumpScale: .3, color: '#E0D0C0', roughness: .52, metalness: .3 });
  const fillet = new THREE.MeshStandardMaterial({ color: '#8E7446', roughness: .6, metalness: .15 });
  const boardMat = b => new THREE.MeshStandardMaterial({ map: toTexture(b.color), bumpMap: toTexture(b.height, { color: false }), bumpScale: 1.2, roughness: .6, color: '#D2C4C8' });
  const waist = boardMat(reliefBoard(grain, 740, 440, 1)), skirt = boardMat(reliefBoard(grain, 408, 2048, 4));

  const panels = P.map((p, i) => {
    const leaf = new THREE.Group(), yaw = p.yaw * D, [cx, cy, cz] = p.c;
    leaf.position.set(cx, 0, cz); leaf.rotation.y = yaw;
    group.add(leaf);
    const w2 = p.w / 2, out = half - SEAM, top = SCREEN.top, pTop = cy + p.h / 2, pBot = cy - p.h / 2;
    const yWaist = pBot - RAIL - 4.4, ySkirt = -44, yApron = ySkirt - RAIL - 4.6;

    // 木框：两根边梃从地面到顶，横枨把高度分成眉板、画心、腰板、裙板几段
    const timber = [stile(w2, out, SCREEN.base, top), stile(-w2, -out, SCREEN.base, top)];
    for (const [y0, y1] of [[top - CAP, top], [pTop, pTop + RAIL], [pBot - RAIL, pBot], [yWaist - RAIL, yWaist], [ySkirt - RAIL, ySkirt]]) timber.push(rail(-w2, w2, y0, y1));
    timber.push(box(-w2, w2, ySkirt, top - CAP, BACK + .06, -.03));                                      // 背板
    timber.push(cartouche(-w2 + .35, pTop + RAIL + .3, w2 - .35, top - CAP - .3, .28, .13, .05));          // 眉板的开光框
    timber.push(cartouche(-w2 + .4, yWaist + .4, w2 - .4, pBot - RAIL - .4, .32, .15, .05));               // 腰板的开光框
    for (let k = 0; k < 4; k++) { const h = (yWaist - RAIL - ySkirt) / 4, y0 = ySkirt + k * h; timber.push(cartouche(-w2 + .4, y0 + .45, w2 - .4, y0 + h - .45, .4, .16, .05)); }
    timber.push(apron(-w2, w2, ySkirt - RAIL, yApron, BACK + .12, FRONT - .1));
    const frame = new THREE.Mesh(mergeGeometries(timber), wood);
    frame.castShadow = frame.receiveShadow = true;                       // 月光从屏风背后来：屏风在案上投下影子，正面朝上的小棱也不该被月光照到
    leaf.add(frame);

    // 画心，和压住画心四边的一圈细木条
    const painting = new THREE.Mesh(new THREE.PlaneGeometry(p.w, p.h), new THREE.MeshStandardMaterial({ map: paintings[i], color: '#E2DCE0', roughness: .94, emissive: '#ffffff', emissiveMap: paintings[i], emissiveIntensity: .08 }));   // 画面自己带一点亮，夜里颜色不至于全被冷光吃掉；整体压暗一点，不抢案上的戏
    painting.position.set(0, cy, 0);
    const beads = [box(-w2, w2, pTop - .09, pTop, 0, .075, 0), box(-w2, w2, pBot, pBot + .09, 0, .075, 0), box(-w2, -w2 + .09, pBot, pTop, 0, .075), box(w2 - .09, w2, pBot, pTop, 0, .075)];
    leaf.add(painting, new THREE.Mesh(mergeGeometries(beads), fillet));

    // 板心：眉板一扇一种花，腰板和裙板四扇相同
    const plank = (mat, y0, y1) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(p.w, y1 - y0), mat); m.position.set(0, (y0 + y1) / 2, .04); leaf.add(m); };
    plank(boardMat(browBoard(p.season, grain)), pTop + RAIL, top - CAP);
    plank(waist, yWaist, pBot - RAIL);
    plank(skirt, ySkirt, yWaist - RAIL);

    // 铜活：四角的包角、合页的两片、腿脚的铜套
    const sw = out - w2, metal = [];
    for (const sx of [-1, 1]) {
      metal.push(cornerPlate([sx * out, top], -sx, -1, sw, CAP, 2.1), cornerPlate([sx * out, ySkirt - RAIL], -sx, 1, sw, RAIL, 1.9));
      const shoe = new THREE.BoxGeometry(sw + .08, 1.7, FRONT - BACK + .08).toNonIndexed(); shoe.deleteAttribute('uv');
      shoe.translate(sx * (w2 + sw / 2), SCREEN.base + .85, (FRONT + BACK) / 2); metal.push(shoe);
    }
    for (const y of HINGES) {
      if (i > 0) metal.push(hingeLeaf(-(w2 + sw * .5), y, sw * .72, 1.9));
      if (i < P.length - 1) metal.push(hingeLeaf(w2 + sw * .5, y, sw * .72, 1.9));
    }
    leaf.add(new THREE.Mesh(grainUV(mergeGeometries(metal), 1, .9), brass));

    return { season: p.season, c: new THREE.Vector3(cx, cy, cz), w: p.w, h: p.h, right: new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)), up: new THREE.Vector3(0, 1, 0) };
  });

  // 合页的轴立在折缝上。向镜头凸出的折缝，两扇的正面在这里分开一条缝，轴嵌在缝里；凹进去的折缝，轴立在两个正面相交的棱前
  const barrels = [];
  for (let i = 0; i < P.length - 1; i++) {
    const a = panels[i], hinge = a.c.clone().addScaledVector(a.right, half), ridge = P[i].yaw < 0;
    for (const y of HINGES) { const g = hingeBarrel(1.9); g.translate(hinge.x, y, hinge.z + (ridge ? FRONT * .8 : FRONT / Math.cos(yaw0) + .07)); barrels.push(g); }
  }
  group.add(new THREE.Mesh(grainUV(mergeGeometries(barrels), 1, .9), brass));
  return { panels, group };
}
