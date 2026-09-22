import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import * as THREE from 'three';
import { MeModel } from './MeModel';
import { useGLTF } from '@react-three/drei';
import { resetFrameGate, setFrameBudget } from '@/lib/render/frameGate';
import { resetCameraHold, setOverlayOcclusion } from '@/lib/camera/cameraHold';

type FrameCallback = (state: {
  clock: { elapsedTime: number }; camera: THREE.PerspectiveCamera; size: { width: number; height: number };
}, delta: number) => void;

const harness = vi.hoisted(() => ({
  frame: (() => {}) as FrameCallback,
  reduced: false,
}));

// Mock @react-three/drei
vi.mock('@react-three/drei', () => {
  const scene = new THREE.Group();
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ roughness: 0.5 })
  );
  scene.add(mesh);
  for (const name of ['Spine2', 'Neck', 'Head']) {
    const bone = new THREE.Bone();
    bone.name = `mixamorig${name}`;
    scene.add(bone);
  }

  const animations = [new THREE.AnimationClip('Idle', 1, [
    new THREE.NumberKeyframeTrack('mixamorigHead.position[x]', [0, 1], [0, 0.1]),
  ])];
  return {
    useGLTF: Object.assign(
      vi.fn(() => ({
        scene,
        animations,
      })),
      {
        preload: vi.fn(),
      }
    ),
  };
});

// Mock @react-three/fiber
vi.mock('@react-three/fiber', () => ({
  useFrame: vi.fn((callback) => {
    harness.frame = callback;
  }),
}));
vi.mock('@/lib/gateways/animationGateway', () => ({
  usePrefersReducedMotion: () => harness.reduced,
}));

function tick(time: number) {
  harness.frame({
    clock: { elapsedTime: time }, camera: new THREE.PerspectiveCamera(50),
    size: { width: 1440, height: 900 },
  }, 1 / 180);
}

describe('MeModel 3D Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    harness.reduced = false;
    resetFrameGate();
    resetCameraHold();
  });
  afterEach(() => vi.restoreAllMocks());

  it('renders MeModel and sets up animations and shadows', () => {
    const { unmount } = render(<MeModel position={[0, 0, 0]} />);
    expect(unmount).toBeDefined();
    unmount();
  });

  it('does not dispose the cached model when an instance unmounts', () => {
    const view = render(<MeModel />);
    const loaded: { scene: THREE.Group } = vi.mocked(useGLTF).mock.results[0].value;
    const mesh = loaded.scene.children.find(child => child instanceof THREE.Mesh);
    if (!(mesh instanceof THREE.Mesh) || Array.isArray(mesh.material)) throw new Error('Expected the cached mesh fixture');
    const geometry = vi.spyOn(mesh.geometry, 'dispose');
    const material = vi.spyOn(mesh.material, 'dispose');
    view.unmount();
    expect(geometry).not.toHaveBeenCalled();
    expect(material).not.toHaveBeenCalled();
  });

  it('evaluates the actual mixer only on visible, budgeted frames', () => {
    const update = vi.spyOn(THREE.AnimationMixer.prototype, 'update');
    const view = render(<MeModel />);
    setFrameBudget(1 / 60);
    for (let frame = 0; frame < 180; frame++) tick(frame / 180);
    expect(update).toHaveBeenCalledTimes(60);
    setOverlayOcclusion(true, 'skills');
    for (let frame = 180; frame < 360; frame++) tick(frame / 180);
    expect(update).toHaveBeenCalledTimes(60);
    setOverlayOcclusion(false, 'skills');
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    tick(3);
    expect(update).toHaveBeenCalledTimes(60);
    view.unmount();
  });

  it('samples rather than runs the mixer when reduced motion is enabled', () => {
    const update = vi.spyOn(THREE.AnimationMixer.prototype, 'update');
    harness.reduced = true;
    const view = render(<MeModel />);
    for (let frame = 0; frame < 180; frame++) tick(frame / 180);
    expect(update).toHaveBeenCalledExactlyOnceWith(0);
    view.unmount();
  });
});
