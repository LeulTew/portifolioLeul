import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CAMERA_CHAPTERS } from '@/lib/camera/cinematicSpline';
import {
  CrtHousingGeometry, CRT_HOUSING_PARTS, CRT_SPEAKER_RIB_POSITIONS,
} from './crtHousingGeometry';
import {
  fitTVScreen, ProjectsCameraPose, TVScreenProjector, TV_SCREEN_ASPECT,
  TV_SCREEN_WIDTH, TV_SCREEN_HEIGHT, TV_SCREEN_WORLD,
} from './tvScreen';

const viewports = [[900, 560], [1024, 768], [1440, 900], [1920, 1080], [2560, 1440], [3840, 2160]];

describe('the real TV display framing', () => {
  it('begins with the original establishing shot, not a replacement camera path', () => {
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    new ProjectsCameraPose().sample(0, 0, 1440, 900, 50, position, quaternion);
    expect(position.toArray()).toEqual(CAMERA_CHAPTERS[0].position);
  });

  it.each(viewports)('fits a sharp, level screen at %i x %i', (width, height) => {
    const fit = fitTVScreen(width, height);
    expect(fit.width / fit.height).toBeCloseTo(TV_SCREEN_ASPECT);
    expect(fit.width).toBeLessThan(width - 100);
    expect(fit.centerY + fit.height / 2).toBeLessThan(height - 45);
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    new ProjectsCameraPose().sample(1, 1, width, height, 50, camera.position, camera.quaternion);
    camera.updateMatrixWorld();
    const leftTop = new THREE.Vector3(-TV_SCREEN_WIDTH / 2, TV_SCREEN_HEIGHT / 2, 0)
      .applyMatrix4(TV_SCREEN_WORLD).project(camera);
    const rightBottom = new THREE.Vector3(TV_SCREEN_WIDTH / 2, -TV_SCREEN_HEIGHT / 2, 0)
      .applyMatrix4(TV_SCREEN_WORLD).project(camera);
    const x = (leftTop.x + 1) * width / 2;
    const y = (1 - leftTop.y) * height / 2;
    expect(x).toBeCloseTo(fit.centerX - fit.width / 2, 5);
    expect(y).toBeCloseTo(fit.centerY - fit.height / 2, 5);
    expect((rightBottom.x - leftTop.x) * width / 2).toBeCloseTo(fit.width, 5);
    expect((leftTop.y - rightBottom.y) * height / 2).toBeCloseTo(fit.height, 5);

    const matrix = new TVScreenProjector().matrix(camera, width, height)!;
    const m = matrix.slice(9, -1).split(',').map(Number);
    expect(m[0]).toBeCloseTo(1, 5);
    expect(m[5]).toBeCloseTo(1, 5);
    expect(m[1]).toBeCloseTo(0, 5);
    expect(m[4]).toBeCloseTo(0, 5);
    expect(m[12]).toBeCloseTo(x, 5);
    expect(m[13]).toBeCloseTo(y, 5);
  });

  it.each(viewports)('keeps the actual cabinet, controls and feet in frame at %i x %i', (width, height) => {
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    new ProjectsCameraPose().sample(1, 1, width, height, 50, camera.position, camera.quaternion);
    camera.updateMatrixWorld();
    const point = new THREE.Vector3();
    for (const part of CRT_HOUSING_PARTS) {
      const geometry = new CrtHousingGeometry(part);
      try {
        const position = geometry.getAttribute('position');
        const offsets = part === 'speakerRib' ? CRT_SPEAKER_RIB_POSITIONS : [[0, 0, 0] as const];
        let left = Infinity;
        let top = Infinity;
        let right = -Infinity;
        let bottom = -Infinity;
        for (const offset of offsets) {
          for (let index = 0; index < position.count; index++) {
            point.fromBufferAttribute(position, index);
            point.x += offset[0];
            point.y += offset[1];
            point.z += offset[2];
            point.applyMatrix4(TV_SCREEN_WORLD).project(camera);
            const x = (point.x + 1) * width / 2;
            const y = (1 - point.y) * height / 2;
            left = Math.min(left, x);
            right = Math.max(right, x);
            top = Math.min(top, y);
            bottom = Math.max(bottom, y);
          }
          expect(left).toBeGreaterThan(24);
          expect(right).toBeLessThan(width - 24);
          expect(top).toBeGreaterThan(72);
          expect(bottom).toBeLessThan(height - 56);
        }
      } finally {
        geometry.dispose();
      }
    }
  });

  it.each([0, 0.1, 0.35, 0.6, 0.85, 1])('pins all four DOM corners at approach %f', approach => {
    const width = 1440;
    const height = 900;
    const fit = fitTVScreen(width, height);
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    new ProjectsCameraPose().sample(1, approach, width, height, 50, camera.position, camera.quaternion);
    camera.updateMatrixWorld();
    const matrix = new TVScreenProjector().matrix(camera, width, height)!;
    expect(matrix).not.toBeNull();
    const m = matrix.slice(9, -1).split(',').map(Number);
    for (const [x, y] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
      const world = new THREE.Vector3((x - 0.5) * TV_SCREEN_WIDTH, (0.5 - y) * TV_SCREEN_HEIGHT, 0)
        .applyMatrix4(TV_SCREEN_WORLD).project(camera);
      const denominator = m[3] * x * fit.width + m[7] * y * fit.height + 1;
      expect((m[0] * x * fit.width + m[4] * y * fit.height + m[12]) / denominator)
        .toBeCloseTo((world.x + 1) * width / 2, 5);
      expect((m[1] * x * fit.width + m[5] * y * fit.height + m[13]) / denominator)
        .toBeCloseTo((1 - world.y) * height / 2, 5);
    }
  });

  it('hides a projection behind the camera rather than mirroring it onto the page', () => {
    const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 1000);
    camera.position.set(0, 0, -50);
    camera.updateMatrixWorld();
    expect(new TVScreenProjector().matrix(camera, 1440, 900)).toBeNull();
  });

  it('retraces the identical camera pose on reverse and reuses its buffers', () => {
    const sampler = new ProjectsCameraPose();
    const position = new THREE.Vector3();
    const orientation = new THREE.Quaternion();
    sampler.sample(0.7, 0, 1920, 1080, 50, position, orientation);
    const forward = [...position.toArray(), ...orientation.toArray()];
    sampler.sample(1, 1, 1920, 1080, 50, position, orientation);
    sampler.sample(0.7, 0, 1920, 1080, 50, position, orientation);
    expect([...position.toArray(), ...orientation.toArray()]).toEqual(forward);
  });

  it('enters from Contact at the actual pose and retraces it without a framing snap', () => {
    const sampler = new ProjectsCameraPose();
    const start = new THREE.Vector3(0, 5, -30);
    const camera = new THREE.PerspectiveCamera();
    camera.position.copy(start);
    camera.lookAt(0, 0, 0);
    sampler.begin(start, camera.quaternion);
    const position = new THREE.Vector3();
    const orientation = new THREE.Quaternion();
    sampler.sample(1, 0, 1440, 900, 50, position, orientation);
    expect(position.distanceTo(start)).toBeLessThan(1e-8);
    expect(orientation.angleTo(camera.quaternion)).toBeLessThan(1e-7);
    sampler.sample(1, 1, 1440, 900, 50, position, orientation);
    sampler.sample(1, 0, 1440, 900, 50, position, orientation);
    expect(position.distanceTo(start)).toBeLessThan(1e-8);
    expect(orientation.angleTo(camera.quaternion)).toBeLessThan(1e-7);
    sampler.begin();
    sampler.sample(0, 0, 1440, 900, 50, position, orientation);
    expect(position.toArray()).toEqual(CAMERA_CHAPTERS[0].position);
  });
});
