import { createAudio } from './audio.js';
import { createGame } from './game.js';
import { BOOST_PRICE, JET_PRICE, KEY_PRICE, swipeDirection } from './rules.js';

const audio = createAudio();
const laugh = document.querySelector('#laugh');
const duduLine = document.querySelector('#dudu-line');
const duduName = document.querySelector('#dudu-name');
const noodle = document.querySelector('#noodle');
const taoLine = document.querySelector('#tao-line');
const taoDeath = document.querySelector('#tao-death');
const taoBoost = document.querySelector('#tao-boost');
duduLine.addEventListener('ended', () => {
  if (!shroomTalk) return;
  shroomTalk = false;
  if (!poopLaugh || !playing || noodleTalk) return;
  laugh.loop = true;
  laugh.play()?.catch((error) => console.warn('naiwa.laugh', error));
});
let noodleStop = 0;
let noodleToken = 0;
function finishNoodleLine() {
  if (!noodleTalk) return;
  noodleTalk = false;
  noodle.pause();
  if (!poopLaugh || !playing) return;
  laugh.loop = true;
  laugh.play()?.catch((error) => console.warn('naiwa.laugh', error));
}
noodle.addEventListener('ended', finishNoodleLine);
noodle.addEventListener('timeupdate', () => {
  if (!noodleTalk || !Number.isFinite(noodleStop)) return;
  if (noodle.currentTime > noodleStop + 0.3) return;
  if (noodle.currentTime + 0.05 < noodleStop) return;
  finishNoodleLine();
});
const cast = document.querySelector('#cast');
const castOpenBtn = document.querySelector('#cast-open');
const castCloseBtn = document.querySelector('#cast-close');
const startBtn = document.querySelector('#start');
const againBtn = document.querySelector('#again');
const reviveBtn = document.querySelector('#revive');
const buyBtn = document.querySelector('#buy');
const buyJetBtn = document.querySelector('#buy-jet');
const buyBoostBtn = document.querySelector('#buy-boost');
const useJetBtn = document.querySelector('#use-jet');
const useBoostBtn = document.querySelector('#use-boost');
const shopOpenBtn = document.querySelector('#shop-open');
const store = document.querySelector('#store');
const storeCloseBtn = document.querySelector('#store-close');
const walletLine = document.querySelector('#wallet');
const buyNote = document.querySelector('#buy-note');
const jetNote = document.querySelector('#jet-note');
const boostNote = document.querySelector('#boost-note');
const vignette = document.querySelector('#vignette');

const titles = {
  caught: '被后面那只奶蛙抓住了',
  pit: '掉进深坑了',
  hit: '撞上了',
  train: '被火车撞了',
};

function paintShop() {
  const pocket = game.wallet();
  walletLine.textContent = `金币 ${pocket.coins} · 钥匙 ${pocket.keys} · 飞行 ${pocket.jets} · 加速 ${pocket.boosts}`;
  const keyEnough = pocket.coins >= KEY_PRICE;
  const jetEnough = pocket.coins >= JET_PRICE;
  const boostEnough = pocket.coins >= BOOST_PRICE;
  buyBtn.disabled = !keyEnough;
  buyJetBtn.disabled = !jetEnough;
  buyBoostBtn.disabled = !boostEnough;
  buyNote.textContent = keyEnough ? '' : '金币不够';
  jetNote.textContent = jetEnough ? '' : '金币不够';
  boostNote.textContent = boostEnough ? '' : '金币不够';
  useJetBtn.textContent = `飞行 ${pocket.jets}`;
  useJetBtn.classList.toggle('on', playing && pocket.jets > 0);
  useBoostBtn.textContent = `话筒 ${pocket.boosts}`;
  useBoostBtn.classList.toggle('on', playing && game.hero() === 'tao' && pocket.boosts > 0);
}

function paintCast() {
  const current = game.hero();
  document.querySelectorAll('#cast .pick').forEach((button) => {
    button.classList.toggle('on', button.dataset.hero === current);
  });
  const lines = {
    dudu: '点一下开始。先听一遍「你的胆子真是肥嘟嘟的」，再自己开跑。',
    tao: '点一下开始。先听一遍「老板给我来碗忘情牛肉面」，再自己开跑。',
    frog: '点一下开始。奶蛙对着你笑完，就自己开跑。',
  };
  document.querySelector('#blurb').textContent = lines[current] || lines.frog;
}

