import { describe, expect, it } from 'vitest';
import { repairTerrainDiagonals } from './terrainDiagonals';

const source = new Float64Array([0, 0, 0, 1, 0, 0.01, 2, 0, 0, 1, 0, -1]);
const shaped = new Float64Array([0, 0, 0, 1, 0, -0.01, 2, 0, 0, 1, 0, -1]);
const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);

describe('bounded 3D fringe diagonal repair', () => {
  it('repairs a real reversal with one diagonal, no new faces or moved vertices', () => {
    const positions = shaped.slice();
    const result = repairTerrainDiagonals(source, shaped, indices, new Uint8Array([1, 1, 1, 1]));
    expect(result.flips).toBe(1);
    expect(result.changedFaces.size).toBe(2);
    expect(result.triangles).toHaveLength(indices.length);
    expect(new Set(result.triangles)).toEqual(new Set(indices));
    expect(shaped).toEqual(positions);
    expect(indices).toEqual(new Uint16Array([0, 1, 2, 0, 2, 3]));
  });

  it('does not retessellate valid geometry', () => {
    const result = repairTerrainDiagonals(source, source, indices, new Uint8Array([1, 1, 1, 1]));
    expect(Array.from(result.triangles)).toEqual(Array.from(indices));
    expect(result.flips).toBe(0);
  });

  it('fails rather than involving even one immutable vertex', () => {
    expect(() => repairTerrainDiagonals(source, shaped, indices, new Uint8Array([0, 1, 1, 1])))
      .toThrow('No safe local diagonal');
  });
});
