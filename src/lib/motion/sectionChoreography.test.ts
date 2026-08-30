import { describe, it, expect } from 'vitest';
import {
  ENTER_THRESHOLD,
  EXIT_THRESHOLD,
  HERO_SEQUENCE,
  cueDelay,
  cueDuration,
  exitAmount,
  exitStyle,
  sequenceDuration,
  type SectionCue,
} from './sectionChoreography';

/** Every sequence in the app, checked against the same ordering rules. */
const SEQUENCES: ReadonlyArray<readonly [string, readonly SectionCue[]]> = [
  ['hero', HERO_SEQUENCE],
];

describe.each(SEQUENCES)('%s sequence', (_name, sequence) => {
  it('names every layer exactly once', () => {
    const ids = sequence.map((cue) => cue.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('starts at the top of the sequence', () => {
    expect(sequence[0].at).toBe(0);
  });

  it('runs in ascending order', () => {
    for (let i = 1; i < sequence.length; i++) {
      expect(sequence[i].at).toBeGreaterThan(sequence[i - 1].at);
    }
  });

  it('never starts two layers at the same instant', () => {
    // Simultaneous starts read as one pop rather than a choreographed reveal.
    const starts = sequence.map((cue) => cue.at);
    expect(new Set(starts).size).toBe(starts.length);
  });

  it('overlaps neighbours rather than leaving dead air', () => {
    for (let i = 1; i < sequence.length; i++) {
      const previous = sequence[i - 1];
      const gap = sequence[i].at - (previous.at + previous.duration);
      expect(gap).toBeLessThan(0.35);
    }
  });

  it('gives every layer a real duration', () => {
    for (const cue of sequence) {
      expect(cue.duration).toBeGreaterThan(0.2);
      expect(cue.duration).toBeLessThanOrEqual(1.2);
    }
  });

  it('finishes before the reader loses patience', () => {
    expect(sequenceDuration(sequence)).toBeLessThan(2.5);
  });
});

describe('hero ordering', () => {
  it('arrives back to front, ending on the scroll affordance', () => {
    expect(HERO_SEQUENCE.map((cue) => cue.id)).toEqual([
      'backdrop',
      'portrait',
      'title',
      'role',
      'description',
      'actions',
      'affordance',
    ]);
  });

  it('drives type with GSAP and containers with Framer', () => {
    const engineOf = (id: string) =>
      HERO_SEQUENCE.find((cue) => cue.id === id)?.engine;

    expect(engineOf('backdrop')).toBe('framer');
    expect(engineOf('title')).toBe('gsap');
    expect(engineOf('description')).toBe('gsap');
    expect(engineOf('affordance')).toBe('framer');
  });
});

describe('cue lookup', () => {
  it('reports a layer’s delay and duration', () => {
    expect(cueDelay(HERO_SEQUENCE, 'title')).toBe(0.32);
    expect(cueDuration(HERO_SEQUENCE, 'title')).toBe(0.9);
  });

  it('degrades safely for an unknown layer', () => {
    expect(cueDelay(HERO_SEQUENCE, 'nope')).toBe(0);
    expect(cueDuration(HERO_SEQUENCE, 'nope')).toBe(0.7);
    expect(cueDuration(HERO_SEQUENCE, 'nope', 0.2)).toBe(0.2);
  });

  it('measures the whole sequence from its last finish', () => {
    const last = HERO_SEQUENCE[HERO_SEQUENCE.length - 1];
    expect(sequenceDuration(HERO_SEQUENCE)).toBeCloseTo(last.at + last.duration, 6);
  });

  it('measures an empty sequence as instant', () => {
    expect(sequenceDuration([])).toBe(0);
  });
});

describe('exitAmount', () => {
  it('is zero while the section holds the screen', () => {
    expect(exitAmount(1)).toBe(0);
    expect(exitAmount(EXIT_THRESHOLD)).toBe(0);
  });

  it('reaches one once the section is gone', () => {
    expect(exitAmount(0)).toBe(1);
  });

  it('scrubs proportionally on the way out', () => {
    expect(exitAmount(EXIT_THRESHOLD / 2)).toBeCloseTo(0.5, 6);
  });

  it('never leaves the normalized range', () => {
    for (const coverage of [-1, 0, 0.2, 0.9, 2, Number.NaN]) {
      const amount = exitAmount(coverage);
      expect(amount).toBeGreaterThanOrEqual(0);
      expect(amount).toBeLessThanOrEqual(1);
    }
  });

  it('never exits for a zero threshold', () => {
    expect(exitAmount(0, 0)).toBe(0);
  });
});

describe('exitStyle', () => {
  it('leaves a focused section untouched', () => {
    const style = exitStyle(0);
    expect(style.opacity).toBe(1);
    expect(style.filter).toBe('none');
    expect(style.transform).toContain('scale(1.0000)');
    expect(style.transform).toContain('0.00px');
  });

  it('never fades to a hard zero', () => {
    // Vanishing outright reads as a bug rather than a transition.
    expect(exitStyle(1).opacity).toBeGreaterThan(0.1);
  });

  it('drifts up and pulls back, never forward', () => {
    const style = exitStyle(1);
    expect(style.transform).toContain('-64.00px');
    const scale = Number(style.transform.match(/scale\(([\d.]+)\)/)?.[1]);
    expect(scale).toBeLessThan(1);
    expect(scale).toBeGreaterThan(0.9);
  });

  it('defocuses as it leaves', () => {
    expect(exitStyle(1).filter).toContain('blur(5.00px)');
  });

  it('moves monotonically through the exit', () => {
    let previous = Infinity;
    for (let t = 0; t <= 1; t += 0.05) {
      const opacity = exitStyle(t).opacity;
      expect(opacity).toBeLessThanOrEqual(previous);
      previous = opacity;
    }
  });

  it('keeps only the fade under reduced motion', () => {
    const style = exitStyle(1, true);
    expect(style.opacity).toBeGreaterThan(0.1);
    expect(style.opacity).toBeLessThan(1);
    expect(style.transform).toBe('none');
    expect(style.filter).toBe('none');
  });

  it('clamps input outside the normalized range', () => {
    expect(exitStyle(5).opacity).toBe(exitStyle(1).opacity);
    expect(exitStyle(-5).opacity).toBe(exitStyle(0).opacity);
  });
});

describe('thresholds', () => {
  it('enters before it would begin exiting', () => {
    expect(ENTER_THRESHOLD).toBeLessThan(EXIT_THRESHOLD);
  });
});
