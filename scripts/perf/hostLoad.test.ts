import { describe, expect, it } from 'vitest';
import { busyPercent, cpuTimes, measureBusy } from './hostLoad';

const core = (user: number, idle: number) => ({ times: { user, nice: 0, sys: 0, idle, irq: 0 } });

describe('host load', () => {
  it('sums every core', () => {
    expect(cpuTimes(() => [core(30, 70), core(10, 90)])).toEqual({ idle: 160, total: 200 });
  });

  it('reports the busy share between two readings', () => {
    expect(busyPercent({ idle: 100, total: 200 }, { idle: 140, total: 300 })).toBe(60);
    expect(busyPercent({ idle: 0, total: 0 }, { idle: 100, total: 100 })).toBe(0);
    // No time passed, or counters that went backwards: no reading, not a false zero.
    expect(busyPercent({ idle: 5, total: 10 }, { idle: 5, total: 10 })).toBeNull();
    expect(busyPercent({ idle: 5, total: 10 }, { idle: 1, total: 4 })).toBeNull();
  });

  it('measures a window of other work', async () => {
    let reads = 0;
    const read = () => (reads++ === 0 ? [core(0, 0)] : [core(25, 75)]);
    expect(await measureBusy(1, read)).toBe(25);
  });
});
