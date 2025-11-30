/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, act, fireEvent } from '@testing-library/react';
import { TVModel } from './TVModel';
import { vi } from 'vitest';

// Mock three.js and drei
const mockUseGLTF = vi.fn(() => ({
  scene: {
    traverse: vi.fn((callback: (obj: any) => void) => {
      // Mock traversal finding a screen mesh
      const mockMesh = {
        isMesh: true,
        name: 'Screen_Glass',
        material: {},
      };
      callback(mockMesh);
    }),
  },
}));

vi.mock('three', () => {
  const THREE = {
    Mesh: class {},
    MeshBasicMaterial: class {
      map: any;
      toneMapped: boolean;
      constructor(opts: any) {
        this.map = opts.map;
        this.toneMapped = opts.toneMapped;
      }
    },
    Group: class {},
    Texture: class {
      flipY: boolean = true;
    },
    VideoTexture: class {
      flipY: boolean = true;
      constructor(video: any) {}
    },
    DoubleSide: 2,
  };
  return { ...THREE, default: THREE, ...THREE };
});

vi.mock('@react-three/drei', () => ({
  useGLTF: () => mockUseGLTF(),
  useVideoTexture: () => ({
    flipY: true,
  }),
}));

vi.mock('@react-three/fiber', () => ({
  useFrame: vi.fn(),
}));

// Mock document.createElement for video
const originalCreateElement = document.createElement;
document.createElement = vi.fn((tagName: string) => {
  if (tagName === 'video') {
    return {
      src: '',
      crossOrigin: '',
      loop: false,
      muted: false,
      play: vi.fn(),
      pause: vi.fn(),
      setAttribute: vi.fn(),
    } as unknown as HTMLVideoElement;
  }
  return originalCreateElement.call(document, tagName);
}) as any;

describe('TVModel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders without crashing', () => {
    render(<TVModel />);
  });

  it('cycles video on click', () => {
    const { container } = render(<TVModel />);
    const group = container.firstChild;
    if (group) {
      fireEvent.click(group);
    }
  });

  it('sets up interval for video cycling', () => {
    const spy = vi.spyOn(global, 'setInterval');
    render(<TVModel />);
    expect(spy).toHaveBeenCalledWith(expect.any(Function), 8000);
  });

  it('cycles video automatically', () => {
    render(<TVModel />);
    act(() => {
      vi.advanceTimersByTime(8000);
    });
  });

  it('cycles video multiple times', () => {
    render(<TVModel />);
    act(() => {
      vi.advanceTimersByTime(8000); 
    });
    act(() => {
      vi.advanceTimersByTime(8000); 
    });
    act(() => {
      vi.advanceTimersByTime(8000); 
    });
  });

  it('handles click to cycle videos', () => {
    const { container } = render(<TVModel />);
    const group = container.firstChild;
    if (group) {
      fireEvent.click(group);
      act(() => {
        vi.advanceTimersByTime(100);
      });
    }
  });
});
