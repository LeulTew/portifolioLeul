import { describe, expect, it } from 'vitest';
import {
  ABOUT_BEATS, STORY, budgetsFor, checkJourney, journeyPath, judge, parseOptions, percentile, summariseFrames,
  summariseIntervals, type BudgetConfig, type Checkpoint, type Sample,
} from './measures';

describe('options', () => {
  it('defaults to three returning-visit samples of the owned preview', () => {
    expect(parseOptions([], {})).toEqual({
      runs: 3, port: 4319, cold: false, headed: false, chrome: undefined, url: undefined,
    });
    expect(parseOptions(['--cold', '--runs', '5', '--chrome', 'C:/chrome.exe'], {})).toMatchObject({ cold: true, runs: 5, chrome: 'C:/chrome.exe' });
    expect(parseOptions(['--url', 'https://example.test/'], { CHROME_PATH: '/usr/bin/chromium' }))
      .toMatchObject({ url: 'https://example.test', chrome: '/usr/bin/chromium' });
  });

  it.each([
    [['--runs', '0'], 'whole number from 1 to 15'],
    [['--runs', '2.5'], 'whole number'],
    [['--runs', 'three'], 'whole number'],
    [['--runs', '16'], 'whole number'],
    [['--port', '80'], 'from 1024 to 65535'],
    [['--port', '70000'], 'from 1024'],
    [['--runs'], 'needs a value'],
    [['--runs', '--cold'], 'needs a value'],
    [['--cold', '--cold'], 'given twice'],
    [['--fast'], 'Unknown argument'],
    [['3'], 'Unknown argument'],
    [['--url', 'ftp://example.test'], 'http(s) origin'],
    [['--url', 'not a url'], 'http(s) origin'],
    [['--url', 'http://example.test', '--port', '5000'], 'does not apply with --url'],
  ])('rejects %j', (argv, reason) => {
    expect(() => parseOptions(argv as string[], {})).toThrow(reason);
  });
});

const at = (phase: Checkpoint['phase'], section: string, extra: Partial<Checkpoint> = {}): Checkpoint =>
  ({ t: 0, phase, section, skills: 'outside', skill: '0', tv: 'outside', quality: '0', about: '', ...extra });

const chapters = (count: number) => Array.from({ length: count }, (_, index) => String(index));

/** A forward journey through the whole story, as the probe records one. */
function completeJourney(read = chapters(6)): Checkpoint[] {
  return [
    at('load', 'home'),
    at('journey', 'home'),
    at('journey', 'about', { about: 'statements' }),
    at('journey', 'about'),
    at('journey', 'about', { about: 'green' }),
    at('journey', 'about', { about: 'education' }),
    at('journey', 'skills', { skills: 'entering', about: 'green' }),
    ...read.map(skill => at('journey', 'skills', { skills: 'reading', skill, about: 'green' })),
    at('journey', 'skills', { skills: 'leaving', tv: 'withdrawing' }),
    at('journey', 'projects', { tv: 'approaching' }),
    at('journey', 'projects', { tv: 'reading' }),
    at('journey', 'projects', { tv: 'departing' }),
    at('journey', 'contact'),
  ];
}

