import { describe, expect, it } from 'vitest';
import {
  isProtectedTerrainTriangle,
  reshapeTerrainPoint,
  terrainInnerRadius,
  terrainOutlineRadius,
  terrainPlanarPoint,
  terrainSourceRadius,
  TERRAIN_CORE_RADIUS,
  TERRAIN_PROTECTED_REGIONS,
  type TerrainPoint,
} from './terrainOutline';

function worldPoint(radius: number, angle: number, height = 1): TerrainPoint {
  return [
    radius * Math.cos(angle),
    height,
    (radius * Math.sin(angle) + Math.sin(0.15) * (height + 4)) / Math.cos(0.15) - 20,
  ];
}

describe('offline organic terrain outline', () => {
  it('keeps the full interior, avatar foot-contact disc, TV envelope and prism unchanged', () => {
    for (let angle = -Math.PI; angle < Math.PI; angle += 0.035) {
      const point = worldPoint(TERRAIN_CORE_RADIUS, angle);
      expect(reshapeTerrainPoint(point)).toEqual(point);
    }
    for (const height of [-4, -2, 0, 2, 4]) {
      for (const region of TERRAIN_PROTECTED_REGIONS) {
        for (let x = region.minX; x <= region.maxX; x += 0.25) {
          for (let z = region.minZ; z <= region.maxZ; z += 0.25) {
            // The baker pins entire touching triangles, including the box corners.
            expect(isProtectedTerrainTriangle([x, height, z], [x, height, z], [x, height, z])).toBe(true);
            if (region.name === 'avatar-feet' && Math.hypot(x - 22, z + 15) > 5) continue;
            const point: TerrainPoint = [x, height, z];
            expect(reshapeTerrainPoint(point)).toEqual(point);
          }
        }
      }
    }
  });

  it('pins crossing faces even when all their vertices miss a contact zone', () => {
    expect(isProtectedTerrainTriangle([16, -3, -21], [28, -3, -21], [22, -3, -9])).toBe(true);
    expect(isProtectedTerrainTriangle([-31, 1, -45], [-29, 1, -45], [-30, 1, -47])).toBe(false);
  });

  it('is continuous, asymmetric, and strictly monotone through every fringe ray', () => {
    const radii: number[] = [];
    for (let angle = -Math.PI; angle < Math.PI; angle += 0.01) {
      const inner = terrainInnerRadius(angle);
      const outer = terrainSourceRadius(angle);
      expect(terrainOutlineRadius(angle)).toBeGreaterThan(inner + 0.5);
      expect(terrainOutlineRadius(angle)).toBeLessThan(outer);
      let previous = inner;
      for (let step = 1; step <= 40; step += 1) {
        const source = worldPoint(inner + (outer - inner) * step / 40, angle);
        const result = reshapeTerrainPoint(source);
        const radius = Math.hypot(...terrainPlanarPoint(result));
        expect(radius).toBeGreaterThan(previous);
        previous = radius;
      }
      radii.push(previous);
      expect(Math.abs(terrainOutlineRadius(angle + 0.00001) - terrainOutlineRadius(angle))).toBeLessThan(0.001);
    }
    expect(Math.max(...radii) - Math.min(...radii)).toBeGreaterThan(6);
    expect(terrainOutlineRadius(-Math.PI)).toBeCloseTo(terrainOutlineRadius(Math.PI), 9);
    expect(Math.abs(terrainOutlineRadius(-Math.PI / 4) - terrainOutlineRadius(-3 * Math.PI / 4))).toBeGreaterThan(3);
  });

  it('moves the actual rear, left and rear-right top edge inward, not just a skirt', () => {
    for (const angle of [-Math.PI, -3 * Math.PI / 4, -Math.PI / 2, -Math.PI / 4]) {
      const source = worldPoint(terrainSourceRadius(angle), angle, 2);
      const result = reshapeTerrainPoint(source);
      expect(Math.hypot(result[0] - source[0], result[2] - source[2])).toBeGreaterThan(2.5);
      expect(result[1]).toBe(source[1]);
    }
  });

  it('rejects nonfinite or unrelated source assets instead of reshaping them silently', () => {
    expect(() => reshapeTerrainPoint([NaN, 0, 0])).toThrow('finite');
    expect(() => reshapeTerrainPoint([31, 0, -20])).toThrow('60-unit');
  });

  it('accepts the measured legacy quantization drift at both source borders', () => {
    const optimized: TerrainPoint = [4.3104306057655215, -6.9131759324306845, 9.922024273111711];
    const software: TerrainPoint = [2.2354087230398956, 1.5127539754446362, -49.53803581583899];
    for (const source of [optimized, software]) {
      expect(reshapeTerrainPoint(source).every(Number.isFinite)).toBe(true);
    }
    expect(() => reshapeTerrainPoint(worldPoint(30.051, Math.PI / 2))).toThrow('60-unit');
  });

  it('does not fold a real source face across the square-to-fringe diagonal', () => {
    const source: TerrainPoint[] = [
      [27.18374776167218, -7.08226351966667, 7.107499413416232],
      [27.24234329855638, -7.08226351966667, 7.107499413416232],
      [27.300938835440583, -7.073507107343792, 7.0495618419623],
    ];
    const area = (points: TerrainPoint[]) => {
      const [a, b, c] = points.map(terrainPlanarPoint);
      return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    };
    expect(area(source) * area(source.map(reshapeTerrainPoint))).toBeGreaterThan(0);
  });

  it('preserves the already submerged forward fringe instead of reshaping invisible slivers', () => {
    const points: TerrainPoint[] = [
      [-9.41282724356742, -6.013938685407707, 4.364247467246011],
      [-6.716516991630297, -5.123526198992659, 1.4135458520385198],
      [-8.065129895230767, -5.525005627329568, 2.89365343039562],
    ];
    for (const point of points) expect(reshapeTerrainPoint(point)).toEqual(point);
  });
});
