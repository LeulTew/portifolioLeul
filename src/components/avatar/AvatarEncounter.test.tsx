import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import postcss from 'postcss';
import { AvatarEncounter } from './AvatarEncounter';
import {
  finishAvatarReturn,
  getAvatarEncounter,
  paintAvatarEncounter,
  paintAvatarTarget,
  requestAvatarEncounter,
  resetAvatarEncounter,
  setAvatarAvailability,
  setAvatarEncounterEnabled,
  setAvatarEncounterPhase,
  setAvatarHeroReady,
} from '@/lib/avatar/avatarEncounter';
import { publishSectionNavigation } from '@/lib/scroll/sectionNavigation';
import { resetScrollGesture } from '@/lib/scroll/scrollGesture';
import controlStyles from '@/components/ui/ControlButton.module.css';
import styles from './AvatarEncounter.module.css';

const fixtures = new Set<HTMLElement>();

function setup({ enabled = true, available = true, strict = false } = {}) {
  const scroller = document.createElement('div');
  const main = document.createElement('main');
  main.setAttribute('inert', '');
  scroller.append(main);
  const nav = document.createElement('nav');
  const navigation = document.createElement('button');
  navigation.textContent = 'Projects';
  nav.append(navigation);
  document.body.append(scroller, nav);
  fixtures.add(scroller);
  fixtures.add(nav);
  const overlay = <AvatarEncounter enabled={enabled} scrollElement={scroller} />;
  const result = render(strict ? <StrictMode>{overlay}</StrictMode> : overlay);
  act(() => { setAvatarAvailability(available); });
  const root = scroller.querySelector<HTMLElement>('[data-avatar-encounter]')!;
  const target = root.querySelector<HTMLButtonElement>('[aria-label="Meet Leul in 3D"]')!;
  const back = root.querySelector<HTMLButtonElement>('[aria-label="Return to scene"]')!;
  return { ...result, root, target, back, scroller, main, navigation };
}

function open() {
  fireEvent.click(screen.getByRole('button', { name: 'Meet Leul in 3D' }));
}

beforeEach(() => {
  resetAvatarEncounter();
  resetScrollGesture();
  vi.stubGlobal('requestAnimationFrame', vi.fn());
});