describe('the journey a sample must have travelled', () => {
  it('accepts the whole story, Home to Contact', () => {
    expect(STORY).toEqual(['home', 'about', 'skills', 'projects', 'contact']);
    expect(ABOUT_BEATS).toEqual(['statements', 'green', 'education']);
    expect(checkJourney(completeJourney(), 6)).toEqual([]);
  });

  it('rejects a journey that never left Home', () => {
    // Round 8 (TECH-002): wheeling a Home that ignored every notch passed all six gates.
    const failures = checkJourney([at('load', 'home'), at('journey', 'home')], 6);
    expect(failures).toContain('the journey never reached about (passed home)');
    expect(failures).toContain('About never reached its statements beat (saw nothing)');
    expect(failures).toContain('Skills read no chapter, not 0 > 1 > 2 > 3 > 4 > 5');
    expect(failures).toContain('the TV never reached its reader');
  });

  it('rejects one that stops short of Contact, or ends anywhere else', () => {
    const short = completeJourney().slice(0, -1);
    expect(checkJourney(short, 6)).toEqual(['the journey never reached contact (passed home > about > skills > projects)']);
    const bounced = [...completeJourney(), at('journey', 'projects', { tv: 'reading' })];
    expect(checkJourney(bounced, 6)).toEqual(['the journey ended on projects, not Contact']);
  });

  it('rejects one that passed through About without its green rise or Education', () => {
    // Round 9 (TECH-022): About is the costliest chapter; a journey that skipped its beats measured less.
    const flat = completeJourney().map(checkpoint => ({ ...checkpoint, about: '' }));
    expect(checkJourney(flat, 6)).toEqual(['About never reached its statements beat (saw nothing)']);
    const early = completeJourney().map(checkpoint => (checkpoint.about === 'education' ? { ...checkpoint, about: 'green' } : checkpoint));
    expect(checkJourney(early, 6)).toEqual(['About never reached its education beat (saw statements > green)']);
    const unwritten = completeJourney().filter(checkpoint => checkpoint.about !== 'statements');
    expect(checkJourney(unwritten, 6)[0]).toBe('About never reached its statements beat (saw green > education > green)');
  });

  it('rejects one that skipped, repeated or reordered Skills chapters, or never read the TV', () => {
    expect(checkJourney(completeJourney(chapters(4)), 6)).toEqual(['Skills read 0 > 1 > 2 > 3, not 0 > 1 > 2 > 3 > 4 > 5']);
    // The set of chapters read is complete in both; the order is not.
    expect(checkJourney(completeJourney(['0', '2', '1', '3', '4', '5']), 6))
      .toEqual(['Skills read 0 > 2 > 1 > 3 > 4 > 5, not 0 > 1 > 2 > 3 > 4 > 5']);
    expect(checkJourney(completeJourney(['0', '1', '0', '1', '2', '3', '4', '5']), 6)).toHaveLength(1);
    const dark = completeJourney().map(checkpoint => (checkpoint.tv === 'reading' ? { ...checkpoint, tv: 'framed' } : checkpoint));
    expect(checkJourney(dark, 6)).toEqual(['the TV never reached its reader']);
    expect(checkJourney(completeJourney(), 0)).toContain('the page shows no Skills chapters');
  });

  it('counts only what happened while the journey was measured', () => {
    const outside = completeJourney().map(checkpoint => ({ ...checkpoint, phase: 'settle' as const }));
    expect(checkJourney(outside, 6)[0]).toBe('the journey never reached home (passed nothing)');
  });

  it('reads the path a sample travelled back for its report', () => {
    expect(journeyPath(completeJourney(chapters(2)))).toEqual([
      'home', 'about:statements', 'about', 'about:green', 'about:education', 'skills',
      'skills:skill-0', 'skills:skill-1', 'skills:tv-withdrawing', 'projects:tv-approaching',
      'projects:tv-reading', 'projects:tv-departing', 'contact',
    ]);
  });
});

describe('figures', () => {
  it('takes nearest-rank percentiles and the lower median', () => {
    expect(percentile([5, 1, 4, 2, 3], 0.5)).toBe(3);
    expect(percentile([1, 2, 3, 4], 0.5)).toBe(2);
    expect(percentile([16.7, 16.6, 50, 16.7], 0.95)).toBe(50);
    expect(percentile([], 0.5)).toBeNaN();
  });

  it('sums long frames by chapter', () => {
    const summary = summariseFrames([
      { phase: 'journey', ms: 120, blocking: 70.4, context: 'about' },
      { phase: 'journey', ms: 90, blocking: 40.2, context: 'about' },
      { phase: 'journey', ms: 60, blocking: 10, context: 'projects tv:reading' },
    ]);
    expect(summary).toEqual({
      longFrames: 3, blockingMs: 121, worstFrameMs: 120, worstContext: 'about',
      contexts: { about: { longFrames: 2, blockingMs: 110 }, 'projects tv:reading': { longFrames: 1, blockingMs: 10 } },
    });
  });

  it('counts a frame that missed its refresh', () => {
    const intervals = [...Array.from({ length: 96 }, () => 16.7), 33.3, 33.4, 50, 24.9];
    expect(summariseIntervals(intervals)).toEqual({
      frames: 100, p50FrameMs: 16.7, p95FrameMs: 16.7, p99FrameMs: 33.4, missedFramePercent: 3,
    });
    expect(summariseIntervals([]).missedFramePercent).toBeNaN();
  });
});

