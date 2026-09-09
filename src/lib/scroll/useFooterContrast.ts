import { useEffect, useState } from 'react';
import { subscribeScrollProgress } from './scrollProgress';
import { useActiveSection } from './useActiveSection';
import { cachedElement, writeAttribute } from '@/lib/dom/cachedElement';

const SECTIONS = ['home', 'about', 'skills', 'projects', 'contact'] as const;

/*
 * The nodes this check consults, resolved once each.
 *
 * `checkIsFooterContrast` runs on every frame of the render loop. It used to
 * re-run all six lookups each time, two of them attribute-substring
 * `querySelector` scans over the whole document, before it read a single rect.
 */
const findSkills = cachedElement(() => document.getElementById('skills'));
const findAbout = cachedElement(() => document.getElementById('about'));
const findEduStage = cachedElement(() =>
  document.querySelector<HTMLElement>('[data-testid="education-stage"]')
);
/*
 * Cached on a selector that does not include `data-active`, because that
 * attribute flips while the node stays put -- caching on it would pin whichever
 * state it happened to be in when first seen. Whether the overlay is currently
 * pinned is asked at the point of use instead.
 */
const findSequenceOverlay = cachedElement(() =>
  document.querySelector<HTMLElement>('[data-pinned-sequence="true"]')
);
const findHeldGround = cachedElement(() =>
  document.querySelector<HTMLElement>('[data-held-ground="true"]')
);

/**
 * Checks whether the bottom footer (which sits ~50-60px above the viewport bottom)
 * is currently positioned over a contrast background (the emerald/pine background
 * in About's pixel transition and Education section).
 *
 * When over a contrast background:
 * The footer elements (text, line, year) must switch to crisp light/white for WCAG AAA contrast.
 *
 * When on normal background (Hero, regular About before transition, Skills, Projects, Contact,
 * or when Education has lifted/released above the footer exposing the 3D world):
 * The footer elements revert to standard theme colors (dark grey in light mode, white/dim in dark mode).
 */
export function checkIsFooterContrast(): boolean {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return false;
  }

  const footerY = window.innerHeight - 60;

  // 1. If Skills section has reached or passed above the footer,
  // we are definitely on normal background.
  const skillsEl = findSkills();
  if (skillsEl) {
    const skillsRect = skillsEl.getBoundingClientRect();
    if (skillsRect.top <= footerY) {
      return false;
    }
  }

  // 2. Condition A: Education Stage is visible and physically covers the footer
  const eduStage = findEduStage();
  if (eduStage && eduStage.getAttribute('data-visible') === 'true') {
    const stageRect = eduStage.getBoundingClientRect();
    // Only true if the stage's bottom edge hasn't lifted above the footer!
    if (stageRect.top <= footerY && stageRect.bottom >= footerY) {
      return true;
    }
    // If stage bottom is above footer, the stage has lifted and exposed normal background
    return false;
  }

  // 3. Condition B: PinnedSequence in About is actively pinned and in green background state
  const aboutEl = findAbout();
  if (!aboutEl) {
    return false;
  }

  const aboutRect = aboutEl.getBoundingClientRect();
  // If About is not over the footer:
  if (aboutRect.top > footerY || aboutRect.bottom < footerY) {
    return false;
  }

  const overlay = findSequenceOverlay();
  const activeOverlay = overlay?.dataset.active === 'true' ? overlay : null;

  if (activeOverlay) {
    const rawSeq = activeOverlay.style.getPropertyValue('--seq').trim();
    const seq = rawSeq ? Number.parseFloat(rawSeq) : 0;
    // Green pixels rise starting at seq = 0.78
    if (seq >= 0.78) {
      return true;
    }
  }

  // If About has solidified green transition AND is currently holding the screen
  if (aboutEl.getAttribute('data-bg-transition') === 'true') {
    const heldGround = findHeldGround();
    if (heldGround) {
      const hgRect = heldGround.getBoundingClientRect();
      if (hgRect.top <= footerY && hgRect.bottom >= footerY) {
        return true;
      }
      return false;
    }
    return true;
  }

  return false;
}

if (typeof window !== 'undefined') {
  (window as unknown as { __checkIsFooterContrast: () => boolean }).__checkIsFooterContrast = checkIsFooterContrast;
}

/**
 * Hook subscribing to active section tracking, scroll progress, resize, and DOM attribute
 * mutations to keep the footer contrast state reactive and frame-accurate.
 */
export function useFooterContrast(): boolean {
  const activeSection = useActiveSection(SECTIONS);
  const [isContrast, setIsContrast] = useState(() => checkIsFooterContrast());

  useEffect(() => {
    const update = () => {
      const next = checkIsFooterContrast();
      setIsContrast(next);
      if (typeof document !== 'undefined') {
        // Guarded, because this runs on every frame and an unconditional
        // setAttribute on documentElement invalidates style for the entire
        // document -- every section, every card, over a live WebGL canvas.
        writeAttribute(
          document.documentElement,
          'data-footer-contrast',
          next ? 'true' : null
        );
      }
    };

    update();
    const unsub = subscribeScrollProgress(update);
    window.addEventListener('scroll', update, { passive: true, capture: true });
    document.addEventListener('scroll', update, { passive: true, capture: true });
    window.addEventListener('resize', update);

    const aboutEl = document.getElementById('about');
    const skillsEl = document.getElementById('skills');

    // Section intersection watcher
    let sectionIo: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined') {
      sectionIo = new IntersectionObserver(update);
      if (aboutEl) sectionIo.observe(aboutEl);
      if (skillsEl) sectionIo.observe(skillsEl);
    }

    // Mutation observer for attribute transitions
    let observer: MutationObserver | null = null;
    if (typeof MutationObserver !== 'undefined') {
      observer = new MutationObserver(update);
      if (aboutEl) {
        observer.observe(aboutEl, {
          attributes: true,
          attributeFilter: ['data-bg-transition', 'data-education-active'],
        });
      }
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-navbar-contrary', 'data-theme'],
      });
    }

    return () => {
      unsub();
      window.removeEventListener('scroll', update, { capture: true });
      document.removeEventListener('scroll', update, { capture: true });
      window.removeEventListener('resize', update);
      sectionIo?.disconnect();
      observer?.disconnect();
      if (typeof document !== 'undefined') {
        document.documentElement.removeAttribute('data-footer-contrast');
      }
    };
  }, [activeSection]);

  return isContrast;
}
