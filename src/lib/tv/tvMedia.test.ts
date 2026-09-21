import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TVBroadcastMedia, TV_VIDEO_URL } from './tvMedia';
import { getTVState, resetTVState } from './tvState';

let videos: HTMLVideoElement[];
beforeEach(() => { resetTVState(); videos = []; });
afterEach(() => vi.restoreAllMocks());
function fixture(playResult: () => Promise<void> = () => Promise.resolve()) {
  const frame = vi.fn<(callback: VideoFrameRequestCallback) => number>(() => 7), cancel = vi.fn();
  const video = document.createElement('video');
  const play = vi.spyOn(video, 'play').mockImplementation(playResult);
  const pause = vi.spyOn(video, 'pause').mockImplementation(() => {});
  const load = vi.spyOn(video, 'load').mockImplementation(() => {});
  Object.defineProperty(video, 'readyState', { configurable: true, value: 3 });
  video.requestVideoFrameCallback = frame;
  video.cancelVideoFrameCallback = cancel;
  const create = vi.fn(() => { videos.push(video); return video; });
  const changed = vi.fn();
  const media = new TVBroadcastMedia(changed, create);
  return { video, play, pause, load, frame, cancel, create, changed, media };
}

describe('TV decoder and texture ownership', () => {
  it('does not create/fetch video before visible deliberate power', () => {
    const { media, create, video } = fixture();
    media.sync(false); expect(create).not.toHaveBeenCalled();
    expect(video.src).toBe('');
    media.dispose(); expect(create).not.toHaveBeenCalled();
  });

  it('owns one muted lazy video, pauses it offscreen and reuses the same texture on return', async () => {
    const { media, video, create, play, pause, frame, cancel } = fixture();
    media.sync(true);
    await Promise.resolve();
    expect(create).toHaveBeenCalledOnce();
    expect(video.getAttribute('src')).toBe(TV_VIDEO_URL);
    expect(video.muted && video.loop && video.playsInline).toBe(true);
    expect(getTVState().mediaStatus).toBe('playing');
    const texture = media.texture;
    expect(texture).not.toBeNull();
    expect(frame).toHaveBeenCalledOnce();
    media.sync(false);
    expect(pause).toHaveBeenCalledOnce();
    expect(cancel).toHaveBeenCalledWith(7);
    media.sync(true); await Promise.resolve();
    expect(create).toHaveBeenCalledOnce();
    expect(media.texture).toBe(texture);
    expect(play).toHaveBeenCalledTimes(2);
    media.dispose();
    expect(video.hasAttribute('src')).toBe(false);
    expect(media.texture).toBeNull();
  });

  it('cannot resurrect media when a delayed play resolves after Projects takes over', async () => {
    let resolve!: () => void;
    const { media, changed } = fixture(() => new Promise<void>(done => { resolve = done; }));
    media.sync(true); media.sync(false);
    const calls = changed.mock.calls.length;
    resolve(); await Promise.resolve();
    expect(changed).toHaveBeenCalledTimes(calls);
    expect(getTVState().mediaStatus).toBe('idle');
    media.dispose();
  });

  it('reports blocked playback and retains a truthful test-card fallback', async () => {
    const { media, changed } = fixture(() => Promise.reject(new DOMException('Blocked', 'NotAllowedError')));
    media.sync(true); await Promise.resolve();
    expect(getTVState().mediaStatus).toBe('blocked');
    expect(getTVState().mediaMessage).toContain('blocked');
    expect(changed).toHaveBeenLastCalledWith(null, false);
    media.dispose();
  });

  it('reports a failed media source and does not keep decoding or retrying unattended', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { media, video, play, pause } = fixture();
    media.sync(true); await Promise.resolve();
    video.dispatchEvent(new Event('error'));
    expect(getTVState().mediaStatus).toBe('error');
    expect(warning).toHaveBeenCalledOnce();
    media.sync(true);
    expect(play).toHaveBeenCalledOnce();
    expect(pause).toHaveBeenCalledOnce();
    media.dispose();
  });

  it('disposes its texture and cancels its own video-frame callback exactly on teardown', async () => {
    const { media, frame, cancel, changed } = fixture();
    media.sync(true); await Promise.resolve();
    const texture = media.texture!;
    const disposed = vi.fn();
    texture.addEventListener('dispose', disposed);
    const callback = frame.mock.calls[0]?.[0];
    media.dispose();
    expect(cancel).toHaveBeenCalledWith(7);
    expect(disposed).toHaveBeenCalledOnce();
    expect(changed).toHaveBeenLastCalledWith(null, false);
    if (typeof callback === 'function') callback(0, {
      expectedDisplayTime: 0, presentationTime: 0, width: 1, height: 1, mediaTime: 0, presentedFrames: 0,
    });
    expect(frame).toHaveBeenCalledOnce();
  });
});
