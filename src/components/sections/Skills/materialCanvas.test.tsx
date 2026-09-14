import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SkillSculpture } from './SkillSculpture';
import { createMaterialCanvas } from './materialCanvas';

afterEach(() => {
  cleanup();
  delete document.documentElement.dataset.quality;
  vi.restoreAllMocks();
});

describe('adaptive Skills material rendering', () => {
  it('keeps one stable contour topology when surrounding state rerenders', () => {
    document.documentElement.dataset.quality = 'low';
    const { container, rerender } = render(<SkillSculpture shared />);
    const sculpture = container.querySelector('[data-skill-sculpture]')!;
    const shell = sculpture.querySelector('[data-material-shell]')!;
    const path = shell.getAttribute('d');
    expect(sculpture).toHaveAttribute('data-material-quality', 'economy');
    expect(sculpture.querySelectorAll('canvas[data-material-canvas]')).toHaveLength(1);
    document.documentElement.dataset.quality = 'high';
    rerender(<SkillSculpture shared />);
    expect(container.querySelector('[data-skill-sculpture]')).toBe(sculpture);
    expect(sculpture).toHaveAttribute('data-material-quality', 'economy');
    expect(shell.getAttribute('d')).toBe(path);
  });

  it('keeps the static fallback entirely vector based even on a low tier', () => {
    document.documentElement.dataset.quality = 'low';
    const { container } = render(<SkillSculpture scene="data" />);
    expect(container.querySelector('canvas')).toBeNull();
    expect(container.querySelector('[data-skill-sculpture]')).toHaveAttribute('data-material-quality', 'full');
  });

  it('retains SVG and reports the fallback if a 2D context is unavailable', () => {
    const canvas = document.createElement('canvas');
    const sculpture = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    vi.spyOn(canvas, 'getContext').mockReturnValue(null);
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(createMaterialCanvas(canvas, sculpture, 'economy')).toBeNull();
    expect(canvas.getContext).toHaveBeenCalledExactlyOnceWith('2d');
    expect(sculpture).not.toHaveAttribute('data-material-renderer');
    expect(warning).toHaveBeenCalledExactlyOnceWith(
      'Skills 2D material rendering is unavailable; retaining the SVG material.',
    );
  });
});
