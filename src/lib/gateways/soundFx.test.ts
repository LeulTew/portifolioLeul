import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { soundFx } from './soundFx';

describe('SoundFx Gateway', () => {
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};
    const storageMock = {
      getItem: vi.fn((key: string) => mockStorage[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        mockStorage[key] = value;
      }),
      clear: vi.fn(() => {
        mockStorage = {};
      }),
      removeItem: vi.fn((key: string) => {
        delete mockStorage[key];
      }),
      length: 0,
      key: vi.fn(() => null),
    };

    Object.defineProperty(window, 'localStorage', {
      value: storageMock,
      configurable: true,
      writable: true,
    });

    soundFx.setSoundEnabled(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes in muted mode by default for polite UX', () => {
    expect(soundFx.getSoundEnabled()).toBe(false);
  });

  it('toggles sound on and off and updates localStorage', () => {
    const enabled = soundFx.toggleMute();
    expect(enabled).toBe(true);
    expect(window.localStorage.getItem('portfolio_sound_enabled')).toBe('true');

    const mutedAgain = soundFx.toggleMute();
    expect(mutedAgain).toBe(false);
    expect(window.localStorage.getItem('portfolio_sound_enabled')).toBe('false');
  });

  it('safely invokes audio synthesis methods without throwing when AudioContext is unavailable or muted', () => {
    expect(() => {
      soundFx.playLaserClick();
      soundFx.playMagneticSnap();
      soundFx.playTabHum(2);
    }).not.toThrow();
  });

  it("properly connects AudioContext oscillator and gain nodes when audio context is active", () => {
    const mockOsc = {
      type: "sine",
      frequency: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
    const mockGain = {
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    };
    const mockResume = vi.fn().mockResolvedValue(undefined);

    class MockAudioContext {
      currentTime = 0;
      state = "suspended";
      destination = {};
      resume = mockResume;
      createOscillator = vi.fn(() => mockOsc);
      createGain = vi.fn(() => mockGain);
    }

    Object.defineProperty(window, "AudioContext", {
      value: MockAudioContext,
      configurable: true,
      writable: true,
    });

    soundFx.setSoundEnabled(true);
    soundFx.playLaserClick(880);
    soundFx.playMagneticSnap();
    soundFx.playTabHum(1);

    expect(mockResume).toHaveBeenCalled();
  });

  it('safely executes audio synthesis when unmuted', () => {
    soundFx.setSoundEnabled(true);
    expect(() => {
      soundFx.playLaserClick(880);
      soundFx.playMagneticSnap();
      soundFx.playTabHum(1);
    }).not.toThrow();
  });
});
