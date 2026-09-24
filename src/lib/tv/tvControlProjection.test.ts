import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ProjectsCameraPose } from '@/lib/projects/tvScreen';
import { setIslandHeroReady, setIslandLayoutReady, claimIslandSecret, releaseIslandSecret } from '@/lib/scene/islandSecret';
import { resetCameraHold, setOverlayOcclusion } from '@/lib/camera/cameraHold';
import { releaseContactSky, parkContactSky } from '@/lib/contact/contactScene';
import { resetScrollProgress } from '@/lib/scroll/scrollProgress';
import { TVControlProjection, registerTVTargets } from './tvControlProjection';
import { getTVState, resetTVState, setTVProjectPhase } from './tvState';
import { TV_CONTROLS, TV_CONTROL_IDS } from './tvHardware';

beforeEach(() => {
  resetTVState(); resetCameraHold(); resetScrollProgress(); releaseContactSky();
  releaseIslandSecret('avatar'); releaseIslandSecret('prism');
  setIslandHeroReady(true); setIslandLayoutReady(true);
});
afterEach(() => { resetTVState(); resetCameraHold(); releaseContactSky(); releaseIslandSecret('avatar'); });

describe('physical TV controls projected onto the real fascia', () => {
  it.each([[900, 560], [900, 900], [1440, 900], [3840, 2160]])(
    'fits three distinct native 48px targets at %ix%i', (width, height) => {
      const targets = { previous: document.createElement('button'), next: document.createElement('button'),
        power: document.createElement('button') };
      const release = registerTVTargets(targets);
      const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
      new ProjectsCameraPose().sample(1, 1, width, height, 50, camera.position, camera.quaternion);
      setTVProjectPhase('reading');
      new TVControlProjection().paint(camera, width, height);
      expect(getTVState().layout).toBe('all');
      let lastRight = 0;
      for (const id of TV_CONTROL_IDS) {
        const element = targets[id], control = TV_CONTROLS[id];
        expect(control.width).toBeGreaterThan(0);
        const coordinates = element.style.transform.match(/translate3d\(([-.\d]+)px, ([-.\d]+)px/)!;
        const left = Number(coordinates[1]), top = Number(coordinates[2]);
        const targetWidth = parseFloat(element.style.width), targetHeight = parseFloat(element.style.height);
        expect(targetWidth).toBeGreaterThanOrEqual(48);
        expect(targetHeight).toBeGreaterThanOrEqual(48);
        expect(left).toBeGreaterThan(lastRight + 1);
        expect(top).toBeGreaterThan(96);
        expect(top + targetHeight).toBeLessThan(height - 16);
        lastRight = left + targetWidth;
      }
      expect(lastRight).toBeLessThan(width - 24);
      release();
    },
  );

  it('allows the visible power switch before close-up but never through the TV back', () => {
    const projection = new TVControlProjection();
    const camera = new THREE.PerspectiveCamera(50, 1.6, 0.1, 1000);
    const sampler = new ProjectsCameraPose();
    sampler.sample(1, 0, 1440, 900, 50, camera.position, camera.quaternion);
    setTVProjectPhase('framed'); projection.paint(camera, 1440, 900);
    expect(getTVState().exposed).toBe(true);
    expect(getTVState().layout).not.toBe('hidden');
    sampler.sample(0, 0, 1440, 900, 50, camera.position, camera.quaternion);
    projection.paint(camera, 1440, 900);
    expect(getTVState().layout).toBe('hidden');
  });

  it.each([[900, 560], [1440, 900]])('keeps both broadcast channel keys usable before close-up at %ix%i', (width, height) => {
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    new ProjectsCameraPose().sample(1, 0, width, height, 50, camera.position, camera.quaternion);
    setTVProjectPhase('framed');
    new TVControlProjection().paint(camera, width, height);
    expect(getTVState()).toMatchObject({ exposed: true, layout: 'all' });
  });

  it('retires targets and decoding behind chapters, Contact and optional encounters', () => {
    const projection = new TVControlProjection();
    const camera = new THREE.PerspectiveCamera(50, 1.6, 0.1, 1000);
    new ProjectsCameraPose().sample(1, 1, 1440, 900, 50, camera.position, camera.quaternion);
    setTVProjectPhase('reading');
    projection.paint(camera, 1440, 900); expect(getTVState().exposed).toBe(true);
    setOverlayOcclusion(true, 'skills');
    projection.paint(camera, 1440, 900); expect(getTVState().exposed).toBe(false);
    setOverlayOcclusion(false, 'skills'); parkContactSky();
    projection.paint(camera, 1440, 900); expect(getTVState().exposed).toBe(false);
    releaseContactSky(); claimIslandSecret('avatar');
    projection.paint(camera, 1440, 900); expect(getTVState().exposed).toBe(false);
  });

  it('does not cover the compact flat reader with imaginary physical hit targets', () => {
    const camera = new THREE.PerspectiveCamera(50, 800 / 600, 0.1, 1000);
    new ProjectsCameraPose().sample(1, 1, 800, 600, 50, camera.position, camera.quaternion);
    new TVControlProjection().paint(camera, 800, 600);
    expect(getTVState()).toMatchObject({ exposed: false, layout: 'hidden' });
  });
});
