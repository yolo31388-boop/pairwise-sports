// 球员类：位置、速度、半径、朝向（弧度），以及受严格判定区域约束的踢球逻辑。

// 不同踢球动作的力量与角度参数：
// 短传：力量小、角度修正小；长传：力量中等并自带上扬角；射门：力量最大、角度散布最大。
const KICK_ACTIONS = {
  shortPass: { power: 14, angleOffset: 0,    angleSpread: 0.02 },
  longPass:  { power: 26, angleOffset: 0.25, angleSpread: 0.06 },
  shot:      { power: 38, angleOffset: 0,    angleSpread: 0.10 },
};

class Player {
  constructor(x, y, team = 0, facing = 0) {
    this.x = x;
    this.y = y;
    this.prevX = x;
    this.prevY = y;
    this.vx = 0;
    this.vy = 0;
    this.radius = 15;
    this.team = team;
    this.facing = facing;
    // 脚相对球员中心前移的距离，以及脚部踢球判定半径
    this.footOffset = 7.5;
    this.kickReach = 10;
  }

  update(dt) {
    this.prevX = this.x;
    this.prevY = this.y;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  footPosition() {
    return {
      x: this.x + Math.cos(this.facing) * this.footOffset,
      y: this.y + Math.sin(this.facing) * this.footOffset,
    };
  }

  // 踢球判定区域：只有球碰到球员朝向的脚部小区域才允许踢球，
  // 身体其他位置的接触走普通碰撞反弹，不能踢球。
  canKick(ball) {
    const foot = this.footPosition();
    const dx = ball.x - foot.x;
    const dy = ball.y - foot.y;
    return Math.sqrt(dx * dx + dy * dy) <= ball.radius + this.kickReach;
  }

  // 保持公开用途：kick(ball, power, angle)。
  // 球不在脚部判定区域时抛错，杜绝全身踢球。
  kick(ball, power, angle) {
    if (!this.canKick(ball)) {
      throw new Error('球不在踢球判定区域（脚部）内，无法踢球');
    }
    ball.vx = Math.cos(angle) * power;
    ball.vy = Math.sin(angle) * power;
    ball.lastTouch = this;
  }

  // 按动作类型踢球：不同动作具有不同的力量和角度参数。
  // angle 为目标方向，动作自带的 angleOffset / angleSpread 叠加在该方向上。
  kickAction(ball, action, angle = this.facing, spreadSign = 0) {
    const params = KICK_ACTIONS[action];
    if (!params) {
      throw new Error(`未知的踢球动作: ${action}`);
    }
    const finalAngle = angle + params.angleOffset + params.angleSpread * spreadSign;
    this.kick(ball, params.power, finalAngle);
    return params;
  }
}

Player.KICK_ACTIONS = KICK_ACTIONS;

module.exports = { Player, KICK_ACTIONS };
