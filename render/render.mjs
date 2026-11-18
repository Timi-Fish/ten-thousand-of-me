// 用无头 Chrome 逐帧渲染 MV。
//   单帧：node render.mjs still <输出目录> <秒> [<秒> ...]
//   视频：node render.mjs video <输出.mp4> <起始秒> <结束秒> [fps=30] [并行数=3]
import { spawn } from 'node:child_process';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { once } from 'node:events';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';
import sirv from 'sirv';

const here = path.dirname(fileURLToPath(import.meta.url));
// 渲染哪个页面：
//   默认            mv/index.html，直接以文件方式打开；MV_PAGE 可换成 mv/ 下的其他页面
//   MV_HTTP_PATH    相对项目根的页面路径（如 mv2/src/index.html），通过本地静态服务器打开。
//                   用 ES 模块的页面必须走 http，浏览器不允许从 file:// 加载模块
let PAGE, server;
if (process.env.MV_HTTP_PATH) {
  server = http.createServer(sirv(path.join(here, '..'), { dev: true })).listen(0, '127.0.0.1');
  await once(server, 'listening');
  PAGE = `http://127.0.0.1:${server.address().port}/${process.env.MV_HTTP_PATH}?render=1`;
} else {
  PAGE = pathToFileURL(path.join(here, '../mv', process.env.MV_PAGE ?? 'index.html')).href + '?render=1';
}
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const [mode, out, ...rest] = process.argv.slice(2);

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: [
  '--force-device-scale-factor=1',
  '--allow-file-access-from-files',          // 允许 file:// 页面 fetch 同目录的 audio-data.json
  '--use-angle=metal', '--ignore-gpu-blocklist',   // 无头模式下也用显卡跑 WebGL
] });
async function openPage() {
  const page = await browser.newPage();
  page.on('pageerror', e => { console.error('页面报错：', e.message); process.exitCode = 1; });
  if (process.env.MV_LOG) page.on('console', m => console.log('页面：', m.text()));      // MV_LOG=1 时把页面里的 console 输出打出来
  await page.setViewport({ width: 1920, height: 1080 });
  await page.goto(PAGE);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction('window.renderFrame !== undefined && (window.mvReady === true || !document.querySelector(\'script[src="main.js"]\'))', { timeout: 90000 });
  page.stageKind = await page.evaluate(() => document.getElementById('stage').tagName);
  return page;
}
// 取一帧（base64 的 JPEG）：#stage 是 canvas 就直接导出像素，是 SVG 就对页面截图
const GRAB = {
  CANVAS: (page, t, q) => page.evaluate((t, q) => { window.renderFrame(t); return document.getElementById('stage').toDataURL('image/jpeg', q).slice(23); }, t, q),
  svg: async (page, t, q) => {
    await page.evaluate(t => window.renderFrame(t), t);
    return page.screenshot({ type: 'jpeg', quality: Math.round(q * 100), encoding: 'base64', optimizeForSpeed: true });
  },
};
const grab = (page, t, q) => GRAB[page.stageKind](page, t, q);

const MODES = {
  async still() {
    await mkdir(out, { recursive: true });
    const page = await openPage();
    for (const s of rest) {
      const file = path.join(out, `f_${Number(s).toFixed(2).padStart(7, '0')}.jpg`);
      await writeFile(file, Buffer.from(await grab(page, Number(s), 0.8), 'base64'));
      console.log(file);
    }
  },
  // 让页面自查：node render.mjs check - <起始秒> <结束秒> [间隔=0.2]
  // 每隔一小段时间调一次页面的 window.mvClash(秒)，它返回那一刻的问题清单 [{ kind, who, amount }]；这里把连着出现的同一个问题并成一段，按时间打印
  async check() {
    const [from, to, step = 0.2] = rest.map(Number), page = await openPage(), open = new Map(), spans = [];
    for (let t = from; t <= to + 1e-6; t += step) {
      const now = new Map((await page.evaluate(t => window.mvClash(t), t)).map(c => [`${c.kind}｜${c.who}`, c.amount]));
      for (const [key, span] of open) if (!now.has(key)) { spans.push(span); open.delete(key); }
      for (const [key, amount] of now) { const span = open.get(key) ?? { key, from: t, to: t, worst: 0 }; span.to = t; span.worst = Math.max(span.worst, amount); open.set(key, span); }
    }
    spans.push(...open.values());
    spans.sort((a, b) => a.from - b.from).forEach(s => console.log(`${s.from.toFixed(1).padStart(6)} – ${s.to.toFixed(1).padStart(6)}  ${s.key}  最深 ${s.worst.toFixed(2)}`));
    console.log(`共 ${spans.length} 处`);
  },
  async video() {
    const [from, to, fps = 30, workers = 3] = rest.map(Number);
    const total = Math.round((to - from) * fps), per = Math.ceil(total / workers);
    const parts = [];
    let done = 0;
    const timer = setInterval(() => console.log(`${done}/${total} 帧`), 15000);
    await Promise.all(Array.from({ length: workers }, async (_, w) => {
      const a = w * per, b = Math.min(total, a + per);
      if (a >= b) return;
      const part = `${out}.part${w}.mp4`;
      parts[w] = part;
      const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(fps), '-i', '-',
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', String(fps), part], { stdio: ['pipe', 'inherit', 'inherit'] });
      let page = await openPage();
      // 页面报错（例如显卡的绘图环境丢了）就重开页面接着画。出事的那一刻要过一两帧页面才察觉，这中间画出来的是全黑，
      // 所以最近 HOLD 帧先扣着不交给编码器：一报错，扣着的全部作废，从它们的第一帧重画。累计重开超过 MAX_REOPEN 次才放弃
      const HOLD = 6, MAX_REOPEN = 8, held = [];
      const send = async buf => { if (!ff.stdin.write(buf)) await once(ff.stdin, 'drain'); done++; };
      let reopened = 0;
      for (let i = a; i < b; i++) {
        let jpeg;
        try { jpeg = await grab(page, from + i / fps, 0.93); } catch (e) {
          if (++reopened > MAX_REOPEN) throw e;
          console.log(`第 ${(from + i / fps).toFixed(2)} 秒这一帧没画出来（${e.message.split('\n')[0]}），重开页面，从 ${held.length} 帧之前重画`);
          await page.close();
          page = await openPage();
          i -= held.length + 1; held.length = 0;
          continue;
        }
        held.push(Buffer.from(jpeg, 'base64'));
        if (held.length > HOLD) await send(held.shift());
      }
      for (const buf of held) await send(buf);
      ff.stdin.end();
      const [code] = await once(ff, 'close');
      if (code !== 0) throw new Error(`ffmpeg 分段 ${w} 失败，退出码 ${code}`);
    }));
    clearInterval(timer);
    const list = `${out}.parts.txt`;
    await writeFile(list, parts.filter(Boolean).map(p => `file '${path.resolve(p)}'`).join('\n'));
    const cat = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', out], { stdio: 'inherit' });
    const [code] = await once(cat, 'close');
    if (code !== 0) throw new Error(`ffmpeg 拼接失败，退出码 ${code}`);
    await Promise.all([...parts.filter(Boolean), list].map(p => rm(p)));
    console.log(`完成：${out}（${total} 帧）`);
  },
};
await MODES[mode]();
await browser.close();
server?.close();
