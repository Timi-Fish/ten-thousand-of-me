// 穿模检查：看最近画的这一帧里，有没有东西互相穿进去。window.mvClash() 返回这一帧的问题清单，
// 由 render/render.mjs 的 check 模式隔一小段时间问一次，汇总成「哪一段时间、谁和谁、最深多少」的报告。
// 查四样：薄纸陷进小蟹的身体（已被自动推开，报的是推了多远——推得远说明摆的位置本来就不对）、两只小蟹的身体叠在一起
// （正在分裂的一对除外：kit.bond、kit.merge 说过的）、
// 脚陷进地里、身体撞进书案上的器物。身体用的是 body.js 里的近似（圆角方块），手、腿、头饰的细节不算。
import * as THREE from 'three';
import { sunk } from './body.js';
import { DESK, PAPER } from '../world/layout.js';

const PAGE_PUSH = .12, OVERLAP = .16, SINK = .1, BUMP = .12;          // 各项超过多少才算问题（纸被推开的距离；两只叠进去的深度按个头的比例；脚陷多深；撞进器物多深）
// 身体表面上的一圈探针（身体自己的坐标，单位是半长）：六个面的中心、十二条棱的中点
const PROBES = [-1, 0, 1].flatMap(x => [-1, 0, 1].flatMap(y => [-1, 0, 1].map(z => [x, y, z]))).filter(p => p.filter(c => c).length === 1 || p.filter(c => c).length === 2)
  .map(p => { const n = p.filter(c => c).length === 1 ? .96 : .78; return p.map(c => c * n); });
const AROUND = Array.from({ length: 8 }, (_, i) => new THREE.Vector3(Math.cos(i * Math.PI / 4), 0, Math.sin(i * Math.PI / 4))), point = new THREE.Vector3();
const onPaper = at => at.x > PAPER.x0 && at.x < PAPER.x1 && at.z > PAPER.z0 && at.z < PAPER.z1, onDesk = at => at.x > DESK.x0 && at.x < DESK.x1 && at.z > DESK.z0 && at.z < DESK.z1;

// a 的身体陷进 b 的身体多深
const into = (a, b) => Math.max(...PROBES.map(([x, y, z]) => sunk(b, point.set(x * a.half[0], a.half[1] + y * a.half[1], z * a.half[2]).applyMatrix4(a.out))));

const OUTDOORS = ['wild', 'shore'];                                  // 这两个场景的地面是一张高度场：kit[场景名].heightAt(x, z)
// set：这一帧在哪个场景（'desk' / 'wild' / 'shore'）
export function clashes(kit, set) {
  const { bodies, pushed, parting } = kit.seen, found = [];
  const splitting = (a, b) => parting.some(([x, y]) => (x === a.crab && y === b.crab) || (x === b.crab && y === a.crab));   // 一只正从另一只身体里分出来：本来就叠着
  pushed.filter(p => p.push > PAGE_PUSH).forEach(p => found.push({ kind: '纸陷进身体', who: p.who, amount: p.push }));
  bodies.forEach((a, i) => bodies.slice(i + 1).forEach(b => {
    if (a.at.distanceTo(b.at) > 1.5 * (a.s + b.s) || splitting(a, b)) return;
    const deep = Math.max(into(a, b), into(b, a));
    if (deep > OVERLAP * Math.min(a.s, b.s)) found.push({ kind: '两只叠在一起', who: `${a.name}×${b.name}`, amount: deep });
  }));
  for (const body of bodies) {
    const feet = body.crab.lift.position.y * body.s, at = body.at;
    if (OUTDOORS.includes(set)) {
      const low = kit[set].heightAt(at.x, at.z) - feet;
      if (low > SINK) found.push({ kind: '脚陷进地里', who: body.name, amount: low });
    }
    if (set !== 'desk' || onPaper(at) || !onDesk(at)) continue;         // 纸面上是空的表演区，不用查器物
    const low = kit.probe(point.set(at.x, feet + 1.2 * body.s, at.z), new THREE.Vector3(0, -1, 0), 1.2 * body.s);
    if (1.2 * body.s - low > SINK) found.push({ kind: '脚陷进地里', who: body.name, amount: 1.2 * body.s - low });
    const reach = body.half[0] * body.s, bump = Math.max(...AROUND.map(dir => reach - kit.probe(at, dir, reach)));
    if (bump > BUMP) found.push({ kind: '撞进器物', who: body.name, amount: bump });
  }
  return found;
}
