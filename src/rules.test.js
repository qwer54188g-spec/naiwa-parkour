import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  baseSpeed,
  chaserBand,
  coinPoints,
  distancePoints,
  resolveHit,
  scoreMultiplier,
  swipeDirection,
} from "./rules.js";

describe("滑动", () => {
  it("没滑够距离就不触发", () => {
    assert.equal(swipeDirection(10, 12), null);
  });

  it("横着滑得更远就换道", () => {
    assert.equal(swipeDirection(48, 10), "right");
    assert.equal(swipeDirection(-48, 8), "left");
  });

  it("竖着滑得更远就跳或钻", () => {
    assert.equal(swipeDirection(4, -55), "up");
    assert.equal(swipeDirection(6, 55), "down");
  });
});

describe("分数", () => {
  it("刚开跑是一倍", () => {
    assert.equal(scoreMultiplier(0, false), 1);
  });

  it("每无伤 50 米加 5%", () => {
    assert.equal(scoreMultiplier(49, false), 1);
    assert.equal(scoreMultiplier(50, false), 1.05);
    assert.equal(scoreMultiplier(100, false), 1.1);
  });

  it("双倍道具叠在连击上", () => {
    assert.equal(scoreMultiplier(50, true), 2.1);
  });

  it("跑过的米数和金币按当前倍率加分", () => {
    assert.equal(distancePoints(2, 50, false), 2.1);
    assert.equal(coinPoints(0, false), 10);
    assert.equal(coinPoints(0, true), 20);
  });
});

describe("碰撞", () => {
  it("跑着撞上高栏、低栏、石头、坑、火车都会结束", () => {
    for (const kind of ["high", "low", "fatal", "pit", "train"]) {
      assert.equal(resolveHit("Running", false, 0, kind), "dead");
    }
  });

  it("跳起来过得了高栏，钻过去过得了低栏", () => {
    assert.equal(resolveHit("Jumping", false, 0.4, "high"), "pass");
    assert.equal(resolveHit("Sliding", false, 0, "low"), "pass");
  });

  it("起跳最初 0.3 秒撞石头也没事", () => {
    assert.equal(resolveHit("Jumping", false, 0.2, "fatal"), "pass");
    assert.equal(resolveHit("Jumping", false, 0.4, "fatal"), "dead");
  });

  it("木箱平时只绊一下，无敌时撞碎", () => {
    assert.equal(resolveHit("Running", false, 0, "crate"), "stumble");
    assert.equal(resolveHit("Running", true, 0, "crate"), "shatter");
  });

  it("无敌能穿过普通障碍", () => {
    assert.equal(resolveHit("Running", true, 0, "train"), "pass");
    assert.equal(resolveHit("Running", true, 0, "pit"), "pass");
  });
});

describe("追逐和速度", () => {
  it("贴得越近警告越重", () => {
    assert.equal(chaserBand(21), "safe");
    assert.equal(chaserBand(16), "warn");
    assert.equal(chaserBand(6), "danger");
    assert.equal(chaserBand(0), "caught");
  });

  it("每 100 米基础速度提高 5%", () => {
    assert.equal(baseSpeed(0), 12);
    assert.equal(baseSpeed(100), 12 * 1.05);
    assert.equal(baseSpeed(200), 12 * 1.05 ** 2);
  });
});
