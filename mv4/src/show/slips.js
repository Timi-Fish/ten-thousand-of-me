// 薄纸：分身回来时各交的那一张小纸条。全片共用一摞，每帧由表演说「这一帧有哪些纸、各在哪」。
// 一张纸 0.9 × 1.35（比一只小蟹略小），竖着拿时字朝 +z。纸面的图案有 16 种，画在一张程序生成的拼图上。
import * as THREE from 'three';
import { D, rnd, TAU } from '../anim.js';
import { sunk, wayOut } from './body.js';

export const SLIP = { w: .9, h: 1.35 };
export const PILE = [2.3, 0, 2.1];                                    // 主角身边那摞纸放在纸面上的哪里（全片固定）
// 纸的种类（put 的 kind）
export const KIND = {
  blank: 0, spring: 1, summer: 2, autumn: 3, winter: 4,                // 白纸；四季各一张小画
  lamp: 5, wind: 6, sea: 7, snow: 8, bloom: 9, rain: 10, moon: 11, fine: 12,   // 路上的见闻，各只有几个字
  note: 13, title: 14, home: 15,                                       // 昨夜的自己留的字；歌名；「我回来了」
};
const WORDS = { 5: ['山下有灯'], 6: ['路上有风'], 7: ['见过海了'], 8: ['桥上落雪'], 9: ['花开了'], 10: ['雨停了'], 11: ['月很圆'], 12: ['我很好'], 13: ['我是昨夜的你', '别怕 接着走'], 14: ['一万个我'], 15: ['我回来了'] };
const SEASON_WORD = { 1: '春', 2: '夏', 3: '秋', 4: '冬' };
const CELL = [256, 384], COLS = 4, PAPER = '#F4ECD9', INK = '#221E26', FONT = '"Kaiti SC", "STKaiti", "KaiTi", serif';
export { PAPER };
// 拼图里第 kind 格在画布上的位置和大小 [x, y, 宽, 高]（像素，从画布左上角量）。被子（quilt.js）从这里取它那一页的字和印
export const cellRect = kind => [kind % COLS * CELL[0], Math.floor(kind / COLS) * CELL[1], ...CELL];

