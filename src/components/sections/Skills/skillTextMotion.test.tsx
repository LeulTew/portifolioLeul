import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import gsap from 'gsap';
import { SkillInlineText, SkillText } from './SkillsMotion';
import { revealSkillTypography } from './skillTextMotion';
import { SKILL_CHAPTERS } from './skillsData';

afterEach(() => {
  cleanup();
  delete document.documentElement.dataset.quality;
  gsap.ticker.sleep();
});

describe('inner skill-label choreography', () => {
  it.each(SKILL_CHAPTERS)('$scene animates its labels with the selected mechanism without changing their text', chapter => {
    const label = chapter.items[0];
    const { container } = render(<article>
      <SkillText text={chapter.title} tag="h3" animated mode={chapter.textMotion} />
      <p data-skill-summary="">Supporting meaning</p>
      <ul><li data-skill-copy="" aria-label={label}>
        <SkillInlineText text={label} mode={chapter.inlineMotion} animated />
      </li></ul>
    </article>);
    const article = container.querySelector('article')!;
    const units = [...article.querySelectorAll('[data-skill-inline-unit]')];
    let timeline: gsap.core.Timeline;
    const context = gsap.context(() => {
      timeline = revealSkillTypography(article, chapter.textMotion, chapter.inlineMotion).pause();
    }, article);
    try {
      timeline!.progress(1);
      const tweens = timeline!.getChildren(true, true, false)
        .filter((animation): animation is gsap.core.Tween => animation instanceof gsap.core.Tween)
        .filter(tween => tween.targets().some(target => target instanceof Element && units.includes(target)));
      expect(tweens.length).toBeGreaterThan(0);
      expect(article.querySelector('[data-inline-motion]')?.textContent).toBe(label);
      expect(article.querySelector('li')).toHaveAccessibleName(label);
      units.forEach(unit => expect(Number(gsap.getProperty(unit, 'opacity'))).toBe(1));
      if (chapter.inlineMotion === 'type') {
        expect(units).toHaveLength(label.replace(/\s/g, '').length);
        expect(tweens.some(tween => tween.vars.duration === 0.001)).toBe(true);
      } else if (chapter.inlineMotion === 'decode') {
        expect(units[0]).toHaveAttribute('data-cipher');
        expect(tweens.some(tween => tween.vars.yPercent === 0)).toBe(true);
      } else if (chapter.inlineMotion === 'focus') {
        expect(tweens.some(tween => tween.vars.filter === 'blur(0px)')).toBe(true);
      } else if (chapter.inlineMotion === 'draw') {
        expect(article.querySelector('[data-skill-inline-rule]')).not.toBeNull();
      } else if (chapter.inlineMotion === 'reveal') {
        expect(tweens.some(tween => tween.vars.rotation === 0)).toBe(true);
      } else {
        expect(tweens.some(tween => tween.vars.yPercent === 0)).toBe(true);
      }
    } finally {
      context.revert();
    }
  });
});

describe('capability-specific text choreography', () => {
  it.each(SKILL_CHAPTERS)('$scene uses its own actual animation mechanism', chapter => {
    const { container } = render(<article>
      <SkillText text={chapter.title} tag="h3" animated mode={chapter.textMotion} />
      <p data-skill-summary="">Supporting meaning</p>
      <ul><li data-skill-copy="">A tool</li><li data-skill-copy="">Another tool</li></ul>
    </article>);
    const article = container.querySelector('article')!;
    let timeline: gsap.core.Timeline;
    const context = gsap.context(() => {
      timeline = revealSkillTypography(article, chapter.textMotion).pause();
    }, article);
    try {
      timeline!.progress(0.3);
      const word = article.querySelector('[data-skill-word]');
      const chars = [...article.querySelectorAll('[data-skill-char]')];
      if (chapter.textMotion === 'decode') {
        expect(chars.length).toBeGreaterThan(0);
        expect(chars[0]).toHaveAttribute('data-cipher');
        expect(Number(gsap.getProperty(chars[0], 'yPercent'))).toBeGreaterThan(0);
      } else if (chapter.textMotion === 'assemble') {
        expect(Number(gsap.getProperty(word!, 'rotationX'))).toBeLessThan(0);
      } else if (chapter.textMotion === 'focus') {
        expect(word).toHaveAttribute('style', expect.stringContaining('blur('));
        expect(Number(gsap.getProperty(word!, 'scaleX'))).toBeLessThan(1);
      } else if (chapter.textMotion === 'scan') {
        const mask = article.querySelector('[data-skill-scan-window]')!;
        const text = article.querySelector('[data-skill-scan-text]')!;
        expect(Number(gsap.getProperty(mask, 'xPercent'))).toBeLessThan(0);
        expect(Number(gsap.getProperty(text, 'xPercent')))
          .toBeCloseTo(-Number(gsap.getProperty(mask, 'xPercent')));
      } else if (chapter.textMotion === 'draw') {
        expect(Number(gsap.getProperty(chars[1], 'rotation'))).not.toBe(0);
        expect(gsap.getProperty(chars[0], 'y')).not.toBe(gsap.getProperty(chars[1], 'y'));
      } else {
        const words = article.querySelectorAll('[data-skill-word]');
        expect(Number(gsap.getProperty(words[0], 'xPercent'))).toBeGreaterThan(0);
        expect(Number(gsap.getProperty(words[1], 'xPercent'))).toBeLessThan(0);
      }
      timeline!.progress(1);
      expect(article.querySelector('h3')).toHaveAccessibleName(chapter.title);
    } finally {
      context.revert();
    }
  });
});
