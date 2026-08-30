import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ParallaxPlate } from './ParallaxPlate';
import { layerShift, layerTurn, DEPTHS } from './depth';

const shiftOf = (el: HTMLElement) =>
  Number(/translate3d\(0(?:px)?, (-?[\d.]+)px/.exec(el.style.transform)?.[1]);

describe('layerShift', () => {
  it('holds still at the middle of the stage', () => {
    for (const depth of DEPTHS) {
      expect(layerShift(0.5, depth, 64)).toBe(0);
    }
  });

  it('leans opposite ways either side of the middle', () => {
    expect(layerShift(0.1, 1, 64)).toBeLessThan(0);
    expect(layerShift(0.9, 1, 64)).toBeGreaterThan(0);
  });

  it('moves a near layer further than a far one', () => {
    // Without this there is no parallax, only a picture sliding about.
    const near = Math.abs(layerShift(1, 1, 64));
    const far = Math.abs(layerShift(1, 0.18, 64));
    expect(near).toBeGreaterThan(far);
  });

  it('clamps depth, so a bad value cannot outrun the nearest plane', () => {
    expect(Math.abs(layerShift(1, 4, 64))).toBe(Math.abs(layerShift(1, 1, 64)));
    expect(layerShift(1, -2, 64)).toBe(0);
  });

  it('yields no movement rather than NaN on a bad measurement', () => {
    expect(layerShift(Number.NaN, 1, 64)).toBe(0);
    expect(layerShift(0.5, Number.NaN, 64)).toBe(0);
    expect(layerShift(0.5, 1, Number.NaN)).toBe(0);
  });
});

describe('ParallaxPlate', () => {
  it('draws one plane per depth, plus a horizon to fix them in space', () => {
    render(<ParallaxPlate />);
    expect(screen.getAllByTestId('parallax-plane')).toHaveLength(DEPTHS.length);
    expect(screen.getByTestId('parallax-horizon')).toBeInTheDocument();
  });

  it('separates the planes as the stage moves', () => {
    render(<ParallaxPlate progress={1} />);
    const shifts = screen.getAllByTestId('parallax-plane').map(shiftOf);
    expect(new Set(shifts).size).toBe(shifts.length);
  });

  it('fades with the stage it belongs to', () => {
    render(<ParallaxPlate presence={0.4} />);
    expect(screen.getByTestId('parallax-plate').style.opacity).toBe('0.4');
  });

  it('holds every plane still for reduced motion', () => {
    render(<ParallaxPlate progress={1} reducedMotion />);
    for (const plane of screen.getAllByTestId('parallax-plane')) {
      expect(plane.style.transform).toBe('');
    }
  });

  it('stays out of the accessibility tree: it carries no information', () => {
    render(<ParallaxPlate />);
    expect(screen.getByTestId('parallax-plate')).toHaveAttribute(
      'aria-hidden',
      'true'
    );
  });
});

describe('layerTurn', () => {
  it('holds square at the middle of the stage', () => {
    expect(layerTurn(0.5, 1, 0, 14)).toBe(0);
  });

  it('counter-rotates neighbours, so the gaps open and close', () => {
    // Turning the whole stack together is just a rotating picture.
    expect(Math.sign(layerTurn(1, 1, 0, 14))).toBe(
      -Math.sign(layerTurn(1, 1, 1, 14))
    );
  });

  it('turns a near plane further than a far one', () => {
    expect(Math.abs(layerTurn(1, 1, 0, 14))).toBeGreaterThan(
      Math.abs(layerTurn(1, 0.18, 0, 14))
    );
  });

  it('yields no rotation rather than NaN on a bad measurement', () => {
    expect(layerTurn(Number.NaN, 1, 0, 14)).toBe(0);
    expect(layerTurn(0.5, Number.NaN, 0, 14)).toBe(0);
    expect(layerTurn(0.5, 1, 0, Number.NaN)).toBe(0);
  });
});
