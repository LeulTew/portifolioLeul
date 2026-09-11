import { STATEMENT_LAYERS } from './statementLayers';

/**
 * Every beat the About section is played by.
 *
 * Both are derived from the `two` window in `STATEMENT_LAYERS` rather than
 * written out again here, because that window is what the choreography is
 * authored against and what the section's tests assert on. A beat that carried
 * its own copy of the numbers could drift from the window it is supposed to be
 * performing, silently -- which is exactly how the exit came to be missing in
 * the first place: the window declared it, and nothing played it.
 *
 * Its own module, and not constants beside the components, so that they export
 * only components and fast refresh keeps working.
 */

const TWO = STATEMENT_LAYERS.find((layer) => layer.name === 'two')!;
const TWO_FEATHER = TWO.feather ?? 0.09;

/** Deadband below each trigger, so a beat cannot chatter on its own edge. */
export const BEAT_DEADBAND = 0.05;
const DEADBAND = BEAT_DEADBAND;

const round = (value: number) => Number(value.toFixed(3));

export interface StatementBeat {
  /** Position that starts the beat. */
  readonly enter: number;
  /** Position that lets it back off. Always below `enter`. */
  readonly exit: number;
  /** How long it takes, once started, regardless of how it was reached. */
  readonly durationMs: number;
}

/**
 * Where the two statements hand over.
 *
 * Statement one ramps out across 0.38 to 0.46 while statement two ramps in over
 * the same span, so the midpoint of the `two` window's entry ramp is what the
 * composition is built around.
 */
export const STATEMENT_SWAP: StatementBeat = {
  enter: round(TWO.start + TWO_FEATHER / 2),
  exit: round(TWO.start + TWO_FEATHER / 2 - DEADBAND),
  durationMs: 800,
};

/**
 * Where statement two leaves, so the background has an empty screen to rise on.
 *
 * `STATEMENT_LAYERS` has always said statement two ends at 0.78 on an 0.08 ramp
 * -- the same 0.78 the background transition starts at -- but that ramp never
 * drove anything. `PinnedSequence` publishes the window as `--two-in` /
 * `--two-on` on the overlay, and `StatementsContainer` writes the same two
 * properties onto `.statements`, which is a descendant: the nearer declaration
 * wins, so the exit was shadowed dead on arrival. What the component wrote in
 * its place was the handover alone, and a handover only ever runs 0 -> 1, so
 * `--two-on` reached 1 and stayed there -- statement two sat on top of the
 * rising green and then on top of the Education frame.
 *
 * Shorter than the handover: this one has nothing to hand over to, and the
 * background is waiting behind it.
 */
export const STATEMENT_CLEAR: StatementBeat = {
  enter: round(TWO.end - TWO_FEATHER),
  exit: round(TWO.end - TWO_FEATHER - DEADBAND),
  durationMs: 600,
};

/** The span the exit is spread over, used by the position-mapped fallbacks. */
export const STATEMENT_CLEAR_SPAN = TWO_FEATHER;

/**
 * The background rise, and the writing of the title.
 *
 * Here rather than as literals in the components' prop defaults, because three
 * separate places need to agree about them: the two components that play them,
 * and the cases that assert they run in order and do not overlap. A test
 * carrying its own transcription of a duration is a test that goes on passing
 * after the duration changes -- which is exactly what happened when the rise
 * went from 1200ms to 1500ms and the ordering cases kept asserting against
 * 1200.
 *
 * `exit` sits a deadband below `enter` on both, so a reader resting on the
 * threshold cannot chatter the beat.
 */
export const BACKGROUND_RISE: StatementBeat = {
  enter: 0.78,
  exit: round(0.78 - DEADBAND),
  durationMs: 1500,
};

export const TITLE_WRITE: StatementBeat = {
  enter: 0.86,
  exit: round(0.86 - DEADBAND),
  durationMs: 1500,
};

/**
 * The pause between one beat finishing and the next being allowed to start.
 *
 * The background and the title are two separate events, and without a gap they
 * do not read as two: the last cell lands and the heading is already
 * dissolving, so the pair arrives as one compound movement with a change of
 * subject in the middle. The rest is what lets the reader see the chapter turn
 * green, and then see it renamed.
 */
export const BEAT_REST_MS = 420;
