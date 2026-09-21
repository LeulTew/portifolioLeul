import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismTrigger } from './PrismTrigger';
import {
  advancePrismExperiment, getPrismExperiment, resetPrismExperiment, setPrismAvailable,
} from '@/lib/prism/prismExperiment';
import { claimIslandSecret, getIslandSecret, releaseIslandSecret, setIslandLayoutReady } from '@/lib/scene/islandSecret';
import { publishSectionNavigation } from '@/lib/scroll/sectionNavigation';
import { resetScrollGesture } from '@/lib/scroll/scrollGesture';

let scroller: HTMLDivElement;
beforeEach(() => {
  resetPrismExperiment(); releaseIslandSecret('avatar'); setIslandLayoutReady(true);
  resetScrollGesture();
  scroller = document.createElement('div');
  document.body.append(scroller);
  vi.stubGlobal('requestAnimationFrame', vi.fn());
});
afterEach(() => {
  cleanup(); scroller.remove(); resetPrismExperiment(); releaseIslandSecret('avatar');
  resetScrollGesture(); vi.restoreAllMocks(); vi.unstubAllGlobals();
});
function setup(enabled = true) {
  const result = render(<PrismTrigger enabled={enabled} scrollElement={scroller} />, { container: scroller });
  act(() => setPrismAvailable(true));
  return result;
}
function open() { fireEvent.click(screen.getByRole('button', { name: 'Unfold the green prism' })); }
function move() { act(() => { for (let i = 0; i < 15; i++) advancePrismExperiment(50, false); }); }

describe('hidden native prism discovery', () => {
  it('never puts text or icons on the object, including its restore state', () => {
    setup();
    const target = screen.getByRole('button', { name: 'Unfold the green prism' });
    expect(target.textContent).toBe('');
    expect(target.querySelector('span')).toHaveAttribute('aria-hidden', 'true');
    expect(target.querySelector('svg')).toBeNull();
    expect(target).not.toHaveAttribute('title');
    open();
    expect(target).toHaveAccessibleName('Restore the green prism');
    expect(target.textContent).toBe('');
  });

  it('only offers a target for an enabled, actually exposed object', () => {
    setup(false);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(requestAnimationFrame).not.toHaveBeenCalled();
  });

  it('claims only the prism, supplies a native restore action and owns no frame loop', () => {
    setup(); open(); move();
    expect(getIslandSecret()).toBe('prism');
    expect(getPrismExperiment().phase).toBe('opening');
    fireEvent.click(screen.getByRole('button', { name: 'Restore the green prism' }));
    expect(getPrismExperiment().phase).toBe('closing');
    expect(requestAnimationFrame).not.toHaveBeenCalled();
  });

  it('cannot activate through an ongoing avatar encounter', () => {
    setup();
    act(() => { claimIslandSecret('avatar'); });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(getPrismExperiment().phase).toBe('rest');
  });

  it.each(['wheel', 'Escape', 'resize'])('settles %s without cancelling user input', method => {
    setup(); open(); move();
    const event = method === 'wheel'
      ? new WheelEvent('wheel', { deltaY: 100, cancelable: true, bubbles: true })
      : method === 'Escape' ? new KeyboardEvent('keydown', { key: 'Escape', cancelable: true, bubbles: true })
        : new Event('resize');
    fireEvent(window, event);
    expect(event.defaultPrevented).toBe(false);
    expect(getPrismExperiment().phase).toBe('closing');
  });

  it('reacts to physical scroll changes, not an unchanged-position event', () => {
    setup(); open(); move();
    fireEvent.scroll(scroller);
    expect(getPrismExperiment().phase).toBe('opening');
    scroller.scrollTop = 1;
    fireEvent.scroll(scroller);
    expect(getPrismExperiment().phase).toBe('closing');
  });

  it('never claims success-shaped animation under reduced motion', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true, media: '(prefers-reduced-motion: reduce)', onchange: null,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(() => true),
    });
    setup(); open();
    expect(getPrismExperiment()).toMatchObject({ reduced: true, phase: 'holding', progress: 0 });
  });

  it('clears navigation and teardown without stale input callbacks', () => {
    const { unmount } = setup();
    open(); move();
    act(() => publishSectionNavigation('projects', { source: 'navbar' }));
    expect(getPrismExperiment().phase).toBe('rest');
    expect(getIslandSecret()).toBeNull();
    open(); move(); unmount();
    expect(getPrismExperiment().phase).toBe('rest');
    expect(getIslandSecret()).toBeNull();
    fireEvent.wheel(window, { deltaY: 100 });
    expect(getPrismExperiment().phase).toBe('rest');
  });
});
