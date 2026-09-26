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
  ({ t: 0, phase, section, skills: 'outside', skill: '0', tv: 'outside', quality: '0', about: '', record: '', ...extra });

const chapters = (count: number) => Array.from({ length: count }, (_, index) => String(index));
/** The journey judged against six Skills chapters and three Education records. */
const check = (checkpoints: Checkpoint[], skills = 6, records = 3) => checkJourney(checkpoints, skills, records);

/** A forward journey through the whole story, as the probe records one. */
function completeJourney(read = chapters(6), records = chapters(3)): Checkpoint[] {
  return [
    at('load', 'home'),
    at('journey', 'home'),
    at('journey', 'about', { about: 'statements' }),
    at('journey', 'about'),
    at('journey', 'about', { about: 'green' }),
    at('journey', 'about', { about: 'education' }),
    ...records.flatMap(record => [
      at('journey', 'about', { about: 'education', record }),
      at('journey', 'about', { about: 'education' }),
    ]),
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
    expect(check(completeJourney())).toEqual([]);
  });

  it('rejects a journey that never left Home', () => {
    // Round 8 (TECH-002): wheeling a Home that ignored every notch passed all six gates.
    const failures = check([at('load', 'home'), at('journey', 'home')]);
    expect(failures).toContain('the journey never reached about (passed home)');
    expect(failures).toContain('About never reached its statements beat (saw nothing)');
    expect(failures).toContain('Education settled on no record, not 0 > 1 > 2');
    expect(failures).toContain('Skills read no chapter, not 0 > 1 > 2 > 3 > 4 > 5');
    expect(failures).toContain('the TV never reached its reader on the way from Skills to Contact');
  });

  it('rejects one that stops short of Contact, or ends anywhere else', () => {
    const short = completeJourney().slice(0, -1);
    expect(check(short)).toEqual(['the journey never reached contact (passed home > about > skills > projects)']);
    const bounced = [...completeJourney(), at('journey', 'projects', { tv: 'reading' })];
    expect(check(bounced)).toEqual(['the journey went back from contact to projects', 'the journey ended on projects, not Contact']);
  });

  it('rejects one that passed through About without its green rise or Education', () => {
    // Round 9 (TECH-022): About is the costliest chapter; a journey that skipped its beats measured less.
    const flat = completeJourney(chapters(6), []).map(checkpoint => ({ ...checkpoint, about: '' }));
    expect(check(flat)).toEqual([
      'About never reached its statements beat (saw nothing)', 'Education settled on no record, not 0 > 1 > 2',
    ]);
    const early = completeJourney(chapters(6), []).map(checkpoint => (checkpoint.about === 'education' ? { ...checkpoint, about: 'green' } : checkpoint));
    expect(check(early)[0]).toBe('About never reached its education beat (saw statements > green)');
    const unwritten = completeJourney().filter(checkpoint => checkpoint.about !== 'statements');
    expect(check(unwritten)[0]).toBe('About never reached its statements beat (saw green > education)');
  });

  it('rejects one that entered Education without settling on each record in order, before Skills', () => {
    // Round 9 (TECH-028): entering Education for a moment and skipping every record passed.
    expect(check(completeJourney(chapters(6), []))).toEqual(['Education settled on no record, not 0 > 1 > 2']);
    expect(check(completeJourney(chapters(6), ['0', '2']))).toEqual(['Education settled on 0 > 2, not 0 > 1 > 2']);
    expect(check(completeJourney(chapters(6), ['0', '2', '1']))).toEqual(['Education settled on 0 > 2 > 1, not 0 > 1 > 2']);
    const late = completeJourney();
    const firstSkill = late.findIndex(checkpoint => checkpoint.skills === 'reading');
    late.splice(firstSkill + 1, 0, at('journey', 'about', { about: 'education', record: '2' }));
    expect(check(late)).toContain('Education was still being read after Skills began');
    expect(check(completeJourney(), 6, 0)).toContain('the page shows no Education records');
  });

  it('rejects one that skipped, repeated or reordered Skills chapters, or never read the TV', () => {
    expect(check(completeJourney(chapters(4)))).toEqual(['Skills read 0 > 1 > 2 > 3, not 0 > 1 > 2 > 3 > 4 > 5']);
    // The set of chapters read is complete in both; the order is not.
    expect(check(completeJourney(['0', '2', '1', '3', '4', '5'])))
      .toEqual(['Skills read 0 > 2 > 1 > 3 > 4 > 5, not 0 > 1 > 2 > 3 > 4 > 5']);
    expect(check(completeJourney(['0', '1', '0', '1', '2', '3', '4', '5']))).toHaveLength(1);
    const dark = completeJourney().map(checkpoint => (checkpoint.tv === 'reading' ? { ...checkpoint, tv: 'framed' } : checkpoint));
    expect(check(dark)).toEqual(['the TV never reached its reader on the way from Skills to Contact']);
    expect(check(completeJourney(), 0)).toContain('the page shows no Skills chapters');
  });

  it('rejects one that doubles back, or reads the TV anywhere but on its own leg', () => {
    // Round 11 (TECH-033): an About excursion after Skills, and a TV receipt at Home, both passed.
    const excursion = completeJourney();
    const leaving = excursion.findIndex(checkpoint => checkpoint.skills === 'leaving');
    excursion.splice(leaving, 0, at('journey', 'about', { about: 'green' }), at('journey', 'skills', { skills: 'leaving' }));
    expect(check(excursion)).toEqual(['the journey went back from skills to about']);
    const misplaced = completeJourney().map(checkpoint => (checkpoint.tv === 'reading' ? { ...checkpoint, tv: 'framed' } : checkpoint));
    misplaced.splice(1, 0, at('journey', 'home', { tv: 'reading' }));
    expect(check(misplaced)).toEqual(['the TV never reached its reader on the way from Skills to Contact']);
  });
  it("counts each chapter's receipts only on its own leg", () => {
    // Round 12 (TECH-039): About's beats emitted during Home, and Skills reads during About, both passed.
    const early = completeJourney().map(checkpoint => (checkpoint.section === 'about' ? { ...checkpoint, about: '', record: '' } : checkpoint));
    early.splice(1, 0, ...['statements', 'green', 'education'].map(about => at('journey', 'home', { about })),
      ...chapters(3).map(record => at('journey', 'home', { about: 'education', record })));
    expect(check(early)).toEqual([
      'About never reached its statements beat (saw nothing)', 'Education settled on no record, not 0 > 1 > 2',
    ]);
    const misplaced = completeJourney([]);
    const about = misplaced.findIndex(checkpoint => checkpoint.about === 'education');
    misplaced.splice(about + 1, 0, ...chapters(6).map(skill => at('journey', 'about', { skills: 'reading', skill })));
    expect(check(misplaced)).toContain('Skills read no chapter, not 0 > 1 > 2 > 3 > 4 > 5');
  });
  it('counts an Education record only while Education itself is open', () => {
    // Round 13 (TECH-042): all four records during About's statements, then an empty Education, passed.
    const early = completeJourney(chapters(6), []);
    const statements = early.findIndex(checkpoint => checkpoint.about === 'statements');
    early.splice(statements + 1, 0, ...chapters(3).map(record => at('journey', 'about', { about: 'statements', record })));
    expect(check(early)).toEqual(['Education settled on no record, not 0 > 1 > 2']);
  });
  it('counts Education records only in the visit its ordered opening began', () => {
    // Round 14 (TECH-046): records banked in an Education shown before statements paid for a later empty one.
    const banked = completeJourney(chapters(6), []);
    const statements = banked.findIndex(checkpoint => checkpoint.about === 'statements');
    banked.splice(statements, 0, ...chapters(3).map(record => at('journey', 'about', { about: 'education', record })));
    expect(check(banked)).toEqual([
      'About went back from education to statements before Education opened',
      'Education settled on no record, not 0 > 1 > 2', 'Education records were read outside the visit its ordered opening began',
    ]);
    // Nor in a second visit, after About let Education go.
    const again = completeJourney(chapters(6), []);
    const skills = again.findIndex(checkpoint => checkpoint.section === 'skills');
    again.splice(skills, 0, at('journey', 'about', { about: 'green' }),
      ...chapters(3).map(record => at('journey', 'about', { about: 'education', record })));
    expect(check(again)).toEqual([
      'About went back to education after Education',
      'Education settled on no record, not 0 > 1 > 2', 'Education records were read outside the visit its ordered opening began',
    ]);
    // Its own release, back to green on the way to Skills, is part of the journey.
    const released = completeJourney();
    released.splice(released.findIndex(checkpoint => checkpoint.section === 'skills'), 0, at('journey', 'about', { about: 'green' }));
    expect(check(released)).toEqual([]);
  });
  it('requires About to open forward, without going back to an earlier beat before Education', () => {
    // Round 15 (TECH-054): statements > green > statements > Education passed as one forward pass.
    const reversed = completeJourney();
    const green = reversed.findIndex(checkpoint => checkpoint.about === 'green');
    reversed.splice(green + 1, 0, at('journey', 'about', { about: 'statements' }), at('journey', 'about', { about: 'green' }));
    expect(check(reversed)).toEqual(['About went back from green to statements before Education opened']);
  });
  it('lets About only release Education after it, not open its earlier beats again', () => {
    // Round 16: Education > green > statements > green > an empty Education passed as one forward pass.
    const reopened = completeJourney();
    const skills = reopened.findIndex(checkpoint => checkpoint.section === 'skills');
    reopened.splice(skills, 0, ...['green', 'statements', 'green', 'education'].map(about => at('journey', 'about', { about })));
    expect(check(reopened)).toEqual(['About went back to statements after Education']);
  });
  it('counts only what happened while the journey was measured', () => {
    const outside = completeJourney().map(checkpoint => ({ ...checkpoint, phase: 'settle' as const }));
    expect(check(outside)[0]).toBe('the journey never reached home (passed nothing)');
  });

  it('reads the path a sample travelled back for its report', () => {
    expect(journeyPath(completeJourney(chapters(2), chapters(2)))).toEqual([
      'home', 'about:statements', 'about', 'about:green', 'about:education',
      'about:education:record-0', 'about:education', 'about:education:record-1', 'about:education', 'skills',
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
