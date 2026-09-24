import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { animationClock } from '@/test/animationClock';
import { AboutHeading } from './AboutHeading';
import { BEAT_REST_MS, HEAD_REVEAL } from './aboutBeats';
import { publishSectionNavigation } from '@/lib/scroll/sectionNavigation';

const reduced = vi.fn(() => false);
vi.mock('@/lib/gateways/animationGateway', () => ({ getPrefersReducedMotion: () => reduced() }));

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'development');
  reduced.mockReturnValue(false);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function mount() {
  const clock = animationClock();
  const view = render(<>
    <section id="home" data-hero-handover-settled="true" />
    <section id="about" />
    <div data-heading-mirror="" aria-hidden="true" />
    <button data-testid="scroll-cue" />
    <div data-active="true" data-testid="heading-stage">
      <AboutHeading>
        <div data-heading-title=""><h2>About Me</h2></div>
        <p data-heading-subtitle="">Bridging ideas and experiences.</p>
      </AboutHeading>
    </div>
  </>);
  const about = document.getElementById('about')!;
  const motion = view.getByTestId('about-held-header');
  const stage = view.getByTestId('heading-stage');
  // Published together by `PinnedSequence`: where the stretch is, and the head layer's presence there.
  const position = async (seq: number, headIn = seq > 0 ? 1 : 0) => {
    stage.style.setProperty('--seq', String(seq));
    stage.style.setProperty('--head-in', String(headIn));
    await act(async () => { window.dispatchEvent(new Event('scroll')); });
  };
  const run = async (duration: number) => {
    for (let i = 0; i < duration; i += 20) await clock.frame(20);
  };
  const travel = () => Number(motion.style.getPropertyValue('--head-travel'));
  const reveal = () => Number(motion.style.getPropertyValue('--head-reveal'));
  return { ...view, clock, about, motion, position, run, travel, reveal };
}

