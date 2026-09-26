/** 车道中心。奶蛙很宽，车道间距要留得开。 */
export const LANES = [-3.35, 0, 3.35];

export const SWIPE_MIN = 40;
export const JUMP_TIME = 0.7;
export const JUMP_IFRAME = 0.3;
export const SLIDE_TIME = 0.8;

/**
 * 一次滑动只认主导方向。屏幕坐标向下为正，所以上滑的 dy 是负数。
 * 不够长就当没滑，避免误触。
 */
export function swipeDirection(dx, dy, min = SWIPE_MIN) {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (Math.hypot(dx, dy) < min) return null;
  if (ay >= ax * 0.72) return dy > 0 ? 'down' : 'up';
  return dx > 0 ? 'right' : 'left';
}

export function clampLane(index) {
  return Math.max(0, Math.min(2, index));
}

/** 连续无伤每 50 米 +5%。50 米整开始算第一档。 */
export function comboMultiplier(cleanMeters) {
  const steps = Math.floor(Math.max(0, cleanMeters) / 50);
  return 1 + steps * 0.05;
}

/** 开局就比原来快，之后每 80 米再加快一档。 */
export function baseSpeed(distance) {
  const steps = Math.floor(Math.max(0, distance) / 80);
  return 14.5 * 1.08 ** steps;
}

/** 按这一碗所在位置的跑速，唱完 seconds 秒大概能跑多远。 */
export function coverDistance(start, seconds) {
  return Math.max(0, start) + baseSpeed(start) * Math.max(0, seconds);
}

/** 障碍间距随距离变密，但始终留得下一次跳跃的反应时间。 */
export function minSpacing(speed, distance) {
  const reaction = 0.8 - Math.min(Math.max(distance, 0) / 900, 1) * 0.22;
  return Math.max(8.2, speed * reaction);
}

/**
 * 碰撞结果。轻撞只绊一下，第二次才算被追上。跳起过高的、铲过矮的、飞着的都不算撞。
 * @returns {'pass'|'shatter'|'stumble'|'dead'}
 */
export function resolveCollision(player, kind) {
  const star = player.inv > 0 || player.fly > 0;
  const feet = player.feet ?? 0;
  const airborne = player.mode === 'jumping' || player.fly > 0 || feet > 0.45;
  if (kind === 'pit') {
    if (star || airborne) return 'pass';
    return 'dead';
  }
  if (kind === 'oncoming') {
    if (star || airborne || player.mode === 'sliding') return 'pass';
    return 'dead';
  }
  if (kind === 'low') {
    if (star || player.mode === 'sliding' || airborne) return 'pass';
    return 'stumble';
  }
  if (kind === 'crate') {
    if (airborne) return 'pass';
    if (player.inv > 0) return 'shatter';
    return 'stumble';
  }
  if (airborne || star) return 'pass';
  return 'stumble';
}

/** >20 安全，10–20 警告，0–10 危险，≤0 被抓住。 */
export function chaserMood(gap) {
  if (gap <= 0) return 'caught';
  if (gap <= 10) return 'danger';
  if (gap <= 20) return 'warn';
  return 'safe';
}

export function stepChaser(gap, speed, dt, playerSpeed, distance, options) {
  const pressure = Math.min(Math.max(distance, 0) / 700, 1);
  const targetGap = 11 - pressure * 6;
  const cruise = options.cruise ?? playerSpeed;
  const slow = Math.max(0, cruise - playerSpeed);
  let desired = playerSpeed + slow * 0.85 + (gap - targetGap) * 0.55;
  if (options.sprint) desired += 5;
  if (options.smoked) desired = Math.min(desired, playerSpeed * 0.82);
  const accel = options.smoked ? 3 : 8.5;
  const delta = Math.max(-accel * dt, Math.min(accel * dt, desired - speed));
  const nextSpeed = Math.max(0, speed + delta);
  let nextGap = gap + (playerSpeed - nextSpeed) * dt;
  if (nextGap < 0) nextGap = 0;
  return { gap: nextGap, speed: nextSpeed };
}

export const KEY_PRICE = 200;
export const JET_PRICE = 300;
export const BOOST_PRICE = 500;

/** 金币够就扣掉，换一把钥匙。不够则原样返回。 */
export function buyKey(coins, keys, price = KEY_PRICE) {
  const wallet = Math.max(0, Math.floor(coins));
  const owned = Math.max(0, Math.floor(keys));
  if (wallet < price) return { coins: wallet, keys: owned, ok: false };
  return { coins: wallet - price, keys: owned + 1, ok: true };
}

const ITEM_TABLE = [
  ['magnet', 22],
  ['shoes', 14],
  ['star', 8],
  ['smoke', 8],
  ['double', 8],
  ['jet', 8],
  ['key', 6],
  ['chest', 8],
  ['poop', 6],
  ['shroom', 5],
];

/** 后程稀有道具权重下降。rand 返回 [0,1)。便便和蘑菇只是偶尔出现。 */
export function rollItem(distance, rand) {
  const late = Math.min(Math.max(distance, 0) / 500, 1);
  const weights = ITEM_TABLE.map(([name, weight]) => {
    if (name === 'star' || name === 'smoke') return [name, weight * (1 - late * 0.35)];
    if (name === 'double') return [name, weight * (1 - late * 0.5)];
    return [name, weight];
  });
  const total = weights.reduce((sum, entry) => sum + entry[1], 0);
  let cursor = rand() * total;
  for (const [name, weight] of weights) {
    cursor -= weight;
    if (cursor <= 0) return name;
  }
  return 'magnet';
}

export function itemDuration(name) {
  if (name === 'magnet') return 8;
  if (name === 'shoes') return 6;
  if (name === 'star') return 5;
  if (name === 'smoke') return 4;
  if (name === 'double') return 10;
  if (name === 'jet') return 6;
  if (name === 'poop') return 6.1;
  if (name === 'shroom') return 6;
  if (name === 'noodle') return 4.6;
  return 0;
}
