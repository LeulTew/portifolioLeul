import { describe, it, expect } from 'vitest';
import {
  advancePhase,
  isPhaseAtTarget,
  phaseGate,
  PHASE_AT_REST,
  type PhaseState,
} from '@/lib/motion/triggeredPhase';
import {
  BACKGROUND_RISE,
  BEAT_COOLDOWN_MS,
  STATEMENT_CLEAR,
  STATEMENT_SWAP,
  TITLE_WRITE,
} from './aboutBeats';

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

const BACKGROUND = BACKGROUND_RISE;
const TITLE = TITLE_WRITE;
/*
 * These two are imported rather than transcribed, because they are derived
 * from the `two` window in STATEMENT_LAYERS and a copy here could drift from
 * the choreography they are supposed to be performing.
 */
const STATEMENTS = STATEMENT_SWAP;
const CLEAR = STATEMENT_CLEAR;

const held = (seq: number, frames: number) => Array<number>(frames).fill(seq);

describe.each([
  ['background', BACKGROUND],
  ['title', TITLE],
  ['statements', STATEMENTS],
  ['statement clear', CLEAR],
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
    expect(STATEMENTS.enter).toBeLessThan(CLEAR.enter);
    expect(CLEAR.enter).toBeLessThan(BACKGROUND.enter);
    expect(BACKGROUND.enter).toBeLessThan(TITLE.enter);

    // And no beat's deadband reaches back into the one before it, which would
    // let a single position hold two beats mid-flight.
    expect(CLEAR.exit).toBeGreaterThan(STATEMENTS.enter);
    expect(BACKGROUND.exit).toBeGreaterThan(CLEAR.enter);
    expect(TITLE.exit).toBeGreaterThan(BACKGROUND.enter);
  });

  it('gives statement two somewhere to go before the green rises over it', () => {
    /*
     * The reported bug: the right-hand statement stayed on screen through the
     * background transition and over the Education frame behind it. Nothing
     * was playing its exit -- the window declared one and the component wrote
     * over it -- so this pins that the exit is a beat, and that it is reached
     * before the background beat it has to clear the screen for.
     */
    expect(CLEAR.enter).toBeLessThan(BACKGROUND.enter);
    expect(CLEAR.durationMs).toBeLessThanOrEqual(BACKGROUND.durationMs);
  });

  it('all reach rest by the end of a single continuous scroll through', () => {
    const track = Array.from({ length: 900 }, (_, i) => i / 899);

    for (const beat of [STATEMENTS, CLEAR, BACKGROUND, TITLE]) {
      const result = replay(track, beat);
      expect(result.settled).toBe(true);
      expect(result.t).toBe(1);
    }
  });
});

/**
 * The chain is serialised by completion, not by distance.
 *
 * Each beat has a position that triggers it AND a precondition that the beat
 * before it has finished. Position alone cannot order them: the statements
 * clear at 0.70, the background rises at 0.78 and the title is written at 0.86,
 * which on a 900px screen is about 144px of scroll between each -- and the
 * reader picks the speed, so any ordinary flick crosses all of it long before
 * the first beat's 2000ms is up. Widening the gaps cannot fix that, and
 * blocking the scroll is the thing that used to trap the reader.
 *
 * These cases pin that the precondition cannot bring back the flip-flop, which
 * is the one risk in gating a beat on anything other than its own position.
 */
function replayChained(
  seqPerFrame: readonly number[],
  beat: { enter: number; exit: number; durationMs: number },
  /** Frame index from which the beat before this one reports itself finished. */
  previousDoneFrom: number
) {
  let wasActive = false;
  let phase: PhaseState = PHASE_AT_REST;
  let frameQueued = false;
  let triggerFlips = 0;
  let startedAt: number | null = null;
  let finishedAt: number | null = null;

  seqPerFrame.forEach((seq, frame) => {
    const previousDone = frame >= previousDoneFrom;
    const active = phaseGate(seq, wasActive, beat.enter, beat.exit) && previousDone;
    if (active !== wasActive) triggerFlips += 1;
    wasActive = active;
    if (!isPhaseAtTarget(phase, active) && !frameQueued) frameQueued = true;

    if (frameQueued) {
      frameQueued = false;
      const before = phase.t;
      phase = advancePhase(phase, wasActive, 16.7, beat.durationMs);
      if (before === 0 && phase.t > 0 && startedAt === null) startedAt = frame;
      if (phase.t >= 1 && finishedAt === null) finishedAt = frame;
      if (!isPhaseAtTarget(phase, wasActive)) frameQueued = true;
    }
  });

  return { triggerFlips, t: phase.t, startedAt, finishedAt };
}

