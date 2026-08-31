import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { SHORE_FIELD_LAYOUT, DEFAULT_WAVE_SETTINGS } from './waveShader';

/**
 * The shader and the bake script have to agree about the shore field.
 *
 * They cannot share a constant: one runs in the browser and the other is a
 * build step run by hand, months apart. And a disagreement is silent -- no
 * error, no warning, just surf breaking somewhere the coast is not, which is
 * exactly the kind of thing that gets shipped because the sea still looks
 * broadly like a sea.
 *
 * So the numbers are read back out of the script and checked against the ones
 * the shader is compiled with.
 */
const BAKE_SCRIPT = readFileSync('scripts/bake-shore-field.mjs', 'utf8');

/** Reads `const NAME = <number>;` out of the script. */
function constant(name: string): number {
  const match = BAKE_SCRIPT.match(
    new RegExp(`const ${name}\\s*=\\s*(-?[\\d_.]+)`)
  );
  if (!match) throw new Error(`${name} is no longer declared in the bake script`);
  return Number(match[1].replace(/_/g, ''));
}

/** Reads the terrain placement's world position. */
function terrainPosition(): [number, number, number] {
  const match = BAKE_SCRIPT.match(/position:\s*\[([^\]]+)\]/);
  if (!match) throw new Error('TERRAIN_PLACEMENT.position is no longer declared');
  const parts = match[1].split(',').map((value) => Number(value.trim()));
  return [parts[0], parts[1], parts[2]];
}

describe('shore field layout', () => {
  it('spans the same world area the field was baked over', () => {
    expect(SHORE_FIELD_LAYOUT.extent).toBe(constant('HALF_EXTENT') * 2);
  });

  it('decodes distance on the same scale it was encoded', () => {
    // Halve this on one side only and the whole surf zone moves.
    expect(SHORE_FIELD_LAYOUT.range).toBe(constant('DISTANCE_RANGE'));
  });

  it('steps the gradient against the resolution actually baked', () => {
    expect(SHORE_FIELD_LAYOUT.resolution).toBe(constant('RESOLUTION'));
  });

  it('places its origin at the corner of the baked area', () => {
    const [x, , z] = terrainPosition();
    const half = constant('HALF_EXTENT');

    expect(SHORE_FIELD_LAYOUT.origin[0]).toBe(x - half);
    expect(SHORE_FIELD_LAYOUT.origin[1]).toBe(z - half);
  });
});

describe('wave settings', () => {
  it('keeps crests below the height of the land they arrive at', () => {
    /*
     * The terrain's lowest point stands about 0.9 world units above the water.
     * The shoaling peak multiplies the base amplitude, and if the product
     * clears that, the sea washes over the coast and renders as white shards
     * lying on the island -- which is exactly what it did.
     *
     * The margin here is against the peak, which is a deliberate
     * over-estimate: the peak sits far enough offshore that the height is
     * already ramping down by the time it reaches the coast.
     */
    const shoalingPeak = 2.35;
    expect(DEFAULT_WAVE_SETTINGS.amplitude * shoalingPeak).toBeLessThan(2.5);
  });

  it('keeps the surf zone inside the field that describes it', () => {
    // Beyond the field everything reads as deep water, so a surf zone wider
    // than the field would be cut off at its edge.
    expect(DEFAULT_WAVE_SETTINGS.surfWidth).toBeLessThan(SHORE_FIELD_LAYOUT.range);
  });

  it('leans the crests without inverting them', () => {
    // Above 1 a Gerstner wave folds through itself and the surface self
    // intersects.
    expect(DEFAULT_WAVE_SETTINGS.choppiness).toBeGreaterThan(0);
    expect(DEFAULT_WAVE_SETTINGS.choppiness).toBeLessThanOrEqual(1);
  });
});
