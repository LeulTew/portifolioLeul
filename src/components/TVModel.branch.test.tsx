import { render } from '@testing-library/react';
import { TVModel } from './TVModel';
import { vi, describe, it, expect } from 'vitest';
import * as THREE from 'three';
import React from 'react';

// Mock three.js
vi.mock('three', async () => {
  const actual = await vi.importActual<typeof THREE>('three');
  return {
    ...actual,
    MeshBasicMaterial: vi.fn(),
    Mesh: class Mesh extends actual.Mesh {
      constructor(geometry?: any, material?: any) {
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
      traverse: (callback: (child: any) => void) => {
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
  it('applies material only to screen and glass meshes', () => {
    render(<TVModel />);
    
    // We can check if MeshBasicMaterial was instantiated
    // It should be called for ScreenMesh and GlassMesh, but not OtherMesh or Group
    expect(THREE.MeshBasicMaterial).toHaveBeenCalledTimes(2);
  });
});