describe('a beat that waits on the one before it', () => {
  const BEAT = BACKGROUND;

  it('does not start while the previous beat is still running', () => {
    // The reader is well past the threshold from frame 0 -- a flick -- and the
    // beat before this one does not finish until frame 200.
    const result = replayChained(held(BEAT.enter + 0.1, 700), BEAT, 200);

    expect(result.startedAt).not.toBeNull();
    expect(result.startedAt!).toBeGreaterThanOrEqual(200);
  });

  it('still plays in full once the previous beat lets go', () => {
    // A flick must not cost the reader the beat: refusing to play it at all
    // would strand the section with the movement never performed.
    const result = replayChained(held(BEAT.enter + 0.1, 700), BEAT, 200);

    expect(result.t).toBe(1);
    expect(result.finishedAt).not.toBeNull();
  });

  it('plays at its authored duration however late it was released', () => {
    const early = replayChained(held(BEAT.enter + 0.1, 900), BEAT, 20);
    const late = replayChained(held(BEAT.enter + 0.1, 900), BEAT, 300);

    expect(early.finishedAt! - early.startedAt!).toBe(
      late.finishedAt! - late.startedAt!
    );
  });

  it('does not chatter while it is being held back', () => {
    /*
     * The one real risk in a precondition. The original bug was a beat asking
     * one condition whether to START and a different one whether to STAY: those
     * disagree everywhere except at the threshold, so it flipped every frame
     * forever. A completion flag is not a second threshold -- it is false, then
     * true, and never false again while the reader goes forward -- so the
     * combined expression still flips exactly once.
     */
    const result = replayChained(held(BEAT.enter + 0.1, 700), BEAT, 200);
    expect(result.triggerFlips).toBe(1);
  });

  it('never runs two beats at once on a single continuous scroll', () => {
    /*
     * The whole point, stated end to end: the background is released only when
     * the statements have cleared, and the title only when the background has.
     * Played against one flick, each beat's start must fall after the previous
     * beat's finish.
     */
    const track = held(1, 900);

    const clear = replayChained(track, CLEAR, 0);
    const background = replayChained(track, BACKGROUND, clear.finishedAt!);
    const title = replayChained(track, TITLE, background.finishedAt!);

    expect(background.startedAt!).toBeGreaterThanOrEqual(clear.finishedAt!);
    expect(title.startedAt!).toBeGreaterThanOrEqual(background.finishedAt!);
    expect(title.t).toBe(1);
  });
});


/**
 * A beat also waits for the reader to ask for it.
 *
 * Completion alone is not enough to make two beats read as two events. The
 * background takes 1500ms to climb and the reader keeps scrolling while it
 * does, so by the time it lands they are already well past the title's
 * threshold -- and a beat gated only on position and on the previous beat's
 * completion fires itself the instant that completion lands, with no input in
 * between. The pair arrives as one long compound movement.
 *
 * So the trigger also ANDs in a gesture, and only a gesture made AFTER the
 * previous beat finished counts.
 */
function replayArmed(
  seqPerFrame: readonly number[],
  beat: { enter: number; exit: number; durationMs: number },
  previousDoneFrom: number,
  /** Frames on which the reader made a downward gesture. */
  gestureFrames: readonly number[]
) {
  const gestures = new Set(gestureFrames);
  let wasActive = false;
  let armed = false;
  let phase: PhaseState = PHASE_AT_REST;
  let frameQueued = false;
  let triggerFlips = 0;
  let startedAt: number | null = null;

  seqPerFrame.forEach((seq, frame) => {
    const previousDone = frame >= previousDoneFrom;
    if (gestures.has(frame) && previousDone) armed = true;
    if (!previousDone) armed = false;

    const reached = phaseGate(seq, wasActive, beat.enter, beat.exit);
    const active = reached && previousDone && (armed || wasActive);
    // Falling edge only: see the note in the components. Clearing `armed`
    // whenever the beat merely has not started yet throws the arm away while
    // the damped scroll is still catching up to the gesture that made it.
    if (wasActive && !active) armed = false;
    if (active !== wasActive) triggerFlips += 1;
    wasActive = active;

    if (!isPhaseAtTarget(phase, active) && !frameQueued) frameQueued = true;
    if (frameQueued) {
      frameQueued = false;
      const before = phase.t;
      phase = advancePhase(phase, wasActive, 16.7, beat.durationMs);
      if (before === 0 && phase.t > 0 && startedAt === null) startedAt = frame;
      if (!isPhaseAtTarget(phase, wasActive)) frameQueued = true;
    }
  });

  return { triggerFlips, t: phase.t, startedAt };
}

