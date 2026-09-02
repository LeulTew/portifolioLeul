import { describe, it, expect } from 'vitest';
import { SLIT_SHARE, bandScale, seamPresence, seamSpread } from './heroAperture';
import { HERO_SEQUENCE, SNOW_LEAD, cueDuration } from './sectionChoreography';

describe('bandScale', () => {
  it('leaves a live strip of the world showing at rest', () => {
    // The point of the whole thing: closed is a letterbox, not a black screen.
    const atRest = bandScale(0);
    expect(atRest).toBeCloseTo(1 - SLIT_SHARE, 6);
    expect(atRest).toBeLessThan(1);
    expect(atRest).toBeGreaterThan(0.8);
  });

  it('retracts the bands entirely when open', () => {
    expect(bandScale(1)).toBe(0);
  });

  it('moves in step with the aperture, without doubling back', () => {
    let previous = Infinity;
    for (let i = 0; i <= 10; i += 1) {
      const scale = bandScale(i / 10);
      expect(scale).toBeLessThan(previous);
      previous = scale;
    }
  });

  it('clamps rather than inverting on out-of-range input', () => {
    expect(bandScale(-1)).toBeCloseTo(1 - SLIT_SHARE, 6);
    expect(bandScale(2)).toBe(0);
    expect(bandScale(Number.NaN)).toBeCloseTo(1 - SLIT_SHARE, 6);
  });
});

describe('the beat it shares with the name', () => {
  it('opens over exactly the window the letters are filling', () => {
    /*
     * The world widening and the snow filling the name are meant to be one
     * gesture. Both wait out the lead and then accumulate over the rest of the
     * title's cue, and both take those numbers from the cue list -- so this
     * fails the moment someone retunes one and not the other.
     */
    const titleBeat = cueDuration(HERO_SEQUENCE, 'title');
    expect(SNOW_LEAD).toBeGreaterThan(0);
    expect(SNOW_LEAD).toBeLessThan(titleBeat);
    // What is left of the title's cue once the snow has had time to fall.
    expect(titleBeat - SNOW_LEAD).toBeCloseTo(1.85, 6);
  });
});

describe('the seam', () => {
  it('is brightest where the two edges meet', () => {
    expect(seamPresence(0)).toBe(1);
  });

  it('is gone well before the aperture is halfway open', () => {
    // It is the moment of ignition, not a glow that sits over the scene.
    expect(seamPresence(0.5)).toBe(0);
    expect(seamPresence(1)).toBe(0);
  });

  it('draws outward from the centre rather than appearing at full width', () => {
    expect(seamSpread(0)).toBe(0);
    expect(seamSpread(0.14)).toBe(1);
    expect(seamSpread(0.07)).toBeGreaterThan(0);
    expect(seamSpread(0.07)).toBeLessThan(1);
  });

  it('has drawn its full width before it starts fading', () => {
    // Otherwise the line grows and dims at once, and reads as a smear.
    expect(seamSpread(0.14)).toBe(1);
    expect(seamPresence(0.14)).toBeGreaterThan(0.5);
  });
});
