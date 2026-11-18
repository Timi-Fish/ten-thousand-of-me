// 推荐机位。近景机位的位置从路的走向算出来（路改了机位跟着走）：p 镜头位置，q 看向的点。
export function buildShots(road, heightAt, plan) {
  const uOf = (x, z) => road.locate(x, z).s / road.length;                        // 路上离 (x, z) 最近的那一点的 u
  // 路上 u 处附近的一点：沿下山方向往前 ahead、往右 side、抬高 up
  const by = (u, ahead, side, up) => {
    const at = road.at(u), dir = road.dir(u), len = Math.hypot(dir.x, dir.z), fx = dir.x / len, fz = dir.z / len;
    return [at.x + fx * ahead - fz * side, at.y + up, at.z + fz * ahead + fx * side];
  };
  const clear = p => { p[1] = Math.max(p[1], heightAt(p[0], p[2]) + 1.6); return p; };   // 镜头不钻到地里
  const lake = uOf(70, 793), bridge = uOf(60, 448), maple = uOf(128, 478), hut = uOf(plan.hut.x, plan.hut.z + 15), ridge = (road.section('ridge').from + 24) / road.length;   // 山脊那个机位看的是鲫鱼背的上半截
  return [
    { name: '春·湖边路上（垂柳、桃花）', season: '春', p: clear(by(lake, 15, -12, 2.6)), q: by(lake, 2, 0, 3.4) },
    { name: '夏·过桥（背后是瀑布）', season: '夏', p: [40, 175, 471], q: by(bridge, -3, 0, 4.5) },
    { name: '秋·红叶下的石阶（迎着落日）', season: '秋', p: clear(by(maple, 5, -13, 3)), q: by(maple, 0, 6, 2.8) },
    { name: '冬·雪夜小屋前（灯、梅）', season: '冬', p: clear(by(hut, 17, 6.5, 3)), q: by(hut, 0, -4.5, 2.8) },
    { name: '大远景·整座山、山路和云海', season: '春', p: [720, 310, 760], q: [0, 225, 300] },
    { name: '大远景·越过云海看落日', season: '秋', p: [372, 428, -150], q: [0, 432, -8] },
    { name: '沿路往下看·山路蜿蜒下山', season: '夏', p: [70, 548, -70], q: [8, 140, 520] },
    { name: '大远景·雪夜，月出峰后', season: '冬', p: [-600, 235, -467], q: [0, 360, 0] },
    { name: '秋·山脊石阶上逆光', season: '秋', p: by(ridge, 9, -17, 4), q: by(ridge, 0, 0, 2.2) },
    { name: '夏·湖湾荷花，隔水看山', season: '夏', p: [44, 6.5, 884], q: [6, 40, 700] },
    { name: '大远景·隔湖看春山', season: '春', p: [150, 46, 1075], q: [0, 92, 520] },
  ];
}
