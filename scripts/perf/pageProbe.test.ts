import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PAGE_PROBE, type PageTrace } from './measures';

type Probe = PageTrace & { sample(on: boolean): void; enter(phase: string): void };
const probe = () => (window as unknown as { __budget: Probe }).__budget;
const flush = () => new Promise(done => setTimeout(done, 0));

let frames: FrameRequestCallback[] = [];
const runFrame = (now: number) => {
  const due = frames;
  frames = [];
  for (const callback of due) callback(now);
};

beforeEach(() => {
  frames = [];
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => frames.push(callback));
  document.body.innerHTML = `
    <footer data-testid="page-footer" data-footer-section="home"></footer>
    <section data-testid="skills-stage" data-phase="outside" data-active-skill="0"></section>
    <div data-testid="hero-content" class="hero"></div>`;
  new Function(PAGE_PROBE)();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete (window as unknown as { __budget?: Probe }).__budget;
  document.body.innerHTML = '';
});

describe('the in-page probe', () => {
  it('marks each part of the run and every change of chapter within it', async () => {
    probe().enter('journey');
    const stage = document.querySelector('[data-testid="skills-stage"]')!;
    document.querySelector('[data-testid="page-footer"]')!.setAttribute('data-footer-section', 'skills');
    stage.setAttribute('data-phase', 'reading');
    await flush();
    stage.setAttribute('data-active-skill', '1');
    await flush();
    stage.setAttribute('data-active-skill', '1');
    await flush();
    const journey = probe().checkpoints.filter(checkpoint => checkpoint.phase === 'journey');
    expect(journey.map(({ section, skills, skill, tv }) => [section, skills, skill, tv])).toEqual([
      ['home', 'outside', '0', ''],
      ['skills', 'reading', '0', ''],
      ['skills', 'reading', '1', ''],
    ]);
  });

  it('picks up a reader that arrives with its phase already set', () => {
    probe().enter('journey');
    document.body.insertAdjacentHTML('beforeend', '<div data-testid="projects-stage" data-phase="reading"></div>');
    vi.advanceTimersByTime(250);
    expect(probe().checkpoints.at(-1)).toMatchObject({ phase: 'journey', tv: 'reading' });
  });

  it('says which timings the browser cannot give rather than reporting none', () => {
    // jsdom has no Long Animation Frame or Event Timing entries.
    expect(probe().unsupported).toEqual(expect.arrayContaining(['long-animation-frame', 'event']));
    expect(probe().frames).toEqual([]);
  });

  it('times animation frames only while sampling', () => {
    probe().sample(true);
    runFrame(1000);
    runFrame(1016.7);
    runFrame(1050);
    probe().sample(false);
    runFrame(1066.7);
    runFrame(1083.4);
    probe().sample(true);
    runFrame(2000);
    runFrame(2016.7);
    expect(probe().intervals).toEqual([16.7, 33.3, 16.7]);
  });

  it('records when the hero settles', () => {
    runFrame(400);
    expect(probe().readyAt).toBeNull();
    document.querySelector('[data-testid="hero-content"]')!.className = 'hero _settled_x1';
    runFrame(812.4);
    expect(probe().readyAt).toBe(812);
  });
});
