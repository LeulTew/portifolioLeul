import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CAMERA_CHAPTERS } from '@/lib/camera/cinematicSpline';
import { resetCameraHold, setOverlayOcclusion } from '@/lib/camera/cameraHold';
import { resetScrollProgress } from '@/lib/scroll/scrollProgress';
import { beginContactFlight, releaseContactSky } from '@/lib/contact/contactScene';
import { setProjectsView } from '@/lib/projects/projectsScene';
import { AvatarProjection } from './avatarProjection';
import {
  getAvatarEncounter, registerAvatarElements, resetAvatarEncounter,
  setAvatarEncounterEnabled, setAvatarHeroReady, setAvatarLayoutReady,
} from './avatarEncounter';

const camera = new THREE.PerspectiveCamera(50, 1.6, 0.1, 1000);
beforeEach(() => {
  resetAvatarEncounter(); resetCameraHold(); resetScrollProgress(); releaseContactSky();
  setProjectsView(false, 0, 0);
  camera.position.set(...CAMERA_CHAPTERS[0].position);
  camera.lookAt(...CAMERA_CHAPTERS[0].target);
  setAvatarEncounterEnabled(true);
});
afterEach(() => {
  document.querySelector('[data-testid="projects-stage"]')?.remove();
  resetAvatarEncounter(); resetCameraHold(); releaseContactSky(); setProjectsView(false, 0, 0);
});

describe('scene-wide avatar discovery', () => {
  it('waits for the Hero name but not for hidden Hero state in the Projects island', () => {
    const projection = new AvatarProjection();
    projection.paint(camera, 1440, 900, true);
    expect(getAvatarEncounter().available).toBe(false);
    const stage = document.createElement('div');
    stage.dataset.testid = 'projects-stage'; stage.dataset.phase = 'revealed';
    document.body.appendChild(stage);
    setProjectsView(true, 0, 0, 'skills');
    projection.paint(camera, 1440, 900, true);
    expect(getAvatarEncounter().heroReady).toBe(false);
    expect(getAvatarEncounter().available).toBe(true);
  });

  it('paints a real model-aligned native target after the Hero settles', () => {
    setAvatarHeroReady(true);
    const root = document.createElement('div'), target = document.createElement('button');
    const release = registerAvatarElements({ root, target });
    new AvatarProjection().paint(camera, 1440, 900, true);
    expect(getAvatarEncounter().available).toBe(true);
    expect(target.style.transform).toMatch(/^translate3d\(10/);
    expect(parseFloat(target.style.width)).toBeGreaterThanOrEqual(48);
    expect(parseFloat(target.style.height)).toBeGreaterThanOrEqual(48);
    release();
  });

  it('does not expose a phantom target through covered chapters, moving TV or Contact', () => {
    setAvatarHeroReady(true);
    const projection = new AvatarProjection();
    setOverlayOcclusion(true, 'skills');
    projection.paint(camera, 1440, 900, true);
    expect(getAvatarEncounter().available).toBe(false);
    setOverlayOcclusion(false, 'skills');
    setProjectsView(true, 0.4, 0);
    projection.paint(camera, 1440, 900, true);
    expect(getAvatarEncounter().available).toBe(false);
    setProjectsView(false, 0, 0);
    beginContactFlight(1);
    projection.paint(camera, 1440, 900, true);
    expect(getAvatarEncounter().available).toBe(false);
  });

  it('keeps a clipped character fully clickable while its cue stays on screen', () => {
    setAvatarHeroReady(true);
    camera.aspect = 1; camera.updateProjectionMatrix();
    const root = document.createElement('div'), target = document.createElement('button');
    const release = registerAvatarElements({ root, target });
    new AvatarProjection().paint(camera, 900, 900, true);
    const x = Number(target.style.transform.match(/translate3d\(([-.\d]+)/)?.[1]);
    const cueCenter = x + parseFloat(target.style.getPropertyValue('--avatar-cue-x'));
    expect(cueCenter).toBeLessThanOrEqual(836.1);
    expect(x).toBeLessThan(810);
    expect(x + parseFloat(target.style.width)).toBeGreaterThan(891);
    release();
  });

  it('rejects unsupported rigs and a figure outside the camera view', () => {
    setAvatarHeroReady(true);
    const projection = new AvatarProjection();
    projection.paint(camera, 1440, 900, false);
    expect(getAvatarEncounter().available).toBe(false);
    camera.lookAt(0, 0, 60);
    projection.paint(camera, 1440, 900, true);
    expect(getAvatarEncounter().available).toBe(false);
  });

  it('waits for the existing scroll-track repair instead of offering a click that immediately yields', () => {
    setAvatarHeroReady(true);
    const projection = new AvatarProjection();
    setAvatarLayoutReady(false);
    projection.paint(camera, 1440, 900, true);
    expect(getAvatarEncounter().available).toBe(false);
    setAvatarLayoutReady(true);
    projection.paint(camera, 1440, 900, true);
    expect(getAvatarEncounter().available).toBe(true);
  });
});
