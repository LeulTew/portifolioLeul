export function createTrackFocusRecovery() {
  let pending: { element: HTMLElement; track: HTMLElement; document: Document } | null = null;

  const cancel = () => {
    const owner = pending?.document;
    pending = null;
    owner?.removeEventListener('focusin', followFocus, true);
    owner?.removeEventListener('pointerdown', cancel, true);
    owner?.removeEventListener('keydown', cancelNavigationKey, true);
  };

  const followFocus = (event: FocusEvent) => {
    if (!pending || event.target === pending.document.body) return;
    if (event.target instanceof HTMLElement && pending.track.contains(event.target)) {
      pending.element = event.target;
    } else {
      cancel();
    }
  };

  const cancelNavigationKey = (event: KeyboardEvent) => {
    if (event.key === 'Tab' || event.key === 'Escape') cancel();
  };

  return {
    capture(track: HTMLElement) {
      const owner = track.ownerDocument;
      const active = owner.activeElement;
      if (!(active instanceof HTMLElement) || !track.contains(active)) {
        if (active !== owner.body && active !== owner.documentElement) cancel();
        return;
      }
      cancel();
      pending = { element: active, track, document: owner };
      owner.addEventListener('focusin', followFocus, true);
      owner.addEventListener('pointerdown', cancel, { capture: true, passive: true });
      owner.addEventListener('keydown', cancelNavigationKey, { capture: true, passive: true });
    },
    restore() {
      const saved = pending;
      cancel();
      if (!saved) return false;
      const { element, track, document: owner } = saved;
      if (owner.activeElement !== owner.body && owner.activeElement !== owner.documentElement) return false;
      if (!element.isConnected || !track.contains(element) || element.matches(':disabled') ||
          element.closest('[inert], [hidden], [aria-hidden="true"]') || !element.getClientRects().length) return false;
      const style = getComputedStyle(element);
      if (style.visibility === 'hidden' || style.display === 'none') return false;
      element.focus({ preventScroll: true });
      return owner.activeElement === element;
    },
    cancel,
  };
}
