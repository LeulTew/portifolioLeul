import { useEffect, useState } from 'react';
import { subscribeScrollProgress } from './scrollProgress';
import { useActiveSection } from './useActiveSection';
import { cachedElement, writeAttribute } from '@/lib/dom/cachedElement';
import { isChapterBehind } from './chapterBehind';

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

  // A reading stage can cover Skills even after a flick passes the whole rail.
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

  const skillsEl = findSkills();
  if (skillsEl && skillsEl.getBoundingClientRect().top <= footerY) return false;

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

  /*
   * Ask the wall, not the scroll position.
   *
   * This used to return true at `seq >= 0.78`, which is where the rise is
   * TRIGGERED. The rise then climbs from the bottom of the screen over a second
   * and a half, and the footer sits sixty pixels off the bottom edge -- so it
   * was switching to light ink a whole beat before the green got anywhere near
   * it, sitting pale on the old ground until the wall caught up.
   */
  const overlay = findSequenceOverlay();
  if (overlay?.dataset.active === 'true' && isChapterBehind(footerY)) {
    return true;
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


/** Where the navigation bar's ink sits, measured from the top of the screen. */
const NAV_Y = 40;

/**
 * Whether the navigation bar is currently standing on the chapter colour.
 *
 * Same question as the footer's, asked at the top of the screen instead of the
 * bottom -- and therefore answered last rather than first while the wall
 * climbs. Education counts too: once its stage covers the bar, the bar is on
 * green whatever the pixel grid is doing.
 */
export function checkIsNavContrast(): boolean {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return false;
  }

  const eduStage = findEduStage();
  if (eduStage?.getAttribute('data-visible') === 'true') {
    const rect = eduStage.getBoundingClientRect();
    if (rect.top <= NAV_Y && rect.bottom >= NAV_Y) return true;
  }

  const aboutEl = findAbout();
  if (!aboutEl) return false;
  const aboutRect = aboutEl.getBoundingClientRect();
  if (aboutRect.top > NAV_Y || aboutRect.bottom < NAV_Y) return false;

  const overlay = findSequenceOverlay();
  if (overlay?.dataset.active === 'true' && isChapterBehind(NAV_Y)) return true;

  // Settled green, with the section itself carrying the colour.
  return aboutEl.getAttribute('data-bg-settled') === 'true';
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
        /*
         * The bar is decided here too, because it is the same question asked at
         * a different height, and one owner is the only way the two can never
         * disagree.
         *
         * It reaches the opposite conclusion from the footer for most of the
         * climb, which is correct and is the whole point: the wall arrives at
         * the bottom of the screen first and at the top last, so for a second
         * and a half the footer is over green and the bar is not.
         */
        writeAttribute(
          document.documentElement,
          'data-nav-contrast',
          checkIsNavContrast() ? 'true' : null
        );
      }
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
