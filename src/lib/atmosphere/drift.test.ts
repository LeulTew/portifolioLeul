import { describe, it, expect } from 'vitest';
import {
  SEED_STRIDE,
  SeedOffset,
  DEFAULT_DRIFT_BOUNDS,
  createRandom,
  createDriftSeeds,
  driftHeight,
  driftSwayX,
  driftSwayZ,
  driftSpin,
} from './drift';

describe('createRandom', () => {
  it('is deterministic for a given seed', () => {
    const a = createRandom(42);
    const b = createRandom(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('produces different streams for different seeds', () => {
    expect(createRandom(1)()).not.toBe(createRandom(2)());
  });

  it('stays within the unit interval', () => {
    const random = createRandom(7);
    for (let i = 0; i < 500; i++) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('createDriftSeeds', () => {
  const count = 64;
  const seeds = createDriftSeeds(count);

  it('packs one stride per instance', () => {
    expect(seeds).toHaveLength(count * SEED_STRIDE);
  });

  it('produces the same field on every load', () => {
    // The composition is art-directed, not random per visit.
    expect(Array.from(createDriftSeeds(8))).toEqual(Array.from(createDriftSeeds(8)));
  });

  it('places every instance inside the field bounds', () => {
    const { radius, floor, ceiling } = DEFAULT_DRIFT_BOUNDS;
    for (let i = 0; i < count; i++) {
      const base = i * SEED_STRIDE;
      expect(Math.abs(seeds[base + SeedOffset.OriginX])).toBeLessThanOrEqual(radius);
      expect(Math.abs(seeds[base + SeedOffset.OriginZ])).toBeLessThanOrEqual(radius);
      expect(seeds[base + SeedOffset.OriginY]).toBeGreaterThanOrEqual(floor);
      expect(seeds[base + SeedOffset.OriginY]).toBeLessThanOrEqual(ceiling);
    }
  });

  it('gives every instance a downward fall speed', () => {
    for (let i = 0; i < count; i++) {
      expect(seeds[i * SEED_STRIDE + SeedOffset.FallSpeed]).toBeGreaterThan(0);
    }
  });

  it('spreads sway phases so instances do not move in lockstep', () => {
    const phases = new Set<number>();
    for (let i = 0; i < count; i++) {
      phases.add(seeds[i * SEED_STRIDE + SeedOffset.Phase]);
    }
    expect(phases.size).toBeGreaterThan(count * 0.9);
  });

  it('returns an empty buffer for a non-positive or non-finite count', () => {
    expect(createDriftSeeds(0)).toHaveLength(0);
    expect(createDriftSeeds(-5)).toHaveLength(0);
    expect(createDriftSeeds(Number.NaN)).toHaveLength(0);
  });
});

describe('driftHeight', () => {
  const seeds = createDriftSeeds(32);

  it('starts each instance at its seeded height', () => {
    expect(driftHeight(seeds, 3, 0)).toBeCloseTo(seeds[3 * SEED_STRIDE + SeedOffset.OriginY], 5);
  });

  it('falls over time', () => {
    expect(driftHeight(seeds, 3, 1)).toBeLessThan(driftHeight(seeds, 3, 0));
  });

  it('stays inside the field for very large elapsed times', () => {
    const { floor, ceiling } = DEFAULT_DRIFT_BOUNDS;
    for (const time of [0, 12, 500, 100000]) {
      for (let i = 0; i < 32; i++) {
        const y = driftHeight(seeds, i, time);
        expect(y).toBeGreaterThanOrEqual(floor);
        expect(y).toBeLessThanOrEqual(ceiling);
      }
    }
  });

  it('wraps back to the top rather than sinking below the floor', () => {
    const { floor, ceiling } = DEFAULT_DRIFT_BOUNDS;
    const span = ceiling - floor;
    const fallSpeed = seeds[SeedOffset.FallSpeed];
    // Exactly one full traversal returns to the starting height.
    expect(driftHeight(seeds, 0, span / fallSpeed)).toBeCloseTo(driftHeight(seeds, 0, 0), 3);
  });

  it('collapses to the floor for a degenerate field', () => {
    const flat = { radius: 10, floor: 2, ceiling: 2 };
    expect(driftHeight(seeds, 0, 5, flat)).toBe(2);
  });
});

describe('drift sway and spin', () => {
  const seeds = createDriftSeeds(16);

  it('starts sway from the seeded origin at the phase offset', () => {
    const base = 5 * SEED_STRIDE;
    const expected =
      seeds[base + SeedOffset.OriginX] +
      Math.sin(seeds[base + SeedOffset.Phase]) * seeds[base + SeedOffset.Amplitude];
    expect(driftSwayX(seeds, 5, 0)).toBeCloseTo(expected, 5);
  });

  it('keeps sway bounded by the seeded amplitude', () => {
    for (let i = 0; i < 16; i++) {
      const base = i * SEED_STRIDE;
      const amplitude = seeds[base + SeedOffset.Amplitude];
      for (let t = 0; t < 40; t += 0.37) {
        expect(Math.abs(driftSwayX(seeds, i, t) - seeds[base + SeedOffset.OriginX]))
          .toBeLessThanOrEqual(amplitude + 1e-6);
        expect(Math.abs(driftSwayZ(seeds, i, t) - seeds[base + SeedOffset.OriginZ]))
          .toBeLessThanOrEqual(amplitude + 1e-6);
      }
    }
  });

  it('sways x and z on different periods so motion does not read as a circle', () => {
    const base = 2 * SEED_STRIDE;
    const dx = driftSwayX(seeds, 2, 3) - seeds[base + SeedOffset.OriginX];
    const dz = driftSwayZ(seeds, 2, 3) - seeds[base + SeedOffset.OriginZ];
    expect(Math.abs(Math.abs(dx) - Math.abs(dz))).toBeGreaterThan(1e-4);
  });

  it('tumbles continuously from the phase offset', () => {
    expect(driftSpin(seeds, 4, 0)).toBeCloseTo(seeds[4 * SEED_STRIDE + SeedOffset.Phase], 5);
    expect(driftSpin(seeds, 4, 10)).not.toBeCloseTo(driftSpin(seeds, 4, 0), 3);
  });
});
