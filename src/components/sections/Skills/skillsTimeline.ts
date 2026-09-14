import gsap from 'gsap';
import { SKILLS_CROSSING_SECONDS, SKILLS_REVEAL_SECONDS } from './skillsData';

function revealChapter(chapter: HTMLElement): gsap.core.Timeline {
  const timeline = gsap.timeline()
    .fromTo(chapter.querySelectorAll('[data-skill-word]'), { yPercent: 110 }, {
      yPercent: 0, duration: 0.85, stagger: 0.075, ease: 'power4.out',
    }, 0.08)
    .fromTo(chapter.querySelectorAll('[data-skill-copy]'), { opacity: 0, y: 12 }, {
      opacity: 1, y: 0, duration: 0.6, stagger: 0.035, ease: 'power3.out',
    }, 0.35)
    .fromTo(chapter.querySelectorAll('[data-art-part]'), { y: 52, opacity: 0 }, {
      y: 0, opacity: 1, duration: 0.9, stagger: 0.12, ease: 'power3.out',
    }, 0.02)
    .fromTo(chapter.querySelectorAll('[data-art-shadow]'), { scale: 0.8, opacity: 0 }, {
      scale: 1, opacity: 1, transformOrigin: '50% 50%', duration: 0.8,
    }, 0.1);

  const traces = chapter.querySelectorAll('[data-art-trace]');
  if (traces.length) timeline.fromTo(traces, { strokeDashoffset: 1 }, {
    strokeDashoffset: 0, duration: 0.75, stagger: 0.055, ease: 'power2.inOut',
  }, 0.65);

  const signals = chapter.querySelectorAll('[data-art-signal]');
  if (signals.length) timeline.fromTo(signals, { opacity: 0, y: -12 }, {
    opacity: 1, y: 0, duration: 0.65, ease: 'power2.out',
  }, 0.95);

  const neurons = chapter.querySelectorAll('[data-art-neuron]');
  if (neurons.length) timeline.fromTo(neurons, { opacity: 0 }, {
    opacity: 1, duration: 0.45, stagger: 0.055,
  }, 0.55);

  chapter.querySelectorAll<SVGPathElement>('[data-art-morph]').forEach(path => {
    const from = path.dataset.morphFrom;
    const to = path.getAttribute('d');
    if (!from || !to) throw new Error('A Skills contour is missing its authored morph.');
    timeline.fromTo(path, { attr: { d: from } }, {
      attr: { d: to }, duration: 1.1, ease: 'power3.inOut',
    }, 0.45);
  });

  return timeline.duration(SKILLS_REVEAL_SECONDS);
}

/** One seekable score: going back literally retraces the forward movement. */
export function createSkillsTimeline(stage: HTMLElement) {
  const chapters = [...stage.querySelectorAll<HTMLElement>('[data-skill-chapter]')];
  if (!chapters.length) throw new Error('The Skills stage has no chapters.');

  gsap.set(chapters, { autoAlpha: 0 });
  const timeline = gsap.timeline({ paused: true })
    .fromTo(stage, { opacity: 0 }, { opacity: 1, duration: 0.45 })
    .fromTo(stage.querySelectorAll('[data-skill-chrome]'), { opacity: 0, y: 6 }, {
      opacity: 1, y: 0, duration: 0.45, stagger: 0.07,
    }, 0.12)
    .set(chapters[0], { autoAlpha: 1 }, 0)
    .add(revealChapter(chapters[0]), 0.16);
  const stops = [timeline.duration()];

  for (let index = 1; index < chapters.length; index++) {
    timeline
      .to(chapters[index - 1], {
        autoAlpha: 0, y: -18, duration: SKILLS_CROSSING_SECONDS, ease: 'power2.inOut',
      })
      .set(chapters[index], { autoAlpha: 1 })
      .add(revealChapter(chapters[index]));
    stops.push(timeline.duration());
  }

  return { timeline, stops };
}
