// 碰撞检测与响应模块（CommonJS）。
//
// 不变量：
// 1. 球与移动中的球员/门柱使用扫掠圆-圆检测，考虑双方一帧内的运动，
//    不只比较帧末位置，高速下不穿透。
// 2. 碰撞法线取“球心 -> 碰撞中心”的连线方向，绝不使用移动方向。
// 3. 球速度沿法线按恢复系数反射（相对目标速度），切向速度叠加目标速度。
// 4. 球员之间碰撞做位置分离与速度修正，不允许重叠。
// 5. 进球要求球整体越过门线，而非仅球心过线。

const EPS = 1e-9;

// 扫掠圆-圆检测的核心：返回首次碰撞时刻 t（0..1），无碰撞返回 null。
// 运动体 a 从 (aPrevX,aPrevY) 移动到 (aX,aY)，b 同理；半径之和为 rsum。
function sweptCircleHit(prevAx, prevAy, ax, ay, prevBx, prevBy, bx, by, rsum) {
  const dx0 = prevAx - prevBx;
  const dy0 = prevAy - prevBy;
  const rvx = (ax - prevAx) - (bx - prevBx);
  const rvy = (ay - prevAy) - (by - prevBy);
  const rr = rsum * rsum;

  // 帧首已重叠：t = 0，交由位置分离处理。
  if (dx0 * dx0 + dy0 * dy0 <= rr) return 0;

  const a = rvx * rvx + rvy * rvy;
  if (a < EPS) {
    // 无相对运动，未重叠即不碰撞。
    return null;
  }
  const b = 2 * (dx0 * rvx + dy0 * rvy);
  const c = dx0 * dx0 + dy0 * dy0 - rr;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const sqrtDisc = Math.sqrt(disc);
  const t1 = (-b - sqrtDisc) / (2 * a);
  const t2 = (-b + sqrtDisc) / (2 * a);
  if (t1 >= -EPS && t1 <= 1) return Math.max(0, t1);
  if (t2 >= -EPS && t2 <= 1) return Math.max(0, t2);
  return null;
}

// 球与圆形目标（球员/门柱）的扫掠碰撞响应。
// dt 为本帧时间；target 可为静止体（仅 x/y/radius）或运动体（含 prevX/prevY/vx/vy）。
// restitution 为恢复系数，缺省取球自身的恢复系数。
// 返回 true 表示本帧发生了碰撞。
function resolveBallCircle(ball, target, dt, restitution) {
  const frameDt = dt > 0 ? dt : 1;
  const tPrevX = target.prevX !== undefined ? target.prevX : target.x;
  const tPrevY = target.prevY !== undefined ? target.prevY : target.y;
  const rsum = ball.radius + target.radius;

  const t = sweptCircleHit(
    ball.prevX, ball.prevY, ball.x, ball.y,
    tPrevX, tPrevY, target.x, target.y,
    rsum,
  );
  if (t === null) return false;

  // 碰撞瞬间双方位置。
  const ballCx = ball.prevX + (ball.x - ball.prevX) * t;
  const ballCy = ball.prevY + (ball.y - ball.prevY) * t;
  const targetCx = tPrevX + (target.x - tPrevX) * t;
  const targetCy = tPrevY + (target.y - tPrevY) * t;

  // 法线：碰撞中心 -> 球心 的连线方向（球心到球员碰撞中心方向取反，
  // 等价于“球心到碰撞中心”方向用于把球推离；此处取球远离目标的方向）。
  let nx = ballCx - targetCx;
  let ny = ballCy - targetCy;
  let nlen = Math.sqrt(nx * nx + ny * ny);
  if (nlen < EPS) {
    // 圆心恰好重合的退化情况：用相对接近方向的反方向兜底。
    const rvx = (ball.x - ball.prevX) - (target.x - tPrevX);
    const rvy = (ball.y - ball.prevY) - (target.y - tPrevY);
    nlen = Math.sqrt(rvx * rvx + rvy * rvy);
    if (nlen < EPS) { nx = 1; ny = 0; nlen = 1; }
    else { nx = -rvx / nlen; ny = -rvy / nlen; nlen = 1; }
  }
  nx /= nlen;
  ny /= nlen;

  // 位置修正：把球放到恰好接触的位置，并消费掉碰撞后剩余时间的位移，
  // 使高速球不会在帧末停在目标体内或穿过目标。
  const contactX = targetCx + nx * rsum;
  const contactY = targetCy + ny * rsum;

  // 在目标速度参考系下做反射：法向反弹并乘恢复系数，切向保持。
  const tvx = target.vx || 0;
  const tvy = target.vy || 0;
  const rest = restitution !== undefined ? restitution : ball.restitution;
  const relVx = ball.vx - tvx;
  const relVy = ball.vy - tvy;
  const vn = relVx * nx + relVy * ny;

  let newRelVx = relVx;
  let newRelVy = relVy;
  if (vn < 0) {
    const jn = -(1 + rest) * vn;
    newRelVx = relVx + jn * nx;
    newRelVy = relVy + jn * ny;
  }
  const newVx = tvx + newRelVx;
  const newVy = tvy + newRelVy;

  const remaining = Math.max(0, 1 - t);
  ball.x = contactX + newVx * frameDt * remaining;
  ball.y = contactY + newVy * frameDt * remaining;
  ball.prevX = ballCx;
  ball.prevY = ballCy;
  ball.vx = newVx;
  ball.vy = newVy;
  return true;
}

