import styles from './EducationRail.module.css';

// React Bits text adapters: the chapter clock replaces their one-shot observers
// and timers. Attribution and terms are in public/licenses/react-bits.txt.
export function BlurText({ text }: { text: string }) {
  return (
    <span className={styles.blurText} data-edu-text="blur">
      {text.split(/(\s+)/).map((word, index) => /^\s+$/.test(word) ? word : (
        <span className={styles.blurWord} data-edu-word="" key={index}>{word}</span>
      ))}
    </span>
  );
}

export function DecryptedText({ text }: { text: string }) {
  return (
    <span className={styles.decryptText} data-edu-text="decrypt">
      <span className={styles.decryptPlain} data-edu-plain="">{text}</span>
      <span className={styles.decryptCipher} data-edu-cipher="" aria-hidden="true" />
    </span>
  );
}
