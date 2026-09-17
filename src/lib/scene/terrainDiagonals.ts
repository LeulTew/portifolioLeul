import { terrainFaceOrientation } from './terrainOrientation';
import type { TerrainPoint } from './terrainOutline';

/** Repair only genuine 3D reversals by changing the diagonal of an outer pair. */
export function repairTerrainDiagonals(
  original: Float64Array, shaped: Float64Array, input: ArrayLike<number>, movable: Uint8Array,
) {
  const triangles = Uint32Array.from(input);
  const changedFaces = new Set<number>();
  const point = (positions: Float64Array, vertex: number): TerrainPoint =>
    [positions[vertex * 3], positions[vertex * 3 + 1], positions[vertex * 3 + 2]];
  const face = (index: number) => Array.from(triangles.subarray(index * 3, index * 3 + 3));
  const canonical = new Uint32Array(original.length / 3);
  const vertices = new Map<string, number>();
  for (let vertex = 0; vertex < canonical.length; vertex += 1) {
    const key = point(original, vertex).join(',');
    if (!vertices.has(key)) vertices.set(key, vertex);
    canonical[vertex] = vertices.get(key)!;
  }
  const edgeKey = (a: number, b: number) =>
    canonical[a] < canonical[b] ? `${canonical[a]}:${canonical[b]}` : `${canonical[b]}:${canonical[a]}`;
  const edges = new Map<string, Set<number>>();
  const connect = (index: number, add: boolean) => {
    const points = face(index);
    for (let edge = 0; edge < 3; edge += 1) {
      const key = edgeKey(points[edge], points[(edge + 1) % 3]);
      if (!edges.has(key)) edges.set(key, new Set());
      if (add) edges.get(key)!.add(index);
      else edges.get(key)!.delete(index);
    }
  };
  const orientation = (points: number[]) => terrainFaceOrientation(
    [point(original, points[0]), point(original, points[1]), point(original, points[2])],
    [point(shaped, points[0]), point(shaped, points[1]), point(shaped, points[2])],
  );
  for (let index = 0; index < triangles.length / 3; index += 1) connect(index, true);
  let flips = 0;
  for (let round = 0; round < 16; round += 1) {
    let unresolved = 0;
    let progress = false;
    let firstFailure = -1;
    for (let index = 0; index < triangles.length / 3; index += 1) {
      const points = face(index);
      if (!points.some(vertex => movable[vertex])) continue;
      if (orientation(points).cosine > 0) continue;
      unresolved += 1;
      firstFailure = index;
      let best: { neighbor: number; first: number[]; second: number[]; score: number } | undefined;
      for (let edge = 0; edge < 3; edge += 1) {
        const [a, b, c] = [points[edge], points[(edge + 1) % 3], points[(edge + 2) % 3]];
        const adjacent = edges.get(edgeKey(a, b));
        if (adjacent?.size !== 2) continue;
        const neighbor = [...adjacent].find(value => value !== index)!;
        const other = face(neighbor);
        if ([...points, ...other].some(vertex => !movable[vertex])) continue;
        const reversed = other.some((vertex, slot) =>
          canonical[vertex] === canonical[b] && canonical[other[(slot + 1) % 3]] === canonical[a]
        );
        if (!reversed) continue;
        const d = other.find(vertex => canonical[vertex] !== canonical[a] && canonical[vertex] !== canonical[b]);
        if (d === undefined || canonical[d] === canonical[c]) continue;
        const first = [c, a, d];
        const second = [c, d, b];
        const one = orientation(first);
        const two = orientation(second);
        const score = Math.min(one.cosine, two.cosine);
        if (one.sourceArea <= 1e-8 || two.sourceArea <= 1e-8 ||
            one.resultArea <= 1e-8 || two.resultArea <= 1e-8) continue;
        if (score > 0 && (!best || score > best.score)) best = { neighbor, first, second, score };
      }
      if (!best) continue;
      connect(index, false);
      connect(best.neighbor, false);
      triangles.set(best.first, index * 3);
      triangles.set(best.second, best.neighbor * 3);
      connect(index, true);
      connect(best.neighbor, true);
      changedFaces.add(index);
      changedFaces.add(best.neighbor);
      flips += 1;
      progress = true;
    }
    if (!unresolved) return { triangles, changedFaces, flips };
    if (!progress) {
      throw new Error(`No safe local diagonal for ${unresolved} true 3D reversals: ${JSON.stringify({
        face: firstFailure, points: face(firstFailure).map(vertex => point(original, vertex)), flips,
      })}`);
    }
  }
  throw new Error('Local terrain diagonal repair exceeded its bounded pass limit.');
}
