import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profile = path.join(os.tmpdir(), 'naiwa-chrome');
const port = 9334;
fs.rmSync(profile, { recursive: true, force: true });
const child = spawn(chrome, [
  '--headless=new',
  '--disable-gpu',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  '--window-size=1280,800',
  'about:blank',
], { stdio: 'ignore' });

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function jsonList() {
  const res = await fetch(`http://127.0.0.1:${port}/json`);
  return res.json();
}

let page = null;
for (let i = 0; i < 40 && !page; i += 1) {
  try {
    const tabs = await jsonList();
    page = tabs.find((tab) => tab.type === 'page' && tab.webSocketDebuggerUrl);
  } catch {
    page = null;
  }
  if (!page) await sleep(150);
}
if (!page) throw new Error('no chrome tab');

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve);
  ws.addEventListener('error', reject);
});

let seq = 0;
const pending = new Map();
ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
});

function send(method, params = {}) {
  const id = ++seq;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve) => pending.set(id, resolve));
}

await send('Page.enable');
await send('Runtime.enable');
await send('Page.navigate', { url: 'http://localhost:4173/?v=5' });
await sleep(1200);

async function evalJs(expression) {
  const msg = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  return msg.result?.result?.value;
}

await evalJs(`new Promise((resolve) => { const start = Date.now(); const id = setInterval(() => { const b = document.querySelector('#start'); if (b && !b.disabled) { clearInterval(id); resolve(b.textContent); } else if (Date.now()-start>8000) { clearInterval(id); resolve('timeout'); } }, 50); })`);

async function shot(name) {
  const msg = await send('Page.captureScreenshot', { format: 'png' });
  const file = path.resolve('tools', name);
  fs.writeFileSync(file, Buffer.from(msg.result.data, 'base64'));
  console.log('shot', name);
}

await shot('idle.png');
await evalJs(`document.querySelector('#start').click()`);
const ready = await evalJs(`new Promise((resolve) => { const start = Date.now(); const id = setInterval(() => { const b = document.querySelector('#start'); if (b && b.textContent === '开始跑') { clearInterval(id); resolve('ready'); } else if (Date.now()-start>9000) { clearInterval(id); resolve(b.textContent); } }, 80); })`);
console.log('ready', ready);
await evalJs(`document.querySelector('#start').click()`);
await sleep(700);
await shot('run.png');
await evalJs(`
  const x = innerWidth * 0.62, y = innerHeight * 0.4;
  window.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: x, clientY: y, pointerId: 7 }));
  window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: x - 180, clientY: y + 4, pointerId: 7 }));
  window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: x - 180, clientY: y + 4, pointerId: 7 }));
  'swiped'
`);
await sleep(500);
await shot('lane.png');
ws.close();
child.kill();
process.exit(0);
