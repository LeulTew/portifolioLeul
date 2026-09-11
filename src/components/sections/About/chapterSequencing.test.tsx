import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { animationClock } from '@/test/animationClock';
import { About } from './About';
import {
  BEAT_COOLDOWN_MS, BEAT_REST_MS, HEAD_SETTLE, STATEMENT_ARRIVE,
  STATEMENT_CLEAR, STATEMENT_SWAP, TITLE_WRITE,
} from './aboutBeats';

vi.mock('@/lib/gateways/animationGateway', () => ({
  getPrefersReducedMotion: () => false,
}));
vi.mock('./EducationRail/EducationRail', () => ({ EducationRail: () => null }));
vi.mock('../../ui/ParallaxPlate', () => ({ ParallaxPlate: () => null }));
vi.mock('../../ui/FocusScrim', () => ({ FocusScrim: () => null }));

describe('the mounted About chapter plays every movement in order', () => {
  beforeEach(() => {
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

  const mount = () => {
    const clock = animationClock();
    const { unmount } = render(<About />);
    const about = document.getElementById('about')!;
    const overlay = screen.getByTestId('about-sequence-overlay');
    const statements = screen.getByTestId('about-left-column').parentElement!;
    let seq = 0;
    screen.getByTestId('about-sequence').getBoundingClientRect = () => ({
      top: -seq * 1800, bottom: 2700 - seq * 1800, height: 2700,
    }) as DOMRect;
    vi.stubGlobal('innerHeight', 900);
    const position = async (value: number) => {
      seq = value;
      await act(async () => { window.dispatchEvent(new Event('scroll')); });
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
    const travel = () => Number(overlay.style.getPropertyValue('--head-travel'));
    return { clock, about, overlay, position, wheel, run, value, travel, statements, unmount };
  };

  it('a hard flick cannot clear the copy before the heading or skip statement one', async () => {
    const chapter = mount();
    await chapter.position(0.953);
    await chapter.run(STATEMENT_CLEAR.durationMs + 100);
    expect(chapter.about).not.toHaveAttribute('data-head-settled');
    expect(chapter.about).not.toHaveAttribute('data-statements-cleared');
    expect(chapter.value('one-on')).toBe(0);
    expect(chapter.value('two-on')).toBe(0);

    await chapter.run(HEAD_SETTLE.durationMs - STATEMENT_CLEAR.durationMs - 80);
    expect(chapter.about).toHaveAttribute('data-head-settled', 'true');
    await chapter.run(BEAT_REST_MS - 20);
    expect(chapter.value('one-on')).toBe(0);
    await chapter.wheel();
    await chapter.run(STATEMENT_ARRIVE.durationMs + 40);
    expect(chapter.value('one-on')).toBe(1);
    expect(chapter.value('two-on')).toBe(0);
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
    await chapter.wheel();
    await chapter.run(BEAT_COOLDOWN_MS + 50);
    expect(chapter.value('two-on')).toBe(1);
    await chapter.wheel();
    await chapter.run(STATEMENT_CLEAR.durationMs + 20);
    expect(chapter.about).toHaveAttribute('data-statements-cleared', 'true');
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
    expect(chapter.travel()).toBe(1);
    expect(chapter.value('one-on')).toBe(0);
    expect(chapter.value('two-on')).toBe(0);
    expect(chapter.overlay).toHaveAttribute('data-active', 'true');
    expect(Number(chapter.overlay.style.getPropertyValue('--head-on'))).toBe(1);
    expect(Number(chapter.overlay.style.getPropertyValue('--ground-on'))).toBe(1);
    await chapter.run(TITLE_WRITE.durationMs);
    expect(chapter.about).not.toHaveAttribute('data-reverse-transition-active');
    expect(chapter.about).toHaveAttribute('data-bg-settled', 'true');
    await chapter.run(900);
    expect(chapter.about).toHaveAttribute('data-bg-settled', 'true');
    await chapter.run(13000);
    expect(chapter.travel()).toBe(0);
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
    await chapter.run(TITLE_WRITE.durationMs + 20);
    expect(chapter.about).not.toHaveAttribute('data-reverse-transition-active');
    expect(chapter.travel()).toBe(1);
    expect(chapter.value('two-on')).toBe(0);
    await chapter.wheel(-3);
    await chapter.run(BEAT_COOLDOWN_MS + 20);
    expect(chapter.about).toHaveAttribute('data-bg-settled', 'true');
    expect(chapter.clock.pending).toBe(0);
    await chapter.wheel(-3);
    await chapter.run(1520);
    expect(chapter.about).not.toHaveAttribute('data-bg-active');
    expect(chapter.about).toHaveAttribute('data-statements-cleared', 'true');
    await chapter.wheel(-3);
    await chapter.run(BEAT_COOLDOWN_MS + 20);
    expect(chapter.value('two-on')).toBe(0);
    expect(chapter.clock.pending).toBe(0);
    await chapter.wheel(-3);
    await chapter.run(STATEMENT_CLEAR.durationMs / 2);
    expect(chapter.value('two-on')).toBeGreaterThan(0);
    expect(chapter.value('two-on')).toBeLessThan(1);
    expect(chapter.value('one-on')).toBe(0);
    expect(chapter.travel()).toBe(1);
    await chapter.position(0.2);
    await chapter.run(STATEMENT_CLEAR.durationMs / 2 + 20);
    expect(chapter.value('two-on')).toBe(1);
    await chapter.wheel(-3);
    await chapter.run(BEAT_COOLDOWN_MS + 20);
    expect(chapter.value('one-on')).toBe(0);
    await chapter.wheel(-3);
    await chapter.run(STATEMENT_SWAP.durationMs + 20);
    expect(chapter.value('one-on')).toBe(1);
    expect(chapter.travel()).toBe(1);
    await chapter.position(-1);
    await chapter.run(BEAT_COOLDOWN_MS + 500);
    expect(chapter.value('one-on')).toBeGreaterThan(0);
    expect(chapter.travel()).toBe(1);
    await chapter.run(3000);
    expect(chapter.travel()).toBe(0);
    expect(chapter.clock.pending).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cancels the stopped-reader wake and frame work on unmount', async () => {
    const chapter = mount();
    await chapter.position(0.953);
    await chapter.run(HEAD_SETTLE.durationMs + BEAT_REST_MS + STATEMENT_ARRIVE.durationMs + 50);
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    chapter.unmount();
    expect(vi.getTimerCount()).toBe(0);
    expect(chapter.clock.pending).toBe(0);
  });

  it('does not spend the authored heading-to-copy rest in a suspended frame', async () => {
    const chapter = mount();
    await chapter.position(0.953);
    await chapter.run(HEAD_SETTLE.durationMs + 20);
    await chapter.clock.frame(9000);
    await chapter.run(100);
    expect(chapter.value('one-on')).toBe(0);
    expect(chapter.about).not.toHaveAttribute('data-statements-present');
    await chapter.run(BEAT_REST_MS + STATEMENT_ARRIVE.durationMs);
    expect(chapter.value('one-on')).toBe(1);
  });
});
