import { useEffect, useId, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { ControlButton } from '@/components/ui/ControlButton';
import {
  abortAvatarEncounter,
  getAvatarEncounter,
  isAvatarPresenting,
  registerAvatarElements,
  requestAvatarEncounter,
  returnFromAvatarEncounter,
  setAvatarEncounterEnabled,
  subscribeAvatarEncounter,
  useAvatarEncounterAvailable,
  useAvatarEncounterPhase,
  useAvatarEncounterPresenting,
  yieldAvatarEncounter,
} from '@/lib/avatar/avatarEncounter';
import { subscribeScrollGesture } from '@/lib/scroll/scrollGesture';
import { subscribeSectionNavigation } from '@/lib/scroll/sectionNavigation';
import styles from './AvatarEncounter.module.css';
import { PrismTrigger } from './PrismTrigger';

interface AvatarEncounterProps {
  enabled: boolean;
  scrollElement: HTMLDivElement | null;
}

export function AvatarEncounter({ enabled, scrollElement }: AvatarEncounterProps) {
  const phase = useAvatarEncounterPhase();
  const available = useAvatarEncounterAvailable();
  const presenting = useAvatarEncounterPresenting();
  const sceneEnabled = enabled && scrollElement !== null;
  const canMeet = sceneEnabled && available && phase === 'idle';
  const showPortrait = sceneEnabled && presenting;
  const captionId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLButtonElement>(null);
  const returnRef = useRef<HTMLButtonElement>(null);
  const focusReturnAfterCommit = useRef(false);
  const restoreTrigger = useRef(false);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const target = targetRef.current;
    if (!scrollElement || !root || !target) return;

    // A zero-height sticky layer keeps fixed-looking controls in the native scroll chain.
    scrollElement.insertBefore(root, scrollElement.firstChild);
    const unregister = registerAvatarElements({ root, target });
    const unsubscribe = subscribeAvatarEncounter(() => {
      if (isAvatarPresenting()) return;
      focusReturnAfterCommit.current = false;
      const explicitReturn = getAvatarEncounter().exit === 'return';
      if (!explicitReturn) restoreTrigger.current = false;

      // Retire focus before React hides the control, preserving the native scrollport.
      if (document.activeElement === returnRef.current) {
        restoreTrigger.current = explicitReturn;
        root.focus({ preventScroll: true });
      }
    });

    return () => {
      unsubscribe();
      unregister();
    };
  }, [scrollElement]);

  useLayoutEffect(() => {
    setAvatarEncounterEnabled(sceneEnabled);
    return () => {
      focusReturnAfterCommit.current = false;
      restoreTrigger.current = false;
      setAvatarEncounterEnabled(false);
    };
  }, [sceneEnabled, scrollElement]);

  useEffect(() => {
    if (!sceneEnabled) return;

    const yieldToInput = () => {
      restoreTrigger.current = false;
      focusReturnAfterCommit.current = false;
      yieldAvatarEncounter();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') returnFromAvatarEncounter();
    };
    const onVisibilityChange = () => {
      if (document.hidden) abortAvatarEncounter('hidden');
    };
    const unsubscribeGesture = subscribeScrollGesture(yieldToInput);
    const unsubscribeNavigation = subscribeSectionNavigation(() => {
      restoreTrigger.current = false;
      focusReturnAfterCommit.current = false;
      abortAvatarEncounter('navigation');
    });
    window.addEventListener('keydown', onKeyDown, { passive: true });
    window.addEventListener('resize', yieldToInput, { passive: true });
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      unsubscribeGesture();
      unsubscribeNavigation();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', yieldToInput);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [sceneEnabled]);

  useLayoutEffect(() => {
    if (!showPortrait || !scrollElement) return;
    const activationScrollTop = scrollElement.scrollTop;
    const onScroll = () => {
      if (!isAvatarPresenting() || scrollElement.scrollTop === activationScrollTop) return;
      restoreTrigger.current = false;
      focusReturnAfterCommit.current = false;
      yieldAvatarEncounter();
    };
    scrollElement.addEventListener('scroll', onScroll, { passive: true });
    return () => { scrollElement.removeEventListener('scroll', onScroll); };
  }, [showPortrait, scrollElement]);

  useLayoutEffect(() => {
    if (showPortrait && focusReturnAfterCommit.current) {
      focusReturnAfterCommit.current = false;
      returnRef.current?.focus({ preventScroll: true });
    } else if (canMeet && restoreTrigger.current && document.activeElement === rootRef.current) {
      restoreTrigger.current = false;
      targetRef.current?.focus({ preventScroll: true });
    }
  }, [canMeet, showPortrait, phase]);

  if (!scrollElement) return null;

  return createPortal(
    <div
      ref={rootRef}
      className={styles.encounter}
      data-avatar-encounter={phase}
      role="group"
      aria-label="3D scene"
      tabIndex={-1}
      onBlurCapture={event => {
        if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) {
          restoreTrigger.current = false;
        }
      }}
    >
      <div className={styles.viewport}>
      <button
        ref={targetRef}
        className={styles.target}
        type="button"
        aria-label="Meet Leul in 3D"
        hidden={!canMeet}
        disabled={!canMeet}
        onClick={() => {
          restoreTrigger.current = false;
          if (requestAvatarEncounter()) focusReturnAfterCommit.current = true;
        }}
      >
        <span className={styles.cue}>
          Meet Leul
          <ArrowUpRight size={15} strokeWidth={1.75} aria-hidden="true" />
        </span>
      </button>
      <PrismTrigger enabled={sceneEnabled} scrollElement={scrollElement} />
      <div id={captionId} className={styles.caption} hidden={!showPortrait}>
        <p className={styles.name}>Leul Tewodros</p>
        <p className={styles.role}>Software engineer</p>
      </div>
      <ControlButton
        ref={returnRef}
        className={styles.returnControl}
        aria-label="Return to scene"
        aria-describedby={captionId}
        aria-keyshortcuts="Escape"
        hidden={!showPortrait}
        disabled={!showPortrait}
        onClick={returnFromAvatarEncounter}
      >
        <ArrowLeft size={17} strokeWidth={1.75} aria-hidden="true" />
        <span>Back to scene</span>
      </ControlButton>
      </div>
    </div>,
    scrollElement,
  );
}
