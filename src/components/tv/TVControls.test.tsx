import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TVControls } from './TVControls';
import {
  getTVState, registerTVReader, resetTVState, setTVExposure, setTVPagingAvailable, setTVProjectPhase,
} from '@/lib/tv/tvState';
import { TV_READER_SURFACE, registerTVHardware } from '@/lib/tv/tvHardware';
import { soundFx } from '@/lib/gateways/soundFx';
import { isProjectsReadingTarget } from '@/components/sections/Projects/projectsInput';

let scroller: HTMLDivElement;
beforeEach(() => {
  resetTVState();
  scroller = document.createElement('div');
  const main = document.createElement('main'); main.setAttribute('inert', '');
  scroller.append(main); document.body.append(scroller);
  vi.spyOn(soundFx, 'playTVPress').mockImplementation(() => {});
});
afterEach(() => { cleanup(); scroller.remove(); resetTVState(); vi.restoreAllMocks(); });
function setup(layout: 'power' | 'all' = 'all') {
  const view = render(<TVControls enabled scrollElement={scroller} />);
  act(() => setTVExposure(true, layout));
  return view;
}

describe('native tactile TV controls', () => {
  it('lives outside covered main content in the actual scrollport, without visible overlay labels', () => {
    setup();
    const power = screen.getByRole('button', { name: 'Turn TV on' });
    expect(screen.getByRole('region', { name: 'Television controls' })).toBe(power.closest('[data-tv-controls]'));
    expect(power.closest('[aria-hidden="true"]')).toBeNull();
    expect(power.closest('[inert]')).toBeNull();
    expect(power.closest('[data-tv-controls]')!.parentElement).toBe(scroller);
    expect(power.textContent).toBe('');
    expect(power).not.toHaveAttribute('title');
    expect(screen.getByRole('button', { name: 'Next channel' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('declares the keys as following the reader surface in focus order', () => {
    setup();
    expect(screen.getByRole('region', { name: 'Television controls' }))
      .toHaveAttribute('data-focus-after', TV_READER_SURFACE);
  });

  it('only shows power when full-size channel targets would overlap', () => {
    setup('power');
    expect(screen.getByRole('button', { name: 'Turn TV on' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Next channel' })).toBeNull();
  });

  it('dispatches one action and sound, with independent physical down/up signals', () => {
    const physical = vi.fn(), release = registerTVHardware(physical);
    setup();
    const power = screen.getByRole('button', { name: 'Turn TV on' });
    fireEvent.pointerDown(power, { button: 0 });
    fireEvent.pointerUp(power, { button: 0 });
    fireEvent.click(power);
    expect(getTVState()).toMatchObject({ source: 'broadcast', channel: 0 });
    expect(soundFx.playTVPress).toHaveBeenCalledExactlyOnceWith('power-on');
    expect(physical).toHaveBeenCalledWith('power', 'press', false);
    fireEvent.click(screen.getByRole('button', { name: 'Next channel' }));
    expect(getTVState().channel).toBe(1);
    expect(soundFx.playTVPress).toHaveBeenLastCalledWith('channel');
    release();
  });

  it('routes project paging and power retreat through existing reader callbacks', () => {
    setup();
    const page = vi.fn(), retreat = vi.fn();
    act(() => {
      registerTVReader({ page, retreat });
      setTVPagingAvailable(true); setTVProjectPhase('reading');
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next project' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous project' }));
    expect(page.mock.calls).toEqual([[1], [-1]]);
    fireEvent.click(screen.getByRole('button', { name: 'Turn TV off and return to the scene' }));
    expect(retreat).toHaveBeenCalledOnce();
    expect(getTVState().broadcastOn).toBe(false);
  });

  it('never cancels native wheel or keyboard scrolling', () => {
    setup();
    const power = screen.getByRole('button', { name: 'Turn TV on' });
    const wheel = new WheelEvent('wheel', { deltaY: 1, bubbles: true, cancelable: true });
    const key = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
    fireEvent(power, wheel); fireEvent(power, key);
    expect(wheel.defaultPrevented).toBe(false); expect(key.defaultPrevented).toBe(false);
  });

  it('restores visible scene-navigation focus after power-off retreat without trapping arrow navigation', () => {
    setup();
    const next = document.createElement('button');
    next.dataset.tvSceneNext = '';
    next.textContent = 'Open the screen';
    scroller.append(next);
    act(() => {
      registerTVReader({ page: vi.fn(), retreat: () => {
        expect(document.activeElement).toBe(scroller.querySelector('[data-tv-controls]'));
        setTVProjectPhase('retreating'); setTVExposure(true, 'hidden');
      } });
      setTVProjectPhase('reading');
    });
    const power = screen.getByRole('button', { name: 'Turn TV off and return to the scene' });
    power.focus(); fireEvent.click(power);
    expect(document.activeElement).toBe(scroller.querySelector('[data-tv-controls]'));
    expect(document.activeElement).toHaveAccessibleName('Television controls');
    act(() => { setTVProjectPhase('framed'); setTVExposure(true, 'all'); });
    expect(next).toHaveFocus();
    expect(isProjectsReadingTarget(document.activeElement)).toBe(false);
  });

  it('does not return focus from a navbar action made during the power-off retreat', () => {
    setup();
    const navigation = document.createElement('button');
    navigation.textContent = 'Contact'; scroller.append(navigation);
    act(() => {
      registerTVReader({ page: vi.fn(), retreat: () => {
        setTVProjectPhase('retreating'); setTVExposure(true, 'hidden');
      } });
      setTVProjectPhase('reading');
    });
    const power = screen.getByRole('button', { name: 'Turn TV off and return to the scene' });
    power.focus(); fireEvent.click(power);
    navigation.focus();
    act(() => { setTVProjectPhase('framed'); setTVExposure(true, 'all'); });
    expect(navigation).toHaveFocus();
  });

  it('releases physical hover and press ownership when controls hide or the window blurs', () => {
    const physical = vi.fn(), release = registerTVHardware(physical);
    setup();
    physical.mockClear();
    fireEvent(window, new Event('blur'));
    expect(physical).toHaveBeenCalledWith('power', 'press', false);
    expect(physical).toHaveBeenCalledWith('next', 'hover', false);
    physical.mockClear();
    act(() => setTVExposure(false, 'hidden'));
    expect(physical).toHaveBeenCalledWith('previous', 'focus', false);
    expect(physical).toHaveBeenCalledWith('power', 'press', false);
    release();
  });

  it('provides no imaginary controls without a live 3D scrollport', () => {
    render(<TVControls enabled={false} scrollElement={null} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