afterEach(() => {
  cleanup();
  fixtures.forEach(element => element.remove());
  fixtures.clear();
  resetAvatarEncounter();
  resetScrollGesture();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('the original-avatar encounter overlay', () => {
  it('uses a wordless decorative cue while retaining the accessible action name', () => {
    const { target, root } = setup();
    expect(screen.getByRole('region', { name: '3D scene' })).toBe(root);
    expect(target.closest('[aria-hidden="true"]')).toBeNull();
    expect(target).toHaveAccessibleName('Meet Leul in 3D');
    expect(target.textContent).toBe('');
    expect(target.querySelector('span')).toHaveAttribute('aria-hidden', 'true');
    expect(target.querySelector('svg')).toBeNull();
    expect(target).not.toHaveAttribute('title');
  });

  it('portals into the actual scrollport, outside an inert main and the render host', () => {
    const { root, main, scroller, container, navigation } = setup();
    expect(root.parentElement).toBe(scroller);
    expect(scroller.firstElementChild).toBe(root);
    expect(main.parentElement).toBe(scroller);
    expect(main).toHaveAttribute('inert');
    expect(main).not.toContainElement(root);
    expect(container).not.toContainElement(root);
    expect(root.closest('[inert]')).toBeNull();
    expect(root).toHaveAttribute('tabindex', '-1');
    open();
    navigation.focus();
    expect(navigation).toHaveFocus();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.body).not.toHaveAttribute('inert');
  });

  it('uses scene projection availability, independent of Hero DOM or its entrance receipt', () => {
    const { target } = setup({ available: false });
    expect(document.getElementById('home')).toBeNull();
    act(() => { setAvatarHeroReady(true); });
    expect(target).toBeDisabled();
    expect(target).not.toBeVisible();
    act(() => {
      setAvatarHeroReady(false);
      paintAvatarTarget(402, 84, 112, 300);
      setAvatarAvailability(true);
    });
    expect(target).toBeEnabled();
    expect(target).toHaveStyle({ transform: 'translate3d(402.0px, 84.0px, 0)', width: '112.0px', height: '300.0px' });
    expect(screen.getByRole('button', { name: 'Meet Leul in 3D' })).toBe(target);
    act(() => { setAvatarAvailability(false); });
    expect(target).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Meet Leul in 3D' })).not.toBeInTheDocument();
  });

  it('registers hidden elements without offering a fake encounter when the scene is disabled', () => {
    const { root, target, back, rerender, scroller } = setup({ enabled: false });
    expect(getAvatarEncounter().enabled).toBe(false);
    expect(target).toBeDisabled();
    expect(back).toBeDisabled();
    expect(root.querySelectorAll('button:not([hidden])')).toHaveLength(0);
    paintAvatarTarget(510, 90, 100, 280);
    paintAvatarEncounter(0, 0, 0, 0.25);
    expect(target.style.width).toBe('100px');
    expect(root.style.getPropertyValue('--avatar-reveal')).toBe('0.2500');
    fireEvent.click(target);
    expect(getAvatarEncounter().phase).toBe('idle');
    rerender(<AvatarEncounter enabled scrollElement={scroller} />);
    expect(target).toBeDisabled();
    act(() => { setAvatarAvailability(true); });
    expect(target).toBeEnabled();
    expect(requestAnimationFrame).not.toHaveBeenCalled();
  });

  it('does not enable the store or render any portal without a scrollport', () => {
    const { container } = render(<AvatarEncounter enabled scrollElement={null} />);
    expect(container).toBeEmptyDOMElement();
    expect(getAvatarEncounter().enabled).toBe(false);
    expect(requestAvatarEncounter()).toBe(false);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('requests once and immediately focuses the usable shared Return control, before reveal', () => {
    const { root, target, back } = setup();
    expect(target).toHaveAttribute('type', 'button');
    expect(target).toHaveClass(styles.target);
    open();
    fireEvent.click(target);
    expect(getAvatarEncounter().revision).toBe(1);
    expect(getAvatarEncounter().phase).toBe('approaching');
    expect(target).toBeDisabled();
    expect(target).not.toBeVisible();
    expect(back).toBeEnabled();
    expect(back).toBeVisible();
    expect(back).toHaveFocus();
    expect(back).toHaveClass(controlStyles.button);
    expect(back).toHaveAttribute('type', 'button');
    expect(back).toHaveAttribute('aria-keyshortcuts', 'Escape');
    expect(back).toHaveAccessibleDescription('Leul Tewodros Software engineer');
    expect(root.querySelectorAll('button:not([hidden])')).toHaveLength(1);
    expect(root.querySelectorAll('p')).toHaveLength(2);
    expect(root.querySelectorAll('canvas, img, h1, h2, a')).toHaveLength(0);
    expect(root.querySelector('svg path')).not.toBeNull();
    expect(root.querySelector('[aria-controls]')).toBeNull();
    fireEvent.click(back);
    expect(getAvatarEncounter().phase).toBe('returning');
    expect(back).toBeVisible();
    expect(back).toBeEnabled();
    fireEvent.click(back);
    expect(getAvatarEncounter().revision).toBe(2);
    expect(requestAnimationFrame).not.toHaveBeenCalled();
  });

  it('lets the camera paint reveal and target geometry without overwriting them on React commits', () => {
    const { root, target, back, rerender, scroller } = setup();
    open();
    const captionId = back.getAttribute('aria-describedby')!;
    act(() => {
      paintAvatarEncounter(0.5, 0.7, 0.1, 0.45);
      paintAvatarTarget(212.2, 71.5, 124.7, 260.3);
      setAvatarEncounterPhase('meeting');
    });
    rerender(<AvatarEncounter enabled scrollElement={scroller} />);
    expect(root.style.getPropertyValue('--avatar-reveal')).toBe('0.4500');
    expect(target.style.transform).toBe('translate3d(212.2px, 71.5px, 0)');
    expect(target.style.width).toBe('124.7px');
    expect(target.style.height).toBe('260.3px');
    expect(back.getAttribute('aria-describedby')).toBe(captionId);
    expect(document.getElementById(captionId)).toHaveTextContent('Leul Tewodros');
  });

  it('returns on Escape without cancelling or stopping the native key event', () => {
    const { back, scroller } = setup();
    open();
    const bubble = vi.fn();
    scroller.addEventListener('keydown', bubble);
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    expect(fireEvent(back, escape)).toBe(true);
    expect(escape.defaultPrevented).toBe(false);
    expect(bubble).toHaveBeenCalledOnce();
    expect(getAvatarEncounter()).toMatchObject({ phase: 'returning', exit: 'return' });
    expect(back).toHaveFocus();
  });

  it.each(['approaching', 'meeting', 'returning'] as const)('yields wheel input during %s and retires focus inside the scrollport', phase => {
    const { root, target, back, scroller } = setup();
    open();
    act(() => { setAvatarEncounterPhase(phase); });
    const bubble = vi.fn();
    const focus = vi.spyOn(root, 'focus');
    scroller.addEventListener('wheel', bubble);
    const wheel = new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true });
    expect(fireEvent(back, wheel)).toBe(true);
    expect(wheel.defaultPrevented).toBe(false);
    expect(bubble).toHaveBeenCalledOnce();
    expect(getAvatarEncounter()).toMatchObject({ phase: 'yielding', exit: 'input' });
    expect(root).toHaveFocus();
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(back).not.toBeVisible();
    expect(back).toBeDisabled();
    expect(target).toBeDisabled();
    expect(screen.queryByText('Leul Tewodros')).not.toBeVisible();
    act(() => { finishAvatarReturn(); });
    expect(target).toBeEnabled();
    expect(root).toHaveFocus();
    expect(target).not.toHaveFocus();
  });

  it.each(['approaching', 'meeting', 'returning'] as const)('ignores unchanged scroll position and yields on actual movement during %s', phase => {
    const { root, back, scroller } = setup();
    scroller.scrollTop = 380;
    const addListener = vi.spyOn(scroller, 'addEventListener');
    const removeListener = vi.spyOn(scroller, 'removeEventListener');
    open();
    expect(addListener).toHaveBeenCalledWith('scroll', expect.any(Function), { passive: true });
    act(() => { setAvatarEncounterPhase(phase); });
    fireEvent.scroll(scroller);
    expect(getAvatarEncounter().phase).toBe(phase);
    expect(back).toHaveFocus();
    expect(back).toBeVisible();

    const received = vi.fn();
    scroller.addEventListener('scroll', received);
    scroller.scrollTop = 380.25;
    const scroll = new Event('scroll', { cancelable: true });
    expect(fireEvent(scroller, scroll)).toBe(true);
    expect(scroll.defaultPrevented).toBe(false);
    expect(received).toHaveBeenCalledOnce();
    expect(scroller.scrollTop).toBe(380.25);
    expect(getAvatarEncounter()).toMatchObject({ phase: 'yielding', exit: 'input' });
    expect(back).not.toBeVisible();
    expect(root).toHaveFocus();
    expect(removeListener).toHaveBeenCalledWith('scroll', addListener.mock.calls[0][1]);
  });

  it('catches physical scrolling after a wheel delta below the gesture bus threshold', () => {
    const { root, back, scroller } = setup();
    scroller.scrollTop = 200;
    open();
    const wheel = new WheelEvent('wheel', { deltaY: 0.5, bubbles: true, cancelable: true });
    expect(fireEvent(back, wheel)).toBe(true);
    expect(wheel.defaultPrevented).toBe(false);
    expect(getAvatarEncounter().phase).toBe('approaching');
    scroller.scrollTop = 200.5;
    fireEvent.scroll(scroller);
    expect(getAvatarEncounter()).toMatchObject({ phase: 'yielding', exit: 'input', revision: 2 });
    expect(root).toHaveFocus();
    fireEvent.scroll(scroller);
    expect(getAvatarEncounter().revision).toBe(2);
  });

  it('captures a fresh physical position for each activation rather than retaining idle scrolling', () => {
    const { back, scroller } = setup();
    open();
    fireEvent.click(back);
    act(() => { finishAvatarReturn(); });
    scroller.scrollTop = 640;
    fireEvent.scroll(scroller);
    expect(getAvatarEncounter().phase).toBe('idle');
    open();
    fireEvent.scroll(scroller);
    expect(getAvatarEncounter().phase).toBe('approaching');
    scroller.scrollTop = 639;
    fireEvent.scroll(scroller);
    expect(getAvatarEncounter()).toMatchObject({ phase: 'yielding', exit: 'input' });
  });

  it('does not steal navbar focus when scrollbar or programmatic scrolling moves the scrollport', () => {
    const { back, navigation, scroller } = setup();
    open();
    navigation.focus();
    scroller.scrollTop = 500;
    fireEvent.scroll(scroller);
    expect(getAvatarEncounter()).toMatchObject({ phase: 'yielding', exit: 'input' });
    expect(back).not.toBeVisible();
    expect(navigation).toHaveFocus();
    act(() => { finishAvatarReturn(); });
    expect(navigation).toHaveFocus();
  });

  it.each(['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp'])('does not cancel %s or strand held scrolling keys on a hidden button', key => {
    const { root, back, scroller } = setup();
    open();
    const bubble = vi.fn();
    scroller.addEventListener('keydown', bubble);
    const keydown = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    expect(fireEvent(back, keydown)).toBe(true);
    expect(keydown.defaultPrevented).toBe(false);
    expect(root).toHaveFocus();
    expect(root.parentElement).toBe(scroller);
    const held = new KeyboardEvent('keydown', { key, repeat: true, bubbles: true, cancelable: true });
    expect(fireEvent(root, held)).toBe(true);
    expect(held.defaultPrevented).toBe(false);
    expect(bubble).toHaveBeenCalledTimes(2);
    expect(getAvatarEncounter().phase).toBe('yielding');
  });

  it.each([
    ['Home', 'home', { source: 'navbar' }],
    ['End', 'contact', { source: 'navbar', edge: 'end' }],
  ] as const)('does not cancel %s, which ends the encounter by navigating rather than as a scroll gesture', (key, section, options) => {
    // Round 8 (D-FLAT-002): Home and End go to the ends of the story (storyKeys), which publishes navigation.
    const { back, scroller } = setup();
    open();
    const bubble = vi.fn();
    scroller.addEventListener('keydown', bubble);
    const keydown = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    expect(fireEvent(back, keydown)).toBe(true);
    expect(keydown.defaultPrevented).toBe(false);
    // Nothing here moves focus for the key: the navigation that follows lands it in the destination.
    expect(back).toHaveFocus();
    expect(bubble).toHaveBeenCalledOnce();
    expect(getAvatarEncounter().phase).not.toBe('yielding');
    act(() => { publishSectionNavigation(section, options); });
    expect(getAvatarEncounter()).toMatchObject({ phase: 'idle', exit: 'navigation' });
  });

  it('preserves native Space activation for both buttons rather than treating it as a scroll gesture', async () => {
    const user = userEvent.setup();
    const { target, back } = setup();
    target.focus();
    await user.keyboard(' ');
    expect(getAvatarEncounter().phase).toBe('approaching');
    expect(back).toHaveFocus();
    expect(getAvatarEncounter().revision).toBe(1);
    await user.keyboard(' ');
    expect(getAvatarEncounter()).toMatchObject({ phase: 'returning', exit: 'return', revision: 2 });
    act(() => { finishAvatarReturn(); });
    expect(target).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(getAvatarEncounter()).toMatchObject({ phase: 'approaching', revision: 3 });
  });

  it('yields on real touch travel, not a tap, without cancelling touch input', () => {
    const { root, back } = setup();
    open();
    fireEvent.touchStart(back, { touches: [{ clientY: 400 }] });
    fireEvent.touchMove(back, { touches: [{ clientY: 397 }] });
    expect(getAvatarEncounter().phase).toBe('approaching');
    const touch = new Event('touchmove', { bubbles: true, cancelable: true });
    Object.defineProperty(touch, 'touches', { value: [{ clientY: 340 }] });
    expect(fireEvent(back, touch)).toBe(true);
    expect(touch.defaultPrevented).toBe(false);
    expect(getAvatarEncounter().phase).toBe('yielding');
    expect(root).toHaveFocus();
  });

  it('yields on resize instead of snapping the camera back or replaying the encounter', () => {
    const { root, back, target } = setup();
    open();
    paintAvatarEncounter(0.6, 0.5, 0, 0.3);
    fireEvent.resize(window);
    expect(getAvatarEncounter()).toMatchObject({ phase: 'yielding', exit: 'input', progress: 0.6 });
    expect(back).not.toBeVisible();
    expect(root).toHaveFocus();
    act(() => { finishAvatarReturn(); });
    expect(getAvatarEncounter().phase).toBe('idle');
    expect(target).not.toHaveFocus();
    expect(requestAnimationFrame).not.toHaveBeenCalled();
  });

  it('aborts for navigation without taking focus from the navbar or restoring stale focus later', () => {
    const { back, target, navigation } = setup();
    open();
    fireEvent.click(back);
    navigation.focus();
    act(() => { publishSectionNavigation('projects', { source: 'navbar' }); });
    expect(getAvatarEncounter()).toMatchObject({ phase: 'idle', exit: 'navigation' });
    expect(back).not.toBeVisible();
    expect(navigation).toHaveFocus();
    act(() => {
      finishAvatarReturn();
      setAvatarAvailability(false);
      setAvatarAvailability(true);
    });
    expect(navigation).toHaveFocus();
    expect(target).not.toHaveFocus();
  });

  it('aborts when the document is hidden, without reopening when it becomes visible', () => {
    const { back, target } = setup();
    open();
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    fireEvent(document, new Event('visibilitychange'));
    expect(getAvatarEncounter()).toMatchObject({ phase: 'idle', exit: 'hidden' });
    expect(back).not.toBeVisible();
    expect(target).not.toHaveFocus();
    hidden.mockReturnValue(false);
    fireEvent(document, new Event('visibilitychange'));
    expect(getAvatarEncounter().phase).toBe('idle');
    expect(target).not.toHaveFocus();
  });

  it('waits for the returned projection to re-enable the trigger before restoring retained focus once', () => {
    const { root, target, back } = setup();
    open();
    fireEvent.click(back);
    act(() => { setAvatarAvailability(false); finishAvatarReturn(); });
    expect(target).toBeDisabled();
    expect(root).toHaveFocus();
    const focus = vi.spyOn(target, 'focus');
    act(() => { setAvatarAvailability(true); });
    expect(target).toBeEnabled();
    expect(target).toHaveFocus();
    expect(focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true });
    act(() => { setAvatarAvailability(false); setAvatarAvailability(true); });
    expect(focus).toHaveBeenCalledTimes(1);
  });

  it.each(['returning', 'awaiting-projection'])('does not steal focus after Tab leaves while %s', async state => {
    const user = userEvent.setup();
    const { back, target, navigation } = setup();
    open();
    fireEvent.click(back);
    if (state === 'awaiting-projection') {
      act(() => { setAvatarAvailability(false); finishAvatarReturn(); });
    }
    await user.tab();
    expect(navigation).toHaveFocus();
    act(() => { finishAvatarReturn(); setAvatarAvailability(true); });
    expect(navigation).toHaveFocus();
    expect(target).not.toHaveFocus();
  });

  it('does not take focus from navigation on a wheel yield or an Escape return', () => {
    const { navigation, target } = setup();
    open();
    navigation.focus();
    fireEvent.wheel(navigation, { deltaY: 100 });
    expect(getAvatarEncounter().phase).toBe('yielding');
    expect(navigation).toHaveFocus();
    act(() => { finishAvatarReturn(); });
    open();
    navigation.focus();
    fireEvent.keyDown(navigation, { key: 'Escape' });
    act(() => { finishAvatarReturn(); });
    expect(navigation).toHaveFocus();
    expect(target).not.toHaveFocus();
  });

  it('disables both controls and aborts if the enabled scene is removed mid-encounter', () => {
    const { root, target, back, scroller, rerender } = setup();
    open();
    rerender(<AvatarEncounter enabled={false} scrollElement={scroller} />);
    expect(getAvatarEncounter()).toMatchObject({ enabled: false, phase: 'idle', available: false });
    expect(root.parentElement).toBe(scroller);
    expect(target).toBeDisabled();
    expect(back).toBeDisabled();
    expect(target).not.toBeVisible();
    expect(back).not.toBeVisible();
    rerender(<AvatarEncounter enabled scrollElement={null} />);
    expect(scroller.querySelector('[data-avatar-encounter]')).toBeNull();
    expect(getAvatarEncounter().enabled).toBe(false);
  });

  it('survives StrictMode registration cleanup without duplicate requests or stale element registration', () => {
    const { root, target } = setup({ strict: true });
    expect(getAvatarEncounter().enabled).toBe(true);
    open();
    expect(getAvatarEncounter()).toMatchObject({ phase: 'approaching', revision: 1 });
    paintAvatarEncounter(0.3, 0, 0, 0.2);
    paintAvatarTarget(321, 88, 100, 300);
    expect(root.style.getPropertyValue('--avatar-reveal')).toBe('0.2000');
    expect(target.style.width).toBe('100px');
  });

  it('cleans element registration, store state, bus subscriptions and browser listeners on unmount', () => {
    const { root, target, scroller, unmount } = setup();
    const removeListener = vi.spyOn(scroller, 'removeEventListener');
    open();
    unmount();
    expect(removeListener).toHaveBeenCalledWith('scroll', expect.any(Function));
    expect(getAvatarEncounter()).toMatchObject({ enabled: false, available: false, phase: 'idle', exit: 'unmount' });
    expect(root).not.toBeInTheDocument();
    paintAvatarEncounter(1, 1, 1, 1);
    paintAvatarTarget(100, 100, 100, 100);
    expect(root.style.getPropertyValue('--avatar-reveal')).toBe('');
    expect(target.style.transform).toBe('');
    setAvatarEncounterEnabled(true);
    setAvatarAvailability(true);
    requestAvatarEncounter();
    scroller.scrollTop = 600;
    fireEvent.scroll(scroller);
    fireEvent.wheel(window, { deltaY: 120 });
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.resize(window);
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    fireEvent(document, new Event('visibilitychange'));
    publishSectionNavigation('about');
    expect(getAvatarEncounter()).toMatchObject({ phase: 'approaching', exit: null });
    expect(requestAnimationFrame).not.toHaveBeenCalled();
  });
});

