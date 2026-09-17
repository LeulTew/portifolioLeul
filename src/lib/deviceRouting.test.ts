import { describe, expect, it, vi } from 'vitest';
import { DESKTOP_ORIGIN, MOBILE_ORIGIN, isPhone, portfolioRedirect, routeOrStart } from './deviceRouting';

const desktop = { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0' };
const phone = { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148' };

describe('stable phone identification shared with the mobile portfolio', () => {
  it.each([
    phone,
    { userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel 9) Chrome/140.0 Mobile Safari/537.36' },
    { userAgent: 'Mozilla/5.0 (iPod touch) Mobile' },
    { userAgent: 'Mozilla/5.0 (Windows Phone 10.0)' },
    { userAgent: 'Reduced browser identity', userAgentData: { mobile: true } },
  ])('identifies a phone without using its viewport: $userAgent', device => {
    expect(isPhone(device)).toBe(true);
  });

  it.each([
    desktop,
    { ...desktop, maxTouchPoints: 10 },
    { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)' },
    { userAgent: 'Mozilla/5.0 (X11; Linux x86_64)' },
    { userAgent: 'Mozilla/5.0 (Linux; Android 15; Tablet) Mobile', userAgentData: { mobile: true } },
    { userAgent: 'Mozilla/5.0 (Linux; Android 15; SM-X900) Safari/537.36' },
    { userAgent: 'Mozilla/5.0 (iPad; CPU OS 18_0) Mobile', userAgentData: { mobile: true } },
    { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Mobile', maxTouchPoints: 5 },
  ])('keeps desktop and tablets on desktop: $userAgent', device => {
    expect(isPhone(device)).toBe(false);
  });
});

describe('production portfolio routing', () => {
  it.each([
    DESKTOP_ORIGIN, MOBILE_ORIGIN,
    'https://portifolio-leul.vercel.app', 'https://portifolio-x-leul.vercel.app',
  ])('routes either public site without a loop: %s', origin => {
    for (const [device, target] of [[phone, MOBILE_ORIGIN], [desktop, DESKTOP_ORIGIN]] as const) {
      const href = `${origin}/projects?campaign=hello%20world&x=1#skills`;
      const result = portfolioRedirect(href, device);
      const expected = `${target}/projects?campaign=hello%20world&x=1#skills`;
      expect(result ?? href).toBe(expected);
      expect(portfolioRedirect(expected, device)).toBeNull();
    }
  });

  it.each([
    'http://localhost:5191/', 'http://127.0.0.1:5191/',
    'https://preview-123.vercel.app/', 'https://example.com/',
    'https://portifolio-leul.vercel.app.example.com/',
  ])('leaves local and unrecognized hosts available for isolated review: %s', href => {
    expect(portfolioRedirect(href, phone)).toBeNull();
    expect(portfolioRedirect(href, desktop)).toBeNull();
  });

  it('does not interpret user query parameters as redirect destinations or device overrides', () => {
    const suffix = '/?desktop=true&redirect=https%3A%2F%2Fexample.com#contact';
    expect(portfolioRedirect(`${DESKTOP_ORIGIN}${suffix}`, phone)).toBe(`${MOBILE_ORIGIN}${suffix}`);
  });

  it('canonicalizes the protocol and clears a nonstandard source port', () => {
    expect(portfolioRedirect('http://portifolio-leul.vercel.app:8080/?a=1#contact', phone))
      .toBe(`${MOBILE_ORIGIN}/?a=1#contact`);
    expect(portfolioRedirect('http://leul-t-agonafer.vercel.app:8080/', desktop))
      .toBe(`${DESKTOP_ORIGIN}/`);
  });

  it('redirects a phone before importing React, Three.js, or application styles', async () => {
    const replace = vi.fn();
    const load = vi.fn().mockResolvedValue(undefined);
    await routeOrStart(DESKTOP_ORIGIN, phone, replace, load);
    expect(replace).toHaveBeenCalledExactlyOnceWith(`${MOBILE_ORIGIN}/`);
    expect(load).not.toHaveBeenCalled();
  });

  it('boots exactly once on the correct canonical host', async () => {
    const replace = vi.fn();
    const load = vi.fn().mockResolvedValue(undefined);
    await routeOrStart(DESKTOP_ORIGIN, desktop, replace, load);
    expect(replace).not.toHaveBeenCalled();
    expect(load).toHaveBeenCalledOnce();
  });

  it('surfaces startup failures instead of returning a success-shaped fallback', async () => {
    const error = new Error('The application chunk could not load');
    await expect(routeOrStart(DESKTOP_ORIGIN, desktop, vi.fn(), () => Promise.reject(error)))
      .rejects.toBe(error);
  });
});
