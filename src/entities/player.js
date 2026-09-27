
class Player {
  constructor(x, y) { this.x=x; this.y=y; this.vx=0; this.vy=0; this.radius=15; }
  kick(ball, power, angle) {
    // BUG: 整个身体都能踢球
    ball.vx = Math.cos(angle) * power;
    ball.vy = Math.sin(angle) * power;
  }
}

module.exports = { Player };
