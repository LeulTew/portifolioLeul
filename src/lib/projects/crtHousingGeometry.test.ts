import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  CrtHousingGeometry,
  CRT_HOUSING_APERTURE,
  CRT_HOUSING_BOUNDS,
  CRT_HOUSING_BUDGET,
  CRT_HOUSING_PARTS,
  CRT_SPEAKER_RIB_POSITIONS,
  type CRTHousingPart,
} from './crtHousingGeometry';

const geometries = new Map<CRTHousingPart, CrtHousingGeometry>();
const geometryFor = (part: CRTHousingPart) => geometries.get(part)!;
const offsetsFor = (part: CRTHousingPart) =>
  part === 'speakerRib' ? CRT_SPEAKER_RIB_POSITIONS : [[0, 0, 0] as const];

beforeAll(() => {
  for (const part of CRT_HOUSING_PARTS) geometries.set(part, new CrtHousingGeometry(part));
});

afterAll(() => {
  for (const geometry of geometries.values()) geometry.dispose();
  geometries.clear();
});

function clip(
  polygon: THREE.Vector3[],
  axis: 'x' | 'y' | 'z',
  boundary: number,
  keepAbove: boolean,
): THREE.Vector3[] {
  const result: THREE.Vector3[] = [];
  for (let index = 0; index < polygon.length; index += 1) {
    const a = polygon[index];
    const b = polygon[(index + 1) % polygon.length];
    const aDistance = (a[axis] - boundary) * (keepAbove ? 1 : -1);
    const bDistance = (b[axis] - boundary) * (keepAbove ? 1 : -1);
    if (aDistance >= 0) result.push(a);
    if ((aDistance >= 0) !== (bDistance >= 0)) {
      result.push(a.clone().lerp(b, aDistance / (aDistance - bDistance)));
    }
  }
  return result;
}

