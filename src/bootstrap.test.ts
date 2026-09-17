import { afterEach, describe, expect, it, vi } from 'vitest';
import { routeOrStart } from './lib/deviceRouting';

vi.mock('./lib/deviceRouting', () => ({ routeOrStart: vi.fn().mockResolvedValue(undefined) }));

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  document.body.replaceChildren();
});

describe('the lightweight portfolio entry', () => {
  it('delegates device routing before loading the application', async () => {
    await import('./bootstrap');
    expect(routeOrStart).toHaveBeenCalledWith(
      window.location.href, navigator, expect.any(Function), expect.any(Function),
    );
  });

  it('offers a visible retry if the application chunk fails to load', async () => {
    document.body.innerHTML = '<div id="root"></div>';
    const error = new Error('Chunk unavailable');
    vi.mocked(routeOrStart).mockRejectedValueOnce(error);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    await import('./bootstrap');
    await vi.waitFor(() => {
      expect(document.querySelector('#root')?.textContent).toContain('could not load');
      expect(document.querySelector('button')?.textContent).toBe('Reload portfolio');
    });
    expect(log).toHaveBeenCalledWith('Portfolio startup failed:', error);
  });
});
