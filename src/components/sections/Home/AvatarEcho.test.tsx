import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AvatarEcho } from './AvatarEcho';
import { publishAvatarEchoFrame } from '@/lib/avatar/avatarEchoScene';
import { publishSectionNavigation } from '@/lib/scroll/sectionNavigation';
import { resetScrollGesture } from '@/lib/scroll/scrollGesture';
import { resetScrollProgress, setScrollProgress } from '@/lib/scroll/scrollProgress';

let now = 0, nextFrame = 0, reduced = false;
const frames = new Map<number, FrameRequestCallback>();
let mediaChange: (() => void) | undefined;

function tick(milliseconds: number, step = 16) {
  act(() => {
    for (let elapsed = 0; elapsed < milliseconds; elapsed += step) {
      now += step;
      const batch = [...frames.values()];
      frames.clear();
      batch.forEach(frame => frame(now));
    }
  });
}

function setup({ ready = true, flat = false } = {}) {
  const active = vi.fn(), explore = vi.fn();
  const result = render(
    <section id="home">
      <AvatarEcho ready={ready} flat={flat} onActiveChange={active} onExplore={explore} />
    </section>,
  );
  const root = result.container.querySelector<HTMLElement>('[data-avatar-echo]')!;
  return { ...result, root, active, explore };
}

function open() { fireEvent.click(screen.getByRole('button', { name: 'Say hello to Leul' })); }

beforeEach(() => {
  now = 0; nextFrame = 0; reduced = false; frames.clear(); mediaChange = undefined;
  resetScrollGesture(); resetScrollProgress();
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
    frames.set(++nextFrame, callback); return nextFrame;
  }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => frames.delete(id)));
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    matches: reduced,
    addEventListener: (_event: string, fn: () => void) => { mediaChange = fn; },
    removeEventListener: vi.fn(),
  })));
  publishAvatarEchoFrame(true, 1.23);
});

afterEach(() => {
  cleanup();
  publishAvatarEchoFrame(false, 0);
  resetScrollGesture(); resetScrollProgress();
  vi.restoreAllMocks(); vi.unstubAllGlobals();
});

