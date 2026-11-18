// 书案的木头：一张可平铺的木纹贴图（深色硬木，纹理顺着 u 方向走），加一张盖住整个台面的「使用痕迹」贴图。
// 使用痕迹不是颜色而是三样数据：R 磨亮的地方（包浆、划痕），G 光泽（比 0.5 大更亮滑，小更涩），B 污渍和拼缝（墨点、杯底的水圈、板与板之间的缝）。
import * as THREE from 'three';
import { DESK } from '../layout.js';
import { clamp, TAU } from '../../anim.js';
import { canvas2d, stream, smooth, noiseField, fbmField, channel, normalCanvas, tex, extend } from './kit.js';

export const GRAIN = 16;                                           // 木纹贴图一块盖 16 个单位见方
export const RAIL = 5.2, EDGE = .45;                               // 台面四周边框的宽度；台面边缘倒圆的半径
const DW = DESK.x1 - DESK.x0, DD = DESK.z1 - DESK.z0;

// 木纹：年轮线顺着 u 走、缓缓摆动；深色的心材条带；顺纹的细丝；一道道短的棕眼（导管孔）
function grainCanvases() {
  const W = 1024, H = 2048, [, gp] = canvas2d(W, H), rand = stream(61);
  gp.fillStyle = '#000'; gp.fillRect(0, 0, W, H); gp.strokeStyle = '#fff'; gp.lineCap = 'round';
  for (let i = 0; i < 15000; i++) {                                // 棕眼：短的细线，顺纹
    const x = rand() * W, y = rand() * H, len = 5 + 34 * rand() ** 2, dy = (rand() - .5) * 3;
    gp.globalAlpha = .25 + .6 * rand(); gp.lineWidth = .8 + 1.3 * rand();
    for (const ox of [0, -W, W]) { gp.beginPath(); gp.moveTo(x + ox, y); gp.lineTo(x + ox + len, y + dy); gp.stroke(); }
  }
  const pore = channel(gp, W, H), warp = fbmField(W, H, 2, 5, 3, 6.1), band = fbmField(W, H, 2, 7, 3, 6.4), silk = noiseField(W, H, 5, 600, 6.2), silk2 = noiseField(W, H, 14, 1024, 6.3), mott = fbmField(W, H, 6, 12, 3, 6.5);
  const height = new Float32Array(W * H), [color, gc] = canvas2d(W, H), img = gc.createImageData(W, H), d = img.data;
  const ramp = [[0, 18, 11, 15], [.3, 40, 22, 25], [.55, 66, 36, 34], [.8, 94, 56, 44], [1, 124, 80, 58]];   // 从近黑的紫到红褐
  for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i++) {
    const ring = y / H * 26 + warp[i] * 7, g = ring - Math.floor(ring), late = smooth(.45, .93, g) * (1 - smooth(.93, 1, g));   // 一圈年轮里晚材最深，然后突然回到浅色
    const heart = smooth(.52, .68, band[i]);
    const t = clamp(.6 + (silk[i] - .5) * .5 + (silk2[i] - .5) * .32 + (mott[i] - .5) * .3 - late * .3 - heart * .3 - pore[i] * .4);
    let k = 1; while (ramp[k][0] < t) k++;
    const a = ramp[k - 1], b = ramp[k], f = (t - a[0]) / (b[0] - a[0]);
    d[i * 4] = a[1] + (b[1] - a[1]) * f; d[i * 4 + 1] = a[2] + (b[2] - a[2]) * f; d[i * 4 + 2] = a[3] + (b[3] - a[3]) * f; d[i * 4 + 3] = 255;
    height[i] = (silk2[i] - .5) * .25 - late * .2 - pore[i] * .9;
  }
  gc.putImageData(img, 0, 0);
  return { color, normal: normalCanvas(height, W, H, 1.6) };
}

