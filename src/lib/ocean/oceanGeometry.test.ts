import { describe, it, expect } from 'vitest';
import {
  DEFAULT_OCEAN_GEOMETRY,
  createOceanGeometry,
  ringRadius,
  type OceanGeometryOptions,
} from './oceanGeometry';

const options: OceanGeometryOptions = {
  radialSegments: 32,
  rings: 20,
  outerRadius: 700,
  detailRadius: 70,
  detailShare: 0.75,
};

describe('ringRadius', () => {
  it('starts at the centre and reaches the outer edge', () => {
    expect(ringRadius(0, options)).toBe(0);
    expect(ringRadius(options.rings, options)).toBeCloseTo(options.outerRadius, 6);
  });

  it('grows without ever doubling back', () => {
    let previous = -1;
    for (let i = 0; i <= options.rings; i += 1) {
      const radius = ringRadius(i, options);
      expect(radius).toBeGreaterThan(previous);
      previous = radius;
    }
  });

  it('hands the detail band its share of the rings', () => {
    // The whole point of the grading: three quarters of the rings are spent on
    // the tenth of the radius where the surf is.
    const inside = Array.from({ length: options.rings + 1 }, (_, i) =>
      ringRadius(i, options)
    ).filter((radius) => radius <= options.detailRadius);

    expect(inside.length / (options.rings + 1)).toBeGreaterThan(0.7);
  });

  it('samples the surf zone far more finely than the open water', () => {
    const nearShore = ringRadius(5, options) - ringRadius(4, options);
    const offshore = ringRadius(options.rings, options) - ringRadius(options.rings - 1, options);

    expect(nearShore).toBeLessThan(offshore / 10);
  });

  it('leaves no step at the seam of the grid that ships', () => {
    /*
     * A jump here would show as a ring of stretched triangles right where the
     * detail band ends.
     *
     * Asserted against the shipped budget rather than the coarse fixture
     * above, because how smooth the seam is depends on how many rings cover
     * the outer band: the curve leaves the seam with zero gradient, so the
     * step is only small when there are enough rings for the first one to be
     * taken early on that curve. At the twenty rings used above there are five,
     * and it is visibly stepped; at the eighty-eight that ship there are
     * twenty-five, and it is not.
     */
    const shipped = DEFAULT_OCEAN_GEOMETRY;
    const boundary = Math.round(shipped.detailShare * shipped.rings);
    const before = ringRadius(boundary, shipped) - ringRadius(boundary - 1, shipped);
    const after = ringRadius(boundary + 1, shipped) - ringRadius(boundary, shipped);

    expect(after).toBeLessThan(before * 2);
  });

  it('degrades sanely when the whole grid is one band or the other', () => {
    expect(ringRadius(10, { ...options, detailShare: 0 })).toBeCloseTo(350, 6);
    expect(ringRadius(10, { ...options, detailShare: 1 })).toBeCloseTo(35, 6);
    expect(ringRadius(3, { ...options, rings: 0 })).toBe(0);
  });
});

describe('createOceanGeometry', () => {
  it('builds a closed disc with a single vertex at the pole', () => {
    const geometry = createOceanGeometry([0, 0], options);
    const position = geometry.getAttribute('position');

    expect(position.count).toBe(options.radialSegments * (options.rings + 1) + 1);
    expect(geometry.getIndex()).not.toBeNull();

    geometry.dispose();
  });

  it('indexes every ring, including the seam back to the first segment', () => {
    const geometry = createOceanGeometry([0, 0], options);
    const index = geometry.getIndex()!;

    // One fan at the centre plus two triangles per quad in every other ring.
    const expected =
      options.radialSegments * 3 + options.rings * options.radialSegments * 6;
    expect(index.count).toBe(expected);

    // Every vertex is used, which is only true if the seam wraps.
    const used = new Set<number>();
    for (let i = 0; i < index.count; i += 1) used.add(index.getX(i));
    expect(used.size).toBe(geometry.getAttribute('position').count);

    geometry.dispose();
  });

  it('lies flat, so the waves have a single axis to displace along', () => {
    const geometry = createOceanGeometry([0, 0], options);
    const position = geometry.getAttribute('position');

    for (let i = 0; i < position.count; i += 1) {
      expect(position.getZ(i)).toBe(0);
    }

    geometry.dispose();
  });

  it('centres the grading on the island rather than on the origin', () => {
    // The island is off-centre in the water plane's local space. Packing the
    // rings around the origin instead would spend every one of them on open
    // water and draw the coast with the coarsest triangles on the mesh.
    const centre: [number, number] = [0, 20];
    const geometry = createOceanGeometry(centre, options);
    const position = geometry.getAttribute('position');

    let near = 0;
    for (let i = 0; i < position.count; i += 1) {
      const dx = position.getX(i) - centre[0];
      const dy = position.getY(i) - centre[1];
      if (Math.hypot(dx, dy) <= options.detailRadius) near += 1;
    }

    expect(near / position.count).toBeGreaterThan(0.7);

    geometry.dispose();
  });

  it('keeps the bounding sphere wide enough for the displaced surface', () => {
    // Culled on its flat bounds, the sea vanishes as the camera comes down to
    // meet a crest that is standing outside them.
    const geometry = createOceanGeometry([0, 0], options);

    expect(geometry.boundingSphere).not.toBeNull();
    expect(geometry.boundingSphere!.radius).toBeGreaterThan(options.outerRadius);

    geometry.dispose();
  });

  it('refuses a grid too coarse to close', () => {
    expect(() => createOceanGeometry([0, 0], { ...options, radialSegments: 2 })).toThrow();
    expect(() => createOceanGeometry([0, 0], { ...options, rings: 0 })).toThrow();
  });

  it('ships a default budget the surf zone can actually resolve', () => {
    // A wave is noise rather than a wave if the mesh carries under a couple of
    // vertices per crest. The longest swell is ~120 world units; spacing in
    // the detail band has to stay well inside that.
    const { detailRadius, rings, detailShare, radialSegments } = DEFAULT_OCEAN_GEOMETRY;
    const ringSpacing = detailRadius / (rings * detailShare);
    const arcAtCoast = (2 * Math.PI * 30) / radialSegments;

    expect(ringSpacing).toBeLessThan(4);
    expect(arcAtCoast).toBeLessThan(4);
  });
});
