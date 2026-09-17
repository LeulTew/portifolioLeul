import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { contactReveal, CONTACT_REVEAL_END } from '@/lib/camera/contactFlight';
import { beginContactFlight, parkContactSky, releaseContactSky, setContactProgress } from './contactScene';
import { clearContactPresentation, paintContactPresentation, registerContactSurface } from './contactPresentation';

let section: HTMLElement;
let top: number;
let unregister: () => void;

beforeEach(() => {
  releaseContactSky();
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  section = document.createElement('section');
  section.id = 'contact';
  section.innerHTML = '<h2>Let us connect</h2><form><input value="Unsent draft"><textarea>Keep this message</textarea></form>';
  document.body.append(section);
  top = 3000;
  vi.spyOn(section, 'getBoundingClientRect').mockImplementation(() => DOMRect.fromRect({
    y: top + (section.hasAttribute('data-contact-presenting')
      ? parseFloat(section.style.getPropertyValue('--contact-flight-offset')) || 0 : 0),
    width: 1280, height: 900,
  }));
  unregister = registerContactSurface(section);
});
afterEach(() => {
  unregister();
  section.remove();
  releaseContactSky();
  vi.restoreAllMocks();
});

describe('the actual Contact subtree during final easing', () => {
  it('exposes the complete existing form before the camera endpoint without moving scroll or replacing DOM', () => {
    const form = section.querySelector('form');
    const field = section.querySelector('textarea');
    const scroll = window.scrollY;
    beginContactFlight(1);
    setContactProgress(CONTACT_REVEAL_END + 0.01);
    paintContactPresentation();
    expect(section).toHaveAttribute('data-contact-presenting', 'true');
    expect(section.style.getPropertyValue('--contact-flight-reveal')).toBe('1');
    expect(section.getBoundingClientRect().top).toBe(80);
    expect(section.querySelector('form')).toBe(form);
    expect(section.querySelector('textarea')).toBe(field);
    expect(field).toHaveValue('Keep this message');
    expect(window.scrollY).toBe(scroll);
  });

  it('counter-translates the current Drei HTML paint, even when a flick moves across chapters', () => {
    beginContactFlight(1);
    setContactProgress(0.8);
    paintContactPresentation();
    expect(section.getBoundingClientRect().top).toBe(80);
    top = -4000;
    paintContactPresentation();
    expect(section.getBoundingClientRect().top).toBe(80);
    expect(section.style.getPropertyValue('--contact-flight-reveal')).toBe(String(contactReveal(0.8)));
    expect(section.style.position).toBe('');
  });

  it('keeps the actual return composition in place rather than popping an offscreen form into view', () => {
    top = 750;
    beginContactFlight(-1);
    paintContactPresentation();
    expect(section.getBoundingClientRect().top).toBe(750);
    top = 1000;
    setContactProgress(0.8);
    paintContactPresentation();
    expect(section.getBoundingClientRect().top).toBe(750);
    setContactProgress(0.66);
    paintContactPresentation();
    expect(section).not.toHaveAttribute('data-contact-presenting');
  });

  it('clears only its temporary paint at settlement, cancellation and unmount', () => {
    section.style.color = 'red';
    beginContactFlight(1);
    setContactProgress(0.95);
    paintContactPresentation();
    parkContactSky();
    paintContactPresentation();
    expect(section).not.toHaveAttribute('data-contact-presenting');
    expect(section.style.getPropertyValue('--contact-flight-offset')).toBe('');
    expect(section.style.getPropertyValue('--contact-flight-reveal')).toBe('');
    expect(section.style.color).toBe('red');
    beginContactFlight(-1);
    paintContactPresentation();
    clearContactPresentation();
    expect(section).not.toHaveAttribute('data-contact-presenting');
    paintContactPresentation();
    unregister();
    expect(section).not.toHaveAttribute('data-contact-presenting');
  });

  it('does not measure or write idle/offscreen/hidden DOM', () => {
    const attribute = vi.spyOn(section, 'setAttribute');
    for (let frame = 0; frame < 50; frame++) paintContactPresentation();
    beginContactFlight(1);
    setContactProgress(0.5);
    paintContactPresentation();
    setContactProgress(0.95);
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    paintContactPresentation();
    expect(section.getBoundingClientRect).not.toHaveBeenCalled();
    expect(attribute).not.toHaveBeenCalled();
  });
});