// 球与球员碰撞：扫掠检测 + 中心连线法线 + 恢复系数反射，
// 切向叠加球员速度；并记录最后触球方。
function resolveBallPlayer(ball, player, dt, restitution) {
  const hit = resolveBallCircle(ball, player, dt, restitution);
  if (hit && player.team !== undefined) {
    ball.lastTouch = player;
  }
  return hit;
}

// 球与门柱（圆形静态障碍，可为 {x,y,radius}）碰撞。
function resolveBallPost(ball, post, dt, restitution) {
  return resolveBallCircle(ball, post, dt, restitution);
}

// 球员之间的碰撞：重叠时沿中心连线做位置分离，并修正速度
// （等质量交换法向分量，切向保留），不允许重叠穿插。
function resolvePlayerPlayer(p1, p2) {
  let dx = p2.x - p1.x;
  let dy = p2.y - p1.y;
  let dist = Math.sqrt(dx * dx + dy * dy);
  const rsum = p1.radius + p2.radius;
  if (dist >= rsum) return false;

  let nx;
  let ny;
  if (dist < EPS) {
    nx = 1; ny = 0; dist = 0;
  } else {
    nx = dx / dist;
    ny = dy / dist;
  }

  // 位置分离：各退一半；圆心重合时把 p2 推到右侧。
  const overlap = rsum - dist;
  p1.x -= nx * overlap / 2;
  p1.y -= ny * overlap / 2;
  p2.x += nx * overlap / 2;
  p2.y += ny * overlap / 2;

  // 速度修正：只处理沿法线相互接近的分量，等质量下交换法向速度。
  const rvx = p2.vx - p1.vx;
  const rvy = p2.vy - p1.vy;
  const vn = rvx * nx + rvy * ny;
  if (vn < 0) {
    p1.vx += vn * nx;
    p1.vy += vn * ny;
    p2.vx -= vn * nx;
    p2.vy -= vn * ny;
  }
  return true;
}

// 进球判定：球必须整体越过门线（球的最前沿越过 goal.x），
// 且球整体位于两门柱之间（在门框高度范围内），不能只看球心。
function checkGoal(ball, goal) {
  const crossedLine = ball.x - ball.radius >= goal.x;
  const withinPosts =
    ball.y - ball.radius >= goal.y &&
    ball.y + ball.radius <= goal.y + goal.height;
  const notPastFarSide = ball.x + ball.radius <= goal.x + goal.width + 1e-6;
  return crossedLine && withinPosts && notPastFarSide;
}

// 门柱位置：门框前缘的上下两角。
function getGoalPosts(goal, postRadius = 2) {
  return [
    { x: goal.x, y: goal.y, radius: postRadius },
    { x: goal.x, y: goal.y + goal.height, radius: postRadius },
  ];
}

// 出界判定：球整体离开场地边界。
// bounds: {minX, minY, maxX, maxY} 或 {x, y, width, height}。
// 返回 null（未出界）或 { side, lastTouch, restartTeam }：
// 边线出界由最后触球方的对方掷界外球，判定完全确定、不随机。
function checkOutOfBounds(ball, bounds) {
  const minX = bounds.minX !== undefined ? bounds.minX : bounds.x;
  const minY = bounds.minY !== undefined ? bounds.minY : bounds.y;
  const maxX = bounds.maxX !== undefined ? bounds.maxX : bounds.x + bounds.width;
  const maxY = bounds.maxY !== undefined ? bounds.maxY : bounds.y + bounds.height;

  let side = null;
  if (ball.x + ball.radius < minX) side = 'left';
  else if (ball.x - ball.radius > maxX) side = 'right';
  else if (ball.y + ball.radius < minY) side = 'top';
  else if (ball.y - ball.radius > maxY) side = 'bottom';
  if (!side) return null;

  const lastTouch = ball.lastTouch || null;
  let restartTeam = null;
  if (lastTouch && lastTouch.team !== undefined) {
    restartTeam = lastTouch.team === 0 ? 1 : 0;
  }
  return { side, lastTouch, restartTeam };
}

module.exports = {
  sweptCircleHit,
  resolveBallCircle,
  resolveBallPlayer,
  resolveBallPost,
  resolvePlayerPlayer,
  checkGoal,
  getGoalPosts,
  checkOutOfBounds,
};
