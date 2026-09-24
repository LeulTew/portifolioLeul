import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import gsap from 'gsap';
import { EducationRail } from './EducationRail';
import { finishEducation as finish } from '@/test/educationClock';
import { resetScrollGesture } from '@/lib/scroll/scrollGesture';
import { resetScrollProgress } from '@/lib/scroll/scrollProgress';
import { publishSectionNavigation } from '@/lib/scroll/sectionNavigation';

const next = () => screen.getByRole('button', { name: 'Next record' });
const previous = () => screen.getByRole('button', { name: 'Previous record' });
const navigation = () => screen.getByRole('button', { name: 'Contact navigation' });
const record = () => Number(screen.getByTestId('education-stage').dataset.activeRecord);

function mount() {
  render(<>
    <nav><button type="button" data-ink-control="contact">Contact navigation</button></nav>
    <section id="about" data-title-settled="true"><EducationRail /></section>
  </>);
  gsap.ticker.sleep();
  finish('education-sticky-header');
  expect(next()).toBeEnabled();
}

function loseDisabledFocus(button: HTMLButtonElement) {
  expect(button).toBeDisabled();
  // JSDOM retains disabled-button focus and ignores blur(). Model Chromium's
  // observed body fallback without changing the control or its event handlers.
  if (document.activeElement === button) {
    document.body.tabIndex = -1;
    document.body.focus();
    document.body.removeAttribute('tabindex');
  }
  expect(document.body).toHaveFocus();
}

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'development');
  resetScrollGesture();
  resetScrollProgress();
  vi.stubGlobal('innerWidth', 1440);
  vi.stubGlobal('innerHeight', 900);
  vi.spyOn(window, 'scrollBy').mockImplementation(() => {});
  const original = Element.prototype.getBoundingClientRect;
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    return this.getAttribute('data-testid') === 'education-rail'
      ? DOMRect.fromRect({ y: 400, width: 1440, height: 3000 })
      : original.call(this);
  });
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
    return this.dataset.testid === 'education-rail' ? 3000 : 900;
  });
});

afterEach(() => {
  cleanup();
  gsap.ticker.sleep();
  resetScrollGesture();
  resetScrollProgress();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('Education keyboard focus through record crossings', () => {
  it('names the active Education reader from its own heading without hiding its controls', () => {
    mount();
    const stage = screen.getByTestId('education-stage');
    expect(stage.tagName).toBe('SECTION');
    expect(screen.getByRole('region', { name: 'Education' })).toBe(stage);
    const heading = screen.getByRole('heading', { name: 'Education', level: 2 });
    expect(heading.id).not.toBe('');
    expect(stage).toHaveAttribute('aria-labelledby', heading.id);
    expect(stage).toContainElement(heading);
    expect(stage).toContainElement(next());
    expect(stage).not.toHaveAttribute('aria-hidden', 'true');
    expect(next()).toBeEnabled();
  });

  it('restores Next at completion so successive native Enter activations keep reading', async () => {
    const user = userEvent.setup();
    mount();
    const button = next() as HTMLButtonElement;
    button.focus();
    await user.keyboard('{Enter}');
    expect(record()).toBe(1);
    loseDisabledFocus(button);
    finish('education-track', 0.5);
    expect(document.body).toHaveFocus();
    expect(button).toBeDisabled();
    finish('education-track');
    expect(button).toHaveFocus();
    expect(button).toBeEnabled();
    await user.keyboard('{Enter}');
    expect(record()).toBe(2);
    loseDisabledFocus(button);
    finish('education-track');
    expect(button).toHaveFocus();
  });

  it.each([
    { source: 'next', start: 2, end: 3 },
    { source: 'previous', start: 1, end: 0 },
  ])('focuses an enabled local control at the $source boundary', async ({ source, start, end }) => {
    const user = userEvent.setup();
    mount();
    for (let index = 0; index < start; index++) {
      fireEvent.click(next());
      finish('education-track');
    }
    const button = (source === 'next' ? next() : previous()) as HTMLButtonElement;
    button.focus();
    await user.keyboard(' ');
    expect(record()).toBe(end);
    loseDisabledFocus(button);
    finish('education-track');
    const available = source === 'next' ? previous() : next();
    expect(available).toBeEnabled();
    expect(available).toHaveFocus();
    expect(button).toBeDisabled();
  });

  it('does not reclaim focus after the reader tabs away, even if that new target later blurs', async () => {
    const user = userEvent.setup();
    mount();
    const button = next() as HTMLButtonElement;
    button.focus();
    await user.keyboard('{Enter}');
    loseDisabledFocus(button);
    await user.tab();
    expect(navigation()).toHaveFocus();
    navigation().blur();
    expect(document.body).toHaveFocus();
    finish('education-track');
    expect(document.body).toHaveFocus();
  });

  it('does not steal navbar focus or carry a restoration through explicit navigation', async () => {
    const user = userEvent.setup();
    mount();
    const button = next() as HTMLButtonElement;
    button.focus();
    await user.keyboard('{Enter}');
    loseDisabledFocus(button);
    await user.click(navigation());
    act(() => publishSectionNavigation('contact', { source: 'navbar' }));
    expect(navigation()).toHaveFocus();
    expect(screen.getByTestId('education-stage')).toHaveAttribute('data-phase', 'outside');
    expect(button).toBeDisabled();
  });

  it('cancels recovery when the reader points elsewhere while focus is on body', async () => {
    const user = userEvent.setup();
    mount();
    const button = next() as HTMLButtonElement;
    button.focus();
    await user.keyboard('{Enter}');
    loseDisabledFocus(button);
    fireEvent.pointerDown(document.body);
    finish('education-track');
    expect(document.body).toHaveFocus();
  });

  it('never creates focus when a wheel rather than a focused control advances a record', () => {
    mount();
    const wheel = new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true });
    fireEvent(window, wheel);
    expect(wheel.defaultPrevented).toBe(false);
    expect(record()).toBe(1);
    finish('education-track');
    expect(document.body).toHaveFocus();
  });
});
