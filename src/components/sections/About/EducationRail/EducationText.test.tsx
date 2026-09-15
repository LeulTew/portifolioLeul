import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { EducationText } from './EducationText';
import {
  DECRYPT_STEPS, TEXT_FRAME_STEPS, decryptionFrames, countingFrames, typingFrames, prepareTextFrames,
} from './educationTextFrames';
import { educationTextParts } from './educationTextProfiles';

afterEach(cleanup);

describe('React Bits Education text adapters', () => {
  it('keeps ordinary text, whitespace and wrapping opportunities without starting an animation', () => {
    const { container } = render(<p><EducationText motion="blur" text="Computer Science &  Technology" /></p>);
    expect(container.textContent).toBe('Computer Science &  Technology');
    expect(container.querySelectorAll('[data-edu-word]')).toHaveLength(4);
    for (const word of container.querySelectorAll<HTMLElement>('[data-edu-word]')) {
      expect(word.style.cssText).toBe('');
    }
  });

  it('keeps the original accessible copy and its layout while the separate cipher changes', () => {
    const { container } = render(<p><EducationText motion="decrypt" text="Completed 08/2025" /></p>);
    const plain = screen.getByText('Completed 08/2025');
    const cipher = container.querySelector('[data-edu-cipher]')!;
    const decryption = prepareTextFrames(educationTextParts(container), 1);
    act(() => decryption.seek(680));
    expect(plain.textContent).toBe('Completed 08/2025');
    expect(plain).not.toHaveAttribute('aria-hidden');
    expect(cipher).toHaveAttribute('aria-hidden', 'true');
    expect(cipher.textContent).not.toBe(plain.textContent);
    expect(container.querySelector('[data-edu-text-active]')).not.toBeNull();
    act(() => decryption.seek(1000));
    expect(container.textContent).toBe('Completed 08/2025');
    expect(cipher.textContent).toBe('');
    expect(container.querySelector('[data-edu-text-active]')).toBeNull();
    act(() => decryption.seek(600));
    expect(container.querySelector('[data-edu-text-active]')).not.toBeNull();
    act(() => decryption.revert());
    expect(container.textContent).toBe('Completed 08/2025');
    expect(container.querySelector('[data-edu-text-active]')).toBeNull();
  });

  it('resolves in the direction of arrival without adding iterations for longer text', () => {
    const forward = decryptionFrames('ABCDE', 1);
    const backward = decryptionFrames('ABCDE', -1);
    expect(forward[5].startsWith('AB')).toBe(true);
    expect(backward[5].endsWith('DE')).toBe(true);
    expect(forward[5]).not.toBe(backward[5]);
    for (const text of ['', ' / ', 'GPA: 3.92 / 4.00', 'a long credential label '.repeat(10)]) {
      const frames = decryptionFrames(text, 1);
      expect(frames).toHaveLength(DECRYPT_STEPS + 1);
      expect(frames.at(-1)).toBe(text);
      for (const frame of frames) {
        expect(frame.length).toBe(text.length);
        expect(frame.replace(/[\p{L}\p{N}]/gu, '')).toBe(text.replace(/[\p{L}\p{N}]/gu, ''));
      }
    }
  });

  it('does not mutate the cipher again between the bounded decode steps', () => {
    const { container } = render(<EducationText motion="decrypt" text="Selected coursework" />);
    const cipher = container.querySelector('[data-edu-cipher]')!;
    const decryption = prepareTextFrames(educationTextParts(container), -1);
    const observer = new MutationObserver(() => {});
    observer.observe(cipher, { childList: true });
    for (let time = 0; time <= 1000; time += 4) decryption.seek(time);
    expect(observer.takeRecords().length).toBeLessThanOrEqual(DECRYPT_STEPS + 1);
    observer.disconnect();
    decryption.revert();
  });

  it.each([-1, 1] as const)('types whole words in direction %i without moving their wrapping positions', direction => {
    const source = 'Build an  AI Agent in Python';
    const { container } = render(<EducationText motion="type" text={source} />);
    const plains = Array.from(container.querySelectorAll('[data-edu-plain]'));
    expect(plains.map(plain => plain.textContent)).toEqual(['Build', 'an', 'AI', 'Agent', 'in', 'Python']);
    expect(container.textContent).toBe(source);
    const frames = prepareTextFrames(educationTextParts(container), direction);
    frames.seek(750);
    expect(container.querySelector('[data-edu-text-active]'))
      .toHaveAttribute('data-edu-text-active', direction > 0 ? 'forward' : 'reverse');
    for (const plain of plains) expect(plain).not.toHaveAttribute('aria-hidden');
    frames.seek(1000);
    expect(container.textContent).toBe(source);
    expect(container.querySelector('[data-edu-text-active]')).toBeNull();
    frames.revert();
  });

  it('precomputes bounded typing and decimal-count frames with exact endpoints', () => {
    const forward = typingFrames('Build an agent', 1);
    const backward = typingFrames('Build an agent', -1);
    expect(forward).toHaveLength(TEXT_FRAME_STEPS + 1);
    expect(forward[12].trim()).toBe('Build a');
    expect(backward[12].trim()).toBe('n agent');
    expect(forward.at(-1)).toBe('Build an agent');
    expect(backward.at(-1)).toBe('Build an agent');
    const count = countingFrames('3.92');
    expect(count).toHaveLength(TEXT_FRAME_STEPS + 1);
    expect(count[0]).toBe('0.00');
    expect(count.at(-1)).toBe('3.92');
    expect(count.every(value => /^\d\.\d{2}$/.test(value))).toBe(true);
    expect(() => countingFrames('GPA: 3.92')).toThrow(/numeric value/);
    expect(() => countingFrames('Infinity')).toThrow(/numeric value/);
  });
});
