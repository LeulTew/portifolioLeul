import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  beginContactFlight, commitContactPose, getContactView, hasContactCamera,
  isContactPoseCommitted, parkContactSky, registerContactCamera, releaseContactSky,
  setContactProgress, subscribeContactPose,
} from './contactScene';

beforeEach(() => {
  releaseContactSky();
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
});
afterEach(() => {
  releaseContactSky();
  vi.restoreAllMocks();
});

describe('Contact camera handoff receipts', () => {
  it('does not report completion from elapsed time alone or before the draw callback ends', async () => {
    beginContactFlight(1);
    const revision = getContactView().revision;
    setContactProgress(1);
    expect(isContactPoseCommitted()).toBe(false);
    commitContactPose(revision, 1);
    expect(isContactPoseCommitted()).toBe(false);
    await Promise.resolve();
    expect(isContactPoseCommitted()).toBe(true);
  });

  it('publishes an endpoint once and ignores intermediate frames', async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeContactPose(listener);
    try {
      beginContactFlight(-1);
      const revision = getContactView().revision;
      setContactProgress(0.5);
      commitContactPose(revision, 0.5);
      await Promise.resolve();
      expect(listener).not.toHaveBeenCalled();
      setContactProgress(0);
      commitContactPose(revision, 0);
      commitContactPose(revision, 0);
      await Promise.resolve();
      expect(listener).toHaveBeenCalledOnce();
    } finally {
      unsubscribe();
    }
  });

  it.each(['navbar', 'new flight', 'hidden tab'] as const)(
    'cannot release an old landing after %s', async action => {
      beginContactFlight(1);
      setContactProgress(1);
      commitContactPose(getContactView().revision, 1);
      const listener = vi.fn();
      const unsubscribe = subscribeContactPose(listener);
      try {
        if (action === 'navbar') parkContactSky();
        else if (action === 'new flight') beginContactFlight(-1);
        else vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
        await Promise.resolve();
        expect(listener).not.toHaveBeenCalled();
      } finally {
        unsubscribe();
      }
    },
  );

  it('tracks the mounted camera independently of optional cloud readiness', () => {
    expect(hasContactCamera()).toBe(false);
    const remove = registerContactCamera();
    expect(hasContactCamera()).toBe(true);
    parkContactSky();
    expect(getContactView()).toMatchObject({ mode: 'parked', progress: 1 });
    remove();
    expect(hasContactCamera()).toBe(false);
  });

  it('rejects non-finite internal progress without disguising it as a ready frame', () => {
    expect(() => setContactProgress(Number.NaN)).toThrow(RangeError);
    expect(() => setContactProgress(Infinity)).toThrow(RangeError);
  });
});
