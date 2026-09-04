import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ScrollCue } from './ScrollCue';

const cue = () => screen.getByTestId('scroll-cue');

describe('ScrollCue', () => {
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

  it('traces in step with the reader, not on a clock of its own', () => {
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

  it('keeps the bulge the original mark was drawn with', () => {
    /*
     * Recovered from its border-radius: two arcs bulging left, radii 181.6 and
     * 118.4. The sweep has since been drawn further down by scaling it
     * vertically, which turns those circles into ellipses -- so the horizontal
     * radii are the part that must not have moved. Checking those rather than
     * the literal string is the difference between pinning the shape and
     * pinning the last edit.
     */
    render(<ScrollCue />);
    const d = screen.getByTestId('scroll-cue-trace').getAttribute('d') ?? '';

    const radii = [...d.matchAll(/A\s+(-?[\d.]+)\s+(-?[\d.]+)/g)].map((m) => ({
      rx: Number(m[1]),
      ry: Number(m[2]),
    }));

    expect(radii.map((r) => r.rx)).toEqual([181.6, 118.4, 60]);
    // Stretched down, never squashed, and all by the same amount.
    const stretch = radii.map((r) => r.ry / r.rx);
    for (const factor of stretch) expect(factor).toBeCloseTo(stretch[0], 2);
    expect(stretch[0]).toBeGreaterThan(1);
    // Still bulges to the same place across.
    expect(d).toContain(' 0 213.7');
    expect(d).toContain('34.7 318.3');
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
    const arcs = [...trace.matchAll(
      /A\s+[\d.]+\s+[\d.]+\s+[\d.]+\s+[01]\s+[01]\s+(-?[\d.]+)\s+(-?[\d.]+)/g
    )];
    const lastArcEnd = arcs.at(-1);

    expect(lastArcEnd).toBeDefined();
    expect(Number(lastArcEnd![1])).toBeCloseTo(Number(run![1]), 6);
    // And it genuinely travels afterwards, rather than ending where it arrived.
    expect(Number(run![2])).toBeGreaterThan(Number(lastArcEnd![2]));
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
    expect(cue()).toHaveAttribute('role', 'button');
    expect(cue()).toHaveAttribute('tabindex', '0');
    expect(cue()).toHaveAccessibleName('Scroll to about section');
  });

  it('activates on click and on keyboard', () => {
    const onActivate = vi.fn();
    render(<ScrollCue onActivate={onActivate} />);

    fireEvent.click(cue());
    fireEvent.keyDown(cue(), { key: 'Enter' });
    fireEvent.keyDown(cue(), { key: ' ' });

    expect(onActivate).toHaveBeenCalledTimes(3);
  });

  it('ignores keys that are not activation keys', () => {
    const onActivate = vi.fn();
    render(<ScrollCue onActivate={onActivate} />);

    fireEvent.keyDown(cue(), { key: 'a' });
    expect(onActivate).not.toHaveBeenCalled();
  });

  it('does not blow up without a handler', () => {
    render(<ScrollCue />);
    expect(() => fireEvent.click(cue())).not.toThrow();
  });
});
