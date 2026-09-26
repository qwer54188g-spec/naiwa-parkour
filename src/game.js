import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  LANES,
  baseSpeed,
  coverDistance,
  chaserMood,
  clampLane,
  BOOST_PRICE,
  JET_PRICE,
  buyKey,
  comboMultiplier,
  itemDuration,
  minSpacing,
  resolveCollision,
  rollItem,
  stepChaser,
} from './rules.js';

/** 白碗是原来那段。后面两段音频按顺序，每两句一碗红碗。下一碗比这两句唱完再远一点点。 */
const LYRIC_CLIPS = [
  { src: 'assets/noodle.m4a', start: 0, end: 3.75, red: false },
  { src: 'assets/lyric-a.m4a', start: 0, end: 7.8, red: true },
  { src: 'assets/lyric-a.m4a', start: 7.8, end: 15, red: true },
  { src: 'assets/lyric-a.m4a', start: 15, end: 22.6, red: true },
  { src: 'assets/lyric-a.m4a', start: 22.6, end: 29.2, red: true },
  { src: 'assets/lyric-a.m4a', start: 29.2, end: 33.13, red: true },
  { src: 'assets/lyric-b.m4a', start: 0, end: 7.3, red: true },
  { src: 'assets/lyric-b.m4a', start: 7.3, end: 14.6, red: true },
  { src: 'assets/lyric-b.m4a', start: 14.6, end: 22, red: true },
  { src: 'assets/lyric-b.m4a', start: 22, end: 29.3, red: true },
  { src: 'assets/lyric-b.m4a', start: 29.3, end: 36.6, red: true },
  { src: 'assets/lyric-b.m4a', start: 36.6, end: 43.97, red: true },
];

function lyricStops() {
  let z = 108;
  return LYRIC_CLIPS.map((clip) => {
    const stop = { ...clip, z };
    const ahead = coverDistance(z, clip.end - clip.start) - z;
    z += ahead * 1.05;
    return stop;
  });
}

const LYRIC_STOPS = lyricStops();

const BEST_KEY = 'naiwa-best';
const KEY_KEY = 'naiwa-keys';
const COIN_KEY = 'naiwa-coins';
const HERO_KEY = 'naiwa-hero';
const JET_KEY = 'naiwa-jets';
const BOOST_KEY = 'naiwa-boosts';

function readBest() {
  try {
    const value = Number(localStorage.getItem(BEST_KEY) || 0);
    return Number.isFinite(value) ? value : 0;
  } catch (error) {
    console.warn('naiwa.best', error);
    return 0;
  }
}

function readKeys() {
  try {
    const value = Number(localStorage.getItem(KEY_KEY) || 0);
    return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  } catch (error) {
    console.warn('naiwa.keys', error);
    return 0;
  }
}

function writeKeys(count) {
  try {
    localStorage.setItem(KEY_KEY, String(Math.max(0, Math.floor(count))));
  } catch (error) {
    console.warn('naiwa.keys', error);
  }
}

function readCoins() {
  try {
    const value = Number(localStorage.getItem(COIN_KEY) || 0);
    return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  } catch (error) {
    console.warn('naiwa.coins', error);
    return 0;
  }
}

function readJets() {
  try {
    const value = Number(localStorage.getItem(JET_KEY) || 0);
    return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  } catch (error) {
    console.warn('naiwa.jets', error);
    return 0;
  }
}

function writeJets(count) {
  try {
    localStorage.setItem(JET_KEY, String(Math.max(0, Math.floor(count))));
  } catch (error) {
    console.warn('naiwa.jets', error);
  }
}

function readBoosts() {
  try {
    const value = Number(localStorage.getItem(BOOST_KEY) || 0);
    return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  } catch (error) {
    console.warn('naiwa.boosts', error);
    return 0;
  }
}

function writeBoosts(count) {
  try {
    localStorage.setItem(BOOST_KEY, String(Math.max(0, Math.floor(count))));
  } catch (error) {
    console.warn('naiwa.boosts', error);
  }
}

function ensureMicGift() {
  try {
    if (localStorage.getItem('naiwa-mic-gift') === '1') return;
    writeBoosts(readBoosts() + 1);
    localStorage.setItem('naiwa-mic-gift', '1');
  } catch (error) {
    console.warn('naiwa.mic', error);
  }
}

ensureMicGift();

function normalizeHero(id) {
  if (id === 'dudu' || id === 'tao') return id;
  return 'frog';
}

function writeCoins(count) {
  try {
    localStorage.setItem(COIN_KEY, String(Math.max(0, Math.floor(count))));
  } catch (error) {
    console.warn('naiwa.coins', error);
  }
}

function readHero() {
  try {
    return normalizeHero(localStorage.getItem(HERO_KEY));
  } catch (error) {
    console.warn('naiwa.hero', error);
    return 'frog';
  }
}

function writeHero(id) {
  try {
    localStorage.setItem(HERO_KEY, normalizeHero(id));
  } catch (error) {
    console.warn('naiwa.hero', error);
  }
}

function writeBest(score) {
  try {
    localStorage.setItem(BEST_KEY, String(Math.floor(score)));
  } catch (error) {
    console.warn('naiwa.best', error);
  }
}

function mat(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0, ...extra });
}

function buildMesh(type) {
  if (type === 'high-all') return wall(true);
  if (type === 'high-lane') return wall(false);
  if (type === 'low-all') return arch(true);
  if (type === 'low-lane') return arch(false);
  if (type === 'arch') return arch(false);
  if (type === 'block') return rock();
  if (type === 'truck') return truck();
  if (type === 'train') return carriage(0, false);
  if (type === 'train2') return carriage(1, false);
  if (type === 'train3') return carriage(2, false);
  if (type === 'oncoming') return carriage(0, true);
  if (type === 'oncoming2') return carriage(1, true);
  if (type === 'oncoming3') return carriage(2, true);
  if (type === 'ramp') return wedge();
  if (type === 'jet') return gem('#7a5cff');
  if (type === 'key') return gem('#f4f1ea');
  if (type === 'chest') return box(0.72, 0.5, 0.72, '#e0a030', 0.55);
  if (type === 'poop') return poop();
  if (type === 'shroom') return mushroom();
  if (type === 'noodle') return noodleBowl(false);
  if (type === 'noodle-red') return noodleBowl(true);
  if (type === 'pit') return pit();
  if (type === 'crate') return plankCrate();
  if (type === 'coin') return coin();
  if (type === 'magnet') return gem('#3d7dff');
  if (type === 'shoes') return gem('#ff5a36');
  if (type === 'star') return gem('#ffe14a');
  if (type === 'smoke') return gem('#6b6280');
  return gem('#3ecf6e');
}

function box(w, h, d, color, y) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  mesh.position.y = y;
  mesh.userData.baseY = y;
  return mesh;
}

function wall(wide) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(wide ? 10.2 : 1.85, 1.2, 0.72), mat('#7d634c'));
  mesh.position.y = 0.6;
  mesh.userData.baseY = 0.6;
  return mesh;
}

function arch(wide) {
  const group = new THREE.Group();
  const stone = mat('#6a6156');
  const span = wide ? 10.2 : 2.4;
  const beam = new THREE.Mesh(new THREE.BoxGeometry(span, 0.46, 0.78), stone);
  beam.position.y = 1.28;
  const postL = new THREE.Mesh(new THREE.BoxGeometry(0.34, 1.05, 0.78), stone);
  postL.position.set(-span * 0.5 + 0.17, 0.52, 0);
  const postR = postL.clone();
  postR.position.x = span * 0.5 - 0.17;
  const cap = new THREE.Mesh(new THREE.DodecahedronGeometry(wide ? 0.42 : 0.32, 0), mat('#5c5348'));
  cap.position.y = 1.72;
  group.add(beam, postL, postR, cap);
  group.userData.baseY = 0;
  return group;
}

function rock() {
  const group = new THREE.Group();
  const stone = mat('#6d655c', { roughness: 0.9 });
  const dark = mat('#4e4740', { roughness: 0.95 });
  const a = new THREE.Mesh(new THREE.DodecahedronGeometry(0.48, 0), stone);
  a.position.set(-0.18, 0.42, 0.05);
  a.scale.set(1.15, 0.85, 0.95);
  const b = new THREE.Mesh(new THREE.DodecahedronGeometry(0.36, 0), dark);
  b.position.set(0.32, 0.32, -0.08);
  const c = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 0), stone);
  c.position.set(0.02, 0.72, 0.12);
  group.add(a, b, c);
  group.userData.baseY = 0;
  return group;
}

function truck() {
  const group = new THREE.Group();
  const cargo = new THREE.Mesh(new THREE.BoxGeometry(2.05, 1.7, 3.5), mat('#2f5f86'));
  cargo.position.set(0, 1.45, -0.7);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.95, 1.35, 1.55), mat('#e7f4fb'));
  cab.position.set(0, 1.15, 1.7);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 0.08), mat('#9fd0ea', { roughness: 0.15 }));
  glass.position.set(0, 1.45, 2.46);
  const bumper = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.28, 0.2), mat('#d7dee4'));
  bumper.position.set(0, 0.55, 2.45);
  group.add(cargo, cab, glass, bumper);
  const wheel = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 12);
  const rubber = mat('#241c18');
  for (const z of [-1.6, 1.5]) {
    for (const x of [-0.95, 0.95]) {
      const w = new THREE.Mesh(wheel, rubber);
      w.rotation.z = Math.PI / 2;
      w.position.set(x, 0.32, z);
      group.add(w);
    }
  }
  group.userData.baseY = 0;
  return group;
}

