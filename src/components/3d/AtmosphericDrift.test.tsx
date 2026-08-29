/* eslint-disable @typescript-eslint/no-explicit-any */
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AtmosphericDrift } from './AtmosphericDrift';

let frameCallback: ((state: any) => void) | null = null;

vi.mock('@react-three/fiber', () => ({
  useFrame: (callback: (state: any) => void) => {
    frameCallback = callback;
  },
}));

const reducedMotion = vi.fn(() => false);
vi.mock('@/lib/gateways/animationGateway', () => ({
  getPrefersReducedMotion: () => reducedMotion(),
}));

const writeSpy = vi.fn();
vi.mock('@/lib/atmosphere/writeDriftInstances', () => ({
  writeDriftInstances: (...args: unknown[]) => writeSpy(...args),
}));

const frame = (elapsed = 1) =>
  frameCallback?.({ clock: { getElapsedTime: () => elapsed } });

describe('AtmosphericDrift', () => {
  beforeEach(() => {
    frameCallback = null;
    writeSpy.mockClear();
    reducedMotion.mockReturnValue(false);
  });

  it('renders a single instanced draw call sized to the budget', () => {
    const { container } = render(<AtmosphericDrift count={120} color="#00ff9d" />);
    // One instanced mesh, not one node per mote.
    expect(container.querySelectorAll('instancedmesh')).toHaveLength(1);
    expect(container.querySelectorAll('octahedrongeometry')).toHaveLength(1);
  });

  it('renders nothing when the budget is zero', () => {
    const { container } = render(<AtmosphericDrift count={0} color="#00ff9d" />);
    expect(container.querySelector('instancedmesh')).toBeNull();
  });

  it('lays the field out once on mount, before any frame runs', () => {
    render(<AtmosphericDrift count={40} color="#00ff9d" />);
    expect(writeSpy).toHaveBeenCalledTimes(1);
    expect(writeSpy.mock.calls[0][3]).toBe(0);
  });

  it('advances the field with the clock on each frame', () => {
    render(<AtmosphericDrift count={40} color="#00ff9d" />);
    writeSpy.mockClear();

    frame(2.5);

    expect(writeSpy).toHaveBeenCalledTimes(1);
    expect(writeSpy.mock.calls[0][3]).toBe(2.5);
  });

  it('holds the field still under reduced motion', () => {
    reducedMotion.mockReturnValue(true);
    render(<AtmosphericDrift count={40} color="#00ff9d" />);
    writeSpy.mockClear();

    frame(4);

    // The mount-time layout still stands, so the field is visible but static.
    expect(writeSpy).not.toHaveBeenCalled();
  });

  it('does no per-frame work when the budget is zero', () => {
    render(<AtmosphericDrift count={0} color="#00ff9d" />);
    writeSpy.mockClear();

    frame(3);

    expect(writeSpy).not.toHaveBeenCalled();
  });
});
