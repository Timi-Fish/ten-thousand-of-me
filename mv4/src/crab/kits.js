// 七种头饰的总表。每种是一个函数 q => 一组上好色的部件（q：精细程度），以头顶正中为原点。
import { pin, crown, twig, bow } from './kits-pins.js';
import { douli, cap, lotus } from './kits-hats.js';

export const KITS = { pin, douli, cap, lotus, crown, twig, bow };
export const KIT_NAMES = Object.keys(KITS);                      // 第一个是主角的
// 三根毫毛从多高的地方长出来（相对头顶）；null = 被帽子整个罩住，不用造
export const HAIR_BASE = { pin: 0, douli: null, cap: null, lotus: .02, crown: .26, twig: 0, bow: 0 };
