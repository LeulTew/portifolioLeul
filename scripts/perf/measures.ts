/**
 * What the performance budget measures and how it judges a run.
 *
 * Round 8 (TECH-002, TECH-015): the first gate counted long frames over a
 * fixed stretch of wheeling and passed a journey that never left Home, since
 * nothing asked where the reader got to; and its cold mode reused one warmed
 * profile. Now each sample records the chapters it passed through and only
 * counts once the whole story has been travelled, Home to a usable Contact,
 * without a page error; cold samples each get a fresh profile and a startup
 * figure; and every frame is timed, not only the long ones.
 */

export class UsageError extends Error {}

export interface BudgetOptions {
  runs: number;
  cold: boolean;
  headed: boolean;
  chrome: string | undefined;
  /** An origin to measure instead of the owned preview of `dist`. */
  url: string | undefined;
  port: number;
}

const VALUE_FLAGS = new Set(['runs', 'port', 'chrome', 'url']);
const SWITCHES = new Set(['cold', 'headed']);

export function parseOptions(argv: readonly string[], env: Record<string, string | undefined> = {}): BudgetOptions {
  const values = new Map<string, string | true>();
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    const name = /^--([a-z]+)$/.exec(argument)?.[1];
    if (!name || (!VALUE_FLAGS.has(name) && !SWITCHES.has(name))) throw new UsageError(`Unknown argument: ${argument}`);
    if (values.has(name)) throw new UsageError(`--${name} was given twice`);
    if (SWITCHES.has(name)) {
      values.set(name, true);
      continue;
    }
    const value = argv[++index];
    if (value === undefined || value.startsWith('--')) throw new UsageError(`--${name} needs a value`);
    values.set(name, value);
  }
  const whole = (name: string, fallback: number, min: number, max: number) => {
    const raw = values.get(name);
    if (raw === undefined) return fallback;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < min || value > max) {
      throw new UsageError(`--${name} must be a whole number from ${min} to ${max}, not ${String(raw)}`);
    }
    return value;
  };
  const url = values.get('url') as string | undefined;
  if (url !== undefined) {
    let protocol = '';
    try { protocol = new URL(url).protocol; } catch { /* reported below */ }
    if (protocol !== 'http:' && protocol !== 'https:') throw new UsageError(`--url must be an http(s) origin, not ${url}`);
    if (values.has('port')) throw new UsageError('--port sets the owned preview; it does not apply with --url');
  }
  return {
    runs: whole('runs', 3, 1, 15),
    port: whole('port', 4319, 1024, 65_535),
    cold: values.has('cold'),
    headed: values.has('headed'),
    chrome: (values.get('chrome') as string | undefined) ?? env.CHROME_PATH,
    url: url?.replace(/\/+$/, ''),
  };
}

/** The part of the run a figure belongs to. */
export type Phase = 'load' | 'settle' | 'journey' | 'contact' | 'interaction' | 'done';

export interface Checkpoint {
  /** Milliseconds since navigation. */
  t: number;
  phase: Phase;
  /** The footer's chapter: home, about, skills, projects or contact. */
  section: string;
  /** The Skills stage's phase and chapter. */
  skills: string;
  skill: string;
  /** The TV's phase. */
  tv: string;
}

export interface LongFrame { phase: Phase; ms: number; blocking: number; context: string }
export interface TimedEvent { phase: Phase; name: string; ms: number }

/** What the in-page probe hands back. */
export interface PageTrace {
  frames: LongFrame[];
  /** Milliseconds between consecutive animation frames while sampling. */
  intervals: number[];
  events: TimedEvent[];
  checkpoints: Checkpoint[];
  /** Performance entry types the browser does not report. */
  unsupported: string[];
  /** When the hero settled, in milliseconds since navigation. */
  readyAt: number | null;
  fcp: number | null;
  lcp: number | null;
}

/**
 * Installed before the page's own scripts on every navigation. Records the
 * reader's chapter on each change -- attribute mutations as they happen, and a
 * slow poll for elements that arrive with their attributes already set -- and
 * tags every long frame and interaction with it. `sample(true)` times every
 * animation frame until `sample(false)`; `enter(phase)` marks where a part of
 * the run begins.
 */
