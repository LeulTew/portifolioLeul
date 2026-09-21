import { useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { soundFx } from '@/lib/gateways/soundFx';
import { TV_CONTROL_IDS, dispatchTVHardware, type TVControlId } from '@/lib/tv/tvHardware';
import { registerTVTargets } from '@/lib/tv/tvControlProjection';
import { activateTV, getTVState, isTVActionEnabled, setTVExposure, useTVState } from '@/lib/tv/tvState';
import styles from './TVControls.module.css';

export function TVControls({ enabled, scrollElement }: { enabled: boolean; scrollElement: HTMLDivElement | null }) {
  const state = useTVState();
  const root = useRef<HTMLDivElement>(null);
  const targets = useRef<Record<TVControlId, HTMLButtonElement | null>>({ previous: null, next: null, power: null });
  const focused = useRef<TVControlId | null>(null);
  const keyboardHeld = useRef(false);
  const repeat = useRef(false);
  const retreatFocus = useRef(false);
  const layout = enabled ? state.layout : 'hidden';
  const projects = state.source === 'projects';
  const visible = layout !== 'hidden';

  useLayoutEffect(() => {
    if (!scrollElement || !root.current) return;
    scrollElement.insertBefore(root.current, scrollElement.firstChild);
    return registerTVTargets(targets.current);
  }, [scrollElement]);
  useLayoutEffect(() => {
    const active = document.activeElement;
    if (!visible) {
      keyboardHeld.current = repeat.current = false;
      for (const id of TV_CONTROL_IDS) {
        dispatchTVHardware(id, 'press', false);
        dispatchTVHardware(id, 'hover', false);
        dispatchTVHardware(id, 'focus', false);
      }
      if (active && root.current?.contains(active)) root.current.focus({ preventScroll: true });
    }
    if (visible && retreatFocus.current) {
      retreatFocus.current = false;
      if (document.activeElement !== root.current) return;
      const next = document.querySelector<HTMLButtonElement>('[data-tv-scene-next]');
      if (next && !next.disabled) next.focus({ preventScroll: true });
      else targets.current.power?.focus({ preventScroll: true });
    }
  }, [visible]);
  useEffect(() => {
    if (!enabled) setTVExposure(false, 'hidden');
    const releasePresses = () => {
      keyboardHeld.current = repeat.current = false;
      for (const id of TV_CONTROL_IDS) {
        dispatchTVHardware(id, 'press', false);
        dispatchTVHardware(id, 'focus', false);
        dispatchTVHardware(id, 'hover', false);
      }
    };
    window.addEventListener('blur', releasePresses);
    return () => {
      window.removeEventListener('blur', releasePresses);
      releasePresses();
    };
  }, [enabled]);

  if (!scrollElement) return null;
  return createPortal(
    <div ref={root} className={styles.anchor} tabIndex={-1} data-tv-controls="" data-tv-layout={layout}>
      <div className={styles.viewport} role="group" aria-label="Television controls">
        {TV_CONTROL_IDS.map(id => {
          const shown = visible && (id === 'power' || layout === 'all');
          const usable = enabled && isTVActionEnabled(id);
          const label = id === 'power'
            ? projects ? 'Turn TV off and return to the scene' : state.broadcastOn ? 'Turn TV off' : 'Turn TV on'
            : `${id === 'previous' ? 'Previous' : 'Next'} ${projects ? 'project' : 'channel'}`;
          return <button key={id} ref={element => { targets.current[id] = element; }} type="button"
            className={styles.control} aria-label={label} aria-disabled={!usable}
            aria-pressed={id === 'power' ? projects || state.broadcastOn : undefined}
            hidden={!shown} tabIndex={shown ? 0 : -1} data-tv-control={id}
            onPointerEnter={() => { if (usable) dispatchTVHardware(id, 'hover', true); }}
            onPointerLeave={() => {
              dispatchTVHardware(id, 'hover', false);
              if (!keyboardHeld.current) dispatchTVHardware(id, 'press', false);
            }}
            onPointerDown={event => {
              if (event.button === 0 && usable) dispatchTVHardware(id, 'press', true);
            }}
            onPointerUp={() => dispatchTVHardware(id, 'press', false)}
            onPointerCancel={() => dispatchTVHardware(id, 'press', false)}
            onFocus={() => { focused.current = id; dispatchTVHardware(id, 'focus', true); }}
            onBlur={() => {
              if (focused.current === id) focused.current = null;
              keyboardHeld.current = repeat.current = false;
              dispatchTVHardware(id, 'press', false);
              dispatchTVHardware(id, 'focus', false);
            }}
            onKeyDown={event => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              repeat.current = event.repeat;
              keyboardHeld.current = true;
              if (usable && !event.repeat) dispatchTVHardware(id, 'press', true);
            }}
            onKeyUp={event => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              keyboardHeld.current = repeat.current = false;
              dispatchTVHardware(id, 'press', false);
            }}
            onClick={event => {
              if (!usable || (event.detail === 0 && repeat.current)) return;
              const before = getTVState();
              const wasOn = before.source === 'projects' || before.broadcastOn;
              retreatFocus.current = id === 'power' && projects && document.activeElement === event.currentTarget;
              // Native browsers discard focus as soon as the pressed control becomes hidden.
              if (retreatFocus.current) root.current?.focus({ preventScroll: true });
              if (!activateTV(id)) { retreatFocus.current = false; return; }
              soundFx.playTVPress(id === 'power' ? wasOn ? 'power-off' : 'power-on' : 'channel');
            }}>
            <span className={styles.glint} aria-hidden="true" />
          </button>;
        })}
        {visible && state.mediaMessage && <p className={styles.mediaError} role="status">{state.mediaMessage}</p>}
      </div>
    </div>, scrollElement,
  );
}
