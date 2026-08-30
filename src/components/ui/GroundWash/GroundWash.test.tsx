import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { GroundWash } from './GroundWash';
import { groundFor, groundSections } from './groundPalette';

describe('groundFor', () => {
  it('gives every held section a ground in both themes', () => {
    for (const section of groundSections()) {
      for (const theme of ['dark', 'light'] as const) {
        const ground = groundFor(section, theme);
        expect(ground.base).toMatch(/^#[0-9a-f]{6}$/i);
        expect(ground.surface).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });

  it('separates the sections, so moving between them is visible', () => {
    const [first, second] = groundSections();
    expect(groundFor(first, 'dark').base).not.toBe(
      groundFor(second, 'dark').base
    );
  });

  it('inverts between themes rather than reusing one palette', () => {
    // A dark ground on a light page is not a theme, it is a bug.
    const luminance = (hex: string) =>
      parseInt(hex.slice(1, 3), 16) +
      parseInt(hex.slice(3, 5), 16) +
      parseInt(hex.slice(5, 7), 16);

    for (const section of groundSections()) {
      expect(luminance(groundFor(section, 'light').base)).toBeGreaterThan(
        luminance(groundFor(section, 'dark').base)
      );
    }
  });

  it('keeps the surface distinct from the body it rides on', () => {
    for (const section of groundSections()) {
      const ground = groundFor(section, 'dark');
      expect(ground.surface).not.toBe(ground.base);
    }
  });

  it('falls back rather than rendering an unpainted ground', () => {
    // An unknown section must still cover the world; a missing colour would
    // leave the held copy sitting on the live scene.
    expect(groundFor('nowhere', 'dark').base).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe('GroundWash', () => {
  it('carries its section colours as properties', () => {
    render(<GroundWash section="about" />);
    const wash = screen.getByTestId('ground-wash');
    expect(wash.style.getPropertyValue('--ground-base')).toBe(
      groundFor('about', 'dark').base
    );
  });

  it('reads the rise from whichever property the sequence publishes', () => {
    render(<GroundWash section="education" rise="--panel-in" />);
    expect(
      screen.getByTestId('ground-wash').style.getPropertyValue('--rise')
    ).toBe('var(--panel-in, 0)');
  });

  it('takes the light palette when the page is light', () => {
    render(<GroundWash section="about" theme="light" />);
    expect(
      screen.getByTestId('ground-wash').style.getPropertyValue('--ground-base')
    ).toBe(groundFor('about', 'light').base);
  });

  it('stays out of the accessibility tree', () => {
    render(<GroundWash section="about" />);
    expect(screen.getByTestId('ground-wash')).toHaveAttribute(
      'aria-hidden',
      'true'
    );
  });
});
