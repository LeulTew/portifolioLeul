import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  SHORE_FIELD_LAYOUT, DEFAULT_WAVE_SETTINGS, SHOALING_GAIN, SWELL_HEIGHTS, applyWaveShader, maxWaveHeight,
} from './waveShader';
import { DEFAULT_OCEAN_GEOMETRY } from '@/lib/ocean/oceanGeometry';
import { OwnedWater } from '@/lib/ocean/OwnedWater';
import { SHORE_BAKE_LAYOUT } from '@/lib/ocean/shoreFieldBake';

/**
 * The shader and the bake script have to agree about the shore field.
 *
 * One runs in the browser and the other is an offline step, months apart.
 * A disagreement is silent -- no
 * error, no warning, just surf breaking somewhere the coast is not, which is
 * exactly the kind of thing that gets shipped because the sea still looks
 * broadly like a sea.
 *
 * The committed baker's layout is checked against the existing shader layout.
 */
describe('shore field layout', () => {
  it('spans the same world area the field was baked over', () => {
    expect(SHORE_FIELD_LAYOUT.extent).toBe(SHORE_BAKE_LAYOUT.extent);
  });

  it('decodes distance on the same scale it was encoded', () => {
    // Halve this on one side only and the whole surf zone moves.
    expect(SHORE_FIELD_LAYOUT.range).toBe(SHORE_BAKE_LAYOUT.range);
  });

  it('steps the gradient against the resolution actually baked', () => {
    expect(SHORE_FIELD_LAYOUT.resolution).toBe(SHORE_BAKE_LAYOUT.resolution);
  });

  it('places its origin at the corner of the baked area', () => {
    expect(SHORE_FIELD_LAYOUT.origin).toEqual(SHORE_BAKE_LAYOUT.origin);
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
    const shoalingPeak = 1 + SHOALING_GAIN;
    expect(DEFAULT_WAVE_SETTINGS.amplitude * shoalingPeak).toBeLessThan(2.5);
  });

  it('bounds the crest by the swell the shader actually sums', () => {
    const water = new OwnedWater(new THREE.PlaneGeometry());
    applyWaveShader(water.material, { shoreField: new THREE.Texture() });
    const shader = {
      uniforms: {}, vertexShader: water.material.vertexShader, fragmentShader: water.material.fragmentShader,
    } as unknown as THREE.WebGLProgramParametersWithUniforms;
    water.material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
    const gain = Number(/shoaling = 1\.0 \+ ([\d.]+) \* exp/.exec(shader.vertexShader)?.[1]);
    const heights = [...shader.vertexShader.matchAll(/amp \* ([\d.]+), [\d.]+, q\b/g)].map(match => Number(match[1]));
    expect(gain).toBe(SHOALING_GAIN);
    expect(heights).toEqual([...SWELL_HEIGHTS]);
    const summed = heights.reduce((sum, height) => sum + height, 0);
    expect(maxWaveHeight(DEFAULT_WAVE_SETTINGS)).toBeCloseTo(DEFAULT_WAVE_SETTINGS.amplitude * (1 + gain) * summed, 12);
    water.geometry.dispose();
    water.dispose();
  });

  it('keeps the surf zone inside the field that describes it', () => {
    // Beyond the field everything reads as deep water, so a surf zone wider
    // than the field would be cut off at its edge.
    expect(DEFAULT_WAVE_SETTINGS.surfWidth).toBeLessThan(SHORE_FIELD_LAYOUT.range);
  });

  it('stops the swell where the surface stops resolving it', () => {
    /*
     * Seen on the deployed site as dark shards lying flat on the water near
     * the edges of frame.
     *
     * The reach was written as a share of the shore field, which put it at 86
     * world units while the grid only packs its rings to 70. In the sixteen
     * units between, a ring can be wider than a wavelength, and neighbouring
     * vertices land on unrelated phases -- the surface tears rather than
     * waving. Reach belongs to the geometry, not to the field.
     */
    expect(DEFAULT_WAVE_SETTINGS.waveReach).toBeLessThanOrEqual(
      DEFAULT_OCEAN_GEOMETRY.detailRadius
    );
  });

  it('leans the crests without inverting them', () => {
    // Above 1 a Gerstner wave folds through itself and the surface self
    // intersects.
    expect(DEFAULT_WAVE_SETTINGS.choppiness).toBeGreaterThan(0);
    expect(DEFAULT_WAVE_SETTINGS.choppiness).toBeLessThanOrEqual(1);
  });
});
