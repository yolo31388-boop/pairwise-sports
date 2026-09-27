const { Ball } = require('../src/physics/ball.js');
const {
  resolveBallPlayer,
  resolveBallPost,
  resolvePlayerPlayer,
  checkGoal,
  checkOutOfBounds,
} = require('../src/physics/collision.js');
const { Player, KICK_ACTIONS } = require('../src/entities/player.js');

describe('体育游戏物理', () => {
  test('碰撞法线正确', () => {
    const ball = new Ball(10, 0);
    ball.vx = 10;
    const player = new Player(20, 0);
    resolveBallPlayer(ball, player);
    expect(ball.vx).toBeLessThan(0);
  });
  test('进球门线判定', () => {
    const ball = new Ball(99, 50);
    ball.radius = 5;
    const goal = { x: 100, y: 0, width: 10, height: 100 };
    expect(checkGoal(ball, goal)).toBe(false);
  });
  test('踢球区域判定', () => {
    const ball = new Ball(0, 0);
    const player = new Player(100, 100);
    // 球不在脚边不应能踢
    expect(() => player.kick(ball, 10, 0)).toThrow();
  });
  test('不同踢球力量', () => {
    const ball = new Ball(0, 0);
    const player = new Player(0, 5);
    player.kick(ball, 20, 0);
    expect(ball.vx).toBe(20);
  });
  test('摩擦力基于相对速度', () => {
    const ball = new Ball(0, 0);
    ball.vx = 10;
    ball.update(1);
    expect(ball.vx).toBeLessThan(10);
  });
  test('高速碰撞不穿透', () => {
    const ball = new Ball(0, 0);
    ball.vx = 100;
    const player = new Player(50, 0);
    ball.update(0.1);
    resolveBallPlayer(ball, player);
    expect(ball.x).toBeLessThan(50);
  });
});

