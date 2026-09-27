import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LAYOUT_SETTLE_MS } from './layoutSettle';
import { movedOnDistance, resetNavigationLeft, subscribeNavigationLeft } from './navigationLeft';
import { publishSectionNavigation } from './sectionNavigation';

/*
 * Round 34 (D-R34-001): after the navbar's About, a move with no gesture into
 * About's hand-off or into Skills left every staged chapter stepped aside, and
 * the reader rested on a blank chapter for good.
 */

function track(height = window.innerHeight) {
  const box = document.body.appendChild(document.createElement('div'));
  Object.defineProperty(box, 'clientHeight', { configurable: true, value: height });
  const move = (top: number) => {
    box.scrollTop = top;
    box.dispatchEvent(new Event('scroll'));
  };
  return { box, move };
}

let heard: string[] = [];
let stop = () => {};
beforeEach(() => {
  vi.useFakeTimers();
  heard = [];
  stop = subscribeNavigationLeft(direction => heard.push(direction));
});
afterEach(() => {
  stop();
  resetNavigationLeft();
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe('the reader moving on from a navigation', () => {
  const far = () => movedOnDistance(window.innerHeight) + 10;

  it('says nothing without a navigation to move on from', () => {
    const { move } = track();
    move(0);
    move(5000);
    vi.advanceTimersByTime(LAYOUT_SETTLE_MS);
    move(9000);
    expect(heard).toEqual([]);
  });

  it('is heard once the page has rested where the navigation left it and then gone a clear distance', () => {
    const { move } = track();
    move(1000);
    publishSectionNavigation('about', { source: 'navbar', immediate: true });
    move(1858);
    vi.advanceTimersByTime(LAYOUT_SETTLE_MS);
    move(1858 + far());
    expect(heard).toEqual(['down']);
    move(1858 + far() * 3);
    expect(heard).toEqual(['down']);
  });

  it('does not take the navigation\'s own travel, however far, for the reader moving on', () => {
    const { move } = track();
    move(0);
    publishSectionNavigation('contact');
    // A glide: many scrolls, none of them a rest.
    for (let top = 0; top <= 14000; top += 700) {
      move(top);
      vi.advanceTimersByTime(40);
    }
    expect(heard).toEqual([]);
    vi.advanceTimersByTime(LAYOUT_SETTLE_MS);
    move(14000 - far());
    expect(heard).toEqual(['up']);
  });

  it('ignores a small move from the landing', () => {
    const { move } = track();
    publishSectionNavigation('skills', { source: 'navbar', immediate: true });
    move(7147);
    vi.advanceTimersByTime(LAYOUT_SETTLE_MS);
    move(7147 + far() - 20);
    expect(heard).toEqual([]);
  });

  it('measures from the latest navigation', () => {
    const { move } = track();
    publishSectionNavigation('about', { source: 'navbar', immediate: true });
    move(1858);
    vi.advanceTimersByTime(LAYOUT_SETTLE_MS);
    publishSectionNavigation('projects', { source: 'navbar', immediate: true });
    move(11745);
    vi.advanceTimersByTime(LAYOUT_SETTLE_MS);
    move(11745 + 10);
    expect(heard).toEqual([]);
    move(11745 - far());
    expect(heard).toEqual(['up']);
  });

  it('lands where it is when a navigation does not move the page', () => {
    const { move } = track();
    move(1858);
    publishSectionNavigation('about', { source: 'navbar', immediate: true });
    vi.advanceTimersByTime(LAYOUT_SETTLE_MS);
    move(1858 + far());
    expect(heard).toEqual(['down']);
  });

  it('counts only the story\'s own scroller, never a reader box inside a chapter', () => {
    const { move } = track();
    const reader = track(200);
    publishSectionNavigation('projects', { source: 'navbar', immediate: true });
    move(11745);
    vi.advanceTimersByTime(LAYOUT_SETTLE_MS);
    reader.move(5000);
    expect(heard).toEqual([]);
  });

  it('counts the flat page\'s document scroll', () => {
    const page = document.scrollingElement ?? document.documentElement;
    publishSectionNavigation('about', { source: 'navbar', immediate: true });
    page.scrollTop = 900;
    document.dispatchEvent(new Event('scroll'));
    vi.advanceTimersByTime(LAYOUT_SETTLE_MS);
    page.scrollTop = 900 + far();
    document.dispatchEvent(new Event('scroll'));
    expect(heard).toEqual(['down']);
    page.scrollTop = 0;
  });
});
