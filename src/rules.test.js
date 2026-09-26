import assert from 'node:assert/strict';
import test from 'node:test';
import {
  baseSpeed,
  coverDistance,
  buyKey,
  chaserMood,
  comboMultiplier,
  minSpacing,
  itemDuration,
  BOOST_PRICE,
  JET_PRICE,
  SCOOTER_PRICE,
  SCOOTER_TIME,
  resolveCollision,
  rollItem,
  stepChaser,
  swipeDirection,
} from './rules.js';

test('飞行 300，加速话筒 500', () => {
  assert.equal(JET_PRICE, 300);
  assert.equal(BOOST_PRICE, 500);
  assert.equal(SCOOTER_PRICE, 300);
  assert.equal(SCOOTER_TIME, 20);
  assert.equal(buyKey(500, 0, BOOST_PRICE).ok, true);
  assert.equal(buyKey(300, 0, SCOOTER_PRICE).ok, true);
  assert.equal(buyKey(299, 0, JET_PRICE).ok, false);
});

test('短滑动不触发，上滑是 up', () => {
  assert.equal(swipeDirection(8, -10), null);
  assert.equal(swipeDirection(10, -48), 'up');
  assert.equal(swipeDirection(-50, 8), 'left');
  assert.equal(swipeDirection(50, -8), 'right');
  assert.equal(swipeDirection(6, 55), 'down');
});

test('无伤每 50 米加 5%', () => {
  assert.equal(comboMultiplier(49), 1);
  assert.ok(Math.abs(comboMultiplier(50) - 1.05) < 1e-9);
});

test('开局更快，后面不再突然窜', () => {
  assert.equal(baseSpeed(0), 18);
  assert.ok(baseSpeed(80) > baseSpeed(0));
  assert.ok(minSpacing(baseSpeed(0), 0) < 16);
  assert.ok(baseSpeed(4000) < 29);
  assert.ok(baseSpeed(480) - baseSpeed(400) < baseSpeed(80) - baseSpeed(0));
});

test('跳跃能过高栏，第一次撞箱子只绊倒', () => {
  const running = { mode: 'running', inv: 0, iframes: 0 };
  const jumping = { mode: 'jumping', inv: 0, iframes: 0 };
  assert.equal(resolveCollision(running, 'high'), 'stumble');
  assert.equal(resolveCollision(jumping, 'high'), 'pass');
  assert.equal(resolveCollision(running, 'oncoming'), 'dead');
  assert.equal(resolveCollision(jumping, 'pit'), 'pass');
  assert.equal(resolveCollision(running, 'crate'), 'stumble');
});

test('追逐者会更快贴上来', () => {
  assert.equal(chaserMood(0), 'caught');
  let gap = 12;
  let speed = 14.5;
  for (let i = 0; i < 20; i += 1) {
    const next = stepChaser(gap, speed, 0.1, 8, 200, { sprint: false, smoked: false, cruise: 14.5 });
    gap = next.gap;
    speed = next.speed;
  }
  assert.ok(gap < 10, `gap should close, got ${gap}`);
});

test('200 金币换一把钥匙，便便和蘑菇不再老是抽到', () => {
  assert.deepEqual(buyKey(200, 0), { coins: 0, keys: 1, ok: true });
  let n = 0;
  const rand = () => {
    n += 0.17;
    return n % 1;
  };
  let rare = 0;
  for (let i = 0; i < 40; i += 1) {
    const item = rollItem(0, rand);
    if (item === 'poop' || item === 'shroom' || item === 'noodle') rare += 1;
  }
  assert.ok(rare <= 8, `expected rare items seldom, got ${rare}`);
  assert.equal(itemDuration('shroom'), 6);
  const sung = coverDistance(108, 3.75) - 108;
  assert.ok(sung > 65 && sung < 85, `white bowl gap ${sung}`);
});
