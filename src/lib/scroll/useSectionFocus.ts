import { useEffect, useRef, useState } from 'react';
import { useViewportShare, useViewportShareEffect } from './viewportCoverage';
import {
  ENTER_THRESHOLD,
  exitAmount,
} from '@/lib/motion/sectionChoreography';

/**
 * The focus lifecycle of a section: whether its entry sequence should have
 * played, and how far through its exit it is.
 *
 * See SECTION_CHOREOGRAPHY.md. Entry latches once so a composed reveal does
 * not re-fire on every pass; exit is a pure function of coverage, so it tracks
 * the scroll rather than running on its own clock.
 */

export interface SectionFocus {
  /**
   * Raw share of the viewport the section occupies, 0 to 1.
   *
   * Deliberately the raw share, not the scrim's focus curve: that curve holds
   * at 1 until a section is nearly half gone, which made the exit start long
   * after the reader had begun scrolling past.
   */
  readonly coverage: number;
  /** True once the section has arrived. Never goes back to false. */
  readonly hasEntered: boolean;
  /** 0 while focused, 1 once fully out of focus. */
  readonly exit: number;
}

export function useSectionFocus(
  element: HTMLElement | null,
  enterThreshold: number = ENTER_THRESHOLD
): SectionFocus {
  const coverage = useViewportShare(element);
  const [hasEntered, setHasEntered] = useState(false);
  const latched = useRef(false);

  useEffect(() => {
    if (latched.current) return;
    if (coverage < enterThreshold) return;
    latched.current = true;
    setHasEntered(true);
  }, [coverage, enterThreshold]);

  return {
    coverage,
    hasEntered,
    // A section on its way in also has low coverage, and must not be treated
    // as leaving.
    exit: hasEntered ? exitAmount(coverage) : 0,
  };
}

/**
 * The same lifecycle, reported to a callback instead of through a render.
 *
 * Only `hasEntered` comes back as a value, because only `hasEntered` changes
 * what a section renders -- and it changes once, ever. Coverage and exit are
 * styles: a hundred coverage steps per transit routed through state re-renders
 * the whole section a hundred times to move one transform, and for the hero
 * that means re-rendering the animated headline, the rotator and both magnetic
 * buttons on every step of a scroll they are not involved in.
 *
 * The callback is invoked during the observer callback, so treat it as a place
 * to write to the DOM, not to set state.
 */
export function useSectionFocusEffect(
  element: HTMLElement | null,
  onChange: (focus: SectionFocus) => void,
  enterThreshold: number = ENTER_THRESHOLD
): boolean {
  const [hasEntered, setHasEntered] = useState(false);
  const latched = useRef(false);
  const callbackRef = useRef(onChange);
  callbackRef.current = onChange;

  useViewportShareEffect(element, (coverage) => {
    if (!latched.current && coverage >= enterThreshold) {
      latched.current = true;
      setHasEntered(true);
    }

    callbackRef.current({
      coverage,
      hasEntered: latched.current,
      // A section on its way in also has low coverage, and must not be
      // treated as leaving.
      exit: latched.current ? exitAmount(coverage) : 0,
    });
  });

  return hasEntered;
}
