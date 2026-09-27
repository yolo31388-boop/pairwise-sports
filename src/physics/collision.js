
export function resolveBallPlayer(ball, player) {
  // BUG: 点-圆检测，没有扫掠
  const dx = ball.x - player.x;
  const dy = ball.y - player.y;
  const dist = Math.sqrt(dx*dx + dy*dy);
  if (dist < ball.radius + player.radius) {
    // BUG: 法线用移动方向
    ball.vx = -ball.vx * 0.8;
    ball.vy = -ball.vy * 0.8;
  }
}

export function checkGoal(ball, goal) {
  // BUG: 只看球心
  return ball.x > goal.x && ball.x < goal.x + goal.width &&
         ball.y > goal.y && ball.y < goal.y + goal.height;
}

module.exports = { resolveBallPlayer, checkGoal };
