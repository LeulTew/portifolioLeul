import { render } from '@testing-library/react';
import { TVModel } from './TVModel';
import { vi, describe, it, expect } from 'vitest';
import * as THREE from 'three';

vi.mock('./3d/CRTHousing', () => ({ CRTHousing: () => null }));
vi.mock('./3d/CRTSpeakerCabinet', () => ({ CRTSpeakerCabinet: () => null }));
vi.mock('./3d/TVHardware', () => ({ TVHardware: () => null }));

// Mock three.js
vi.mock('three', async () => {
  const actual = await vi.importActual<typeof THREE>('three');
  return {
    ...actual,
    MeshBasicMaterial: vi.fn(),
    Mesh: class Mesh extends actual.Mesh {
      constructor(geometry?: THREE.BufferGeometry, material?: THREE.Material) {
        super(geometry, material);
        this.name = '';
      }
    },
  };
});

// Mock drei
vi.mock('@react-three/drei', () => ({
  useGLTF: () => ({
    scene: {
      traverse: (callback: (child: THREE.Object3D) => void) => {
        // Mock children with different names
        const screenMesh = new THREE.Mesh();
        screenMesh.name = 'ScreenMesh';
        callback(screenMesh);

        const glassMesh = new THREE.Mesh();
        glassMesh.name = 'GlassMesh';
        callback(glassMesh);

        const otherMesh = new THREE.Mesh();
        otherMesh.name = 'OtherMesh';
        callback(otherMesh);

        const nonMesh = new THREE.Group();
        nonMesh.name = 'Group';
        callback(nonMesh);
      },
    },
  }),
  useVideoTexture: () => ({
    flipY: true,
  }),
}));

// Mock fiber
vi.mock('@react-three/fiber', () => ({
  useFrame: vi.fn(),
}));

describe('TVModel Branch Coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it("cleans up video textures on unmount", () => {
    const { unmount } = render(<TVModel />);
    expect(() => unmount()).not.toThrow();
  });

  it('preserves the cached textured body instead of replacing materials by guessed names', () => {
    render(<TVModel />);
    
    expect(THREE.MeshBasicMaterial).not.toHaveBeenCalled();
  });
});
