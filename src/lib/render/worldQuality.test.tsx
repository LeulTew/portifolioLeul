import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PRESSURE_POLICY, createPressureGauge, getWorldQualityLevel, observeWorldFrame, pauseWorldQuality,
  resetWorldQuality, setWorldQualityLevels, subscribeWorldQuality, useWorldQuality, worldQualitySteps,
  type PressureGauge,
} from './worldQuality';

const ON_TIME = 1 / 60;
const LATE = 1 / 30;

/** Draws `seconds` of frames cycling through `pattern`, against `budget`; returns the level after each. */
function draw(gauge: PressureGauge, seconds: number, pattern: number[], budget = ON_TIME): number[] {
  const levels: number[] = [];
  for (let elapsed = 0, index = 0; elapsed < seconds; index++) {
    const interval = pattern[index % pattern.length];
    elapsed += interval;
    levels.push(gauge.observe(interval, budget));
  }
  return levels;
}

/** Seconds of drawing until the level first differs from `from`, or Infinity. */
function secondsUntilChange(gauge: PressureGauge, pattern: number[], budget: number, limit = 400) {
  const from = gauge.level;
  let elapsed = 0;
  for (let index = 0; elapsed < limit; index++) {
    const interval = pattern[index % pattern.length];
    elapsed += interval;
    if (gauge.observe(interval, budget) !== from) return elapsed;
  }
  return Infinity;
}

afterEach(() => {
  resetWorldQuality();
  vi.useRealTimers();
});

describe('the steps a tier can take', () => {
  it('halves the redraw ceiling, then drops to one device pixel per CSS pixel', () => {
    expect(worldQualitySteps({ maxFps: 60, dpr: [1, 2] })).toEqual([
      { level: 0, maxFps: 60, dpr: [1, 2] },
      { level: 1, maxFps: 30, dpr: [1, 2] },
      { level: 2, maxFps: 30, dpr: [1, 1] },
    ]);
    expect(worldQualitySteps({ maxFps: 0, dpr: [1, 1.5] }).map(step => step.maxFps)).toEqual([0, 30, 30]);
  });

  it('leaves a tier that already draws at the floor alone', () => {
    expect(worldQualitySteps({ maxFps: 30, dpr: [1, 1] })).toEqual([{ level: 0, maxFps: 30, dpr: [1, 1] }]);
    expect(worldQualitySteps({ maxFps: 30, dpr: [0.4, 0.4] })).toHaveLength(1);
    expect(worldQualitySteps({ maxFps: 60, dpr: [1, 1] })).toHaveLength(2);
  });
});

