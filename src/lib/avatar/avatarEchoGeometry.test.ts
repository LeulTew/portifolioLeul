import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import artwork from '@/data/avatar-echo.json';
import { CAMERA_CHAPTERS } from '@/lib/camera/cinematicSpline';
import {
  ECHO_DURATION_MS, ECHO_POINT_VALUES, avatarContourPath, avatarDetailPaths, echoArrival,
  echoComposition, echoCopyReveal, echoTransform, sampleAvatarContour,
} from './avatarEchoGeometry';

describe('the actual-avatar contour bake', () => {
  it('is derived from the unchanged shipped model, not a stock silhouette', () => {
    const model = readFileSync('public/models/me-animated-lite.glb');
    expect(createHash('sha256').update(model).digest('hex')).toBe(artwork.sourceSha256);
    const json = JSON.parse(model.subarray(20, 20 + model.readUInt32LE(12)).toString());
    expect(json.skins).toHaveLength(1);
    expect(json.animations).toHaveLength(1);
    expect(artwork.placement).toEqual({
      position: [22, -2.5, -15], rotation: [0, Math.PI / 0.55, 0], scale: [8, 8, 8],
    });
    expect(gzipSync(JSON.stringify(artwork)).length).toBeLessThan(50_000);
  });

  it('uses the real Hero shot and a finite complete original clip', () => {
    const camera = new THREE.PerspectiveCamera(50);
    camera.position.set(...CAMERA_CHAPTERS[0].position);
    camera.lookAt(...CAMERA_CHAPTERS[0].target);
    expect(artwork.camera.position).toEqual(camera.position.toArray());
    expect(artwork.camera.quaternion).toEqual(camera.quaternion.toArray());
    expect(ECHO_DURATION_MS).toBeCloseTo(4200, 2);
    expect(artwork.frames).toHaveLength(42);
    expect(new Set(artwork.frames.map(frame => JSON.stringify(frame))).size).toBe(42);
  });

  it('keeps every phase finite, closed, inside the measured silhouette envelope', () => {
    const points = new Float32Array(ECHO_POINT_VALUES);
    const [left, top, right, bottom] = artwork.bounds;
    for (let i = 0; i <= 84; i++) {
      sampleAvatarContour(i / 84 * artwork.duration, points);
      expect(points.every(Number.isFinite)).toBe(true);
      for (let p = 0; p < points.length; p += 2) {
        expect(points[p]).toBeGreaterThanOrEqual(left);
        expect(points[p]).toBeLessThanOrEqual(right);
        expect(points[p + 1]).toBeGreaterThanOrEqual(top);
        expect(points[p + 1]).toBeLessThanOrEqual(bottom);
      }
      const path = avatarContourPath(points);
      expect(path.startsWith('M')).toBe(true);
      expect(path.endsWith('Z')).toBe(true);
      expect(path).not.toMatch(/NaN|Infinity/);
      const details = avatarDetailPaths(points);
      expect(details).toHaveLength(4);
      expect(details.every(part => part.startsWith('M') && part.endsWith('Z') &&
        !/NaN|Infinity/.test(part))).toBe(true);
    }
  });

  it('samples the current mixer phase and wraps the original loop', () => {
    const a = new Float32Array(ECHO_POINT_VALUES), b = new Float32Array(ECHO_POINT_VALUES);
    sampleAvatarContour(0, a);
    sampleAvatarContour(artwork.duration, b);
    expect(a).toEqual(b);
    sampleAvatarContour(1.37, a);
    sampleAvatarContour(1.37 + artwork.duration * 5, b);
    expect(a).toEqual(b);
    expect(() => sampleAvatarContour(Infinity, b)).toThrow(RangeError);
    expect(() => sampleAvatarContour(1, new Float32Array(1))).toThrow(RangeError);
  });

  it.each([[900, 560], [900, 900], [1440, 900], [1920, 1080], [3840, 2160]])(
    'frames the entire drawing in %ix%i, with no added camera movement', (width, height) => {
      const composition = echoComposition(width, height);
      const [left, top, right, bottom] = artwork.bounds;
      const screenX = (x: number) =>
        width / 2 + (composition.center + composition.x + (x - composition.center) * composition.scale - 500) * height / 1000;
      const screenY = (y: number) =>
        (composition.foot + composition.y + (y - composition.foot) * composition.scale) * height / 1000;
      expect(screenX(left)).toBeGreaterThan(width * 0.5);
      expect(screenX(right)).toBeLessThan(width - 24);
      expect(screenY(top)).toBeGreaterThan(80);
      expect(screenY(bottom)).toBeLessThan(height - 48);
      const textLeft = width / 2 - Math.min(1280, width - 96) / 2 + Math.min(80, width * 0.04);
      const gap = screenX(left) - textLeft - Math.min(480, width * 0.32);
      expect(gap).toBeGreaterThan(40);
      expect(gap).toBeLessThan(400);
      const sourceLeft = width / 2 + (left - 500) * height / 1000;
      expect(screenX(right)).toBeLessThanOrEqual(sourceLeft - 23.9);
      expect(echoTransform(composition, 0)).toContain('scale(1.00000)');
      expect(echoTransform(composition, 0)).toContain('translate(0.000 0.000)');
      expect(echoTransform(composition, 1)).not.toMatch(/NaN|Infinity/);
    },
  );

  it('has exact finite endpoints without a competing text clock', () => {
    expect(echoArrival(0)).toBe(0);
    expect(echoArrival(625)).toBe(0.5);
    expect(echoArrival(1250)).toBe(1);
    expect(echoCopyReveal(300)).toBe(0);
    expect(echoCopyReveal(950)).toBe(1);
    expect(() => echoComposition(0, 900)).toThrow(RangeError);
  });
});
