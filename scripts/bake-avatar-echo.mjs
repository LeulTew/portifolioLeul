import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'meshoptimizer';
import { getPixels } from 'ndarray-pixels';

const source = new URL('../public/models/me-animated-lite.glb', import.meta.url);
const destination = new URL('../src/data/avatar-echo.json', import.meta.url);
const bytes = await readFile(source);
const jsonLength = bytes.readUInt32LE(12);
const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
const image = json.images[0];
const imageView = json.bufferViews[image.bufferView];
const imageStart = 28 + jsonLength + (imageView.byteOffset || 0);
const pixels = await getPixels(bytes.subarray(imageStart, imageStart + imageView.byteLength), image.mimeType);
// This in-memory copy needs skinning, not textures. The source GLB is never written.
for (const mesh of json.meshes) for (const primitive of mesh.primitives) delete primitive.material;
const text = Buffer.from(JSON.stringify(json));
const padded = Buffer.alloc(Math.ceil(text.length / 4) * 4, 0x20);
text.copy(padded);
const binary = bytes.subarray(20 + jsonLength);
const geometryOnly = Buffer.alloc(20 + padded.length + binary.length);
bytes.copy(geometryOnly, 0, 0, 20);
geometryOnly.writeUInt32LE(geometryOnly.length, 8);
geometryOnly.writeUInt32LE(padded.length, 12);
padded.copy(geometryOnly, 20);
binary.copy(geometryOnly, 20 + padded.length);
await MeshoptDecoder.ready;
const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
  .parseAsync(geometryOnly.buffer, '');