describe('judging frame pressure', () => {
  it('does not lower quality for one slow frame or a short spike', () => {
    const gauge = createPressureGauge(3);
    draw(gauge, 5, [ON_TIME]);
    gauge.observe(0.2, ON_TIME);
    draw(gauge, 5, [ON_TIME]);
    draw(gauge, 0.5, [LATE]);
    expect(Math.max(...draw(gauge, 10, [ON_TIME]))).toBe(0);
  });

  it('lowers it once a window of frames keeps missing the budget, one step per window', () => {
    const gauge = createPressureGauge(3);
    draw(gauge, PRESSURE_POLICY.warmupSeconds, [ON_TIME]);
    // Every other frame a refresh late: 40 fps against a budget of 60.
    const first = secondsUntilChange(gauge, [ON_TIME, LATE], ON_TIME);
    expect(gauge.level).toBe(1);
    expect(first).toBeGreaterThan(PRESSURE_POLICY.windowSeconds * 0.9);
    expect(first).toBeLessThan(PRESSURE_POLICY.windowSeconds * 1.1);
    // At 30 a second the budget is 1/30: a steady 16 fps is late against it.
    expect(secondsUntilChange(gauge, [0.06], LATE)).toBeGreaterThan(PRESSURE_POLICY.windowSeconds * 0.9);
    expect(gauge.level).toBe(2);
    expect(secondsUntilChange(gauge, [0.06], LATE, 30)).toBe(Infinity);
  });

  it('judges nothing while shaders compile, and nothing of stalls', () => {
    const gauge = createPressureGauge(3);
    expect(Math.max(...draw(gauge, PRESSURE_POLICY.warmupSeconds * 0.95, [LATE]))).toBe(0);
    const stalls = createPressureGauge(3);
    draw(stalls, PRESSURE_POLICY.warmupSeconds, [ON_TIME]);
    expect(Math.max(...draw(stalls, 20, [ON_TIME, 0.4, 0.3]))).toBe(0);
  });

  it('forgets what it was judging when the world stops drawing', () => {
    const gauge = createPressureGauge(3);
    draw(gauge, PRESSURE_POLICY.warmupSeconds, [ON_TIME]);
    for (let bursts = 0; bursts < 20; bursts++) {
      draw(gauge, 1.2, [LATE]);
      gauge.pause();
    }
    expect(gauge.level).toBe(0);
  });

  it('tries the step up after calm, and waits longer after each try that fails', () => {
    const gauge = createPressureGauge(2);
    draw(gauge, PRESSURE_POLICY.warmupSeconds, [ON_TIME]);
    secondsUntilChange(gauge, [LATE], ON_TIME);
    expect(gauge.level).toBe(1);
    // Calm at 30: the first try comes after the base wait.
    expect(secondsUntilChange(gauge, [LATE], LATE)).toBeCloseTo(PRESSURE_POLICY.recoverSeconds, 0);
    expect(gauge.level).toBe(0);
    const waits: number[] = [];
    for (let attempt = 0; attempt < 6; attempt++) {
      // The device still cannot hold 60, so each try fails within its first window...
      expect(secondsUntilChange(gauge, [LATE], ON_TIME)).toBeLessThan(PRESSURE_POLICY.probeSeconds);
      // ...and the next try waits twice as long, up to the ceiling.
      waits.push(Math.round(secondsUntilChange(gauge, [LATE], LATE)));
    }
    expect(waits).toEqual([20, 40, 80, 160, 160, 160]);
  });

  it('keeps the base wait when the step up held', () => {
    const gauge = createPressureGauge(2);
    draw(gauge, PRESSURE_POLICY.warmupSeconds, [ON_TIME]);
    secondsUntilChange(gauge, [LATE], ON_TIME);
    secondsUntilChange(gauge, [LATE], LATE);
    expect(gauge.level).toBe(0);
    draw(gauge, 30, [ON_TIME]);
    secondsUntilChange(gauge, [LATE], ON_TIME);
    expect(Math.round(secondsUntilChange(gauge, [LATE], LATE))).toBe(PRESSURE_POLICY.recoverSeconds);
  });
});

describe('the shared world quality', () => {
  it('announces a change after the frame that decided it', () => {
    vi.useFakeTimers();
    setWorldQualityLevels(3);
    const listener = vi.fn();
    subscribeWorldQuality(listener);
    vi.runAllTimers();
    listener.mockClear();
    for (let elapsed = 0; elapsed < 6; elapsed += LATE) observeWorldFrame(LATE, ON_TIME);
    expect(getWorldQualityLevel()).toBe(1);
    expect(listener).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(listener).toHaveBeenCalledOnce();
    pauseWorldQuality();
    expect(getWorldQualityLevel()).toBe(1);
  });

  it('gives a component the step for its tier, and follows it down', () => {
    vi.useFakeTimers();
    const tier = { maxFps: 60, dpr: [1, 2] as [number, number] };
    function Probe() {
      const quality = useWorldQuality(tier);
      return <output>{`${quality.level} ${quality.maxFps} ${quality.dpr.join('-')}`}</output>;
    }
    render(<Probe />);
    expect(screen.getByRole('status')).toHaveTextContent('0 60 1-2');
    act(() => {
      for (let elapsed = 0; elapsed < 6; elapsed += LATE) observeWorldFrame(LATE, ON_TIME);
      vi.runAllTimers();
    });
    expect(screen.getByRole('status')).toHaveTextContent('1 30 1-2');
  });
});
