export const DECRYPT_STEPS = 10;
const DECRYPT_START_MS = 560;
const DECRYPT_DURATION_MS = 440;

/** React Bits' sequential, original-character reveal, precomputed for seeking. */
export function decryptionFrames(text: string, direction: -1 | 1) {
  const chars = Array.from(text);
  const indices = chars.flatMap((char, index) => /[\p{L}\p{N}]/u.test(char) ? [index] : []);
  const availableChars = [...new Set(indices.map(index => chars[index]))];
  const order = direction > 0 ? indices : [...indices].reverse();
  const frames: string[] = [];
  const revealed = new Set<number>();
  for (let step = 0; step <= DECRYPT_STEPS; step++) {
    const count = Math.floor(order.length * step / DECRYPT_STEPS);
    for (let index = revealed.size; index < count; index++) revealed.add(order[index]);
    frames.push(chars.map((char, index) => {
      if (!/[\p{L}\p{N}]/u.test(char) || revealed.has(index)) return char;
      return availableChars[(index * 13 + step * 7 + 1) % availableChars.length];
    }).join(''));
  }
  return frames;
}

export function prepareDecryptedText(record: HTMLElement, direction: -1 | 1) {
  const elements = Array.from(record.querySelectorAll<HTMLElement>('[data-edu-text="decrypt"]'));
  const entries = elements.map(element => {
    const plain = element.querySelector<HTMLElement>('[data-edu-plain]');
    const cipher = element.querySelector<HTMLElement>('[data-edu-cipher]');
    if (!plain || !cipher) throw new Error('Education DecryptedText is missing its text layers');
    return {
      element, cipher,
      frames: decryptionFrames(plain.textContent ?? '', direction),
      lastStep: -1,
    };
  });
  const reset = (entry: typeof entries[number]) => {
    entry.element.removeAttribute('data-edu-decrypt-active');
    entry.cipher.textContent = '';
    entry.lastStep = -1;
  };

  return {
    seek(time: number) {
      // All labels share a decode step, so one paint resolves the whole batch.
      const progress = Math.min(1, Math.max(0, (time - DECRYPT_START_MS) / DECRYPT_DURATION_MS));
      const step = Math.floor(progress * DECRYPT_STEPS);
      for (const entry of entries) {
        if (progress === 1) {
          if (entry.lastStep !== -1) reset(entry);
          continue;
        }
        if (entry.lastStep === step) continue;
        if (entry.lastStep === -1) entry.element.setAttribute('data-edu-decrypt-active', '');
        entry.cipher.textContent = entry.frames[step];
        entry.lastStep = step;
      }
    },
    revert() {
      entries.forEach(reset);
    },
  };
}
