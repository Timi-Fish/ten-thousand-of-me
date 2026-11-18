// 四扇画心的贴图：春、夏、秋、冬四幅设色山水，画在同一匹绢上。每幅各有一个文件（season-*.js）。
import { Scroll } from './scroll.js';
import { paintSpring } from './season-spring.js';
import { paintSummer } from './season-summer.js';
import { paintAutumn } from './season-autumn.js';
import { paintWinter } from './season-winter.js';

export const PAINT_W = 584, PAINT_H = 2048;                        // 画心宽高比 7.4 : 26
const PAINTERS = { 春: paintSpring, 夏: paintSummer, 秋: paintAutumn, 冬: paintWinter };

// 按屏风各扇的季节画出四张画布
export function paintSeasons(panels) {
  return panels.map(p => {
    const S = new Scroll(PAINT_W, PAINT_H);
    PAINTERS[p.season](S);
    return S.canvas;
  });
}