// 使用痕迹。画布盖住整个台面：左右是 x，上沿是台面的远端
function wearCanvas() {
  const W = 2048, H = 1024, [c, g] = canvas2d(W, H), rand = stream(67), ux = W / DW, uz = H / DD;
  const X = x => (x - DESK.x0) * ux, Z = z => (z - DESK.z0) * uz;
  g.fillStyle = 'rgb(0,128,0)'; g.fillRect(0, 0, W, H);
  const cloud = fbmField(W, H, 9, 5, 4, 6.8), img = g.getImageData(0, 0, W, H), d = img.data;
  for (let i = 0; i < W * H; i++) { d[i * 4] = 60 * smooth(.5, .9, cloud[i]); d[i * 4 + 1] = 128 + 110 * (cloud[i] - .5); }   // 擦拭和手摸留下的深浅不匀
  g.putImageData(img, 0, 0);
  // 划痕：多数顺着擦桌子的方向（左右），细而浅；划过的地方发白、发涩
  g.lineCap = 'round';
  for (let i = 0; i < 260; i++) {
    const x = DESK.x0 + rand() * DW, z = DESK.z0 + rand() * DD, a = (rand() < .7 ? 0 : rand() * TAU) + (rand() - .5) * .5, len = 1 + 9 * rand() ** 2, bend = (rand() - .5) * .8;
    g.strokeStyle = `rgba(${90 + 120 * rand()},25,0,${.25 + .5 * rand()})`; g.lineWidth = .8 + .9 * rand();
    g.beginPath(); g.moveTo(X(x), Z(z)); g.quadraticCurveTo(X(x + len * .5 * Math.cos(a) + bend * Math.sin(a)), Z(z + len * .5 * Math.sin(a) - bend * Math.cos(a)), X(x + len * Math.cos(a)), Z(z + len * Math.sin(a))); g.stroke();
  }
  // 杯底的水圈：一圈发白发涩的印子
  const rings = [[8, -23.4, 1.7], [21, -6.5, 1.45]];
  for (const [x, z, r] of rings) { g.strokeStyle = 'rgba(150,20,0,.6)'; g.lineWidth = .16 * ux; g.beginPath(); g.ellipse(X(x), Z(z), r * ux, r * uz, 0, .4, TAU - .5); g.stroke(); }
  g.globalCompositeOperation = 'lighter';                          // 之后画的东西按通道相加，三个通道互不干扰
  const glow = (x, z, rx, rz, rgb, alpha) => {
    g.save(); g.translate(X(x), Z(z)); g.scale(rx * ux, rz * uz);
    const grad = g.createRadialGradient(0, 0, 0, 0, 0, 1);
    grad.addColorStop(0, `rgba(${rgb},${alpha})`); grad.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = grad; g.fillRect(-1, -1, 2, 2); g.restore();
  };
  // 包浆：朝镜头的前沿被袖口、手腕磨得最亮，写字时两只小臂搁的地方更亮；其余三边也略亮
  const front = g.createLinearGradient(0, Z(DESK.z1), 0, Z(DESK.z1 - 7));
  front.addColorStop(0, 'rgba(150,90,0,1)'); front.addColorStop(.3, 'rgba(70,50,0,1)'); front.addColorStop(1, 'rgba(0,0,0,1)');
  g.fillStyle = front; g.fillRect(0, Z(DESK.z1 - 7), W, 7 * uz);
  for (const [x, z, rx, rz] of [[-15, 13.5, 9, 3.5], [14, 13.6, 9, 3.2], [-19, 3, 6, 9], [19.5, 2, 6, 9], [0, -22, 16, 4]]) glow(x, z, rx, rz, '110,70,0', .8);
  // 墨点：砚台和笔架周围溅的、滴的，有大有小；大的边上带几点小的
  const blot = (x, z, r, alpha) => {
    g.fillStyle = `rgba(0,0,255,${alpha})`; g.beginPath();
    for (let i = 0; i <= 14; i++) { const a = i / 14 * TAU, rr = r * (.8 + .4 * rand()); g.lineTo(X(x + rr * Math.cos(a)), Z(z + rr * Math.sin(a))); }
    g.fill();
  };
  for (const [cx, cz, spread, n] of [[18, -11, 4.5, 16], [10, -21.5, 5, 14], [-7, -22.5, 5, 12], [-17, -8, 4, 7], [15, 4, 3, 5]]) {
    for (let i = 0; i < n; i++) {
      const x = cx + (rand() - .5) * 2 * spread, z = cz + (rand() - .5) * 2 * spread * .7, r = .06 + .5 * rand() ** 3;
      blot(x, z, r, .5 + .5 * rand());
      for (let k = 0; k < 4 && r > .22; k++) blot(x + (rand() - .5) * 4 * r, z + (rand() - .5) * 4 * r, .04 + .05 * rand(), .8);
    }
  }
  for (const [x, z, r] of rings) glow(x, z, r, r, '0,0,60', .5);   // 水圈里面的木色略深
  // 拼缝：四周边框和中间面板之间、面板的三块板之间、四个角的斜接缝
  const x0 = DESK.x0 + EDGE, x1 = DESK.x1 - EDGE, z0 = DESK.z0 + EDGE, z1 = DESK.z1 - EDGE, plank = (DD - 2 * EDGE - 2 * RAIL) / 3;
  g.strokeStyle = 'rgba(0,0,210,1)'; g.lineWidth = 1.5; g.beginPath();
  g.rect(X(x0 + RAIL), Z(z0 + RAIL), (x1 - x0 - 2 * RAIL) * ux, (z1 - z0 - 2 * RAIL) * uz);
  for (const k of [1, 2]) { g.moveTo(X(x0 + RAIL), Z(z0 + RAIL + plank * k)); g.lineTo(X(x1 - RAIL), Z(z0 + RAIL + plank * k)); }
  for (const [ax, az, sx, sz] of [[x0, z0, 1, 1], [x1, z0, -1, 1], [x0, z1, 1, -1], [x1, z1, -1, -1]]) { g.moveTo(X(ax), Z(az)); g.lineTo(X(ax + sx * RAIL), Z(az + sz * RAIL)); }
  g.stroke();
  return c;
}

