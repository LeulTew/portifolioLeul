import { describe, it, expect } from 'vitest';
import {
  ENTER_THRESHOLD,
  EXIT_THRESHOLD,
  HERO_SEQUENCE,
  cueDelay,
  cueDuration,
  exitAmount,
  exitStyle,
  INNER_EXIT_SPAN,
  innerExitCueAt,
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

  it('hands over between beats without leaving dead air', () => {
    for (let i = 1; i < sequence.length; i++) {
      const previous = sequence[i - 1];
      const gap = sequence[i].at - (previous.at + previous.duration);
      expect(gap).toBeLessThan(0.35);
    }
  });

  it('separates its beats rather than running them together', () => {
    // The complaint that fixed this: everything moving at once, at one speed,
    // reads as a single slide however many layers are involved.
    for (let i = 1; i < sequence.length; i++) {
      const step = sequence[i].at - sequence[i - 1].at;
      expect(step).toBeGreaterThanOrEqual(0.25);
    }
  });

  it('varies pace across the sequence', () => {
    const durations = sequence.map((cue) => cue.duration);
    const spread = Math.max(...durations) / Math.min(...durations);
    expect(spread).toBeGreaterThan(2);
  });

  it('gives every layer a real duration', () => {
    for (const cue of sequence) {
      expect(cue.duration).toBeGreaterThan(0.2);
      /*
       * The ceiling covers the title, which accumulates rather than arriving.
       * Accumulation has to be watched to read as accumulation; under a second
       * it registers as a flash. Nothing should run longer than this, though --
       * past it the reader is waiting on the page rather than reading it.
       */
      expect(cue.duration).toBeLessThanOrEqual(2.5);
    }
  });

  it('finishes before the reader loses patience', () => {
    expect(sequenceDuration(sequence)).toBeLessThan(4.5);
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

  it('runs every entrance layer on CSS', () => {
    // Every one of these starts from a state that hides content. Framer and
    // GSAP both apply that start state synchronously and then animate on
    // requestAnimationFrame, so a tab never served frames keeps it and the
    // hero is simply absent. CSS animations cannot be left half-played.
    for (const cue of HERO_SEQUENCE) {
      expect(cue.engine).toBe('css');
    }
  });
});

describe('cue lookup', () => {
  it('reports a layer’s delay and duration', () => {
    expect(cueDelay(HERO_SEQUENCE, 'title')).toBe(1.0);
    expect(cueDuration(HERO_SEQUENCE, 'title')).toBe(2.4);
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

  it('goes completely, once it is completely gone', () => {
    // The exit runs on coverage and only reaches full when the section is off
    // screen entirely, so there is no early vanish to guard against. A floor
    // here left the hero faintly printed over every section after it.
    expect(exitStyle(1).opacity).toBe(0);
  });

  it('does not vanish early on its way out', () => {
    // What the floor was protecting: the fade has to be gradual, which is the
    // curve's job, not a clamp at the end of it.
    expect(exitStyle(0.25).opacity).toBeGreaterThan(0.6);
    expect(exitStyle(0.5).opacity).toBeGreaterThan(0.4);
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
    expect(style.opacity).toBe(0);
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

describe('innerExitCueAt', () => {
  it('sends the last thing to arrive out first', () => {
    /*
     * The reverse of arrival, which is what makes the hero read as being
     * packed away rather than switched off. A single block fade -- which is
     * what this replaced -- reads as neither.
     */
    const actions = innerExitCueAt(HERO_SEQUENCE, 'actions');
    const description = innerExitCueAt(HERO_SEQUENCE, 'description');
    const title = innerExitCueAt(HERO_SEQUENCE, 'title');
    const portrait = innerExitCueAt(HERO_SEQUENCE, 'portrait');

    expect(actions).toBeLessThan(description);
    expect(description).toBeLessThan(title);
    expect(title).toBeLessThan(portrait);
  });

  it('leaves both the plate and the cue out of the copy stagger', () => {
    /*
     * Neither belongs in it. The plate is the ground the copy stood on and
     * shuts on a beat of its own afterwards; the cue is not inside the block
     * at all. Leaving their slots in the stagger left the copy finished two
     * thirds of the way through its own window, with nothing happening for the
     * rest of it -- a stall the reader reads as the page having got stuck.
     */
    expect(innerExitCueAt(HERO_SEQUENCE, 'backdrop')).toBe(0);
    expect(innerExitCueAt(HERO_SEQUENCE, 'affordance')).toBe(0);
  });

  it('fills the window exactly, so the plate follows without a gap', () => {
    const inner = HERO_SEQUENCE.filter(
      (cue) => cue.id !== 'backdrop' && cue.id !== 'affordance'
    );
    const beats = inner.map((cue) => innerExitCueAt(HERO_SEQUENCE, cue.id));

    expect(Math.min(...beats)).toBe(0);
    expect(Math.max(...beats) + INNER_EXIT_SPAN).toBeCloseTo(1, 6);
  });

  it('mirrors the arrival order of the copy exactly', () => {
    const inner = [...HERO_SEQUENCE]
      .filter((cue) => cue.id !== 'backdrop' && cue.id !== 'affordance')
      .sort((a, b) => a.at - b.at)
      .map((c) => c.id);

    const departure = [...inner].sort(
      (a, b) => innerExitCueAt(HERO_SEQUENCE, a) - innerExitCueAt(HERO_SEQUENCE, b)
    );

    expect(departure).toEqual([...inner].reverse());
  });

  it('gives every layer of the copy its own turn', () => {
    const inner = HERO_SEQUENCE.filter(
      (cue) => cue.id !== 'backdrop' && cue.id !== 'affordance'
    );
    const beats = inner.map((cue) => innerExitCueAt(HERO_SEQUENCE, cue.id));
    expect(new Set(beats).size).toBe(inner.length);
  });

  it('is inert for a layer that is not in the sequence', () => {
    expect(innerExitCueAt(HERO_SEQUENCE, 'nothing-by-that-name')).toBe(0);
    expect(innerExitCueAt([], 'anything')).toBe(0);
  });
});
