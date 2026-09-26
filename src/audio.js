function tone(ctx, freq, dur, type, gainValue, slideTo) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), ctx.currentTime + dur);
  gain.gain.setValueAtTime(gainValue, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + dur + 0.02);
}

/** 操作音效用合成器。大笑只用视频里的原声。 */
export function createAudio() {
  let ctx = null;
  let noise = null;

  function ac() {
    if (!ctx) ctx = new AudioContext();
    return ctx;
  }

  function burst(duration, gainValue) {
    const context = ac();
    if (!noise) {
      const length = context.sampleRate;
      noise = context.createBuffer(1, length, context.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    }
    const src = context.createBufferSource();
    src.buffer = noise;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    const gain = context.createGain();
    gain.gain.setValueAtTime(gainValue, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);
    src.start();
    src.stop(context.currentTime + duration);
  }

  return {
    unlock() {
      const context = ac();
      if (context.state === 'running') return Promise.resolve();
      return context.resume();
    },
    jump() {
      tone(ac(), 380, 0.14, 'sine', 0.045, 760);
    },
    slide() {
      tone(ac(), 220, 0.12, 'triangle', 0.04, 90);
    },
    coin() {
      tone(ac(), 880, 0.08, 'sine', 0.04, 1320);
    },
    power() {
      tone(ac(), 520, 0.18, 'triangle', 0.05, 880);
    },
    stumble() {
      burst(0.18, 0.05);
    },
    shatter() {
      tone(ac(), 180, 0.12, 'square', 0.03, 70);
    },
    die() {
      tone(ac(), 320, 0.35, 'sawtooth', 0.04, 60);
    },
    heartbeat() {
      tone(ac(), 58, 0.12, 'sine', 0.06);
    },
  };
}
