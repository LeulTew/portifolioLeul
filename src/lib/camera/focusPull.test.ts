import { describe, it, expect, beforeEach } from 'vitest';
import {
  setFocusPull,
  getFocusPull,
  subscribeFocusPull,
  resetFocusPull,
  focusCurve,
} from './focusPull';

describe('focusCurve', () => {
  it('is nothing at both ends of the section', () => {
    // A lean that does not come back leaves the camera somewhere the arc never
    // put it, so the hold resumes on a different shot than it paused on.
    expect(focusCurve(0)).toBe(0);
    expect(focusCurve(1)).toBe(0);
  });

  it('peaks in the middle and returns', () => {
    const peak = focusCurve(0.55);
    expect(peak).toBe(1);
    expect(focusCurve(0.3)).toBeLessThan(peak);
    expect(focusCurve(0.8)).toBeLessThan(peak);
  });

  it('rises and falls without a step', () => {
    let previous = 0;
    for (let at = 0.02; at <= 0.55; at += 0.02) {
      const value = focusCurve(at);
      expect(value).toBeGreaterThanOrEqual(previous - 1e-9);
      previous = value;
    }
  });

  it('holds nothing rather than NaN on a bad measurement', () => {
    expect(focusCurve(Number.NaN)).toBe(0);
    expect(focusCurve(0.5, 0)).toBe(0);
    expect(focusCurve(0.5, 1)).toBe(0);
  });
});

describe('focus pull store', () => {
  beforeEach(() => resetFocusPull());

  it('starts let go', () => {
    expect(getFocusPull()).toBe(0);
  });

  it('publishes what it is given, clamped', () => {
    setFocusPull(0.4);
    expect(getFocusPull()).toBe(0.4);
    setFocusPull(4);
    expect(getFocusPull()).toBe(1);
    setFocusPull(-1);
    expect(getFocusPull()).toBe(0);
  });

  it('drops jitter rather than waking every listener for nothing', () => {
    const seen: number[] = [];
    subscribeFocusPull((value) => seen.push(value));
    setFocusPull(0.5);
    setFocusPull(0.50001);
    expect(seen).toEqual([0.5]);
  });

  it('lets a listener go', () => {
    const seen: number[] = [];
    const stop = subscribeFocusPull((value) => seen.push(value));
    setFocusPull(0.3);
    stop();
    setFocusPull(0.9);
    expect(seen).toEqual([0.3]);
  });
});
