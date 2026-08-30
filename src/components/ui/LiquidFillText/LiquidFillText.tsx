import styles from './LiquidFillText.module.css';
import { charDelayMs } from './charDelay';

/**
 * Text that fills as snow falls into it.
 *
 * Snow drifts down across and behind the whole headline, and each letter fills
 * with what lands in it -- a body rising behind a scalloped surface that
 * sloshes as the level changes. Every letter shares one delay, so the word
 * fills the way a ledge fills, not the way a wipe crosses it.
 */

export interface LiquidFillTextProps {
  text: string;
  /** Starts the fill. Held false until the layer's cue is reached. */
  filling?: boolean;
  /** Forces the finished state, for when animations never advance. */
  settled?: boolean;
  /** Delay before the first letter starts, in ms. */
  delayMs?: number;
  /** How long one letter takes to fill, in ms. */
  durationMs?: number;
  /**
   * Per-letter offset. Zero by default: every letter shares one snow line, so
   * the drift rises across the whole word at once instead of sweeping along it.
   */
  staggerMs?: number;
  className?: string;
}

export function LiquidFillText({
  text,
  filling = false,
  settled = false,
  delayMs = 0,
  durationMs = 2400,
  staggerMs = 0,
  className,
}: LiquidFillTextProps) {
  const characters = Array.from(text);

  return (
    <span
      className={[
        styles.word,
        filling ? styles.filling : '',
        settled ? styles.settled : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={text}
      data-testid="liquid-fill-text"
      data-filling={filling}
      data-settled={settled}
      style={{
        ['--fill-duration' as string]: `${durationMs}ms`,
        /* The snowfall belongs to the word, so it starts on the word's cue. */
        ['--word-delay' as string]: `${delayMs}ms`,
      }}
    >
      {characters.map((char, index) => {
        if (char === ' ') {
          return (
            <span key={index} className="inline-block w-2" aria-hidden="true">
              &nbsp;
            </span>
          );
        }

        return (
          <span
            key={index}
            className={styles.char}
            data-char={char}
            data-testid="liquid-fill-char"
            aria-hidden="true"
            style={{
              ['--char-delay' as string]: `${delayMs + charDelayMs(index, staggerMs)}ms`,
            }}
          >
            {char}
          </span>
        );
      })}
    </span>
  );
}