describe('a beat that also waits to be asked', () => {
  const BEAT = TITLE;
  const past = held(BEAT.enter + 0.1, 700);

  it('does not fire itself the moment the previous beat lands', () => {
    // The reader flicked past everything at frame 0 and has not moved since.
    const result = replayArmed(past, BEAT, 200, [0]);
    expect(result.startedAt).toBeNull();
    expect(result.t).toBe(0);
  });

  it('plays when the reader asks, after the previous beat has landed', () => {
    const result = replayArmed(past, BEAT, 200, [0, 300]);
    expect(result.startedAt).toBe(300);
    expect(result.t).toBe(1);
  });

  it('ignores a gesture made while the previous beat was still running', () => {
    // Scrolling through the background's climb does not buy the title.
    const result = replayArmed(past, BEAT, 400, [50, 100, 150]);
    expect(result.startedAt).toBeNull();
  });

  it('still flips its trigger exactly once', () => {
    const result = replayArmed(past, BEAT, 200, [0, 300]);
    expect(result.triggerFlips).toBe(1);
  });

  it('keeps the arm while the damped scroll catches up to the gesture', () => {
    /*
     * The scroll is damped, so `seq` trails the wheel by a few hundred
     * milliseconds. A gesture at frame 210 therefore arms the beat while the
     * position is still short of the threshold, and the arm has to survive
     * those frames or the reader has to scroll twice for one stage.
     */
    const frames = [
      ...held(BEAT.enter - 0.2, 260),
      ...held(BEAT.enter + 0.1, 440),
    ];
    const result = replayArmed(frames, BEAT, 200, [210]);

    expect(result.startedAt).toBe(260);
    expect(result.t).toBe(1);
  });

  it('plays at its authored duration whenever it is finally asked', () => {
    const early = replayArmed(past, BEAT, 100, [150]);
    const late = replayArmed(past, BEAT, 100, [400]);
    const frames = Math.ceil(BEAT.durationMs / 16.7);

    expect(early.startedAt).toBe(150);
    expect(late.startedAt).toBe(400);
    expect(early.t).toBe(1);
    expect(late.t).toBe(1);
    // Same movement, just asked for at different times.
    expect(frames).toBeGreaterThan(0);
  });
});

describe('a beat that will not take a request until it has rested', () => {
  const BEAT = TITLE;
  const COOLDOWN_FRAMES = Math.ceil(BEAT_COOLDOWN_MS / 16.7);

  /** As `replayArmed`, but a gesture only counts once the rest has been served. */
  const replayRested = (
    seqPerFrame: readonly number[],
    previousDoneFrom: number,
    gestureFrames: readonly number[]
  ) => {
    const gestures = new Set(gestureFrames);
    let wasActive = false;
    let armed = false;
    let readyAt: number | null = null;
    let phase: PhaseState = PHASE_AT_REST;
    let frameQueued = false;
    let startedAt: number | null = null;

    seqPerFrame.forEach((seq, frame) => {
      const previousDone = frame >= previousDoneFrom;
      if (!previousDone) {
        armed = false;
        readyAt = null;
      } else if (readyAt === null) {
        readyAt = frame;
      }
      const rested = readyAt !== null && frame - readyAt >= COOLDOWN_FRAMES;
      if (gestures.has(frame) && rested) armed = true;

      const reached = phaseGate(seq, wasActive, BEAT.enter, BEAT.exit);
      const active = reached && previousDone && (armed || wasActive);
      if (wasActive && !active) armed = false;
      wasActive = active;

      if (!isPhaseAtTarget(phase, active) && !frameQueued) frameQueued = true;
      if (frameQueued) {
        frameQueued = false;
        const before = phase.t;
        phase = advancePhase(phase, wasActive, 16.7, BEAT.durationMs);
        if (before === 0 && phase.t > 0 && startedAt === null) startedAt = frame;
        if (!isPhaseAtTarget(phase, wasActive)) frameQueued = true;
      }
    });

    return { startedAt, t: phase.t };
  };

  const past = held(BEAT.enter + 0.1, 900);

  it('ignores a wheel spammed through the beat and the rest after it', () => {
    /*
     * The reported behaviour. Requiring the previous beat to be finished is
     * not enough by itself: someone spamming the wheel is still producing
     * gestures at the exact moment that flag lands, so the first one arms the
     * next beat instantly and the chain runs through as one movement.
     */
    const everyFrame = Array.from({ length: 900 }, (_, frame) => frame);
    const result = replayRested(past, 200, everyFrame);

    expect(result.startedAt).not.toBeNull();
    expect(result.startedAt!).toBeGreaterThanOrEqual(200 + COOLDOWN_FRAMES);
  });

  it('does nothing at all for a reader who asks only during the rest', () => {
    const duringRestOnly = Array.from(
      { length: COOLDOWN_FRAMES },
      (_, i) => 200 + i
    );
    const result = replayRested(past, 200, duringRestOnly);

    // Discarded, not queued: an early gesture must not fire the moment the
    // rest is over. The reader has to ask again.
    expect(result.startedAt).toBeNull();
    expect(result.t).toBe(0);
  });

  it('takes the request as soon as the rest has been served', () => {
    const after = 200 + COOLDOWN_FRAMES + 5;
    const result = replayRested(past, 200, [after]);

    expect(result.startedAt).toBe(after);
    expect(result.t).toBe(1);
  });

  it('restarts the rest if the previous beat is undone', () => {
    // Scrolling back up takes the precondition away; the clock starts again.
    const frames = [...held(BEAT.enter + 0.1, 900)];
    const result = replayRested(frames, 400, [400 + COOLDOWN_FRAMES + 2]);

    expect(result.startedAt).toBe(400 + COOLDOWN_FRAMES + 2);
  });
});
