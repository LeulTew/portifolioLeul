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

  it('carries one ground for the run, with the next depth over it', () => {
    mount();
    const ground = screen.getByTestId('held-ground');
    expect(ground.querySelectorAll('[data-testid="ground-wash"]')).toHaveLength(2);
  });

  it('cuts the ground back rather than sliding a panel over it', () => {
    // A panel sliding off the right of a ground that still spans the screen
    // uncovers more ground, which is no reveal at all.
    mount();
    const edge = screen.getByTestId('held-aperture');
    expect(screen.getByTestId('held-ground').contains(edge)).toBe(false);
  });

  it('opens the aperture only once the reader is into the section', () => {
    mount();
    const about = document.getElementById('about')!;
    const education = document.getElementById('education')!;
    about.getBoundingClientRect = () =>
      ({ top: -400, bottom: 1200, height: 1600 }) as DOMRect;
    // Education has only just reached the top of the screen.
    education.getBoundingClientRect = () =>
      ({ top: -20, bottom: 1580, height: 1600 }) as DOMRect;

    act(() => setScrollProgress(0.4));
    const backdrop = screen.getByTestId('held-backdrop');
    expect(Number(backdrop.style.getPropertyValue('--aperture-in'))).toBe(0);
    // The depth, though, belongs to the section and changes with it.
    expect(
      Number(backdrop.style.getPropertyValue('--depth-in'))
    ).toBeGreaterThan(0);
  });

  it('has the aperture fully open by the middle of the section', () => {
    mount();
    const about = document.getElementById('about')!;
    const education = document.getElementById('education')!;
    about.getBoundingClientRect = () =>
      ({ top: -1400, bottom: 200, height: 1600 }) as DOMRect;
    education.getBoundingClientRect = () =>
      ({ top: -(1600 - 800) * 0.6, bottom: 500, height: 1600 }) as DOMRect;

    act(() => setScrollProgress(0.7));
    expect(
      Number(
        screen.getByTestId('held-backdrop').style.getPropertyValue('--aperture-in')
      )
    ).toBe(1);
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
