import { beforeEach, describe, expect, it, vi } from 'vitest';
import { claimIslandSecret, getIslandSecret, releaseIslandSecret, setIslandLayoutReady } from '@/lib/scene/islandSecret';
import {
  advancePrismExperiment, closePrismExperiment, getPrismExperiment, requestPrismExperiment,
  resetPrismExperiment, setPrismAvailable, setPrismEnabled, subscribePrismExperiment, subscribePrismReset,
  PRISM_OPEN_MS, PRISM_HOLD_MS, PRISM_CLOSE_MS,
} from './prismExperiment';

const advance = (milliseconds: number) => {
  for (let elapsed = 0; elapsed < milliseconds; elapsed += 10) advancePrismExperiment(10, false);
};
beforeEach(() => {
  resetPrismExperiment(); releaseIslandSecret('avatar');
  setIslandLayoutReady(true); setPrismEnabled(true); setPrismAvailable(true);
});

describe('one finite prism secret', () => {
  it('finishes one reveal/hold/return and releases ownership without replay', () => {
    expect(requestPrismExperiment()).toBe(true);
    expect(getIslandSecret()).toBe('prism');
    advance(PRISM_OPEN_MS + 10); expect(getPrismExperiment().phase).toBe('holding');
    advance(PRISM_HOLD_MS + 10); expect(getPrismExperiment().phase).toBe('closing');
    advance(PRISM_CLOSE_MS + 20); expect(getPrismExperiment().phase).toBe('rest');
    expect(getPrismExperiment().progress).toBe(0);
    expect(getIslandSecret()).toBeNull();
    advance(20000); expect(getPrismExperiment().phase).toBe('rest');
  });

  it('cannot overlap with the avatar or extend a score with rapid clicks', () => {
    claimIslandSecret('avatar');
    expect(requestPrismExperiment()).toBe(false);
    releaseIslandSecret('avatar');
    requestPrismExperiment(); advance(400);
    const progress = getPrismExperiment().progress;
    for (let i = 0; i < 20; i++) expect(requestPrismExperiment()).toBe(false);
    expect(getPrismExperiment().progress).toBe(progress);
  });

  it('reverses from the current deformation, not a reset endpoint', () => {
    requestPrismExperiment(); advance(600);
    const progress = getPrismExperiment().progress;
    closePrismExperiment();
    expect(getPrismExperiment().progress).toBe(progress);
    advance(520);
    expect(getPrismExperiment().phase).toBe('rest');
  });

  it('caps suspended time and settles live reduced motion safely', () => {
    requestPrismExperiment();
    advancePrismExperiment(30000, false);
    expect(getPrismExperiment().progress).toBeCloseTo(50 / PRISM_OPEN_MS);
    advancePrismExperiment(16, true);
    expect(getPrismExperiment().phase).toBe('rest');
    expect(getIslandSecret()).toBeNull();
  });

  it('reduced motion never deforms the geometry and finishes its brief feedback', () => {
    requestPrismExperiment(true);
    for (let i = 0; i < 12; i++) {
      advancePrismExperiment(50, true);
      expect(getPrismExperiment().progress).toBe(0);
    }
    expect(getPrismExperiment().phase).toBe('rest');
    expect(getIslandSecret()).toBeNull();
  });

  it('publishes phases only, restores on teardown, and cleans up subscribers', () => {
    const listener = vi.fn(), restore = vi.fn();
    const off = subscribePrismExperiment(listener), resetOff = subscribePrismReset(restore);
    requestPrismExperiment(); advance(500);
    expect(listener).toHaveBeenCalledOnce();
    setPrismEnabled(false);
    expect(restore).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledTimes(3);
    expect(getIslandSecret()).toBeNull();
    expect(requestPrismExperiment()).toBe(false);
    off(); resetOff(); resetPrismExperiment();
    expect(listener).toHaveBeenCalledTimes(3);
    expect(restore).toHaveBeenCalledOnce();
  });
});
