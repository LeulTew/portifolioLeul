import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { DEFAULT_WAVE_SETTINGS } from '@/components/ocean/waveShader';
import { DEFAULT_OCEAN_GEOMETRY } from '@/lib/ocean/oceanGeometry';
import {
  createHorizonGeometry,
  createTerrainSkirtGeometry,
  EDGE_WATER_LEVEL,
  HORIZON_INNER_RADIUS,
  HORIZON_OUTER_RADIUS,
  HORIZON_WATER_RADIUS,
  horizonFogWeight,
} from './edgeGeometry';
import { TERRAIN_RIM } from './terrainRim';

function expectFiniteGeometry(geometry: THREE.BufferGeometry) {
  const positions = geometry.getAttribute('position');
  const normals = geometry.getAttribute('normal');
  const index = geometry.getIndex();
  expect(index).not.toBeNull();
  expect(index!.count % 3).toBe(0);
  for (const attribute of Object.values(geometry.attributes)) {
    expect(Array.from(attribute.array).every(Number.isFinite)).toBe(true);
  }
  for (const vertex of index!.array) {
    expect(vertex).toBeGreaterThanOrEqual(0);
    expect(vertex).toBeLessThan(positions.count);
  }
  for (const vertex of new Set(index!.array)) {
    const length = Math.hypot(normals.getX(vertex), normals.getY(vertex), normals.getZ(vertex));
    expect(length).toBeCloseTo(1, 5);
  }
  expect(geometry.boundingSphere).not.toBeNull();
  expect(Number.isFinite(geometry.boundingSphere!.radius)).toBe(true);
  expect(geometry.boundingBox!.isEmpty()).toBe(false);
}

describe('static scene edge geometry', () => {
  it('has finite, indexed triangles and outward-facing normals', () => {
    for (const create of [createTerrainSkirtGeometry, createHorizonGeometry]) {
      const geometry = create();
      expectFiniteGeometry(geometry);
      const position = geometry.getAttribute('position');
      const index = geometry.getIndex()!;
      const a = new THREE.Vector3();
      const b = new THREE.Vector3();
      const c = new THREE.Vector3();
      for (let triangle = 0; triangle < index.count; triangle += 3) {
        a.fromBufferAttribute(position, index.getX(triangle));
        b.fromBufferAttribute(position, index.getX(triangle + 1));
        c.fromBufferAttribute(position, index.getX(triangle + 2));
        const normal = b.sub(a).cross(c.sub(a));
        expect(normal.length()).toBeGreaterThan(0.0001);
        if (create === createHorizonGeometry) expect(normal.y).toBeGreaterThan(0);
        else expect(normal.dot(new THREE.Vector3(a.x, 0, a.z + 20))).toBeGreaterThan(0);
      }
      geometry.dispose();
    }
  });

  it('keeps the existing coast at the waterline and only insets the lip and foot', () => {
    const geometry = createTerrainSkirtGeometry();
    const position = geometry.getAttribute('position');
    TERRAIN_RIM.forEach(([x, y, z], index) => {
      const waterline = TERRAIN_RIM.length + index;
      expect(position.getX(waterline)).toBeCloseTo(x, 5);
      expect(position.getZ(waterline)).toBeCloseTo(z, 5);
      expect(position.getY(waterline)).toBeLessThan(EDGE_WATER_LEVEL);
      expect(position.getY(index)).toBeCloseTo(y + 0.08, 5);
      expect(Math.hypot(position.getX(index), position.getZ(index) + 20))
        .toBeLessThan(Math.hypot(x, z + 20));
    });
    expect(geometry.boundingBox!.min.x).toBeGreaterThanOrEqual(-30);
    expect(geometry.boundingBox!.max.x).toBeLessThanOrEqual(30);
    expect(geometry.boundingBox!.max.y).toBeLessThan(2.2);
    geometry.dispose();
  });

  it('does not draw the already submerged front edge', () => {
    const geometry = createTerrainSkirtGeometry();
    const used = new Set(geometry.getIndex()!.array);
    for (let station = 0; station < 16; station += 1) {
      expect(used.has(station)).toBe(false);
      expect(used.has(station + TERRAIN_RIM.length)).toBe(false);
    }
    geometry.dispose();
  });

  it('leaves the visible ocean and its reflections outside the horizon mesh', () => {
    const geometry = createHorizonGeometry();
    const positions = geometry.getAttribute('position');
    for (let vertex = 0; vertex < positions.count; vertex += 1) {
      const radius = Math.hypot(positions.getX(vertex), positions.getZ(vertex) + 20);
      expect(radius).toBeGreaterThan(HORIZON_INNER_RADIUS - 0.001);
      expect(radius).toBeLessThan(HORIZON_OUTER_RADIUS + 0.001);
      expect(positions.getY(vertex)).toBeCloseTo(EDGE_WATER_LEVEL + 0.02, 5);
    }
    // Even the chord between stations stays hundreds of units beyond full fog.
    expect(HORIZON_INNER_RADIUS * Math.cos(Math.PI / 32) - 56).toBeGreaterThan(92);
    // No reliance on increasing the active camera's far=1000.
    expect(HORIZON_OUTER_RADIUS + 56).toBeLessThan(1000);
    // Tiers vary ring/segment counts, not the shared 70-unit swell reach.
    expect(DEFAULT_WAVE_SETTINGS.waveReach).toBe(DEFAULT_OCEAN_GEOMETRY.detailRadius);
    expect(DEFAULT_WAVE_SETTINGS.waveReach).toBe(70);
    expect(HORIZON_INNER_RADIUS - DEFAULT_WAVE_SETTINGS.waveReach).toBe(250);
    geometry.dispose();
  });

  it('feathers distant water continuously through its finite rim into the background', () => {
    expect(horizonFogWeight(HORIZON_INNER_RADIUS)).toBe(1);
    expect(horizonFogWeight(HORIZON_OUTER_RADIUS)).toBe(0);
    for (let radius = HORIZON_WATER_RADIUS - 15; radius <= HORIZON_WATER_RADIUS + 15; radius += 1) {
      expect(Math.abs(horizonFogWeight(radius) - horizonFogWeight(radius + 1))).toBeLessThan(0.003);
    }
    for (let radius = 0; radius < 1200; radius += 1) {
      expect(horizonFogWeight(radius)).toBeGreaterThanOrEqual(0);
      expect(horizonFogWeight(radius)).toBeLessThanOrEqual(1);
    }
  });

  it('accounts for the skirt in both main and existing reflection passes', () => {
    const skirt = createTerrainSkirtGeometry();
    const horizon = createHorizonGeometry();
    const skirtTriangles = skirt.getIndex()!.count / 3;
    const horizonTriangles = horizon.getIndex()!.count / 3;
    expect(skirtTriangles).toBe(152);
    expect(horizonTriangles).toBe(64);
    expect(skirtTriangles + horizonTriangles).toBe(216);
    expect(skirtTriangles * 2 + horizonTriangles).toBe(368);
    expect(TERRAIN_RIM.length).toBe(64);
    skirt.dispose();
    horizon.dispose();
  });
});
