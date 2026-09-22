import { useState } from 'react';
import { createPortal } from 'react-dom';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Home } from './Home';
import { HERO_SCREENS } from '@/lib/motion/heroPin';
import { resetHeroCue } from '@/lib/motion/heroCue';
import { resetScrollProgress, setScrollProgress } from '@/lib/scroll/scrollProgress';
import { publishSectionNavigation, type SectionNavigationOptions } from '@/lib/scroll/sectionNavigation';
import { animationClock } from '@/test/animationClock';

let top = 0;
let reduced = false;
let publication = 0;
let clock: ReturnType<typeof animationClock>;
const motionListeners = new Set<(event: MediaQueryListEvent) => void>();
const originalRect = Element.prototype.getBoundingClientRect;
const cue = () => screen.getByTestId('scroll-cue');

function place(next: number, native = false) {
  top = next;
  act(() => {
    if (native) window.dispatchEvent(new Event('scroll'));
    else setScrollProgress(++publication / 100);
  });
}

function setReduced(next: boolean) {
  reduced = next;
  act(() => {
    for (const listener of motionListeners) listener({ matches: next } as MediaQueryListEvent);
  });
}

function Harness({ introReady = true, flat = false }: { introReady?: boolean; flat?: boolean }) {
  const [destination, setDestination] = useState('home');
  const navigate = (id: string, options?: SectionNavigationOptions) => {
    publishSectionNavigation(id, options);
    const about = document.getElementById('about')!;
    for (const name of ['data-head-settled', 'data-statements-present']) about.removeAttribute(name);
    top = id === 'home' ? 0 : id === 'about' ? -window.innerHeight * HERO_SCREENS : -6500;
    setDestination(id);
    setScrollProgress(++publication / 100);
  };
  return <>
    <nav>
      {['home', 'about', 'skills'].map(id => <button key={id} type="button"
        data-ink-control={id} aria-current={destination === id ? 'page' : undefined}
        onClick={() => navigate(id, { source: 'navbar' })}>{id}</button>)}
    </nav>
    <main data-testid="underlay" {...(destination === 'skills' ? { inert: '' } : {})}
      style={{ visibility: destination === 'skills' ? 'hidden' : 'visible' }}>
      <Home introReady={introReady} flat={flat} onNavigate={navigate} />
      <section id="about">
        <div data-testid="about-held-header" style={{ top: '160px', paddingLeft: '80px' }} />
      </section>
    </main>
    {createPortal(
      <button type="button" hidden={destination !== 'skills'}>Read skill</button>,
      document.body,
    )}
  </>;
}

function mount(introReady = true, flat = false) {
  const view = render(<Harness introReady={introReady} flat={flat} />);
  Object.defineProperty(document.getElementById('about'), 'offsetTop', {
    configurable: true,
    get: () => window.innerHeight * Number(document.getElementById('home')!.style.getPropertyValue('--hero-screens')),
  });
  act(() => window.dispatchEvent(new Event('resize')));
  return view;
}

async function showBridge() {
  await act(async () => document.getElementById('about')!.setAttribute('data-head-settled', 'true'));
  place(-window.innerHeight * HERO_SCREENS * 3);
  await clock.run(1600);
  expect(cue()).toHaveAttribute('data-progress', '1.000');
  expect(cue()).toHaveAttribute('data-presented', 'true');
}

async function tabToCue(user: ReturnType<typeof userEvent.setup>) {
  for (let count = 0; count < 12 && document.activeElement !== cue(); count++) await user.tab();
  expect(cue()).toHaveFocus();
}

beforeEach(() => {
  top = 0;
  reduced = false;
  publication = 0;
  motionListeners.clear();
  resetHeroCue();
  resetScrollProgress();
  clock = animationClock();
  vi.stubGlobal('innerWidth', 900);
  vi.stubGlobal('innerHeight', 560);
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
    get matches() { return query === '(prefers-reduced-motion: reduce)' && reduced; },
    media: query,
    addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      if (query === '(prefers-reduced-motion: reduce)') motionListeners.add(listener);
    },
    removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      motionListeners.delete(listener);
    },
    addListener: vi.fn(),
    removeListener: vi.fn(),
  })));
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    if (this.id === 'home') return DOMRect.fromRect({
      x: 0, y: top, width: 900,
      height: 560 * Number((this as HTMLElement).style.getPropertyValue('--hero-screens')),
    });
    if (this.getAttribute('data-testid') === 'hero-pinned') return DOMRect.fromRect({ width: 900, height: 560 });
    if (this.getAttribute('data-cue-layer') === 'backdrop') return DOMRect.fromRect({ y: 130, height: 300 });
    return originalRect.call(this);
  });
});