const root = new THREE.Group();
root.position.set(22, -2.5, -15);
root.rotation.y = Math.PI / 0.55;
root.scale.setScalar(8);
root.add(gltf.scene);
const mesh = gltf.scene.getObjectByProperty('isSkinnedMesh', true);
if (!mesh || gltf.animations.length !== 1) throw new Error('Expected the original rig and its single greeting clip.');
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
camera.position.set(0, 12, 34);
camera.lookAt(0, 0, -14);
camera.updateMatrixWorld(true);
const mixer = new THREE.AnimationMixer(gltf.scene);
mixer.clipAction(gltf.animations[0]).play();
const duration = gltf.animations[0].duration;
const frameCount = 42;
const pointCount = 160;
const detailLayers = [
  { name: 'skin', counts: [24] },
  { name: 'ink', counts: [24, 20, 8, 8, 8, 8] },
  { name: 'coat', counts: [28] },
  { name: 'shirt', counts: [16] },
];
const vertex = new THREE.Vector3();
const frames = [];
const indices = mesh.geometry.index.array;
const uv = mesh.geometry.attributes.uv;
const joints = mesh.geometry.attributes.skinIndex;
const weights = mesh.geometry.attributes.skinWeight;
const regions = new Float32Array(mesh.geometry.attributes.position.count * 2);
for (let i = 0; i < regions.length / 2; i++) {
  for (let component = 0; component < 4; component++) {
    const bone = mesh.skeleton.bones[joints.getComponent(i, component)].name;
    const weight = weights.getComponent(i, component);
    if (/Head|Neck/.test(bone)) regions[i * 2] += weight;
    if (/Spine/.test(bone)) regions[i * 2 + 1] += weight;
  }
}
let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
for (let frame = 0; frame < frameCount; frame++) {
  mixer.setTime(frame / frameCount * duration);
  root.updateMatrixWorld(true);
  const projected = new Float32Array(mesh.geometry.attributes.position.count * 2);
  const depth = new Float32Array(projected.length / 2);
  const reciprocal = new Float32Array(projected.length / 2);
  for (let i = 0; i < projected.length / 2; i++) {
    mesh.getVertexPosition(i, vertex).applyMatrix4(mesh.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
    reciprocal[i] = -1 / vertex.z;
    vertex.applyMatrix4(camera.projectionMatrix);
    const x = 500 + vertex.x * 500, y = 500 - vertex.y * 500;
    projected[i * 2] = x;
    projected[i * 2 + 1] = y;
    depth[i] = vertex.z;
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  frames.push({ projected, depth, reciprocal });
}
minX -= 1; minY -= 1; maxX += 1; maxY += 1;
const scale = 510 / (maxY - minY);
const width = Math.ceil((maxX - minX) * scale) + 2;
const height = 512;

function rasterize({ projected, depth, reciprocal }) {
  const mask = new Uint8Array(width * height);
  const zBuffer = new Float32Array(width * height).fill(Infinity);
  const detail = detailLayers.map(() => new Uint8Array(mask.length));
  const points = new Float32Array(projected.length);
  for (let i = 0; i < points.length; i += 2) {
    points[i] = (projected[i] - minX) * scale + 1;
    points[i + 1] = (projected[i + 1] - minY) * scale + 1;
  }
  const crossings = [];
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 2, b = indices[i + 1] * 2, c = indices[i + 2] * 2;
    const determinant = (points[b + 1] - points[c + 1]) * (points[a] - points[c]) +
      (points[c] - points[b]) * (points[a + 1] - points[c + 1]);
    if (Math.abs(determinant) < 0.00001) continue;
    const from = Math.max(0, Math.ceil(Math.min(points[a + 1], points[b + 1], points[c + 1]) - 0.5));
    const to = Math.min(height - 1, Math.floor(Math.max(points[a + 1], points[b + 1], points[c + 1]) - 0.5));
    for (let y = from; y <= to; y++) {
      crossings.length = 0;
      for (const [s, e] of [[a, b], [b, c], [c, a]]) {
        const sy = points[s + 1], ey = points[e + 1], line = y + 0.5;
        if ((sy <= line && ey > line) || (ey <= line && sy > line)) {
          crossings.push(points[s] + (line - sy) / (ey - sy) * (points[e] - points[s]));
        }
      }
      if (crossings.length !== 2) continue;
      const left = Math.max(0, Math.ceil(Math.min(...crossings) - 0.5));
      const right = Math.min(width - 1, Math.floor(Math.max(...crossings) - 0.5));
      if (right >= left) mask.fill(1, y * width + left, y * width + right + 1);
      for (let x = left; x <= right; x++) {
        const wa = ((points[b + 1] - points[c + 1]) * (x + 0.5 - points[c]) +
          (points[c] - points[b]) * (y + 0.5 - points[c + 1])) / determinant;
        const wb = ((points[c + 1] - points[a + 1]) * (x + 0.5 - points[c]) +
          (points[a] - points[c]) * (y + 0.5 - points[c + 1])) / determinant;
        const wc = 1 - wa - wb;
        const z = wa * depth[a / 2] + wb * depth[b / 2] + wc * depth[c / 2];
        const pixel = y * width + x;
        if (z >= zBuffer[pixel]) continue;
        zBuffer[pixel] = z;
        const qa = wa * reciprocal[a / 2], qb = wb * reciprocal[b / 2], qc = wc * reciprocal[c / 2];
        const q = qa + qb + qc;
        const u = (qa * uv.getX(a / 2) + qb * uv.getX(b / 2) + qc * uv.getX(c / 2)) / q;
        const v = (qa * uv.getY(a / 2) + qb * uv.getY(b / 2) + qc * uv.getY(c / 2)) / q;
        const tx = Math.max(0, Math.min(pixels.shape[0] - 1, Math.floor(u * pixels.shape[0])));
        const ty = Math.max(0, Math.min(pixels.shape[1] - 1, Math.floor(v * pixels.shape[1])));
        const r = pixels.get(tx, ty, 0) / 255, g = pixels.get(tx, ty, 1) / 255, blue = pixels.get(tx, ty, 2) / 255;
        const luma = r * 0.2126 + g * 0.7152 + blue * 0.0722;
        const head = wa * regions[a] + wb * regions[b] + wc * regions[c] > 0.45;
        const torso = wa * regions[a + 1] + wb * regions[b + 1] + wc * regions[c + 1] > 0.2;
        detail[0][pixel] = Number(head && r > g * 1.1 && r > blue * 1.15 && luma > 0.17);
        detail[1][pixel] = Number(head && luma < 0.28);
        detail[2][pixel] = Number(torso && luma < 0.52);
        detail[3][pixel] = Number(torso && luma > 0.73);
      }
    }
  }
  return [mask, ...detail];
}

function contours(mask) {
  const edges = new Map();
  const stride = width + 1;
  const add = (a, b) => {
    const exits = edges.get(a) || [];
    exits.push(b);
    edges.set(a, exits);
  };
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (!mask[y * width + x]) continue;
    const top = y * stride + x, bottom = (y + 1) * stride + x;
    if (!y || !mask[(y - 1) * width + x]) add(top, top + 1);
    if (x === width - 1 || !mask[y * width + x + 1]) add(top + 1, bottom + 1);
    if (y === height - 1 || !mask[(y + 1) * width + x]) add(bottom + 1, bottom);
    if (!x || !mask[y * width + x - 1]) add(bottom, top);
  }
  const outlines = [];
  while (edges.size) {
    const start = edges.keys().next().value;
    const loop = [];
    let next = start;
    do {
      loop.push([((next % stride) - 1) / scale + minX, (Math.floor(next / stride) - 1) / scale + minY]);
      const exits = edges.get(next);
      if (!exits?.length) throw new Error('Open silhouette contour.');
      const previous = next;
      next = exits.pop();
      if (!exits.length) edges.delete(previous);
    } while (next !== start);
    if (loop.length >= 8) outlines.push(loop);
  }
  const area = loop => Math.abs(loop.reduce((sum, a, i) => {
    const b = loop[(i + 1) % loop.length];
    return sum + a[0] * b[1] - b[0] * a[1];
  }, 0));
  return outlines.sort((a, b) => area(b) - area(a));
}

