const { Ball } = require('../src/physics/ball.js');
const {
  resolveBallPlayer,
  resolvePlayerPlayer,
  resolveBallPost,
  checkGoal,
  checkOutOfBounds,
} = require('../src/physics/collision.js');
const { Player } = require('../src/entities/player.js');

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
    const goal = {x: 100, y: 0, width: 10, height: 100};
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

describe('扫掠碰撞', () => {
  test('高速扫掠：球一帧越过球员仍被拦截', () => {
    const ball = new Ball(0, 0);
    ball.vx = 1000;
    ball.friction = 0;
    const player = new Player(500, 0);
    ball.update(1); // 帧末 x=1000，已穿透球员
    const hit = resolveBallPlayer(ball, player);
    expect(hit).toBe(true);
    expect(ball.vx).toBeLessThan(0);
    expect(ball.x).toBeLessThan(500); // 被弹回球员前方
  });

  test('扫掠考虑球员移动：相向而行帧末不重叠也算碰撞', () => {
    const ball = new Ball(0, 0);
    ball.vx = 200;
    ball.friction = 0;
    const player = new Player(300, 0);
    player.vx = -200;
    ball.update(1);    // 球 0 -> 200
    player.update(1);  // 球员 300 -> 100，帧末相距 100，静态检测会漏
    const hit = resolveBallPlayer(ball, player);
    expect(hit).toBe(true);
    expect(ball.vx).toBeLessThan(0);
  });

  test('静止球员挡球：球被弹回且球员不受影响', () => {
    const ball = new Ball(0, 0);
    ball.vx = 50;
    ball.friction = 0;
    const player = new Player(35, 0);
    ball.update(0.5);
    const hit = resolveBallPlayer(ball, player);
    expect(hit).toBe(true);
    expect(ball.vx).toBeLessThan(0);
    expect(player.vx).toBe(0);
    expect(player.x).toBe(35);
  });
});

describe('碰撞法线与速度响应', () => {
  test('法线是球心到球员中心连线，而非移动方向', () => {
    // 球从球员侧后方撞来，法线有 y 分量，球应被弹向 +y
    const ball = new Ball(10, 10);
    ball.vx = 10;
    ball.vy = 0;
    const player = new Player(20, 0);
    resolveBallPlayer(ball, player);
    expect(ball.vy).toBeGreaterThan(0);
    expect(ball.vx).toBeLessThan(10);
  });

  test('速度沿法线反射并乘恢复系数 0.8', () => {
    const ball = new Ball(10, 0);
    ball.vx = 10;
    const player = new Player(20, 0);
    resolveBallPlayer(ball, player);
    expect(ball.vx).toBeCloseTo(-8, 5);
    expect(ball.vy).toBeCloseTo(0, 5);
  });

  test('切线方向叠加球员速度', () => {
    const ball = new Ball(10, 0);
    ball.vx = 10;
    const player = new Player(20, 0);
    player.vy = 5; // 球员横向移动
    resolveBallPlayer(ball, player);
    expect(ball.vx).toBeCloseTo(-8, 5);
    // 相对切线速度保持：球获得球员切向速度
    expect(ball.vy).toBeCloseTo(0, 5);
  });

  test('连续碰撞稳定：不重叠、无 NaN、能量不增', () => {
    const ball = new Ball(10, 0);
    ball.vx = 10;
    const player = new Player(20, 0);
    for (let i = 0; i < 10; i++) {
      resolveBallPlayer(ball, player);
      const dist = Math.hypot(ball.x - player.x, ball.y - player.y);
      expect(dist).toBeGreaterThanOrEqual(ball.radius + player.radius - 1e-9);
    }
    const speed = Math.hypot(ball.vx, ball.vy);
    expect(Number.isFinite(speed)).toBe(true);
    expect(speed).toBeLessThanOrEqual(10);
  });
});

