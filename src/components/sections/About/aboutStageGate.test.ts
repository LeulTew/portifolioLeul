import { describe, it, expect } from 'vitest';
import {
  advancePhase,
  isPhaseAtTarget,
  phaseGate,
  PHASE_AT_REST,
  type PhaseState,
} from '@/lib/motion/triggeredPhase';

/**
 * The About section used to trap the reader, and this is the shape of why.
 *
 * Each of its three beats decided whether to *start* from one condition and
 * whether to *stay* from another. Forward activation was a sticky flag set by
 * a scroll gesture; sustain was a position threshold. Those two agree nowhere
 * except at the threshold itself, so once the gesture flag was set the beat
 * computed active on one frame and inactive on the next, forever -- and every
 * swing registered a scroll block, so input was cancelled on roughly every
 * other frame and the reader could never travel to the position that the
 * sustain condition wanted. The gate was the reason its own precondition could
 * not be met.
 *
 * `update()` is driven by `subscribeScrollProgress`, which publishes from
 * inside the render loop, so "forever" means every frame for as long as the
 * section was on screen.
 *
 * These cases pin the property that makes that impossible: one condition
 * decides both entering and staying, so a beat always converges.
 */

/** Replays one beat's per-frame `update()` + `step()` against a scroll track. */
function replay(
  seqPerFrame: readonly number[],
  { enter, exit, durationMs }: { enter: number; exit: number; durationMs: number }
) {
  let wasActive = false;
  let phase: PhaseState = PHASE_AT_REST;
  let frameQueued = false;
  let animatedFrames = 0;
  let triggerFlips = 0;

  for (const seq of seqPerFrame) {
    // update(): position is the only trigger.
    const active = phaseGate(seq, wasActive, enter, exit);
    if (active !== wasActive) triggerFlips += 1;
    wasActive = active;
    if (!isPhaseAtTarget(phase, active) && !frameQueued) frameQueued = true;

    // step(): the rAF callback, which owns the pace.
    if (frameQueued) {
      frameQueued = false;
      phase = advancePhase(phase, wasActive, 16.7, durationMs);
      if (!isPhaseAtTarget(phase, wasActive)) frameQueued = true;
      animatedFrames += 1;
    }
  }

  return { animatedFrames, triggerFlips, t: phase.t, settled: isPhaseAtTarget(phase, wasActive) };
}

const BACKGROUND = { enter: 0.78, exit: 0.73, durationMs: 1200 };
const TITLE = { enter: 0.86, exit: 0.81, durationMs: 1500 };
const STATEMENTS = { enter: 0.42, exit: 0.37, durationMs: 800 };

const held = (seq: number, frames: number) => Array<number>(frames).fill(seq);

describe.each([
  ['background', BACKGROUND],
  ['title', TITLE],
  ['statements', STATEMENTS],
])('the %s beat', (_name, beat) => {
  it('does no work at all while the reader is held short of its threshold', () => {
    /*
     * The reported bug, pinned. Ten seconds of frames with the reader parked
     * well before the threshold used to produce an unbroken run of
     * start/stop animation registrations, each one cancelling scroll input.
     */
    const result = replay(held(beat.exit - 0.2, 600), beat);

    expect(result.animatedFrames).toBe(0);
    expect(result.triggerFlips).toBe(0);
    expect(result.settled).toBe(true);
  });

  it('plays exactly once through, at its authored duration, and settles', () => {
    const frames = [...held(beat.exit - 0.05, 10), ...held(beat.enter + 0.02, 590)];
    const result = replay(frames, beat);

    expect(result.triggerFlips).toBe(1);
    expect(result.t).toBe(1);
    expect(result.settled).toBe(true);
    // 16.7ms steps across the duration, and not a frame more.
    expect(result.animatedFrames).toBe(Math.ceil(beat.durationMs / 16.7));
  });

  it('cannot be rushed by scrolling harder', () => {
    const gentle = replay([...held(beat.enter + 0.02, 600)], beat);
    const flick = replay([...held(beat.enter + 0.2, 600)], beat);

    expect(flick.animatedFrames).toBe(gentle.animatedFrames);
  });

  it('reverses back to rest when the reader leaves past the deadband', () => {
    const frames = [...held(beat.enter + 0.02, 120), ...held(beat.exit - 0.05, 480)];
    const result = replay(frames, beat);

    expect(result.t).toBe(0);
    expect(result.settled).toBe(true);
  });

  it('is not restarted by an inertial wobble sitting on its threshold', () => {
    // Alternating either side of `enter` but never below `exit`: the deadband
    // is what stops each wobble from re-triggering the movement.
    const frames = Array.from({ length: 600 }, (_, i) =>
      i % 2 === 0 ? beat.enter - 0.005 : beat.enter + 0.005
    );
    const result = replay(frames, beat);

    expect(result.triggerFlips).toBe(1);
    expect(result.settled).toBe(true);
  });
});

describe('the About beats as a chain', () => {
  it('run in the order the choreography lays them out', () => {
    // Taken from STATEMENT_LAYERS: statements hand over mid-section, the
    // background rises after statement two has gone, and the title is written
    // last. A single pass down the pin must trip them in that order.
    expect(STATEMENTS.enter).toBeLessThan(BACKGROUND.enter);
    expect(BACKGROUND.enter).toBeLessThan(TITLE.enter);

    // And no beat's deadband reaches back into the one before it, which would
    // let a single position hold two beats mid-flight.
    expect(BACKGROUND.exit).toBeGreaterThan(STATEMENTS.enter);
    expect(TITLE.exit).toBeGreaterThan(BACKGROUND.enter);
  });

  it('all reach rest by the end of a single continuous scroll through', () => {
    const track = Array.from({ length: 900 }, (_, i) => i / 899);

    for (const beat of [STATEMENTS, BACKGROUND, TITLE]) {
      const result = replay(track, beat);
      expect(result.settled).toBe(true);
      expect(result.t).toBe(1);
    }
  });
});
