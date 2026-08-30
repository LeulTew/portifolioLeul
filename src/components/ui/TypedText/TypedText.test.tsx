import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TypedText } from './TypedText';

const TEXT = 'I build the parts people touch.';

describe('TypedText', () => {
  it('places every character up front', () => {
    // Laid out from the start, so nothing reflows as it types. A width
    // animation re-wraps the paragraph while it is being read.
    render(<TypedText text={TEXT} />);
    expect(screen.getAllByTestId('typed-glyph')).toHaveLength(TEXT.length);
  });

  it('numbers the characters in reading order', () => {
    render(<TypedText text="abc" />);
    const positions = screen
      .getAllByTestId('typed-glyph')
      .map((g) => g.style.getPropertyValue('--i'));
    expect(positions).toEqual(['0', '1', '2']);
  });

  it('tells the stylesheet how many there are to type', () => {
    render(<TypedText text={TEXT} />);
    expect(screen.getByTestId('typed-text').style.getPropertyValue('--n')).toBe(
      String(TEXT.length)
    );
  });

  it('reads the progress from whichever property the sequence publishes', () => {
    render(<TypedText text="hi" typedVar="--beat-in" />);
    expect(
      screen.getByTestId('typed-text').style.getPropertyValue('--typed')
    ).toBe('var(--beat-in, 0)');
  });

  it('keeps words unbreakable, so a line cannot split one mid-word', () => {
    const { container } = render(<TypedText text="one two three" />);
    expect(container.querySelectorAll('[class*="word"]')).toHaveLength(3);
  });

  it('keeps the trailing space inside the word before it', () => {
    // Otherwise a line can break on a character that has not been typed yet.
    render(<TypedText text="a b" />);
    expect(screen.getAllByTestId('typed-glyph')).toHaveLength(3);
  });

  it('stays readable to assistive technology, which cannot see the typing', () => {
    render(<TypedText text={TEXT} />);
    expect(screen.getByTestId('typed-text')).toHaveAccessibleName(TEXT);
    for (const word of screen.getByTestId('typed-text').children) {
      expect(word).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('renders nothing for empty text rather than a stray caret', () => {
    render(<TypedText text="" />);
    expect(screen.queryAllByTestId('typed-glyph')).toHaveLength(0);
  });
});