describe('踢球', () => {
  test('踢球区域：背后远处的球不可踢，身前锥内可踢', () => {
    const player = new Player(0, 0);
    player.facing = 0; // 朝 +x
    const behind = new Ball(-25, 0); // 背后，超出贴身范围
    expect(() => player.kick(behind, 'shortPass')).toThrow();
    const ahead = new Ball(25, 0); // 正前方锥内
    expect(() => player.kick(ahead, 'shortPass')).not.toThrow();
  });

  test('不同踢球动作力量不同：射门 > 长传 > 短传', () => {
    const mk = (type) => {
      const p = new Player(0, 0);
      const b = new Ball(0, 3);
      p.kick(b, type, 0);
      return Math.hypot(b.vx, b.vy);
    };
    const short = mk('shortPass');
    const long = mk('longPass');
    const shot = mk('shoot');
    expect(shot).toBeGreaterThan(long);
    expect(long).toBeGreaterThan(short);
  });

  test('踢球记录最后触球方', () => {
    const player = new Player(0, 0, 'home');
    const ball = new Ball(0, 3);
    player.kick(ball, 'shortPass', 0);
    expect(ball.lastTouchedBy).toBe('home');
  });
});

describe('摩擦力', () => {
  test('摩擦基于相对速度：减速方向与速度相反且不反向', () => {
    const ball = new Ball(0, 0);
    ball.vx = 1; // 速度小于一帧摩擦减速量
    ball.update(1);
    expect(ball.vx).toBe(0); // 停下而不是反向
  });

  test('斜向运动减速后方向保持不变', () => {
    const ball = new Ball(0, 0);
    ball.vx = 30;
    ball.vy = 40;
    ball.update(0.5);
    const ratio = ball.vy / ball.vx;
    expect(ratio).toBeCloseTo(40 / 30, 5);
    expect(Math.hypot(ball.vx, ball.vy)).toBeCloseTo(50 - ball.friction * 0.5, 5);
  });
});

describe('出界与进球', () => {
  test('出界判定最后触球方，不随机分配', () => {
    const home = new Player(0, 0, 'home');
    const ball = new Ball(0, 3);
    home.kick(ball, 'shoot', 0);
    ball.update(1);
    const field = { width: 200, height: 100 };
    ball.x = 250; // 右侧出界
    const result = checkOutOfBounds(ball, field);
    expect(result).not.toBeNull();
    expect(result.side).toBe('right');
    expect(result.lastTouchedBy).toBe('home');
  });

  test('未出界返回 null', () => {
    const ball = new Ball(50, 50);
    expect(checkOutOfBounds(ball, { width: 200, height: 100 })).toBeNull();
  });

  test('进球必须球整体越过门线', () => {
    const goal = { x: 100, y: 0, width: 10, height: 100 };
    const partial = new Ball(102, 50); // 球心过线但整体未过
    partial.radius = 5;
    expect(checkGoal(partial, goal)).toBe(false);
    const full = new Ball(106, 50); // 整体过线
    full.radius = 5;
    expect(checkGoal(full, goal)).toBe(true);
    const outsideMouth = new Ball(106, 150); // 过线但不在球门范围内
    outsideMouth.radius = 5;
    expect(checkGoal(outsideMouth, goal)).toBe(false);
  });

  test('球与门柱碰撞被弹开', () => {
    const post = { x: 100, y: 0, radius: 2 };
    const ball = new Ball(95, 0);
    ball.vx = 20;
    ball.friction = 0;
    const hit = resolveBallPost(ball, post);
    expect(hit).toBe(true);
    expect(ball.vx).toBeLessThan(0);
    const dist = Math.hypot(ball.x - post.x, ball.y - post.y);
    expect(dist).toBeGreaterThanOrEqual(ball.radius + post.radius - 1e-9);
  });
});

describe('球员碰撞', () => {
  test('位置分离：重叠球员被推开', () => {
    const a = new Player(0, 0);
    const b = new Player(20, 0); // 半径和 30，重叠 10
    const hit = resolvePlayerPlayer(a, b);
    expect(hit).toBe(true);
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    expect(dist).toBeGreaterThanOrEqual(30 - 1e-9);
  });

  test('速度修正：相向而行交换法向速度', () => {
    const a = new Player(0, 0);
    a.vx = 10;
    const b = new Player(25, 0);
    b.vx = -10;
    resolvePlayerPlayer(a, b);
    expect(a.vx).toBeLessThan(0);
    expect(b.vx).toBeGreaterThan(0);
  });

  test('未重叠时不做任何处理', () => {
    const a = new Player(0, 0);
    const b = new Player(100, 0);
    expect(resolvePlayerPlayer(a, b)).toBe(false);
    expect(a.x).toBe(0);
    expect(b.x).toBe(100);
  });
});
