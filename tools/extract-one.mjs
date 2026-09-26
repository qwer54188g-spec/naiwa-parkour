import fs from 'node:fs';

const srcPath = 'public/assets/frog.glb';
const buf = fs.readFileSync(srcPath);
const jsonLen = buf.readUInt32LE(12);
const json = JSON.parse(buf.slice(20, 20 + jsonLen).toString('utf8'));
const binStart = 20 + jsonLen + 8;

function readView(accessorIndex) {
  const acc = json.accessors[accessorIndex];
  const view = json.bufferViews[acc.bufferView];
  const start = binStart + (view.byteOffset || 0) + (acc.byteOffset || 0);
  return { acc, start };
}

const pos = readView(0);
const nrm = readView(1);
const uv = readView(2);
const idx = readView(3);
const vcount = pos.acc.count;
const positions = new Float32Array(vcount * 3);
const normals = new Float32Array(vcount * 3);
const uvs = new Float32Array(vcount * 2);
Buffer.from(positions.buffer).set(buf.subarray(pos.start, pos.start + vcount * 12));
Buffer.from(normals.buffer).set(buf.subarray(nrm.start, nrm.start + vcount * 12));
Buffer.from(uvs.buffer).set(buf.subarray(uv.start, uv.start + vcount * 8));

const icount = idx.acc.count;
const index16 = idx.acc.componentType === 5123;
const indices = index16 ? new Uint16Array(icount) : new Uint32Array(icount);
const stride = index16 ? 2 : 4;
const raw = buf.subarray(idx.start, idx.start + icount * stride);
if (index16) {
  for (let i = 0; i < icount; i += 1) indices[i] = buf.readUInt16LE(idx.start + i * 2);
} else {
  Buffer.from(indices.buffer).set(raw);
}

const tris = icount / 3;
const cx = new Float32Array(tris);
for (let t = 0; t < tris; t += 1) {
  const a = indices[t * 3];
  const b = indices[t * 3 + 1];
  const c = indices[t * 3 + 2];
  cx[t] = (positions[a * 3] + positions[b * 3] + positions[c * 3]) / 3;
}
const sorted = Float32Array.from(cx).sort();
let centers = [sorted[tris * 0.16], sorted[tris * 0.5], sorted[tris * 0.84]];
const assign = new Int16Array(tris);
for (let iter = 0; iter < 16; iter += 1) {
  const sum = [0, 0, 0];
  const n = [0, 0, 0];
  for (let t = 0; t < tris; t += 1) {
    let best = 0;
    let dist = Infinity;
    for (let k = 0; k < 3; k += 1) {
      const d = Math.abs(cx[t] - centers[k]);
      if (d < dist) {
        dist = d;
        best = k;
      }
    }
    assign[t] = best;
    sum[best] += cx[t];
    n[best] += 1;
  }
  for (let k = 0; k < 3; k += 1) if (n[k]) centers[k] = sum[k] / n[k];
}
const keep = centers.indexOf(Math.min(...centers));
console.log('centers', centers, 'keep', keep);

const remap = new Int32Array(vcount).fill(-1);
const nextPos = [];
const nextNrm = [];
const nextUv = [];
const nextIdx = [];
function use(v) {
  let id = remap[v];
  if (id >= 0) return id;
  id = nextPos.length / 3;
  remap[v] = id;
  nextPos.push(positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]);
  nextNrm.push(normals[v * 3], normals[v * 3 + 1], normals[v * 3 + 2]);
  nextUv.push(uvs[v * 2], uvs[v * 2 + 1]);
  return id;
}
for (let t = 0; t < tris; t += 1) {
  if (assign[t] !== keep) continue;
  nextIdx.push(use(indices[t * 3]), use(indices[t * 3 + 1]), use(indices[t * 3 + 2]));
}

let minY = Infinity;
let maxY = -Infinity;
let hnx = 0;
let hnz = 0;
let hn = 0;
for (let i = 0; i < nextPos.length; i += 3) {
  minY = Math.min(minY, nextPos[i + 1]);
  maxY = Math.max(maxY, nextPos[i + 1]);
}
const headCut = minY + (maxY - minY) * 0.62;
for (let i = 0; i < nextPos.length; i += 3) {
  if (nextPos[i + 1] < headCut) continue;
  hnx += nextNrm[i];
  hnz += nextNrm[i + 2];
  hn += 1;
}
hnx /= hn || 1;
hnz /= hn || 1;

function rotY(x, y, z, yaw) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return [x * c + z * s, y, -x * s + z * c];
}
let bestYaw = 0;
let bestScore = -Infinity;
for (let deg = 0; deg < 360; deg += 1) {
  const yaw = (deg * Math.PI) / 180;
  const turned = rotY(hnx, 0, hnz, yaw);
  const score = -turned[2] - Math.abs(turned[0]) * 1.4;
  if (score > bestScore) {
    bestScore = score;
    bestYaw = yaw;
  }
}
console.log('head normal', hnx, hnz, 'yaw deg', (bestYaw * 180) / Math.PI);