function silenceVoices() {
  laugh.loop = false;
  laugh.pause();
  duduLine.pause();
  duduName.pause();
  noodle.pause();
  taoLine.pause();
  taoDeath.pause();
  taoBoost.pause();
}

function signatureOf(hero) {
  if (hero === 'dudu') return duduLine;
  if (hero === 'tao') return taoLine;
  return laugh;
}

function playSignature(hero) {
  stopChuckle();
  silenceVoices();
  const voice = signatureOf(hero);
  voice.loop = false;
  try {
    voice.currentTime = 0;
    const pending = voice.play();
    if (pending && typeof pending.catch === 'function') pending.catch((error) => console.warn('naiwa.voice', error));
  } catch (error) {
    console.warn('naiwa.voice', error);
  }
  if (voice === laugh) wireLaugh();
}

function openStore() {
  paintShop();
  store.classList.add('open');
}

function closeStore() {
  store.classList.remove('open');
}

let analyser = null;
let wave = null;
let audioCtx = null;
let pointer = null;
let lastTap = 0;
let playing = false;
let laughing = false;
let armed = false;
let poopLaugh = false;
let shroomTalk = false;
let noodleTalk = false;
let chuckleTimer = 0;

function stopChuckle() {
  if (!chuckleTimer) return;
  clearTimeout(chuckleTimer);
  chuckleTimer = 0;
}

function laughLevel() {
  if (!analyser || !wave) return 0;
  analyser.getByteTimeDomainData(wave);
  let sum = 0;
  for (let i = 0; i < wave.length; i += 1) {
    const x = (wave[i] - 128) / 128;
    sum += x * x;
  }
  return Math.min(1, Math.sqrt(sum / wave.length) * 3.2);
}

function wireLaugh() {
  audio.unlock()?.catch((error) => console.warn('naiwa.audio', error));
  if (!audioCtx) {
    audioCtx = new AudioContext();
    const source = audioCtx.createMediaElementSource(laugh);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    wave = new Uint8Array(analyser.fftSize);
    source.connect(analyser);
    analyser.connect(audioCtx.destination);
  }
  if (audioCtx.state !== 'running') audioCtx.resume();
}