describe('扫掠碰撞与碰撞响应（新增不变量）', () => {
  test('高速扫掠碰撞：帧末检测必然漏判，扫掠检测在帧内拦下球', () => {
    const dt = 0.1;
    const ball = new Ball(0, 0);
    ball.friction = 0;
    ball.vx = 1000; // 一帧位移 100，直接跨过位于 x=50 的球员
    const player = new Player(50, 0);
    ball.update(dt);

    // 帧末球心在 100，距球员 50，远大于半径和 20 —— 旧的帧末点-圆检测必然漏判
    expect(Math.abs(ball.x - player.x)).toBeGreaterThan(ball.radius + player.radius);

    const hit = resolveBallPlayer(ball, player, dt);
    expect(hit).toBe(true);
    expect(ball.x).toBeLessThan(player.x); // 没有穿过球员
    expect(ball.vx).toBeCloseTo(-800, 5);  // 1000 * 恢复系数 0.8
  });

  test('碰撞法线沿球心-球员中心连线，而非球员移动方向', () => {
    const dt = 0.1;
    const ball = new Ball(0, 5);
    ball.vx = 1000;
    const player = new Player(50, 0); // 球擦着球员上沿飞过
    ball.update(dt);
    const hit = resolveBallPlayer(ball, player, dt);
    expect(hit).toBe(true);
    // 连线法线斜向上，球必须被向上偏转；旧实现用速度反向会得到 vy=0
    expect(ball.vx).toBeLessThan(0);
    expect(ball.vy).toBeGreaterThan(200);
    // 反弹方向必须与碰撞瞬间的中心连线法线一致（非水平、非移动方向）
    const speed = Math.hypot(ball.vx, ball.vy);
    expect(ball.vy / speed).toBeGreaterThan(0.4);
  });

  test('速度沿法线反射并乘恢复系数，切向分量保留', () => {
    const dt = 0.1;
    const ball = new Ball(0, 0);
    ball.friction = 0;
    ball.vx = 50;
    ball.vy = 0;
    const player = new Player(24, 0);
    ball.update(dt);
    const hit = resolveBallPlayer(ball, player, dt);
    expect(hit).toBe(true);
    expect(ball.vx).toBeCloseTo(-40, 6); // 50 * 0.8
    expect(ball.vy).toBeCloseTo(0, 9);   // 正对心碰撞不产生离谱角度
  });

  test('切向速度叠加球员自身速度（移动球员等效移动墙）', () => {
    const dt = 0.1;
    const ball = new Ball(0, 50); // 静止的球
    const player = new Player(0, 0);
    player.vy = 1000; // 球员沿 +y 飞铲，帧末已在球另一侧
    player.update(dt);
    ball.update(dt);
    expect(Math.hypot(ball.x - player.x, ball.y - player.y)).toBeGreaterThan(
      ball.radius + player.radius,
    ); // 帧末点-圆检测同样漏判
    const hit = resolveBallPlayer(ball, player, dt);
    expect(hit).toBe(true);
    expect(ball.vx).toBeCloseTo(0, 6);
    expect(ball.vy).toBeCloseTo(1800, 6); // 1000 * (1 + 0.8)
  });

  test('静止球员正面挡球：球不穿过且只沿法线反弹', () => {
    const dt = 1;
    const ball = new Ball(0, 0);
    ball.friction = 0;
    ball.vx = 20;
    const player = new Player(22, 0);
    ball.update(dt);
    const hit = resolveBallPlayer(ball, player, dt);
    expect(hit).toBe(true);
    expect(ball.x).toBeLessThan(player.x);
    expect(ball.vx).toBeCloseTo(-16, 6);
    expect(ball.vy).toBeCloseTo(0, 9); // 不再弹到不合理的随机角度
  });

  test('踢球判定区域：只有脚前小区域能踢，身体侧面/后方不能踢', () => {
    const player = new Player(0, 0, 1, 0);
    const atFoot = new Ball(10, 0);
    expect(player.canKick(atFoot)).toBe(true);
    expect(() => player.kick(atFoot, 30, 0)).not.toThrow();
    expect(atFoot.lastTouch).toBe(player);

    const behind = new Ball(-20, 0); // 身后
    expect(player.canKick(behind)).toBe(false);
    expect(() => player.kick(behind, 30, 0)).toThrow();

    const side = new Ball(0, 22); // 身体侧上方，既不在身体圆内也不在脚部区域
    expect(player.canKick(side)).toBe(false);
    expect(() => player.kick(side, 30, 0)).toThrow();
  });

  test('短传/长传/射门有不同力量，且长传自带上扬角', () => {
    const speeds = {};
    for (const action of ['shortPass', 'longPass', 'shot']) {
      const player = new Player(0, 0, 0, 0);
      const ball = new Ball(10, 0);
      player.kickAction(ball, action, 0);
      speeds[action] = Math.hypot(ball.vx, ball.vy);
    }
    expect(speeds.shortPass).toBeCloseTo(KICK_ACTIONS.shortPass.power, 9);
    expect(speeds.longPass).toBeCloseTo(KICK_ACTIONS.longPass.power, 9);
    expect(speeds.shot).toBeCloseTo(KICK_ACTIONS.shot.power, 9);
    expect(speeds.shortPass).toBeLessThan(speeds.longPass);
    expect(speeds.longPass).toBeLessThan(speeds.shot);

    const player = new Player(0, 0, 0, 0);
    const ball = new Ball(10, 0);
    player.kickAction(ball, 'longPass', 0);
    expect(ball.vy).toBeGreaterThan(0); // 长传角度参数带来上扬分量
    expect(() => player.kickAction(new Ball(10, 0), 'bicycleKick', 0)).toThrow();
  });

  test('摩擦力基于球与地面的相对速度，而非固定衰减值', () => {
    const rolling = new Ball(0, 0);
    rolling.vx = 10;
    rolling.update(1);
    expect(rolling.vx).toBeCloseTo(8.8, 9); // 库仑摩擦：10 - 1.2
    expect(rolling.vx).not.toBeCloseTo(9.9, 3); // 绝不是旧的 *0.99

    const onConveyor = new Ball(0, 0);
    onConveyor.vx = 5;
    onConveyor.update(1, 5, 0); // 球与地面同速，相对速度为 0
    expect(onConveyor.vx).toBeCloseTo(5, 9);

    const dragged = new Ball(0, 0); // 静止的球放在运动地面上应被拖着走
    dragged.update(1, 10, 0);
    expect(dragged.vx).toBeCloseTo(1.2, 9);
  });

  test('出界判定确定性地按最后触球方判给对方球权', () => {
    const bounds = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
    const red = new Player(50, 50, 0);
    const ball = new Ball(-6, 50);
    ball.lastTouch = red;
    const result1 = checkOutOfBounds(ball, bounds);
    const result2 = checkOutOfBounds(ball, bounds);
    expect(result1.side).toBe('left');
    expect(result1.restartTeam).toBe(1); // 最后触球是 0 队，球权给 1 队
    expect(result2).toEqual(result1);    // 多次判定结果一致，不随机

    const untouched = new Ball(50, -6);
    const none = checkOutOfBounds(untouched, bounds);
    expect(none.side).toBe('top');
    expect(none.restartTeam).toBeNull();

    expect(checkOutOfBounds(new Ball(5, 50), bounds)).toBeNull(); // 球整体压线不算出界
  });

  test('进球必须球整体越过门线，且整体处于两门柱之间', () => {
    const goal = { x: 100, y: 0, width: 10, height: 100 };
    expect(checkGoal(Object.assign(new Ball(99, 50), { radius: 5 }), goal)).toBe(false);
    const centerOnLine = new Ball(100.001, 50); // 球心过线但球未整体越过
    expect(checkGoal(centerOnLine, goal)).toBe(false);
    const fullyAcross = new Ball(105, 50);
    expect(checkGoal(fullyAcross, goal)).toBe(true);
    const acrossButHigh = new Ball(105, -2); // 过线但超出门柱范围
    expect(checkGoal(acrossButHigh, goal)).toBe(false);
  });

  test('球员碰撞：重叠时位置分离且相向速度被修正', () => {
    const p1 = new Player(0, 0);
    const p2 = new Player(10, 0);
    p1.vx = 10;
    p2.vx = -10;
    const hit = resolvePlayerPlayer(p1, p2);
    expect(hit).toBe(true);
    const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    expect(dist).toBeCloseTo(p1.radius + p2.radius, 9);
    expect(p1.vx).toBeCloseTo(-10, 9); // 等质量交换法向速度
    expect(p2.vx).toBeCloseTo(10, 9);

    const a = new Player(0, 0); // 静止重叠同样只做分离
    const b = new Player(0, 0);
    expect(resolvePlayerPlayer(a, b)).toBe(true);
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(a.radius + b.radius, 9);
  });

  test('球与门柱：高速不穿柱，偏心碰撞按连线偏转', () => {
    const dt = 0.1;
    const post = { x: 50, y: 0, radius: 2 };
    const ball = new Ball(0, 0);
    ball.friction = 0;
    ball.vx = 600; // 帧末在 60，已越过门柱
    ball.update(dt);
    expect(Math.abs(ball.x - post.x)).toBeGreaterThan(ball.radius + post.radius);
    const hit = resolveBallPost(ball, post, dt);
    expect(hit).toBe(true);
    expect(ball.x).toBeLessThan(post.x);
    expect(ball.vx).toBeCloseTo(-480, 6);

    const graze = new Ball(0, -3); // 从门柱下方擦过
    graze.friction = 0;
    graze.vx = 600;
    graze.update(dt);
    expect(resolveBallPost(graze, post, dt)).toBe(true);
    expect(graze.vy).toBeLessThan(0); // 沿球心-门柱连线向下偏转
  });

  test('连续碰撞稳定性：球在两名球员间反复反弹不穿透、不发散', () => {
    const dt = 1 / 60;
    const left = new Player(-30, 0);
    const right = new Player(30, 0);
    const ball = new Ball(0, 0);
    ball.vx = 40;
    for (let i = 0; i < 300; i++) {
      ball.update(dt);
      resolveBallPlayer(ball, left, dt);
      resolveBallPlayer(ball, right, dt);
      expect(Number.isFinite(ball.x) && Number.isFinite(ball.y)).toBe(true);
      expect(Math.hypot(ball.vx, ball.vy)).toBeLessThanOrEqual(40 + 1e-9);
      expect(Math.abs(ball.x)).toBeLessThan(30); // 始终未穿过任何一名球员
    }
    expect(ball.lastTouch).not.toBeNull();
  });
});