// 木纹的颜色和法线两张贴图，按给定的平铺次数各给一份。画布只画一次；各份共用显存里的同一张图，只是平铺次数不同
let grainOnce = null;
export function grainTextures(repeat) {
  if (!grainOnce) { const c = grainCanvases(); grainOnce = { map: tex(c.color, { srgb: true, repeat: [1, 1] }), normalMap: tex(c.normal, { repeat: [1, 1] }) }; }
  const share = t => { const copy = t.clone(); copy.repeat.set(repeat[0], repeat[1]); copy.needsUpdate = true; return copy; };
  return { map: share(grainOnce.map), normalMap: share(grainOnce.normalMap) };
}

// 书案所有木件共用的材质。使用痕迹只落在台面上（按高度判断），侧面和案腿只有木纹；线脚的明暗来自顶点色
export function woodMaterial() {
  const uniforms = { wearMap: { value: tex(wearCanvas()) }, wearBox: { value: new THREE.Vector4(DESK.x0, DESK.z0, 1 / DW, 1 / DD) }, deskTop: { value: DESK.top } };
  return extend(new THREE.MeshStandardMaterial({ ...grainTextures([1, 1]), vertexColors: true, normalScale: new THREE.Vector2(.35, .35), roughness: .72 }), {
    uniforms,
    head: 'uniform sampler2D wearMap;\nuniform vec4 wearBox;\nuniform float deskTop;\nvec3 wear;',
    afterMap: `
      wear = texture2D(wearMap, vec2((vWorld.x - wearBox.x) * wearBox.z, 1. - (vWorld.z - wearBox.y) * wearBox.w)).rgb;
      wear = mix(vec3(.12, .5, 0.), wear, smoothstep(deskTop - .7, deskTop - .2, vWorld.y));
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 2.1 + vec3(.04, .024, .014), wear.r);         // 磨亮处露出浅一些的木色
      diffuseColor.rgb *= 1. - .9 * wear.b;
    `,
    afterRoughness: 'roughnessFactor = clamp(roughnessFactor - .3 * (wear.g - .5) * 2. - .15 * wear.r + .25 * wear.b, .58, 1.);',
    gloss: '.22',
  });
}
