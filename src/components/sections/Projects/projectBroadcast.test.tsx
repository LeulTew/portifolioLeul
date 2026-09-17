import { cleanup, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import gsap from 'gsap';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { animationClock } from '@/test/animationClock';
import { useCRTPowerOn, useProjectBroadcast } from './projectBroadcast';

let clock: ReturnType<typeof animationClock>;

function Broadcast({ selection = 1, reduced = false, details = false }) {
  const host = useRef<HTMLDivElement>(null);
  useProjectBroadcast(host, selection, true, reduced, details);
  return <div ref={host}>
    <img data-broadcast-image="" src="/images/projects/my-money.webp" alt="Project capture" />
    <h3 data-broadcast-title="">Project {selection}</h3>
    <p data-broadcast-copy="">Original accessible project description</p>
    <span data-broadcast-signal="" />
    <button type="button">Next project</button>
  </div>;
}

function Power({ powered = true, reduced = false }) {
  const host = useRef<HTMLDivElement>(null);
  useCRTPowerOn(host, powered, reduced);
  return <div ref={host}>
    <span data-crt-shutter="" data-testid="shutter" />
    <span data-crt-beam="" data-testid="beam" />
    <span data-crt-raster="" data-testid="raster" />
    <button type="button">Next project</button>
  </div>;
}

beforeEach(() => { clock = animationClock(); });
afterEach(() => {
  cleanup();
  gsap.ticker.sleep();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('latest-selection broadcast motion', () => {
  it('retargets immediately without changing semantic text or disabling controls', async () => {
    const { rerender } = render(<Broadcast />);
    gsap.ticker.sleep();
    await clock.run(50);
    rerender(<Broadcast selection={8} />);
    expect(screen.getByRole('heading')).toHaveTextContent('Project 8');
    expect(screen.getByText('Original accessible project description')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeEnabled();
    await clock.run(350);
    expect(screen.getByRole('heading').style.transform).toBe('');
    expect(screen.getByRole('heading').style.opacity).toBe('');
  });

  it('cleans all retargeted score styles and its own frames on unmount', async () => {
    const { rerender, unmount } = render(<Broadcast />);
    gsap.ticker.sleep();
    await clock.run(30);
    rerender(<Broadcast selection={3} />);
    unmount();
    gsap.ticker.sleep();
    expect(clock.pending).toBe(0);
  });

  it.each([{ reduced: true }, { details: true }])('keeps the reader still for %j', props => {
    render(<Broadcast {...props} />);
    expect(screen.getByRole('heading').style.transform).toBe('');
    expect(screen.getByRole('button')).toBeEnabled();
  });
});

describe('one bounded CRT power-on', () => {
  it('opens from a thin beam, settles crisply and never locks input', async () => {
    render(<Power />);
    gsap.ticker.sleep();
    expect(Number(gsap.getProperty(screen.getByTestId('beam'), 'scaleY'))).toBeLessThan(0.01);
    expect(screen.getByRole('button')).toBeEnabled();
    await clock.run(250);
    expect(Number(gsap.getProperty(screen.getByTestId('beam'), 'scaleY'))).toBeGreaterThan(0.01);
    expect(screen.getByRole('button')).toBeEnabled();
    await clock.run(500);
    expect(screen.getByTestId('beam').style.opacity).toBe('');
    expect(screen.getByTestId('shutter').style.opacity).toBe('');
  });

  it('cancels boot on a live preference or navigation change rather than leaving a shutter', async () => {
    const { rerender } = render(<Power />);
    gsap.ticker.sleep();
    await clock.run(80);
    rerender(<Power reduced />);
    expect(screen.getByTestId('beam').style.transform).toBe('');
    expect(screen.getByTestId('shutter').style.opacity).toBe('');
    rerender(<Power powered={false} />);
    expect(screen.getByRole('button')).toBeEnabled();
  });

  it('does not consume a hidden interval or leave its own playback running after completion', async () => {
    let hidden = false;
    vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
    render(<Power />);
    gsap.ticker.sleep();
    await clock.run(80);
    const opacity = screen.getByTestId('beam').style.opacity;
    hidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
    await clock.run(3000);
    expect(screen.getByTestId('beam').style.opacity).toBe(opacity);
    hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
    await clock.run(640);
    expect(screen.getByTestId('beam').style.opacity).toBe('');
    gsap.ticker.sleep();
    expect(clock.pending).toBe(0);
  });
});