const css = postcss.parse(readFileSync(join(__dirname, 'AvatarEncounter.module.css'), 'utf8'));

function declarations(selector: string) {
  const matches: Array<import('postcss').Rule> = [];
  css.walkRules(rule => { if (rule.selectors.includes(selector)) matches.push(rule); });
  const rule = matches[0];
  if (!rule) throw new Error(`Missing CSS rule: ${selector}`);
  const values: Record<string, string> = {};
  rule.walkDecls(declaration => { values[declaration.prop] = declaration.value; });
  return values;
}

describe('discreet scene overlay styling', () => {
  it('keeps a zero-height sticky overlay in the native scroll chain, with a transparent viewport', () => {
    expect(declarations('.encounter')).toMatchObject({
      position: 'sticky', top: '0', height: '0', 'z-index': '90', 'pointer-events': 'none',
      'font-family': "'Skills Grotesk', 'Inter', sans-serif",
      '--avatar-surface': 'navSurfaceDark',
    });
    expect(declarations('.viewport')).toMatchObject({
      position: 'absolute', top: '0', left: '0', width: '100%', height: '100vh', 'pointer-events': 'none',
    });
    expect(declarations('.encounter').background).toBeUndefined();
    expect(declarations(":global([data-theme='light']) .encounter")).toMatchObject({
      '--avatar-surface': 'navSurfaceLight', '--avatar-ink': '#0a251e', '--avatar-focus': 'brandEmerald',
    });
    expect(declarations('.caption p').width).toBe('fit-content');
    expect(declarations('.target')).toMatchObject({
      top: '0', left: '0', 'min-width': '48px', 'min-height': '48px', 'pointer-events': 'auto',
    });
    expect(declarations('.returnControl')['pointer-events']).toBe('auto');
    expect(declarations('.target:focus-visible .cue').outline).toBe('2px solid var(--avatar-focus)');
  });

  it('never takes over projected geometry or a separate reveal clock, and does not fade Return', () => {
    const target = declarations('.target');
    for (const property of ['width', 'height', 'transform', 'transition', 'animation']) {
      expect(target[property]).toBeUndefined();
    }
    expect(declarations('.cue').left).toBe('var(--avatar-cue-x, 50%)');
    expect(declarations('.cue')).toMatchObject({ opacity: '0', visibility: 'hidden', 'pointer-events': 'none' });
    expect(declarations('.cue')).toMatchObject({
      width: '5px', height: '5px', 'border-radius': '50%',
      background: 'var(--avatar-focus)', 'box-shadow': '0 0 9px 2px var(--avatar-glint)',
    });
    expect(declarations('.cue').border).toBeUndefined();
    expect(declarations('.cue').padding).toBeUndefined();
    expect(declarations('.target:focus-visible .cue')).toMatchObject({ opacity: '1', visibility: 'visible' });
    expect(declarations('.target:not(:disabled):hover .cue')).toMatchObject({ opacity: '1', visibility: 'visible' });
    expect(declarations('.caption').opacity).toBe('var(--avatar-reveal, 0)');
    expect(declarations('.returnControl').opacity).toBeUndefined();
    expect(declarations('.returnControl').transition).toBeUndefined();
    css.walkDecls(declaration => {
      expect(declaration.prop).not.toMatch(/^(animation|filter|backdrop-filter|will-change|--avatar-reveal)/);
    });
    expect(declarations('.target[hidden]').display).toBe('none');
    expect(declarations('.caption[hidden]').display).toBe('none');
    expect(declarations('.returnControl[hidden]').display).toBe('none');
    const reduced: string[] = [];
    css.walkAtRules('media', rule => {
      if (rule.params.includes('prefers-reduced-motion')) {
        rule.walkDecls('transition', declaration => { reduced.push(declaration.value); });
      }
    });
    expect(reduced).toEqual(['none']);
  });
});
