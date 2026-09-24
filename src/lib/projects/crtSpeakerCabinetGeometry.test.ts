import * as THREE from 'three';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { acceleratedRaycast, MeshBVH } from 'three-mesh-bvh';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  CrtSpeakerCabinetGeometry,
  CRT_SPEAKER_CABINET_BOTTOM_WORLD_Y,
  CRT_SPEAKER_CABINET_BUDGET,
  CRT_SPEAKER_CABINET_FOOTPRINT,
  CRT_SPEAKER_CABINET_PARTS,
  CRT_SPEAKER_CABINET_TOP_Y,
  CRT_SPEAKER_GRILLE,
  type CrtSpeakerCabinetPart,
} from './crtSpeakerCabinetGeometry';
import { CrtSpeakerGrilleMaterial, CRT_GRILLE_TILE_SIZE } from './crtSpeakerGrilleMaterial';
import { CRT_HOUSING_APERTURE, CRT_HOUSING_BOUNDS } from './crtHousingGeometry';
import { TV_SCREEN_WORLD } from './tvScreen';

const geometries = new Map<CrtSpeakerCabinetPart, CrtSpeakerCabinetGeometry>();
const geometryFor = (part: CrtSpeakerCabinetPart) => geometries.get(part)!;
const originalScreenTransform = TV_SCREEN_WORLD.elements.slice();

// These original terrain voids are also present in the browser-loaded meshes.
// New misses must fail; the continuous plinth bridges only these measured gaps.
const ORIGINAL_TERRAIN_VOID_CELLS = [
  5, 21, 37, 68, 69, 113, 127, 128, 129, 144, 145, 146, 147, 148, 153, 154,
  155, 156, 157, 158, 159, 160, 161, 162, 163, 164, 165, 166, 167, 168, 169,
  170, 171, 172, 173, 174, 175, 176, 181, 182, 183, 184, 185, 186, 223, 224,
  234, 235, 238, 239, 240, 241, 249, 250, 257, 266, 267, 284, 285, 306, 539, 541, 542, 557,
];

function adjacentGround(
  samples: readonly (THREE.Vector3 | undefined)[], index: number,
): readonly [THREE.Vector3, THREE.Vector3] | null {
  let before = index - 1;
  let after = index + 1;
  while (before >= 0 && !samples[before]) before--;
  while (after < samples.length && !samples[after]) after++;
  return before >= 0 && after < samples.length ? [samples[before]!, samples[after]!] : null;
}

const horizontalSpan = ([a, b]: readonly [THREE.Vector3, THREE.Vector3]) =>
  Math.hypot(a.x - b.x, a.z - b.z);

beforeAll(() => {
  for (const part of CRT_SPEAKER_CABINET_PARTS) {
    geometries.set(part, new CrtSpeakerCabinetGeometry(part, TV_SCREEN_WORLD));
  }
});

afterAll(() => {
  for (const geometry of geometries.values()) geometry.dispose();
  geometries.clear();
});

