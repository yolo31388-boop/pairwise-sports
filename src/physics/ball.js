
class Ball {
  constructor(x, y) { this.x=x; this.y=y; this.vx=0; this.vy=0; this.radius=5; }
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    // BUG: 固定摩擦力
    this.vx *= 0.99;
    this.vy *= 0.99;
  }
}

module.exports = { Ball };
