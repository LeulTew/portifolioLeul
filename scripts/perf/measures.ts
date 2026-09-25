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
  /** The world quality level the canvas publishes. */
  quality: string;
  /** About's furthest beat: statements, then its green rise, then Education. */
  about: string;
  /** The Education record settled for reading, '' while none is (entering, crossing, outside). */
  record: string;
}

export interface LongFrame {
  phase: Phase;
  ms: number;
  blocking: number;
  context: string;
  /** Milliseconds of the frame spent rendering: style, layout, paint. */
  render?: number;
  /** For a frame of 150ms or more, the script that took longest in it. */
  cause?: string;
}
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
 * Installed before the page's own scripts on every navigation. Reads the
 * reader's chapter on every sampled animation frame, and ten times a second
 * otherwise, and tags every long frame and interaction with it. `sample(true)`
 * times every animation frame until `sample(false)`; `enter(phase)` marks
 * where a part of the run begins.
 *
 * It reads rather than observes: an attribute MutationObserver on the
 * document makes every inline-style write on the page -- thousands a frame in
 * About's text animations -- look for observers, and the first version of this
 * probe tripled the journey's blocking time that way.
 */
export const PAGE_PROBE = String.raw`(() => {
  if (window.__budget) return;
  const trace = {
    phase: 'load', frames: [], intervals: [], events: [], checkpoints: [], unsupported: [],
    readyAt: null, fcp: null, lcp: null,
  };
  window.__budget = trace;
  const found = {};
  const find = selector => {
    const element = found[selector];
    if (element && element.isConnected) return element;
    return (found[selector] = document.querySelector(selector));
  };
  const read = (selector, name) => {
    const element = find(selector);
    return (element && element.getAttribute(name)) || '';
  };
  const state = () => ({
    section: read('[data-testid="page-footer"]', 'data-footer-section'),
    skills: read('[data-testid="skills-stage"]', 'data-phase'),
    skill: read('[data-testid="skills-stage"]', 'data-active-skill'),
    tv: read('[data-testid="projects-stage"]', 'data-phase'),
    quality: read('canvas[data-world-quality]', 'data-world-quality'),
    about: read('#about', 'data-education-active') === 'true' ? 'education'
      : read('#about', 'data-bg-settled') === 'true' ? 'green'
        : read('#about', 'data-statements-present') === 'true' ? 'statements' : '',
    record: read('[data-testid="education-stage"]', 'data-phase') === 'reading'
      ? read('[data-testid="education-stage"]', 'data-active-record') : '',
  });
  let current = state();
  const mark = () => {
    trace.checkpoints.push(Object.assign({ t: Math.round(performance.now()), phase: trace.phase }, current));
  };
  const record = () => {
    const next = state();
    if (next.section === current.section && next.skills === current.skills && next.skill === current.skill
      && next.tv === current.tv && next.quality === current.quality && next.about === current.about
      && next.record === current.record) return;
    current = next;
    mark();
  };
  const context = () => (current.section || '?')
    + (current.section === 'about' && current.about ? ' about:' + current.about : '')
    + (current.skills && current.skills !== 'outside' ? ' skills:' + current.skills : '')
    + (current.tv && current.tv !== 'outside' ? ' tv:' + current.tv : '')
    + (current.quality && current.quality !== '0' ? ' q' + current.quality : '');
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
    const frame = { phase: trace.phase, ms: entry.duration, blocking: entry.blockingDuration, context: context() };
    if (entry.renderStart) frame.render = Math.round(entry.startTime + entry.duration - entry.renderStart);
    if (entry.duration >= 150) {
      let top = null;
      for (const script of entry.scripts || []) if (!top || script.duration > top.duration) top = script;
      if (top) {
        frame.cause = [top.invokerType, top.sourceFunctionName || top.invoker,
          (top.sourceURL || '').split('/').pop() + ':' + top.sourceCharPosition, Math.round(top.duration) + 'ms'].join(' ');
      }
    }
    trace.frames.push(frame);
  });
  observe('event', entry => {
    if (entry.interactionId) trace.events.push({ phase: trace.phase, name: entry.name, ms: entry.duration });
  }, { durationThreshold: 16 });
  observe('paint', entry => {
    if (entry.name === 'first-contentful-paint') trace.fcp = Math.round(entry.startTime);
  });
  observe('largest-contentful-paint', entry => { trace.lcp = Math.round(entry.startTime); });

  setInterval(record, 100);

  const settle = now => {
    const hero = find('[data-testid="hero-content"]');
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
        record();
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

/** About's beats, in the order a forward journey sees them. */
export const ABOUT_BEATS = ['statements', 'green', 'education'] as const;

const collapse = (values: readonly string[]) => values.filter((value, index) => value && value !== values[index - 1]);

/**
 * The readable path a sample travelled, for its report: chapters, About's
 * beats and each Education record read, each Skills chapter read and the TV's phases.
 */
export function journeyPath(checkpoints: readonly Checkpoint[]): string[] {
  return collapse(checkpoints.filter(checkpoint => checkpoint.phase === 'journey').map(({ section, about, record, skills, skill, tv }) =>
    section + (section === 'about' && about ? `:${about}` : '') + (record ? `:record-${record}` : '')
      + (skills === 'reading' ? `:skill-${skill}` : '')
      + (tv && tv !== 'outside' ? `:tv-${tv}` : '')));
}

/**
 * Why a forward journey does not count, or nothing if it does: it has to pass
 * through every chapter in story order and end on Contact, see About's
 * statements, green rise and Education in turn, settle on every Education record
 * in order before Skills, read every Skills chapter in order, and reach the TV's
 * reader. Totals from a journey that skipped or reversed its costliest chapters
 * are not comparable (round 9, TECH-022); entering Education is not reading it
 * (TECH-028).
 */
export function checkJourney(checkpoints: readonly Checkpoint[], skillChapters: number, educationRecords: number): string[] {
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
  const beats = collapse(journey.map(checkpoint => checkpoint.about ?? ''));
  let beat = 0;
  for (const seen of beats) if (seen === ABOUT_BEATS[beat]) beat++;
  if (beat < ABOUT_BEATS.length) {
    failures.push(`About never reached its ${ABOUT_BEATS[beat]} beat (saw ${beats.join(' > ') || 'nothing'})`);
  }
  if (educationRecords < 1) failures.push('the page shows no Education records');
  const records = collapse(journey.map(checkpoint => checkpoint.record ?? '').filter(Boolean));
  const expectedRecords = Array.from({ length: educationRecords }, (_, index) => String(index));
  if (educationRecords >= 1 && records.join() !== expectedRecords.join()) {
    failures.push(`Education settled on ${records.join(' > ') || 'no record'}, not ${expectedRecords.join(' > ')}`);
  }
  const lastRecord = journey.reduce((last, checkpoint, index) => (checkpoint.record ? index : last), -1);
  const firstSkill = journey.findIndex(checkpoint => checkpoint.skills === 'reading');
  if (lastRecord >= 0 && firstSkill >= 0 && lastRecord > firstSkill) {
    failures.push('Education was still being read after Skills began');
  }
  if (skillChapters < 1) failures.push('the page shows no Skills chapters');
  const reads = collapse(journey.filter(checkpoint => checkpoint.skills === 'reading').map(checkpoint => checkpoint.skill));
  const expected = Array.from({ length: skillChapters }, (_, index) => String(index));
  if (skillChapters >= 1 && reads.join() !== expected.join()) {
    failures.push(`Skills read ${reads.join(' > ') || 'no chapter'}, not ${expected.join(' > ')}`);
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
  /** Where the worst frame fell, and what it was busy with. */
  worstContext: string;
  worstCause?: string;
  /** Long frames and blocking by chapter, to say where a failure happened. */
  contexts: Record<string, { longFrames: number; blockingMs: number }>;
}

export function summariseFrames(frames: readonly LongFrame[]): FrameSummary {
  const contexts: FrameSummary['contexts'] = {};
  let worst: LongFrame | undefined;
  for (const frame of frames) {
    const bucket = contexts[frame.context] ??= { longFrames: 0, blockingMs: 0 };
    bucket.longFrames += 1;
    bucket.blockingMs += Math.round(frame.blocking);
    if (!worst || frame.ms > worst.ms) worst = frame;
  }
  return {
    longFrames: frames.length,
    blockingMs: Math.round(frames.reduce((total, frame) => total + frame.blocking, 0)),
    worstFrameMs: Math.round(worst?.ms ?? 0),
    worstContext: worst?.context ?? '',
    ...(worst && (worst.cause || worst.render !== undefined)
      ? { worstCause: worst.cause ?? `rendering ${worst.render}ms` } : {}),
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
  /** The readable path the journey travelled (journeyPath), for auditing that it counted. */
  path: string[];
  /** Every checkpoint the probe recorded, the evidence behind `path` and `failures`. */
  checkpoints: Checkpoint[];
  startup: Startup;
  journey: FrameSummary & IntervalSummary & { seconds: number };
  parkedContact: FrameSummary;
  interaction: { worstEventMs: number; events: number };
  /** Reasons the sample cannot count, whatever its figures. */
  failures: string[];
}

export interface Budget { gate: Record<string, number>; target?: Record<string, number> }

type Measured = 'journey' | 'parkedContact' | 'interaction';

export interface BudgetConfig {
  viewport: { width: number; height: number };
  cpuThrottle: number;
  journeyTimeoutSeconds: number;
  contactSeconds: number;
  budgets: Record<Measured, Budget>;
  /**
   * Fresh-profile samples: the startup, and any figure an empty cache changes
   * -- a first-use shader compile lands in the journey as one long frame.
   */
  cold: Partial<Record<Measured, Budget>> & { startup: Budget };
}

/** The budgets a run is judged by: cold samples take the cold overrides and the startup budget. */
export function budgetsFor(config: BudgetConfig, cold: boolean): Record<string, Budget> {
  if (!cold) return config.budgets;
  const budgets: Record<string, Budget> = {};
  for (const [phase, budget] of Object.entries(config.budgets)) {
    const override = config.cold[phase as Measured];
    budgets[phase] = override
      ? { gate: { ...budget.gate, ...override.gate }, target: { ...budget.target, ...override.target } }
      : budget;
  }
  budgets.startup = config.cold.startup;
  return budgets;
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
  const section = (sample as unknown as Record<string, Record<string, unknown> | undefined>)[phase];
  const value = section?.[metric];
  return typeof value === 'number' ? value : Number.NaN;
};

/**
 * The run passes when every sample counts and the median of every gated
 * figure is within its gate. A figure that was not measured fails its gate;
 * the startup is only judged on cold samples, which have an empty cache.
 */
export function judge(config: BudgetConfig, samples: readonly Sample[], { cold }: { cold: boolean }) {
  const failures = samples.flatMap((sample, index) => sample.failures.map(failure => `sample ${index + 1}: ${failure}`));
  if (!samples.length) failures.push('no samples were taken');
  const rows: VerdictRow[] = [];
  for (const [phase, { gate, target }] of Object.entries(budgetsFor(config, cold))) {
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
