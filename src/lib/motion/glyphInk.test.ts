import { describe, expect, it, vi, afterEach } from 'vitest';
import { firstGlyphInkOffset, fontShorthand } from './glyphInk';

const FONT = 'normal 800 108px Inter, sans-serif';

/** Stands in for a canvas whose metrics we control. */
function stubCanvas(
  metrics: Partial<TextMetrics> | null,
  reportedFont = FONT
) {
  const context = metrics && {
    set font(_v: string) {
      /* the element under test writes it; the getter below is the answer */
    },
    get font() {
      return reportedFont;
    },
    measureText: () => metrics as TextMetrics,
  };
  vi.spyOn(document, 'createElement').mockReturnValue({
    getContext: () => context ?? null,
  } as unknown as HTMLElement);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('firstGlyphInkOffset', () => {
  it('reports the air the glyph leaves before its ink', () => {
    // actualBoundingBoxLeft measures leftwards, so ink inside the box is
    // negative -- the Windows fallback `A` at a display size.
    stubCanvas({ actualBoundingBoxLeft: -14.2, width: 81 });
    expect(firstGlyphInkOffset('About Me', FONT)).toBeCloseTo(14.2, 5);
  });

  it('reports nothing for a glyph that starts on the origin', () => {
    // Inter's `A` at weight 800, measured in a real browser.
    stubCanvas({ actualBoundingBoxLeft: 0, width: 81 });
    expect(firstGlyphInkOffset('About Me', FONT)).toBe(0);
  });

  it('leaves a glyph that overhangs to the left alone', () => {
    // Chasing it would push the mark out into the margin.
    stubCanvas({ actualBoundingBoxLeft: 6, width: 81 });
    expect(firstGlyphInkOffset('About Me', FONT)).toBe(0);
  });

  it('refuses a bearing too large to be one', () => {
    // Half the letter is not air; something other than a bearing was read.
    stubCanvas({ actualBoundingBoxLeft: -70, width: 81 });
    expect(firstGlyphInkOffset('About Me', FONT)).toBe(0);
  });

  it('falls back when the canvas left the font at its default', () => {
    // A declaration that was not accepted leaves `10px sans-serif` behind, and
    // measuring that answers about a letter nobody sees.
    stubCanvas({ actualBoundingBoxLeft: -14.2, width: 81 }, '10px sans-serif');
    expect(firstGlyphInkOffset('About Me', FONT)).toBe(0);
  });

  it('accepts the font a canvas normalises rather than echoes', () => {
    /*
     * The bug this guards. A canvas drops an explicit `normal` style from what
     * it reads back, so requiring the string to come back verbatim rejects
     * every font in every real browser -- and the measurement silently returns
     * zero for everyone while passing any test that stubs an exact echo.
     */
    stubCanvas({ actualBoundingBoxLeft: -14.2, width: 81 }, '800 108px Inter, sans-serif');
    expect(firstGlyphInkOffset('About Me', FONT)).toBeCloseTo(14.2, 5);
  });

  it('falls back where there is no canvas, or no metric', () => {
    stubCanvas(null);
    expect(firstGlyphInkOffset('About Me', FONT)).toBe(0);
    vi.restoreAllMocks();

    stubCanvas({ width: 81 });
    expect(firstGlyphInkOffset('About Me', FONT)).toBe(0);
  });

  it('survives a canvas that throws', () => {
    vi.spyOn(document, 'createElement').mockImplementation(() => {
      throw new Error('no canvas here');
    });
    expect(firstGlyphInkOffset('About Me', FONT)).toBe(0);
  });

  it('needs both a letter and a font', () => {
    expect(firstGlyphInkOffset('', FONT)).toBe(0);
    expect(firstGlyphInkOffset('   ', FONT)).toBe(0);
    expect(firstGlyphInkOffset('About Me', '')).toBe(0);
  });

  it('measures the first letter, ignoring leading space', () => {
    const seen: string[] = [];
    vi.spyOn(document, 'createElement').mockReturnValue({
      getContext: () => ({
        font: FONT,
        measureText: (t: string) => {
          seen.push(t);
          return { actualBoundingBoxLeft: -3, width: 81 } as TextMetrics;
        },
      }),
    } as unknown as HTMLElement);

    firstGlyphInkOffset('  About Me', FONT);
    expect(seen).toEqual(['A']);
  });
});

describe('fontShorthand', () => {
  it('builds what a canvas will accept', () => {
    expect(
      fontShorthand({
        fontStyle: 'normal',
        fontWeight: '800',
        fontSize: '108px',
        fontFamily: 'Inter, sans-serif',
      } as CSSStyleDeclaration)
    ).toBe('normal 800 108px Inter, sans-serif');
  });

  it('fills in the parts a computed style can leave empty', () => {
    expect(
      fontShorthand({
        fontStyle: '',
        fontWeight: '',
        fontSize: '32px',
        fontFamily: 'serif',
      } as CSSStyleDeclaration)
    ).toBe('normal 400 32px serif');
  });

  it('gives nothing back without a size or a family, so no font is set', () => {
    expect(fontShorthand({ fontSize: '', fontFamily: 'serif' } as CSSStyleDeclaration)).toBe('');
    expect(fontShorthand({ fontSize: '12px', fontFamily: '' } as CSSStyleDeclaration)).toBe('');
  });
});
