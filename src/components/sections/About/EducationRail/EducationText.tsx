import styles from './EducationRail.module.css';
import type { EducationTextMotion, EducationTextRole } from './educationTextProfiles';

// React Bits text adapters: the chapter clock replaces their one-shot observers
// and timers. Attribution and terms are in public/licenses/react-bits.txt.
export function EducationText({
  text,
  motion,
  role,
}: {
  text: string;
  motion: EducationTextMotion;
  role?: EducationTextRole;
}) {
  if (motion === 'decrypt' || motion === 'type' || motion === 'count') {
    const splitWords = motion === 'type' && text.trim().length > 0;
    const pieces = splitWords ? text.split(/(\s+)/) : [text];
    return (
      <span className={styles.textFrames} data-edu-text={motion} data-edu-role={role}>
        {pieces.map((piece, index) => splitWords && /^\s+$/.test(piece) ? piece : (
          <span className={styles.frameWord} key={index}>
            <span className={styles.framePlain} data-edu-plain="">{piece}</span>
            <span className={styles.framePaint} data-edu-cipher="" aria-hidden="true" />
          </span>
        ))}
      </span>
    );
  }

  return (
    <span className={styles.textPhrase} data-edu-text={motion} data-edu-role={role}>
      {text.split(/(\s+)/).map((word, index) => /^\s+$/.test(word) ? word : (
        <span className={styles.textWord} data-edu-word="" key={index}>{word}</span>
      ))}
    </span>
  );
}