function carriage(style, lifted) {
  const palettes = [
    ['#3a342f', '#6e675f', '#d7efe8', '#f4f0e8'],
    ['#c4622d', '#7a4630', '#f6d7a2', '#f3e7c4'],
    ['#1f4e6b', '#d5e6ee', '#9fd0ea', '#f7fbfe'],
  ];
  const [bodyColor, roofColor, glass, stripeColor] = palettes[style % 3];
  const group = new THREE.Group();
  const tall = style === 1 ? 1.85 : 1.5;
  const lift = lifted ? 1.2 : 0;
  const bodyY = lift + tall * 0.5;
  const shell = mat(bodyColor, { roughness: 0.62 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.92, tall, 7.15), shell);
  body.position.y = bodyY;
  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.1, 7.25), mat(roofColor, { roughness: 0.5 }));
  roof.position.y = bodyY + tall * 0.5 + 0.05;
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.96, tall * 0.72, 0.16), mat(stripeColor));
  nose.position.set(0, bodyY + 0.02, -3.62);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.96, 0.16, 7.05), mat(style === 1 ? '#f0d78c' : stripeColor));
  stripe.position.y = bodyY - tall * 0.18;
  group.add(body, roof, nose, stripe);
  const pane = mat(glass, { roughness: 0.18, metalness: 0.08 });
  const frame = mat('#2a2622');
  for (const side of [-1, 1]) {
    for (let i = -2; i <= 2; i += 1) {
      if (i === 0) continue;
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.06, tall * 0.34, 0.72), pane);
      win.position.set(side * 0.98, bodyY + tall * 0.08, i * 1.15);
      const rim = new THREE.Mesh(new THREE.BoxGeometry(0.07, tall * 0.4, 0.84), frame);
      rim.position.copy(win.position);
      group.add(rim, win);
    }
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.07, tall * 0.62, 0.7), mat('#241e1a'));
    door.position.set(side * 0.98, bodyY - tall * 0.08, 0);
    group.add(door);
  }
  if (!lifted) {
    const wheel = new THREE.CylinderGeometry(0.28, 0.28, 0.18, 12);
    const rubber = mat('#241c18');
    for (const z of [-2.35, 2.35]) {
      for (const x of [-0.92, 0.92]) {
        const w = new THREE.Mesh(wheel, rubber);
        w.rotation.z = Math.PI / 2;
        w.position.set(x, 0.28, z);
        group.add(w);
      }
    }
  } else {
    const lamp = mat('#fff4c8', { emissive: '#fff1b0', emissiveIntensity: 0.7 });
    for (const x of [-0.55, 0.55]) {
      const light = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), lamp);
      light.position.set(x, bodyY - tall * 0.05, -3.7);
      group.add(light);
    }
  }
  group.userData.baseY = 0;
  group.userData.unit = 7.4;
  group.userData.roof = roof.position.y + 0.06;
  return group;
}

function wedge() {
  const geo = new THREE.BufferGeometry();
  const hw = 1.12;
  const y0 = 0;
  const y1 = 1;
  const z0 = -0.5;
  const z1 = 0.5;
  const data = new Float32Array([
    -hw, y0, z0, hw, y0, z0, hw, y1, z1,
    -hw, y0, z0, hw, y1, z1, -hw, y1, z1,
    -hw, 0, z0, -hw, y1, z1, -hw, 0, z1,
    hw, 0, z0, hw, 0, z1, hw, y1, z1,
    -hw, 0, z0, hw, 0, z0, hw, 0, z1,
    -hw, 0, z0, hw, 0, z1, -hw, 0, z1,
    -hw, 0, z1, hw, 0, z1, hw, y1, z1,
    -hw, 0, z1, hw, y1, z1, -hw, y1, z1,
  ]);
  geo.setAttribute('position', new THREE.BufferAttribute(data, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat('#c9843f'));
  mesh.userData.baseY = 0;
  return mesh;
}

function pit() {
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(1.35, 20), mat('#1a120c'));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.045;
  mesh.userData.baseY = 0.045;
  return mesh;
}

function poop() {
  const group = new THREE.Group();
  const brown = mat('#6b3a1a', { roughness: 0.82 });
  const dark = mat('#3d2412', { roughness: 0.9 });
  const base = new THREE.Mesh(new THREE.SphereGeometry(0.4, 18, 14), brown);
  base.scale.set(1.2, 0.62, 1.05);
  base.position.y = 0.26;
  const mid = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), brown);
  mid.scale.set(1.05, 0.78, 0.95);
  mid.position.y = 0.58;
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), dark);
  top.position.set(0.05, 0.86, 0.02);
  const curl = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.045, 8, 16, Math.PI * 1.35), dark);
  curl.position.set(0.1, 0.98, 0);
  curl.rotation.set(0.5, 0.3, 1);
  const crease = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), dark);
  crease.position.set(-0.16, 0.46, 0.22);
  group.add(base, mid, top, curl, crease);
  group.scale.setScalar(1.55);
  group.userData.homeScale = 1.55;
  group.userData.baseY = 1.2;
  return group;
}

function mushroom() {
  const group = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.46, 14), mat('#f4e4c4', { roughness: 0.7 }));
  stem.position.y = 0.23;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat('#e23b2f', { roughness: 0.45 }));
  cap.position.y = 0.42;
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.08, 18), mat('#f7f1e4', { roughness: 0.55 }));
  brim.position.y = 0.42;
  group.add(stem, cap, brim);
  const spots = [
    [0.12, 0.72, 0.18],
    [-0.16, 0.66, 0.12],
    [0.02, 0.78, -0.08],
    [-0.08, 0.58, -0.22],
    [0.2, 0.58, -0.06],
  ];
  for (const [x, y, z] of spots) {
    const spot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), mat('#fffaf2'));
    spot.position.set(x, y, z);
    group.add(spot);
  }
  group.scale.setScalar(1.45);
  group.userData.homeScale = 1.45;
  group.userData.baseY = 1.15;
  return group;
}

function noodleBowl(red) {
  const group = new THREE.Group();
  const bowl = new THREE.Mesh(
    new THREE.SphereGeometry(0.46, 28, 16, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5),
    mat(red ? '#d23a32' : '#f4efe4', { roughness: 0.28 }),
  );
  bowl.scale.set(1.15, 0.85, 1.15);
  bowl.position.y = 0.36;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.045, 8, 28), mat(red ? '#f0c2bc' : '#fffdf8'));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.38;
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.49, 0.016, 6, 24), mat('#d23b2c'));
  lip.rotation.x = Math.PI / 2;
  lip.position.y = 0.41;
  const broth = new THREE.Mesh(new THREE.CircleGeometry(0.4, 24), mat('#d06a28', { roughness: 0.4 }));
  broth.rotation.x = -Math.PI / 2;
  broth.position.y = 0.3;
  group.add(bowl, rim, lip, broth);
  const noodleMat = mat('#f2c84a', { roughness: 0.7 });
  for (let i = 0; i < 14; i += 1) {
    const strand = new THREE.Mesh(new THREE.TorusGeometry(0.1 + (i % 3) * 0.02, 0.012, 5, 12, Math.PI * 1.2), noodleMat);
    const turn = (i / 14) * Math.PI * 2;
    strand.position.set(Math.cos(turn) * 0.1, 0.36 + (i % 5) * 0.035, Math.sin(turn) * 0.08);
    strand.rotation.set(0.2 + (i % 5) * 0.35, turn, (i % 4) * 0.4);
    group.add(strand);
  }
  const beefMat = mat('#7c2c1e', { roughness: 0.4 });
  const slices = [
    [0.12, 0.5, 0.04, 0.4],
    [-0.12, 0.52, -0.02, -0.5],
    [0.0, 0.56, 0.1, 0.9],
  ];
  for (const [x, y, z, rot] of slices) {
    const beef = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), beefMat);
    beef.scale.set(1.55, 0.22, 1.05);
    beef.position.set(x, y, z);
    beef.rotation.set(-0.4, rot, 0.2);
    group.add(beef);
  }
  const onion = mat('#2f9a34');
  for (const [x, z, rot] of [[0.18, 0.02, 0.4], [-0.16, 0.1, -0.6], [0.02, -0.16, 1.2], [0.08, 0.14, 0.2]]) {
    const bit = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.018, 0.1), onion);
    bit.position.set(x, 0.48, z);
    bit.rotation.y = rot;
    group.add(bit);
  }
  group.scale.setScalar(1.9);
  group.userData.homeScale = 1.9;
  group.userData.baseY = 0.95;
  return group;
}

function makeSuit() {
  const suit = new THREE.Group();
  suit.name = 'suit';
  suit.visible = false;
  const jacketMat = mat('#1a4ed0', { roughness: 0.4 });
  const pantsMat = mat('#12368f', { roughness: 0.48 });
  const shirtMat = mat('#f6f7f8', { roughness: 0.5 });
  const bowMat = mat('#161616', { roughness: 0.35 });
  const jacket = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 18), jacketMat);
  jacket.scale.set(0.34, 0.16, 0.28);
  jacket.position.set(0, 0.3, 0);
  const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.28, 10), pantsMat);
  legL.position.set(-0.1, 0.14, 0);
  const legR = legL.clone();
  legR.position.x = 0.1;
  const sleeveL = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.16, 4, 8), jacketMat);
  sleeveL.rotation.z = 0.9;
  sleeveL.position.set(-0.3, 0.3, 0);
  const sleeveR = sleeveL.clone();
  sleeveR.rotation.z = -0.9;
  sleeveR.position.x = 0.32;
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.03, 8, 16), shirtMat);
  collar.rotation.x = Math.PI / 2;
  collar.position.set(0, 0.48, 0);
  const collarBack = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.05), shirtMat);
  collarBack.position.set(0, 0.46, 0.14);
  const shirt = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.06), shirtMat);
  shirt.position.set(0, 0.36, -0.3);
  const bowL = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), bowMat);
  bowL.scale.set(1.7, 0.65, 0.45);
  bowL.position.set(-0.055, 0.47, -0.28);
  const bowR = bowL.clone();
  bowR.position.x = 0.055;
  const knot = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.035, 0.03), bowMat);
  knot.position.set(0, 0.47, -0.3);
  suit.add(legL, legR, jacket, sleeveL, sleeveR, collar, collarBack, shirt, bowL, bowR, knot);
  return suit;
}