function resample(outline, count) {
  const lengths = outline.map((point, i) => {
    const next = outline[(i + 1) % outline.length];
    return Math.hypot(next[0] - point[0], next[1] - point[1]);
  });
  const step = lengths.reduce((sum, length) => sum + length, 0) / count;
  const result = [];
  let segment = 0, traversed = 0;
  for (let i = 0; i < count; i++) {
    while (segment < lengths.length - 1 && traversed + lengths[segment] < i * step) {
      traversed += lengths[segment++];
    }
    const a = outline[segment], b = outline[(segment + 1) % outline.length];
    const t = (i * step - traversed) / lengths[segment];
    result.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return result;
}
const silhouettes = [];
const details = [];
for (const frame of frames) {
  const masks = rasterize(frame);
  const outlines = contours(masks[0]);
  if (!outlines.length) throw new Error('Avatar contour unexpectedly empty.');
  let points = resample(outlines[0], pointCount);
  const prior = silhouettes.at(-1);
  if (prior) {
    let best = 0, error = Infinity;
    for (let offset = 0; offset < pointCount; offset++) {
      let difference = 0;
      for (let i = 0; i < pointCount; i++) {
        const candidate = points[(i + offset) % pointCount];
        difference += (candidate[0] - prior[i][0]) ** 2 + (candidate[1] - prior[i][1]) ** 2;
      }
      if (difference < error) { error = difference; best = offset; }
    }
    points = points.map((_, i) => points[(i + best) % pointCount]);
  }
  silhouettes.push(points);
  const frameDetails = [];
  detailLayers.forEach((layer, index) => {
    const shapes = contours(masks[index + 1]);
    const center = shapes[0]?.reduce((sum, p) => [sum[0] + p[0] / shapes[0].length, sum[1] + p[1] / shapes[0].length], [0, 0]) ??
      [(minX + maxX) / 2, (minY + maxY) / 2];
    layer.counts.forEach((count, part) => {
      let path = shapes[part] ? resample(shapes[part], count) : Array.from({ length: count }, () => [...center]);
      const previous = details.at(-1)?.[frameDetails.length];
      if (previous) {
        let best = 0, error = Infinity;
        for (let offset = 0; offset < count; offset++) {
          const difference = path.reduce((sum, _, i) => {
            const candidate = path[(i + offset) % count];
            return sum + (candidate[0] - previous[i][0]) ** 2 + (candidate[1] - previous[i][1]) ** 2;
          }, 0);
          if (difference < error) { error = difference; best = offset; }
        }
        path = path.map((_, i) => path[(i + best) % count]);
      }
      frameDetails.push(path);
    });
  });
  details.push(frameDetails);
}
const asset = {
  source: '/models/me-animated-lite.glb',
  sourceSha256: createHash('sha256').update(bytes).digest('hex'),
  duration,
  camera: { position: camera.position.toArray(), quaternion: camera.quaternion.toArray(), fov: camera.fov },
  placement: { position: root.position.toArray(), rotation: root.rotation.toArray().slice(0, 3), scale: root.scale.toArray() },
  bounds: [minX, minY, maxX, maxY].map(value => Number(value.toFixed(2))),
  outlinePoints: pointCount,
  detailLayers,
  frames: silhouettes.map((points, i) =>
    [...points, ...details[i].flat()].flatMap(point => point.map(value => Math.round(value * 5) / 5))),
};
const output = JSON.stringify(asset) + '\n';
if (gzipSync(output).length > 50_000) throw new Error('Echo exceeds its 50KB compressed asset budget.');
await writeFile(destination, output);
console.log(JSON.stringify({ output: fileURLToPath(destination), frames: frameCount, points: pointCount,
  detailLayers, bytes: Buffer.byteLength(output), gzipBytes: gzipSync(output).length, bounds: asset.bounds }));
mixer.stopAllAction();
mixer.uncacheRoot(gltf.scene);
mesh.geometry.dispose();
mesh.material.dispose();
