import { describe, expect, it } from 'vitest';
import { NativeScrollUsageError, parseNativeScrollOptions } from './nativeScrollOptions';

describe('native:scroll options (round 34)', () => {
  it('runs both themes on the owned preview by default', () => {
    expect(parseNativeScrollOptions([])).toEqual({ url: undefined, port: 4320, chrome: undefined, args: [], themes: ['light', 'dark'] });
  });

  it('takes one theme, a Chrome, a port and repeated Chrome switches in order', () => {
    expect(parseNativeScrollOptions([
      '--theme', 'dark', '--chrome', 'C:/chrome.exe', '--chrome-arg', '--disable-3d-apis',
      '--port', '4400', '--chrome-arg', '--force-device-scale-factor=2',
    ])).toEqual({
      url: undefined, port: 4400, chrome: 'C:/chrome.exe',
      args: ['--disable-3d-apis', '--force-device-scale-factor=2'], themes: ['dark'],
    });
  });

  it('measures an origin it is given', () => {
    expect(parseNativeScrollOptions(['--url', 'http://127.0.0.1:5218']).url).toBe('http://127.0.0.1:5218');
  });

  it.each([
    [['--them', 'light'], /Unknown option --them/],
    [['--chrome-arg'], /--chrome-arg needs a value/],
    [['--theme'], /--theme needs a value/],
    [['--port', '--theme', 'light'], /--port needs a value/],
    [['--theme', 'sepia'], /--theme must be light or dark/],
    [['--port', '70000'], /--port must be a port number/],
    [['--port', 'x'], /--port must be a port number/],
    [['--theme', 'light', '--theme', 'dark'], /--theme given twice/],
    [['--url', 'http://127.0.0.1:1', '--port', '4400'], /exclusive/],
    [['--url', '127.0.0.1:5218'], /http\(s\) origin/],
  ])('refuses %j', (argv, message) => {
    expect(() => parseNativeScrollOptions(argv)).toThrow(NativeScrollUsageError);
    expect(() => parseNativeScrollOptions(argv)).toThrow(message);
  });
});
