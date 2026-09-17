import { describe, expect, it } from 'vitest';
import {
  CONTACT_CLOUD_LAYER,
  getContactCloudOpacity,
  getContactCloudQuads,
} from './contactClouds';

describe('Contact cloud composition', () => {
  it.each(['medium', 'high'] as const)('keeps %s within two draws and six quads', tier => {
    const quads = getContactCloudQuads({ tier, softwareRenderer: false });
    expect(quads.length).toBeLessThanOrEqual(6);
    expect(new Set(quads.map(quad => quad.texture)).size).toBeLessThanOrEqual(2);
    expect(new Set(quads.map(quad => quad.bank))).toEqual(new Set(['left', 'right', 'crown']));
    expect(quads.filter(quad => quad.texture === 'body')).toHaveLength(2);
  });

  it.each([
    { tier: 'low', softwareRenderer: false },
    { tier: 'low', softwareRenderer: true },
    { tier: 'medium', softwareRenderer: true },
    { tier: 'high', softwareRenderer: true },
  ] as const)('uses two static quads on $tier / software=$softwareRenderer', gpu => {
    const quads = getContactCloudQuads(gpu);
    expect(quads).toHaveLength(2);
    expect(quads.map(quad => quad.bank)).toEqual(['right', 'left']);
    expect(new Set(quads.map(quad => quad.texture))).toEqual(new Set(['body']));
    expect(getContactCloudQuads(gpu)).toBe(quads);
  });

  it('authors finite, asymmetric, far-to-near banks with a clear central opening', () => {
    const quads = getContactCloudQuads({ tier: 'high', softwareRenderer: false });
    let previousDepth = Number.POSITIVE_INFINITY;
    for (const quad of quads) {
      for (const value of [quad.x, quad.y, quad.depth, quad.width, quad.height, quad.rotation]) {
        expect(Number.isFinite(value)).toBe(true);
      }
      expect(quad.width).toBeGreaterThan(0);
      expect(quad.height).toBeGreaterThan(0);
      expect(quad.depth).toBeGreaterThanOrEqual(20);
      expect(quad.depth).toBeLessThanOrEqual(45);
      expect(quad.depth).toBeLessThanOrEqual(previousDepth);
      previousDepth = quad.depth;

      const cosine = Math.abs(Math.cos(quad.rotation));
      const sine = Math.abs(Math.sin(quad.rotation));
      const halfWidth = (quad.width * cosine + quad.height * sine) / 2;
      const halfHeight = (quad.width * sine + quad.height * cosine) / 2;
      const left = (quad.x - halfWidth) / quad.depth;
      const right = (quad.x + halfWidth) / quad.depth;
      const bottom = (quad.y - halfHeight) / quad.depth;
      expect(right <= -0.44 || left >= 0.44 || bottom >= 0.38).toBe(true);
    }
    expect(new Set(quads.map(quad => quad.rotation)).size).toBe(quads.length);
    expect(new Set(quads.map(quad => quad.width / quad.height)).size).toBe(quads.length);
    expect(CONTACT_CLOUD_LAYER).toBe(2);
  });
});

describe('Contact cloud progress gate', () => {
  it('hides outside Contact even if an old sky progress remains', () => {
    for (const progress of [0, 0.5, 1, 2]) {
      expect(getContactCloudOpacity('outside', progress)).toBe(0);
    }
  });

  it('uses the same bounded appearance on departure, return and park', () => {
    let previous = 0;
    for (const progress of [0, 0.24, 0.4, 0.57, 0.75, 0.9, 1]) {
      const opacity = getContactCloudOpacity('departing', progress);
      expect(opacity).toBeGreaterThanOrEqual(previous);
      expect(opacity).toBeLessThanOrEqual(1);
      expect(getContactCloudOpacity('returning', progress)).toBe(opacity);
      expect(getContactCloudOpacity('parked', progress)).toBe(opacity);
      previous = opacity;
    }
    expect(getContactCloudOpacity('departing', 0.24)).toBe(0);
    expect(getContactCloudOpacity('parked', 1)).toBe(1);
    expect(getContactCloudOpacity('departing', 0.57)).toBeCloseTo(0.5);
  });

  it.each(['outside', 'departing', 'parked', 'returning'] as const)(
    'rejects non-finite progress while %s', mode => {
      for (const progress of [Number.NaN, Infinity, -Infinity]) {
        expect(() => getContactCloudOpacity(mode, progress)).toThrow(RangeError);
        expect(() => getContactCloudOpacity(mode, progress))
          .toThrow('Contact cloud progress must be finite.');
      }
    },
  );

  it('clamps finite overshoot', () => {
    expect(getContactCloudOpacity('departing', -1)).toBe(0);
    expect(getContactCloudOpacity('returning', 2)).toBe(1);
  });
});
