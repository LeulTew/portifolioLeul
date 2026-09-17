import { describe, expect, it } from 'vitest';
import {
  bakeShorePixels, rasterizeShore, sampleShorePixels, sliceShore,
  SHORE_BAKE_LAYOUT, type ShoreMesh,
} from './shoreFieldBake';
import { SHORE_FIELD_LAYOUT } from '@/components/ocean/waveShader';

const layout = { resolution: 64, extent: 32, origin: [-16, -16] as const, range: 12, waterline: 0 };

function plane(minX: number, maxX: number, minZ: number, maxZ: number, y = 1): ShoreMesh {
  return {
    positions: new Float64Array([minX, y, minZ, maxX, y, minZ, maxX, y, maxZ, minX, y, maxZ]),
    indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
  };
}

describe('reproducible shore-field bake', () => {
  it('retains the exact existing shader layout and waterline', () => {
    const { waterline, ...field } = SHORE_BAKE_LAYOUT;
    expect(field).toEqual(SHORE_FIELD_LAYOUT);
    expect(waterline).toBe(-4);
  });

  it('encodes signed Euclidean distance with row zero at minimum world Z', () => {
    const mesh = plane(-4, 4, -8, 0);
    const pixels = bakeShorePixels([mesh], layout);
    expect(pixels).toEqual(bakeShorePixels([mesh], layout));
    expect(sampleShorePixels(pixels, 0, -4, layout)).toBeLessThan(-3.5);
    expect(sampleShorePixels(pixels, 0, 4, layout)).toBeCloseTo(4, 0);
    expect(sampleShorePixels(pixels, 8, -4, layout)).toBeCloseTo(4, 0);
    expect(sampleShorePixels(pixels, 8, 4, layout)).toBeCloseTo(Math.sqrt(32), 0);
    expect(Math.abs(sampleShorePixels(pixels, 0, 0, layout))).toBeLessThan(0.06);
    expect(sampleShorePixels(pixels, 1000, 1000, layout)).toBe(12);
  });

  it('takes the waterline intersection, not the bounding rectangle of a slope', () => {
    const slope: ShoreMesh = {
      positions: new Float64Array([-4, -1, -4, 4, 1, -4, 4, 1, 4, -4, -1, 4]),
      indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
    };
    const pixels = bakeShorePixels([slope], layout);
    expect(sampleShorePixels(pixels, -2, 0, layout)).toBeGreaterThan(1.5);
    expect(sampleShorePixels(pixels, 2, 0, layout)).toBeLessThan(-1.5);
    const segments = sliceShore([slope], 0);
    expect(segments).toHaveLength(2);
    for (const segment of segments) {
      for (const [x, z] of segment) {
        expect(x).toBe(0);
        expect(Math.abs(sampleShorePixels(pixels, x, z * 0.9, layout))).toBeLessThan(0.3);
      }
    }
  });

  it('includes the skirt foot instead of leaving foam on the old top edge', () => {
    const skirt: ShoreMesh = {
      positions: new Float64Array([4, 1, -4, 4, 1, 4, 8, -1, 4, 8, -1, -4]),
      indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
    };
    const meshes = [plane(-4, 4, -4, 4), skirt];
    const pixels = bakeShorePixels(meshes, layout);
    expect(sampleShorePixels(pixels, 5, 0, layout)).toBeLessThan(-0.8);
    expect(Math.abs(sampleShorePixels(pixels, 6, 0, layout))).toBeLessThan(0.1);
    expect(rasterizeShore([plane(-4, 4, -4, 4, -1)], layout).includes(1)).toBe(false);
  });

  it('fails explicitly for empty coverage, malformed triangles and invalid layout', () => {
    expect(() => bakeShorePixels([], layout)).toThrow('land and sea');
    expect(() => bakeShorePixels([plane(-4, 4, -4, 4)], { ...layout, resolution: 1 })).toThrow('layout');
    expect(() => rasterizeShore([{ positions: new Float64Array(6), indices: null }], layout)).toThrow('complete triangles');
  });
});
