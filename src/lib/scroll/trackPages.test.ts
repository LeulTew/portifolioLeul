import { contentOutgrewTrack, contentPages, pagesChanged, SCROLL_PAGE_EPSILON } from './trackPages';

describe('trackPages', () => {
  it('maps content 1:1 onto the track, never below one screen', () => {
    expect(contentPages(9000, 1000)).toBe(9);
    expect(contentPages(400, 1000)).toBe(1);
    // Unmeasured content, or an unmeasured window, is one screen, not a division by zero.
    expect(contentPages(0, 1000)).toBe(1);
    expect(contentPages(900, 0)).toBe(900);
  });

  it('rebuilds only past the deadband', () => {
    expect(pagesChanged(9.1, 9)).toBe(false);
    expect(pagesChanged(8.9, 9)).toBe(false);
    expect(pagesChanged(9 + SCROLL_PAGE_EPSILON + 0.01, 9)).toBe(true);
    expect(pagesChanged(9 - SCROLL_PAGE_EPSILON - 0.01, 9)).toBe(true);
  });

  it('owes a rebuild the content observer has not reported once the content leaves the drawn count', () => {
    const content = document.createElement('main');
    let height = 9000;
    Object.defineProperty(content, 'scrollHeight', { configurable: true, get: () => height });
    expect(contentOutgrewTrack(content, 9, 1000)).toBe(false);
    height = 9100;
    expect(contentOutgrewTrack(content, 9, 1000)).toBe(false);
    height = 9200;
    expect(contentOutgrewTrack(content, 9, 1000)).toBe(true);
    expect(contentOutgrewTrack(null, 9, 1000)).toBe(false);
  });
});
