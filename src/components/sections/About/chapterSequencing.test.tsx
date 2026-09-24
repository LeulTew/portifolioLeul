import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { animationClock } from '@/test/animationClock';
import { About } from './About';
import { aboutNavigationInset } from './aboutNavigation';
import { ABOUT_SCREENS } from './statementLayers';
import { publishSectionNavigation } from '@/lib/scroll/sectionNavigation';
import { resetScrollProgress, setScrollProgress } from '@/lib/scroll/scrollProgress';
import {
  BACKGROUND_RISE, BEAT_COOLDOWN_MS, BEAT_REST_MS, HEAD_REVEAL, HEAD_SETTLE, STATEMENT_ARRIVE,
  STATEMENT_CLEAR, STATEMENT_SWAP, TITLE_WRITE,
} from './aboutBeats';

vi.mock('@/lib/gateways/animationGateway', () => ({
  getPrefersReducedMotion: () => false,
}));
vi.mock('./EducationRail/EducationRail', () => ({ EducationRail: () => null }));
vi.mock('../../ui/FocusScrim', () => ({ FocusScrim: () => null }));

// Set, rest centered, then dock: each waits for the one before it.
const HEAD_INTRO_MS = HEAD_REVEAL.durationMs + BEAT_REST_MS + HEAD_SETTLE.durationMs;

