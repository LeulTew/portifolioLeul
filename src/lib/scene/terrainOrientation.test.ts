import { describe, expect, it } from 'vitest';
import { terrainFaceOrientation } from './terrainOrientation';
import { reshapeTerrainPoint, type TerrainPoint } from './terrainOutline';

describe('terrain 3D orientation guard', () => {
  it('rejects the reproduced real diagonal-crease reversal', () => {
    const original = [
      [27.18374776167218, -7.08226351966667, 7.107499413416232],
      [27.24234329855638, -7.08226351966667, 7.107499413416232],
      [27.300938835440583, -7.073507107343792, 7.0495618419623],
    ] as const;
    const inverted = [
      [23.34482454049311, -7.8675674706243734, 3.0951807108253817],
      [23.37503786419903, -7.868631189230777, 3.0746489844010956],
      [23.44004228792994, -7.864968980570042, 3.0381643639148344],
    ] as const;
    expect(terrainFaceOrientation(original, inverted).cosine).toBeLessThan(-0.6);
    const corrected = original.map(reshapeTerrainPoint) as [TerrainPoint, TerrainPoint, TerrainPoint];
    expect(terrainFaceOrientation(original, corrected).cosine).toBeGreaterThan(0.99);
  });

  it('does not mistake a steep face changing projected winding for a 3D reversal', () => {
    const original = [
      [-22.609549496078934, -5.330655586550158, -2.366891496502202],
      [-22.4915583463457, -5.339403437250669, -2.3090105737748594],
      [-22.37448185668792, -5.377091748245949, -2.2555035834702712],
    ] as const;
    const result = [
      [-22.604976195701674, -5.331013235265587, -2.370645739560871],
      [-22.488814366119346, -5.339582261608384, -2.310887695304194],
      [-22.372652536537014, -5.377270572603663, -2.2573807049996066],
    ] as const;
    expect(terrainFaceOrientation(original, result).cosine).toBeGreaterThan(0.99);
    expect(terrainFaceOrientation(original, [result[0], result[2], result[1]]).cosine).toBeLessThan(-0.99);
  });
});
