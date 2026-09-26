/** 滑动、碰撞、分数、追逐距离。不依赖画面，方便单独核对规则。 */

export const LANES = [-2.15, 0, 2.15];
export const SWIPE_MIN = 40;
export const JUMP_TIME = 0.7;
export const JUMP_IFRAMES = 0.3;
export const SLIDE_TIME = 0.8;

/** 屏幕坐标：往上划 dy 为负。一次滑动只认主方向。 */
export function swipeDirection(dx, dy, min = SWIPE_MIN) {
  if (Math.abs(dx) < min && Math.abs(dy) < min) return null;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "down" : "up";
}

/** 每连续无伤 50 米，得分 +5%。双倍道具再乘 2。 */
export function scoreMultiplier(cleanMeters, doubleActive) {
  const combo = 1 + 0.05 * Math.floor(Math.max(0, cleanMeters) / 50);
  return combo * (doubleActive ? 2 : 1);
}

export function distancePoints(deltaMeters, cleanMeters, doubleActive) {
  return deltaMeters * scoreMultiplier(cleanMeters, doubleActive);
}

export function coinPoints(cleanMeters, doubleActive) {
  return 10 * scoreMultiplier(cleanMeters, doubleActive);
}

export function shatterPoints(cleanMeters, doubleActive) {
  return 30 * scoreMultiplier(cleanMeters, doubleActive);
}

/** 每 100 米，基础速度 +5%。 */
export function baseSpeed(distance) {
  const steps = Math.max(0, Math.floor(distance / 100));
  return 12 * 1.05 ** steps;
}

/**
 * 无敌盖过普通障碍，盖不过追逐者（追逐者在外面单独判）。
 * 起跳前 0.3 秒有短暂无敌。跳过高的，滑过矮的。木箱不无敌时只是绊一下。
 */
export function resolveHit(moveState, invincible, jumpAge, kind) {
  if (kind === "coin" || kind === "item") return "none";
  if (invincible) return kind === "crate" ? "shatter" : "pass";
  if (moveState === "Jumping" && jumpAge < JUMP_IFRAMES) return "pass";
  if (kind === "high") return moveState === "Jumping" ? "pass" : "dead";
  if (kind === "low") return moveState === "Sliding" ? "pass" : "dead";
  if (kind === "crate") return "stumble";
  if (kind === "fatal" || kind === "pit" || kind === "train") return "dead";
  return "none";
}

export function chaserBand(gap) {
  if (gap <= 0) return "caught";
  if (gap <= 10) return "danger";
  if (gap <= 20) return "warn";
  return "safe";
}
