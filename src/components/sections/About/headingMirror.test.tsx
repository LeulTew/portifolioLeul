import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { About } from './About';

/**
 * The white half of the heading has to BE the heading.
 *
 * There is no way in CSS to paint one run of text in two colours split by an
 * arbitrary 2D boundary, so the two-tone effect the rising green produces needs
 * a second paint of the same words. That copy is only honest for as long as it
 * says exactly what the real heading says, at exactly the same strength.
 *
 * It did not. It carried a hardcoded "About Me", so while the real heading
 * typed itself into "Education" the copy went on insisting on the old title --
 * two different words stacked on each other wherever the green had reached.
 */
describe('the masked heading mirrors the real one', () => {
  const seqTo = async (value: string) => {
    const overlay = screen.getByTestId('about-sequence-overlay');
    overlay.style.setProperty('--seq', value);
    window.dispatchEvent(new Event('scroll'));
    await new Promise((resolve) => setTimeout(resolve, 20));
  };

  const state = () => {
    const real = screen.getByTestId('title-pixel-transition-heading');
    const mirror = screen.getByTestId('about-masked-title');
    return {
      realText: real.textContent ?? '',
      mirrorText: mirror.getAttribute('data-text') ?? '',
      realOpacity: real.style.opacity,
      mirrorOpacity: mirror.style.opacity,
    };
  };

  it.each([
    ['before anything has moved', '0.20'],
    ['as the green rises', '0.80'],
    ['part way through the rewrite', '0.90'],
    ['once it has settled', '1.00'],
  ])('says the same words %s', async (_when, seq) => {
    render(<About />);
    await seqTo(seq);
    const at = state();

    expect(at.mirrorText).toBe(at.realText);
    expect(at.mirrorOpacity).toBe(at.realOpacity);
  });

  it('follows the heading all the way into Education', async () => {
    render(<About />);
    await seqTo('0.20');
    expect(state().mirrorText).toBe('About Me');

    await seqTo('1.00');
    expect(state().realText).toBe('Education');
    expect(state().mirrorText).toBe('Education');
  });

  it('mirrors the subtitle too', async () => {
    render(<About />);
    await seqTo('1.00');
    const real = document.querySelector<HTMLElement>(
      '[data-testid="title-pixel-transition"] p'
    );
    const mirror = screen.getByTestId('about-masked-subtitle');

    expect(mirror.getAttribute('data-text')).toBe(real?.textContent);
  });
});

describe('the masked heading is not styled as a separate thing', () => {
  // Read as source: these are the kind of failure that has no runtime signal
  // at all -- the effect still renders, it just renders as two headings.
  const css = () => readFileSync(join(__dirname, 'About.module.css'), 'utf-8');

  /** The one rule that turns off everything the mirror could inherit. */
  const neutraliser = () => {
    const source = css().replace(/\/\*[\s\S]*?\*\//g, '');
    const match = source.match(
      /\.heldHeaderWhite \.titleWhite,\s*\.heldHeaderWhite \.subtitleWhite \{([^}]*)\}/
    );
    if (!match) throw new Error('the mirror neutraliser rule is gone');
    return match[1];
  };

  it.each([
    // A glow around white letters sitting exactly on top of the same letters in
    // ink does not read as one two-tone heading. It reads as two, out of
    // register -- which is what it was.
    ['text-shadow', /text-shadow:\s*none/],
    // `.heldHeader .title` animates a clip-path and a 1.2% scale as the heading
    // arrives. The mirror recolours one that has already arrived.
    ['clip-path', /clip-path:\s*none/],
    ['transform', /transform:\s*none/],
    // Opacity is written every frame to both from the same call, so an ease on
    // either would put the two layers on different clocks.
    ['transition', /transition:\s*none/],
  ])('turns off inherited %s', (_property, pattern) => {
    expect(neutraliser()).toMatch(pattern);
  });
});
