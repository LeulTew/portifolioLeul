import * as THREE from 'three';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CrtSupportGeometry, CRT_SUPPORT_BASE_HALF_WIDTH, CRT_SUPPORT_DEPTH, CRT_SUPPORT_STATIONS, CRT_SUPPORT_TOP_Y,
} from './crtSupportGeometry';
import { TV_SCREEN_WORLD } from './tvScreen';

describe('small physical CRT supports', () => {
  it('uses one material-compatible buffer, 24 submitted triangles and no changed cabinet dimensions', () => {
    const geometry = new CrtSupportGeometry(TV_SCREEN_WORLD);
    try {
      const position = geometry.getAttribute('position');
      expect(position.count).toBe(72);
      expect(position.count / 3).toBe(24);
      expect(geometry.groups).toHaveLength(0);
      expect([...position.array].every(Number.isFinite)).toBe(true);
      for (const start of [0, 36]) {
        for (let index = start; index < start + 6; index++) {
          expect(position.getY(index)).toBeCloseTo(CRT_SUPPORT_TOP_Y, 6);
        }
      }
    } finally {
      geometry.dispose();
    }
  });

  it.each(['terrain-opt.glb', 'terrain-software.glb'])('puts both bases below actual %s contact points', async model => {
    await MeshoptDecoder.ready;
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
    const doc = await io.read(resolve('public', 'models', model));
    const transform = new THREE.Matrix4().compose(
      new THREE.Vector3(0, -4, -20),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0.15, Math.PI, 0)),
      new THREE.Vector3(30, 15, 30),
    );
    const meshes: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>[] = [];
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
          const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
          mesh.matrixAutoUpdate = false;
          mesh.matrix.copy(transform).multiply(new THREE.Matrix4().fromArray(node.getWorldMatrix()));
          mesh.updateMatrixWorld(true);
          meshes.push(mesh);
        }
      }
      for (const support of CRT_SUPPORT_STATIONS) {
        for (const x of [support.baseX - CRT_SUPPORT_BASE_HALF_WIDTH, support.baseX, support.baseX + CRT_SUPPORT_BASE_HALF_WIDTH]) {
          for (const z of [CRT_SUPPORT_DEPTH[0], -0.06, CRT_SUPPORT_DEPTH[1]]) {
            const top = new THREE.Vector3(x, CRT_SUPPORT_TOP_Y, z).applyMatrix4(TV_SCREEN_WORLD);
            const ray = new THREE.Raycaster(new THREE.Vector3(top.x, top.y + 30, top.z), new THREE.Vector3(0, -1, 0));
            const ground = ray.intersectObjects(meshes, false)[0]?.point;
            expect(ground, 'Each support footprint must be on the real island').toBeDefined();
            expect(ground!.y).toBeGreaterThan(support.bottomWorldY);
            expect(top.y).toBeGreaterThan(ground!.y);
          }
        }
      }
    } finally {
      for (const mesh of meshes) {
        mesh.geometry.dispose();
        mesh.material.dispose();
      }
    }
  });
});
