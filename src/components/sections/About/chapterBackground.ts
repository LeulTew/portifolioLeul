/**
 * The colour the About/Education chapter turns.
 *
 * Mirrors the `--about-chapter-bg` token in `index.css`. Two copies because
 * the pixel cells are painted from CSS while the transition component writes
 * the same value inline so a caller can override it with the `color` prop --
 * and a component reading the token back out of `getComputedStyle` on mount
 * would cost a style flush to learn something it already knows.
 *
 * The dark value is deliberately NOT #001a1a. That is the colour
 * `BackgroundScene` clears the scene to (background, fog and ground alike), so
 * a transition that ran to it finished by matching what was already on screen:
 * the beat played correctly and nothing appeared to happen.
 */
export const ABOUT_CHAPTER_BG = {
  light: '#0a5c40',
  dark: '#0a4f38',
} as const;
