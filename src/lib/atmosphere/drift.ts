/**
 * Motion model for the drifting atmospheric motes.
 *
 * Kept as plain math, separate from the R3F component, so the trajectories can
 * be asserted directly and so the render loop can stay allocation-free.
 */

/** Per-instance values packed into one flat array. */
export const SEED_STRIDE = 7;

export const enum SeedOffset {
  OriginX = 0,
  OriginY = 1,
  OriginZ = 2,
  /** Phase offset, so instances do not sway in lockstep. */
  Phase = 3,
  /** Horizontal sway amplitude in world units. */
  Amplitude = 4,
  /** Fall speed in world units per second. */
  FallSpeed = 5,
  /** Tumble rate in radians per second. */
  SpinSpeed = 6,
}

export interface DriftBounds {
  /** Half-width of the field on x and z. */
  readonly radius: number;
  /** Lowest point of the field; instances wrap back to the top from here. */
  readonly floor: number;
  /** Highest point of the field. */
  readonly ceiling: number;
}

/**
 * Sized to the island volume, in the field's own local space. The caller
 * positions that space away from the camera path: a mote that drifts across
 * the lens renders as a large bright shape rather than as distant dust.
 */
export const DEFAULT_DRIFT_BOUNDS: DriftBounds = {
  radius: 18,
  floor: -4,
  ceiling: 20,
};

/**
 * Where the field's local space sits in the scene: over the island, and behind
 * the camera's closest approach, so no mote can drift across the lens.
 */
export const DRIFT_FIELD_ORIGIN: readonly [number, number, number] = [0, 0, -18];

/** Widest sway a seeded instance can reach, from createDriftSeeds. */
export const MAX_SWAY_AMPLITUDE = 2;

/**
 * Deterministic PRNG (mulberry32). The field must look identical on every load
 * so the composition is art-directed rather than random per visit.
 */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createDriftSeeds(
  count: number,
  bounds: DriftBounds = DEFAULT_DRIFT_BOUNDS,
  seed = 0x5eed
): Float32Array {
  const safeCount = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  const seeds = new Float32Array(safeCount * SEED_STRIDE);
  const random = createRandom(seed);
  const span = bounds.ceiling - bounds.floor;

  for (let i = 0; i < safeCount; i++) {
    const base = i * SEED_STRIDE;
    seeds[base + SeedOffset.OriginX] = (random() - 0.5) * 2 * bounds.radius;
    seeds[base + SeedOffset.OriginY] = bounds.floor + random() * span;
    seeds[base + SeedOffset.OriginZ] = (random() - 0.5) * 2 * bounds.radius;
    seeds[base + SeedOffset.Phase] = random() * Math.PI * 2;
    seeds[base + SeedOffset.Amplitude] = 0.4 + random() * 1.6;
    seeds[base + SeedOffset.FallSpeed] = 0.25 + random() * 0.55;
    seeds[base + SeedOffset.SpinSpeed] = (random() - 0.5) * 1.2;
  }

  return seeds;
}

/**
 * Height of instance `index` at `time`, wrapped into the field.
 *
 * Uses a positive modulo so the field is continuous rather than snapping when
 * the elapsed clock is large.
 */
export function driftHeight(
  seeds: Float32Array,
  index: number,
  time: number,
  bounds: DriftBounds = DEFAULT_DRIFT_BOUNDS
): number {
  const base = index * SEED_STRIDE;
  const span = bounds.ceiling - bounds.floor;
  if (span <= 0) return bounds.floor;

  const fallen =
    seeds[base + SeedOffset.OriginY] - seeds[base + SeedOffset.FallSpeed] * time;

  const wrapped = (((fallen - bounds.floor) % span) + span) % span;
  return bounds.floor + wrapped;
}

/** Horizontal sway of instance `index` at `time`, on the x axis. */
export function driftSwayX(seeds: Float32Array, index: number, time: number): number {
  const base = index * SEED_STRIDE;
  return (
    seeds[base + SeedOffset.OriginX] +
    Math.sin(time * 0.6 + seeds[base + SeedOffset.Phase]) *
      seeds[base + SeedOffset.Amplitude]
  );
}

/** Horizontal sway of instance `index` at `time`, on the z axis. */
export function driftSwayZ(seeds: Float32Array, index: number, time: number): number {
  const base = index * SEED_STRIDE;
  return (
    seeds[base + SeedOffset.OriginZ] +
    Math.cos(time * 0.43 + seeds[base + SeedOffset.Phase]) *
      seeds[base + SeedOffset.Amplitude] *
      0.6
  );
}

/** Tumble angle of instance `index` at `time`. */
export function driftSpin(seeds: Float32Array, index: number, time: number): number {
  const base = index * SEED_STRIDE;
  return (
    seeds[base + SeedOffset.Phase] + seeds[base + SeedOffset.SpinSpeed] * time
  );
}
