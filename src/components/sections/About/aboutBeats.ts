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
 * The heading-to-copy handoff also uses this authored, visible-frame rest.
 * The background and the title are two separate events, and without a gap they
 * do not read as two: the last cell lands and the heading is already
 * dissolving, so the pair arrives as one compound movement with a change of
 * subject in the middle. The rest is what lets the reader see the chapter turn
 * green, and then see it renamed.
 */
export const BEAT_REST_MS = 420;

/**
 * How long the chapter rests after a beat before it will take the next request,
 * including each statement handoff and their reverse. Boundary requests skip
 * only the gesture, never this cooldown; cancellable timers wake a stopped pin.
 *
 * The gesture requirement alone does not make the stages separate. A beat only
 * arms once the one before it has finished, but a reader spamming the wheel is
 * still producing gestures at that exact moment -- so the first one after the
 * flag lands arms the next beat instantly and the chain runs straight through
 * as one long movement, which is the thing the arming was added to prevent.
 *
 * Gestures inside this window are DISCARDED, not queued. Queuing them would
 * make spam work by simply arriving early, which is the same failure wearing a
 * delay. The reader has to ask again after the pause.
 *
 * Long enough to read as a beat landing and being let go of; short enough that
 * someone reading at a normal pace never notices they were held.
 */
export const BEAT_COOLDOWN_MS = 1200;

/**
 * The heading travelling from where the reader was looking to where it lives.
 *
 * The hero hands over by drawing a line down the page, and the head of that
 * line comes to rest in the middle of the screen. That is where the reader is
 * looking, so that is where the name of the section appears -- centred, on the
 * mark, with nothing else on screen competing with it.
 *
 * Then the reader scrolls, and the heading climbs to the corner it occupies for
 * the rest of the chapter. Only once it has arrived does anything else.
 *
 * This beat used not to exist. The heading was simply placed at its resting
 * position from the first frame, and `STATEMENT_LAYERS` starts statement one at
 * 0.07 -- three hundredths of the stretch after the heading's own ramp ends --
 * so the name and the first statement arrived within a few frames of each
 * other. Two things introducing themselves at once, neither of them read.
 */
export const HEAD_SETTLE: StatementBeat = {
  enter: 0.045,
  exit: round(0.045 - DEADBAND / 2),
  durationMs: 1100,
};

/**
 * Statement one arriving, once the heading has finished getting out of its way.
 *
 * Serialised on the heading rather than on a position of its own, for the
 * reason §4 of the choreography contract gives: the reader picks the speed, so
 * no gap between two thresholds is wide enough to keep them apart.
 *
 * No gesture of its own, unlike the beats further down the chapter. This one is
 * the answer to the heading landing -- the reader has already asked, by
 * scrolling the heading into place -- so it owes them the rest and then arrives.
 */
export const STATEMENT_ARRIVE: StatementBeat = {
  enter: round(TWO.start - TWO_FEATHER * 3),
  exit: round(TWO.start - TWO_FEATHER * 3 - DEADBAND),
  durationMs: 900,
};

export interface BeatRequest {
  readonly readyAt: number | null;
  readonly armed: boolean;
}

export const UNREQUESTED_BEAT: BeatRequest = { readyAt: null, armed: false };

/** A completion clock is reset whenever its prerequisite is no longer true. */
export function prepareBeatRequest(
  request: BeatRequest,
  ready: boolean,
  now: number
): BeatRequest {
  if (!ready) return UNREQUESTED_BEAT;
  return request.readyAt === null ? { readyAt: now, armed: false } : request;
}

/** Early gestures are discarded, never saved until a timer expires. */
export function askBeat(
  request: BeatRequest,
  now: number,
  cooldown = BEAT_COOLDOWN_MS
): BeatRequest {
  return request.readyAt !== null && now - request.readyAt >= cooldown
    ? { ...request, armed: true }
    : request;
}

export function beatRequested(
  request: BeatRequest,
  boundary: boolean,
  now: number,
  cooldown = BEAT_COOLDOWN_MS
): boolean {
  return request.readyAt !== null &&
    now - request.readyAt >= cooldown && (request.armed || boundary);
}

/** One cancellable wake instead of a frame loop during a stopped-reader rest. */
export function beatWakeDelay(
  requests: readonly { request: BeatRequest; cooldown?: number }[],
  now: number
): number | null {
  let delay = Infinity;
  for (const { request, cooldown = BEAT_COOLDOWN_MS } of requests) {
    if (request.readyAt === null) continue;
    const remaining = request.readyAt + cooldown - now;
    if (remaining > 0) delay = Math.min(delay, remaining);
  }
  return Number.isFinite(delay) ? Math.max(1, delay) : null;
}

/**
 * Whether the statements are still held out of the chapter's way.
 *
 * The way down is a chain of separate movements, each one the reader's to call
 * for: the statements clear, and then the wall waits for a gesture and a rest
 * before it rises. Measured on the way back up, the wall finished retreating
 * and the statements began walking in 10ms later, against 3131ms between the
 * same two beats going down. The order was right and the pacing was not, so the
 * last two movements of the reverse read as one.
 *
 * This is rule 5 in the other direction. `backgroundBusy` keeps the ordering --
 * the green goes first, and uncovers the empty screen it rose onto -- and then
 * the reader has to ask again, and be made to wait once more before the ask
 * counts. A gesture that arrives during the rest is discarded rather than
 * queued, so spamming the wheel upward buys nothing.
 *
 * `seq` past the start of the stretch is the escape, and it is the same one the
 * forward beats have at the far end: a reader who flicks all the way up stops
 * producing gestures, and a beat still waiting for one would leave the
 * statements cleared for good -- with the pin held until the chapter finishes,
 * which it then never would. Reaching the start IS the request.
 */
export function statementsHeldClear(input: {
  /** What the position gate alone wants. */
  positionWants: boolean;
  /** The wall is up, or still on its way up or down. */
  backgroundBusy: boolean;
  /** Last frame's answer, because this beat is sticky on the way out. */
  wasClear: boolean;
  /** Where the reader is in the held stretch. */
  seq: number;
  /** An upward gesture has arrived since the rest was served. */
  armed: boolean;
  /** When the wall finished retreating; 0 while it has not. */
  restedAt: number;
  now: number;
}): boolean {
  if (input.positionWants || input.backgroundBusy) return true;
  if (!input.wasClear) return false;
  const rested =
    input.restedAt > 0 && input.now - input.restedAt >= BEAT_COOLDOWN_MS;
  return !((input.armed || input.seq <= BEAT_DEADBAND) && rested);
}
