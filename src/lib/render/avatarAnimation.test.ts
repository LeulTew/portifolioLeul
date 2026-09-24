import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { AvatarAcknowledgement } from '@/lib/avatar/avatarRig';
import { AvatarAnimation } from './avatarAnimation';
import { drawnFrameDelta, isFrameDrawn, resetFrameGate, setFrameBudget } from './frameGate';
import { resetCameraHold, setOverlayOcclusion } from '@/lib/camera/cameraHold';

function rig() {
  const root = new THREE.Group();
  const bones = ['Spine2', 'Neck', 'Head'].map((name, index) => {
    const bone = new THREE.Bone();
    bone.name = `mixamorig${name}`;
    bone.rotation.set(index * 0.05, 0.12, -0.03);
    root.add(bone);
    return bone;
  });
  const values = [0, 0.4, 0].flatMap(angle => new THREE.Quaternion().setFromEuler(new THREE.Euler(angle, 0, 0)).toArray());
  const clip = new THREE.AnimationClip('Wave', 2, [
    new THREE.QuaternionKeyframeTrack('mixamorigHead.quaternion', [0, 1, 2], values),
  ]);
  const acknowledgement = new AvatarAcknowledgement(root);
  const original = bones.map(bone => bone.quaternion.clone());
  return { root, bones, clip, acknowledgement, original };
}

beforeEach(() => { resetCameraHold(); resetFrameGate(); });
afterEach(() => { resetCameraHold(); resetFrameGate(); vi.restoreAllMocks(); });