afterEach(() => {
  cleanup();
  resetScrollProgress();
  resetHeroCue();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Home cue presentation and focus', () => {
  it.each([
    { mode: 'flat normal motion', flat: true, reduced: false },
    { mode: 'flat reduced motion', flat: true, reduced: true },
    { mode: 'scene reduced motion', flat: false, reduced: true },
  ])('keeps $mode copy interactive after native scroll without starting a held exit', async mode => {
    reduced = mode.reduced;
    const user = userEvent.setup();
    mount(true, mode.flat);
    const content = screen.getByTestId('hero-content');
    const origin = Number.parseFloat(cue().style.getPropertyValue('--cue-y'));
    place(-20, true);
    expect(Number.parseFloat(cue().style.getPropertyValue('--cue-y'))).toBeCloseTo(origin - 20);
    expect(document.getElementById('home')!.getBoundingClientRect().bottom).toBe(540);
    await clock.run(2200);
    expect(content).toHaveStyle({ visibility: 'visible', pointerEvents: 'auto', opacity: '1' });
    expect(Number(content.style.getPropertyValue('--exit'))).toBe(0);
    expect(Number(content.style.getPropertyValue('--shut'))).toBe(0);
    expect(screen.getByTestId('hero-pinned').style.getPropertyValue('--pin')).toBe('0px');

    screen.getByRole('button', { name: 'skills' }).focus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Explore My Work' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Get In Touch' })).toHaveFocus();
    const wheel = new WheelEvent('wheel', { deltaY: 20, bubbles: true, cancelable: true });
    fireEvent(window, wheel);
    expect(wheel.defaultPrevented).toBe(false);

    place(-6500, true);
    await clock.run(2200);
    expect(cue()).toBeDisabled();
    expect(content).toHaveStyle({ visibility: 'visible', pointerEvents: 'auto' });
    place(-20, true);
    expect(cue()).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'skills' }));
    await user.click(screen.getByRole('button', { name: 'home' }));
    await clock.run(2200);
    expect(screen.getByRole('button', { name: 'home' })).toHaveFocus();
    expect(content).toHaveStyle({ visibility: 'visible', pointerEvents: 'auto', opacity: '1' });
    expect(cue()).toBeEnabled();
  });

  it.each(['flat fallback', 'reduced motion'])('resets spent held phases when switching to %s and back', async mode => {
    const { rerender } = mount();
    await showBridge();
    const content = screen.getByTestId('hero-content');
    expect(content).toHaveStyle({ visibility: 'hidden' });
    await act(async () => document.getElementById('about')!.removeAttribute('data-head-settled'));
    place(-20, true);
    if (mode === 'flat fallback') rerender(<Harness flat />);
    else setReduced(true);
    expect(content).toHaveStyle({ visibility: 'visible', pointerEvents: 'auto', opacity: '1' });
    expect(Number(content.style.getPropertyValue('--exit'))).toBe(0);
    expect(Number(content.style.getPropertyValue('--shut'))).toBe(0);
    await clock.run(2200);
    expect(content).toHaveStyle({ visibility: 'visible', pointerEvents: 'auto' });

    place(0, true);
    if (mode === 'flat fallback') rerender(<Harness />);
    else setReduced(false);
    expect(content).toHaveStyle({ visibility: 'visible', pointerEvents: 'auto', opacity: '1' });
    await clock.run(1600);
    expect(cue()).toHaveAttribute('data-progress', '0.000');
    expect(content).toHaveStyle({ visibility: 'visible', pointerEvents: 'auto' });
    await showBridge();
    expect(content).toHaveStyle({ visibility: 'hidden', pointerEvents: 'none' });
  });

  it('does not expose an undrawn portal after the two native hero actions', async () => {
    const user = userEvent.setup();
    mount();
    const about = screen.getByRole('button', { name: 'about' });
    about.focus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'skills' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Explore My Work' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Get In Touch' })).toHaveFocus();
    await user.tab();
    expect(cue()).not.toHaveFocus();
    expect(cue()).toHaveAttribute('aria-hidden', 'true');
    expect(cue()).toHaveAttribute('inert');
    expect(cue()).toBeDisabled();
    expect(cue().parentElement).toBe(document.body);
  });

  it('keeps the visible escort reachable above an inert underlay, then releases its focus when statements mute it', async () => {
    const user = userEvent.setup();
    mount();
    await showBridge();
    screen.getByTestId('underlay').setAttribute('inert', '');
    expect(cue().closest('[inert]')).toBeNull();
    await tabToCue(user);
    const navigation = screen.getByRole('button', { name: 'home' });
    const focus = vi.spyOn(navigation, 'focus');
    await act(async () => document.getElementById('about')!.setAttribute('data-statements-present', 'true'));
    expect(cue().style.getPropertyValue('--cue-chapter-opacity')).toBe('0');
    expect(cue()).toBeDisabled();
    expect(cue()).toHaveAttribute('aria-hidden', 'true');
    expect(navigation).toHaveFocus();
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    await user.tab();
    expect(screen.getByRole('button', { name: 'about' })).toHaveFocus();

    await act(async () => document.getElementById('about')!.removeAttribute('data-statements-present'));
    expect(cue()).toBeEnabled();
    expect(cue()).not.toHaveAttribute('inert');
    expect(screen.getByRole('button', { name: 'about' })).toHaveFocus();
    await tabToCue(user);
  });

  it('does not leak the body portal into Skills tab order or retain it after a navbar return Home', async () => {
    const user = userEvent.setup();
    mount();
    await showBridge();
    await tabToCue(user);
    const portal = cue();
    await user.click(screen.getByRole('button', { name: 'skills' }));
    expect(screen.getByTestId('underlay')).toHaveAttribute('inert');
    expect(portal).toBeDisabled();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Read skill' })).toHaveFocus();
    expect(portal).not.toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'home' }));
    expect(cue()).toBe(portal);
    expect(portal).toHaveAttribute('data-progress', '0.000');
    expect(portal).toBeDisabled();
    expect(screen.getByRole('button', { name: 'home' })).toHaveFocus();
    await showBridge();
    expect(portal).toBeEnabled();
    expect(screen.getByRole('button', { name: 'home' })).toHaveFocus();
  });

  it('updates live reduced-motion presentation and excludes its offscreen rail on native document scroll', async () => {
    mount();
    await showBridge();
    await act(async () => document.getElementById('about')!.setAttribute('data-statements-present', 'true'));
    setReduced(true);
    expect(document.getElementById('home')!.style.getPropertyValue('--hero-screens')).toBe('1');
    expect(cue()).toBeDisabled();
    await act(async () => document.getElementById('about')!.removeAttribute('data-statements-present'));
    place(0, true);
    expect(cue()).toHaveAttribute('data-progress', '1.000');
    expect(cue()).toBeEnabled();
    place(-6500, true);
    expect(cue()).toHaveAttribute('data-progress', '1.000');
    expect(cue()).toBeDisabled();
    expect(cue()).toHaveAttribute('aria-hidden', 'true');
    place(0, true);
    expect(cue()).toBeEnabled();
    await act(async () => document.getElementById('about')!.removeAttribute('data-head-settled'));
    setReduced(false);
    expect(document.getElementById('home')!.style.getPropertyValue('--hero-screens')).toBe(String(HERO_SCREENS));
    await clock.run(1600);
    expect(cue()).toBeDisabled();
  });

  it('does not offer the otherwise visible static cue while the loader owns the entrance', () => {
    reduced = true;
    const { rerender } = mount(false);
    expect(cue()).toHaveAttribute('data-progress', '1.000');
    expect(cue()).toBeDisabled();
    rerender(<Harness introReady />);
    expect(cue()).toBeEnabled();
    const event = new WheelEvent('wheel', { deltaY: 80, bubbles: true, cancelable: true });
    fireEvent(window, event);
    expect(event.defaultPrevented).toBe(false);
  });
});
