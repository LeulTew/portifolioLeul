import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Projects } from './Projects';
import { animationClock } from '@/test/animationClock';

let reportCoverage: (share: number) => void;
let reducedMotion = false;
vi.mock('@/lib/scroll/viewportCoverage', async (original) => ({
  ...await original<typeof import('@/lib/scroll/viewportCoverage')>(),
  useViewportShareEffect: (_element: unknown, report: (share: number) => void) => {
    reportCoverage = report;
  },
}));
vi.mock('@/lib/gateways/animationGateway', () => ({
  getPrefersReducedMotion: () => reducedMotion,
}));
vi.mock('../../ui/FocusScrim', () => ({ FocusScrim: () => null }));
vi.mock('../../ui/StripReveal', () => ({
  StripReveal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('../../ui/KineticText', () => ({ KineticHeading: () => <h2>Projects</h2> }));
vi.mock('../../ui/expandable-tabs', () => ({ ExpandableTabs: () => null }));
vi.mock('../../ui/focus-rail', () => ({ FocusRail: () => <p>Project content</p> }));

describe('Projects focus pacing', () => {
  let clock: ReturnType<typeof animationClock>;
  beforeEach(() => {
    reducedMotion = false;
    clock = animationClock();
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  const mount = () => {
    const rendered = render(<Projects />);
    const content = rendered.container.querySelector<HTMLElement>('[class*="content"]')!;
    return { ...rendered, content };
  };
  const cover = (share: number) => act(() => reportCoverage(share));

  it('finishes focusing after a small scroll stops instead of freezing partway', async () => {
    const { content } = mount();
    cover(0.3);
    await clock.run(1000);
    expect(Number(content.style.opacity)).toBe(1);
  });

  it('does not let a hard flick advance the current animation frame', async () => {
    const { content } = mount();
    cover(0.3);
    await clock.run(200);
    const partial = Number(content.style.opacity);
    expect(partial).toBeGreaterThan(0.35);
    expect(partial).toBeLessThan(1);
    cover(1);
    expect(Number(content.style.opacity)).toBe(partial);
    await clock.run(800);
    expect(Number(content.style.opacity)).toBe(1);
  });

  it('returns at its own pace and stops requesting frames at rest', async () => {
    const { content } = mount();
    cover(1);
    await clock.run(1000);
    cover(0);
    expect(Number(content.style.opacity)).toBe(1);
    await clock.run(250);
    expect(Number(content.style.opacity)).toBeGreaterThan(0.35);
    expect(Number(content.style.opacity)).toBeLessThan(1);
    await clock.run(750);
    expect(Number(content.style.opacity)).toBe(0.35);
    expect(clock.pending).toBe(0);
  });

  it('keeps reduced-motion content fully readable with no transform animation', async () => {
    reducedMotion = true;
    const { content } = mount();
    cover(0.3);
    await clock.run(1000);
    expect(Number(content.style.opacity)).toBe(1);
    expect(content.style.transform).toBe('none');
    expect(clock.pending).toBe(0);
  });

  it('cancels an in-flight focus animation on unmount', () => {
    const { unmount } = mount();
    cover(0.3);
    unmount();
    expect(clock.pending).toBe(0);
  });
});
