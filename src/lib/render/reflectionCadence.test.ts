import { describe, expect, it } from 'vitest';
import { createReflectionCadence } from './reflectionCadence';

describe('software water reflection cadence', () => {
  it('keeps a live reflection without rendering the scene twice on every frame', () => {
    const due = createReflectionCadence(10);
    let updates = 0;
    for (let frame = 0; frame < 30; frame++) if (due(frame / 30)) updates++;
    expect(updates).toBe(10);
  });

  it('updates immediately on the first frame, return from a hold, or restarted clock', () => {
    const due = createReflectionCadence(10);
    expect(due(0)).toBe(true);
    expect(due(0.03)).toBe(false);
    expect(due(20)).toBe(true);
    expect(due(0)).toBe(true);
  });

  it('does not alter the normal graphics reflection rate', () => {
    const due = createReflectionCadence(0);
    expect([0, 0.005, 0.01].every(due)).toBe(true);
  });
});