// 四季小画：几笔写意
const PICTURES = {
  1(g) {                                                               // 春：一枝桃花
    g.strokeStyle = '#4A3A34'; g.lineWidth = 7; g.lineCap = 'round';
    g.beginPath(); g.moveTo(40, 250); g.quadraticCurveTo(110, 200, 150, 120); g.quadraticCurveTo(170, 80, 215, 60); g.stroke();
    g.lineWidth = 4; g.beginPath(); g.moveTo(118, 180); g.quadraticCurveTo(160, 190, 196, 168); g.stroke();
    for (let i = 0; i < 16; i++) {
      const k = rnd(i * 3.1), x = 50 + 165 * k + 26 * (rnd(i * 5.3) - .5), y = 245 - 190 * k + 40 * (rnd(i * 7.7) - .5), r = 9 + 7 * rnd(i * 2.2);
      g.fillStyle = `rgba(${236 - 20 * rnd(i)}, ${120 + 40 * rnd(i * 1.7)}, ${130 + 30 * rnd(i * 4.1)}, .85)`;
      for (let p = 0; p < 5; p++) { g.beginPath(); g.arc(x + r * .7 * Math.cos(p * TAU / 5), y + r * .7 * Math.sin(p * TAU / 5), r * .55, 0, TAU); g.fill(); }
    }
  },
  2(g) {                                                               // 夏：一张荷叶，一朵荷花
    g.fillStyle = 'rgba(60, 122, 96, .82)'; g.beginPath(); g.ellipse(120, 190, 86, 46, -.12, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(30, 70, 60, .6)'; g.lineWidth = 3;
    for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(120, 190); g.lineTo(120 + 84 * Math.cos(i * TAU / 9), 190 + 44 * Math.sin(i * TAU / 9)); g.stroke(); }
    g.strokeStyle = '#3C6A54'; g.lineWidth = 5; g.beginPath(); g.moveTo(176, 250); g.quadraticCurveTo(186, 170, 172, 104); g.stroke();
    g.fillStyle = 'rgba(244, 150, 160, .9)';
    for (let i = -2; i <= 2; i++) { g.beginPath(); g.ellipse(172 + i * 13, 86 - Math.abs(i) * -7, 11, 27, i * .32, 0, TAU); g.fill(); }
  },
  3(g) {                                                               // 秋：两片红叶，一行雁
    const leaf = (x, y, s, turn, color) => {
      g.save(); g.translate(x, y); g.rotate(turn); g.fillStyle = color; g.beginPath();
      for (let i = 0; i <= 10; i++) { const a = i / 10 * TAU, r = s * (i % 2 ? .46 : 1); g.lineTo(r * Math.sin(a), -r * Math.cos(a)); }
      g.fill(); g.strokeStyle = 'rgba(90, 30, 20, .7)'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, s * 1.3); g.stroke(); g.restore();
    };
    leaf(92, 176, 58, -.3, 'rgba(206, 62, 40, .88)'); leaf(170, 232, 40, .5, 'rgba(228, 128, 40, .85)');
    g.strokeStyle = 'rgba(40, 36, 44, .75)'; g.lineWidth = 3;
    for (let i = 0; i < 5; i++) { const x = 120 + i * 22, y = 84 - Math.abs(i - 2) * -12; g.beginPath(); g.moveTo(x - 9, y - 5); g.lineTo(x, y); g.lineTo(x + 9, y - 5); g.stroke(); }
  },
  4(g) {                                                               // 冬：雪山，山下一点灯
    g.fillStyle = 'rgba(120, 132, 160, .55)'; g.beginPath(); g.moveTo(14, 262); g.lineTo(96, 110); g.lineTo(136, 176); g.lineTo(178, 132); g.lineTo(244, 262); g.fill();
    g.fillStyle = '#FBFBFA'; g.beginPath(); g.moveTo(96, 110); g.lineTo(70, 160); g.lineTo(92, 150); g.lineTo(104, 168); g.lineTo(122, 152); g.fill();
    g.beginPath(); g.moveTo(178, 132); g.lineTo(160, 164); g.lineTo(176, 158); g.lineTo(192, 170); g.fill();
    g.fillStyle = 'rgba(250, 170, 70, .95)'; g.beginPath(); g.arc(128, 246, 7, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255, 255, 255, .9)';
    for (let i = 0; i < 26; i++) { g.beginPath(); g.arc(20 + 216 * rnd(i * 3.3), 60 + 210 * rnd(i * 6.1), 2 + 2 * rnd(i), 0, TAU); g.fill(); }
  },
};
function column(g, text, x, top, size) {                              // 竖着写一列字
  g.font = `${size}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = INK;
  [...text].forEach((ch, i) => { if (ch !== ' ') g.fillText(ch, x, top + (i + .5) * size * 1.08); });
}
function seal(g, x, y) {                                               // 一方小朱印
  g.fillStyle = '#C8352B'; g.fillRect(x - 13, y - 13, 26, 26);
  g.strokeStyle = PAPER; g.lineWidth = 2.5; g.strokeRect(x - 7, y - 7, 14, 14);
}
export function atlas() {
  const canvas = document.createElement('canvas'), g = canvas.getContext('2d');
  canvas.width = CELL[0] * COLS; canvas.height = CELL[1] * COLS;
  for (let kind = 0; kind < 16; kind++) {
    g.save(); g.translate(kind % COLS * CELL[0], Math.floor(kind / COLS) * CELL[1]);
    g.fillStyle = PAPER; g.fillRect(0, 0, ...CELL);
    for (let i = 0; i < 260; i++) {                                    // 纸的纤维
      const x = CELL[0] * rnd(kind * 31 + i * 1.7), y = CELL[1] * rnd(kind * 17 + i * 2.9), a = TAU * rnd(i * 5.1), len = 5 + 12 * rnd(i * 3.7);
      g.strokeStyle = `rgba(${150 + 60 * rnd(i)}, ${130 + 50 * rnd(i * 2.3)}, 96, .16)`; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + len * Math.cos(a), y + len * Math.sin(a)); g.stroke();
    }
    if (PICTURES[kind]) { PICTURES[kind](g); column(g, SEASON_WORD[kind], 206, 276, 62); seal(g, 44, 340); }
    if (WORDS[kind]) {
      const cols = WORDS[kind], longest = Math.max(...cols.map(c => c.length)), size = Math.min(76, 330 / (longest * 1.08), 190 / cols.length);
      cols.forEach((text, i) => column(g, text, CELL[0] / 2 + (cols.length / 2 - .5 - i) * size * 1.25, (CELL[1] - 30 - longest * size * 1.08) / 2, size));   // 从右往左排列
      seal(g, 40, 346);
    }
    g.restore();
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
  return map;
}

const CAP = 400, euler = new THREE.Euler(0, 0, 0, 'YXZ'), quat = new THREE.Quaternion(), at3 = new THREE.Vector3(), size3 = new THREE.Vector3(), m4 = new THREE.Matrix4();
export function buildSlips() {
  const geo = new THREE.PlaneGeometry(SLIP.w, SLIP.h, 6, 8), own = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 4), 4);
  geo.setAttribute('aSlip', own);                                      // 每张纸自己的量：[种类, 墨迹显出多少, 发光, 卷曲]
  const mat = new THREE.MeshLambertMaterial({ map: atlas(), side: THREE.DoubleSide });
  mat.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aSlip; varying vec4 vSlip; varying vec2 vLocal;')
      .replace('#include <uv_vertex>', `#include <uv_vertex>
        float kind = floor(aSlip.x + .5);
        vMapUv = (vec2(mod(kind, ${COLS}.0), ${COLS - 1}.0 - floor(kind / ${COLS}.0)) + uv) / ${COLS}.0;
        vSlip = aSlip; vLocal = uv;`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.z += aSlip.w * (transformed.x * transformed.x * 1.1 + .1 * sin(transformed.y * 2.6));');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec4 vSlip; varying vec2 vLocal;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        float shown = smoothstep(0., .12, vSlip.y * 1.12 - (1. - vLocal.y));                      // 墨迹从上往下显出来
        diffuseColor.rgb = mix(vec3(${new THREE.Color(PAPER).toArray().map(v => v.toFixed(3)).join(', ')}), diffuseColor.rgb, shown * (gl_FrontFacing ? 1. : .22));   // 背面只透出一点淡淡的字影`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(1., .78, .42) * vSlip.z + diffuseColor.rgb * (gl_FrontFacing ? .07 : .16);');   // 薄纸透一点光：背着光的那一面不至于死黑
  };
  const mesh = new THREE.InstancedMesh(geo, mat, CAP);
  mesh.castShadow = mesh.receiveShadow = true; mesh.frustumCulled = false; mesh.count = 0;
  const loose = [];                                                    // 这一帧里没有平躺着的纸（拿着的、飘着的、盖着的）：它们可能碰到小蟹的身体
  return {
    mesh,
    clear() { mesh.count = 0; loose.length = 0; },
    // at 纸中心的位置；rot [俯仰, 转向, 侧倾]（度；俯仰 -90 是平躺、字朝上）；size 大小；kind 种类；ink 墨迹显出多少（0 到 1，从上往下）；glow 发光；curl 卷曲
    put({ at, rot = [0, 0, 0], size = 1, kind = 0, ink = 1, glow = 0, curl = 0 }) {
      const i = mesh.count++;
      if (i >= CAP) throw new Error(`同屏的纸超过了 ${CAP} 张`);
      mesh.setMatrixAt(i, m4.compose(at3.fromArray(at), quat.setFromEuler(euler.set(rot[0] * D, rot[1] * D, rot[2] * D)), size3.setScalar(size)));
      own.setXYZW(i, kind, ink, glow, curl);
      mesh.instanceMatrix.needsUpdate = own.needsUpdate = true;
      if (!(rot[0] === -90 && rot[2] === 0 && curl === 0)) loose.push({ i, at: [...at], size, curl });   // 平躺在地上、摞上的纸不参加避让
    },
    // 避让：哪张纸陷进了哪只小蟹的身体，就把它沿身体往外推到刚好贴着表面。bodies 是这一帧上场的小蟹的身体（见 body.js）。
    // 要在小蟹都 update 过之后调。返回推了哪些：[{ who 小蟹的名字, push 推了多远 }]，给穿模检查用
    settle(bodies) {
      const pushed = [];
      for (const slip of loose) {
        mesh.getMatrixAt(slip.i, m4);
        const center = at3.fromArray(slip.at), reach = 1.1 * slip.size;
        for (const body of bodies) {
          if (center.distanceTo(body.at) > reach + 1.4 * body.s) continue;
          const points = SAMPLES.map(([x, y]) => new THREE.Vector3(x, y, slip.curl * (x * x * 1.1 + .1 * Math.sin(y * 2.6))).applyMatrix4(m4));   // 纸面上的一格格取样点（带着卷曲）
          const deepest = move => Math.max(...points.map(p => sunk(body, move ? p.clone().addScaledVector(dir, move) : p, PAD)));
          if (deepest(0) <= 0) continue;
          const dir = wayOut(body, center, new THREE.Vector3(0, 0, 1).transformDirection(m4));
          let far = 0;
          while (far < 3 && deepest(far) > 0) far += .08;              // 先大步找到推出去的距离，再折半收紧
          let near = Math.max(0, far - .08);
          for (let n = 0; n < 5; n++) { const mid = (near + far) / 2; if (deepest(mid) > 0) near = mid; else far = mid; }
          m4.setPosition(center.addScaledVector(dir, far));
          mesh.setMatrixAt(slip.i, m4);
          pushed.push({ who: body.name, push: far });
        }
      }
      if (pushed.length) mesh.instanceMatrix.needsUpdate = true;
      return pushed;
    },
  };
}
const PAD = .13, SAMPLES = [-.5, -.25, 0, .25, .5].flatMap(u => [-.5, -.3, -.1, .1, .3, .5].map(w => [u * SLIP.w, w * SLIP.h]));   // 纸离身体表面留多少缝；纸面上的取样格点
// 一摞纸里第 i 张（从下往上数）放哪：base 是这摞纸底下那一点 [x, y, z]。每张略微错开、转一点角度，像随手叠的
const THICK = .009;                                                   // 一张纸的厚度：140 张摞起来约 1.3 高，比主角矮一截，不挡镜头
export const stackSpot = (base, i) => ({
  at: [base[0] + .07 * (rnd(i * 3.7) - .5), base[1] + .02 + THICK * i, base[2] + .07 * (rnd(i * 5.9) - .5)],
  rot: [-90, 12 * (rnd(i * 2.3) - .5), 0],
});
// 那摞纸里第 i 张是哪一种（四季小画和路上的见闻轮着来）。「见过海了」不在里面：它只在海边那一场出现，轮到它的位置放「月很圆」
export const kindOf = i => { const kind = 1 + i % 12; return kind === KIND.sea ? KIND.moon : kind; };
// 画出主角身边那摞纸的前 n 张（已经落定的）。各段都用它，摞的样子才前后一致
export function drawPile(slips, n) {
  for (let i = 0; i < n; i++) slips.put({ ...stackSpot(PILE, i), kind: kindOf(i) });
}