function makeMic() {
  const mic = new THREE.Group();
  mic.name = 'mic';
  mic.visible = false;
  const held = new THREE.Group();
  held.position.set(0.34, 0.7, 0.12);
  held.rotation.z = -0.4;
  const metal = mat('#d5dae0', { metalness: 0.62, roughness: 0.28 });
  const black = mat('#1b1b1b', { roughness: 0.4 });
  const grille = new THREE.Mesh(new THREE.SphereGeometry(0.1, 18, 14), metal);
  grille.position.y = 0.3;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.072, 14, 10), mat('#9aa3ad', { metalness: 0.45, roughness: 0.35 }));
  cap.scale.y = 0.5;
  cap.position.y = 0.35;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.016, 8, 18), black);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.22;
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.038, 0.48, 12), black);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.044, 0.034, 12), mat('#c6a15a', { metalness: 0.55, roughness: 0.32 }));
  band.position.y = 0.14;
  held.add(grille, cap, ring, handle, band);
  mic.add(held);
  return mic;
}

function coin() {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.12, 18), mat('#ffd24a', { metalness: 0.35, roughness: 0.28 }));
  mesh.rotation.z = Math.PI / 2;
  mesh.position.y = 1.05;
  mesh.userData.baseY = 1.05;
  return mesh;
}

function gem(color) {
  const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), mat(color, { emissive: color, emissiveIntensity: 0.25 }));
  mesh.position.y = 1.2;
  mesh.userData.baseY = 1.2;
  return mesh;
}

function fallbackFrog() {
  const group = new THREE.Group();
  const yellow = mat('#ffd23a');
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 28, 20), yellow);
  body.scale.set(1.15, 0.95, 0.82);
  body.position.y = 0.62;
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.36, 22, 16), mat('#fff6df', { roughness: 0.4 }));
  belly.position.set(0, 0.52, 0.32);
  const eyeMat = mat('#39d353', { roughness: 0.32 });
  const pupilMat = mat('#142016');
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 12), eyeMat);
  eyeL.position.set(-0.22, 0.98, 0.34);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.22;
  const pL = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), pupilMat);
  pL.position.set(-0.22, 0.98, 0.44);
  const pR = pL.clone();
  pR.position.x = 0.22;
  const hand = mat('#8d8680');
  const hL = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), hand);
  hL.position.set(-0.48, 0.62, 0.2);
  const hR = hL.clone();
  hR.position.x = 0.48;
  group.add(body, belly, eyeL, eyeR, pL, pR, hL, hR);
  return group;
}

function smoothstep(edge0, edge1, value) {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function firstMesh(root) {
  let found = null;
  root.traverse((node) => {
    if (!found && node.isMesh) found = node;
  });
  return found;
}

function spinFace(root) {
  root.traverse((node) => {
    if (!node.isMesh) return;
    const pos = node.geometry.attributes.position;
    const nrm = node.geometry.attributes.normal;
    for (let i = 0; i < pos.count; i += 1) {
      pos.setXYZ(i, -pos.getX(i), pos.getY(i), -pos.getZ(i));
      if (nrm) nrm.setXYZ(i, -nrm.getX(i), nrm.getY(i), -nrm.getZ(i));
    }
    pos.needsUpdate = true;
    if (nrm) nrm.needsUpdate = true;
    node.geometry.computeBoundingBox();
    node.geometry.computeBoundingSphere();
  });
}

/** 原模型没有骨骼。按头、手臂、腿把顶点分开，跑步时各自绕关节转。 */
function makePosable(template) {
  const geometry = template.geometry.clone();
  const material = template.material.clone();
  material.emissive = new THREE.Color('#ffe08a');
  material.emissiveIntensity = 0;
  const mesh = new THREE.Mesh(geometry, material);
  const root = new THREE.Group();
  root.add(mesh);
  const rest = new Float32Array(geometry.attributes.position.array);
  const count = rest.length / 3;
  const legL = new Float32Array(count);
  const legR = new Float32Array(count);
  const armL = new Float32Array(count);
  const armR = new Float32Array(count);
  const head = new Float32Array(count);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < count; i += 1) {
    const x = rest[i * 3];
    const y = rest[i * 3 + 1];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const height = Math.max(0.001, maxY - minY);
  const width = Math.max(0.001, maxX - minX);
  const tall = height > width * 2.2;
  const midX = (minX + maxX) * 0.5;
  const pivots = tall
    ? {
        legL: [midX - width * 0.18, minY + height * 0.46, 0],
        legR: [midX + width * 0.18, minY + height * 0.46, 0],
        armL: [midX - width * 0.42, minY + height * 0.68, 0],
        armR: [midX + width * 0.42, minY + height * 0.68, 0],
        head: [midX, minY + height * 0.8, 0],
      }
    : PIVOT;
  for (let i = 0; i < count; i += 1) {
    const x = rest[i * 3];
    const y = rest[i * 3 + 1];
    let leg = 0;
    let arm = 0;
    let headW = 0;
    if (tall) {
      const ny = (y - minY) / height;
      const nx = (x - midX) / (width * 0.5);
      leg = smoothstep(0.48, 0.05, ny);
      arm = smoothstep(0.2, 0.55, Math.abs(nx)) * smoothstep(0.42, 0.55, ny) * (1 - smoothstep(0.74, 0.84, ny));
      headW = smoothstep(0.78, 0.88, ny);
    } else {
      leg = smoothstep(0.25, 0.04, y);
      arm = smoothstep(0.04, 0.1, Math.abs(x)) * smoothstep(0.18, 0.3, y) * (1 - smoothstep(0.44, 0.52, y));
      headW = smoothstep(0.46, 0.56, y);
    }
    if (headW > 0.15) arm = 0;
    if (leg >= arm) arm = 0;
    else leg = 0;
    const sideL = x < 0 ? 1 : 0;
    legL[i] = leg * sideL;
    legR[i] = leg * (1 - sideL);
    armL[i] = arm * sideL;
    armR[i] = arm * (1 - sideL);
    head[i] = headW;
  }
  return { root, mesh, material, rest, count, legL, legR, armL, armR, head, pivots };
}

function posePart(x, y, z, weight, pivot, rx, rz) {
  if (weight < 0.001) return [x, y, z];
  const px = x - pivot[0];
  const py = y - pivot[1];
  const pz = z - pivot[2];
  const cx = Math.cos(rx);
  const sx = Math.sin(rx);
  const y1 = py * cx - pz * sx;
  const z1 = py * sx + pz * cx;
  const cz = Math.cos(rz);
  const sz = Math.sin(rz);
  const x2 = px * cz - y1 * sz;
  const y2 = px * sz + y1 * cz;
  const nx = pivot[0] + x2;
  const ny = pivot[1] + y2;
  const nz = pivot[2] + z1;
  return [x + (nx - x) * weight, y + (ny - y) * weight, z + (nz - z) * weight];
}

const PIVOT = {
  legL: [-0.055, 0.22, 0],
  legR: [0.055, 0.22, 0],
  armL: [-0.07, 0.36, 0],
  armR: [0.07, 0.36, 0],
  head: [0, 0.48, 0.01],
};

function paintUgly(rig) {
  const geo = rig?.mesh?.geometry;
  if (!geo || geo.userData.ugly) return;
  const { rest, count } = rig;
  const colors = new Float32Array(count * 3);
  const palette = [
    [0.78, 0.08, 0.95],
    [0.05, 0.95, 0.18],
    [0.08, 0.28, 1],
  ];
  for (let i = 0; i < count; i += 1) {
    const x = rest[i * 3];
    const y = rest[i * 3 + 1];
    const z = rest[i * 3 + 2];
    const n = Math.sin(x * 23) + Math.sin(y * 17) * 0.85 + Math.sin(z * 21) * 0.9;
    const pick = n > 0.35 ? 0 : n < -0.35 ? 1 : 2;
    colors[i * 3] = palette[pick][0];
    colors[i * 3 + 1] = palette[pick][1];
    colors[i * 3 + 2] = palette[pick][2];
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.userData.ugly = true;
}

function poseRig(rig, angles) {
  if (!rig) return;
  const { rest, count } = rig;
  const pivots = rig.pivots || PIVOT;
  const arr = rig.mesh.geometry.attributes.position.array;
  for (let i = 0; i < count; i += 1) {
    let x = rest[i * 3];
    let y = rest[i * 3 + 1];
    let z = rest[i * 3 + 2];
    [x, y, z] = posePart(x, y, z, rig.legL[i], pivots.legL, angles.legL, 0);
    [x, y, z] = posePart(x, y, z, rig.legR[i], pivots.legR, angles.legR, 0);
    [x, y, z] = posePart(x, y, z, rig.armL[i], pivots.armL, angles.armL, angles.armZL || 0);
    [x, y, z] = posePart(x, y, z, rig.armR[i], pivots.armR, angles.armR, angles.armZR || 0);
    [x, y, z] = posePart(x, y, z, rig.head[i], pivots.head, angles.head, 0);
    arr[i * 3] = x;
    arr[i * 3 + 1] = y;
    arr[i * 3 + 2] = z;
  }
  rig.mesh.geometry.attributes.position.needsUpdate = true;
}

function runAngles(phase) {
  const swing = Math.sin(phase);
  return {
    legL: swing * 1.15,
    legR: -swing * 1.15,
    armL: -swing * 1.2,
    armR: swing * 1.2,
    head: Math.sin(phase * 2) * 0.08,
    armZL: 0.15,
    armZR: -0.15,
  };
}

function fitWidth(root, targetWidth) {
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  const span = Math.max(size.y, 0.001);
  const scale = targetWidth / span;
  root.scale.multiplyScalar(scale);
  const fitted = new THREE.Box3().setFromObject(root);
  root.position.y -= fitted.min.y;
  return new THREE.Box3().setFromObject(root);
}

function cloneGraphic(source) {
  const clone = source.clone(true);
  clone.traverse((node) => {
    if (!node.isMesh) return;
    const list = Array.isArray(node.material) ? node.material : [node.material];
    const cloned = list.map((item) => item.clone());
    node.material = cloned.length === 1 ? cloned[0] : cloned;
  });
  return clone;
}

function materialsOf(root) {
  const found = [];
  root.traverse((node) => {
    if (!node.isMesh) return;
    const list = Array.isArray(node.material) ? node.material : [node.material];
    found.push(...list);
  });
  return found;
}

function makeBottle() {
  const group = new THREE.Group();
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.55, 12), mat('#f4f7fb', { transparent: true, opacity: 0.85 }));
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.12, 12), mat('#2f6fed'));
  cap.position.y = 0.32;
  const milk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.36, 12), mat('#fffdf8'));
  milk.position.y = -0.05;
  group.add(glass, milk, cap);
  return group;
}

