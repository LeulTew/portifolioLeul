import gsap from 'gsap';
import type { SkillInlineMotion, SkillTextMotion } from './skillsData';

export function revealSkillTypography(
  article: HTMLElement,
  mode: SkillTextMotion,
  inlineMode: SkillInlineMotion = 'reveal',
): gsap.core.Timeline {
  const timeline = gsap.timeline({ defaults: { immediateRender: false } });
  const heading = article.querySelector('h3');
  if (!heading) throw new Error('Skills typography needs its capability heading.');
  const words = heading.querySelectorAll('[data-skill-word]');
  const chars = heading.querySelectorAll('[data-skill-char]');
  const windows = heading.querySelectorAll('[data-skill-scan-window]');
  const scanText = heading.querySelectorAll('[data-skill-scan-text]');
  const rows = article.querySelectorAll('[data-skill-copy]');
  const summary = article.querySelector('[data-skill-summary]');
  const blur = document.documentElement.dataset.quality === 'low' ? 0 : 4;

  switch (mode) {
    case 'decode':
      timeline.fromTo(chars, { yPercent: 100, opacity: 0 }, {
        yPercent: 0, opacity: 1, duration: 0.68, stagger: 0.037, ease: 'power4.inOut',
      }, 0.03);
      break;
    case 'assemble':
      timeline.fromTo(words, { yPercent: 108, x: -14, rotationX: -28, opacity: 0.3 }, {
        yPercent: 0, x: 0, rotationX: 0, opacity: 1, duration: 0.78, stagger: 0.095, ease: 'power4.out',
      }, 0.04);
      break;
    case 'focus':
      timeline.fromTo(words, { y: -24, scale: 0.92, opacity: 0, filter: `blur(${blur}px)` }, {
        y: 0, scale: 1, opacity: 1, filter: 'blur(0px)', duration: 0.82, stagger: 0.075, ease: 'power3.out',
      }, 0.03);
      break;
    case 'scan':
      timeline.fromTo(windows, { xPercent: -105, opacity: 1 }, {
        xPercent: 0, opacity: 1, duration: 0.86, stagger: 0.06, ease: 'power3.inOut',
      }, 0.02).fromTo(scanText, { xPercent: 105 }, {
        xPercent: 0, duration: 0.86, stagger: 0.06, ease: 'power3.inOut',
      }, 0.02);
      break;
    case 'draw':
      timeline.fromTo(chars, {
        y: index => 22 + Math.sin(index * 0.65) * 22,
        rotation: index => Math.sin(index * 0.5) * 12,
        opacity: 0,
      }, {
        y: 0, rotation: 0, opacity: 1, duration: 0.66, stagger: 0.032, ease: 'power3.out',
      }, 0.02);
      break;
    case 'connect':
      timeline.fromTo(words, { xPercent: index => index % 2 ? -16 : 16, scale: 0.96, opacity: 0 }, {
        xPercent: 0, scale: 1, opacity: 1, duration: 0.76, stagger: 0.12, ease: 'power3.out',
      }, 0.04);
      break;
  }

  if (summary) timeline.fromTo(summary, { y: 9, opacity: 0 }, {
    y: 0, opacity: 1, duration: 0.5, ease: 'power3.out',
  }, 0.22);

  const rowFrom: gsap.TweenVars = mode === 'assemble'
    ? { y: 16, scale: 0.96, opacity: 0 }
    : mode === 'focus'
      ? { y: 8, scale: 0.97, opacity: 0 }
      : mode === 'draw'
        ? { y: index => index % 2 ? 12 : -12, opacity: 0 }
        : { x: mode === 'connect' ? (index: number) => index % 2 ? 16 : -16 : 18, opacity: 0 };
  timeline.fromTo(rows, rowFrom, {
    x: 0, y: 0, scale: 1, opacity: 1, duration: 0.5, ease: 'power3.out',
    stagger: { each: mode === 'scan' ? 0.07 : 0.045, from: mode === 'focus' ? 'center' : 'start' },
  }, 0.38);

  if (document.documentElement.dataset.quality !== 'low') {
    rows.forEach((row, index) => {
      const units = row.querySelectorAll('[data-skill-inline-unit]');
      if (!units.length) return;
      const at = 0.35 + index * (inlineMode === 'type' ? 0.075 : 0.05);
      if (inlineMode === 'decode') {
        timeline.fromTo(units, { yPercent: 100, opacity: 0 }, {
          yPercent: 0, opacity: 1, duration: 0.4, stagger: { amount: 0.16 }, ease: 'power3.inOut',
        }, at);
      } else if (inlineMode === 'type') {
        timeline.fromTo(units, { opacity: 0 }, { opacity: 1, duration: 0.001, stagger: 0.018 }, at);
      } else if (inlineMode === 'focus') {
        timeline.fromTo(units, { opacity: 0, y: 6, filter: 'blur(2px)' }, {
          opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.4, stagger: 0.04, ease: 'power3.out',
        }, at);
      } else if (inlineMode === 'assemble') {
        timeline.fromTo(units, { yPercent: 105, opacity: 0 }, {
          yPercent: 0, opacity: 1, duration: 0.42, stagger: 0.04, ease: 'power3.out',
        }, at);
      } else if (inlineMode === 'draw') {
        timeline.fromTo(units, { y: unit => unit % 2 ? 8 : -8, opacity: 0 }, {
          y: 0, opacity: 1, duration: 0.4, stagger: 0.04, ease: 'power3.out',
        }, at);
        timeline.fromTo(row.querySelectorAll('[data-skill-inline-rule]'), { strokeDashoffset: 1 }, {
          strokeDashoffset: 0, duration: 0.5, ease: 'power2.inOut',
        }, at + 0.08);
      } else {
        timeline.fromTo(units, { opacity: 0.12, rotation: 3 }, {
          opacity: 1, rotation: 0, duration: 0.45, stagger: 0.06, transformOrigin: '0% 50%', ease: 'power2.out',
        }, at);
      }
    });
  }
  return timeline.duration(1.12);
}

export function withdrawSkillTypography(article: HTMLElement, mode: SkillTextMotion): gsap.core.Timeline {
  const timeline = gsap.timeline({ defaults: { ease: 'power2.in', duration: 0.3 } });
  const heading = article.querySelector('h3');
  if (!heading) throw new Error('Skills typography needs its capability heading.');
  if (mode === 'decode') {
    timeline.to(heading.querySelectorAll('[data-skill-char]'), { yPercent: -110, stagger: 0.011 });
  } else if (mode === 'scan') {
    timeline.to(heading.querySelectorAll('[data-skill-scan-window]'), { xPercent: 105 }, 0)
      .to(heading.querySelectorAll('[data-skill-scan-text]'), { xPercent: -105 }, 0);
  } else if (mode === 'draw') {
    timeline.to(heading.querySelectorAll('[data-skill-char]'), {
      y: index => Math.sin(index * 0.6) * -18 - 12, opacity: 0, stagger: 0.008,
    });
  } else {
    timeline.to(heading.querySelectorAll('[data-skill-word]'), {
      opacity: 0,
      y: mode === 'assemble' ? -18 : -6,
      x: mode === 'connect' ? (index: number) => index % 2 ? 18 : -18 : 0,
      scale: mode === 'focus' ? 1.04 : 1,
      stagger: 0.025,
    });
  }
  timeline.to(article.querySelectorAll('[data-skill-summary], [data-skill-copy]'), {
    opacity: 0, y: -6, duration: 0.2, stagger: 0.008,
  }, 0.03);
  return timeline.duration(0.42);
}
