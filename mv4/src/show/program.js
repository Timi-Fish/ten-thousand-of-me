// 全片的节目单：各段表演，每段导出 span（[开始, 结束]，歌曲里的秒数）和 build(kit)。
// 时间有重叠时排在前面的优先：外景的段落排在书案的段落之前，就能从书案的一段中间切出去再切回来。
import { glimpse, wind, descent, again, journey, finale } from './outside.js';
import * as verse1 from './a-verse1.js';
import * as pre1 from './b-pre1.js';
import * as chorus1 from './c-chorus1.js';
import * as verse2 from './d-verse2.js';
import * as chorus2 from './e-chorus2.js';
import * as bridge from './g-bridge.js';
import * as final from './h-final.js';
import * as outro from './i-outro.js';
import * as lab from './lab.js';

export const PROGRAM = [glimpse, wind, descent, again, journey, finale, verse1, pre1, chorus1, verse2, chorus2, bridge, final, outro, lab];
