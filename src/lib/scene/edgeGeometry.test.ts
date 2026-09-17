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
import { TERRAIN_RIM, TERRAIN_SOFTWARE_RIM } from './terrainRim';
import bake from './terrain-outline-bake.json';

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
    for (const create of [() => createTerrainSkirtGeometry(), () => createTerrainSkirtGeometry(true), createHorizonGeometry]) {
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
        expect(normal.length()).toBeGreaterThan(0.000001);
        if (create === createHorizonGeometry) expect(normal.y).toBeGreaterThan(0);
        else expect(normal.dot(new THREE.Vector3(a.x, 0, a.z + 20))).toBeGreaterThan(0);
      }
      geometry.dispose();
    }
  });

  it('joins each final variant at its actual decoded top edge and albedo coordinates', () => {
    for (const [software, rim] of [[false, TERRAIN_RIM], [true, TERRAIN_SOFTWARE_RIM]] as const) {
      const geometry = createTerrainSkirtGeometry(software);
      const position = geometry.getAttribute('position');
      const uv = geometry.getAttribute('uv');
      rim.forEach(([x, y, z, u, v], index) => {
        expect(position.getX(index)).toBeCloseTo(x, 5);
        expect(position.getY(index)).toBeCloseTo(y, 5);
        expect(position.getZ(index)).toBeCloseTo(z, 5);
        expect(uv.getX(index)).toBeCloseTo(u, 5);
        expect(uv.getY(index)).toBeCloseTo(v, 5);
        const foot = rim.length * 2 + index;
        expect(position.getY(foot)).toBeLessThan(EDGE_WATER_LEVEL);
        expect(position.getY(foot)).toBeLessThan(y);
        expect(Math.hypot(position.getX(foot), position.getZ(foot) + 20))
          .toBeGreaterThan(Math.hypot(x, z + 20));
      });
      geometry.dispose();
    }
  });

  it('does not draw the already submerged front edge', () => {
    for (const [software, rim] of [[false, TERRAIN_RIM], [true, TERRAIN_SOFTWARE_RIM]] as const) {
      const geometry = createTerrainSkirtGeometry(software);
      const drawnEdges = rim.filter((point, index) =>
        Math.max(point[1], rim[(index + 1) % rim.length][1]) >= -5.1
      ).length;
      expect(drawnEdges).toBeLessThan(rim.length);
      expect(geometry.getIndex()!.count / 3).toBe(drawnEdges * 4);
      geometry.dispose();
    }
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
    const horizon = createHorizonGeometry();
    const horizonTriangles = horizon.getIndex()!.count / 3;
    expect(horizonTriangles).toBe(64);
    for (const [index, software] of [false, true].entries()) {
      const skirt = createTerrainSkirtGeometry(software);
      const skirtTriangles = skirt.getIndex()!.count / 3;
      expect(skirtTriangles).toBe(bake.variants[index].skirtTriangles);
      expect(skirtTriangles).toBeLessThanOrEqual(4096);
      expect(skirt.getAttribute('position').count).toBe(bake.variants[index].rimVertices * 3);
      // Exactly one existing skirt draw per participating pass, still no new pass.
      expect(skirt.groups).toHaveLength(0);
      expect(skirtTriangles * 2 + horizonTriangles).toBeLessThanOrEqual(8256);
      skirt.dispose();
    }
    horizon.dispose();
  });
});
