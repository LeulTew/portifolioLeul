import { describe, expect, it } from 'vitest';
import {
  advancePhase,
  easeInOutCubic,
  isPhaseAtTarget,
  phaseGate,
  PHASE_AT_REST,
  type PhaseState,
} from './triggeredPhase';

/** Runs a beat for a stretch of wall-clock at a given frame rate. */
function run(
  state: PhaseState,
  active: boolean,
  ms: number,
  durationMs: number,
  frameMs = 16.7
): PhaseState {
  let next = state;
  for (let elapsed = 0; elapsed < ms; elapsed += frameMs) {
    next = advancePhase(next, active, frameMs, durationMs);
  }
  return next;
}

describe('advancePhase', () => {
  it('reaches the end after its own duration, not before', () => {
    const half = run(PHASE_AT_REST, true, 300, 600);
    expect(half.t).toBeGreaterThan(0.4);
    expect(half.t).toBeLessThan(0.6);
    expect(run(PHASE_AT_REST, true, 700, 600).t).toBe(1);
  });

  it('takes the same time whatever the frame rate', () => {
    const smooth = run(PHASE_AT_REST, true, 400, 600, 16.7);
    const janky = run(PHASE_AT_REST, true, 400, 600, 50);
    expect(smooth.t).toBeCloseTo(janky.t, 1);
  });

  it('ignores how hard the reader scrolls once started', () => {
    // The trigger is a boolean, so there is no input left that could hurry it.
    const once = run(PHASE_AT_REST, true, 200, 600);
    const again = run(PHASE_AT_REST, true, 200, 600);
    expect(once.t).toBe(again.t);
  });

  it('reverses from wherever it stands rather than snapping', () => {
    const midway = run(PHASE_AT_REST, true, 300, 600);
    const backABit = advancePhase(midway, false, 16.7, 600);
    expect(backABit.t).toBeLessThan(midway.t);
    expect(backABit.t).toBeGreaterThan(0);
    expect(run(backABit, false, 700, 600).t).toBe(0);
  });

  it('lands the beat when a backgrounded tab returns with a huge gap', () => {
    expect(advancePhase(PHASE_AT_REST, true, 9000, 600).t).toBe(1);
  });

  it('never leaves the unit range', () => {
    expect(run(PHASE_AT_REST, true, 5000, 600).t).toBe(1);
    expect(run({ t: 1, heading: 1 }, false, 5000, 600).t).toBe(0);
  });

  it('still takes the new heading when the frame delta is unusable', () => {
    const stalled = advancePhase(PHASE_AT_REST, true, 0, 600);
    expect(stalled.heading).toBe(1);
    expect(stalled.t).toBe(0);
    expect(advancePhase(PHASE_AT_REST, true, Number.NaN, 600).heading).toBe(1);
    expect(advancePhase(PHASE_AT_REST, true, 16.7, 0).t).toBe(0);
  });
});

describe('isPhaseAtTarget', () => {
  it('reports a beat at rest as unfinished the moment its trigger goes true', () => {
    // The bug this guards: asked against its own heading, a resting beat says
    // "finished" and the frame loop never starts.
    expect(isPhaseAtTarget(PHASE_AT_REST, true)).toBe(false);
    expect(isPhaseAtTarget(PHASE_AT_REST, false)).toBe(true);
  });

  it('reports a finished beat as unfinished once it must come back', () => {
    const done: PhaseState = { t: 1, heading: 1 };
    expect(isPhaseAtTarget(done, true)).toBe(true);
    expect(isPhaseAtTarget(done, false)).toBe(false);
  });
});

describe('phaseGate', () => {
  it('starts at enter and does not let go until exit', () => {
    expect(phaseGate(0.3, false, 0.42, 0.36)).toBe(false);
    expect(phaseGate(0.42, false, 0.42, 0.36)).toBe(true);
    // Below enter but above exit: an active beat stays active.
    expect(phaseGate(0.38, true, 0.42, 0.36)).toBe(true);
    expect(phaseGate(0.35, true, 0.42, 0.36)).toBe(false);
  });

  it('does not chatter when the reader rests on the threshold', () => {
    let active = false;
    for (const wobble of [0.42, 0.41, 0.4, 0.39, 0.415, 0.405]) {
      active = phaseGate(wobble, active, 0.42, 0.36);
      expect(active).toBe(true);
    }
  });

  it('holds its answer for a value it cannot read', () => {
    expect(phaseGate(Number.NaN, true, 0.42, 0.36)).toBe(true);
    expect(phaseGate(Number.NaN, false, 0.42, 0.36)).toBe(false);
  });
});

describe('easeInOutCubic', () => {
  it('pins both ends and the midpoint', () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 6);
  });

  it('rises without ever going backwards', () => {
    let previous = -1;
    for (let t = 0; t <= 1.0001; t += 0.01) {
      const value = easeInOutCubic(t);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });

  it('commits early enough that a trigger does not read as a missed input', () => {
    // The reason this is cubic and not exponential: expo is under a thousandth
    // at this point, which after a deliberate trigger looks like nothing moved.
    expect(easeInOutCubic(1 / 6)).toBeGreaterThan(0.018);
  });

  it('clamps outside the unit range', () => {
    expect(easeInOutCubic(-1)).toBe(0);
    expect(easeInOutCubic(2)).toBe(1);
    expect(easeInOutCubic(Number.NaN)).toBe(0);
  });
});