export const PAGE_PROBE = String.raw`(() => {
  if (window.__budget) return;
  const trace = {
    phase: 'load', frames: [], intervals: [], events: [], checkpoints: [], unsupported: [],
    readyAt: null, fcp: null, lcp: null,
  };
  window.__budget = trace;
  const query = selector => document.querySelector(selector);
  const read = (element, name) => (element && element.getAttribute(name)) || '';
  const state = () => {
    const skills = query('[data-testid="skills-stage"]');
    return {
      section: read(query('[data-testid="page-footer"]'), 'data-footer-section'),
      skills: read(skills, 'data-phase'),
      skill: read(skills, 'data-active-skill'),
      tv: read(query('[data-testid="projects-stage"]'), 'data-phase'),
    };
  };
  let current = state();
  const mark = () => {
    trace.checkpoints.push(Object.assign({ t: Math.round(performance.now()), phase: trace.phase }, current));
  };
  const record = () => {
    const next = state();
    if (next.section === current.section && next.skills === current.skills
      && next.skill === current.skill && next.tv === current.tv) return;
    current = next;
    mark();
  };
  const context = () => (current.section || '?')
    + (current.skills && current.skills !== 'outside' ? ' skills:' + current.skills : '')
    + (current.tv && current.tv !== 'outside' ? ' tv:' + current.tv : '');
  const observe = (type, callback, extra) => {
    const types = typeof PerformanceObserver === 'function' ? PerformanceObserver.supportedEntryTypes || [] : [];
    if (!types.includes(type)) {
      trace.unsupported.push(type);
      return;
    }
    new PerformanceObserver(list => list.getEntries().forEach(callback))
      .observe(Object.assign({ type, buffered: true }, extra));
  };
  observe('long-animation-frame', entry => {
    trace.frames.push({ phase: trace.phase, ms: entry.duration, blocking: entry.blockingDuration, context: context() });
  });
  observe('event', entry => {
    if (entry.interactionId) trace.events.push({ phase: trace.phase, name: entry.name, ms: entry.duration });
  }, { durationThreshold: 16 });
  observe('paint', entry => {
    if (entry.name === 'first-contentful-paint') trace.fcp = Math.round(entry.startTime);
  });
  observe('largest-contentful-paint', entry => { trace.lcp = Math.round(entry.startTime); });

  new MutationObserver(record).observe(document, {
    subtree: true, attributes: true, attributeFilter: ['data-footer-section', 'data-phase', 'data-active-skill'],
  });
  setInterval(record, 250);

  const settle = now => {
    const hero = query('[data-testid="hero-content"]');
    if (hero && /settled/.test(hero.className)) {
      trace.readyAt = Math.round(now);
      return;
    }
    requestAnimationFrame(settle);
  };
  requestAnimationFrame(settle);

  let generation = 0;
  Object.defineProperties(trace, {
    sample: { value: on => {
      const mine = ++generation;
      if (!on) return;
      let last = 0;
      const tick = now => {
        if (mine !== generation) return;
        if (last) trace.intervals.push(Math.round((now - last) * 10) / 10);
        last = now;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    } },
    enter: { value: phase => {
      trace.phase = phase;
      current = state();
      mark();
    } },
  });
})()`;

/** The chapters of the story, in the order a forward journey reads them. */
export const STORY = ['home', 'about', 'skills', 'projects', 'contact'] as const;

const collapse = (values: readonly string[]) => values.filter((value, index) => value && value !== values[index - 1]);

/**
 * Why a forward journey does not count, or nothing if it does: it has to pass
 * through every chapter in story order and end on Contact, settle on every
 * Skills chapter, and reach the TV's reader.
 */
export function checkJourney(checkpoints: readonly Checkpoint[], skillChapters: number): string[] {
  const journey = checkpoints.filter(checkpoint => checkpoint.phase === 'journey');
  const sections = collapse(journey.map(checkpoint => checkpoint.section));
  const failures: string[] = [];
  let reached = 0;
  for (const section of sections) if (section === STORY[reached]) reached++;
  if (reached < STORY.length) {
    failures.push(`the journey never reached ${STORY[reached]} (passed ${sections.join(' > ') || 'nothing'})`);
  } else if (sections.at(-1) !== 'contact') {
    failures.push(`the journey ended on ${sections.at(-1)}, not Contact`);
  }
  if (skillChapters < 1) failures.push('the page shows no Skills chapters');
  const read = new Set(journey.filter(checkpoint => checkpoint.skills === 'reading').map(checkpoint => checkpoint.skill));
  if (skillChapters >= 1 && read.size < skillChapters) {
    failures.push(`Skills settled on ${read.size} of ${skillChapters} chapters`);
  }
  if (!journey.some(checkpoint => checkpoint.tv === 'reading')) failures.push("the TV never reached its reader");
  return failures;
}

/** Nearest-rank percentile; NaN for no values. */
export function percentile(values: readonly number[], share: number): number {
  if (!values.length) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(share * sorted.length) - 1))];
}