describe('the integral floor-standing CRT speaker cabinet', () => {
  it.each(CRT_SPEAKER_CABINET_PARTS)('%s has finite indexed surfaces, UVs and unit normals', part => {
    const geometry = geometryFor(part);
    const position = geometry.getAttribute('position');
    const normal = geometry.getAttribute('normal');
    const color = geometry.getAttribute('color');
    const uv = geometry.getAttribute('uv');
    const index = geometry.getIndex()!;
    expect(index.count % 3).toBe(0);
    expect(normal.count).toBe(position.count);
    expect(color.count).toBe(position.count);
    expect(uv.count).toBe(position.count);
    expect(geometry.boundingBox!.isEmpty()).toBe(false);
    expect(Number.isFinite(geometry.boundingSphere!.radius)).toBe(true);
    for (const attribute of [position, normal, color, uv]) {
      expect([...attribute.array].every(Number.isFinite)).toBe(true);
    }
    for (let vertex = 0; vertex < position.count; vertex++) {
      expect(new THREE.Vector3().fromBufferAttribute(normal, vertex).length()).toBeCloseTo(1, 5);
    }
    for (let triangle = 0; triangle < index.count; triangle += 3) {
      const vertices = [index.getX(triangle), index.getX(triangle + 1), index.getX(triangle + 2)];
      expect(vertices.every(vertex => Number.isInteger(vertex) && vertex >= 0 && vertex < position.count)).toBe(true);
      const [a, b, c] = vertices.map(vertex => new THREE.Vector3().fromBufferAttribute(position, vertex));
      expect(b.sub(a).cross(c.sub(a)).lengthSq()).toBeGreaterThan(1e-22);
    }
  });

  it('submits 264 static triangles in three material batches without instances or hidden groups', () => {
    let vertices = 0;
    let triangles = 0;
    for (const part of CRT_SPEAKER_CABINET_PARTS) {
      const geometry = geometryFor(part);
      vertices += geometry.getAttribute('position').count;
      triangles += geometry.getIndex()!.count / 3;
      expect(geometry.groups).toHaveLength(0);
    }
    expect(vertices).toBe(600);
    expect(triangles).toBe(264);
    expect(vertices).toBeLessThanOrEqual(CRT_SPEAKER_CABINET_BUDGET.maxStoredVertices);
    expect(triangles).toBeLessThanOrEqual(CRT_SPEAKER_CABINET_BUDGET.maxSubmittedTriangles);
    expect(CRT_SPEAKER_CABINET_PARTS).toHaveLength(CRT_SPEAKER_CABINET_BUDGET.drawCalls);
  });

  it('seals under the existing receiver without moving or covering its approved upper housing', () => {
    expect(CRT_HOUSING_APERTURE).toEqual({ width: 0.55, height: 0.32, z: 0 });
    expect(CRT_HOUSING_BOUNDS.size).toEqual([0.72, 0.474, 0.426]);
    for (const part of CRT_SPEAKER_CABINET_PARTS) {
      const bounds = geometryFor(part).boundingBox!;
      expect(bounds.max.y).toBeLessThanOrEqual(CRT_SPEAKER_CABINET_TOP_Y + 1e-7);
      expect(bounds.min.x).toBeGreaterThan(-0.36);
      expect(bounds.max.x).toBeLessThan(0.36);
    }
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geometryFor('shell'), material);
    try {
      for (const x of [-0.3, -0.245, 0, 0.245, 0.3]) {
        for (const z of [-0.09, -0.03]) {
          const ray = new THREE.Raycaster(new THREE.Vector3(x, 0, z), new THREE.Vector3(0, -1, 0));
          const shoulder = ray.intersectObject(mesh)[0]?.point;
          expect(shoulder).toBeDefined();
          expect(shoulder!.y).toBeGreaterThan(CRT_HOUSING_BOUNDS.min[1]);
        }
      }
    } finally {
      material.dispose();
    }
    expect(TV_SCREEN_WORLD.elements).toEqual(originalScreenTransform);
  });

  it('has an uninterrupted broad front, a real recessed grille, and a closed full-width underside', () => {
    const material = new THREE.MeshBasicMaterial();
    const meshes = CRT_SPEAKER_CABINET_PARTS.map(part => new THREE.Mesh(geometryFor(part), material));
    try {
      for (let column = 0; column <= 16; column++) {
        const x = -0.33 + column * 0.66 / 16;
        for (const y of [-0.31, -0.38, -0.455]) {
          const ray = new THREE.Raycaster(new THREE.Vector3(x, y, 1), new THREE.Vector3(0, 0, -1));
          const face = ray.intersectObjects(meshes, false)[0]?.point;
          expect(face, 'The lower front cannot be an open stand or two separate speakers').toBeDefined();
          expect(face!.z).toBeGreaterThanOrEqual(CRT_SPEAKER_GRILLE.z - 1e-7);
        }
      }
      expect(geometryFor('grille').boundingBox!.getSize(new THREE.Vector3()).x).toBeCloseTo(0.634, 6);
      expect(geometryFor('grille').boundingBox!.max.z).toBeLessThan(0.024);
      const worldShell = meshes[0];
      worldShell.matrixAutoUpdate = false;
      worldShell.matrix.copy(TV_SCREEN_WORLD);
      worldShell.updateMatrixWorld(true);
      for (const x of [-0.33, -0.165, 0, 0.165, 0.33]) {
        const sample = new THREE.Vector3(x, CRT_SPEAKER_CABINET_FOOTPRINT.localY, -0.15)
          .applyMatrix4(TV_SCREEN_WORLD);
        const ray = new THREE.Raycaster(
          new THREE.Vector3(sample.x, CRT_SPEAKER_CABINET_BOTTOM_WORLD_Y - 1, sample.z),
          new THREE.Vector3(0, 1, 0),
        );
        const bottom = ray.intersectObject(worldShell)[0]?.point;
        expect(bottom).toBeDefined();
        expect(bottom!.y).toBeCloseTo(CRT_SPEAKER_CABINET_BOTTOM_WORLD_Y, 5);
      }
    } finally {
      material.dispose();
    }
  });

  it('owns its buffers and only disposes its own shared map/bump tile', () => {
    const geometry = new CrtSpeakerCabinetGeometry('shell', TV_SCREEN_WORLD);
    const first = new CrtSpeakerGrilleMaterial();
    const second = new CrtSpeakerGrilleMaterial();
    const firstTextureDisposed = vi.fn();
    const secondTextureDisposed = vi.fn();
    let firstDisposed = false;
    try {
      expect(geometry.getAttribute('position').array).not.toBe(geometryFor('shell').getAttribute('position').array);
      expect(geometry.getIndex()!.array).not.toBe(geometryFor('shell').getIndex()!.array);
      expect(first.map).toBe(first.bumpMap);
      expect(first.map).not.toBe(second.map);
      expect(first.transparent).toBe(false);
      const texture = first.map;
      if (!(texture instanceof THREE.DataTexture)) throw new Error('The grille must own its data texture');
      expect(texture.image.width).toBe(CRT_GRILLE_TILE_SIZE);
      expect(texture.image.height).toBe(CRT_GRILLE_TILE_SIZE);
      expect(texture.image.data.byteLength).toBe(4096);
      expect(texture.generateMipmaps).toBe(true);
      expect(texture.minFilter).toBe(THREE.LinearMipmapLinearFilter);
      expect(texture.wrapS).toBe(THREE.RepeatWrapping);
      expect(texture.wrapT).toBe(THREE.RepeatWrapping);
      for (let offset = 3; offset < texture.image.data.length; offset += 4) {
        expect(texture.image.data[offset]).toBe(255);
      }
      texture.addEventListener('dispose', firstTextureDisposed);
      second.map!.addEventListener('dispose', secondTextureDisposed);
      first.dispose();
      firstDisposed = true;
      expect(firstTextureDisposed).toHaveBeenCalledOnce();
      expect(secondTextureDisposed).not.toHaveBeenCalled();
    } finally {
      geometry.dispose();
      if (!firstDisposed) first.dispose();
      second.dispose();
    }
  });

  it.each(['terrain-opt.glb', 'terrain-software.glb'])('grounds the full cabinet on actual %s buffers', async model => {
    await MeshoptDecoder.ready;
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
    const doc = await io.read(resolve('public', 'models', model));
    const transform = new THREE.Matrix4().compose(
      new THREE.Vector3(0, -4, -20),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0.15, Math.PI, 0)),
      new THREE.Vector3(30, 15, 30),
    );
    const meshes: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>[] = [];
    const cabinetMaterial = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const cabinet = new THREE.Mesh(geometryFor('shell'), cabinetMaterial);
    cabinet.matrixAutoUpdate = false;
    cabinet.matrix.copy(TV_SCREEN_WORLD);
    cabinet.updateMatrixWorld(true);
    try {
      for (const node of doc.getRoot().listNodes()) {
        for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
          const positions = primitive.getAttribute('POSITION')!;
          const array = new Float32Array(positions.getCount() * 3);
          const point: number[] = [];
          for (let index = 0; index < positions.getCount(); index++) {
            positions.getElement(index, point);
            array.set(point, index * 3);
          }
          const geometry = new THREE.BufferGeometry();
          geometry.setAttribute('position', new THREE.BufferAttribute(array, 3));
          const indices = primitive.getIndices()?.getArray();
          if (indices) geometry.setIndex(Array.from(indices));
          geometry.boundsTree = new MeshBVH(geometry);
          const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
          mesh.raycast = acceleratedRaycast;
          mesh.matrixAutoUpdate = false;
          mesh.matrix.copy(transform).multiply(new THREE.Matrix4().fromArray(node.getWorldMatrix()));
          mesh.updateMatrixWorld(true);
          meshes.push(mesh);
        }
      }
      const grid: (THREE.Vector3 | undefined)[][] = Array.from({ length: 33 }, () => []);
      const shoulders: number[][] = Array.from({ length: 33 }, () => []);
      const voids: number[] = [];
      for (let column = 0; column <= 32; column++) {
        for (let row = 0; row <= 16; row++) {
          const x = -0.34 + column * 0.68 / 32;
          const z = -0.303 + row * 0.303 / 16;
          const sample = new THREE.Vector3(x, CRT_SPEAKER_CABINET_FOOTPRINT.localY, z)
            .applyMatrix4(TV_SCREEN_WORLD);
          const downward = new THREE.Raycaster(
            new THREE.Vector3(sample.x, sample.y + 30, sample.z), new THREE.Vector3(0, -1, 0),
          );
          const ground = downward.intersectObjects(meshes, false)[0]?.point;
          if ([0, 7, 16, 32].includes(column) && [0, 8, 16].includes(row)) {
            for (const mesh of meshes) mesh.raycast = THREE.Mesh.prototype.raycast;
            const reference = downward.intersectObjects(meshes, false)[0]?.point;
            for (const mesh of meshes) mesh.raycast = acceleratedRaycast;
            expect(Boolean(ground)).toBe(Boolean(reference));
            if (ground && reference) expect(ground.distanceTo(reference)).toBeLessThan(1e-8);
          }
          const shoulder = downward.intersectObject(cabinet)[0]?.point;
          const upward = new THREE.Raycaster(
            new THREE.Vector3(sample.x, CRT_SPEAKER_CABINET_BOTTOM_WORLD_Y - 1, sample.z),
            new THREE.Vector3(0, 1, 0),
          );
          const underside = upward.intersectObject(cabinet)[0]?.point;
          expect(shoulder).toBeDefined();
          expect(underside).toBeDefined();
          expect(underside!.y).toBeCloseTo(CRT_SPEAKER_CABINET_BOTTOM_WORLD_Y, 5);
          grid[column][row] = ground;
          shoulders[column][row] = shoulder!.y;
          if (ground) {
            expect(ground.y).toBeGreaterThan(underside!.y);
            expect(shoulder!.y).toBeGreaterThan(ground.y);
          } else {
            voids.push(column * 17 + row);
          }
        }
      }
      expect(voids).toEqual(model === 'terrain-software.glb'
        ? ORIGINAL_TERRAIN_VOID_CELLS.filter(cell => cell !== 267) : ORIGINAL_TERRAIN_VOID_CELLS);
      for (const column of [0, 32]) {
        for (const row of [0, 16]) expect(grid[column][row], 'All four bearing corners need real soil').toBeDefined();
      }
      for (const cell of voids) {
        const column = Math.floor(cell / 17);
        const row = cell % 17;
        const brackets = [
          adjacentGround(grid.map(samples => samples[row]), column),
          adjacentGround(grid[column], row),
        ].filter((pair): pair is readonly [THREE.Vector3, THREE.Vector3] => pair !== null);
        expect(brackets.length, `Void ${cell} must have bearing soil on opposite sides`).toBeGreaterThan(0);
        const nearest = brackets.sort((a, b) => horizontalSpan(a) - horizontalSpan(b))[0];
        expect(horizontalSpan(nearest), `Unsupported span at ${cell}`).toBeLessThanOrEqual(0.7);
        expect(shoulders[column][row]).toBeGreaterThan(Math.max(nearest[0].y, nearest[1].y));
      }

      const grillePoints: THREE.Vector3[] = [];
      const grilleGround: (THREE.Vector3 | undefined)[] = [];
      for (let column = 0; column <= 64; column++) {
        const bottomOfGrille = new THREE.Vector3(
          (column / 64 - 0.5) * CRT_SPEAKER_GRILLE.width, CRT_SPEAKER_GRILLE.bottom, CRT_SPEAKER_GRILLE.z,
        ).applyMatrix4(TV_SCREEN_WORLD);
        const ray = new THREE.Raycaster(
          bottomOfGrille.clone().add(new THREE.Vector3(0, 30, 0)), new THREE.Vector3(0, -1, 0),
        );
        const ground = ray.intersectObjects(meshes, false)[0]?.point;
        grillePoints.push(bottomOfGrille);
        grilleGround.push(ground);
        if (ground) expect(bottomOfGrille.y - ground.y).toBeGreaterThan(0.04);
      }
      expect(grilleGround[0]).toBeDefined();
      expect(grilleGround[64]).toBeDefined();
      for (let column = 0; column <= 64; column++) {
        if (grilleGround[column]) continue;
        const bracket = adjacentGround(grilleGround, column);
        expect(bracket, 'A grille ray over a terrain void needs measured soil on both sides').not.toBeNull();
        expect(horizontalSpan(bracket!)).toBeLessThanOrEqual(0.7);
        expect(grillePoints[column].y - Math.max(bracket![0].y, bracket![1].y)).toBeGreaterThan(0.04);
      }
    } finally {
      cabinetMaterial.dispose();
      for (const mesh of meshes) {
        mesh.geometry.dispose();
        mesh.material.dispose();
      }
    }
  });
});
