import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { animationClock } from '@/test/animationClock';
import { BackgroundPixelTransition } from './BackgroundPixelTransition';
import { BACKGROUND_RISE, BEAT_COOLDOWN_MS, BEAT_REST_MS } from './aboutBeats';

vi.mock('@/lib/gateways/animationGateway', () => ({
  getPrefersReducedMotion: () => false,
}));

describe('the mounted background beat after a suspended frame', () => {
  beforeEach(() => {
    // Exercise production choreography, not the legacy position-mapped test path.
    vi.stubEnv('NODE_ENV', 'development');
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  const start = async () => {
    const clock = animationClock();
    render(
      <section id="about" data-statements-cleared="true">
        <div data-active="true" style={{ '--seq': 0.953 } as React.CSSProperties}>
          <BackgroundPixelTransition />
        </div>
      </section>
    );
    clock.wait(BEAT_COOLDOWN_MS + 1);
    await act(async () => {
      window.dispatchEvent(new WheelEvent('wheel', { deltaY: 3 }));
    });
    return { clock, about: document.getElementById('about')! };
  };

  it('plays the rise instead of publishing transition and settled on its first delayed frame', async () => {
    const { clock, about } = await start();
    await clock.frame(2200);

    expect(about).toHaveAttribute('data-bg-active', 'true');
    expect(about).not.toHaveAttribute('data-bg-settled');
    expect(about).not.toHaveAttribute('data-bg-transition');
    const cells = screen.getAllByTestId('bg-pixel-transition-cell');
    expect(cells.filter((cell) => cell.dataset.active === 'true').length)
      .toBeLessThan(cells.length);

    await clock.run(1400);
    expect(about).not.toHaveAttribute('data-bg-settled');
    await clock.run(600);
    expect(about).toHaveAttribute('data-bg-settled', 'true');
    expect(clock.pending).toBe(0);
  });

  it('does not let a suspended frame serve the entire post-rise rest', async () => {
    const { clock, about } = await start();
    await clock.run(BACKGROUND_RISE.durationMs);
    expect(about).not.toHaveAttribute('data-bg-settled');
    await clock.frame(9000);
    expect(about).not.toHaveAttribute('data-bg-settled');
    await clock.run(BEAT_REST_MS);
    expect(about).toHaveAttribute('data-bg-settled', 'true');
  });

  it('still shows the retreat when its first reverse frame is delayed', async () => {
    const { clock, about } = await start();
    await clock.run(BACKGROUND_RISE.durationMs + BEAT_REST_MS);
    await act(async () => {
      screen.getByTestId('bg-pixel-transition').style.setProperty('--seq', '0.6');
      window.dispatchEvent(new Event('scroll'));
    });
    await clock.frame(9000);

    expect(about).toHaveAttribute('data-bg-active', 'true');
    expect(about).not.toHaveAttribute('data-bg-settled');
    await clock.run(BACKGROUND_RISE.durationMs);
    expect(about).not.toHaveAttribute('data-bg-active');
    expect(about).not.toHaveAttribute('data-bg-transition');
    expect(clock.pending).toBe(0);
  });
});
