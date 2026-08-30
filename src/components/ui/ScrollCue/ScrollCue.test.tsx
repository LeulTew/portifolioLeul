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

  it('follows the arcs the original mark was drawn with', () => {
    // Recovered from its border-radius: two arcs bulging left, radii 181.6
    // and 118.4, with the head where `.point` sat.
    render(<ScrollCue />);
    const d = screen.getByTestId('scroll-cue-trace').getAttribute('d') ?? '';
    expect(d).toContain('181.6 181.6');
    expect(d).toContain('118.4 118.4');
    expect(d).toContain('34.7 265.3');
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
    // The straight run shares its x with the arc that fed it: it is vertical.
    expect(trace).toContain(`A 60 60 0 0 1 ${run![1]} `);
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
