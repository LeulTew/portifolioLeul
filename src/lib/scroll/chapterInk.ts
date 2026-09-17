import { useEffect } from 'react';
import { cachedElement, writeAttribute, writeStyleProperty } from '@/lib/dom/cachedElement';
import { subscribeScrollProgress } from './scrollProgress';

const findAbout = cachedElement(() => document.getElementById('about'));
const findOverlay = cachedElement(() =>
  document.querySelector<HTMLElement>('[data-testid="about-sequence-overlay"]'));
const findEducation = cachedElement(() =>
  document.querySelector<HTMLElement>('[data-testid="education-stage"]'));
const findGround = cachedElement(() =>
  document.querySelector<HTMLElement>('#about [data-green-bg="true"]'));
const findSkills = cachedElement(() =>
  document.querySelector<HTMLElement>('[data-testid="skills-stage"]'));
const findProjects = cachedElement(() => document.getElementById('projects'));

const properties = [
  '--chapter-ink-mask', '--chapter-ink-clip', '--chapter-ink-opacity', '--chapter-ink-visibility',
] as const;

/** A second paint of the chrome uses the same live mask as About's white title. */
export function updateChapterInk(): void {
  const root = document.documentElement;
  const education = findEducation();
  const overlay = findOverlay();
  const about = findAbout();
  const skills = findSkills();
  const skillsCoverage = skills?.dataset.visible === 'true'
    ? Math.min(1, Math.max(0, Number(skills.style.opacity))) : 0;
  let mode = 'none';
  let opacity = 1;
  let clip = 'inset(0px)';

  const cover = (element: HTMLElement) => {
    if (element.closest('[data-projects-covered]')) return;
    const rect = element.getBoundingClientRect();
    if (rect.bottom <= 0 || rect.top >= window.innerHeight ||
        rect.right <= 0 || rect.left >= window.innerWidth) return;
    mode = 'solid';
    clip = `inset(${Math.max(0, rect.top)}px ${Math.max(0, window.innerWidth - rect.right)}px ` +
      `${Math.max(0, window.innerHeight - rect.bottom)}px ${Math.max(0, rect.left)}px)`;
  };

  if (skillsCoverage === 1) {
    mode = 'none';
  } else if (education?.dataset.visible === 'true') {
    cover(education);
  } else if (overlay?.dataset.active === 'true' && !overlay.closest('[data-projects-covered]')) {
    if (about?.dataset.bgActive === 'true' || about?.dataset.bgSettled === 'true') {
      mode = 'pixels';
      opacity = Math.min(1, Math.max(0, Number(overlay.style.getPropertyValue('--ground-in'))));
    }
  } else {
    const ground = findGround();
    if (ground) cover(ground);
  }
  // The held Skills plate covers the physical green underlay. Its actual
  // alpha, not scroll distance, determines how much white chrome still shows.
  opacity *= 1 - skillsCoverage;

  writeAttribute(root, 'data-chapter-ink', mode);
  writeStyleProperty(root, '--chapter-ink-mask', mode === 'pixels' ? 'url("#bg-pixel-transition-mask")' : 'none');
  writeStyleProperty(root, '--chapter-ink-clip', clip);
  writeStyleProperty(root, '--chapter-ink-opacity', String(opacity));
  writeStyleProperty(root, '--chapter-ink-visibility', mode === 'none' ? 'hidden' : 'visible');
}

export function useChapterInk(): void {
  useEffect(() => {
    const observed = new Set<HTMLElement>();
    const observer = new MutationObserver(update);
    const discovery = new MutationObserver(update);
    function update() {
      const elements = [findAbout(), findOverlay(), findEducation(), findSkills(), findProjects()];
      for (const element of elements) {
        if (element && !observed.has(element)) {
          observed.add(element);
          observer.observe(element, {
            attributes: true,
            attributeFilter: [
              'style', 'data-active', 'data-visible', 'data-bg-active', 'data-bg-settled',
              'data-projects-active', 'data-projects-covered',
            ],
          });
        }
      }
      if (elements.every(Boolean)) discovery.disconnect();
      updateChapterInk();
    }
    discovery.observe(document.body, { childList: true, subtree: true });
    update();
    const unsubscribe = subscribeScrollProgress(update);
    document.addEventListener('scroll', update, { passive: true, capture: true });
    window.addEventListener('resize', update);
    return () => {
      unsubscribe();
      observer.disconnect();
      discovery.disconnect();
      document.removeEventListener('scroll', update, { capture: true });
      window.removeEventListener('resize', update);
      for (const property of properties) document.documentElement.style.removeProperty(property);
      document.documentElement.removeAttribute('data-chapter-ink');
    };
  }, []);
}
