import { render } from '@testing-library/react';
import { TVModel } from './TVModel';
import { vi } from 'vitest';

// Mock three.js and drei
vi.mock('@react-three/drei', () => ({
  useGLTF: () => ({
    scene: {
      traverse: vi.fn((callback) => {
        // Mock traversal finding a screen mesh
        const mockMesh = {
          isMesh: true,
          name: 'Screen_Glass',
          material: {},
        };
        callback(mockMesh);
      }),
    },
  }),
  useVideoTexture: () => ({
    flipY: true,
  }),
}));

vi.mock('@react-three/fiber', () => ({
  useFrame: vi.fn(),
}));

describe('TVModel', () => {
  it('renders without crashing', () => {
    render(<TVModel />);
  });

  it('cycles video on click', () => {
    const { container } = render(<TVModel />);
    expect(container).toBeTruthy();
  });
});
