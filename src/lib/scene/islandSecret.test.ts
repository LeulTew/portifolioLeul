import { afterEach, describe, expect, it, vi } from 'vitest';
import { claimIslandSecret, getIslandSecret, releaseIslandSecret, subscribeIslandSecret } from './islandSecret';

afterEach(() => { releaseIslandSecret('avatar'); releaseIslandSecret('prism'); });

describe('exclusive island secrets', () => {
  it('does not let a material experiment and a portrait take ownership together', () => {
    expect(claimIslandSecret('avatar')).toBe(true);
    expect(claimIslandSecret('prism')).toBe(false);
    expect(getIslandSecret()).toBe('avatar');
    releaseIslandSecret('prism');
    expect(getIslandSecret()).toBe('avatar');
    releaseIslandSecret('avatar');
    expect(claimIslandSecret('prism')).toBe(true);
    expect(claimIslandSecret('avatar')).toBe(false);
  });

  it('publishes only ownership changes and cleans up subscribers', () => {
    const listener = vi.fn();
    const release = subscribeIslandSecret(listener);
    claimIslandSecret('prism');
    claimIslandSecret('prism');
    releaseIslandSecret('avatar');
    expect(listener).toHaveBeenCalledOnce();
    releaseIslandSecret('prism');
    expect(listener).toHaveBeenCalledTimes(2);
    release();
    claimIslandSecret('avatar');
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