for (let i = 0; i < nextPos.length; i += 3) {
  const p = rotY(nextPos[i], nextPos[i + 1], nextPos[i + 2], bestYaw);
  const n = rotY(nextNrm[i], nextNrm[i + 1], nextNrm[i + 2], bestYaw);
  nextPos[i] = p[0];
  nextPos[i + 1] = p[1];
  nextPos[i + 2] = p[2];
  nextNrm[i] = n[0];
  nextNrm[i + 1] = n[1];
  nextNrm[i + 2] = n[2];
}

let ax = 0;
let az = 0;
minY = Infinity;
const vertCount = nextPos.length / 3;
for (let i = 0; i < nextPos.length; i += 3) {
  ax += nextPos[i];
  az += nextPos[i + 2];
  minY = Math.min(minY, nextPos[i + 1]);
}
ax /= vertCount;
az /= vertCount;
let min = [Infinity, Infinity, Infinity];
let max = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < nextPos.length; i += 3) {
  nextPos[i] -= ax;
  nextPos[i + 1] -= minY;
  nextPos[i + 2] -= az;
  for (let k = 0; k < 3; k += 1) {
    min[k] = Math.min(min[k], nextPos[i + k]);
    max[k] = Math.max(max[k], nextPos[i + k]);
  }
}
console.log('one frog', { verts: vertCount, tris: nextIdx.length / 3, min, max });

const imageView = json.bufferViews[json.images[0].bufferView];
const image = buf.subarray(binStart + imageView.byteOffset, binStart + imageView.byteOffset + imageView.byteLength);
const outPos = Float32Array.from(nextPos);
const outNrm = Float32Array.from(nextNrm);
const outUv = Float32Array.from(nextUv);
const outIdx = Uint16Array.from(nextIdx);

function pad4(n) {
  return (4 - (n % 4)) % 4;
}
const chunks = [
  Buffer.from(image),
  Buffer.from(outPos.buffer),
  Buffer.from(outNrm.buffer),
  Buffer.from(outUv.buffer),
  Buffer.from(outIdx.buffer),
];
const views = [];
let offset = 0;
const binParts = [];
chunks.forEach((part, i) => {
  views.push({ buffer: 0, byteOffset: offset, byteLength: part.length });
  binParts.push(part);
  const p = pad4(part.length);
  if (p) binParts.push(Buffer.alloc(p));
  offset += part.length + p;
  if (i > 0 && i < 4) views[i].target = 34962;
  if (i === 4) views[i].target = 34963;
});
const bin = Buffer.concat(binParts);
const gltf = {
  asset: { version: '2.0', generator: 'naiwa-parkour' },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ name: 'naiwa', mesh: 0 }],
  meshes: [
    {
      name: 'naiwa',
      primitives: [
        {
          attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 },
          indices: 3,
          material: 0,
        },
      ],
    },
  ],
  materials: [
    {
      name: 'naiwa',
      doubleSided: true,
      pbrMetallicRoughness: {
        baseColorTexture: { index: 0 },
        metallicFactor: 0,
        roughnessFactor: 0.58,
      },
    },
  ],
  textures: [{ sampler: 0, source: 0 }],
  images: [{ mimeType: 'image/jpeg', bufferView: 0 }],
  samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }],
  buffers: [{ byteLength: bin.length }],
  bufferViews: views,
  accessors: [
    { bufferView: 1, componentType: 5126, count: vertCount, type: 'VEC3', min, max },
    { bufferView: 2, componentType: 5126, count: vertCount, type: 'VEC3' },
    { bufferView: 3, componentType: 5126, count: vertCount, type: 'VEC2' },
    { bufferView: 4, componentType: 5123, count: outIdx.length, type: 'SCALAR' },
  ],
};
const jsonBuf = Buffer.from(JSON.stringify(gltf));
const jsonChunk = Buffer.concat([jsonBuf, Buffer.alloc(pad4(jsonBuf.length), 0x20)]);
const binChunk = Buffer.concat([bin, Buffer.alloc(pad4(bin.length))]);
const total = 12 + 8 + jsonChunk.length + 8 + binChunk.length;
const out = Buffer.alloc(total);
out.write('glTF', 0);
out.writeUInt32LE(2, 4);
out.writeUInt32LE(total, 8);
let o = 12;
out.writeUInt32LE(jsonChunk.length, o);
out.writeUInt32LE(0x4e4f534a, o + 4);
jsonChunk.copy(out, o + 8);
o += 8 + jsonChunk.length;
out.writeUInt32LE(binChunk.length, o);
out.writeUInt32LE(0x004e4942, o + 4);
binChunk.copy(out, o + 8);
fs.writeFileSync(srcPath, out);
console.log('wrote', srcPath, out.length);
