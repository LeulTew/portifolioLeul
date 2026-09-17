import { contactReveal } from '@/lib/camera/contactFlight';
import { writeAttribute, writeStyleProperty } from '@/lib/dom/cachedElement';
import { getContactView } from './contactScene';

interface ContactSurface {
  element: HTMLElement;
  active: boolean;
  offset: number;
  anchor: number;
}

let surface: ContactSurface | null = null;

export function clearContactPresentation(): void {
  if (!surface?.active) return;
  writeAttribute(surface.element, 'data-contact-presenting', null);
  writeStyleProperty(surface.element, '--contact-flight-offset', '');
  writeStyleProperty(surface.element, '--contact-flight-reveal', '');
  surface.active = false;
  surface.offset = 0;
}

export function registerContactSurface(element: HTMLElement): () => void {
  clearContactPresentation();
  const owned: ContactSurface = { element, active: false, offset: 0, anchor: 80 };
  surface = owned;
  return () => {
    if (surface !== owned) return;
    clearContactPresentation();
    surface = null;
  };
}

/** After Drei's HTML transform: only the real Contact subtree overrides its cover. */
export function paintContactPresentation(): void {
  if (!surface || document.hidden) return;
  const view = getContactView();
  const reveal = contactReveal(view.progress);
  if ((view.mode !== 'departing' && view.mode !== 'returning') || reveal === 0) {
    clearContactPresentation();
    return;
  }
  const { element } = surface;
  if (!element.isConnected) {
    clearContactPresentation();
    return;
  }
  const top = element.getBoundingClientRect().top - surface.offset;
  if (!surface.active) {
    surface.anchor = view.mode === 'returning' ? top : 80;
    surface.active = true;
  }
  surface.offset = surface.anchor - top;
  writeStyleProperty(element, '--contact-flight-offset', `${surface.offset.toFixed(3)}px`);
  writeStyleProperty(element, '--contact-flight-reveal', String(reveal));
  writeAttribute(element, 'data-contact-presenting', 'true');
}
