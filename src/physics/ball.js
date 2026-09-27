// 球类：维护位置、速度，并记录上一帧位置用于扫掠检测。
// 摩擦力基于球与地面的相对速度（库仑摩擦模型），不使用固定衰减系数。
class Ball {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.prevX = x;
    this.prevY = y;
    this.vx = 0;
    this.vy = 0;
    this.radius = 5;
    this.restitution = 0.8;
    // 库仑摩擦系数：单位时间最大相对速度衰减量按 mu * g 计算
    this.friction = 1.2;
    this.lastTouch = null;
  }

  update(dt, groundVx = 0, groundVy = 0) {
    this.prevX = this.x;
    this.prevY = this.y;
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // 摩擦力由球与地面的相对速度决定：相对速度越大摩擦冲量越大，
    // 相对速度为零时（例如站在传送带上）球会被地面带着走，摩擦力为零。
    const relVx = this.vx - groundVx;
    const relVy = this.vy - groundVy;
    const relSpeed = Math.sqrt(relVx * relVx + relVy * relVy);
    if (relSpeed > 0) {
      const decay = this.friction * dt;
      if (decay >= relSpeed) {
        this.vx = groundVx;
        this.vy = groundVy;
      } else {
        const scale = (relSpeed - decay) / relSpeed;
        this.vx = groundVx + relVx * scale;
        this.vy = groundVy + relVy * scale;
      }
    }
  }
}

module.exports = { Ball };