/** The lower middle, so a median of an even count is a measured value. */
export const median = (values: readonly number[]) => percentile(values, 0.5);

export interface FrameSummary {
  longFrames: number;
  blockingMs: number;
  worstFrameMs: number;
  /** Long frames and blocking by chapter, to say where a failure happened. */
  contexts: Record<string, { longFrames: number; blockingMs: number }>;
}

export function summariseFrames(frames: readonly LongFrame[]): FrameSummary {
  const contexts: FrameSummary['contexts'] = {};
  for (const frame of frames) {
    const bucket = contexts[frame.context] ??= { longFrames: 0, blockingMs: 0 };
    bucket.longFrames += 1;
    bucket.blockingMs += Math.round(frame.blocking);
  }
  return {
    longFrames: frames.length,
    blockingMs: Math.round(frames.reduce((total, frame) => total + frame.blocking, 0)),
    worstFrameMs: Math.round(Math.max(0, ...frames.map(frame => frame.ms))),
    contexts,
  };
}

/** A frame that took over one and a half 60 Hz periods missed its display refresh. */
export const MISSED_FRAME_MS = 25;

export interface IntervalSummary {
  frames: number;
  p50FrameMs: number;
  p95FrameMs: number;
  p99FrameMs: number;
  missedFramePercent: number;
}

export function summariseIntervals(intervals: readonly number[]): IntervalSummary {
  const missed = intervals.filter(interval => interval > MISSED_FRAME_MS).length;
  return {
    frames: intervals.length,
    p50FrameMs: percentile(intervals, 0.5),
    p95FrameMs: percentile(intervals, 0.95),
    p99FrameMs: percentile(intervals, 0.99),
    missedFramePercent: intervals.length ? Math.round((missed / intervals.length) * 1000) / 10 : Number.NaN,
  };
}

export interface Startup {
  readyMs: number | null;
  fcpMs: number | null;
  lcpMs: number | null;
  transferKb: number;
  longFrames: number;
  blockingMs: number;
}

export interface Sample {
  /** How the caches stood when the sample was taken. */
  cache: string;
  startup: Startup;
  journey: FrameSummary & IntervalSummary & { seconds: number };
  parkedContact: FrameSummary;
  interaction: { worstEventMs: number; events: number };
  /** Reasons the sample cannot count, whatever its figures. */
  failures: string[];
}

export interface Budget { gate: Record<string, number>; target?: Record<string, number> }

export interface BudgetConfig {
  viewport: { width: number; height: number };
  cpuThrottle: number;
  journeyTimeoutSeconds: number;
  contactSeconds: number;
  budgets: Record<'journey' | 'parkedContact' | 'interaction' | 'coldStartup', Budget>;
}

export interface VerdictRow {
  phase: string;
  metric: string;
  value: number;
  gate: number;
  pass: boolean;
  target: number | undefined;
  onTarget: boolean;
}

const metricOf = (sample: Sample, phase: string, metric: string): number => {
  const section = phase === 'coldStartup' ? sample.startup : (sample as unknown as Record<string, Record<string, unknown>>)[phase];
  const value = section?.[metric as keyof typeof section];
  return typeof value === 'number' ? value : Number.NaN;
};

/**
 * The run passes when every sample counts and the median of every gated
 * figure is within its gate. A figure that was not measured fails its gate;
 * cold startup is only judged on cold samples, which have an empty cache.
 */
export function judge(config: BudgetConfig, samples: readonly Sample[], { cold }: { cold: boolean }) {
  const failures = samples.flatMap((sample, index) => sample.failures.map(failure => `sample ${index + 1}: ${failure}`));
  if (!samples.length) failures.push('no samples were taken');
  const rows: VerdictRow[] = [];
  for (const [phase, { gate, target }] of Object.entries(config.budgets)) {
    if (phase === 'coldStartup' && !cold) continue;
    for (const [metric, limit] of Object.entries(gate)) {
      const values = samples.map(sample => metricOf(sample, phase, metric));
      const value = values.length && values.every(Number.isFinite) ? median(values) : Number.NaN;
      const pass = Number.isFinite(value) && value <= limit;
      if (!pass) failures.push(`${phase} ${metric}: ${Number.isFinite(value) ? value : 'not measured'} over the gate of ${limit}`);
      rows.push({ phase, metric, value, gate: limit, pass, target: target?.[metric], onTarget: pass && value <= (target?.[metric] ?? Infinity) });
    }
  }
  return { pass: failures.length === 0, failures, rows };
}