const config: BudgetConfig = {
  viewport: { width: 1440, height: 900 },
  cpuThrottle: 4,
  journeyTimeoutSeconds: 150,
  contactSeconds: 10,
  budgets: {
    journey: { gate: { longFrames: 110, p95FrameMs: 34, worstFrameMs: 400 }, target: { longFrames: 20, p95FrameMs: 17 } },
    parkedContact: { gate: { longFrames: 2 } },
    interaction: { gate: { worstEventMs: 200 } },
  },
  cold: {
    journey: { gate: { worstFrameMs: 1500 }, target: { worstFrameMs: 400 } },
    startup: { gate: { readyMs: 12_000, transferKb: 6000 } },
  },
};

function sample(overrides: { longFrames?: number; failures?: string[]; readyMs?: number | null } = {}): Sample {
  const frames = { longFrames: overrides.longFrames ?? 40, blockingMs: 800, worstFrameMs: 150, worstContext: 'about', contexts: {} };
  return {
    cache: 'test',
    path: [],
    checkpoints: [],
    startup: { readyMs: overrides.readyMs === undefined ? 9000 : overrides.readyMs, fcpMs: 800, lcpMs: 1200, transferKb: 4000, longFrames: 5, blockingMs: 300 },
    journey: { ...frames, frames: 3000, p50FrameMs: 16.7, p95FrameMs: 20, p99FrameMs: 40, missedFramePercent: 2, seconds: 70 },
    parkedContact: { longFrames: 0, blockingMs: 0, worstFrameMs: 0, worstContext: '', contexts: {} },
    interaction: { worstEventMs: 48, events: 2 },
    failures: overrides.failures ?? [],
  };
}

describe('the verdict', () => {
  it('passes complete journeys whose medians are within every gate', () => {
    const verdict = judge(config, [sample({ longFrames: 30 }), sample({ longFrames: 200 }), sample({ longFrames: 50 })], { cold: false });
    expect(verdict.pass).toBe(true);
    expect(verdict.rows.find(row => row.metric === 'longFrames' && row.phase === 'journey'))
      .toMatchObject({ value: 50, gate: 110, pass: true, target: 20, onTarget: false });
    expect(verdict.rows.some(row => row.phase === 'startup')).toBe(false);
  });

  it('fails a stalled journey even though it measured no long frames at all', () => {
    const stalled = sample({ longFrames: 0, failures: ['the journey never reached about (passed home)'] });
    const verdict = judge(config, [stalled, stalled, stalled], { cold: false });
    expect(verdict.rows.every(row => row.pass)).toBe(true);
    expect(verdict.pass).toBe(false);
    expect(verdict.failures).toContain('sample 1: the journey never reached about (passed home)');
  });

  it('fails a figure that was not measured, and a run with no samples', () => {
    const verdict = judge(config, [sample(), sample({ readyMs: null }), sample()], { cold: true });
    expect(verdict.rows.find(row => row.metric === 'readyMs')).toMatchObject({ pass: false });
    expect(verdict.failures).toContain('startup readyMs: not measured over the gate of 12000');
    expect(judge(config, [], { cold: false }).failures).toContain('no samples were taken');
  });

  it('judges startup only for cold samples', () => {
    const slow = sample({ readyMs: 20_000 });
    expect(judge(config, [slow], { cold: false }).pass).toBe(true);
    expect(judge(config, [slow], { cold: true }).failures).toContain('startup readyMs: 20000 over the gate of 12000');
  });

  it('gives cold samples their own allowance only where an empty cache changes the figure', () => {
    const warm = budgetsFor(config, false);
    const cold = budgetsFor(config, true);
    expect(warm).toBe(config.budgets);
    expect(cold.journey).toEqual({
      gate: { longFrames: 110, p95FrameMs: 34, worstFrameMs: 1500 },
      target: { longFrames: 20, p95FrameMs: 17, worstFrameMs: 400 },
    });
    expect(cold.parkedContact).toBe(config.budgets.parkedContact);
    expect(cold.startup).toBe(config.cold.startup);
  });
});
