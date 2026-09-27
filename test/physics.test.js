
const { Ball } = require('../src/physics/ball.js');
const { resolveBallPlayer, checkGoal } = require('../src/physics/collision.js');
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