describe('centered About arrival', () => {
  it('settles skipped travel for navbar navigation, then allows normal heading entry on return', async () => {
    const scene = mount();
    await scene.position(0.5);
    await scene.run(HEAD_REVEAL.durationMs + 500);
    expect(scene.travel()).toBeGreaterThan(0);
    expect(scene.travel()).toBeLessThan(1);
    await act(async () => { publishSectionNavigation('contact', { source: 'navbar' }); });
    expect(scene.travel()).toBe(1);
    expect(scene.about).not.toHaveAttribute('data-head-pending');
    expect(scene.clock.pending).toBe(0);
    await scene.position(0);
    await act(async () => { publishSectionNavigation('about', { source: 'navbar' }); });
    expect(scene.travel()).toBe(0);
    expect(scene.clock.pending).toBe(0);
    await scene.position(0.5);
    await scene.run(500);
    expect(scene.travel()).toBeGreaterThan(0);
    expect(scene.travel()).toBeLessThan(1);
  });

  it('holds the large centered pose, then docks without an extra gesture', async () => {
    const scene = mount();
    await scene.position(0.5);
    // A flick still sees the heading set at full length before the centered rest.
    await scene.run(HEAD_REVEAL.durationMs - 40);
    expect(scene.reveal()).toBeGreaterThan(0);
    expect(scene.reveal()).toBeLessThan(1);
    expect(scene.travel()).toBe(0);
    await scene.run(40);
    expect(scene.reveal()).toBe(1);
    await scene.run(BEAT_REST_MS - 30);
    expect(scene.travel()).toBe(0);
    expect(scene.about).toHaveAttribute('data-head-pending', 'true');
    expect(scene.about).not.toHaveAttribute('data-head-settled');
    await scene.run(420);
    expect(scene.travel()).toBeGreaterThan(0);
    expect(scene.travel()).toBeLessThan(1);
    expect(document.documentElement.style.getPropertyValue('--head-travel')).toBe('');
    const mirror = document.querySelector<HTMLElement>('[data-heading-mirror]')!;
    expect(mirror.style.getPropertyValue('--head-travel')).toBe(scene.motion.style.getPropertyValue('--head-travel'));
    expect(scene.getByTestId('scroll-cue').style.getPropertyValue('--head-travel')).toBe(scene.motion.style.getPropertyValue('--head-travel'));
    await scene.run(800);
    expect(scene.travel()).toBe(1);
    expect(scene.about).toHaveAttribute('data-head-settled', 'true');
    expect(scene.about).not.toHaveAttribute('data-head-pending');
    expect(scene.clock.pending).toBe(0);
  });

  it('does not spend the centered reading pause in a suspended frame', async () => {
    const scene = mount();
    await scene.position(1);
    await scene.run(HEAD_REVEAL.durationMs + 20);
    await scene.clock.frame(10000);
    expect(scene.travel()).toBe(0);
    await scene.run(BEAT_REST_MS - 70);
    expect(scene.travel()).toBe(0);
    await scene.run(80);
    expect(scene.travel()).toBeGreaterThan(0);
  });

  it('keeps the title docked until the later statements return, then fades at center', async () => {
    const scene = mount();
    await scene.position(1);
    await scene.run(1700);
    await act(async () => { scene.about.dataset.statementsPresent = 'true'; });
    await scene.position(0);
    await scene.run(1300);
    expect(scene.travel()).toBe(1);
    await act(async () => { delete scene.about.dataset.statementsPresent; });
    await scene.run(1120);
    expect(scene.travel()).toBe(0);
    expect(scene.about).toHaveAttribute('data-head-pending', 'true');
    expect(Number(scene.motion.style.getPropertyValue('--heading-presence'))).toBeLessThan(1);
    await scene.run(300);
    expect(scene.motion.style.getPropertyValue('--heading-presence')).toBe('0.0000');
    expect(scene.reveal()).toBe(0);
    expect(scene.about).not.toHaveAttribute('data-head-pending');
    expect(scene.clock.pending).toBe(0);
  });

  it('sets the centered heading on its own clock, however little of the stretch was scrolled', async () => {
    // Regression: the masks were the scroll-mapped layer presence, so stopping
    // one notch in (where the arrow lands) left the subtitle sliced mid-glyph.
    const scene = mount();
    await scene.position(0.01, 0.25);
    await scene.run(HEAD_REVEAL.durationMs / 2);
    expect(scene.reveal()).toBeGreaterThan(0);
    expect(scene.reveal()).toBeLessThan(1);
    await scene.run(HEAD_REVEAL.durationMs / 2 + 40);
    expect(scene.reveal()).toBe(1);
    expect(scene.travel()).toBe(0);
    expect(scene.about).not.toHaveAttribute('data-head-pending');
    expect(scene.clock.pending).toBe(0);
  });

  it('ignores a head layer value left behind while its stage is hidden', async () => {
    const scene = mount();
    const stage = scene.getByTestId('heading-stage');
    stage.dataset.active = 'false';
    await scene.position(0.01, 1);
    await scene.run(HEAD_REVEAL.durationMs);
    expect(scene.reveal()).toBe(0);
    expect(scene.clock.pending).toBe(0);
    stage.dataset.active = 'true';
    await scene.position(0.01, 1);
    await scene.run(HEAD_REVEAL.durationMs + 40);
    expect(scene.reveal()).toBe(1);
  });
  it('retracts the centered heading on the same clock when the reader backs out before it docks', async () => {
    const scene = mount();
    await scene.position(0.02, 0.5);
    await scene.run(HEAD_REVEAL.durationMs + 40);
    expect(scene.reveal()).toBe(1);
    await scene.position(0, 0);
    await scene.run(HEAD_REVEAL.durationMs / 2);
    expect(scene.reveal()).toBeGreaterThan(0);
    expect(scene.reveal()).toBeLessThan(1);
    await scene.run(HEAD_REVEAL.durationMs / 2 + 40);
    expect(scene.reveal()).toBe(0);
    expect(scene.travel()).toBe(0);
    expect(scene.clock.pending).toBe(0);
  });

  it('keeps the reduced-motion title at its normal inset without a movement clock', async () => {
    reduced.mockReturnValue(true);
    const scene = mount();
    await scene.position(0.5);
    expect(scene.travel()).toBe(1);
    expect(scene.reveal()).toBe(1);
    expect(scene.about).toHaveAttribute('data-head-settled', 'true');
    expect(scene.clock.pending).toBe(0);
  });

  it('releases the frame, flags and shared transform values on unmount', async () => {
    const scene = mount();
    await scene.position(0.5);
    await scene.run(700);
    expect(scene.clock.pending).toBe(1);
    scene.unmount();
    expect(scene.clock.pending).toBe(0);
    expect(scene.about).not.toHaveAttribute('data-head-pending');
    expect(scene.motion.style.getPropertyValue('--head-travel')).toBe('');
    expect(scene.motion.style.getPropertyValue('--head-reveal')).toBe('');
  });
});

it('reads both heading masks from the timed reveal, not the scroll-mapped layer', () => {
  const css = readFileSync(resolve('src', 'components', 'sections', 'About', 'About.module.css'), 'utf8');
  const mask = (name: string) => css.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1] ?? '';
  for (const name of ['--title-in', '--sub-in']) {
    expect(mask(name)).toContain('var(--head-reveal, var(--head-in, 0))');
  }
});
