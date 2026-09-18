import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createTerrainContinuation, TERRAIN_CONTINUATION_RADII, TERRAIN_CONTINUATION_SEGMENTS } from './terrainContinuation';
import { TERRAIN_RIM, TERRAIN_SOFTWARE_RIM } from './terrainRim';
import { TERRAIN_PROTECTED_REGIONS } from './terrainOutline';
import { createCameraSpline, sampleCameraPose } from '../camera/cinematicSpline';
import { ContactFlight } from '../camera/contactFlight';
import { ProjectsCameraPose } from '../projects/tvScreen';
import { TVParallax } from '../projects/tvParallax';
import { DARK_GRADES, LIGHT_GRADES } from '../atmosphere/chapterGrade';

describe('static distant mainland', () => {
  it.each([{ rim: TERRAIN_RIM }, { rim: TERRAIN_SOFTWARE_RIM }])('joins every decoded rim position and UV without changing the rim', ({ rim }) => {
    const before = JSON.stringify(rim);
    const land = createTerrainContinuation(rim);
    const positions = land.getAttribute('position');
    const uv = land.getAttribute('uv');
    rim.forEach((point, index) => {
      point.slice(0, 3).forEach((value, axis) => expect(positions.array[index * 3 + axis]).toBeCloseTo(value, 5));
      expect(uv.getX(index)).toBeCloseTo(point[3], 6);
      expect(uv.getY(index)).toBeCloseTo(point[4], 6);
    });
    expect(JSON.stringify(rim)).toBe(before);
    expect(positions.count).toBe(rim.length + 128);
    expect(land.index!.count / 3).toBe(rim.length + 224);
    expect(land.index!.count / 3).toBeLessThan(450);
    expect(land.groups).toHaveLength(0);
    expect(land.morphAttributes).toEqual({});
    land.dispose();
  });

  it.each([{ rim: TERRAIN_RIM }, { rim: TERRAIN_SOFTWARE_RIM }])('has upward, nondegenerate faces and no invented ground in protected zones', ({ rim }) => {
    const land = createTerrainContinuation(rim);
    const position = land.getAttribute('position');
    const index = land.index!;
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    const cross = new THREE.Vector3();
    const edges = new Map<string, number>();
    for (let face = 0; face < index.count; face += 3) {
      const vertices = [0, 1, 2].map(corner => index.getX(face + corner));
      a.fromBufferAttribute(position, vertices[0]);
      b.fromBufferAttribute(position, vertices[1]);
      c.fromBufferAttribute(position, vertices[2]);
      cross.subVectors(b, a).cross(c.clone().sub(a));
      expect(cross.y).toBeGreaterThan(0.000001);
      for (let edge = 0; edge < 3; edge++) {
        const key = [vertices[edge], vertices[(edge + 1) % 3]].sort((x, y) => x - y).join(':');
        edges.set(key, (edges.get(key) ?? 0) + 1);
      }
    }
    expect([...edges.values()].every(count => count === 1 || count === 2)).toBe(true);
    expect([...edges.values()].filter(count => count === 1)).toHaveLength(rim.length + TERRAIN_CONTINUATION_SEGMENTS);
    const mesh = new THREE.Mesh(land, new THREE.MeshBasicMaterial());
    const ray = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0));
    for (const region of TERRAIN_PROTECTED_REGIONS) {
      for (let x = region.minX; x <= region.maxX; x += 0.25) {
        for (let z = region.minZ; z <= region.maxZ; z += 0.25) {
          ray.ray.origin.set(x, 20, z);
          expect(ray.intersectObject(mesh)).toHaveLength(0);
        }
      }
    }
    mesh.material.dispose();
    land.dispose();
  });

  it('keeps every visible remote edge beyond unmodified fog throughout the authored camera envelope', () => {
    const land = createTerrainContinuation(TERRAIN_RIM);
    const positions = land.getAttribute('position');
    const remote = TERRAIN_RIM.length + 3 * TERRAIN_CONTINUATION_SEGMENTS;
    const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 1000);
    const spline = createCameraSpline();
    const position = new THREE.Vector3();
    const target = new THREE.Vector3();
    const orientation = new THREE.Quaternion();
    const tv = new ProjectsCameraPose();
    const contact = new ContactFlight();
    const point = new THREE.Vector3();
    const next = new THREE.Vector3();
    const view = new THREE.Vector3();
    const ndc = new THREE.Vector3();
    const maximumFog = Math.max(...[...DARK_GRADES, ...LIGHT_GRADES].map(grade => grade.fogFar));
    let minimumVisibleDepth = Infinity;
    let maximumCameraRadius = 0;
    let visibleSamples = 0;
    const check = () => {
      maximumCameraRadius = Math.max(maximumCameraRadius, camera.position.distanceTo(new THREE.Vector3(0, 0, -20)));
      camera.updateMatrixWorld(true);
      for (let edge = 0; edge < TERRAIN_CONTINUATION_SEGMENTS; edge++) {
        point.fromBufferAttribute(positions, remote + edge);
        next.fromBufferAttribute(positions, remote + (edge + 1) % TERRAIN_CONTINUATION_SEGMENTS);
        for (let step = 0; step <= 8; step++) {
          view.lerpVectors(point, next, step / 8);
          ndc.copy(view).project(camera);
          if (Math.abs(ndc.x) > 1 || Math.abs(ndc.y) > 1 || Math.abs(ndc.z) > 1) continue;
          const depth = -view.applyMatrix4(camera.matrixWorldInverse).z;
          minimumVisibleDepth = Math.min(minimumVisibleDepth, depth);
          visibleSamples++;
        }
      }
    };
    for (const [width, height] of [[1024, 768], [3840, 2160], [3440, 1440]]) {
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      for (let step = 0; step <= 100; step++) {
        const progress = step / 100;
        for (const [pointerX, pointerY] of [[0, 0], [-1, -1], [1, 1], [-1, 1], [1, -1]]) {
          sampleCameraPose(spline, progress, position, target);
          position.x += pointerX * 1.6;
          position.y += pointerY * 0.8;
          camera.position.copy(position);
          camera.lookAt(target);
          check();
          for (const [turn, approach] of [[progress, 0], [1, progress]]) {
            tv.sample(turn, approach, width, height, 50, position, orientation);
            const parallax = new TVParallax();
            parallax.apply(position, orientation, pointerX, pointerY, true, true, approach, 10);
            camera.position.copy(position);
            camera.quaternion.copy(orientation);
            check();
          }
          tv.sample(1, 1, width, height, 50, position, orientation);
          const parallax = new TVParallax();
          parallax.apply(position, orientation, pointerX, pointerY, true, true, 1, 10);
          contact.depart(position, orientation);
          contact.sample(progress, camera.position, camera.quaternion);
          check();
          // Reflection in the existing Y=-4 water plane; no separate orbit.
          target.set(0, 0, -1).applyQuaternion(camera.quaternion).add(camera.position);
          camera.position.y = -8 - camera.position.y;
          target.y = -8 - target.y;
          camera.up.set(0, -1, 0);
          camera.lookAt(target);
          check();
          camera.up.set(0, 1, 0);
        }
      }
    }
    expect(maximumFog).toBe(92);
    expect(maximumCameraRadius).toBeLessThan(60);
    expect(visibleSamples).toBeGreaterThan(1000);
    expect(minimumVisibleDepth).toBeGreaterThan(maximumFog);
    expect(minimumVisibleDepth).toBeGreaterThan(130);
    expect(TERRAIN_CONTINUATION_RADII[3]).toBe(240);
    land.dispose();
  });

  it('rejects malformed or out-of-order profiles explicitly', () => {
    expect(() => createTerrainContinuation([])).toThrow('finite decoded');
    expect(() => createTerrainContinuation([...TERRAIN_RIM].reverse())).toThrow('ordered rim');
    expect(() => createTerrainContinuation([[NaN, 0, 0, 0, 0], ...TERRAIN_RIM])).toThrow('finite decoded');
  });
});
