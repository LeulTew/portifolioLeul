import { describe, it, expect } from 'vitest';
import {
  BEAT_DEADBAND,
  STATEMENT_CLEAR,
  statementsHeldClear,
} from './aboutBeats';
import { phaseGate } from '@/lib/motion/triggeredPhase';

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
  let ready = false;
  let releasedAt: number | null = null;
  const FRAME = 16.7;

  for (let frame = 0; frame < frames; frame++) {
    const now = frame * FRAME;
    const seq = typeof seqOption === 'function' ? seqOption(frame) : seqOption;
    const backgroundBusy = frame < busyFrames;

    if (gestureAt.includes(frame) && wasClear && ready) armed = true;

    // update(), in the order About.tsx runs it.
    if (backgroundBusy || !wasClear) {
      ready = false;
      armed = false;
    } else {
      ready = true;
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

  it('discards requests made before the background finishes', () => {
    const { releasedAt, stillClear } = replayReverse({ gestureAt: [0, 1, 2] });
    expect(stillClear).toBe(true);
    expect(releasedAt).toBeNull();
  });

  it('accepts the first request after completion without an extra pause', () => {
    const { releasedAt } = replayReverse({ gestureAt: [4] });
    expect(releasedAt).toBe(4 * 16.7);
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

  it('gives the wall its turn first, even with a reverse request', () => {
    /*
     * Ordering was never the problem and must not become one. While the wall is
     * anything other than fully gone, the statements stay out of its way even
     * with a gesture in hand.
     */
    const held = statementsHeldClear({
      positionWants: false,
      backgroundBusy: true,
      wasClear: true,
      seq: 0.5,
      armed: true,
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
      })
    ).toBe(false);
  });

  it('releases at the start immediately after the background finishes', () => {
    expect(statementsHeldClear({
      positionWants: false, backgroundBusy: false, wasClear: true,
      seq: 0, armed: false,
    })).toBe(false);
  });
});