describe('the authored CRT housing geometry', () => {
  it.each(CRT_HOUSING_PARTS)('%s has finite, indexed, non-degenerate surfaces and unit normals', part => {
    const geometry = geometryFor(part);
    const position = geometry.getAttribute('position');
    const normal = geometry.getAttribute('normal');
    const index = geometry.getIndex()!;
    expect(index).not.toBeNull();
    expect(index.count % 3).toBe(0);
    expect(normal.count).toBe(position.count);
    expect(geometry.boundingBox!.isEmpty()).toBe(false);
    expect(Number.isFinite(geometry.boundingSphere!.radius)).toBe(true);

    for (let vertex = 0; vertex < position.count; vertex += 1) {
      const point = new THREE.Vector3().fromBufferAttribute(position, vertex);
      const direction = new THREE.Vector3().fromBufferAttribute(normal, vertex);
      expect(point.toArray().every(Number.isFinite)).toBe(true);
      expect(direction.toArray().every(Number.isFinite)).toBe(true);
      expect(direction.length()).toBeCloseTo(1, 5);
      expect(geometry.boundingBox!.containsPoint(point)).toBe(true);
    }

    for (let triangle = 0; triangle < index.count; triangle += 3) {
      const indices = [index.getX(triangle), index.getX(triangle + 1), index.getX(triangle + 2)];
      expect(indices.every(vertex => Number.isInteger(vertex) && vertex >= 0 && vertex < position.count))
        .toBe(true);
      const [a, b, c] = indices.map(vertex => new THREE.Vector3().fromBufferAttribute(position, vertex));
      expect(b.sub(a).cross(c.sub(a)).lengthSq()).toBeGreaterThan(1e-22);
    }
  });

  it.each(CRT_HOUSING_PARTS)('%s never crosses the display interior at or in front of z = 0', part => {
    const geometry = geometryFor(part);
    const position = geometry.getAttribute('position');
    const index = geometry.getIndex()!;
    const halfWidth = CRT_HOUSING_APERTURE.width / 2;
    const halfHeight = CRT_HOUSING_APERTURE.height / 2;
    const epsilon = 1e-6;

    // Clip every triangle, not only its vertices: a triangle can bridge an
    // aperture even when all three vertices lie outside it.
    for (const offset of offsetsFor(part)) {
      const translation = new THREE.Vector3(...offset);
      for (let triangle = 0; triangle < index.count; triangle += 3) {
        let polygon = [0, 1, 2].map(corner =>
          new THREE.Vector3().fromBufferAttribute(position, index.getX(triangle + corner))
            .add(translation),
        );
        polygon = clip(polygon, 'z', CRT_HOUSING_APERTURE.z, true);
        polygon = clip(polygon, 'x', -halfWidth + epsilon, true);
        polygon = clip(polygon, 'x', halfWidth - epsilon, false);
        polygon = clip(polygon, 'y', -halfHeight + epsilon, true);
        polygon = clip(polygon, 'y', halfHeight - epsilon, false);
        expect(polygon).toHaveLength(0);
      }
    }
  });

  it('seals an exact rectangular display, including all four sharp DOM corners', () => {
    expect(CRT_HOUSING_APERTURE).toEqual({ width: 0.55, height: 0.32, z: 0 });
    const position = geometryFor('glassEdge').getAttribute('position');
    const boundary: THREE.Vector3[] = [];
    for (let index = 0; index < position.count; index += 1) {
      if (Math.abs(position.getZ(index)) < 1e-8) {
        boundary.push(new THREE.Vector3().fromBufferAttribute(position, index));
      }
    }
    expect(boundary).toHaveLength(28);
    const halfWidth = CRT_HOUSING_APERTURE.width / 2;
    const halfHeight = CRT_HOUSING_APERTURE.height / 2;
    for (const point of boundary) {
      const onSide = Math.abs(Math.abs(point.x) - halfWidth) < 1e-7;
      const onTopOrBottom = Math.abs(Math.abs(point.y) - halfHeight) < 1e-7;
      expect(onSide || onTopOrBottom).toBe(true);
    }
    for (const x of [-halfWidth, halfWidth]) {
      for (const y of [-halfHeight, halfHeight]) {
        expect(boundary.some(point => point.distanceTo(new THREE.Vector3(x, y, 0)) < 1e-7)).toBe(true);
      }
    }
  });

  it('exports compact full assembly bounds without reducing the width or CRT depth', () => {
    const bounds = new THREE.Box3();
    for (const part of CRT_HOUSING_PARTS) {
      const position = geometryFor(part).getAttribute('position');
      for (const offset of offsetsFor(part)) {
        const translation = new THREE.Vector3(...offset);
        for (let index = 0; index < position.count; index += 1) {
          bounds.expandByPoint(new THREE.Vector3().fromBufferAttribute(position, index).add(translation));
        }
      }
    }
    const actual = [
      bounds.min, bounds.max, bounds.getCenter(new THREE.Vector3()), bounds.getSize(new THREE.Vector3()),
    ];
    const expected = [
      CRT_HOUSING_BOUNDS.min, CRT_HOUSING_BOUNDS.max, CRT_HOUSING_BOUNDS.center, CRT_HOUSING_BOUNDS.size,
    ];
    actual.forEach((vector, index) => vector.toArray().forEach((value, axis) => {
      expect(value).toBeCloseTo(expected[index][axis], 6);
    }));
    expect(bounds.min.y).toBeCloseTo(-0.274, 6);
    expect(bounds.max.y).toBeCloseTo(0.2, 6);
    actual[3].toArray().forEach((value, axis) => {
      expect(value).toBeCloseTo([0.72, 0.474, 0.426][axis], 6);
    });
  });

  it('raises the feet and complete speaker/control assembly, not the display', () => {
    expect(geometryFor('cabinet').boundingBox!.min.y).toBeCloseTo(-0.26, 6);
    expect(geometryFor('rear').boundingBox!.min.y).toBeCloseTo(-0.274, 6);
    const indicator = geometryFor('indicator').boundingBox!;
    expect(indicator.getCenter(new THREE.Vector3()).y).toBeCloseTo(-0.218, 6);
    CRT_SPEAKER_RIB_POSITIONS.forEach((position, index) => {
      expect(position[1]).toBeCloseTo(-0.218 + (index - 3) * 0.0058, 6);
    });

    const metal = geometryFor('metal').getAttribute('position');
    for (const x of [0.138, 0.183, 0.27]) {
      const face = new THREE.Box3();
      for (let index = 0; index < metal.count; index += 1) {
        const point = new THREE.Vector3().fromBufferAttribute(metal, index);
        if (Math.abs(point.x - x) < 0.018 && point.y < -0.19) face.expandByPoint(point);
      }
      expect(face.isEmpty()).toBe(false);
      expect(face.getCenter(new THREE.Vector3()).y).toBeCloseTo(-0.218, 6);
    }
  });

  it('tapers the deep cabinet and points the closed rear cap away from the screen', () => {
    const geometry = geometryFor('rear');
    const position = geometry.getAttribute('position');
    const normal = geometry.getAttribute('normal');
    const back = new THREE.Box3();
    const front = new THREE.Box3();
    let rearFacingVertices = 0;
    for (let index = 0; index < position.count; index += 1) {
      const point = new THREE.Vector3().fromBufferAttribute(position, index);
      if (Math.abs(point.z + 0.38) < 1e-7) {
        back.expandByPoint(point);
        if (normal.getZ(index) < -0.999) rearFacingVertices += 1;
      }
      if (Math.abs(point.z + 0.083) < 1e-7) front.expandByPoint(point);
    }
    expect(back.getSize(new THREE.Vector3()).x).toBeLessThan(front.getSize(new THREE.Vector3()).x * 0.75);
    expect(rearFacingVertices).toBe(29);
  });

  it('counts actual indexed triangles with instance multiplicity rather than counting buffers alone', () => {
    let vertices = 0;
    let submittedTriangles = 0;
    for (const part of CRT_HOUSING_PARTS) {
      const geometry = geometryFor(part);
      vertices += geometry.getAttribute('position').count;
      submittedTriangles += geometry.getIndex()!.count / 3 * offsetsFor(part).length;
      expect(geometry.groups).toHaveLength(0);
    }
    expect(vertices).toBe(1738);
    expect(submittedTriangles).toBe(2616);
    expect(vertices).toBeLessThanOrEqual(CRT_HOUSING_BUDGET.maxStoredVertices);
    expect(submittedTriangles).toBeLessThanOrEqual(CRT_HOUSING_BUDGET.maxSubmittedTriangles);
    expect(CRT_HOUSING_PARTS).toHaveLength(CRT_HOUSING_BUDGET.drawCalls);
    expect(CRT_SPEAKER_RIB_POSITIONS).toHaveLength(7);
  });

  it('allocates independent owned buffers rather than borrowing a shared asset', () => {
    const first = new CrtHousingGeometry('glassEdge');
    const second = new CrtHousingGeometry('glassEdge');
    try {
      expect(first.getAttribute('position').array).not.toBe(second.getAttribute('position').array);
      expect(first.getIndex()!.array).not.toBe(second.getIndex()!.array);
    } finally {
      first.dispose();
      second.dispose();
    }
  });
});
