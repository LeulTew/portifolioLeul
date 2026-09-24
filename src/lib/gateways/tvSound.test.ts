import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => vi.resetModules());
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('TV-only tactile sound', () => {
  async function setup() {
    const oscillators: Array<{ onended: null | (() => void); disconnect: ReturnType<typeof vi.fn> }> = [];
    let now = 1;
    const frequency = vi.fn(), level = vi.fn(), decay = vi.fn(), stop = vi.fn();
    const gains: Array<{ disconnect: ReturnType<typeof vi.fn> }> = [];
    const createOscillator = vi.fn(() => {
      const oscillator = { type: 'sine', frequency: { setValueAtTime: frequency },
        connect: vi.fn(), start: vi.fn(), stop, disconnect: vi.fn(), onended: null as null | (() => void) };
      oscillators.push(oscillator); return oscillator;
    });
    const createGain = vi.fn(() => {
      const gain = { gain: { setValueAtTime: level, exponentialRampToValueAtTime: decay },
        connect: vi.fn(), disconnect: vi.fn() };
      gains.push(gain); return gain;
    });
    class Audio {
      get currentTime() { return now; }
      state = 'running';
      destination = {};
      createOscillator = createOscillator;
      createGain = createGain;
    }
    vi.stubGlobal('AudioContext', Audio);
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    const { soundFx } = await import('./soundFx');
    soundFx.setSoundEnabled(false);
    return { soundFx, oscillators, gains, createOscillator, frequency, decay, stop,
      advance: () => { now += 0.2; } };
  }

  it('never plays until the existing Audio FX preference is enabled', async () => {
    const { soundFx, createOscillator } = await setup();
    soundFx.playTVPress('channel'); soundFx.playTVPress('power-on');
    expect(createOscillator).not.toHaveBeenCalled();
    soundFx.setSoundEnabled(true);
    soundFx.playTVPress('channel');
    expect(createOscillator).toHaveBeenCalledOnce();
  });

  it('uses short finite mechanical envelopes and disconnects their nodes', async () => {
    const { soundFx, oscillators, gains, stop, decay, frequency, advance } = await setup();
    soundFx.setSoundEnabled(true);
    soundFx.playTVPress('channel');
    expect(frequency).toHaveBeenLastCalledWith(155, 1);
    expect(stop).toHaveBeenLastCalledWith(1.04);
    expect(decay).toHaveBeenLastCalledWith(0.0001, 1.04);
    oscillators[0].onended?.();
    expect(oscillators[0].disconnect).toHaveBeenCalledOnce();
    expect(gains[0].disconnect).toHaveBeenCalledOnce();
    advance(); soundFx.playTVPress('power-on');
    expect(frequency).toHaveBeenLastCalledWith(105, 1.2);
    advance(); soundFx.playTVPress('power-off');
    expect(frequency).toHaveBeenLastCalledWith(78, 1.4);
  });

  it('cannot produce a burst of overlapping audio from repeat input or a hidden tab', async () => {
    const { soundFx, createOscillator, advance } = await setup();
    soundFx.setSoundEnabled(true);
    for (let i = 0; i < 20; i++) soundFx.playTVPress('channel');
    expect(createOscillator).toHaveBeenCalledOnce();
    advance();
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    soundFx.playTVPress('power-on');
    expect(createOscillator).toHaveBeenCalledOnce();
  });
});
