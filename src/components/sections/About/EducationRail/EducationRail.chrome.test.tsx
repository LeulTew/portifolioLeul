import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Navigation } from '@/components/Navigation';
import { ThemeContext } from '../../theme/ThemeContext';
import { useChapterInk } from '@/lib/scroll/chapterInk';

class FocusObserver implements IntersectionObserver {
  static instances: FocusObserver[] = [];
  readonly root = null;
  readonly rootMargin: string;
  readonly thresholds = [0];
  constructor(readonly callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.rootMargin = options?.rootMargin ?? '';
    FocusObserver.instances.push(this);
  }
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = () => [];
}

function Footer() {
  useChapterInk();
  return null;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  FocusObserver.instances = [];
  document.documentElement.removeAttribute('data-nav-contrast');
  document.documentElement.removeAttribute('data-footer-contrast');
});

describe('chrome over the held Education reader', () => {
  it('follows the visible reader rather than the physical Contact section underneath', async () => {
    vi.stubGlobal('IntersectionObserver', FocusObserver);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return this.dataset.testid === 'education-stage' || this.id === 'contact'
        ? new DOMRect(0, 0, 1440, window.innerHeight)
        : new DOMRect(0, -10000, 1440, 1000);
    });
    render(
      <ThemeContext.Provider value={{ theme: 'light', toggleTheme: vi.fn() }}>
        <section id="about" />
        <section id="skills" />
        <section id="contact" />
        <div data-testid="education-stage" />
        <Navigation scrollToSection={vi.fn()} />
        <Footer />
      </ThemeContext.Provider>
    );
    const contact = document.getElementById('contact')!;
    act(() => {
      for (const observer of FocusObserver.instances.filter(item => item.rootMargin)) {
        observer.callback([{
          target: contact, isIntersecting: true, intersectionRatio: 1,
          intersectionRect: new DOMRect(0, 0, 1440, 90),
          boundingClientRect: new DOMRect(0, 0, 1440, 900),
          rootBounds: null, time: 0,
        }], observer);
      }
    });
    expect(screen.getByRole('button', { name: 'Contact' })).toHaveAttribute('aria-current', 'page');
    await act(async () => {
      screen.getByTestId('education-stage').dataset.visible = 'true';
      document.getElementById('about')!.dataset.educationActive = 'true';
    });
    expect(screen.getByRole('button', { name: 'About' })).toHaveAttribute('aria-current', 'page');
    expect(document.documentElement).toHaveAttribute('data-chapter-ink', 'solid');
    // The ink is painted on the chrome's own layer, never the root every element inherits from.
    const ink = document.querySelector<HTMLElement>('[data-chapter-ink-layer]')!;
    expect(ink.style.getPropertyValue('--chapter-ink-clip')).toBe('inset(0px 0px 0px 0px)');
    expect(document.documentElement.style.getPropertyValue('--chapter-ink-clip')).toBe('');
    expect(screen.getByRole('banner')).not.toHaveAttribute('data-contrary');
    await act(async () => {
      screen.getByTestId('education-stage').removeAttribute('data-visible');
      document.getElementById('about')!.removeAttribute('data-education-active');
    });
    expect(screen.getByRole('button', { name: 'Contact' })).toHaveAttribute('aria-current', 'page');
    expect(document.documentElement).toHaveAttribute('data-chapter-ink', 'none');
  });
});
