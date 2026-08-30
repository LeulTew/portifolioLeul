import styles from './LiquidFillText.module.css';
import { charDelayMs, wavePhasePx } from './charDelay';

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
  /** The whole beat: the fall, then the rise, in ms. */
  durationMs?: number;
  /**
   * How long snow falls before the level starts moving, in ms. Without it the
   * letters begin filling the instant the first flake appears, and nothing is
   * ever seen landing -- the fall has to arrive before it can accumulate.
   */
  leadMs?: number;
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
  leadMs = 550,
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
        /* The fall runs the whole beat; the rise is what is left after it. */
        ['--snow-duration' as string]: `${durationMs}ms`,
        ['--fill-duration' as string]: `${Math.max(durationMs - leadMs, 1)}ms`,
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
              ['--char-delay' as string]: `${
                delayMs + leadMs + charDelayMs(index, staggerMs)
              }ms`,
              /* Its own place in the crest pattern, so no two letters match. */
              ['--wave' as string]: `${wavePhasePx(index)}px`,
            }}
          >
            {char}
          </span>
        );
      })}
    </span>
  );
}
