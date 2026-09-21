import { act, cleanup, renderHook } from '@testing-library/react';
import { StrictMode, type MutableRefObject, type PropsWithChildren, type ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RootState } from '@react-three/fiber';
import { TVHardware } from './TVHardware';
import { dispatchTVHardware, TV_HARDWARE_MOTION } from '@/lib/tv/tvHardware';
import { TvHardwareGeometry } from '@/lib/tv/tvHardwareGeometry';

const invalidate = vi.hoisted(() => vi.fn());
let frame: (state: RootState, delta: number) => void;
vi.mock('@react-three/fiber', () => ({
  extend: vi.fn(),
  useThree: (selector: (state: { invalidate: typeof invalidate }) => unknown) => selector({ invalidate }),
  useFrame: (callback: typeof frame) => { frame = callback; },
}));

let geometry: TvHardwareGeometry;
let media: MediaQueryList;
let reducedChanged: () => void;

function harness(powered: boolean) {
  const tree = TVHardware({ powered });
  const element = tree.props.children[0] as ReactElement & { ref: MutableRefObject<TvHardwareGeometry> };
  element.ref.current = geometry;
  return tree;
}

function tick(seconds: number, frames = 1) {
  act(() => {
    for (let index = 0; index < frames; index++) frame({} as RootState, seconds);
  });
}

function faceZ(id: 'previous' | 'next' | 'power') {
  const { start, count } = geometry.capRanges[id];
  const position = geometry.getAttribute('position');
  return Math.max(...Array.from({ length: count }, (_, index) => position.getZ(start + index)));
}

beforeEach(() => {
  geometry = new TvHardwareGeometry();
  invalidate.mockClear();
  media = {
    matches: false,
    addEventListener: vi.fn((_name, callback: () => void) => { reducedChanged = callback; }),
    removeEventListener: vi.fn(),
  } as unknown as MediaQueryList;
  vi.spyOn(window, 'matchMedia').mockReturnValue(media);
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
});

afterEach(() => {
  cleanup();
  geometry.dispose();
  vi.restoreAllMocks();
});

describe('TVHardware lifecycle', () => {
  it('declares one owned material/geometry and no separate action handler or perpetual scheduler', () => {
    const raf = vi.spyOn(window, 'requestAnimationFrame');
    const timeout = vi.spyOn(window, 'setTimeout');
    const interval = vi.spyOn(window, 'setInterval');
    const { result } = renderHook(() => harness(false));
    expect(result.current.type).toBe('mesh');
    expect(result.current.props.onClick).toBeUndefined();
    expect(result.current.props.children).toHaveLength(2);
    expect(result.current.props.children[0].type).toBe('tvHardwareGeometry');
    expect(result.current.props.children[1].type).toBe('meshStandardMaterial');
    expect(result.current.props.children[1].props.vertexColors).toBe(true);
    expect(result.current.props.castShadow).toBeUndefined();
    expect(result.current.props.dispose).toBeUndefined();
    invalidate.mockClear();
    const upload = vi.spyOn(geometry, 'setDepth');
    tick(1 / 60, 120);
    expect(upload).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
    expect(raf).not.toHaveBeenCalled();
    expect(timeout).not.toHaveBeenCalled();
    expect(interval).not.toHaveBeenCalled();
  });

  it('animates native activation once, settles, then ceases frame uploads and invalidation', () => {
    renderHook(() => harness(false));
    act(() => {
      dispatchTVHardware('previous', 'press', true);
      dispatchTVHardware('previous', 'press', false);
    });
    tick(0.025, 3);
    expect(faceZ('previous')).toBeCloseTo(0.046 - TV_HARDWARE_MOTION.pressTravel, 7);
    expect(faceZ('next')).toBeCloseTo(0.046, 7);
    tick(0.025, 2);
    expect(faceZ('previous')).toBeCloseTo(0.046 - TV_HARDWARE_MOTION.pressTravel, 7);
    tick(0.025, 6);
    expect(faceZ('previous')).toBeCloseTo(0.046, 7);
    invalidate.mockClear();
    const upload = vi.spyOn(geometry, 'setDepth');
    tick(0.05, 20);
    expect(upload).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('keeps hover/focus decoration native and latches only the powered cap', () => {
    const { rerender } = renderHook(({ powered }) => harness(powered), { initialProps: { powered: false } });
    invalidate.mockClear();
    act(() => {
      dispatchTVHardware('next', 'hover', true);
      dispatchTVHardware('next', 'focus', true);
    });
    expect(invalidate).not.toHaveBeenCalled();
    rerender({ powered: true });
    tick(0.05, 3);
    expect(faceZ('power')).toBeCloseTo(0.0435, 7);
    expect(faceZ('next')).toBeCloseTo(0.046, 7);
    rerender({ powered: false });
    tick(0.05, 3);
    expect(faceZ('power')).toBeCloseTo(0.046, 7);
  });

  it('resets held caps on blur/hidden and ignores background dispatches', () => {
    renderHook(() => harness(true));
    act(() => { dispatchTVHardware('next', 'press', true); });
    tick(0.05, 3);
    expect(faceZ('next')).toBeCloseTo(0.038, 7);
    act(() => { window.dispatchEvent(new Event('blur')); });
    expect(faceZ('next')).toBeCloseTo(0.046, 7);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    invalidate.mockClear();
    act(() => { dispatchTVHardware('previous', 'press', true); });
    tick(0.05, 10);
    expect(faceZ('previous')).toBeCloseTo(0.046, 7);
    expect(faceZ('power')).toBeCloseTo(0.0435, 7);
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('responds to reduced-motion changes and unregisters without disposing cache-owned resources', () => {
    const dispose = vi.spyOn(geometry, 'dispose');
    const removeDocument = vi.spyOn(document, 'removeEventListener');
    const removeWindow = vi.spyOn(window, 'removeEventListener');
    const wrapper = ({ children }: PropsWithChildren) => <StrictMode>{children}</StrictMode>;
    const { unmount } = renderHook(() => harness(false), { wrapper });
    Object.defineProperty(media, 'matches', { value: true });
    act(() => { reducedChanged(); dispatchTVHardware('power', 'press', true); });
    expect(faceZ('power')).toBeCloseTo(0.046 - 0.008 * 0.35, 7);
    invalidate.mockClear();
    tick(0.05, 20);
    expect(invalidate).not.toHaveBeenCalled();
    unmount();
    expect(faceZ('power')).toBeCloseTo(0.046, 7);
    expect(media.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    expect(removeDocument).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    expect(removeWindow).toHaveBeenCalledWith('blur', expect.any(Function));
    expect(dispose).not.toHaveBeenCalled(); // R3F owns declarative resource teardown.
    act(() => { dispatchTVHardware('power', 'press', true); });
    expect(faceZ('power')).toBeCloseTo(0.046, 7);
  });
});
