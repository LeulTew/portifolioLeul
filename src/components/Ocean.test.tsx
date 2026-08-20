import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import * as THREE from 'three';
import { Ocean } from './Ocean';

// Mock Water constructor class
vi.mock('three/examples/jsm/objects/Water.js', () => {
  class MockWater extends THREE.Mesh {
    constructor() {
      super();
      this.material = new THREE.ShaderMaterial({
        uniforms: {
          time: { value: 0 },
          sunColor: { value: new THREE.Color() },
          waterColor: { value: new THREE.Color() },
          distortionScale: { value: 2.25 },
          alpha: { value: 0.95 },
          size: { value: 1.45 },
        },
      });
    }
  }

  return {
    Water: MockWater,
  };
});

// Mock @react-three/fiber
vi.mock('@react-three/fiber', () => ({
  useFrame: vi.fn((callback) => {
    callback({}, 0.016);
  }),
  useLoader: vi.fn(() => new THREE.Texture()),
}));

describe('Ocean 3D Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dark theme ocean without crashing', () => {
    const { unmount } = render(<Ocean theme="dark" />);
    expect(unmount).toBeDefined();
    unmount();
  });

  it('renders light theme ocean without crashing', () => {
    const { unmount } = render(<Ocean theme="light" />);
    expect(unmount).toBeDefined();
    unmount();
  });
});