const game = createGame(document.querySelector('#view'), {
  audio,
  laughLevel,
  onReady() {
    startBtn.disabled = false;
    startBtn.textContent = '开始';
    paintShop();
    paintCast();
  },
  onLaughEnd() {
    finishIntro();
  },
  onHud(hud) {
    document.querySelector('#score').textContent = String(hud.score);
    const combo = hud.combo > 1.001 ? ` · 连击 x${hud.combo.toFixed(2)}` : '';
    document.querySelector('#meta').textContent = `${hud.distance} 米 · 金币 ${hud.coins}${combo}`;
    const chase = document.querySelector('#chase');
    chase.textContent = `追击 ${Math.max(0, hud.gap).toFixed(0)} 米`;
    chase.className = hud.mood === 'safe' ? '' : hud.mood;
    const danger = hud.mood === 'danger' ? '0.72' : hud.mood === 'warn' ? '0.28' : '0';
    vignette.style.setProperty('--danger', danger);
    document.querySelector('#pills').innerHTML = hud.effects
      .map((effect) => `<span class="pill">${effect.t > 0 ? `${effect.name} ${effect.t.toFixed(0)}s` : effect.name}</span>`)
      .join('');
    if (reviveBtn) reviveBtn.textContent = hud.keys > 0 ? `用钥匙复活（${hud.keys}）` : '没有钥匙';
    useJetBtn.textContent = `飞行 ${hud.jets}`;
    useJetBtn.classList.toggle('on', playing && hud.jets > 0);
    useBoostBtn.textContent = `话筒 ${hud.boosts}`;
    useBoostBtn.classList.toggle('on', playing && hud.hero === 'tao' && hud.boosts > 0);
  },
  onChuckle() {
    if (shroomTalk || noodleTalk || game.hero() === 'tao') return;
    stopChuckle();
    if (game.hero() === 'dudu') {
      laugh.pause();
      try {
        duduName.currentTime = 0;
        const pending = duduName.play();
        if (pending && typeof pending.catch === 'function') pending.catch((error) => console.warn('naiwa.dudu', error));
      } catch (error) {
        console.warn('naiwa.dudu', error);
      }
      return;
    }
    laugh.loop = false;
    try {
      laugh.currentTime = 0;
      const pending = laugh.play();
      if (pending && typeof pending.catch === 'function') pending.catch((error) => console.warn('naiwa.laugh', error));
    } catch (error) {
      console.warn('naiwa.laugh', error);
    }
    chuckleTimer = setTimeout(() => {
      chuckleTimer = 0;
      if (poopLaugh) {
        laugh.loop = true;
        if (laugh.paused) laugh.play()?.catch((error) => console.warn('naiwa.laugh', error));
        return;
      }
      laugh.pause();
    }, 500);
  },
  onNoodle(clip) {
    const line = clip || { src: 'assets/noodle.m4a', start: 0, end: 3.75 };
    noodleTalk = true;
    noodleStop = Number.POSITIVE_INFINITY;
    shroomTalk = false;
    laugh.pause();
    duduLine.pause();
    duduName.pause();
    noodle.loop = false;
    const token = ++noodleToken;
    const start = () => {
      if (token !== noodleToken) return;
      noodleStop = line.end;
      try {
        noodle.currentTime = line.start;
      } catch (error) {
        console.warn('naiwa.noodle', error);
      }
      const pending = noodle.play();
      if (pending && typeof pending.catch === 'function') pending.catch((error) => console.warn('naiwa.noodle', error));
    };
    const file = line.src;
    if (!String(noodle.src || '').endsWith(file)) {
      noodle.src = file;
      noodle.addEventListener('loadeddata', start, { once: true });
      noodle.load();
      return;
    }
    start();
  },
  onShroom() {
    shroomTalk = true;
    laugh.pause();
    duduName.pause();
    duduLine.loop = false;
    try {
      duduLine.currentTime = 0;
      const pending = duduLine.play();
      if (pending && typeof pending.catch === 'function') pending.catch((error) => console.warn('naiwa.dudu', error));
    } catch (error) {
      console.warn('naiwa.dudu', error);
    }
  },
  onPoop(active) {
    poopLaugh = active;
    laugh.loop = active;
    if (!active) {
      if (!shroomTalk && !noodleTalk) laugh.pause();
      return;
    }
    if (shroomTalk || noodleTalk) return;
    try {
      laugh.currentTime = 0;
      const pending = laugh.play();
      if (pending && typeof pending.catch === 'function') pending.catch((error) => console.warn('naiwa.laugh', error));
    } catch (error) {
      console.warn('naiwa.laugh', error);
    }
    wireLaugh();
  },
  onDeath() {
    stopChuckle();
    poopLaugh = false;
    shroomTalk = false;
    noodleTalk = false;
    silenceVoices();
    playing = false;
    document.body.classList.remove('live', 'over', 'intro');
    document.body.classList.add('ending');
    useJetBtn.classList.remove('on');
    useBoostBtn.classList.remove('on');
  },
  onDeathLaugh() {
    const hero = game.hero();
    const voice = hero === 'dudu' ? duduLine : hero === 'tao' ? taoDeath : laugh;
    laugh.loop = false;
    try {
      silenceVoices();
      voice.currentTime = 0;
      const pending = voice.play();
      if (pending && typeof pending.catch === 'function') pending.catch((error) => console.warn('naiwa.laugh', error));
    } catch (error) {
      console.warn('naiwa.laugh', error);
    }
    if (voice === laugh) wireLaugh();
  },
  onOver(info) {
    playing = false;
    silenceVoices();
    document.body.classList.remove('live', 'ending', 'intro');
    document.body.classList.add('over');
    document.querySelector('#over-title').textContent = titles[info.reason] || '这局结束了';
    document.querySelector('#over-score').textContent = `${info.score} 分`;
    document.querySelector('#over-meta').textContent = `跑了 ${info.distance} 米 · 金币 ${info.coins}`;
    document.querySelector('#best-flag').textContent = info.isBest ? '新纪录！' : `最高分 ${info.best}`;
    if (reviveBtn) {
      reviveBtn.disabled = !(info.keys > 0);
      reviveBtn.textContent = info.keys > 0 ? `用钥匙复活（${info.keys}）` : '没有钥匙';
    }
  },
});

paintShop();
paintCast();

