class Ball {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.radius = 5;
    this.prevX = x; this.prevY = y;
    // 基于相对速度的摩擦减速度（单位/秒^2），地面静止
    this.friction = 5;
    this.lastTouchedBy = null;
  }

  update(dt) {
    this.prevX = this.x;
    this.prevY = this.y;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    // 摩擦力基于球与地面的相对速度：方向与相对速度相反，大小为减速度，
    // 速度减到 0 为止，不会反向
    const groundVx = 0;
    const groundVy = 0;
    const relVx = this.vx - groundVx;
    const relVy = this.vy - groundVy;
    const relSpeed = Math.hypot(relVx, relVy);
    if (relSpeed > 0) {
      const newSpeed = Math.max(0, relSpeed - this.friction * dt);
      const scale = newSpeed / relSpeed;
      this.vx = groundVx + relVx * scale;
      this.vy = groundVy + relVy * scale;
    }
  }
}

module.exports = { Ball };