describe('visible-time avatar mixer ownership', () => {
  it('keeps the authored clip speed at 60fps on a 180Hz display', () => {
    const fixture = rig();
    const animation = new AvatarAnimation(fixture.root, [fixture.clip], fixture.acknowledgement);
    const reference = rig();
    const originalMixer = new THREE.AnimationMixer(reference.root);
    originalMixer.clipAction(reference.clip).reset().fadeIn(0.5).play();
    const update = vi.spyOn(animation.mixer, 'update');
    setFrameBudget(1 / 60);
    for (let frame = 0; frame <= 180; frame++) {
      originalMixer.update(1 / 180);
      if (isFrameDrawn(frame / 180)) animation.update(drawnFrameDelta(frame / 180, 1 / 180), 0, 0, false);
    }
    expect(update).toHaveBeenCalledTimes(61);
    expect(animation.mixer.time).toBeCloseTo(originalMixer.time, 10);
    expect(fixture.bones[2].quaternion.angleTo(reference.bones[2].quaternion)).toBeLessThan(0.000001);
    animation.dispose();
    originalMixer.stopAllAction();
    originalMixer.uncacheRoot(reference.root);
  });

  it('restores tracked and untracked joints before evaluating and adding attention', () => {
    const fixture = rig();
    const animation = new AvatarAnimation(fixture.root, [fixture.clip], fixture.acknowledgement);
    const order: string[] = [];
    const restore = fixture.acknowledgement.restore.bind(fixture.acknowledgement);
    vi.spyOn(fixture.acknowledgement, 'restore').mockImplementation(() => { order.push('restore'); restore(); });
    const update = animation.mixer.update.bind(animation.mixer);
    vi.spyOn(animation.mixer, 'update').mockImplementation(delta => { order.push('mixer'); return update(delta); });
    const apply = fixture.acknowledgement.apply.bind(fixture.acknowledgement);
    vi.spyOn(fixture.acknowledgement, 'apply').mockImplementation((attention, nod) => {
      order.push('additive');
      apply(attention, nod);
    });
    animation.update(0.05, 0.8, 0.4, false);
    const untrackedPose = fixture.bones[0].quaternion.clone();
    order.length = 0;
    animation.update(0.05, 0.8, 0.4, false);
    expect(order.slice(0, 3)).toEqual(['restore', 'mixer', 'additive']);
    expect(fixture.bones[0].quaternion.toArray()).toEqual(untrackedPose.toArray());
    animation.update(0.05, 0, 0, false);
    expect(fixture.bones[0].quaternion.toArray()).toEqual(fixture.original[0].toArray());
    expect(fixture.bones[1].quaternion.toArray()).toEqual(fixture.original[1].toArray());
    animation.dispose();
  });

  it('does no hidden/occluded mixer work and resumes without accumulating invisible time', () => {
    const fixture = rig();
    const animation = new AvatarAnimation(fixture.root, [fixture.clip], fixture.acknowledgement);
    const update = vi.spyOn(animation.mixer, 'update');
    const tick = (time: number) => {
      if (isFrameDrawn(time)) animation.update(drawnFrameDelta(time, 1 / 60), 0, 0, false);
      else animation.suspend();
    };
    tick(0);
    setOverlayOcclusion(true, 'skills');
    for (let frame = 1; frame < 180; frame++) tick(frame / 180);
    expect(update).toHaveBeenCalledTimes(1);
    setOverlayOcclusion(false, 'skills');
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    tick(20);
    expect(update).toHaveBeenCalledTimes(1);
    hidden.mockReturnValue(false);
    tick(30);
    expect(update).toHaveBeenCalledTimes(2);
    expect(animation.mixer.time).toBeCloseTo(2 / 60);
    animation.dispose();
  });

  it('samples an initial reduced-motion pose once and preserves its authored animation for resume', () => {
    const fixture = rig();
    const animation = new AvatarAnimation(fixture.root, [fixture.clip], fixture.acknowledgement);
    const update = vi.spyOn(animation.mixer, 'update');
    for (let frame = 0; frame < 120; frame++) animation.update(1 / 60, 0.9, 1, true);
    expect(update).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledWith(0);
    expect(fixture.bones[2].quaternion.toArray()).toEqual([0, 0, 0, 1]);
    expect(animation.mixer.time).toBe(0);
    animation.update(1 / 60, 0, 0, false);
    expect(update).toHaveBeenCalledTimes(2);
    expect(animation.mixer.time).toBeCloseTo(1 / 60);
    animation.dispose();
  });

  it('clears an active additive pose on motion reduction without resetting the authored clip clock', () => {
    const fixture = rig();
    const animation = new AvatarAnimation(fixture.root, [fixture.clip], fixture.acknowledgement);
    animation.update(0.05, 1, 1, false);
    const clock = animation.mixer.time;
    const update = vi.spyOn(animation.mixer, 'update');
    for (let frame = 0; frame < 60; frame++) animation.update(1 / 60, 1, 1, true);
    expect(update).not.toHaveBeenCalled();
    expect(animation.mixer.time).toBe(clock);
    expect(fixture.bones[0].quaternion.toArray()).toEqual(fixture.original[0].toArray());
    animation.dispose();
  });

  it('restores the cached rig exactly and uncaches bindings on every unmount/remount', () => {
    const fixture = rig();
    for (let cycle = 0; cycle < 8; cycle++) {
      const animation = new AvatarAnimation(fixture.root, [fixture.clip], fixture.acknowledgement);
      const stop = vi.spyOn(animation.mixer, 'stopAllAction');
      const uncache = vi.spyOn(animation.mixer, 'uncacheRoot');
      for (let frame = 0; frame < 60; frame++) animation.update(1 / 60, 1, 0.8, false);
      animation.dispose();
      animation.dispose();
      expect(stop).toHaveBeenCalledOnce();
      expect(uncache).toHaveBeenCalledExactlyOnceWith(fixture.root);
      fixture.bones.forEach((bone, index) => expect(bone.quaternion.toArray()).toEqual(fixture.original[index].toArray()));
      const update = vi.spyOn(animation.mixer, 'update');
      animation.update(1, 1, 1, false);
      expect(update).not.toHaveBeenCalled();
    }
  });
});
