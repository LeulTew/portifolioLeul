/* eslint-disable @typescript-eslint/no-explicit-any */
import { render } from '@testing-library/react';
import { TVModel } from './TVModel';
import { vi, describe, it, expect } from 'vitest';
import * as THREE from 'three';

vi.mock('./3d/CRTHousing', () => ({ CRTHousing: () => null }));
vi.mock('./3d/CRTSupports', () => ({ CRTSupports: () => null }));

// Mock three.js
vi.mock('three', async () => {
  const actual = await vi.importActual('three');
  return {
    ...actual,
    Mesh: class {
      name: string;
      material: any;
      constructor() {
        this.name = '';
      }
    },
    MeshBasicMaterial: class {
      map: any;
      toneMapped: boolean;
      constructor(opts: any) {
        this.map = opts.map;
        this.toneMapped = opts.toneMapped;
      }
    },
  };
});

// Mock drei
const mockTraverse = vi.fn();
vi.mock('@react-three/drei', () => ({
  useGLTF: () => ({
    scene: {
      traverse: mockTraverse,
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

describe('TVModel Coverage', () => {
  it('uses the explicit video plane without mutating the cached model', () => {
    // Setup traverse to call back with a mock mesh that passes the instanceof check
    mockTraverse.mockImplementation((callback: (obj: any) => void) => {
      const mockMesh = new THREE.Mesh();
      mockMesh.name = 'Screen_Glass';
      callback(mockMesh);
    });

    const { container } = render(<TVModel />);

    expect(mockTraverse).not.toHaveBeenCalled();
    expect(container.querySelector('planeGeometry')).toHaveAttribute('args', '0.55,0.32');
    expect(container.querySelectorAll('meshBasicMaterial')).toHaveLength(1);
  });
});