function makeHat() {
  const group = new THREE.Group();
  const navy = mat('#243056');
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.28, 16), navy);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.06, 16), navy);
  brim.position.y = -0.14;
  group.add(crown, brim);
  return group;
}

function plankCrate() {
  const group = new THREE.Group();
  const wood = mat('#d3924e', { roughness: 0.78 });
  const edge = mat('#8a5a2e');
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.96, 0.96), wood);
  body.position.y = 0.56;
  group.add(body);
  for (const y of [0.22, 0.9]) {
    for (const z of [-0.5, 0.5]) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.1, 0.08), edge);
      slat.position.set(0, y, z);
      group.add(slat);
    }
  }
  group.userData.baseY = 0;
  return group;
}

function makeTrackTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#d7d1c6';
  ctx.fillRect(0, 0, 512, 512);
  ctx.fillStyle = '#c4bfb4';
  for (let i = 0; i < 18; i += 1) ctx.fillRect(8 + (i % 3) * 6, i * 30, 90, 16);
  for (let i = 0; i < 18; i += 1) ctx.fillRect(410, i * 30 + 8, 90, 16);
  ctx.fillStyle = '#8d6844';
  ctx.fillRect(108, 0, 16, 512);
  ctx.fillRect(388, 0, 16, 512);
  ctx.fillStyle = '#4a5160';
  ctx.fillRect(124, 0, 264, 512);
  ctx.fillStyle = '#5b6270';
  ctx.fillRect(128, 0, 256, 512);
  ctx.strokeStyle = '#f4f1ea';
  ctx.lineWidth = 4;
  ctx.setLineDash([36, 28]);
  ctx.beginPath();
  ctx.moveTo(196, 0);
  ctx.lineTo(196, 512);
  ctx.moveTo(316, 0);
  ctx.lineTo(316, 512);
  ctx.stroke();
  ctx.strokeStyle = '#e7c14a';
  ctx.lineWidth = 3;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(140, 0);
  ctx.lineTo(140, 512);
  ctx.moveTo(372, 0);
  ctx.lineTo(372, 512);
  ctx.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.repeat.set(1, 12);
  return texture;
}

function facade(side, theme, seed) {
  const group = new THREE.Group();
  const height = 3.1 + (seed % 3) * 0.85;
  const depth = 7.2;
  const wall = mat(theme.wall, { roughness: 0.78 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.1, height, depth), wall);
  body.position.set(side * 9.3, height * 0.5, 0);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.28, depth + 0.3), mat(theme.roof));
  roof.position.set(side * 9.3, height + 0.12, 0);
  const awning = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.08, 2.2), mat(theme.trim));
  awning.position.set(side * 7.7, 1.7, -1.6);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.35, 0.7), mat('#3a2a22'));
  door.position.set(side * 7.72, 0.7, -1.6);
  const glass = mat('#d5e7f2', { roughness: 0.2, metalness: 0.05 });
  group.add(body, roof, awning, door);
  for (let row = 0; row < 2; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.7, 0.85), glass);
      win.position.set(side * 7.68, 1.15 + row * 1.15, -0.2 + col * 1.7);
      group.add(win);
    }
  }
  return group;
}

function yardTree(side, z) {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.1, 8), mat('#6b4a32'));
  trunk.position.set(side * 6.85, 0.55, z);
  const leaf = mat(side < 0 ? '#6ea35a' : '#7eae62', { roughness: 0.85 });
  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.72, 12, 10), leaf);
  crown.position.set(side * 6.85, 1.55, z);
  crown.scale.set(1, 0.82, 1);
  group.add(trunk, crown);
  return group;
}

function lampPost(side, z) {
  const group = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.4, 8), mat('#3e4650'));
  pole.position.set(side * 6.35, 1.2, z);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), mat('#fff6d2', { emissive: '#fff1c2', emissiveIntensity: 0.35 }));
  head.position.set(side * 6.35, 2.45, z);
  group.add(pole, head);
  return group;
}

function makeStreetBlock(n) {
  const themes = [
    { wall: '#f4e3c8', roof: '#c45c4a', trim: '#e07a5f' },
    { wall: '#d9e6ee', roof: '#3d6e8c', trim: '#f4f7f8' },
    { wall: '#f6d7a2', roof: '#8c5a3c', trim: '#6b8f71' },
    { wall: '#efe8df', roof: '#5c6b73', trim: '#e8b84a' },
  ];
  const group = new THREE.Group();
  group.add(facade(-1, themes[n % 4], n));
  group.add(facade(1, themes[(n + 1) % 4], n + 2));
  group.add(yardTree(-1, 5.2));
  group.add(yardTree(1, -4.4));
  group.add(lampPost(-1, -6.2));
  group.add(lampPost(1, 6.4));
  const bush = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), mat('#7da86a'));
  bush.position.set((n % 2 ? 1 : -1) * 6.7, 0.22, 0.4);
  group.add(bush);
  return group;
}

function freshRun() {
  return {
    phase: 'title',
    distance: 0,
    score: 0,
    coins: 0,
    clean: 0,
    lane: 1,
    x: 0,
    z: 0,
    mode: 'running',
    modeT: 0,
    jumpCd: 0,
    slideCd: 0,
    iframes: 0,
    inv: 0,
    magnet: 0,
    shoes: 0,
    smoke: 0,
    doubleT: 0,
    stumble: 0,
    gap: 12,
    chaserSpeed: 12,
    sprintCd: 6,
    sprintT: 0,
    reason: '',
    endT: 0,
    reported: false,
    floor: 0,
    jumpBase: 0,
    bumps: 0,
    fly: 0,
    poop: 0,
    shroom: 0,
    noodle: 0,
    boost: 0,
    board: 0,
    chasePause: 0,
    doubleRest: false,
    cursor: 32,
    itemIn: 4,
    poopAt: 180,
    shroomAt: 260,
    lyricNext: 0,
    lastForced: '',
    shown: false,
  };
}

