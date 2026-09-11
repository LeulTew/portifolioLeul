import { describe, it, expect } from 'vitest';
import {
  BEAT_COOLDOWN_MS,
  BEAT_DEADBAND,
  STATEMENT_CLEAR,
  statementsHeldClear,
} from './aboutBeats';
import { phaseGate } from '@/lib/motion/triggeredPhase';

/**
 * The last movement of the reverse, which used to run into the one before it.
 *
 * Going down, the chapter is a chain of separate movements and the reader calls
 * for each: the statements clear, and only after a gesture and a rest does the
 * wall rise. Measured coming back up, the wall finished retreating and the
 * statements began walking in 10ms later -- against 3131ms between those same
 * two beats going down. Nothing was out of order; there was simply no pause,
 * so the two read as one movement.
 */

const REST = BEAT_COOLDOWN_MS;

/** Replays the reverse frame by frame, the way `update()` runs it. */
function replayReverse(options: {
  /** Frames after the wall lands at which an upward gesture arrives. */
  gestureAt?: readonly number[];
  /** How long the wall stays busy, in frames. */
  busyFrames?: number;
  frames?: number;
  /** Where the reader is; constant unless a case needs otherwise. */
  seq?: number | ((frame: number) => number);
}) {
  const {
    gestureAt = [],
    busyFrames = 3,
    frames = 400,
    seq: seqOption = 0.5,
  } = options;

  let wasClear = true;
  let armed = false;
  let restedAt = 0;
  let releasedAt: number | null = null;
  const FRAME = 16.7;

  for (let frame = 0; frame < frames; frame++) {
    const now = frame * FRAME;
    const seq = typeof seqOption === 'function' ? seqOption(frame) : seqOption;
    const backgroundBusy = frame < busyFrames;

    // The gesture listener, which only counts once the rest has been served.
    if (gestureAt.includes(frame) && wasClear && !armed) {
      const since = now - restedAt;
      if (restedAt > 0 && since >= REST) armed = true;
    }

    // update(), in the order About.tsx runs it.
    if (backgroundBusy || !wasClear) {
      restedAt = 0;
      armed = false;
    } else if (restedAt === 0) {
      restedAt = now;
    }

    wasClear = statementsHeldClear({
      positionWants: phaseGate(
        seq,
        wasClear,
        STATEMENT_CLEAR.enter,
        STATEMENT_CLEAR.exit
      ),
      backgroundBusy,
      wasClear,
      seq,
      armed,
      restedAt,
      now,
    });

    if (!wasClear && releasedAt === null) releasedAt = now;
  }

  return { releasedAt, stillClear: wasClear };
}

describe('the statements wait to be asked back', () => {
  it('does not let them in the instant the wall has gone', () => {
    /*
     * The defect exactly: no gesture, so nothing should happen -- where before
     * the beat released on the first frame `backgroundBusy` went false.
     */
    const { releasedAt, stillClear } = replayReverse({ gestureAt: [] });

    expect(stillClear).toBe(true);
    expect(releasedAt).toBeNull();
  });

  it('serves the rest before an ask counts', () => {
    /*
     * The wall lands on frame 3. A reader spamming the wheel is producing
     * gestures at that instant, and every one of them arrives inside the rest.
     */
    const spam = Array.from({ length: 60 }, (_, i) => i + 3);
    const { releasedAt, stillClear } = replayReverse({ gestureAt: spam });

    // Discarded, not queued: they do not pay off the moment the rest is over.
    expect(stillClear).toBe(true);
    expect(releasedAt).toBeNull();
  });

  it('lets them back once asked after the rest', () => {
    const afterRest = Math.ceil(REST / 16.7) + 12;
    const { releasedAt } = replayReverse({ gestureAt: [afterRest] });

    expect(releasedAt).not.toBeNull();
    // And the pause it produces is the rest, not a rounding of it.
    expect(releasedAt as number).toBeGreaterThanOrEqual(REST);
  });

  it('stops waiting to be asked at the start of the stretch', () => {
    /*
     * A reader who flicks all the way up stops producing gestures. A beat still
     * waiting for one would hold the statements cleared for good -- and the pin
     * is held until the chapter finishes, so they would be stuck under an
     * overlay waiting for an input they have no reason to give.
     */
    const { releasedAt, stillClear } = replayReverse({
      gestureAt: [],
      seq: (frame) => (frame < 40 ? 0.5 : 0),
    });

    expect(stillClear).toBe(false);
    expect(releasedAt).not.toBeNull();
  });

  it('gives the wall its turn first, whatever the rest says', () => {
    /*
     * Ordering was never the problem and must not become one. While the wall is
     * anything other than fully gone, the statements stay out of its way even
     * with a gesture in hand and the rest long served.
     */
    const held = statementsHeldClear({
      positionWants: false,
      backgroundBusy: true,
      wasClear: true,
      seq: 0.5,
      armed: true,
      restedAt: 1,
      now: 1_000_000,
    });

    expect(held).toBe(true);
  });

  it('is not sticky for a beat that was never clear', () => {
    // Going down, before the clear has happened, this must stay out of the way.
    const held = statementsHeldClear({
      positionWants: false,
      backgroundBusy: false,
      wasClear: false,
      seq: 0.5,
      armed: false,
      restedAt: 0,
      now: 0,
    });

    expect(held).toBe(false);
  });

  it('treats the deadband at the start as the start', () => {
    expect(
      statementsHeldClear({
        positionWants: false,
        backgroundBusy: false,
        wasClear: true,
        seq: BEAT_DEADBAND,
        armed: false,
        restedAt: 1,
        now: BEAT_COOLDOWN_MS + 1,
      })
    ).toBe(false);
  });

  it('does not spend the reverse cooldown just because the reader reached the start', () => {
    expect(statementsHeldClear({
      positionWants: false, backgroundBusy: false, wasClear: true,
      seq: 0, armed: false, restedAt: 1, now: BEAT_COOLDOWN_MS,
    })).toBe(true);
  });
});
