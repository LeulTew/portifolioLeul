import type { EducationTextPart } from './educationTextProfiles';

export const DECRYPT_STEPS = 10;
export const TEXT_FRAME_STEPS = 24;

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

export function typingFrames(text: string, direction: -1 | 1) {
  const chars = Array.from(text);
  return Array.from({ length: TEXT_FRAME_STEPS + 1 }, (_, step) => {
    const count = Math.floor(chars.length * step / TEXT_FRAME_STEPS);
    return chars.map((char, index) =>
      (direction > 0 ? index < count : index >= chars.length - count) ? char : ' '
    ).join('');
  });
}

export function countingFrames(text: string) {
  if (!/^\d+(?:\.\d+)?$/.test(text) || !Number.isFinite(Number(text))) {
    throw new Error(`Education CountUp requires a finite numeric value: ${text}`);
  }
  const decimals = text.split('.')[1]?.length ?? 0;
  return Array.from({ length: TEXT_FRAME_STEPS + 1 }, (_, step) => {
    if (step === TEXT_FRAME_STEPS) return text;
    const progress = 1 - (1 - step / TEXT_FRAME_STEPS) ** 3;
    return (Number(text) * progress).toFixed(decimals);
  });
}

export function prepareTextFrames(parts: readonly EducationTextPart[], direction: -1 | 1) {
  const entries = parts.filter(part =>
    part.motion === 'decrypt' || part.motion === 'type' || part.motion === 'count'
  ).map(({ element, motion, start, end }) => {
    const plains = Array.from(element.querySelectorAll<HTMLElement>('[data-edu-plain]'));
    const paints = Array.from(element.querySelectorAll<HTMLElement>('[data-edu-cipher]'));
    if (!plains.length || paints.length !== plains.length) {
      throw new Error(`Education ${motion} text is missing its source or paint layers`);
    }
    const sources = plains.map(plain => plain.textContent ?? '');
    const joined = sources.join('');
    const frames = motion === 'type' ? typingFrames(joined, direction)
      : motion === 'count' ? countingFrames(joined) : decryptionFrames(joined, direction);
    let offset = 0;
    const layers = paints.map((paint, index) => {
      const from = offset;
      offset += Array.from(sources[index]).length;
      const to = offset;
      return {
        paint,
        frames: frames.map(frame => {
          const value = Array.from(frame).slice(from, to).join('');
          return motion === 'type' ? value.trim() : value;
        }),
      };
    });
    return {
      element, layers, start, end,
      steps: frames.length - 1,
      lastStep: -1,
    };
  });
  const reset = (entry: typeof entries[number]) => {
    entry.element.removeAttribute('data-edu-text-active');
    for (const { paint } of entry.layers) {
      if (paint.textContent) paint.textContent = '';
    }
    entry.lastStep = -1;
  };

  return {
    seek(time: number) {
      for (const entry of entries) {
        const progress = Math.min(1, Math.max(0, (time - entry.start) / (entry.end - entry.start)));
        const step = Math.floor(progress * entry.steps);
        if (progress === 1) {
          if (entry.lastStep !== -1) reset(entry);
          continue;
        }
        if (entry.lastStep === step) continue;
        if (entry.lastStep === -1) {
          entry.element.setAttribute('data-edu-text-active', direction > 0 ? 'forward' : 'reverse');
        }
        for (const { paint, frames } of entry.layers) {
          if (paint.textContent !== frames[step]) paint.textContent = frames[step];
        }
        entry.lastStep = step;
      }
    },
    revert() {
      entries.forEach(reset);
    },
  };
}
