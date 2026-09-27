const DEFAULT_RESTITUTION = 0.8;

// 扫掠圆-圆碰撞：考虑球与球员在一帧内的移动，而不是只比较帧末位置
function resolveBallPlayer(ball, player, restitution = DEFAULT_RESTITUTION) {
  const R = ball.radius + player.radius;
  const bpx = ball.prevX !== undefined ? ball.prevX : ball.x;
  const bpy = ball.prevY !== undefined ? ball.prevY : ball.y;
  const ppx = player.prevX !== undefined ? player.prevX : player.x;
  const ppy = player.prevY !== undefined ? player.prevY : player.y;

  // 相对运动（球相对球员），求解 |r0 + rd*t| = R 在 t∈[0,1] 的最早根
  const rx0 = bpx - ppx;
  const ry0 = bpy - ppy;
  const rdx = (ball.x - bpx) - (player.x - ppx);
  const rdy = (ball.y - bpy) - (player.y - ppy);

  let t = null;
  const c = rx0 * rx0 + ry0 * ry0 - R * R;
  const a = rdx * rdx + rdy * rdy;
  if (c <= 0) {
    t = 0; // 帧开始就已重叠
  } else if (a > 0) {
    const b = 2 * (rx0 * rdx + ry0 * rdy);
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const tHit = (-b - Math.sqrt(disc)) / (2 * a);
      if (tHit >= 0 && tHit <= 1) t = tHit;
    }
  }
  if (t === null) {
    const dx = ball.x - player.x;
    const dy = ball.y - player.y;
    if (dx * dx + dy * dy < R * R) {
      t = 1; // 帧末重叠（静止情形）
    } else {
      return false;
    }
  }

  // 碰撞时刻双方位置
  const pcx = ppx + (player.x - ppx) * t;
  const pcy = ppy + (player.y - ppy) * t;
  const bcx = bpx + (ball.x - bpx) * t;
  const bcy = bpy + (ball.y - bpy) * t;

  // 法线：球员碰撞中心 -> 球心
  let nx = bcx - pcx;
  let ny = bcy - pcy;
  let len = Math.hypot(nx, ny);
  if (len === 0) { nx = 1; ny = 0; len = 1; }
  nx /= len;
  ny /= len;

  // 速度响应：相对速度沿法线反射并乘恢复系数，切线保留，再叠加球员速度
  const rvx = ball.vx - player.vx;
  const rvy = ball.vy - player.vy;
  const vn = rvx * nx + rvy * ny;
  if (vn < 0) {
    const tx = rvx - vn * nx;
    const ty = rvy - vn * ny;
    ball.vx = -restitution * vn * nx + tx + player.vx;
    ball.vy = -restitution * vn * ny + ty + player.vy;
  }

  // 位置：回到碰撞点，并把本帧剩余位移按反射方向走完
  const remX = (ball.x - bpx) * (1 - t);
  const remY = (ball.y - bpy) * (1 - t);
  const remN = remX * nx + remY * ny;
  ball.x = bcx + (remX - 2 * remN * nx);
  ball.y = bcy + (remY - 2 * remN * ny);

  // 保证帧末不重叠
  const dx = ball.x - player.x;
  const dy = ball.y - player.y;
  const dist = Math.hypot(dx, dy);
  if (dist < R) {
    const ux = dist > 0 ? dx / dist : nx;
    const uy = dist > 0 ? dy / dist : ny;
    ball.x = player.x + ux * R;
    ball.y = player.y + uy * R;
  }

  ball.lastTouchedBy = player.team !== undefined && player.team !== null ? player.team : player;
  return true;
}

// 球员之间：位置分离 + 速度修正（等质量弹性交换法向分量）
function resolvePlayerPlayer(a, b) {
  const R = a.radius + b.radius;
  let dx = b.x - a.x;
  let dy = b.y - a.y;
  let dist = Math.hypot(dx, dy);
  if (dist >= R) return false;
  if (dist === 0) { dx = 1; dy = 0; dist = 1; }
  const nx = dx / dist;
  const ny = dy / dist;
  const overlap = R - dist;
  a.x -= nx * overlap / 2;
  a.y -= ny * overlap / 2;
  b.x += nx * overlap / 2;
  b.y += ny * overlap / 2;
  const rvn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (rvn < 0) {
    const impulse = -rvn; // 等质量，恢复系数 1
    a.vx -= impulse * nx;
    a.vy -= impulse * ny;
    b.vx += impulse * nx;
    b.vy += impulse * ny;
  }
  return true;
}

// 门柱：静态小圆，反射球
function resolveBallPost(ball, post, restitution = DEFAULT_RESTITUTION) {
  const postRadius = post.radius !== undefined ? post.radius : 2;
  const R = ball.radius + postRadius;
  const dx = ball.x - post.x;
  const dy = ball.y - post.y;
  const dist = Math.hypot(dx, dy);
  if (dist >= R) return false;
  let nx;
  let ny;
  if (dist === 0) { nx = 1; ny = 0; } else { nx = dx / dist; ny = dy / dist; }
  ball.x = post.x + nx * R;
  ball.y = post.y + ny * R;
  const vn = ball.vx * nx + ball.vy * ny;
  if (vn < 0) {
    ball.vx -= (1 + restitution) * vn * nx;
    ball.vy -= (1 + restitution) * vn * ny;
  }
  return true;
}

// 进球：球整体越过门线（goal.x 为门线），且球心在球门范围内
function checkGoal(ball, goal) {
  return ball.x - ball.radius >= goal.x &&
         ball.y >= goal.y &&
         ball.y <= goal.y + goal.height;
}

// 出界：返回出界边与最后触球方，未出界返回 null
function checkOutOfBounds(ball, field) {
  let side = null;
  if (ball.x < 0) side = 'left';
  else if (ball.x > field.width) side = 'right';
  else if (ball.y < 0) side = 'top';
  else if (ball.y > field.height) side = 'bottom';
  if (side === null) return null;
  return { side, lastTouchedBy: ball.lastTouchedBy !== undefined ? ball.lastTouchedBy : null };
}

module.exports = {
  resolveBallPlayer,
  resolvePlayerPlayer,
  resolveBallPost,
  checkGoal,
  checkOutOfBounds,
};
