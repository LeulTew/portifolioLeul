import { reshapeTerrainPoint, type TerrainPoint } from './terrainOutline';

type Triangle = readonly [TerrainPoint, TerrainPoint, TerrainPoint];
const subtract = (a: TerrainPoint, b: TerrainPoint): TerrainPoint =>
  [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: TerrainPoint, b: TerrainPoint): TerrainPoint =>
  [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: TerrainPoint, b: TerrainPoint) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Compare real 3D winding with the local deformation, not its XZ projection. */
export function terrainFaceOrientation(original: Triangle, result: Triangle) {
  const ab = subtract(original[1], original[0]);
  const ac = subtract(original[2], original[0]);
  const sourceNormal = cross(ab, ac);
  const resultNormal = cross(subtract(result[1], result[0]), subtract(result[2], result[0]));
  const sourceArea = Math.hypot(...sourceNormal) / 2;
  const resultArea = Math.hypot(...resultNormal) / 2;
  if (sourceArea <= 1e-10) return { sourceArea, resultArea, cosine: 1, jacobianDeterminant: 1 };

  const center: [number, number, number] = [
    (original[0][0] + original[1][0] + original[2][0]) / 3,
    (original[0][1] + original[1][1] + original[2][1]) / 3,
    (original[0][2] + original[1][2] + original[2][2]) / 3,
  ];
  const epsilon = 0.001;
  const columns: TerrainPoint[] = [];
  for (let axis = 0; axis < 3; axis += 1) {
    const lower: [number, number, number] = [...center];
    const upper: [number, number, number] = [...center];
    lower[axis] -= epsilon;
    upper[axis] += epsilon;
    const difference = subtract(reshapeTerrainPoint(upper), reshapeTerrainPoint(lower));
    columns.push([difference[0] / (2 * epsilon), difference[1] / (2 * epsilon), difference[2] / (2 * epsilon)]);
  }
  const transform = (edge: TerrainPoint): TerrainPoint => [
    columns[0][0] * edge[0] + columns[1][0] * edge[1] + columns[2][0] * edge[2],
    columns[0][1] * edge[0] + columns[1][1] * edge[1] + columns[2][1] * edge[2],
    columns[0][2] * edge[0] + columns[1][2] * edge[1] + columns[2][2] * edge[2],
  ];
  const expectedNormal = cross(transform(ab), transform(ac));
  const denominator = Math.hypot(...expectedNormal) * Math.hypot(...resultNormal);
  return {
    sourceArea, resultArea,
    cosine: denominator > 0 ? Math.max(-1, Math.min(1, dot(expectedNormal, resultNormal) / denominator)) : 0,
    jacobianDeterminant: dot(columns[0], cross(columns[1], columns[2])),
  };
}
