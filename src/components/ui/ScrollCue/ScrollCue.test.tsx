import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ScrollCue } from './ScrollCue';
import { cueRunOffset, CUE_RUN_X, CUE_STROKE_WIDTH, CUE_VIEW_WIDTH, cueViewX } from './cueGeometry';

const cue = () => screen.getByTestId('scroll-cue');

describe('ScrollCue', () => {
  it('keeps the full curve inside a narrow margin without moving the landing vertical', () => {
    const { rerender } = render(<ScrollCue progress={0.5} />);
    const left = 24 - cueRunOffset(76);
    expect(left).toBeGreaterThan(0);
    expect(left + 76).toBeLessThan(1024);
    const runLeft = left + (CUE_RUN_X - cueViewX()) * 76 / CUE_VIEW_WIDTH - CUE_STROKE_WIDTH / 2;
    expect(runLeft).toBeCloseTo(24);
    expect(cue().querySelectorAll('path')).toHaveLength(3);
    rerender(<ScrollCue mirrored progress={0.5} />);
    expect(cue().querySelector('g')).toHaveAttribute('transform', `translate(${2 * CUE_RUN_X} 0) scale(-1 1)`);
  });

  it('renders a real path, not a styled box', () => {
    // A border-radius div cannot be drawn on; a path can.
    render(<ScrollCue />);
    expect(screen.getByTestId('scroll-cue-trace').tagName.toLowerCase()).toBe('path');
  });

  it('is untraced while the reader has not moved', () => {
    render(<ScrollCue />);
    expect(cue()).toHaveAttribute('data-progress', '0.000');
    // Fully offset means none of the line is showing.
    expect(screen.getByTestId('scroll-cue-trace')).toHaveAttribute(
      'stroke-dashoffset',
      '100'
    );
  });

  it('renders the supplied progress without adding a second animation clock', () => {
    const { rerender } = render(<ScrollCue progress={0.25} />);
    expect(screen.getByTestId('scroll-cue-trace')).toHaveAttribute(
      'stroke-dashoffset',
      '75'
    );

    rerender(<ScrollCue progress={0.6} />);
    expect(screen.getByTestId('scroll-cue-trace')).toHaveAttribute(
      'stroke-dashoffset',
      '40'
    );
  });

  it('completes the line at full progress', () => {
    render(<ScrollCue progress={1} />);
    expect(screen.getByTestId('scroll-cue-trace')).toHaveAttribute(
      'stroke-dashoffset',
      '0'
    );
  });

  it('holds the head back until the line reaches it', () => {
    const { rerender } = render(<ScrollCue progress={0.5} />);
    expect(screen.getByTestId('scroll-cue-head')).toHaveAttribute(
      'stroke-dashoffset',
      '100'
    );

    rerender(<ScrollCue progress={1} />);
    expect(screen.getByTestId('scroll-cue-head')).toHaveAttribute(
      'stroke-dashoffset',
      '0'
    );
  });

  it('only lets the current flow once the whole line is drawn', () => {
    const { rerender } = render(<ScrollCue progress={0.8} />);
    expect(screen.getByTestId('scroll-cue-current')).toHaveAttribute(
      'data-flowing',
      'false'
    );

    rerender(<ScrollCue progress={1} />);
    expect(screen.getByTestId('scroll-cue-current')).toHaveAttribute(
      'data-flowing',
      'true'
    );
  });

  it('clamps progress outside the normalized range', () => {
    const { rerender } = render(<ScrollCue progress={-3} />);
    expect(cue()).toHaveAttribute('data-progress', '0.000');
    rerender(<ScrollCue progress={9} />);
    expect(cue()).toHaveAttribute('data-progress', '1.000');
  });

  it('draws alternating S bends without kinks between their vertical tangents', () => {
    render(<ScrollCue />);
    const d = screen.getByTestId('scroll-cue-trace').getAttribute('d') ?? '';

    const curves = [...d.matchAll(/C\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/g)]
      .map(match => match.slice(1).map(Number));
    expect(curves).toHaveLength(3);
    expect(curves[0][4]).toBeLessThan(CUE_RUN_X);
    expect(curves[1][4]).toBeGreaterThan(CUE_RUN_X);
    for (let index = 0; index < curves.length - 1; index++) {
      expect(curves[index][2]).toBe(curves[index][4]);
      expect(curves[index + 1][0]).toBe(curves[index][4]);
      expect(curves[index + 1][1]).toBeGreaterThan(curves[index][5]);
    }
  });

  it.each([0, 180, 850, 2500])('spreads all three broad turns through %i units of extra rail', (run) => {
    render(<ScrollCue run={run} progress={1} />);
    const trace = screen.getByTestId('scroll-cue-trace').getAttribute('d') ?? '';
    const curves = [...trace.matchAll(/C\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/g)]
      .map(match => match.slice(1).map(Number));
    const end = /L\s+[\d.]+\s+([\d.]+)\s*$/.exec(trace);
    expect(curves).toHaveLength(3);
    expect(end).not.toBeNull();
    const height = Number(end![1]) - 12;
    const ends = curves.map(curve => (curve[5] - 12) / height);
    expect(ends[0]).toBeGreaterThan(0.3);
    expect(ends[0]).toBeLessThan(0.4);
    expect(ends[1]).toBeGreaterThan(0.6);
    expect(ends[1]).toBeLessThan(0.75);
    expect(ends[2]).toBeGreaterThan(0.85);
    expect(Number(end![1]) - curves[2][5]).toBeCloseTo(44, 3);

    const horizontalSpan = Math.max(...curves.map(curve => curve[4])) -
      Math.min(...curves.map(curve => curve[4]));
    expect(horizontalSpan * 112 / CUE_VIEW_WIDTH).toBeGreaterThanOrEqual(90);
    expect(screen.getByTestId('scroll-cue-current')).toHaveAttribute('d', trace);
  });

  it('lands the head on the end of the line, pointing along it', () => {
    // The original head floated ~100px below the curve pointing straight down,
    // which read as a detached mark rather than an arrow. Derived from the
    // paths rather than hardcoded, so it still holds when the line is reshaped.
    render(<ScrollCue progress={1} />);
    const head = screen.getByTestId('scroll-cue-head').getAttribute('d') ?? '';
    const trace = screen.getByTestId('scroll-cue-trace').getAttribute('d') ?? '';

    const points = (d: string) =>
      [...d.matchAll(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)(?=\s|$)/g)].map(
        (m) => [Number(m[1]), Number(m[2])] as const
      );

    const traceEnd = points(trace).at(-1)!;
    // The chevron's tip is its middle point: barb, tip, barb.
    const tip = points(head)[1];

    expect(Math.hypot(tip[0] - traceEnd[0], tip[1] - traceEnd[1])).toBeLessThan(1);
  });

  it('turns the line to plumb before it ends', () => {
    // A mark bridging into the next section has to arrive pointing at it. The
    // line used to stop mid-air on a 45 degree tangent, aimed off to one side.
    render(<ScrollCue progress={1} />);
    const trace = screen.getByTestId('scroll-cue-trace').getAttribute('d') ?? '';
    const run = /L\s+(-?[\d.]+)\s+(-?[\d.]+)\s*$/.exec(trace.trim());

    expect(run).not.toBeNull();

    /*
     * The straight run shares its x with the arc that fed it, so the join is
     * vertical. Read off the path rather than matched as a string: the arc is
     * an ellipse now that the sweep has been drawn downwards, and this has to
     * keep holding whatever the radii become. It is the invariant that stops
     * the curve and the run kinking where they meet.
     */
    const curves = [...trace.matchAll(
      /C\s+[\d.]+\s+[\d.]+\s+([\d.]+)\s+[\d.]+\s+([\d.]+)\s+([\d.]+)/g
    )];
    const lastCurve = curves.at(-1);

    expect(lastCurve).toBeDefined();
    expect(Number(lastCurve![1])).toBeCloseTo(Number(run![1]), 6);
    expect(Number(lastCurve![2])).toBeCloseTo(Number(run![1]), 6);
    // And it genuinely travels afterwards, rather than ending where it arrived.
    expect(Number(run![2])).toBeGreaterThan(Number(lastCurve![3]));
  });

  it('normalises path length, so the dash maths is independent of geometry', () => {
    render(<ScrollCue progress={1} />);
    for (const id of ['scroll-cue-trace', 'scroll-cue-current']) {
      expect(screen.getByTestId(id)).toHaveAttribute('pathLength', '100');
    }
  });

  it('runs the current along the same geometry as the line it drew', () => {
    render(<ScrollCue progress={1} />);
    expect(screen.getByTestId('scroll-cue-current').getAttribute('d')).toBe(
      screen.getByTestId('scroll-cue-trace').getAttribute('d')
    );
  });

  it('is reachable as a control', () => {
    render(<ScrollCue label="Scroll to about section" />);
    expect(cue().tagName).toBe('BUTTON');
    expect(cue()).toHaveAccessibleName('Scroll to about section');
  });

  it('activates on click and on keyboard', async () => {
    const onActivate = vi.fn();
    render(<ScrollCue onActivate={onActivate} />);

    fireEvent.click(cue());
    cue().focus();
    await userEvent.keyboard('{Enter} ');

    expect(onActivate).toHaveBeenCalledTimes(3);
  });

  it('ignores keys that are not activation keys', () => {
    const onActivate = vi.fn();
    render(<ScrollCue onActivate={onActivate} />);

    fireEvent.keyDown(cue(), { key: 'a' });
    expect(onActivate).not.toHaveBeenCalled();
  });

  it.each(['Enter', ' '])('leaves the activation key %j uncancelled', async (key) => {
    const onActivate = vi.fn();
    render(<ScrollCue onActivate={onActivate} />);
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    fireEvent(cue(), event);
    expect(event.defaultPrevented).toBe(false);
    cue().focus();
    await userEvent.keyboard(key === 'Enter' ? '{Enter}' : ' ');
    expect(onActivate).toHaveBeenCalledOnce();
  });

  it('does not blow up without a handler', () => {
    render(<ScrollCue />);
    expect(() => fireEvent.click(cue())).not.toThrow();
  });
});
