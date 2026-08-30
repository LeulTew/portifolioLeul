import styles from './LiquidFillText.module.css';
import { charDelayMs } from './charDelay';

/**
 * Text whose letters arrive hollow and then fill from the baseline up.
 *
 * The stagger decelerates along the word, so the fill runs through the letters
 * rather than stepping between them at a fixed interval.
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
  className?: string;
}

export function LiquidFillText({
  text,
  filling = false,
  settled = false,
  delayMs = 0,
  durationMs = 900,
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
      style={{ ['--fill-duration' as string]: `${durationMs}ms` }}
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
              ['--char-delay' as string]: `${delayMs + charDelayMs(index)}ms`,
            }}
          >
            {char}
          </span>
        );
      })}
    </span>
  );
}
