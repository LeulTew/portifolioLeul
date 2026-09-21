import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TVModel } from './TVModel';
import { activateTV, getTVState, resetTVState, setTVExposure, setTVProjectPhase } from '@/lib/tv/tvState';

vi.mock('./3d/CRTHousing', () => ({ CRTHousing: () => null }));
vi.mock('./3d/CRTSpeakerCabinet', () => ({ CRTSpeakerCabinet: () => null }));
vi.mock('./3d/TVHardware', () => ({ TVHardware: () => null }));
vi.mock('./3d/TVScreenProjection', () => ({ TVScreenProjection: () => null }));
vi.mock('@react-three/fiber', () => ({ useFrame: vi.fn() }));

beforeEach(() => {
  resetTVState();
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
});
afterEach(() => { cleanup(); resetTVState(); vi.restoreAllMocks(); });

describe('physical TV model and isolated display', () => {
  it('starts off without a video element, request or autoplay timer', () => {
    const create = vi.spyOn(document, 'createElement'), interval = vi.spyOn(window, 'setInterval');
    const { container } = render(<TVModel />);
    expect(container.querySelector('mesh[name="tv-display-signal"]')).not.toBeNull();
    expect(create.mock.calls.filter(([name]) => name === 'video')).toHaveLength(0);
    expect(interval).not.toHaveBeenCalled();
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  });

  it('does not treat arbitrary cabinet clicks as a channel command', () => {
    const { container } = render(<TVModel />);
    fireEvent.click(container.firstElementChild!);
    expect(getTVState()).toMatchObject({ broadcastOn: false, channel: 0 });
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  });

  it('uses one user-started video and stops its decoder for the Projects display', async () => {
    const create = vi.spyOn(document, 'createElement');
    render(<TVModel />);
    await act(async () => { setTVExposure(true, 'all'); activateTV('power'); });
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledOnce();
    expect(create.mock.calls.filter(([name]) => name === 'video')).toHaveLength(1);
    act(() => setTVProjectPhase('approaching'));
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledOnce();
    expect(getTVState().source).toBe('projects');
    await act(async () => setTVProjectPhase('framed'));
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2);
    expect(create.mock.calls.filter(([name]) => name === 'video')).toHaveLength(1);
  });

  it('uses the zero-download test card without a second decoder', async () => {
    const create = vi.spyOn(document, 'createElement');
    render(<TVModel />);
    await act(async () => { setTVExposure(true, 'all'); activateTV('power'); });
    act(() => activateTV('next'));
    expect(getTVState().channel).toBe(1);
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledOnce();
    expect(create.mock.calls.filter(([name]) => name === 'video')).toHaveLength(1);
  });

  it('stops media in a hidden document and disposes its owned resources on unmount', async () => {
    const { unmount } = render(<TVModel />);
    await act(async () => { setTVExposure(true, 'all'); activateTV('power'); });
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    fireEvent(document, new Event('visibilitychange'));
    expect(getTVState().exposed).toBe(false);
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
    unmount();
    expect(HTMLMediaElement.prototype.load).toHaveBeenCalledOnce();
  });
});
