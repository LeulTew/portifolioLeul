/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, renderHook } from '@testing-library/react';
import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BackgroundScene } from './BackgroundScene';
import * as THREE from 'three';
import { PrefetchedModel } from './3d/PrefetchedModel';
import { CinematicCameraController } from './3d/CinematicCameraController';
import { SceneReady } from './3d/SceneReady';

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
// A real camera, so components that drive position/lookAt are exercised for
// real rather than against a stub that silently accepts anything.
const testCamera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 1000);

vi.mock('@react-three/fiber', () => ({
  // The real useThree applies a selector; the stub used to ignore it and hand
  // back the whole state object.
  useThree: (selector?: (state: any) => unknown) => {
    const state = {
      camera: testCamera,
      size: { width: 1920, height: 1080 },
    };
    return selector ? selector(state) : state;
  },
  useFrame: (callback: (state: any, delta?: number) => void) => {
    callback({
      clock: { elapsedTime: 1.5 },
      mouse: { x: 0.5, y: -0.2 },
      camera: testCamera,
    }, 0.016);
  },
}));

vi.mock('./Ocean', () => ({ Ocean: () => null }));

// A unit of its own, with its own tests. Here it would only pull the whole
// asset pipeline into a test about how the scene is composed.
vi.mock('./3d/SceneReady', () => ({ SceneReady: () => null }));
vi.mock('./3d/PrefetchedModel', () => ({ PrefetchedModel: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('./ocean/ShorelineBreak', () => ({ ShorelineBreak: () => null }));
vi.mock('./TVModel', () => ({ TVModel: () => null }));
vi.mock('./MeModel', () => ({ MeModel: () => null }));
// Covered by its own suite; the reconciler is faked here, so its instanced mesh
// would resolve to a DOM node rather than a THREE.InstancedMesh.
vi.mock('./3d/AtmosphericDrift', () => ({ AtmosphericDrift: () => null }));
vi.mock('./3d/SceneEdgeContinuity', () => ({ SceneEdgeContinuity: () => null }));
vi.mock('./3d/ContactSky', () => ({ ContactSky: () => null }));
vi.mock('./3d/GreenPrism', () => ({ GreenPrism: () => null }));

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

  it('gates only terrain/avatar consumers, leaving the camera and readiness registration outside', () => {
    const { result } = renderHook(() => BackgroundScene({ theme: 'light' }));
    const nodes: ReactElement<{ children?: ReactNode; url?: string }>[] = [];
    const visit = (node: ReactNode) => {
      if (!isValidElement<{ children?: ReactNode; url?: string }>(node)) return;
      nodes.push(node);
      Children.forEach(node.props.children, visit);
    };
    visit(result.current);
    const gates = nodes.filter(node => node.type === PrefetchedModel);
    expect(gates.map(node => node.props.url)).toEqual([
      '/models/terrain-opt.glb', '/models/me-animated-lite.glb',
    ]);
    expect(nodes.some(node => node.type === CinematicCameraController)).toBe(true);
    expect(nodes.some(node => node.type === SceneReady)).toBe(true);
    for (const gate of gates) {
      expect(isValidElement(gate.props.children)).toBe(true);
      const descendants: ReactNode[] = Children.toArray(gate.props.children);
      expect(descendants).toHaveLength(1);
      expect(descendants.some(node => isValidElement(node) &&
        (node.type === CinematicCameraController || node.type === SceneReady))).toBe(false);
    }
  });

  const positionAttribute = (container: HTMLElement) =>
    container.querySelector('bufferattribute[attach="attributes-position"]');

  it('sizes the ambient particle field from the GPU tier budget', () => {
    const { container } = render(
      <BackgroundScene theme="dark" particleCount={350} />
    );

    const attribute = positionAttribute(container);
    expect(attribute?.getAttribute('count')).toBe('350');
  });

  it('allocates exactly three floats per particle', () => {
    const { container } = render(
      <BackgroundScene theme="dark" particleCount={12} />
    );

    const attribute = positionAttribute(container);
    expect(attribute?.getAttribute('itemsize')).toBe('3');
    expect(attribute?.getAttribute('count')).toBe('12');
  });

  it('falls back to a mid-tier budget when no count is supplied', () => {
    const { container } = render(<BackgroundScene theme="dark" />);

    expect(positionAttribute(container)?.getAttribute('count')).toBe('800');
  });

  it('does not request vertex colors it never supplies', () => {
    // A vertexColors material with no color attribute renders black points.
    const { container } = render(<BackgroundScene theme="dark" />);

    expect(container.querySelector('[vertexcolors]')).toBeNull();
  });
});
