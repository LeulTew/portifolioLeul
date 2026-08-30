import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { HeldBackdrop } from './HeldBackdrop';
import { runProgress, runGround } from './runProgress';
import { setScrollProgress, resetScrollProgress } from '@/lib/scroll/scrollProgress';

describe('runProgress', () => {
  it('is nothing before the run reaches the top of the screen', () => {
    expect(runProgress(800, 3200, 800)).toBe(0);
  });

  it('is complete once the run has been spent', () => {
    expect(runProgress(-(3200 - 800), 3200, 800)).toBe(1);
  });

  it('runs evenly through the whole run, boundaries included', () => {
    expect(runProgress(-(3200 - 800) / 2, 3200, 800)).toBeCloseTo(0.5, 6);
  });

  it('yields nothing rather than NaN on a bad measurement', () => {
    expect(runProgress(Number.NaN, 3200, 800)).toBe(0);
    expect(runProgress(0, 0, 800)).toBe(0);
    expect(runProgress(0, 3200, 0)).toBe(0);
  });
});

describe('runGround', () => {
  it('is up for the whole middle of the run', () => {
    // The point of one ground: it does not dip at a section boundary.
    for (const at of [0.2, 0.35, 0.5, 0.65, 0.8]) {
      expect(runGround(at)).toBe(1);
    }
  });

  it('ramps at the ends rather than switching', () => {
    expect(runGround(0.01)).toBeGreaterThan(0);
    expect(runGround(0.01)).toBeLessThan(1);
    expect(runGround(0.99)).toBeGreaterThan(0);
    expect(runGround(0.99)).toBeLessThan(1);
  });

  it('is gone outside the run', () => {
    expect(runGround(0)).toBe(0);
    expect(runGround(1)).toBe(0);
    expect(runGround(-1)).toBe(0);
  });
});

describe('HeldBackdrop', () => {
  beforeEach(() => resetScrollProgress());

  const mount = () =>
    render(
      <>
        <section id="about" />
        <section id="education" />
        <HeldBackdrop from="about" to="education" apertureId="education" />
      </>
    );

  it('lives outside the scrolling flow', () => {
    // `fixed` resolves against the nearest transformed ancestor, and every
    // section here lives inside a transformed container.
    mount();
    expect(screen.getByTestId('held-backdrop').parentElement).toBe(document.body);
  });

  it('stays hidden until the run is on screen', () => {
    mount();
    expect(screen.getByTestId('held-backdrop').dataset.active).toBe('false');
  });

  it('carries one ground for the run, plus the half that draws back', () => {
    mount();
    const backdrop = screen.getByTestId('held-backdrop');
    expect(backdrop.querySelectorAll('[data-testid="ground-wash"]')).toHaveLength(2);
    expect(screen.getByTestId('held-aperture')).toBeInTheDocument();
  });

  it('publishes the run without re-rendering to do it', () => {
    mount();
    const about = document.getElementById('about')!;
    const education = document.getElementById('education')!;
    about.getBoundingClientRect = () =>
      ({ top: -1200, bottom: 400, height: 1600 }) as DOMRect;
    education.getBoundingClientRect = () =>
      ({ top: 400, bottom: 2000, height: 1600 }) as DOMRect;

    act(() => setScrollProgress(0.5));

    const backdrop = screen.getByTestId('held-backdrop');
    expect(backdrop.dataset.active).toBe('true');
    expect(backdrop.style.getPropertyValue('--run')).not.toBe('');
    expect(backdrop.style.getPropertyValue('--ground-in')).not.toBe('');
  });
});
