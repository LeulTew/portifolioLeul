import { useEffect, useLayoutEffect, useRef } from 'react';
import { subscribeScrollGesture } from '@/lib/scroll/scrollGesture';
import { subscribeSectionNavigation } from '@/lib/scroll/sectionNavigation';
import { registerPrismTarget } from '@/lib/prism/prismTarget';
import {
  closePrismExperiment, getPrismExperiment, requestPrismExperiment, resetPrismExperiment,
  setPrismEnabled, usePrismAvailable, usePrismPhase,
} from '@/lib/prism/prismExperiment';
import styles from './AvatarEncounter.module.css';

export function PrismTrigger({ enabled, scrollElement }: {
  enabled: boolean; scrollElement: HTMLDivElement;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const phase = usePrismPhase();
  const available = usePrismAvailable();
  const active = phase !== 'rest';

  useLayoutEffect(() => ref.current ? registerPrismTarget(ref.current) : undefined, []);
  useLayoutEffect(() => {
    setPrismEnabled(enabled);
    return () => setPrismEnabled(false);
  }, [enabled]);
  useEffect(() => {
    if (!enabled) return;
    const exit = () => closePrismExperiment();
    const hidden = () => { if (document.hidden) resetPrismExperiment(); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') closePrismExperiment(); };
    const offGesture = subscribeScrollGesture(exit);
    const offNavigation = subscribeSectionNavigation(resetPrismExperiment);
    window.addEventListener('keydown', key, { passive: true });
    window.addEventListener('resize', exit, { passive: true });
    document.addEventListener('visibilitychange', hidden);
    return () => {
      offGesture(); offNavigation();
      window.removeEventListener('keydown', key);
      window.removeEventListener('resize', exit);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, [enabled]);
  useLayoutEffect(() => {
    if (!active) return;
    const origin = scrollElement.scrollTop;
    const moved = () => { if (scrollElement.scrollTop !== origin) closePrismExperiment(); };
    scrollElement.addEventListener('scroll', moved, { passive: true });
    return () => scrollElement.removeEventListener('scroll', moved);
  }, [active, scrollElement]);

  return <button ref={ref} className={styles.target} type="button"
    aria-label={active ? 'Restore the green prism' : 'Unfold the green prism'}
    hidden={!enabled || !available} disabled={!enabled || !available}
    aria-keyshortcuts={active ? 'Escape' : undefined}
    data-prism-trigger="" data-prism-phase={phase}
    onClick={() => {
      if (getPrismExperiment().phase === 'rest') requestPrismExperiment(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      else closePrismExperiment();
    }}>
    <span className={styles.cue} aria-hidden="true" />
  </button>;
}