function startIntro() {
  if (laughing || playing || armed) return;
  armed = true;
  laughing = true;
  document.body.classList.remove('over', 'live');
  document.body.classList.add('intro');
  closeStore();
  cast.classList.remove('open');
  const voice = signatureOf(game.hero());
  try {
    silenceVoices();
    voice.currentTime = 0;
    const pending = voice.play();
    if (pending && typeof pending.catch === 'function') pending.catch((error) => console.warn('naiwa.laugh', error));
  } catch (error) {
    console.warn('naiwa.laugh', error);
  }
  if (voice === laugh) wireLaugh();
  const duration = Number.isFinite(voice.duration) && voice.duration > 0.4
    ? voice.duration
    : game.hero() === 'dudu' ? 2.1 : game.hero() === 'tao' ? 3.75 : 6.1;
  game.playLaugh(duration);
}

function finishIntro() {
  if (!armed) return;
  armed = false;
  laughing = false;
  begin();
}

function begin() {
  audio.unlock()?.catch((error) => console.warn('naiwa.audio', error));
  silenceVoices();
  document.body.classList.remove('over', 'intro', 'ending');
  document.body.classList.add('live');
  closeStore();
  playing = true;
  game.start();
}

window.addEventListener('pointerdown', (event) => {
  if (event.target instanceof Element && event.target.closest('button')) return;
  if (!playing) return;
  const now = performance.now();
  if (now - lastTap < 280) game.skate();
  lastTap = now;
  audio.unlock()?.catch((error) => console.warn('naiwa.audio', error));
  pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, fired: false };
  if (event.target instanceof Element && event.target.setPointerCapture) {
    try {
      event.target.setPointerCapture(event.pointerId);
    } catch (error) {
      console.warn('naiwa.pointer', error);
    }
  }
});

window.addEventListener('pointermove', (event) => {
  if (!pointer || event.pointerId !== pointer.id || pointer.fired || !playing) return;
  const dir = swipeDirection(event.clientX - pointer.x, event.clientY - pointer.y, 28);
  if (!dir) return;
  pointer.fired = true;
  game.swipe(dir);
});

window.addEventListener('pointerup', (event) => {
  if (pointer && event.pointerId === pointer.id) pointer = null;
});

window.addEventListener('pointercancel', () => {
  pointer = null;
});

startBtn.addEventListener('click', startIntro);
castOpenBtn.addEventListener('click', () => {
  paintCast();
  cast.classList.add('open');
});
castCloseBtn.addEventListener('click', () => cast.classList.remove('open'));
cast.addEventListener('click', (event) => {
  if (event.target === cast) cast.classList.remove('open');
});
document.querySelectorAll('#cast .pick').forEach((button) => {
  button.addEventListener('click', () => {
    const next = button.dataset.hero;
    if (next === game.hero()) return;
    game.setHero(next);
    paintCast();
    playSignature(next);
  });
});
shopOpenBtn.addEventListener('click', openStore);
storeCloseBtn.addEventListener('click', closeStore);
store.addEventListener('click', (event) => {
  if (event.target === store) closeStore();
});
buyBtn.addEventListener('click', () => {
  game.buyKey();
  paintShop();
});
buyJetBtn.addEventListener('click', () => {
  game.buyJet();
  paintShop();
});
buyBoostBtn.addEventListener('click', () => {
  game.buyBoost();
  paintShop();
});
useJetBtn.addEventListener('click', () => {
  if (!game.useJet()) return;
  paintShop();
});
useBoostBtn.addEventListener('click', () => {
  const dur = Number.isFinite(taoBoost.duration) && taoBoost.duration > 0.4 ? taoBoost.duration : 8.6;
  if (!game.useBoost(dur)) return;
  laugh.pause();
  duduLine.pause();
  duduName.pause();
  noodle.pause();
  noodleTalk = false;
  taoLine.pause();
  taoDeath.pause();
  taoBoost.loop = false;
  try {
    taoBoost.currentTime = 0;
    const pending = taoBoost.play();
    if (pending && typeof pending.catch === 'function') pending.catch((error) => console.warn('naiwa.boost', error));
  } catch (error) {
    console.warn('naiwa.boost', error);
  }
  paintShop();
});
againBtn.addEventListener('click', begin);
reviveBtn.addEventListener('click', () => {
  if (!game.revive()) return;
  document.body.classList.remove('over');
  document.body.classList.add('live');
  playing = true;
});
