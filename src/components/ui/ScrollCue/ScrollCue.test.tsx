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

  it('holds undrawn until its cue is reached', () => {
    render(<ScrollCue />);
    expect(cue()).toHaveAttribute('data-drawn', 'false');
  });

  it('draws when told to', () => {
    render(<ScrollCue drawn />);
    expect(cue()).toHaveAttribute('data-drawn', 'true');
  });

  it('normalises path length, so the dash maths is independent of geometry', () => {
    render(<ScrollCue drawn />);
    for (const id of ['scroll-cue-trace', 'scroll-cue-current']) {
      expect(screen.getByTestId(id)).toHaveAttribute('pathLength', '100');
    }
  });

  it('runs the current along the same geometry as the line it drew', () => {
    render(<ScrollCue drawn />);
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