describe('the optional drawn-avatar encounter', () => {
  it('does not compete with the loader/name entrance or run an idle animation', () => {
    setup({ ready: false });
    expect(screen.queryByRole('button', { name: 'Say hello to Leul' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Oh,/ })).not.toBeInTheDocument();
    expect(frames.size).toBe(0);
  });

  it('requires the actual Hero scene receipt instead of inventing a mesh hit target', () => {
    publishAvatarEchoFrame(false, 0);
    setup();
    expect(screen.queryByRole('button', { name: 'Say hello to Leul' })).not.toBeInTheDocument();
  });

  it('opens one native introduction and completes one finite, phase-matched gesture', () => {
    const { root, active } = setup();
    expect(screen.getByRole('button', { name: 'Say hello to Leul' })).not.toHaveAttribute('aria-controls');
    open();
    expect(root.querySelector('button')).toHaveAttribute('aria-controls', 'avatar-hello');
    expect(root.dataset.avatarEcho).toBe('arriving');
    expect(active).toHaveBeenLastCalledWith(true);
    expect(screen.getByRole('heading', { name: 'Oh, hi.' })).toHaveFocus();
    const original = root.querySelector('g path')!.getAttribute('d');
    expect(original).toMatch(/^M.*Z$/);
    expect(root.querySelectorAll('[data-echo-detail]')).toHaveLength(4);
    expect(root.querySelector('[data-echo-detail="ink"]')!.getAttribute('d')).toMatch(/^M.*Z$/);
    tick(700);
    expect(root.querySelector('g path')!.getAttribute('d')).not.toBe(original);
    expect(root.style.getPropertyValue('--echo-copy')).not.toBe('0.0000');
    tick(3600);
    expect(root.dataset.avatarEcho).toBe('reading');
    expect(root.style.getPropertyValue('--echo-copy')).toBe('1.0000');
    expect(frames.size).toBe(0);
    tick(20000);
    expect(frames.size).toBe(0);
    expect(screen.getByRole('link', { name: 'GitHub' })).toHaveAttribute('href', 'https://github.com/LeulTew');
  });

  it('does not restart or duplicate a running encounter', () => {
    const { root, active } = setup();
    open();
    fireEvent.click(root.querySelector('button')!);
    expect(active).toHaveBeenCalledTimes(1);
    expect(frames.size).toBe(1);
    expect(screen.getAllByRole('heading', { name: 'Oh, hi.' })).toHaveLength(1);
  });

  it.each([200, 900, 4300])('returns continuously after %ims, then restores the trigger focus', elapsed => {
    const { root, active } = setup();
    open(); tick(elapsed);
    const before = root.querySelector('g')!.getAttribute('transform');
    fireEvent.click(screen.getByRole('button', { name: /Back to the island/ }));
    expect(root.dataset.avatarEcho).toBe('returning');
    expect(root.querySelector('g')!.getAttribute('transform')).toBe(before);
    tick(800);
    expect(root.dataset.avatarEcho).toBe('idle');
    expect(active).toHaveBeenLastCalledWith(false);
    expect(screen.getByRole('button', { name: 'Say hello to Leul' })).toHaveFocus();
    expect(frames.size).toBe(0);
  });

  it('lets Escape return without cancelling a keyboard event', () => {
    const { root } = setup();
    open(); tick(1000);
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    fireEvent(window, escape);
    expect(escape.defaultPrevented).toBe(false);
    expect(root.dataset.avatarEcho).toBe('returning');
    tick(800);
    expect(root.dataset.avatarEcho).toBe('idle');
  });

  it.each(['arriving', 'reading', 'returning'])('yields native wheel input during %s', phase => {
    const { root, active } = setup();
    open(); tick(phase === 'reading' ? 4300 : 300);
    if (phase === 'returning') fireEvent.click(screen.getByRole('button', { name: /Back to the island/ }));
    const event = new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true });
    fireEvent(screen.getByRole('heading', { name: 'Oh, hi.' }), event);
    expect(event.defaultPrevented).toBe(false);
    expect(root.dataset.avatarEcho).toBe('idle');
    expect(active).toHaveBeenLastCalledWith(false);
    expect(frames.size).toBe(0);
    expect(root).toHaveFocus();
  });

  it('keeps Space available to a native button and yields scroll keys without cancellation', () => {
    const { root } = setup();
    open();
    const button = screen.getByRole('button', { name: 'Keep exploring' });
    fireEvent.keyDown(button, { key: ' ' });
    expect(root.dataset.avatarEcho).toBe('arriving');
    const event = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
    fireEvent(button, event);
    expect(event.defaultPrevented).toBe(false);
    expect(root.dataset.avatarEcho).toBe('idle');
  });

  it('cancels on touch travel, never a touch tap', () => {
    const { root } = setup();
    open();
    fireEvent.touchStart(window, { touches: [{ clientY: 400 }] });
    fireEvent.touchMove(window, { touches: [{ clientY: 397 }] });
    expect(root.dataset.avatarEcho).toBe('arriving');
    const move = new Event('touchmove', { bubbles: true, cancelable: true });
    Object.defineProperty(move, 'touches', { value: [{ clientY: 350 }] });
    fireEvent(window, move);
    expect(move.defaultPrevented).toBe(false);
    expect(root.dataset.avatarEcho).toBe('idle');
  });

  it('does not steal focus from navbar navigation or delayed return callbacks', () => {
    const { root } = setup();
    open(); tick(300);
    fireEvent.click(screen.getByRole('button', { name: /Back to the island/ }));
    const navigation = document.createElement('button');
    document.body.appendChild(navigation);
    navigation.focus();
    act(() => publishSectionNavigation('projects', { source: 'navbar' }));
    tick(1000);
    expect(root.dataset.avatarEcho).toBe('idle');
    expect(navigation).toHaveFocus();
    navigation.remove();
  });

  it('uses the existing exploration action rather than creating a second navigation owner', () => {
    const { root, explore } = setup();
    open(); tick(1000);
    fireEvent.click(screen.getByRole('button', { name: 'Keep exploring' }));
    expect(root.dataset.avatarEcho).toBe('idle');
    expect(explore).toHaveBeenCalledOnce();
  });

  it.each(['resize', 'visibility', 'camera', 'position'])('cleans up on %s, without replay', reason => {
    const { root } = setup();
    open(); tick(400);
    act(() => {
      if (reason === 'resize') window.dispatchEvent(new Event('resize'));
      if (reason === 'visibility') {
        vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
        document.dispatchEvent(new Event('visibilitychange'));
      }
      if (reason === 'camera') publishAvatarEchoFrame(false, 1);
      if (reason === 'position') {
        vi.spyOn(document.getElementById('home')!, 'getBoundingClientRect')
          .mockReturnValue({ top: -120 } as DOMRect);
        setScrollProgress(0.1);
      }
    });
    expect(root.dataset.avatarEcho).toBe('idle');
    expect(frames.size).toBe(0);
    tick(5000);
    expect(root.dataset.avatarEcho).toBe('idle');
  });

  it('caps a long frame at 50ms rather than skipping the greeting', () => {
    const { root } = setup();
    open(); tick(16);
    tick(9000, 9000);
    expect(root.dataset.avatarEcho).toBe('arriving');
    expect(Number(root.style.getPropertyValue('--echo-presence'))).toBeLessThan(0.01);
  });

  it.each([false, true])('retains the native static introduction with reduced motion or flat=%s', flat => {
    reduced = !flat;
    if (flat) publishAvatarEchoFrame(false, 0);
    const { root } = setup({ flat });
    open();
    expect(root.dataset.avatarEcho).toBe('reading');
    expect(root.style.getPropertyValue('--echo-copy')).toBe('1.0000');
    expect(frames.size).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: /Back to the island/ }));
    expect(root.dataset.avatarEcho).toBe('idle');
    expect(screen.getByRole('button', { name: 'Say hello to Leul' })).toHaveFocus();
  });

  it('settles live reduced motion without a hidden flight or surprise replay', () => {
    const { root } = setup();
    open(); tick(700);
    reduced = true;
    act(() => mediaChange?.());
    expect(root.dataset.avatarEcho).toBe('reading');
    expect(root.style.getPropertyValue('--echo-copy')).toBe('1.0000');
    expect(frames.size).toBe(0);
    reduced = false;
    act(() => mediaChange?.());
    expect(frames.size).toBe(0);
    expect(root.dataset.avatarEcho).toBe('reading');
  });

  it('finishes an explicit close instead of reopening when reduced motion changes during return', () => {
    const { root, active } = setup();
    open(); tick(1000);
    fireEvent.click(screen.getByRole('button', { name: /Back to the island/ }));
    tick(200);
    expect(root.dataset.avatarEcho).toBe('returning');
    reduced = true;
    act(() => mediaChange?.());
    expect(root.dataset.avatarEcho).toBe('idle');
    expect(active).toHaveBeenLastCalledWith(false);
    expect(frames.size).toBe(0);
    expect(screen.getByRole('button', { name: 'Say hello to Leul' })).toHaveFocus();
  });

  it('removes its score and subscriptions on unmount', () => {
    const { unmount, active } = setup();
    open(); tick(700);
    unmount();
    expect(frames.size).toBe(0);
    const count = active.mock.calls.length;
    fireEvent.wheel(window, { deltaY: 120 });
    publishSectionNavigation('contact');
    tick(5000);
    expect(active).toHaveBeenCalledTimes(count);
  });
});
