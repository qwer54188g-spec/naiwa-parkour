import fs from 'node:fs';
import path from 'node:path';
import { MeshoptSimplifier } from 'file:///C:/Users/22826/Downloads/_frog_tools/node_modules/meshoptimizer/meshopt_simplifier.js';

const srcPath = 'C:/Users/22826/Downloads/stylized creature 3d model.glb';
const outPath = path.resolve('public/assets/frog.glb');

await MeshoptSimplifier.ready;

const buf = fs.readFileSync(srcPath);
const jsonLen = buf.readUInt32LE(12);
const json = JSON.parse(buf.slice(20, 20 + jsonLen).toString('utf8'));
const binStart = 20 + jsonLen + 8;

function readAccessor(index) {
  const acc = json.accessors[index];
  const view = json.bufferViews[acc.bufferView];
  const start = binStart + (view.byteOffset || 0) + (acc.byteOffset || 0);
  const comps = { SCALAR: 1, VEC2: 2, VEC3: 3 }[acc.type];
  return { acc, start, comps, count: acc.count };
}

const pos = readAccessor(0);
const nrm = readAccessor(1);
const uv = readAccessor(2);
const idx = readAccessor(3);

const positions = new Float32Array(pos.count * 3);
const normals = new Float32Array(nrm.count * 3);
const uvs = new Float32Array(uv.count * 2);
const indices = new Uint32Array(idx.count);

const posBytes = buf.subarray(pos.start, pos.start + pos.count * 12);
Buffer.from(positions.buffer).set(posBytes);
const nrmBytes = buf.subarray(nrm.start, nrm.start + nrm.count * 12);
Buffer.from(normals.buffer).set(nrmBytes);
const uvBytes = buf.subarray(uv.start, uv.start + uv.count * 8);
Buffer.from(uvs.buffer).set(uvBytes);
const idxBytes = buf.subarray(idx.start, idx.start + idx.count * 4);
Buffer.from(indices.buffer).set(idxBytes);

console.log('source tris', indices.length / 3, 'verts', pos.count);

const target = 36000;
let current = indices;
let error = 1;
for (let pass = 0; pass < 5 && current.length > target * 1.05; pass += 1) {
  const allow = 0.02 + pass * 0.02;
  const started = Date.now();
  const [next, err] = MeshoptSimplifier.simplify(current, positions, 3, target, allow);
  current = next;
  error = err;
  console.log('pass', pass, 'indices', current.length, 'error', err, 'ms', Date.now() - started);
}

const [remap, unique] = MeshoptSimplifier.compactMesh(current);
const missing = 2 ** 32 - 1;
const outPos = new Float32Array(unique * 3);
const outNrm = new Float32Array(unique * 3);
const outUv = new Float32Array(unique * 2);
for (let old = 0; old < remap.length; old += 1) {
  const ni = remap[old];
  if (ni === missing) continue;
  outPos[ni * 3] = positions[old * 3];
  outPos[ni * 3 + 1] = positions[old * 3 + 1];
  outPos[ni * 3 + 2] = positions[old * 3 + 2];
  outNrm[ni * 3] = normals[old * 3];
  outNrm[ni * 3 + 1] = normals[old * 3 + 1];
  outNrm[ni * 3 + 2] = normals[old * 3 + 2];
  outUv[ni * 2] = uvs[old * 2];
  outUv[ni * 2 + 1] = uvs[old * 2 + 1];
}

let min = [Infinity, Infinity, Infinity];
let max = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < unique; i += 1) {
  for (let k = 0; k < 3; k += 1) {
    min[k] = Math.min(min[k], outPos[i * 3 + k]);
    max[k] = Math.max(max[k], outPos[i * 3 + k]);
  }
}

const imageView = json.bufferViews[json.images[0].bufferView];
const image = buf.subarray(binStart + imageView.byteOffset, binStart + imageView.byteOffset + imageView.byteLength);

const index16 = unique < 65536;
const indexArray = index16 ? Uint16Array.from(current) : current;
const indexBytesOut = Buffer.from(indexArray.buffer, indexArray.byteOffset, indexArray.byteLength);

function pad4(n) {
  return (4 - (n % 4)) % 4;
}

const chunks = [
  Buffer.from(image),
  Buffer.from(outPos.buffer),
  Buffer.from(outNrm.buffer),
  Buffer.from(outUv.buffer),
  indexBytesOut,
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
  if (i === 3) views[i].target = 34962;
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
      pbrMetallicRoughness: {
        baseColorTexture: { index: 0 },
        metallicFactor: 0,
        roughnessFactor: 0.62,
      },
    },
  ],
  textures: [{ sampler: 0, source: 0 }],
  images: [{ mimeType: 'image/jpeg', bufferView: 0 }],
  samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }],
  buffers: [{ byteLength: bin.length }],
  bufferViews: views,
  accessors: [
    { bufferView: 1, componentType: 5126, count: unique, type: 'VEC3', min, max },
    { bufferView: 2, componentType: 5126, count: unique, type: 'VEC3' },
    { bufferView: 3, componentType: 5126, count: unique, type: 'VEC2' },
    {
      bufferView: 4,
      componentType: index16 ? 5123 : 5125,
      count: indexArray.length,
      type: 'SCALAR',
    },
  ],
};

const jsonBuf = Buffer.from(JSON.stringify(gltf));
const jsonPad = Buffer.alloc(pad4(jsonBuf.length), 0x20);
const jsonChunk = Buffer.concat([jsonBuf, jsonPad]);
const binPad = Buffer.alloc(pad4(bin.length));
const binChunk = Buffer.concat([bin, binPad]);
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

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, out);
console.log('wrote', outPath, out.length, 'unique', unique, 'tris', current.length / 3, 'error', error);
