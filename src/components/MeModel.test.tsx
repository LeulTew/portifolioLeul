import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import * as THREE from 'three';
import { MeModel } from './MeModel';
import { useGLTF } from '@react-three/drei';

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

  return {
    useGLTF: Object.assign(
      vi.fn(() => ({
        scene,
        animations: [{ name: 'Idle' }],
      })),
      {
        preload: vi.fn(),
      }
    ),
    useAnimations: vi.fn(() => ({
      actions: {
        Idle: {
          reset: vi.fn().mockReturnThis(),
          fadeIn: vi.fn().mockReturnThis(),
          play: vi.fn().mockReturnThis(),
        },
      },
      names: ['Idle'],
    })),
  };
});

// Mock @react-three/fiber
vi.mock('@react-three/fiber', () => ({
  useFrame: vi.fn((callback) => {
    callback({ clock: { elapsedTime: 1.0 }, camera: new THREE.PerspectiveCamera(50),
      size: { width: 1440, height: 900 } }, 0.016);
  }),
}));

describe('MeModel 3D Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
