import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { animationClock } from '@/test/animationClock';
import { BackgroundPixelTransition } from './BackgroundPixelTransition';
import { TitlePixelTransition } from './TitlePixelTransition';
import { BACKGROUND_RISE, BEAT_COOLDOWN_MS, TITLE_WRITE } from './aboutBeats';

vi.mock('@/lib/gateways/animationGateway', () => ({
  getPrefersReducedMotion: () => false,
}));

describe('a chapter whose scroll has already been spent', () => {
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

  it.each([
    ['background', BackgroundPixelTransition, 'data-statements-cleared', 'data-bg-settled', BACKGROUND_RISE.durationMs, BEAT_COOLDOWN_MS],
    ['title', TitlePixelTransition, 'data-bg-settled', 'data-title-settled', TITLE_WRITE.durationMs, 0],
  ] as const)('starts the %s without another scroll publication after its required rest', async (_name, Beat, prerequisite, settled, duration, cooldown) => {
    const clock = animationClock();
    render(
      <section id="about" {...{ [prerequisite]: 'true' }}>
        <div data-active="true" style={{ '--seq': 1 } as React.CSSProperties}>
          <Beat />
        </div>
      </section>
    );
    const about = document.getElementById('about')!;
    if (cooldown > 0) {
      expect(clock.pending).toBe(0);
      clock.wait(cooldown);
      await act(async () => { vi.advanceTimersByTime(cooldown); });
    } else {
      expect(vi.getTimerCount()).toBe(0);
    }
    expect(clock.pending).toBeGreaterThan(0);
    expect(about).not.toHaveAttribute(settled);
    await clock.run(duration + 10);
    expect(about).toHaveAttribute(settled, 'true');
    expect(clock.pending).toBe(0);
  });
});
