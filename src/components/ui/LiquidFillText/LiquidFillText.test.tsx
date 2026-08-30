import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { LiquidFillText } from './LiquidFillText';
import { charDelayMs, BASE_STEP_MS } from './charDelay';

const chars = () => screen.getAllByTestId('liquid-fill-char');

describe('charDelayMs', () => {
  it('starts the first letter immediately', () => {
    expect(charDelayMs(0)).toBe(0);
  });

  it('spaces letters along the word', () => {
    expect(charDelayMs(1)).toBeGreaterThan(0);
    expect(charDelayMs(5)).toBeGreaterThan(charDelayMs(1));
  });

  it('decelerates, so the stagger does not march', () => {
    // A fixed interval reads as mechanical; each step should be shorter than
    // the one before it.
    const steps = [1, 2, 3, 4, 5, 6].map((i) => charDelayMs(i) - charDelayMs(i - 1));
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i]).toBeLessThanOrEqual(steps[i - 1]);
    }
  });

  it('honours a custom step', () => {
    expect(charDelayMs(1, 100)).toBe(100);
    expect(charDelayMs(1, BASE_STEP_MS)).toBe(BASE_STEP_MS);
  });

  it('treats non-finite input as the head of the word', () => {
    expect(charDelayMs(Number.NaN)).toBe(0);
    expect(charDelayMs(-4)).toBe(0);
  });
});

describe('LiquidFillText', () => {
  it('renders one element per character', () => {
    render(<LiquidFillText text="Leul" />);
    expect(chars()).toHaveLength(4);
  });

  it('carries each glyph so the snow can be clipped to it', () => {
    render(<LiquidFillText text="Le" />);
    expect(chars().map((c) => c.dataset.char)).toEqual(['L', 'e']);
  });

  it('keeps the word readable to assistive technology', () => {
    render(<LiquidFillText text="Tewodros" />);
    expect(screen.getByTestId('liquid-fill-text')).toHaveAccessibleName('Tewodros');
    for (const char of chars()) {
      expect(char).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('holds hollow until its cue is reached', () => {
    render(<LiquidFillText text="Leul" />);
    expect(screen.getByTestId('liquid-fill-text')).toHaveAttribute(
      'data-filling',
      'false'
    );
  });

  it('fills when its cue arrives', () => {
    render(<LiquidFillText text="Leul" filling />);
    expect(screen.getByTestId('liquid-fill-text')).toHaveAttribute(
      'data-filling',
      'true'
    );
  });

  it('offsets every letter by the layer delay plus its own', () => {
    render(<LiquidFillText text="Leul" filling delayMs={1000} />);
    const delays = chars().map((c) => c.style.getPropertyValue('--char-delay'));

    expect(delays[0]).toBe('1000ms');
    expect(Number.parseInt(delays[1], 10)).toBe(1000 + charDelayMs(1));
    expect(Number.parseInt(delays[3], 10)).toBeGreaterThan(
      Number.parseInt(delays[1], 10)
    );
  });

  it('carries its fill duration to the animation', () => {
    render(<LiquidFillText text="Leul" filling durationMs={1200} />);
    expect(
      screen.getByTestId('liquid-fill-text').style.getPropertyValue('--fill-duration')
    ).toBe('1200ms');
  });

  it('keeps spaces as spaces rather than fillable glyphs', () => {
    render(<LiquidFillText text="a b" />);
    expect(chars()).toHaveLength(2);
  });

  it('renders no glyphs for empty text', () => {
    render(<LiquidFillText text="" />);
    expect(screen.queryAllByTestId('liquid-fill-char')).toHaveLength(0);
  });
});
