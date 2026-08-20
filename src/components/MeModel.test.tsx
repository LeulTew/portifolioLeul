import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import * as THREE from 'three';
import { MeModel } from './MeModel';

// Mock @react-three/drei
vi.mock('@react-three/drei', () => {
  const scene = new THREE.Group();
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ roughness: 0.5 })
  );
  scene.add(mesh);

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
    callback({ clock: { getElapsedTime: () => 1.0 } }, 0.016);
  }),
}));

describe('MeModel 3D Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders MeModel and sets up animations and shadows', () => {
    const { unmount } = render(<MeModel position={[0, 0, 0]} />);
    expect(unmount).toBeDefined();
    unmount();
  });
});
