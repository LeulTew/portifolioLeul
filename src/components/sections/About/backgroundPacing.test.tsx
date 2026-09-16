import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { animationClock } from '@/test/animationClock';
import { BackgroundPixelTransition } from './BackgroundPixelTransition';
import { BACKGROUND_RISE, BEAT_COOLDOWN_MS } from './aboutBeats';
import { publishSectionNavigation } from '@/lib/scroll/sectionNavigation';

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
    const view = render(
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
    return { clock, about: document.getElementById('about')!, ...view };
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

  it('publishes completion on the final rise frame without an extra rest', async () => {
    const { clock, about } = await start();
    await clock.run(BACKGROUND_RISE.durationMs - 10);
    expect(about).not.toHaveAttribute('data-bg-settled');
    await clock.frame(10);
    expect(about).toHaveAttribute('data-bg-settled', 'true');
    expect(clock.pending).toBe(0);
  });

  it('settles a navbar bypass without leaving a rise or reverse frame pending', async () => {
    const { clock, about } = await start();
    await clock.frame(100);
    expect(about).toHaveAttribute('data-bg-active', 'true');
    await act(async () => { publishSectionNavigation('skills', { source: 'navbar' }); });
    expect(about).toHaveAttribute('data-bg-settled', 'true');
    expect(about).not.toHaveAttribute('data-bg-active');
    expect(clock.pending).toBe(0);
    await act(async () => { publishSectionNavigation('home', { source: 'navbar' }); });
    expect(about).not.toHaveAttribute('data-bg-settled');
    expect(about).not.toHaveAttribute('data-bg-transition');
    expect(clock.pending).toBe(0);
  });

  it('accepts reverse input immediately after the title finishes returning', async () => {
    const { clock, about } = await start();
    await clock.run(BACKGROUND_RISE.durationMs);
    await act(async () => {
      about.setAttribute('data-title-settled', 'true');
      screen.getByTestId('bg-pixel-transition').style.setProperty('--seq', '0.6');
      window.dispatchEvent(new Event('scroll'));
    });
    await act(async () => { about.removeAttribute('data-title-settled'); });
    await act(async () => {
      window.dispatchEvent(new WheelEvent('wheel', { deltaY: -3 }));
    });
    await clock.frame(10);
    expect(about).toHaveAttribute('data-bg-active', 'true');
    expect(about).not.toHaveAttribute('data-bg-settled');
  });

  it('preserves a completed background when a desktop resize rebuilds its grid', async () => {
    const { clock, about } = await start();
    await clock.run(BACKGROUND_RISE.durationMs);
    expect(about).toHaveAttribute('data-bg-settled', 'true');
    await act(async () => { window.dispatchEvent(new Event('resize')); });
    expect(about).toHaveAttribute('data-bg-settled', 'true');
    expect(about).not.toHaveAttribute('data-bg-active');
    expect(clock.pending).toBe(0);
  });

  it('finishes the remaining rise after a resize without restarting or adding a rest', async () => {
    const { clock, about } = await start();
    await clock.run(BACKGROUND_RISE.durationMs - 200);
    expect(about).not.toHaveAttribute('data-bg-settled');
    await act(async () => { window.dispatchEvent(new Event('resize')); });
    await clock.run(100);
    expect(about).not.toHaveAttribute('data-bg-settled');
    await clock.run(100);
    expect(about).toHaveAttribute('data-bg-settled', 'true');
    expect(clock.pending).toBe(0);
  });

  it('still clears its ownership when the background is actually unmounted', async () => {
    const { clock, about, rerender } = await start();
    await clock.run(BACKGROUND_RISE.durationMs);
    rerender(<section id="about" data-statements-cleared="true" />);
    expect(about).not.toHaveAttribute('data-bg-transition');
    expect(about).not.toHaveAttribute('data-bg-active');
    expect(about).not.toHaveAttribute('data-bg-settled');
    expect(document.documentElement).not.toHaveAttribute('data-navbar-contrary');
  });

  it('still shows the retreat when its first reverse frame is delayed', async () => {
    const { clock, about } = await start();
    await clock.run(BACKGROUND_RISE.durationMs);
    await act(async () => {
      screen.getByTestId('bg-pixel-transition').style.setProperty('--seq', '0.6');
      window.dispatchEvent(new Event('scroll'));
    });
    await act(async () => {
      window.dispatchEvent(new WheelEvent('wheel', { deltaY: -3 }));
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
