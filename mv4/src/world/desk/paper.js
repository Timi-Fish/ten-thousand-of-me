// 宣纸和它下面的书画毡。纸面在 y = 0；表演区里是平的，起翘只出现在表演区之外、镇尺压不到的纸边和纸角。
// 纸的质感分两层：一张可平铺的细节贴图（纤维、帘纹、纸浆的颗粒）管近看，一张整纸的墨迹贴图管字、印和陈旧的深浅。
import * as THREE from 'three';
import { PAPER, STAGE, WEIGHTS, DESK, PAL } from '../layout.js';
import { clamp, rnd, TAU } from '../../anim.js';
import { canvas2d, stream, smooth, noiseField, fbmField, channel, normalCanvas, tex, extend } from './kit.js';
import { inkCanvas } from './ink.js';

const PW = PAPER.x1 - PAPER.x0, PD = PAPER.z1 - PAPER.z0, TILE = 3;   // 细节贴图一块盖 3 个单位见方
export const FELT = { x0: PAPER.x0 - .9, x1: PAPER.x1 + .9, z0: PAPER.z0 - .9, z1: PAPER.z1 + 1.2, top: -.014 };   // 毡比纸略大；毡面比纸面低一张纸的厚度

// 宣纸的细节：长短纤维、帘纹（抄纸的竹帘留下的细横纹和稀疏的竖线）、纸浆颗粒。返回颜色（灰度）和法线两张可平铺的画布
function paperDetail() {
  const S = 1024, [, g] = canvas2d(S, S), rand = stream(21);
  g.fillStyle = '#808080'; g.fillRect(0, 0, S, S);
  g.lineCap = 'round';
  const fibre = (len, width, alpha) => {
    const x = rand() * S, y = rand() * S, a = rand() * TAU, bend = (rand() - .5) * .5, tone = rand() < .62 ? 255 : 0;
    const mx = x + len * .5 * Math.cos(a + bend), my = y + len * .5 * Math.sin(a + bend), ex = x + len * Math.cos(a), ey = y + len * Math.sin(a);
    g.strokeStyle = `rgba(${tone},${tone},${tone},${alpha})`; g.lineWidth = width;
    for (let ox = -S; ox <= S; ox += S) for (let oy = -S; oy <= S; oy += S) {                           // 越过边界的部分从对面接回来，贴图才能平铺
      if (Math.min(x, mx, ex) + ox > S + 4 || Math.max(x, mx, ex) + ox < -4 || Math.min(y, my, ey) + oy > S + 4 || Math.max(y, my, ey) + oy < -4) continue;
      g.beginPath(); g.moveTo(x + ox, y + oy); g.quadraticCurveTo(mx + ox, my + oy, ex + ox, ey + oy); g.stroke();
    }
  };
  for (let i = 0; i < 2600; i++) fibre(18 + 110 * rand() ** 2, .6 + .9 * rand(), .06 + .2 * rand());
  for (let i = 0; i < 36; i++) fibre(160 + 260 * rand(), 1.2 + 1.6 * rand(), .06 + .1 * rand());        // 少数长的纤维束，粗而淡
  for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(0,0,0,${.1 + .3 * rand()})`; g.beginPath(); g.arc(rand() * S, rand() * S, .5 + 1.2 * rand(), 0, TAU); g.fill(); }   // 没捞干净的草屑
  const f = channel(g, S, S), cloud = fbmField(S, S, 4, 4, 4, 2.2), pulp = noiseField(S, S, 256, 256, 3.3);
  const height = new Float32Array(S * S), [colorCanvas, gc] = canvas2d(S, S), img = gc.createImageData(S, S), d = img.data;
  for (let y = 0, i = 0; y < S; y++) for (let x = 0; x < S; x++, i++) {
    const laid = Math.sin(TAU * (30 * y / S) + .7 * Math.sin(TAU * 2 * x / S)), chain = Math.exp(-(((x / S * 2) % 1 - .5) ** 2) * 9000);
    height[i] = (f[i] - .5) + (cloud[i] - .5) * .22 + (pulp[i] - .5) * .2 + laid * .04 - chain * .06;
    const v = 228 * (1 + (f[i] - .5) * .2 + (cloud[i] - .5) * .08 + (pulp[i] - .5) * .05 + laid * .012 - chain * .03);
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = clamp(v, 0, 255); d[i * 4 + 3] = 255;
  }
  gc.putImageData(img, 0, 0);
  return { color: colorCanvas, normal: normalCanvas(height, S, S, 2.4) };
}

// 纸在 (x, z) 处离开毡面多高。表演区内、镇尺附近恒为 0
function lift(x, z) {
  let free = smooth(.3, 2.4, Math.hypot(x, z - STAGE.z) - STAGE.r);
  for (const w of WEIGHTS) free *= smooth(.1, 1.9, Math.hypot(Math.max(0, Math.abs(x - w.x) - w.w / 2), Math.max(0, w.z0 - z, z - w.z1)));
  if (free === 0) return 0;
  let h = 0;
  // 四个角：朝镜头的两个角翘得高（纸是卷着存放的，摊开后角会往回卷）；靠里的两个角挨着油灯和砚台，几乎是平的
  for (const [cx, cz, amp, reach] of [[PAPER.x0, PAPER.z1, .62, 3.8], [PAPER.x1, PAPER.z1, .36, 3.1], [PAPER.x0, PAPER.z0, .1, 2.2]]) h += amp * clamp(1 - Math.hypot(x - cx, z - cz) / reach) ** 2;
  const front = clamp(1 - (PAPER.z1 - z) / 1.7), back = clamp(1 - (z - PAPER.z0) / 1.3), side = clamp(1 - (PAPER.x1 - Math.abs(x)) / 1.1);
  h += .075 * front * front * (1 + .6 * Math.sin(x * .9 + 1)) + .03 * back * back * (1 + .5 * Math.sin(x * 1.3)) + .035 * side * side;   // 纸边微微的荷叶边
  h += .012 * Math.max(front, back, side) * (1 + Math.sin(x * 2.3 + z * .8) * Math.sin(z * 1.9 - x * .5));                             // 边上细小的皱
  return free * h;
}

// folds：折痕所在的竖线（x）。纸面本身是平的，但折过又摊开的纸不会全平：每两道折痕之间的那一条纸各自微微歪向一边，
// 整张纸还有很缓的起伏。这些只写进法线（影响受光的明暗），不动顶点，小蟹脚下仍然是 y = 0
function paperGeometry(folds) {
  const nx = 192, nz = 200, pos = new Float32Array((nx + 1) * (nz + 1) * 3), uv = new Float32Array((nx + 1) * (nz + 1) * 2), index = [];
  for (let j = 0, p = 0, q = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const x = PAPER.x0 + PW * i / nx, z = PAPER.z0 + PD * j / nz;
    pos[p++] = x; pos[p++] = lift(x, z); pos[p++] = z;
    uv[q++] = i / nx; uv[q++] = 1 - j / nz;                        // 墨迹贴图的上沿是纸的远端
  }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + nx + 1; index.push(a, b, a + 1, a + 1, b, b + 1); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setIndex(index);
  geo.computeVertexNormals();
  const n = geo.attributes.normal, v = new THREE.Vector3(), midZ = (PAPER.z0 + PAPER.z1) / 2;
  for (let i = 0; i < n.count; i++) {
    const x = pos[i * 3], z = pos[i * 3 + 2], strip = folds.filter(f => f > x).length;
    v.fromBufferAttribute(n, i);
    v.x += .075 * (rnd(strip * 3.7 + 1.1) - .5) + .03 * Math.sin(x * .55 + 1.3) * Math.cos(z * .31) + .015 * Math.sin(x * 1.7 + z * .9);
    v.z += .03 * Math.sign(z - midZ) * (1 - Math.exp(-Math.abs(z - midZ) * 3)) + .035 * Math.sin(z * .47 + .6) * Math.cos(x * .23) + .015 * Math.cos(z * 1.4 - x * .6);   // 横着对折过一次，上下两半各歪一点
    n.setXYZ(i, ...v.normalize().toArray());
  }
  return geo;
}

// 毡：深青色的羊毛毡，表面是乱向的短绒，边是手裁的、不完全直
function feltTextures() {
  const S = 512, [c, g] = canvas2d(S, S), rand = stream(31);
  g.fillStyle = '#7d7d7d'; g.fillRect(0, 0, S, S); g.lineCap = 'round';
  for (let i = 0; i < 16000; i++) {
    const x = rand() * S, y = rand() * S, a = rand() * TAU, len = 3 + 9 * rand(), tone = rand() < .5 ? 255 : 0;
    g.strokeStyle = `rgba(${tone},${tone},${tone},${.05 + .13 * rand()})`; g.lineWidth = .6 + .7 * rand();
    for (let ox = -S; ox <= S; ox += S) for (let oy = -S; oy <= S; oy += S) {
      if (x + ox < -24 || x + ox > S + 24 || y + oy < -24 || y + oy > S + 24) continue;
      g.beginPath(); g.moveTo(x + ox, y + oy); g.quadraticCurveTo(x + ox + len * .5 * Math.cos(a + .6), y + oy + len * .5 * Math.sin(a + .6), x + ox + len * Math.cos(a), y + oy + len * Math.sin(a)); g.stroke();
    }
  }
  const h = channel(g, S, S), cloud = fbmField(S, S, 3, 3, 3, 8.8), [color, gc] = canvas2d(S, S), img = gc.createImageData(S, S), d = img.data, base = new THREE.Color(PAL.felt);
  for (let i = 0; i < S * S; i++) {
    const k = 1 + (h[i] - .5) * .55 + (cloud[i] - .5) * .3, lint = h[i] > .72 ? (h[i] - .72) * 300 : 0;   // 最亮的几根是沾上的浅色毛絮
    d[i * 4] = clamp(base.r * 255 * k + lint, 0, 255); d[i * 4 + 1] = clamp(base.g * 255 * k + lint, 0, 255); d[i * 4 + 2] = clamp(base.b * 255 * k + lint, 0, 255); d[i * 4 + 3] = 255;
  }
  gc.putImageData(img, 0, 0);
  return { color, normal: normalCanvas(h, S, S, 3) };
}
// 毡上的墨渍：写字时墨透过纸洇到毡上，日子久了留下一块块深色；纸边外面露出来的是历次铺纸位置不同留下的。白 = 干净
function feltStains() {
  const S = 512, [c, g] = canvas2d(S, S), rand = stream(35), w = FELT.x1 - FELT.x0, d = FELT.z1 - FELT.z0;
  g.fillStyle = '#fff'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 70; i++) {
    const along = rand(), side = Math.floor(rand() * 4), inset = .2 + 1.6 * rand() ** 2, r = (.12 + .5 * rand() ** 2) * S / w;
    const x = side < 2 ? along * w : side === 2 ? inset : w - inset, z = side < 2 ? (side ? inset : d - inset) : along * d;
    const blot = g.createRadialGradient(x * S / w, z * S / d, r * .3, x * S / w, z * S / d, r);
    blot.addColorStop(0, `rgba(12,12,22,${.35 + .5 * rand()})`); blot.addColorStop(.8, 'rgba(12,12,22,.2)'); blot.addColorStop(1, 'rgba(12,12,22,0)');
    g.fillStyle = blot; g.beginPath(); g.ellipse(x * S / w, z * S / d, r * (1 + .8 * rand()), r, rand() * 3, 0, TAU); g.fill();
  }
  return c;
}
function buildFelt() {
  const rand = stream(33), shape = new THREE.Shape(), R = .8, { x0, x1, z0, z1 } = FELT, pts = [];
  const edge = (ax, az, bx, bz) => { const n = Math.ceil(Math.hypot(bx - ax, bz - az) / .45); for (let i = 0; i < n; i++) pts.push([ax + (bx - ax) * i / n, az + (bz - az) * i / n]); };
  const corner = (cx, cz, a0) => { for (let i = 0; i < 8; i++) { const a = a0 - i / 8 * Math.PI / 2; pts.push([cx + R * Math.cos(a), cz + R * Math.sin(a)]); } };
  edge(x0 + R, z1, x1 - R, z1); corner(x1 - R, z1 - R, Math.PI / 2); edge(x1, z1 - R, x1, z0 + R); corner(x1 - R, z0 + R, 0);
  edge(x1 - R, z0, x0 + R, z0); corner(x0 + R, z0 + R, -Math.PI / 2); edge(x0, z0 + R, x0, z1 - R); corner(x0 + R, z1 - R, Math.PI);
  pts.forEach(([x, z], i) => { const wob = .035 * Math.sin(i * .37) + .03 * (rand() - .5); shape[i ? 'lineTo' : 'moveTo'](x + wob * Math.sign(x), -(z + wob * Math.sign(z))); });
  const thick = FELT.top - DESK.top, bevel = .035;
  const geo = new THREE.ExtrudeGeometry(shape, { depth: thick - bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 1 });
  geo.rotateX(-Math.PI / 2); geo.translate(0, DESK.top, 0);
  const t = feltTextures(), map = tex(t.color, { srgb: true, repeat: [.5, .5] }), normalMap = tex(t.normal, { repeat: [.5, .5] });
  const mat = extend(new THREE.MeshPhysicalMaterial({ map, normalMap, normalScale: new THREE.Vector2(.45, .45), roughness: 1, sheen: .5, sheenRoughness: .75, sheenColor: new THREE.Color('#8FA2D8') }), {
    uniforms: { stainMap: { value: tex(feltStains(), { srgb: true }) } },
    head: 'uniform sampler2D stainMap;',
    afterMap: `diffuseColor.rgb *= texture2D(stainMap, vec2((vWorld.x - (${FELT.x0.toFixed(2)})) / ${(FELT.x1 - FELT.x0).toFixed(2)}, 1. - (vWorld.z - (${FELT.z0.toFixed(2)})) / ${(FELT.z1 - FELT.z0).toFixed(2)})).rgb;`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}

// 返回 { group, update }
export function buildPaper() {
  const group = new THREE.Group(), detail = paperDetail(), repeat = [PW / TILE, PD / TILE], ink = inkCanvas(), uniforms = { inkMap: { value: tex(ink.canvas) }, uTime: { value: 0 } };
  const mat = extend(new THREE.MeshStandardMaterial({
    color: PAL.paper, roughness: .94, side: THREE.DoubleSide, map: tex(detail.color, { srgb: true, repeat }), normalMap: tex(detail.normal, { repeat }), normalScale: new THREE.Vector2(.32, .32),
  }), {
    uniforms,
    // 翘起来的纸角在夜风里极轻地起伏；平的地方 y = 0，乘什么都还是 0
    vertexHead: 'uniform float uTime;',
    vertex: 'transformed.y *= 1. + .07 * sin(uTime * .9 + position.x * .35 + position.z * .2);',
    head: 'uniform sampler2D inkMap;\nuniform float uTime;\nfloat inkD;',
    afterMap: `
      vec3 inkS = texture2D(inkMap, vUv0).rgb;
      float fibre = sampledDiffuseColor.g / .78;                                                       // 细节贴图的明暗，1 上下
      diffuseColor.rgb *= mix(vec3(.66, .54, .36), vec3(1.), smoothstep(.3, .95, inkS.b));             // 陈旧的地方偏黄偏暗
      inkD = clamp(inkS.r * (1. + 1.8 * (fibre - 1.)), 0., 1.);                                        // 墨顺着纤维有深有浅
      diffuseColor.rgb *= exp(-inkD * vec3(1.2, 1.15, 1.0));                                       // 墨越浓吸掉的光越多；淡墨偏暖灰，浓墨发青
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.62, .065, .04) * (.55 + .45 * fibre), inkS.g * .93);   // 朱砂印泥
    `,
    afterRoughness: 'roughnessFactor = mix(roughnessFactor, .7, inkD * .8);',                          // 干了的浓墨比纸滑一点
    gloss: '.3 * (1. - .7 * inkD)',                                                                    // 但反光不能盖过墨色：墨越浓，反光压得越低
  });
  const paper = new THREE.Mesh(paperGeometry(ink.folds), mat);
  paper.receiveShadow = true; paper.castShadow = true;
  group.add(buildFelt(), paper);
  return { group, update: t => { uniforms.uTime.value = t; } };
}
