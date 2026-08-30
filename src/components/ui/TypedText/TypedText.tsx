import styles from './TypedText.module.css';

/**
 * Text that types itself out as the reader is held.
 *
 * Every character is placed immediately and hidden; what the scroll moves is
 * how many of them are shown. Nothing reflows as it types, which is the
 * difference between this and a width animation -- a growing box re-wraps the
 * paragraph on the way, so the lines shuffle while they are being read.
 *
 * The caret is not a separate element chasing the text. Each character carries
 * one, and it is only lit for the character currently being typed, so it is
 * exactly where it should be on every line without anything having to measure
 * where that is.
 *
 * Characters are grouped into words that cannot break, or making each one an
 * inline-block would let the paragraph wrap in the middle of a word.
 */

export interface TypedTextProps {
  text: string;
  /** Property carrying how far through the typing the reader is, 0 to 1. */
  typedVar?: string;
  className?: string;
}

export function TypedText({
  text,
  typedVar = '--intro-in',
  className,
}: TypedTextProps) {
  const words = text.split(' ');
  const total = text.length;
  let index = 0;

  return (
    <p
      className={[styles.typed, className].filter(Boolean).join(' ')}
      style={{
        ['--typed' as string]: `var(${typedVar}, 0)`,
        ['--n' as string]: total,
      }}
      data-testid="typed-text"
      aria-label={text}
    >
      {words.map((word, wordIndex) => {
        // The space after the word is part of it, so a line never breaks on a
        // character that has not been typed yet.
        const glyphs = Array.from(
          wordIndex === words.length - 1 ? word : `${word} `
        );

        return (
          <span key={wordIndex} className={styles.word} aria-hidden="true">
            {glyphs.map((glyph, glyphIndex) => {
              const at = index++;
              return (
                <span
                  key={glyphIndex}
                  className={styles.glyph}
                  style={{ ['--i' as string]: at }}
                  data-testid="typed-glyph"
                >
                  {glyph === ' ' ? '\u00a0' : glyph}
                </span>
              );
            })}
          </span>
        );
      })}
    </p>
  );
}
