import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { AvatarAcknowledgement } from './avatarRig';

function rig() {
  const root = new THREE.Group();
  const hips = new THREE.Bone(), spine = new THREE.Bone(), neck = new THREE.Bone(), head = new THREE.Bone();
  const foot = new THREE.Bone();
  spine.name = 'mixamorigSpine2'; neck.name = 'mixamorigNeck'; head.name = 'mixamorigHead';
  root.add(hips); hips.add(spine, foot); spine.add(neck); neck.add(head);
  spine.position.y = 2; neck.position.y = 1; head.position.y = 1; foot.position.y = -2;
  return { root, spine, neck, head, foot, gesture: new AvatarAcknowledgement(root) };
}

describe('the original rig acknowledgement', () => {
  it('actually rotates the existing head/chest but never moves the feet or root', () => {
    const { root, spine, head, foot, gesture } = rig();
    root.updateMatrixWorld(true);
    const planted = foot.getWorldPosition(new THREE.Vector3());
    gesture.apply(1, 1);
    root.updateMatrixWorld(true);
    expect(spine.quaternion.angleTo(new THREE.Quaternion())).toBeGreaterThan(0.23);
    expect(head.quaternion.angleTo(new THREE.Quaternion())).toBeGreaterThan(0.18);
    expect(foot.getWorldPosition(new THREE.Vector3()).distanceTo(planted)).toBe(0);
    expect(root.position.length()).toBe(0);
    expect(root.quaternion.equals(new THREE.Quaternion())).toBe(true);
  });

  it('does not accumulate offsets when the same mixer pose is held', () => {
    const { head, gesture } = rig();
    gesture.apply(0.8, 0.4);
    const first = head.quaternion.clone();
    for (let i = 0; i < 300; i++) gesture.apply(0.8, 0.4);
    expect(head.quaternion.angleTo(first)).toBeLessThan(1e-7);
    gesture.restore();
    expect(head.quaternion.equals(new THREE.Quaternion())).toBe(true);
  });

  it.each([0, 0.7, 1.4, 2.1, 3.5, 4.19])('restores the current animation sample at phase %f', time => {
    const { head, neck, spine, gesture } = rig();
    const base = new THREE.Quaternion().setFromEuler(new THREE.Euler(time / 12, -time / 15, 0.02));
    head.quaternion.copy(base); neck.quaternion.copy(base); spine.quaternion.copy(base);
    gesture.apply(1, 0.8);
    gesture.apply(0, 0);
    expect(head.quaternion.angleTo(base)).toBeLessThan(1e-7);
    expect(neck.quaternion.angleTo(base)).toBeLessThan(1e-7);
    expect(spine.quaternion.angleTo(base)).toBeLessThan(1e-7);
  });

  it('does not undo a newer mixer sample during skipped-frame or unmount cleanup', () => {
    const { head, gesture } = rig();
    gesture.apply(1, 1);
    const newer = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.1, -0.2, 0.05));
    head.quaternion.copy(newer);
    gesture.restore();
    expect(head.quaternion.equals(newer)).toBe(true);
    gesture.apply(1, 0.5);
    gesture.restore();
    expect(head.quaternion.equals(newer)).toBe(true);
  });

  it('warns and leaves unsupported models alone rather than replacing the scene', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const root = new THREE.Group();
    const gesture = new AvatarAcknowledgement(root);
    expect(gesture.supported).toBe(false);
    expect(warning).toHaveBeenCalledOnce();
    gesture.apply(1, 1);
    expect(root.quaternion.equals(new THREE.Quaternion())).toBe(true);
    warning.mockRestore();
  });
});
