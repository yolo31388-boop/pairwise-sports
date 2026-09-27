const KICK_TYPES = {
  shortPass: { power: 15, angleOffset: 0 },
  longPass: { power: 30, angleOffset: 0.15 },
  shoot: { power: 45, angleOffset: 0.05 },
};

class Player {
  constructor(x, y, team = null) {
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.prevX = x; this.prevY = y;
    this.radius = 15;
    this.team = team;
    this.facing = 0;          // 朝向（弧度）
    this.kickReach = 10;      // 脚超出身体的触球距离
    this.kickAngle = Math.PI / 2; // 踢球判定锥半角
  }

  static get KICK_TYPES() { return KICK_TYPES; }

  update(dt) {
    this.prevX = this.x;
    this.prevY = this.y;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  // 脚的位置：身体前方
  getFootPosition() {
    return {
      x: this.x + Math.cos(this.facing) * this.radius,
      y: this.y + Math.sin(this.facing) * this.radius,
    };
  }

  // 踢球判定区域：球必须在可及范围内；超出贴身范围时还必须位于朝向锥内
  canReach(ball) {
    const dx = ball.x - this.x;
    const dy = ball.y - this.y;
    const dist = Math.hypot(dx, dy);
    const closeRange = this.radius + ball.radius + 2;
    const maxRange = this.radius + ball.radius + this.kickReach;
    if (dist > maxRange) return false;
    if (dist <= closeRange) return true; // 球在脚下，任意方向可踢
    let diff = Math.atan2(dy, dx) - this.facing;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    return Math.abs(diff) <= this.kickAngle;
  }

  // type 可为 'shortPass' | 'longPass' | 'shoot'，或直接传数值力量（向后兼容）
  kick(ball, type = 'shortPass', angle) {
    let power;
    let direction;
    if (typeof type === 'number') {
      power = type;
      direction = angle !== undefined ? angle : this.facing;
    } else {
      const preset = KICK_TYPES[type];
      if (!preset) throw new Error(`Unknown kick type: ${type}`);
      power = preset.power;
      direction = (angle !== undefined ? angle : this.facing) + preset.angleOffset;
    }
    if (!this.canReach(ball)) {
      throw new Error('Ball is outside the kicking zone');
    }
    ball.vx = Math.cos(direction) * power;
    ball.vy = Math.sin(direction) * power;
    ball.lastTouchedBy = this.team !== null ? this.team : this;
    return ball;
  }
}

module.exports = { Player };
