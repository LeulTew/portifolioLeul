import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAvatarEchoFrame, publishAvatarEchoFrame, subscribeAvatarEcho } from './avatarEchoScene';

afterEach(() => publishAvatarEchoFrame(false, 0));

describe('avatar scene receipt', () => {
  it('publishes availability changes, never per-frame React notifications', () => {
    const listener = vi.fn();
    const release = subscribeAvatarEcho(listener);
    publishAvatarEchoFrame(true, 1.2);
    for (let i = 0; i < 120; i++) publishAvatarEchoFrame(true, i / 60);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getAvatarEchoFrame()).toEqual({ available: true, time: 119 / 60 });
    publishAvatarEchoFrame(false, 2);
    expect(listener).toHaveBeenCalledTimes(2);
    release();
    publishAvatarEchoFrame(true, 3);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('rejects invalid clocks instead of publishing corrupt shape coordinates', () => {
    expect(() => publishAvatarEchoFrame(true, NaN)).toThrow(RangeError);
  });
});