export function createGame(canvas, hooks) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor('#9fd8f5');
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#9fd8f5');
  scene.fog = new THREE.Fog('#b7dff6', 42, 120);
  const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 180);

  scene.add(new THREE.HemisphereLight('#fff4dd', '#c4a06a', 0.82));
  const sun = new THREE.DirectionalLight('#fff7ea', 1.05);
  sun.position.set(-4, 10, -6);
  scene.add(sun);
  const glow = new THREE.PointLight('#ffe08a', 0, 6);
  scene.add(glow);

  const grass = new THREE.Mesh(new THREE.PlaneGeometry(80, 110), mat('#b7d39a', { roughness: 1 }));
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = -0.04;
  scene.add(grass);
  const track = new THREE.Mesh(new THREE.PlaneGeometry(24, 96), new THREE.MeshStandardMaterial({ map: makeTrackTexture(), roughness: 0.88 }));
  track.rotation.x = -Math.PI / 2;
  track.position.y = 0.01;
  scene.add(track);
  const STREET_SPAN = 18;
  const street = [];
  for (let i = 0; i < 8; i += 1) {
    const block = makeStreetBlock(i);
    block.userData.home = (i - 1) * STREET_SPAN;
    block.position.z = block.userData.home;
    scene.add(block);
    street.push(block);
  }

  const player = new THREE.Group();
  const chaser = new THREE.Group();
  scene.add(player, chaser);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.9, 18), mat('#000000', { transparent: true, opacity: 0.18 }));
  shadow.rotation.x = -Math.PI / 2;
  scene.add(shadow);

  let playerMats = [];
  let playerRig = null;
  let playerSuit = null;
  let playerMic = null;
  let chaserRig = null;
  let modelReady = false;
  let heroId = readHero();
  let frogSource = null;
  let duduSource = null;
  let taoSource = null;
  const loader = new GLTFLoader();
  loader.load(
    'assets/frog.glb',
    (gltf) => {
      frogSource = gltf.scene;
      mountFrogs(heroSource());
    },
    undefined,
    (error) => {
      console.warn('naiwa.model', error);
      frogSource = fallbackFrog();
      mountFrogs(heroSource());
    },
  );
  loader.load(
    'assets/dudu.glb',
    (gltf) => {
      duduSource = gltf.scene;
      if (heroId === 'dudu' && modelReady) mountFrogs(heroSource());
    },
    undefined,
    (error) => console.warn('naiwa.dudu', error),
  );
  loader.load(
    'assets/tao.glb',
    (gltf) => {
      taoSource = gltf.scene;
      spinFace(taoSource);
      if (heroId === 'tao' && modelReady) mountFrogs(heroSource());
    },
    undefined,
    (error) => console.warn('naiwa.tao', error),
  );

  function heroSource() {
    if (heroId === 'dudu' && duduSource) return duduSource;
    if (heroId === 'tao' && taoSource) return taoSource;
    return frogSource || fallbackFrog();
  }

  function mountFrogs(source) {
    player.clear();
    chaser.clear();
    const mesh = firstMesh(source);
    const chaserMesh = firstMesh(frogSource || source);
    if (!mesh) {
      player.add(source);
      modelReady = true;
      hooks.onReady();
      return;
    }
    playerRig = makePosable(mesh);
    chaserRig = makePosable(chaserMesh || mesh);
    fitWidth(playerRig.root, 1.5);
    const villainBox = fitWidth(chaserRig.root, 1.78);
    player.add(playerRig.root);
    playerSuit = makeSuit();
    playerRig.root.add(playerSuit);
    playerMic = makeMic();
    playerRig.root.add(playerMic);
    chaser.add(chaserRig.root);
    const hat = makeHat();
    hat.position.y = villainBox.max.y + 0.02;
    const bottle = makeBottle();
    bottle.position.set(0.55, villainBox.max.y * 0.5, -0.28);
    chaser.add(hat, bottle);
    playerMats = [playerRig.material];
    const first = !modelReady;
    modelReady = true;
    if (first) hooks.onReady();
  }

  const pools = new Map();
  const active = [];
  let run = freshRun();

  function gainCoins(count) {
    run.coins += count;
    writeCoins(readCoins() + count);
  }
  let clock = new THREE.Clock();
  let beatIn = 0.4;

  function take(type) {
    const pool = pools.get(type) || [];
    pools.set(type, pool);
    const mesh = pool.pop() || buildMesh(type);
    mesh.visible = true;
    const home = mesh.userData.homeScale || 1;
    mesh.scale.set(home, home, home);
    mesh.rotation.set(0, 0, 0);
    if (type === 'coin') mesh.rotation.z = Math.PI / 2;
    if (type === 'pit') mesh.rotation.x = -Math.PI / 2;
    scene.add(mesh);
    return mesh;
  }

  function give(obj) {
    obj.mesh.visible = false;
    scene.remove(obj.mesh);
    pools.get(obj.type).push(obj.mesh);
  }

  function spawn(type, kind, z, lane, len) {
    const mesh = take(type);
    const wide = lane == null;
    mesh.position.set(wide ? 0 : LANES[lane], mesh.userData.baseY || 0, z);
    const obj = { type, kind, mesh, z, lane, len, cleared: false, gone: false, pop: 0, roof: 0, dir: 1, half: type === 'block' || type === 'crate' ? 0.68 : 0.9 };
    active.push(obj);
    return obj;
  }

  function releaseAll() {
    while (active.length) give(active.pop());
  }

  function coinLine(z, lane, lift = 0) {
    for (let i = 0; i < 5; i += 1) {
      const obj = spawn('coin', 'coin', z + i * 1.4, lane, 0.55);
      if (!lift) continue;
      obj.mesh.userData.baseY = lift;
      obj.mesh.position.y = lift;
    }
  }

  function spawnRide(z, lane) {
    const roof = 1.72;
    const up = 7;
    const trainLen = 14;
    const down = 6;
    const styles = ['train', 'train2', 'train3'];
    const train = spawn(styles[(Math.random() * 3) | 0], 'train', z + up + trainLen / 2, lane, trainLen);
    const top = train.mesh.userData.roof || roof;
    train.roof = top;
    train.half = 0.95;
    train.mesh.scale.z = trainLen / 7.4;
    const ramp = spawn('ramp', 'ramp', z + up / 2, lane, up);
    ramp.roof = top;
    ramp.half = 0.95;
    ramp.dir = 1;
    ramp.mesh.scale.y = top;
    ramp.mesh.scale.z = up;
    const drop = spawn('ramp', 'ramp', z + up + trainLen + down / 2, lane, down);
    drop.roof = top;
    drop.half = 0.95;
    drop.dir = -1;
    drop.mesh.rotation.y = Math.PI;
    drop.mesh.scale.y = top;
    drop.mesh.scale.z = down;
    coinLine(z + up + 1.5, lane, top + 0.9);
    return z + up + trainLen + down;
  }

  function extendTrack() {
    const speed = baseSpeed(run.distance + 80) * (run.shoes > 0 ? 1.4 : 1);
    while (run.cursor < run.z + 95) {
      let gap = minSpacing(speed, run.distance + (run.cursor - run.z));
      if (run.distance > 600) gap *= 0.92;
      if (run.lastForced === 'high' || run.lastForced === 'low') gap += speed * 0.35;
      run.cursor += gap;
      while (run.poopAt < run.cursor - 6) {
        placePoop(run.poopAt, (Math.random() * 3) | 0);
        run.poopAt += 210;
      }
      while (run.shroomAt < run.cursor - 6) {
        placeShroom(run.shroomAt, (Math.random() * 3) | 0);
        run.shroomAt += 240;
      }
      while (run.lyricNext < LYRIC_STOPS.length && LYRIC_STOPS[run.lyricNext].z < run.cursor - 6) {
        placeNoodle(LYRIC_STOPS[run.lyricNext]);
        run.lyricNext += 1;
      }
      const z = run.cursor;
      const roll = Math.random();
      const lane = () => (Math.random() * 3) | 0;
      if (crowdsNoodle(z, 8)) {
        run.lastForced = '';
        continue;
      }
      if (!run.shown) {
        run.shown = true;
        spawn('block', 'high', 22, 1, 1.05);
        spawn('arch', 'low', 36, 1, 0.72);
        run.cursor = spawnRide(48, 1);
        run.lastForced = '';
        continue;
      }
      if (roll < 0.08) {
        coinLine(z, lane());
        run.lastForced = '';
        continue;
      }
      const band = run.distance + (run.cursor - run.z);
      if (roll < 0.36) {
        const blocked = lane();
        spawn('block', 'high', z, blocked, 1.05);
        coinLine(z + 2.2, (blocked + 1) % 3);
        run.lastForced = 'high';
        continue;
      }
      if (roll < 0.5) {
        const open = lane();
        for (let i = 0; i < 3; i += 1) if (i !== open) spawn('block', 'high', z, i, 1.05);
        coinLine(z + 2.2, open);
        run.lastForced = 'high';
        continue;
      }
      if (roll < 0.64) {
        spawn('low-all', 'low', z, null, 0.72);
        run.lastForced = 'low';
        continue;
      }
      if (roll < 0.74 && band > 40 && !crowdsPit(z + 26, 10)) {
        const styles = ['oncoming', 'oncoming2', 'oncoming3'];
        const obj = spawn(styles[(Math.random() * 3) | 0], 'oncoming', z + 26, lane(), 8);
        obj.half = 0.95;
        obj.mesh.scale.z = 8 / 7.4;
        run.lastForced = '';
        continue;
      }
      if (roll < 0.86 && band > 70 && !crowdsPit(z + 14, 28)) {
        run.cursor = spawnRide(z, lane());
        run.lastForced = '';
        continue;
      }
      if (roll < 0.93 && band > 90 && !crowdsPit(z, 4)) {
        const open = lane();
        for (let i = 0; i < 3; i += 1) if (i !== open) spawn('pit', 'pit', z, i, 2.4);
        coinLine(z + 3.2, open);
        run.lastForced = 'fatal';
        continue;
      }
      if (band > 50 && !crowdsPit(z, 8)) {
        spawn('truck', 'fatal', z, lane(), 5.2);
        run.lastForced = 'fatal';
        continue;
      }
      spawn('crate', 'crate', z, lane(), 1.1);
      run.lastForced = '';
    }
  }

  function placePoop(z, lane) {
    const taken = active.some((obj) => obj.lane === lane && Math.abs(obj.z - z) < 2.2 && obj.kind !== 'coin');
    const useLane = taken ? (lane + 1) % 3 : lane;
    const obj = spawn('poop', 'item', z, useLane, 0.8);
    obj.item = 'poop';
  }

  function placeShroom(z, lane) {
    const taken = active.some((obj) => obj.lane === lane && Math.abs(obj.z - z) < 2.2 && obj.kind !== 'coin');
    const useLane = taken ? (lane + 2) % 3 : lane;
    const obj = spawn('shroom', 'item', z, useLane, 0.8);
    obj.item = 'shroom';
  }

  function noodleZone(stopZ) {
    const speed = baseSpeed(stopZ);
    return {
      before: Math.max(20, speed * 1.15),
      after: Math.max(10, speed * 0.55),
      pitBefore: Math.max(36, speed * 2.2),
      pitAfter: Math.max(16, speed * 1.05),
    };
  }

  function overlapsNoodle(z, len, pits) {
    const half = Math.max(len, 0) * 0.5;
    const start = z - half;
    const end = z + half;
    return LYRIC_STOPS.some((stop) => {
      const zone = noodleZone(stop.z);
      const before = pits ? zone.pitBefore : zone.before;
      const after = pits ? zone.pitAfter : zone.after;
      return end > stop.z - before && start < stop.z + after;
    });
  }

  function crowdsNoodle(z, len = 1) {
    return overlapsNoodle(z, len, false);
  }

  function crowdsPit(z, len = 1) {
    return overlapsNoodle(z, len, true);
  }

  function clearAroundNoodle(z) {
    const zone = noodleZone(z);
    for (let i = active.length - 1; i >= 0; i -= 1) {
      const obj = active[i];
      if (obj.kind === 'coin' || obj.item === 'noodle') continue;
      const half = (obj.len || 1) * 0.5;
      const hard = obj.kind === 'pit' || obj.kind === 'fatal' || obj.kind === 'oncoming' || obj.kind === 'train' || obj.kind === 'ramp';
      const before = hard ? zone.pitBefore : zone.before;
      const after = hard ? zone.pitAfter : zone.after;
      if (obj.z + half <= z - before || obj.z - half >= z + after) continue;
      give(active.splice(i, 1)[0]);
    }
  }

  function placeNoodle(stop) {
    clearAroundNoodle(stop.z);
    const obj = spawn(stop.red ? 'noodle-red' : 'noodle', 'item', stop.z, 1, 0.9);
    obj.item = 'noodle';
    obj.clip = stop;
  }

  function maybeItem(dt) {
    run.itemIn -= dt;
    if (run.itemIn > 0) return;
    const late = Math.min(run.distance / 600, 1);
    run.itemIn = 5 + late * 3 + Math.random() * 2;
    const name = rollItem(run.distance, Math.random);
    const z = run.z + 28 + Math.random() * 10;
    const lane = (Math.random() * 3) | 0;
    const blocked = active.some((obj) => obj.kind !== 'coin' && obj.lane === lane && Math.abs(obj.z - z) < 2.4);
    if (blocked) return;
    spawn(name, 'item', z, lane, 0.8);
    active[active.length - 1].item = name;
  }

  function points(base) {
    const mult = comboMultiplier(run.clean) * (run.doubleRest || run.doubleT > 0 ? 2 : 1);
    run.score += base * mult;
  }

  function nearestLane(x) {
    let best = 0;
    let dist = Infinity;
    LANES.forEach((laneX, index) => {
      const delta = Math.abs(laneX - x);
      if (delta < dist) {
        dist = delta;
        best = index;
      }
    });
    return best;
  }

  function fail(reason) {
    if (run.phase !== 'play' || run.boost > 0) return;
    run.phase = 'ending';
    run.reason = reason;
    run.endT = 0;
    run.reported = false;
    run.deathLaugh = false;
    run.deathX = run.x;
    run.deathZ = run.z;
    hooks.audio.die();
    hooks.onDeath?.();
    navigator.vibrate?.(50);
  }

  let showcaseYaw = 0;
  let showcasePitch = 0.22;
  function orbitCamera(x, z) {
    const dist = heroId === 'dudu' ? 4.8 : heroId === 'tao' ? 2.7 : 3.05;
    const lookY = heroId === 'dudu' ? 0.72 : heroId === 'tao' ? 0.92 : 0.95;
    const flat = Math.cos(showcasePitch);
    camera.position.set(
      x + Math.sin(showcaseYaw) * dist * flat,
      lookY + Math.sin(showcasePitch) * dist * 0.55,
      z - Math.cos(showcaseYaw) * dist * flat,
    );
    camera.lookAt(x, lookY, z);
  }

  function faceCamera(x, z) {
    if (run.phase === 'title' && laughT < 0) {
      orbitCamera(x, z);
      return;
    }
    if (heroId === 'tao') {
      camera.position.set(x, 1.22, z - 3.3);
      camera.lookAt(x, 0.95, z);
      return;
    }
    if (heroId === 'dudu') {
      camera.position.set(x, 1.45, z - 4.4);
      camera.lookAt(x, 0.78, z);
      return;
    }
    camera.position.set(x, 1.2, z - 2.7);
    camera.lookAt(x, 1.02, z);
  }

  function bump() {
    if (run.phase !== 'play' || run.iframes > 0 || run.boost > 0) return;
    if (run.board > 0) {
      run.board = 0;
      run.iframes = 0.35;
      return;
    }
    run.clean = 0;
    run.bumps += 1;
    run.stumble = 0.65;
    hooks.audio.stumble();
    navigator.vibrate?.(24);
    if (run.bumps >= 2) {
      run.gap = 0;
      fail('caught');
      return;
    }
    hooks.onChuckle?.();
    run.gap = Math.min(run.gap, 6.5);
    run.sprintT = 2.4;
    run.chasePause = 0;
    run.iframes = 0.7;
  }

  function collide(prevZ) {
    if (run.phase !== 'play') return;
    const lane = nearestLane(run.x);
    const spanStart = Math.min(prevZ, run.z);
    const spanEnd = Math.max(prevZ, run.z);
    for (const obj of active) {
      if (obj.gone || obj.cleared || obj.kind === 'ramp' || obj.kind === 'train') continue;
      const item = obj.kind === 'coin' || obj.kind === 'item';
      const pad = item ? 1.4 : 0.2;
      const near = obj.z + obj.len * 0.5 >= spanStart - pad && obj.z - obj.len * 0.5 <= spanEnd + pad;
      if (!near) continue;
      const reach = item ? 1.9 : (obj.half || 0.82);
      const sameLane = obj.lane == null || Math.abs(run.x - LANES[obj.lane]) < reach;
      if (run.fly > 0 && obj.kind !== 'coin' && obj.kind !== 'item') {
        obj.cleared = true;
        continue;
      }
      if (obj.kind === 'coin' || obj.kind === 'item') {
        if (!sameLane && run.magnet <= 0) continue;
        const feet = player.position.y;
        const y = obj.mesh.position.y;
        if (y >= 1.65) {
          const top = feet + (run.mode === 'sliding' ? 1.15 : 1.9);
          if (y < feet - 1.1 || y > top + 0.55) continue;
        }
        if (obj.kind === 'coin') {
          gainCoins(1);
          points(10);
          obj.gone = true;
          hooks.audio.coin();
        }
        if (obj.kind === 'item') takeItem(obj.item, obj.clip);
        obj.gone = true;
        continue;
      }
      if (!sameLane) continue;
        const result = resolveCollision({ ...run, feet: player.position.y }, obj.kind);
      if (result === 'pass') {
        if (obj.kind !== 'pit') obj.cleared = true;
        continue;
      }
      if (result === 'shatter') {
        points(25);
        obj.pop = 0.18;
        obj.cleared = true;
        hooks.audio.shatter();
        continue;
      }
      if (result === 'stumble') {
        obj.pop = 0.18;
        obj.cleared = true;
        bump();
        continue;
      }
      fail(obj.kind === 'pit' ? 'pit' : obj.kind === 'oncoming' ? 'train' : 'hit');
      return;
    }
  }

  function takeItem(name, clip) {
    hooks.audio.power();
    navigator.vibrate?.(16);
    if (name === 'magnet') run.magnet = itemDuration(name);
    if (name === 'shoes') {
      run.shoes = itemDuration(name);
      if (run.gap < 13) {
        points(20);
        run.gap = 13;
      }
    }
    if (name === 'star') run.inv = itemDuration(name);
    if (name === 'smoke') {
      run.smoke = itemDuration(name);
      run.gap += 15;
      points(30);
    }
    if (name === 'double') run.doubleRest = true;
    if (name === 'jet') run.fly = itemDuration(name);
    if (name === 'poop') {
      run.poop = itemDuration(name);
      hooks.onPoop?.(true);
    }
    if (name === 'shroom') {
      run.shroom = itemDuration(name);
      hooks.onShroom?.();
    }
    if (name === 'noodle') {
      const dur = clip ? Math.max(0.4, clip.end - clip.start) : 3.75;
      run.noodle = dur;
      hooks.onNoodle?.(clip || { src: 'assets/noodle.m4a', start: 0, end: 3.75 });
    }
    if (name === 'key') writeKeys(readKeys() + 1);
    if (name === 'chest') {
      const roll = Math.random();
      gainCoins(20);
      points(20);
      if (roll < 0.25) writeKeys(readKeys() + 1);
      else if (roll < 0.55) run.fly = 6;
      else if (roll < 0.8) run.shoes = 6;
      else run.doubleRest = true;
    }
  }

  function tickPlayer(dt, speed) {
    run.jumpCd = Math.max(0, run.jumpCd - dt);
    run.slideCd = Math.max(0, run.slideCd - dt);
    run.iframes = Math.max(0, run.iframes - dt);
    run.inv = Math.max(0, run.inv - dt);
    run.boost = Math.max(0, run.boost - dt);
    if (run.boost > 0) run.inv = Math.max(run.inv, run.boost);
    run.magnet = Math.max(0, run.magnet - dt);
    run.shoes = Math.max(0, run.shoes - dt);
    run.smoke = Math.max(0, run.smoke - dt);
    run.doubleT = Math.max(0, run.doubleT - dt);
    run.fly = Math.max(0, run.fly - dt);
    const hadPoop = run.poop > 0;
    run.poop = Math.max(0, run.poop - dt);
    if (hadPoop && run.poop <= 0) hooks.onPoop?.(false);
    run.shroom = Math.max(0, run.shroom - dt);
    run.noodle = Math.max(0, run.noodle - dt);
    if (playerSuit) playerSuit.visible = run.noodle > 0;
    if (playerMic) playerMic.visible = run.boost > 0;
    run.board = Math.max(0, run.board - dt);
    run.stumble = Math.max(0, run.stumble - dt);
    const target = LANES[run.lane];
    run.x += (target - run.x) * (1 - Math.exp(-28 * dt));
    if (run.mode === 'jumping') {
      run.modeT += dt;
      if (run.modeT >= 0.68) {
        run.mode = 'running';
        run.jumpCd = 0.04;
      }
    } else if (run.mode === 'sliding') {
      run.modeT += dt;
      if (run.modeT >= 0.58) {
        run.mode = 'running';
        run.slideCd = 0.04;
      }
    }
    const hop = run.mode === 'jumping' ? Math.sin(Math.min(1, run.modeT / 0.68) * Math.PI) * 3.15 * (run.shoes > 0 ? 1.35 : 1) : 0;
    const arc = run.fly > 0 ? Math.max(3.4, hop) : hop;
    const jump = arc;
    const stumbleMul = run.stumble > 0 ? 0.62 : 1;
    const shoeMul = run.shoes > 0 ? 1.4 : 1;
    const step = speed * stumbleMul * shoeMul * dt;
    run.z += step;
    run.distance += step;
    run.clean += step;
    points(step);
    const feet = run.mode === 'jumping' ? run.jumpBase + arc : run.floor;
    const ride = rideFloor(feet);
    if (ride.hit && !(run.boost > 0)) fail('train');
    if (run.phase === 'play') run.floor = ride.floor;
    const bodyY = run.fly > 0 ? 3.6 : run.mode === 'jumping' ? run.jumpBase + arc : run.floor;
    player.position.set(run.x, bodyY, run.z);
    const phase = run.distance * 1.55;
    const bob = run.mode === 'running' ? Math.abs(Math.sin(phase)) * 0.07 : 0;
    player.rotation.order = 'YXZ';
    player.rotation.y = Math.PI;
    player.rotation.z = (target - run.x) * -0.45;
    if (run.mode === 'sliding') {
      player.scale.set(1.08, 0.42, 1.2);
      player.rotation.x = 0.12;
      poseRig(playerRig, { legL: 0.7, legR: 0.7, armL: -0.45, armR: -0.45, head: 0.1, armZL: 0.12, armZR: -0.12 });
    } else if (run.mode === 'jumping') {
      const u = Math.min(1, run.modeT / 0.68);
      player.scale.set(1, 1, 1);
      if (u < 0.18) {
        player.rotation.x = 0.2;
        poseRig(playerRig, { legL: 0.8, legR: 0.8, armL: 0.4, armR: 0.4, head: 0.1, armZL: 0.2, armZR: -0.2 });
      } else if (u > 0.82) {
        player.rotation.x = 0.16;
        poseRig(playerRig, { legL: 0.55, legR: 0.55, armL: -0.2, armR: -0.2, head: 0.08, armZL: 0.1, armZR: -0.1 });
      } else {
        player.rotation.x = -0.2;
        poseRig(playerRig, { legL: -0.9, legR: -0.9, armL: 1.05, armR: 1.05, head: -0.15, armZL: 0.45, armZR: -0.45 });
      }
    } else {
      player.scale.set(1, 1, 1);
      const stride = runAngles(phase);
      if (run.poop > 0) {
        const laugh = Math.sin(run.distance * 9);
        player.rotation.x = 0.22 + laugh * 0.16;
        poseRig(playerRig, {
          legL: stride.legL,
          legR: stride.legR,
          armL: -0.4,
          armR: -0.4,
          head: -0.32 + laugh * 0.22,
          armZL: 0.75,
          armZR: -0.75,
        });
      } else {
        player.rotation.x = 0.08;
        poseRig(playerRig, stride);
      }
      if (run.poop <= 0 && run.shroom > 0) {
        const talk = Math.sin(run.distance * 14);
        player.rotation.x = 0.04;
        poseRig(playerRig, {
          legL: stride.legL,
          legR: stride.legR,
          armL: stride.armL,
          armR: stride.armR,
          head: talk * 0.2,
          armZL: stride.armZL,
          armZR: stride.armZR,
        });
      }
    }
    player.position.y += bob;
    shadow.position.set(run.x, run.floor + 0.04, run.z);
    shadow.scale.setScalar(run.mode === 'jumping' ? 0.7 : 1);
    const pulse = run.inv > 0 ? 0.55 + Math.sin(run.distance) * 0.15 : 0;
    for (const item of playerMats) {
      if (run.noodle > 0) {
        if (item.userData.uglyOn) {
          item.map = item.userData.prevMap || null;
          item.vertexColors = false;
          item.userData.uglyOn = false;
          item.needsUpdate = true;
        }
        item.color.set('#ffffff');
        item.emissive.set('#ffe08a');
        item.emissiveIntensity = 0;
      } else if (run.shroom > 0) {
        paintUgly(playerRig);
        if (!item.userData.uglyOn) {
          item.userData.prevMap = item.map || null;
          item.userData.uglyOn = true;
        }
        item.map = null;
        item.vertexColors = true;
        item.color.set('#ffffff');
        item.emissive.set('#000000');
        item.emissiveIntensity = 0;
        item.needsUpdate = true;
      } else {
        if (item.userData.uglyOn) {
          item.map = item.userData.prevMap || null;
          item.vertexColors = false;
          item.userData.uglyOn = false;
          item.needsUpdate = true;
        }
        if (run.poop > 0) {
          item.color.set('#6b3a1a');
          item.emissive.set('#4a2810');
          item.emissiveIntensity = 0.18;
        } else {
          item.color.set('#ffffff');
          item.emissive.set('#ffe08a');
          item.emissiveIntensity = pulse;
        }
      }
    }
    glow.intensity = run.inv > 0 ? 4 : 0;
    glow.position.set(run.x, 1.2 + jump, run.z);
  }

  function tickChaser(dt, speed) {
    if (run.distance > 500) run.sprintCd -= dt;
    else run.sprintCd -= dt * 0.55;
    if (run.sprintCd <= 0) {
      run.sprintT = 1.15;
      run.sprintCd = run.distance > 500 ? 7.5 : 13;
    }
    run.sprintT = Math.max(0, run.sprintT - dt);
    run.chasePause = Math.max(0, run.chasePause - dt);
    const actual = speed * (run.shoes > 0 ? 1.4 : 1) * (run.stumble > 0 ? 0.62 : 1);
    if (run.chasePause <= 0) {
      const stepped = stepChaser(run.gap, run.chaserSpeed, dt, actual, run.distance, {
        cruise: speed,
        sprint: run.sprintT > 0,
        smoked: run.smoke > 0,
      });
      run.gap = stepped.gap;
      run.chaserSpeed = stepped.speed;
    }
    if (run.boost > 0 && run.gap < 4) run.gap = 4;
    if (run.gap <= 0) fail('caught');
    chaser.visible = run.chasePause <= 0 && run.gap < 9;
    chaser.scale.setScalar(1);
    chaser.position.set(chaser.position.x + (run.x - chaser.position.x) * (1 - Math.exp(-4 * dt)), 0, run.z - Math.max(run.gap, 0.7));
    chaser.rotation.set(run.gap < 6 ? -0.4 : -0.1, 0, 0);
    poseRig(chaserRig, runAngles(run.distance * 1.55 + 1.2));
  }

  function tickWorld(dt) {
    const time = clock.elapsedTime;
    for (const obj of active) {
      const base = obj.mesh.userData.baseY || 0;
        if (obj.kind === 'coin' || obj.kind === 'item') {
        if (obj.item !== 'noodle') obj.mesh.rotation.y += dt * 2.4;
        obj.mesh.position.y = base + Math.sin(time * 3 + obj.z) * 0.12;
      }
      if (obj.kind === 'oncoming') {
        obj.z -= dt * (baseSpeed(run.distance) + 16);
        obj.mesh.position.z = obj.z;
      }
      if (obj.kind === 'coin' && run.magnet > 0) {
        const dx = run.x - obj.mesh.position.x;
        const dy = player.position.y + 0.9 - obj.mesh.position.y;
        const dz = run.z - obj.z;
        if (Math.hypot(dx, dz) < 14) {
          obj.mesh.position.x += dx * Math.min(1, dt * 6);
          obj.mesh.position.y += dy * Math.min(1, dt * 6);
          obj.mesh.userData.baseY = obj.mesh.position.y;
          obj.z += dz * Math.min(1, dt * 7);
          obj.mesh.position.z = obj.z;
          obj.lane = nearestLane(obj.mesh.position.x);
        }
      }
      if (obj.pop > 0) {
        obj.pop -= dt;
        obj.mesh.scale.setScalar(Math.max(0.01, obj.pop / 0.18));
        if (obj.pop <= 0) obj.gone = true;
      }
      if (obj.z < run.z - 16) obj.gone = true;
    }
    for (let i = active.length - 1; i >= 0; i -= 1) {
      if (!active[i].gone) continue;
      give(active[i]);
      active.splice(i, 1);
    }
  }

  function resize() {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(1, height);
    camera.fov = height > width ? 48 : 44;
    camera.updateProjectionMatrix();
  }

  const LAUGH_BEND = [
    [0, 0.72],
    [0.35, 1.15],
    [1.05, 1.02],
    [1.7, 0.18],
    [2.15, -0.5],
    [2.8, 0.12],
    [3.45, 0.92],
    [4.35, 0.7],
    [5.15, 0.98],
    [6.3, 0.36],
  ];

  function bendAt(t) {
    if (t <= LAUGH_BEND[0][0]) return LAUGH_BEND[0][1];
    for (let i = 1; i < LAUGH_BEND.length; i += 1) {
      if (t > LAUGH_BEND[i][0]) continue;
      const [t0, v0] = LAUGH_BEND[i - 1];
      const [t1, v1] = LAUGH_BEND[i];
      const u = (t - t0) / (t1 - t0);
      return v0 + (v1 - v0) * u;
    }
    return LAUGH_BEND[LAUGH_BEND.length - 1][1];
  }

  let laughT = -1;
  let laughDur = 6.1;
  let laughTold = false;

  function applyLaugh(t, level, anchor) {
    const bend = bendAt(Math.min(t, laughDur)) * 0.78;
    const shake = Math.sin(t * 22) * (0.03 + level * 0.08);
    player.rotation.set(bend, 0, shake);
    player.scale.set(1, 1, 1);
    player.position.set(anchor?.x ?? 0, Math.abs(Math.sin(t * 16)) * 0.025, anchor?.z ?? 0);
    const clutch = 0.55 + level * 0.45;
    poseRig(playerRig, {
      legL: 0.12,
      legR: -0.08,
      armL: -0.25,
      armR: -0.25,
      armZL: clutch,
      armZR: -clutch,
      head: -0.28 - level * 0.2,
    });
  }

  function frameCamera() {
    camera.position.set(run.x * 0.12, 5.15, run.z - 7.6);
    camera.lookAt(run.x * 0.2, 0.72 + run.floor * 0.25, run.z + 6.2);
  }

  function rideFloor(feet) {
    const lane = nearestLane(run.x);
    let floor = 0;
    let hit = false;
    for (const obj of active) {
      if (obj.gone || (obj.kind !== 'ramp' && obj.kind !== 'train')) continue;
      if (obj.lane != null && obj.lane !== lane) continue;
      const z0 = obj.z - obj.len * 0.5;
      const z1 = obj.z + obj.len * 0.5;
      if (run.z < z0 || run.z > z1) continue;
      if (obj.kind === 'ramp') {
        const t = (run.z - z0) / Math.max(0.001, obj.len);
        floor = Math.max(floor, obj.dir < 0 ? obj.roof * (1 - t) : obj.roof * t);
      } else if (run.mode === 'jumping' || run.fly > 0 || run.inv > 0 || feet >= obj.roof - 0.85 || run.floor >= obj.roof - 0.18) {
        floor = Math.max(floor, obj.roof);
      } else {
        hit = true;
        obj.cleared = true;
      }
    }
    return { floor, hit };
  }

  function paintTrack() {
    const ahead = run.z + 16;
    track.position.set(0, 0.01, ahead);
    grass.position.set(0, -0.04, ahead);
    track.material.map.offset.y = -run.z / 8;
    const span = STREET_SPAN * street.length;
    const back = run.z - 28;
    for (const block of street) {
      let z = block.userData.home;
      while (z < back) z += span;
      block.position.z = z;
    }
  }

  function hud() {
    const effects = [];
    if (run.magnet > 0) effects.push({ name: '磁力', t: run.magnet });
    if (run.shoes > 0) effects.push({ name: '加速', t: run.shoes });
    if (run.inv > 0) effects.push({ name: '无敌', t: run.inv });
    if (run.smoke > 0) effects.push({ name: '烟雾', t: run.smoke });
    if (run.doubleT > 0 || run.doubleRest) effects.push({ name: '双倍', t: run.doubleRest ? 0 : run.doubleT });
    if (run.fly > 0) effects.push({ name: '飞行', t: run.fly });
    if (run.poop > 0) effects.push({ name: '便便', t: run.poop });
    if (run.shroom > 0) effects.push({ name: '蘑菇', t: run.shroom });
    if (run.noodle > 0) effects.push({ name: '牛肉面', t: run.noodle });
    if (run.boost > 0) effects.push({ name: '话筒', t: run.boost });
    if (run.board > 0) effects.push({ name: '滑板', t: run.board });
    hooks.onHud({
      score: Math.floor(run.score),
      distance: Math.floor(run.distance),
      coins: run.coins,
      keys: readKeys(),
      jets: readJets(),
      boosts: readBoosts(),
      hero: heroId,
      combo: comboMultiplier(run.clean),
      gap: run.gap,
      mood: chaserMood(run.gap),
      effects,
      live: run.phase === 'play',
    });
  }

  function finish() {
    const best = readBest();
    const score = Math.floor(run.score);
    const isBest = score > best && score > 0;
    if (isBest) writeBest(score);
    hooks.onOver({
      reason: run.reason,
      score,
      distance: Math.floor(run.distance),
      coins: run.coins,
      keys: readKeys(),
      jets: readJets(),
      best: isBest ? score : best,
      isBest,
    });
  }

  function loop() {
    const dt = Math.min(clock.getDelta(), 0.05);
    if (!modelReady) {
      renderer.render(scene, camera);
      requestAnimationFrame(loop);
      return;
    }
    if (run.phase === 'title') {
      chaser.visible = false;
      const level = hooks.laughLevel ? hooks.laughLevel() : 0;
      if (laughT >= 0) {
        laughT += dt;
        applyLaugh(laughT, level);
        if (!laughTold && laughT >= laughDur) {
          laughTold = true;
          hooks.onLaughEnd?.();
        }
      } else {
        const breathe = Math.sin(clock.elapsedTime * 2.2);
        player.rotation.set(0.04, 0, 0);
        player.scale.set(1, 1, 1);
        player.position.set(0, breathe * 0.015, 0);
        poseRig(playerRig, { legL: 0, legR: 0, armL: 0.05, armR: 0.05, head: breathe * 0.04, armZL: 0.1, armZR: -0.1 });
      }
      faceCamera(0, 0);
      paintTrack();
      shadow.position.set(0, 0.04, 0);
      renderer.render(scene, camera);
      requestAnimationFrame(loop);
      return;
    }
    if (run.phase === 'ending') {
      run.endT += dt;
      chaser.visible = false;
      const x = run.deathX;
      const z = run.deathZ;
      const level = hooks.laughLevel ? hooks.laughLevel() : 0;
      if (run.endT < 0.4) {
        const u = run.endT / 0.4;
        player.rotation.order = 'YXZ';
        player.rotation.set(-1.15 * u, 0, 0.2 * u);
        player.scale.set(1.12, 1 - u * 0.62, 1.25);
        player.position.set(x, 0.02, z);
        poseRig(playerRig, { legL: 0.9 * u, legR: 0.7 * u, armL: 0.6 * u, armR: -0.4 * u, head: 0.25 * u, armZL: 0.2, armZR: -0.15 });
      } else if (run.endT < 0.9) {
        player.rotation.set(-1.15, 0, 0.2);
        player.scale.set(1.12, 0.38, 1.25);
        player.position.set(x, 0.02, z);
        poseRig(playerRig, { legL: 0.9, legR: 0.7, armL: 0.6, armR: -0.4, head: 0.25, armZL: 0.2, armZR: -0.15 });
      } else if (run.endT < 1.08) {
        player.rotation.set(0, 0, 0);
        player.scale.set(1, 1, 1);
        player.position.set(x, 0, z);
        poseRig(playerRig, { legL: 0, legR: 0, armL: 0.05, armR: 0.05, head: 0, armZL: 0.1, armZR: -0.1 });
      } else {
        if (!run.deathLaugh) {
          run.deathLaugh = true;
          if (heroId === 'tao') laughDur = 1.15;
          laughT = 0;
          laughTold = false;
          hooks.onDeathLaugh?.();
        }
        laughT += dt;
        applyLaugh(laughT, level, { x, z });
        if (!laughTold && laughT >= laughDur) {
          laughTold = true;
          run.reported = true;
          run.phase = 'over';
          finish();
        }
      }
      faceCamera(x, z);
      shadow.position.set(player.position.x, 0.04, player.position.z);
      paintTrack();
      renderer.render(scene, camera);
      requestAnimationFrame(loop);
      return;
    }
    if (run.phase === 'play') {
      const speed = baseSpeed(run.distance);
      const prevZ = run.z;
      tickPlayer(dt, speed);
      tickChaser(dt, speed);
      if (run.phase === 'play') {
        extendTrack();
        maybeItem(dt);
        tickWorld(dt);
        collide(prevZ);
      }
      const mood = chaserMood(run.gap);
      beatIn -= dt;
      if (mood !== 'safe' && beatIn <= 0 && run.phase === 'play') {
        hooks.audio.heartbeat();
        beatIn = mood === 'danger' ? 0.36 : 0.7;
      }
      hud();
    }
    frameCamera();
    paintTrack();
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }

  resize();
  window.addEventListener('resize', resize);
  let orbitDrag = null;
  window.addEventListener('pointerdown', (event) => {
    if (run.phase !== 'title' || laughT >= 0) return;
    if (event.target instanceof Element && event.target.closest('button, a, #cast, #store, #sheet')) return;
    orbitDrag = { id: event.pointerId, x: event.clientX, y: event.clientY };
  });
  window.addEventListener('pointermove', (event) => {
    if (!orbitDrag || event.pointerId !== orbitDrag.id) return;
    showcaseYaw -= (event.clientX - orbitDrag.x) * 0.018;
    showcasePitch = Math.max(0.02, Math.min(0.9, showcasePitch + (event.clientY - orbitDrag.y) * 0.004));
    orbitDrag.x = event.clientX;
    orbitDrag.y = event.clientY;
  });
  const endOrbit = (event) => {
    if (orbitDrag && event.pointerId === orbitDrag.id) orbitDrag = null;
  };
  window.addEventListener('pointerup', endOrbit);
  window.addEventListener('pointercancel', endOrbit);
  loop();

  return {
    hero() {
      return heroId;
    },
    setHero(id) {
      heroId = normalizeHero(id);
      writeHero(heroId);
      showcaseYaw = 0;
      showcasePitch = 0.22;
      if (modelReady && (run.phase === 'title' || run.phase === 'over')) mountFrogs(heroSource());
      return heroId;
    },
    playLaugh(duration) {
      laughDur = Number.isFinite(duration) && duration > 0.5 ? duration : 6.1;
      laughT = 0;
      laughTold = false;
      run.phase = 'title';
    },
    swipe(dir) {
      if (run.phase !== 'play') return;
      if (dir === 'right') run.lane = clampLane(run.lane - 1);
      if (dir === 'left') run.lane = clampLane(run.lane + 1);
      if (dir === 'down' && run.jumpCd <= 0 && run.mode !== 'jumping') {
        run.mode = 'jumping';
        run.modeT = 0;
        run.jumpBase = run.floor;
        run.iframes = 0.16;
        hooks.audio.jump();
      }
      if (dir === 'up' && run.slideCd <= 0 && run.mode !== 'sliding') {
        run.mode = 'sliding';
        run.modeT = 0;
        hooks.audio.slide();
      }
    },
    start() {
      releaseAll();
      run = freshRun();
      run.phase = 'play';
      run.chaserSpeed = baseSpeed(0);
      chaser.visible = true;
      chaser.position.set(0, 0, -5);
      chaser.rotation.set(-0.08, 0, 0);
      chaser.scale.set(1, 1, 1);
      player.scale.set(1, 1, 1);
      player.rotation.set(0.05, Math.PI, 0);
      laughT = -1;
      extendTrack();
      hud();
    },
    skate() {
      if (run.phase !== 'play' || run.board > 0) return;
      run.board = 8;
    },
    wallet() {
      return { coins: readCoins(), keys: readKeys(), jets: readJets(), boosts: readBoosts() };
    },
    buyKey() {
      const next = buyKey(readCoins(), readKeys());
      if (!next.ok) return next;
      writeCoins(next.coins);
      writeKeys(next.keys);
      return next;
    },
    buyJet() {
      const next = buyKey(readCoins(), readJets(), JET_PRICE);
      if (!next.ok) return { coins: next.coins, jets: readJets(), ok: false };
      writeCoins(next.coins);
      writeJets(next.keys);
      return { coins: next.coins, jets: next.keys, ok: true };
    },
    useJet() {
      if (run.phase !== 'play' || readJets() < 1) return false;
      writeJets(readJets() - 1);
      run.fly = itemDuration('jet');
      hooks.audio.power();
      hud();
      return true;
    },
    buyBoost() {
      const next = buyKey(readCoins(), readBoosts(), BOOST_PRICE);
      if (!next.ok) return { coins: next.coins, boosts: readBoosts(), ok: false };
      writeCoins(next.coins);
      writeBoosts(next.keys);
      return { coins: next.coins, boosts: next.keys, ok: true };
    },
    useBoost(seconds) {
      if (run.phase !== 'play' || run.boost > 0 || readBoosts() < 1) return false;
      writeBoosts(readBoosts() - 1);
      const dur = Number.isFinite(seconds) && seconds > 0.4 ? seconds : 8.6;
      run.boost = dur;
      run.inv = Math.max(run.inv, dur);
      if (run.gap < 4) run.gap = 4;
      hud();
      return true;
    },
    showTitle() {
      run.phase = 'title';
      laughT = -1;
      chaser.visible = false;
    },
    revive() {
      if (run.phase !== 'over' || readKeys() < 1) return false;
      writeKeys(readKeys() - 1);
      run.phase = 'play';
      run.bumps = 0;
      run.gap = 12;
      run.chasePause = 1.2;
      run.iframes = 1.2;
      run.stumble = 0;
      run.reason = '';
      run.reported = false;
      player.position.y = run.floor;
      hud();
      return true;
    },
  };
}
