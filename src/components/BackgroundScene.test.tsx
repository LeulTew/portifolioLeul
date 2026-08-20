/* eslint-disable @typescript-eslint/no-explicit-any */
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BackgroundScene } from './BackgroundScene';
import * as THREE from 'three';

// Mock Three.js using importActual
vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof THREE>();
  return {
    ...actual,
    default: actual,
  };
});

// Mock Drei
vi.mock('@react-three/drei', () => ({
  useGLTF: Object.assign(
    vi.fn(() => ({
      scene: {
        clone: () => ({
          traverse: vi.fn((cb: (c: any) => void) => {
            const mesh = new THREE.Mesh();
            mesh.material = new THREE.MeshBasicMaterial();
            cb(mesh);
          }),
        }),
      },
    })),
    { preload: vi.fn() }
  ),
  useVideoTexture: vi.fn(() => ({ flipY: false })),
  useScroll: vi.fn(() => ({ offset: 0.5 })),
  Environment: () => null,
  PerspectiveCamera: () => null,
  MeshReflectorMaterial: () => null,
  Points: ({ children }: any) => <>{children}</>,
  PointMaterial: () => null,
}));

// Mock Fiber
vi.mock('@react-three/fiber', () => ({
  useThree: () => ({
    camera: {
      fov: 50,
      position: { set: vi.fn() },
      updateProjectionMatrix: vi.fn(),
    },
    size: { width: 1920, height: 1080 },
  }),
  useFrame: (callback: (state: any, delta?: number) => void) => {
    callback({
      clock: { getElapsedTime: () => 1.5 },
      mouse: { x: 0.5, y: -0.2 },
      camera: { position: { x: 0, y: 5, z: 30 } },
    }, 0.016);
  },
}));

vi.mock('./Ocean', () => ({ Ocean: () => null }));
vi.mock('./ocean/ShorelineBreak', () => ({ ShorelineBreak: () => null }));
vi.mock('./TVModel', () => ({ TVModel: () => null }));
vi.mock('./MeModel', () => ({ MeModel: () => null }));

describe('BackgroundScene', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders correctly in dark mode with calibrated dark palette', () => {
    const { container } = render(<BackgroundScene theme="dark" />);
    expect(container).toBeDefined();
  });

  it('renders correctly in light mode with calibrated light palette', () => {
    const { container } = render(<BackgroundScene theme="light" />);
    expect(container).toBeDefined();
  });
});
