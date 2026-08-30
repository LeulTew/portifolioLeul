import { describe, it, expect } from 'vitest';
import { preserveScrollOffset, readScrollOffset } from './preserveScrollOffset';

describe('preserveScrollOffset', () => {
  it('keeps the reader on the same content when the track grows', () => {
    // Content translates by offset * (pages - 1) * viewportHeight, so holding
    // position means the product stays constant.
    const offset = 0.5;
    const preserved = preserveScrollOffset(offset, 9, 11);

    expect(offset * (9 - 1)).toBeCloseTo(preserved * (11 - 1), 6);
  });

  it('keeps the reader on the same content when the track shrinks', () => {
    const offset = 0.4;
    const preserved = preserveScrollOffset(offset, 11, 9);

    expect(offset * (11 - 1)).toBeCloseTo(preserved * (9 - 1), 6);
  });

  it('is a no-op when the page count is unchanged', () => {
    expect(preserveScrollOffset(0.63, 9, 9)).toBeCloseTo(0.63, 6);
  });

  it('holds the top of the page at the top', () => {
    expect(preserveScrollOffset(0, 9, 12)).toBe(0);
  });

  it('clamps rather than scrolling past the end when the track shrinks a lot', () => {
    expect(preserveScrollOffset(0.95, 12, 3)).toBe(1);
  });

  it('returns to the top when there is nowhere left to scroll', () => {
    expect(preserveScrollOffset(0.5, 9, 1)).toBe(0);
    expect(preserveScrollOffset(0.5, 1, 9)).toBe(0);
  });

  it('treats non-finite input as the top of the page', () => {
    expect(preserveScrollOffset(Number.NaN, 9, 11)).toBe(0);
    expect(preserveScrollOffset(0.5, Number.NaN, 11)).toBe(0);
    expect(preserveScrollOffset(0.5, 9, Number.NaN)).toBe(0);
  });

  it('never returns an offset outside the normalized range', () => {
    for (const from of [1.5, 4, 9, 20]) {
      for (const to of [1.5, 4, 9, 20]) {
        for (const offset of [0, 0.25, 0.5, 0.99, 1]) {
          const preserved = preserveScrollOffset(offset, from, to);
          expect(preserved).toBeGreaterThanOrEqual(0);
          expect(preserved).toBeLessThanOrEqual(1);
        }
      }
    }
  });
});

describe('readScrollOffset', () => {
  it('reports the normalized position of the track', () => {
    expect(readScrollOffset({ scrollTop: 3000, scrollHeight: 7000, clientHeight: 1000 })).toBe(0.5);
  });

  it('reports zero at the top', () => {
    expect(readScrollOffset({ scrollTop: 0, scrollHeight: 7000, clientHeight: 1000 })).toBe(0);
  });

  it('reports one at the bottom', () => {
    expect(readScrollOffset({ scrollTop: 6000, scrollHeight: 7000, clientHeight: 1000 })).toBe(1);
  });

  it('clamps an over-scrolled position', () => {
    expect(readScrollOffset({ scrollTop: 9999, scrollHeight: 7000, clientHeight: 1000 })).toBe(1);
  });

  it('returns zero for a track with nothing to scroll', () => {
    expect(readScrollOffset({ scrollTop: 0, scrollHeight: 1000, clientHeight: 1000 })).toBe(0);
    expect(readScrollOffset({ scrollTop: 5, scrollHeight: 500, clientHeight: 1000 })).toBe(0);
  });
});
