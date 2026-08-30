import { describe, it, expect } from 'vitest';
import { focusStrength, FULL_FOCUS_COVERAGE } from './focusStrength';

describe('focusStrength', () => {
  it('is zero when the section is off screen', () => {
    expect(focusStrength(0, 1000)).toBe(0);
  });

  it('scales with how much of the viewport the section covers', () => {
    // Half of full coverage should read as half strength.
    expect(focusStrength(1000 * FULL_FOCUS_COVERAGE * 0.5, 1000)).toBeCloseTo(0.5, 5);
  });

  it('reaches full strength at the coverage threshold', () => {
    expect(focusStrength(1000 * FULL_FOCUS_COVERAGE, 1000)).toBe(1);
  });

  it('clamps rather than exceeding full strength', () => {
    expect(focusStrength(1000, 1000)).toBe(1);
  });

  it('reaches full strength for a section far taller than the viewport', () => {
    // The whole point of measuring viewport coverage instead of
    // intersectionRatio: a six-screen section fills the viewport completely
    // while its own intersection ratio never exceeds ~0.17.
    const viewport = 800;
    expect(focusStrength(viewport, viewport)).toBe(1);
  });

  it('is zero for a degenerate viewport', () => {
    expect(focusStrength(500, 0)).toBe(0);
    expect(focusStrength(500, -10)).toBe(0);
  });

  it('is zero for negative or non-finite coverage', () => {
    expect(focusStrength(-100, 1000)).toBe(0);
    expect(focusStrength(Number.NaN, 1000)).toBe(0);
    expect(focusStrength(100, Number.NaN)).toBe(0);
  });

  it('treats a zero threshold as always fully focused', () => {
    expect(focusStrength(1, 1000, 0)).toBe(1);
  });

  it('honours a custom coverage threshold', () => {
    expect(focusStrength(250, 1000, 0.25)).toBe(1);
    expect(focusStrength(125, 1000, 0.25)).toBeCloseTo(0.5, 5);
  });
});