describe('the mounted About chapter plays every movement in order', () => {
  it('limits the remaining reading pauses to 250ms', () => {
    expect(BEAT_COOLDOWN_MS).toBe(250);
    expect(BEAT_REST_MS).toBe(250);
  });

  beforeEach(() => {
    resetScrollProgress();
    vi.stubEnv('NODE_ENV', 'development');
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  const mount = (withHome = false) => {
    const clock = animationClock();
    const { unmount } = render(<>{withHome && <section id="home" />}<About /></>);
    const about = document.getElementById('about')!;
    const overlay = screen.getByTestId('about-sequence-overlay');
    const statements = screen.getByTestId('about-left-column').parentElement!;
    let seq = 0;
    screen.getByTestId('about-sequence').getBoundingClientRect = () => ({
      top: -seq * 1800, bottom: 2700 - seq * 1800, height: 2700,
    }) as DOMRect;
    vi.stubGlobal('innerHeight', 900);
    const position = async (value: number, publish = true) => {
      seq = value;
      if (publish) await act(async () => { window.dispatchEvent(new Event('scroll')); });
    };
    const wheel = async (deltaY = 3) => {
      const event = new WheelEvent('wheel', { deltaY, cancelable: true });
      await act(async () => { window.dispatchEvent(event); });
      expect(event.defaultPrevented).toBe(false);
    };
    const run = async (ms: number) => {
      for (let elapsed = 0; elapsed < ms; elapsed += 10) {
        await clock.frame(10);
        await act(async () => { vi.advanceTimersByTime(10); });
      }
    };
    const value = (name: string) => Number(statements.style.getPropertyValue(`--${name}`));
    const headReady = () => about.getAttribute('data-head-settled') === 'true';
    return { clock, about, overlay, position, wheel, run, value, headReady, statements, unmount };
  };

  const handover = async (complete: boolean) => {
    await act(async () => {
      const home = document.getElementById('home')!;
      if (complete) home.setAttribute('data-hero-handover-settled', 'true');
      else home.removeAttribute('data-hero-handover-settled');
    });
  };

  it.each([560, 900, 2160])('retains natural About handoffs at the authored heading inset at %ipx', height => {
    expect(aboutNavigationInset(height)).toBe(Math.round(height * 0.08));
  });

  it.each(['home', 'skills'])('completes navbar About entry from %s without another gesture, but does not advance later beats', async source => {
    const chapter = mount(true);
    await handover(true);
    await act(async () => { publishSectionNavigation(source, { source: 'navbar' }); });
    await chapter.position(source === 'home' ? -1 : 2);
    await act(async () => { publishSectionNavigation('about', { source: 'navbar' }); });
    await chapter.position(aboutNavigationInset(900, 'navbar') / (900 * (ABOUT_SCREENS - 1)));
    await chapter.run(8000);
    expect(chapter.overlay).toHaveAttribute('data-active', 'true');
    expect(chapter.headReady()).toBe(true);
    expect(chapter.value('one-on')).toBe(1);
    expect(chapter.value('two-on')).toBe(0);
    expect(chapter.statements.style.getPropertyValue('--one-copy-events')).toBe('auto');
    expect(chapter.about).not.toHaveAttribute('data-statements-cleared');
    expect(chapter.about).not.toHaveAttribute('data-title-settled');
    expect(chapter.clock.pending).toBe(0);

    await chapter.position(0.95);
    await chapter.run(3000);
    expect(chapter.value('one-on')).toBe(1);
    expect(chapter.value('two-on')).toBe(0);
    await chapter.wheel();
    await chapter.run(STATEMENT_SWAP.durationMs + 20);
    expect(chapter.value('two-on')).toBe(1);
  });

  it('reveals navbar About after a delayed native intersection, without another wheel or scroll publication', async () => {
    let notify: IntersectionObserverCallback;
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback: IntersectionObserverCallback) { notify = callback; }
      observe() {}
      unobserve() {}
      disconnect() {}
    });
    const chapter = mount(true);
    await chapter.position(-1215 / 1800);
    await act(async () => {
      notify([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver);
      publishSectionNavigation('about', { source: 'navbar' });
    });
    await handover(true);
    await chapter.position(530.734130859375 / 1800, false);
    await act(async () => { setScrollProgress(1858 / 14895, true); });
    expect(chapter.overlay.style.getPropertyValue('--seq')).toBe('0.000');
    expect(chapter.overlay).toHaveAttribute('data-active', 'false');
    await act(async () => {
      notify([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    });
    await chapter.run(8000);
    expect(chapter.overlay).toHaveAttribute('data-active', 'true');
    expect(chapter.headReady()).toBe(true);
    expect(chapter.value('one-on')).toBe(1);
    expect(chapter.value('two-on')).toBe(0);
    expect(chapter.statements.style.getPropertyValue('--one-copy-events')).toBe('auto');
    expect(chapter.about).not.toHaveAttribute('data-statements-cleared');
    expect(chapter.clock.pending).toBe(0);
  });

  it('holds the centered title before docking, without requiring another gesture', async () => {
    const chapter = mount(true);
    await chapter.position(0.953);
    await chapter.wheel();
    await chapter.run(3000);
    expect(chapter.headReady()).toBe(false);
    expect(chapter.value('one-on')).toBe(0);
    expect(chapter.clock.pending).toBe(0);
    expect(chapter.about).not.toHaveAttribute('data-head-pending');
    expect(chapter.overlay).toHaveAttribute('data-active', 'false');
    await handover(true);
    expect(chapter.overlay).toHaveAttribute('data-active', 'true');
    expect(chapter.headReady()).toBe(false);
    expect(screen.getByTestId('about-held-header').style.getPropertyValue('--head-travel')).toBe('0.0000');
    await chapter.run(HEAD_REVEAL.durationMs + BEAT_REST_MS - 20);
    expect(screen.getByTestId('about-held-header').style.getPropertyValue('--head-reveal')).toBe('1.0000');
    expect(screen.getByTestId('about-held-header').style.getPropertyValue('--head-travel')).toBe('0.0000');
    await chapter.run(HEAD_SETTLE.durationMs + 40);
    expect(chapter.headReady()).toBe(true);
    await chapter.run(BEAT_REST_MS - 20);
    expect(chapter.value('one-on')).toBe(0);
    await chapter.run(STATEMENT_ARRIVE.durationMs + 40);
    expect(chapter.value('one-on')).toBe(1);
    expect(chapter.about).toHaveAttribute('data-head-settled', 'true');
    expect(chapter.about).not.toHaveAttribute('data-head-pending');
  });

  it('keeps the later chapter intact after the bridge becomes ready', async () => {
    const chapter = mount(true);
    await chapter.position(0.1);
    await chapter.position(2);
    await chapter.run(3000);
    expect(chapter.overlay).toHaveAttribute('data-active', 'false');
    expect(chapter.headReady()).toBe(false);
    expect(chapter.overlay.style.getPropertyValue('--seq')).toBe('1.000');
    await handover(true);
    expect(chapter.overlay).toHaveAttribute('data-active', 'true');
    expect(chapter.headReady()).toBe(false);
    await chapter.run(HEAD_INTRO_MS + 20);
    expect(chapter.headReady()).toBe(true);
    await chapter.run(14000);
    expect(chapter.about).toHaveAttribute('data-title-settled', 'true');
    expect(chapter.overlay).toHaveAttribute('data-active', 'false');
    expect(chapter.about).not.toHaveAttribute('data-head-pending');
    expect(chapter.clock.pending).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('withdraws title readiness on reverse without leaving a handover timer', async () => {
    const chapter = mount(true);
    await chapter.position(0.06);
    await handover(true);
    await chapter.run(100);
    await chapter.position(-1);
    expect(chapter.about).not.toHaveAttribute('data-head-pending');
    expect(chapter.overlay).toHaveAttribute('data-active', 'false');
    await handover(false);
    expect(vi.getTimerCount()).toBe(0);
    await handover(true);
    expect(chapter.headReady()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    chapter.unmount();
    expect(vi.getTimerCount()).toBe(0);
    expect(chapter.clock.pending).toBe(0);
  });

  it('replays the centered arrival on reentry without a separate gesture latch', async () => {
    const chapter = mount(true);
    await chapter.position(0.06);
    await handover(true);
    await chapter.run(HEAD_INTRO_MS + 20);
    expect(chapter.headReady()).toBe(true);
    await chapter.position(0);
    await chapter.run(HEAD_SETTLE.durationMs + 320);
    expect(chapter.headReady()).toBe(false);
    await chapter.position(0.06);
    expect(chapter.headReady()).toBe(false);
    await chapter.run(HEAD_INTRO_MS + 20);
    expect(chapter.headReady()).toBe(true);
    expect(chapter.clock.pending).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('a hard flick cannot clear the copy before the heading or skip statement one', async () => {
    const chapter = mount();
    await chapter.position(0.953);
    await chapter.run(100);
    expect(chapter.about).not.toHaveAttribute('data-head-settled');
    expect(chapter.about).not.toHaveAttribute('data-statements-cleared');
    expect(chapter.value('one-on')).toBe(0);
    expect(chapter.value('two-on')).toBe(0);

    await chapter.run(HEAD_INTRO_MS - 80);
    expect(chapter.about).toHaveAttribute('data-head-settled', 'true');
    await chapter.run(BEAT_REST_MS - 50);
    expect(chapter.value('one-on')).toBe(0);
    expect(chapter.value('seed-on')).toBeGreaterThan(0);
    expect(chapter.value('one-morph')).toBe(0);
    expect(chapter.value('two-morph')).toBe(0);
    await chapter.wheel();
    await chapter.run(STATEMENT_ARRIVE.durationMs + 40);
    expect(chapter.value('one-on')).toBe(1);
    expect(chapter.value('two-on')).toBe(0);
    expect(chapter.value('one-morph')).toBe(1);
    expect(chapter.value('two-morph')).toBe(0);
    expect(chapter.value('two-shape-on')).toBe(1);
    expect(chapter.value('seed-on')).toBe(1);
    expect(screen.getByTestId('about-left-column').parentElement).toHaveAttribute('data-contrary', 'false');
    await chapter.wheel();
    await chapter.run(BEAT_COOLDOWN_MS + 50);
    expect(chapter.value('one-on')).toBe(1);
    expect(chapter.clock.pending).toBe(0);
    const writes = [chapter.about, chapter.overlay, chapter.statements].flatMap(node => [
      vi.spyOn(node, 'setAttribute'), vi.spyOn(node.style, 'setProperty'),
    ]);
    await act(async () => {
      for (let i = 0; i < 30; i++) window.dispatchEvent(new Event('scroll'));
    });
    for (const spy of writes) {
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    }
    await chapter.wheel();
    await chapter.run(STATEMENT_SWAP.durationMs + 20);
    expect(chapter.value('two-on')).toBe(1);
    expect(chapter.value('two-morph')).toBe(1);
    expect(chapter.value('one-shape-on')).toBe(0);
    expect(chapter.statements).not.toHaveAttribute('data-morphing');
    await chapter.wheel();
    await chapter.run(BEAT_COOLDOWN_MS + 50);
    expect(chapter.value('two-on')).toBe(1);
    await chapter.wheel();
    await chapter.run(STATEMENT_CLEAR.durationMs + 20);
    expect(chapter.about).toHaveAttribute('data-statements-cleared', 'true');
    expect(chapter.value('one-shape-on')).toBe(0);
    expect(chapter.value('two-shape-on')).toBe(0);
  });

  it('finishes and releases after an end flick, then reverses on screen without snapping', async () => {
    const chapter = mount();
    await chapter.position(0.1);
    await chapter.run(100);
    await chapter.position(2);
    await chapter.run(HEAD_SETTLE.durationMs + 20);
    expect(chapter.overlay).toHaveAttribute('data-active', 'true');
    await chapter.run(14000);
    expect(chapter.about).toHaveAttribute('data-title-settled', 'true');
    expect(chapter.overlay).toHaveAttribute('data-active', 'false');
    expect(chapter.clock.pending).toBe(0);

    await chapter.position(0.7);
    await chapter.run(10);
    await chapter.position(-1);
    await chapter.run(100);
    expect(chapter.headReady()).toBe(true);
    expect(chapter.value('one-on')).toBe(0);
    expect(chapter.value('two-on')).toBe(0);
    expect(chapter.overlay).toHaveAttribute('data-active', 'true');
    expect(Number(chapter.overlay.style.getPropertyValue('--head-on'))).toBe(1);
    expect(Number(chapter.overlay.style.getPropertyValue('--ground-on'))).toBe(1);
    await chapter.run(TITLE_WRITE.durationMs - 150);
    expect(chapter.about).toHaveAttribute('data-reverse-transition-active', 'true');
    expect(chapter.about).toHaveAttribute('data-bg-settled', 'true');
    await chapter.run(80);
    expect(chapter.about).not.toHaveAttribute('data-reverse-transition-active');
    expect(chapter.about).toHaveAttribute('data-bg-active', 'true');
    expect(chapter.about).not.toHaveAttribute('data-bg-settled');
    await chapter.run(13000);
    expect(chapter.headReady()).toBe(false);
    expect(chapter.value('one-on')).toBe(0);
    expect(chapter.value('two-on')).toBe(0);
    expect(chapter.overlay).toHaveAttribute('data-active', 'false');
    expect(chapter.clock.pending).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('discards early reverse asks and holds each earlier movement until the next has returned', async () => {
    const chapter = mount();
    await chapter.position(1);
    await chapter.run(15000);
    await chapter.position(0.549);
    await chapter.wheel(-3);
    await chapter.run(TITLE_WRITE.durationMs - 10);
    expect(chapter.about).toHaveAttribute('data-reverse-transition-active', 'true');
    expect(chapter.headReady()).toBe(true);
    expect(chapter.value('two-on')).toBe(0);
    await chapter.wheel(-3);
    await chapter.run(20);
    expect(chapter.about).not.toHaveAttribute('data-reverse-transition-active');
    expect(chapter.about).toHaveAttribute('data-bg-settled', 'true');
    expect(chapter.clock.pending).toBe(0);
    await chapter.wheel(-3);
    await chapter.run(BACKGROUND_RISE.durationMs - 10);
    expect(chapter.about).toHaveAttribute('data-bg-active', 'true');
    await chapter.wheel(-3);
    await chapter.run(20);
    expect(chapter.about).not.toHaveAttribute('data-bg-active');
    expect(chapter.about).toHaveAttribute('data-statements-cleared', 'true');
    expect(chapter.value('two-on')).toBe(0);
    expect(chapter.clock.pending).toBe(0);
    await chapter.wheel(-3);
    await chapter.run(STATEMENT_CLEAR.durationMs / 2);
    expect(chapter.value('two-on')).toBeGreaterThan(0);
    expect(chapter.value('two-on')).toBeLessThan(1);
    expect(chapter.value('one-on')).toBe(0);
    expect(chapter.headReady()).toBe(true);
    await chapter.position(0.2);
    await chapter.run(STATEMENT_CLEAR.durationMs / 2 + 20);
    expect(chapter.value('two-on')).toBe(1);
    await chapter.wheel(-3);
    await chapter.run(BEAT_COOLDOWN_MS + 20);
    expect(chapter.value('one-on')).toBe(0);
    await chapter.wheel(-3);
    await chapter.run(STATEMENT_SWAP.durationMs / 2);
    expect(chapter.value('two-morph')).toBeGreaterThan(0);
    expect(chapter.value('two-morph')).toBeLessThan(1);
    expect(chapter.value('one-morph')).toBe(1);
    expect(chapter.statements).toHaveAttribute('data-morphing', 'true');
    await chapter.run(STATEMENT_SWAP.durationMs / 2 + 20);
    expect(chapter.value('one-on')).toBe(1);
    expect(chapter.value('two-morph')).toBe(0);
    expect(chapter.value('two-shape-on')).toBe(1);
    expect(chapter.headReady()).toBe(true);
    await chapter.position(-1);
    await chapter.run(BEAT_COOLDOWN_MS + 500);
    expect(chapter.value('one-on')).toBeGreaterThan(0);
    expect(chapter.headReady()).toBe(true);
    await chapter.run(3000);
    expect(chapter.headReady()).toBe(false);
    expect(chapter.value('one-morph')).toBe(0);
    expect(chapter.value('two-morph')).toBe(0);
    expect(chapter.value('seed-on')).toBe(0);
    expect(chapter.clock.pending).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cancels the stopped-reader wake and frame work on unmount', async () => {
    const chapter = mount();
    await chapter.position(0.953);
    await chapter.run(HEAD_INTRO_MS + BEAT_REST_MS + STATEMENT_ARRIVE.durationMs + 50);
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    chapter.unmount();
    expect(vi.getTimerCount()).toBe(0);
    expect(chapter.clock.pending).toBe(0);
  });

  it('does not let the shorter rest replace the statement animation lock', async () => {
    const chapter = mount();
    await chapter.position(0.953);
    await chapter.run(HEAD_INTRO_MS + BEAT_REST_MS + STATEMENT_ARRIVE.durationMs / 2);
    const arriving = chapter.value('one-on');
    expect(arriving).toBeGreaterThan(0);
    expect(arriving).toBeLessThan(1);
    expect(chapter.value('one-morph')).toBe(arriving);
    expect(chapter.value('two-morph')).toBe(0);
    expect(chapter.statements).toHaveAttribute('data-morphing', 'true');
    await chapter.position(-1);
    await chapter.wheel(-3);
    await chapter.run(BEAT_COOLDOWN_MS + 20);
    expect(chapter.value('one-on')).toBeGreaterThan(arriving);
    await chapter.run(STATEMENT_ARRIVE.durationMs / 2 - BEAT_COOLDOWN_MS);
    expect(chapter.value('one-on')).toBe(1);
    expect(chapter.headReady()).toBe(true);
  });

  it('does not spend the authored heading-to-copy rest in a suspended frame', async () => {
    const chapter = mount();
    await chapter.position(0.953);
    await chapter.run(HEAD_INTRO_MS + 20);
    await chapter.clock.frame(9000);
    await chapter.run(100);
    expect(chapter.value('one-on')).toBe(0);
    expect(chapter.about).not.toHaveAttribute('data-statements-present');
    await chapter.run(BEAT_REST_MS + STATEMENT_ARRIVE.durationMs);
    expect(chapter.value('one-on')).toBe(1);
  });
});
