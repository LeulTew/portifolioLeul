import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { animationClock } from '@/test/animationClock';
import { BackgroundPixelTransition } from './BackgroundPixelTransition';
import { TitlePixelTransition } from './TitlePixelTransition';
import { BACKGROUND_RISE, BEAT_COOLDOWN_MS, BEAT_REST_MS, TITLE_WRITE } from './aboutBeats';

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
    ['background', BackgroundPixelTransition, 'data-statements-cleared', 'data-bg-settled', BACKGROUND_RISE.durationMs + BEAT_REST_MS],
    ['title', TitlePixelTransition, 'data-bg-settled', 'data-title-settled', TITLE_WRITE.durationMs],
  ] as const)('wakes the %s after its cooldown without another scroll publication', async (_name, Beat, prerequisite, settled, duration) => {
    const clock = animationClock();
    render(
      <section id="about" {...{ [prerequisite]: 'true' }}>
        <div data-active="true" style={{ '--seq': 1 } as React.CSSProperties}>
          <Beat />
        </div>
      </section>
    );
    const about = document.getElementById('about')!;
    expect(clock.pending).toBe(0);
    clock.wait(BEAT_COOLDOWN_MS);
    await act(async () => { vi.advanceTimersByTime(BEAT_COOLDOWN_MS); });
    expect(clock.pending).toBeGreaterThan(0);
    expect(about).not.toHaveAttribute(settled);
    await clock.run(duration + 10);
    expect(about).toHaveAttribute(settled, 'true');
    expect(clock.pending).toBe(0);
  });
});
