import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  activateTV, getTVState, isTVActionEnabled, registerTVReader, resetTVState,
  setTVExposure, setTVMediaStatus, setTVPagingAvailable, setTVProjectPhase, subscribeTV,
} from './tvState';

beforeEach(resetTVState);

describe('one TV, two mutually exclusive display sources', () => {
  it('starts off and cannot activate invisible hardware', () => {
    expect(getTVState()).toMatchObject({ broadcastOn: false, source: 'off', channel: 0 });
    expect(activateTV('power')).toBe(false);
    setTVExposure(true, 'power');
    expect(isTVActionEnabled('power')).toBe(true);
    expect(isTVActionEnabled('next')).toBe(false);
  });

  it('powers media only on deliberate input and pages channels without an autoplay timer', () => {
    setTVExposure(true, 'all');
    expect(activateTV('next')).toBe(false);
    activateTV('power');
    expect(getTVState()).toMatchObject({ broadcastOn: true, source: 'broadcast', channel: 0 });
    activateTV('next');
    expect(getTVState().channel).toBe(1);
    activateTV('next');
    expect(getTVState().channel).toBe(0);
    activateTV('previous');
    expect(getTVState().channel).toBe(1);
    activateTV('power');
    expect(getTVState()).toMatchObject({ broadcastOn: false, source: 'off', channel: 1 });
  });

  it('allows broadcast before close-up, reserves the display for the complete Projects handoff', () => {
    setTVExposure(true, 'all');
    activateTV('power');
    for (const phase of ['revealed', 'framed'] as const) {
      setTVProjectPhase(phase);
      expect(getTVState().source).toBe('broadcast');
    }
    for (const phase of ['approaching', 'reading', 'retreating', 'departing'] as const) {
      setTVProjectPhase(phase);
      expect(getTVState().source).toBe('projects');
    }
    setTVProjectPhase('framed');
    expect(getTVState()).toMatchObject({ broadcastOn: true, source: 'broadcast' });
  });

  it('always makes Projects readable even when entertainment was powered off', () => {
    setTVProjectPhase('reading');
    expect(getTVState()).toMatchObject({ broadcastOn: false, source: 'projects' });
    setTVProjectPhase('framed');
    expect(getTVState().source).toBe('off');
  });

  it('routes physical channel keys to the actual filtered project selection only', () => {
    const page = vi.fn(), retreat = vi.fn();
    registerTVReader({ page, retreat }); setTVPagingAvailable(true);
    setTVExposure(true, 'all'); setTVProjectPhase('reading');
    activateTV('next'); activateTV('previous');
    expect(page.mock.calls).toEqual([[1], [-1]]);
    expect(getTVState().channel).toBe(0);
    expect(retreat).not.toHaveBeenCalled();
    setTVPagingAvailable(false);
    expect(activateTV('next')).toBe(false);
  });

  it('power-off in Projects requests the established retreat and does not expose media under the reader', () => {
    const retreat = vi.fn(() => setTVProjectPhase('retreating'));
    registerTVReader({ page: vi.fn(), retreat }); setTVExposure(true, 'all');
    activateTV('power');
    setTVProjectPhase('reading');
    expect(activateTV('power')).toBe(true);
    expect(retreat).toHaveBeenCalledOnce();
    expect(getTVState()).toMatchObject({ source: 'projects', broadcastOn: false, phase: 'retreating' });
    expect(activateTV('power')).toBe(false);
    setTVProjectPhase('framed');
    expect(getTVState().source).toBe('off');
  });

  it('publishes only actual changes and unregisters stale reader ownership', () => {
    const listener = vi.fn(), release = subscribeTV(listener);
    setTVExposure(true, 'all'); setTVExposure(true, 'all');
    expect(listener).toHaveBeenCalledOnce();
    setTVMediaStatus('error', 'Video unavailable');
    setTVMediaStatus('error', 'Video unavailable');
    expect(listener).toHaveBeenCalledTimes(2);
    const remove = registerTVReader({ page: vi.fn(), retreat: vi.fn() });
    setTVProjectPhase('reading'); remove();
    expect(activateTV('power')).toBe(false);
    release(); setTVExposure(false, 'hidden');
  });
});
