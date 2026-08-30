/**
 * The ground each held section stands on, in both themes.
 *
 * Tinted, never neutral. A ground mixed from the page's own accent reads as
 * the same weather at a different depth; a grey of the same value reads as a
 * different site. The steps between sections are small on purpose -- the point
 * is that the water has changed, not that the page has.
 *
 * Retuning the palette means editing this table and nothing else.
 */
export interface Ground {
  /** The colour that covers the world while the section's copy is read. */
  readonly base: string;
}

export type ThemeName = 'dark' | 'light';

const GROUNDS: Record<ThemeName, Record<string, Ground>> = {
  dark: {
    // Deepest: the page has just closed over the reader.
    about: { base: '#000c10' },
    // Shallower, and a shade greener: the light is coming back.
    education: { base: '#04161a' },
  },
  light: {
    /*
     * Drawn from the scene's own light sky (#f4f7ff) rather than picked
     * separately. Education cuts the ground away to show that sky beside it,
     * so a ground mixed from a different family puts two near-whites side by
     * side with a visible seam between them -- the one place the two must
     * agree is exactly where this section shows them together.
     *
     * A shade below the sky, so it still reads as something covering it.
     */
    about: { base: '#e7ecf7' },
    education: { base: '#dde5f3' },
  },
};

/** The ground for a section, falling back to the first of its theme. */
export function groundFor(sectionId: string, theme: ThemeName): Ground {
  const table = GROUNDS[theme] ?? GROUNDS.dark;
  return table[sectionId] ?? Object.values(table)[0];
}

/** Every section the palette covers, for tests and for iterating. */
export function groundSections(): string[] {
  return Object.keys(GROUNDS.dark);
}
