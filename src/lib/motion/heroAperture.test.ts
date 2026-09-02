import { describe, it, expect } from 'vitest';
import {
  CLOSE_END,
  CLOSE_START,
  SLIT_SHARE,
  apertureOpenness,
  bandScale,
  closeAmount,
  seamPresence,
  seamSpread,
} from './heroAperture';
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

describe('apertureOpenness', () => {
  it('is shut until the entry gives it something', () => {
    expect(apertureOpenness(0, 0)).toBe(0);
  });

  it('is fully open once entered and not yet leaving', () => {
    expect(apertureOpenness(1, 0)).toBe(1);
  });

  it('lets the scroll take back only what the entry has given', () => {
    /*
     * The reason these are multiplied rather than kept as separate animations.
     * A reader who scrolls while the aperture is still opening gets one
     * continuous movement; two animations writing the same transform would
     * fight, and the bands would jump.
     */
    expect(apertureOpenness(0.5, 0.5)).toBeCloseTo(0.25, 6);
    expect(apertureOpenness(0.4, 1)).toBe(0);
  });

  it('closes fully however far the entry had got', () => {
    for (const opened of [0.2, 0.6, 1]) {
      expect(apertureOpenness(opened, 1)).toBe(0);
    }
  });
});

describe('closeAmount', () => {
  it('holds the aperture open while the copy is still leaving', () => {
    // The copy is already moving from the first pixel of scroll. Shutting the
    // aperture on top of it would collapse the sequence into one crude wipe.
    expect(closeAmount(0)).toBe(0);
    expect(closeAmount(CLOSE_START)).toBe(0);
    expect(closeAmount(0.2)).toBe(0);
  });

  it('is fully shut by the time the hero is gone', () => {
    expect(closeAmount(CLOSE_END)).toBe(1);
    expect(closeAmount(1)).toBe(1);
  });

  it('eases rather than ramping', () => {
    // A linear close reads as a panel resizing; the midpoint of a smoothstep
    // sits at a half while its ends are flat.
    const middle = (CLOSE_START + CLOSE_END) / 2;
    expect(closeAmount(middle)).toBeCloseTo(0.5, 2);

    const early = closeAmount(CLOSE_START + 0.05);
    const late = closeAmount(middle) - closeAmount(middle - 0.05);
    expect(early).toBeLessThan(late);
  });

  it('never runs backwards across the scroll', () => {
    let previous = -1;
    for (let i = 0; i <= 20; i += 1) {
      const amount = closeAmount(i / 20);
      expect(amount).toBeGreaterThanOrEqual(previous);
      previous = amount;
    }
  });

  it('treats nonsense as not closing', () => {
    expect(closeAmount(Number.NaN)).toBe(0);
    expect(closeAmount(-5)).toBe(0);
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
