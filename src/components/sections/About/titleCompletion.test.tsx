import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { animationClock } from '@/test/animationClock';
import { TitlePixelTransition } from './TitlePixelTransition';
import { BEAT_COOLDOWN_MS, TITLE_WRITE } from './aboutBeats';

vi.mock('@/lib/gateways/animationGateway', () => ({
  getPrefersReducedMotion: () => false,
}));

describe('the mounted title completion publisher', () => {
  beforeEach(() => vi.stubEnv('NODE_ENV', 'development'));
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  const start = async () => {
    const clock = animationClock();
    render(
      <section id="about" data-bg-settled="true">
        <div data-active="true" style={{ '--seq': 0.953 } as React.CSSProperties}>
          <TitlePixelTransition />
        </div>
      </section>
    );
    const about = document.getElementById('about')!;
    const writes = vi.spyOn(about, 'setAttribute');
    clock.wait(BEAT_COOLDOWN_MS + 1);
    await act(async () => {
      window.dispatchEvent(new WheelEvent('wheel', { deltaY: 3 }));
    });
    return { clock, about, writes };
  };

  it('publishes settled exactly once, including the terminal frame and idle updates', async () => {
    const { clock, about, writes } = await start();
    await clock.run(TITLE_WRITE.durationMs + 10);
    await act(async () => {
      for (let i = 0; i < 30; i++) window.dispatchEvent(new Event('scroll'));
    });
    expect(about).toHaveAttribute('data-title-settled', 'true');
    expect(writes.mock.calls.filter(([key]) => key === 'data-title-settled'))
      .toEqual([['data-title-settled', 'true']]);
    expect(clock.pending).toBe(0);
  });

  it('does not release the pin or education rail before the final frame', async () => {
    const { clock, about } = await start();
    await clock.run(TITLE_WRITE.durationMs - 20);
    expect(about).not.toHaveAttribute('data-title-settled');
    expect(about).toHaveAttribute('data-title-active', 'true');
    await clock.run(30);
    expect(about).toHaveAttribute('data-title-settled', 'true');
    expect(about).not.toHaveAttribute('data-title-active');
  });
});
