// 远处那一只只提灯小蟹的样子：画在一张 4 × 4 的拼图上，平涂加描边，和近处的小蟹同一身打扮——
// 橙色的圆顶身子、白袍、藏青的腰带、红结。四列是朝向：正面、背面、侧面（朝右）、正面举手；四行是头上戴的：光头、藏青小帽、斗笠、荷叶。
import * as THREE from 'three';
import { TAU } from '../anim.js';

export const ATLAS = 4;                                               // 拼图每边几格
const CELL = 256, LINE = '#3A2238', SKIN = '#F39A55', SKIN_DARK = '#D9733A', SKIN_LIGHT = '#FFC48A', ROBE = '#FBF6EC', ROBE_SHADE = '#DCD3C8', BELT = '#2B2F5E', BOW = '#D2382E';

function blob(g, path, fill, width = 7) {
  g.beginPath(); path(); g.fillStyle = fill; g.fill();
  g.lineWidth = width; g.strokeStyle = LINE; g.stroke();
}
// 一只小蟹，view：0 正面、1 背面、2 侧面、3 正面举手；hat：0 到 3
function crab(g, view, hat) {
  const side = view === 2, w = side ? 82 : 96, cx = 128, foot = 246;
  g.lineJoin = g.lineCap = 'round';
  // 小脚
  for (const dx of side ? [-30, 22] : [-52, -20, 20, 52]) blob(g, () => g.ellipse(cx + dx, foot - 10, 15, 12, 0, 0, TAU), SKIN_DARK, 6);
  // 钳子：举手时举过肩
  const up = view === 3, claw = (sx) => {
    const x = cx + sx * (w + 8), y = up ? 112 : 168;
    blob(g, () => g.ellipse(x, y, 19, 23, sx * (up ? -.5 : .3), 0, TAU), SKIN, 6);
    g.strokeStyle = LINE; g.lineWidth = 5; g.beginPath(); g.moveTo(x - sx * 2, y - 20); g.lineTo(x + sx * 6, y - 4); g.stroke();
  };
  if (!side) { claw(-1); claw(1); }
  // 白袍：下摆宽一点，带一道藏青边
  blob(g, () => { g.moveTo(cx - w + 6, 136); g.lineTo(cx + w - 6, 136); g.quadraticCurveTo(cx + w + 6, 200, cx + w - 4, 232); g.quadraticCurveTo(cx, 246, cx - w + 4, 232); g.quadraticCurveTo(cx - w - 6, 200, cx - w + 6, 136); }, ROBE);
  g.fillStyle = ROBE_SHADE; g.beginPath(); g.moveTo(cx - w + 2, 200); g.quadraticCurveTo(cx, 214, cx + w - 2, 200); g.quadraticCurveTo(cx + w, 222, cx + w - 6, 230); g.quadraticCurveTo(cx, 242, cx - w + 6, 230); g.closePath(); g.fill();
  g.strokeStyle = BELT; g.lineWidth = 8; g.beginPath(); g.moveTo(cx - w + 8, 224); g.quadraticCurveTo(cx, 238, cx + w - 8, 224); g.stroke();
  // 圆顶身子：上面亮、下沿暗
  const dome = () => { g.moveTo(cx - w, 150); g.bezierCurveTo(cx - w - 4, 40, cx + w + 4, 40, cx + w, 150); g.quadraticCurveTo(cx, 166, cx - w, 150); };
  blob(g, dome, SKIN);
  g.save(); g.beginPath(); dome(); g.clip();
  g.fillStyle = SKIN_DARK; g.beginPath(); g.ellipse(cx + (side ? 20 : 0), 168, w * 1.1, 34, 0, 0, TAU); g.fill();
  g.fillStyle = SKIN_LIGHT; g.beginPath(); g.ellipse(cx - w * .38, 80, w * .36, 20, -.35, 0, TAU); g.fill();
  g.restore();
  g.lineWidth = 7; g.strokeStyle = LINE; g.beginPath(); dome(); g.stroke();
  // 腰带和结：正面结在胸前，背面是一个大红结
  g.strokeStyle = BELT; g.lineWidth = 12; g.beginPath(); g.moveTo(cx - w + 4, 154); g.quadraticCurveTo(cx, 170, cx + w - 4, 154); g.stroke();
  if (view !== 2) {
    const big = view === 1 ? 1.5 : 1, y = 164;
    blob(g, () => { g.ellipse(cx - 15 * big, y, 14 * big, 9 * big, .4, 0, TAU); }, BOW, 4);
    blob(g, () => { g.ellipse(cx + 15 * big, y, 14 * big, 9 * big, -.4, 0, TAU); }, BOW, 4);
    blob(g, () => g.arc(cx, y, 7 * big, 0, TAU), BOW, 4);
    if (view === 1) { g.strokeStyle = BOW; g.lineWidth = 7; g.beginPath(); g.moveTo(cx - 4, y + 8); g.lineTo(cx - 12, y + 42); g.moveTo(cx + 4, y + 8); g.lineTo(cx + 14, y + 40); g.stroke(); }
  } else blob(g, () => g.ellipse(cx + 54, 166, 12, 8, 0, 0, TAU), BOW, 4);
  // 脸：眯成弯月的眼睛、小嘴、腮红
  if (view !== 1) {
    const ex = side ? [cx + 44] : [cx - 34, cx + 34], ey = 108;
    g.fillStyle = 'rgba(255, 110, 120, .55)';
    for (const x of ex) { g.beginPath(); g.ellipse(x + (side ? 6 : x < cx ? -10 : 10), ey + 22, 15, 9, 0, 0, TAU); g.fill(); }
    g.strokeStyle = LINE; g.lineWidth = 7;
    for (const x of ex) { g.beginPath(); g.arc(x, ey + 6, 12, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); }
    g.beginPath(); g.arc(side ? cx + 66 : cx, ey + 22, 11, Math.PI * .15, Math.PI * .85); g.stroke();
  }
  // 头上戴的
  const top = 58;
  if (hat === 1) { blob(g, () => { g.ellipse(cx, top + 6, 46, 30, 0, Math.PI, TAU); g.lineTo(cx + 46, top + 10); g.lineTo(cx - 46, top + 10); }, '#33366A'); g.fillStyle = '#C9A24A'; g.fillRect(cx - 40, top + 2, 80, 7); }
  if (hat === 2) blob(g, () => { g.moveTo(cx - 92, top + 18); g.quadraticCurveTo(cx - 20, top - 10, cx, top - 34); g.quadraticCurveTo(cx + 20, top - 10, cx + 92, top + 18); g.quadraticCurveTo(cx, top + 6, cx - 92, top + 18); }, '#D8B46A');
  if (hat === 3) { blob(g, () => g.ellipse(cx, top - 2, 70, 22, -.08, 0, TAU), '#7DB88A'); g.strokeStyle = '#4E8A62'; g.lineWidth = 4; g.beginPath(); g.moveTo(cx - 50, top); g.lineTo(cx + 50, top - 6); g.stroke(); }
}

export function crabAtlas() {
  const canvas = document.createElement('canvas'), g = canvas.getContext('2d');
  canvas.width = canvas.height = CELL * ATLAS;
  for (let hat = 0; hat < ATLAS; hat++) for (let view = 0; view < ATLAS; view++) {
    g.save(); g.translate(view * CELL, hat * CELL); crab(g, view, hat); g.restore();
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4; map.generateMipmaps = true; map.minFilter = THREE.LinearMipmapLinearFilter;
  return map;
}
