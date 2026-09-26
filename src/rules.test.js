import assert from 'node:assert/strict';
import test from 'node:test';
import {
  baseSpeed,
  buyKey,
  chaserMood,
  comboMultiplier,
  minSpacing,
  itemDuration,
  resolveCollision,
  rollItem,
  stepChaser,
  swipeDirection,
} from './rules.js';

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

test('开局更快，障碍更密', () => {
  assert.equal(baseSpeed(0), 14.5);
  assert.ok(baseSpeed(80) > baseSpeed(0));
  assert.ok(minSpacing(baseSpeed(0), 0) < 12);
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

test('200 金币换一把钥匙，便便会经常被抽到', () => {
  assert.deepEqual(buyKey(200, 0), { coins: 0, keys: 1, ok: true });
  let n = 0;
  const rand = () => {
    n += 0.17;
    return n % 1;
  };
  let poops = 0;
  for (let i = 0; i < 40; i += 1) if (rollItem(0, rand) === 'poop') poops += 1;
  assert.ok(poops >= 8, `expected poop often, got ${poops}`);
  assert.equal(itemDuration('shroom'), 6);
  assert.equal(itemDuration('noodle'), 4.6);
  assert.equal(rollItem(0, () => 0.8), 'shroom');
  assert.equal(rollItem(0, () => 0.99), 'noodle');
});
