import { act, cleanup, render, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { updateChapterInk, useChapterInk } from './chapterInk';
import { ChapterInkLayer, InkLabel } from '@/components/ui/ChapterInkLayer/ChapterInkLayer';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.body.replaceChildren();
  document.documentElement.removeAttribute('style');
  document.documentElement.removeAttribute('data-chapter-ink');
});

const root = document.documentElement;

function scene() {
  const { getByTestId } = render(<>
    <section id="about"><div data-green-bg="true" data-testid="ground" /></section>
    <div data-testid="about-sequence-overlay" />
    <div data-testid="education-stage" />
  </>);
  return {
    about: document.getElementById('about')!,
    overlay: getByTestId('about-sequence-overlay'),
    education: getByTestId('education-stage'),
    ground: getByTestId('ground'),
  };
}

describe('chrome painted through the actual chapter background', () => {
  it('does not recolor a whole strip from a scroll threshold or legacy switch', () => {
    scene();
    root.dataset.navContrast = 'true';
    root.dataset.footerContrast = 'true';
    updateChapterInk();
    expect(root.dataset.chapterInk).toBe('none');
    expect(root.style.getPropertyValue('--chapter-ink-visibility')).toBe('hidden');
    delete root.dataset.navContrast;
    delete root.dataset.footerContrast;
  });

  it('shares the exact live pixel mask and opacity without modifying About', () => {
    const { about, overlay } = scene();
    about.dataset.bgActive = 'true';
    overlay.dataset.active = 'true';
    overlay.style.setProperty('--ground-in', '0.75');
    const original = about.outerHTML;
    updateChapterInk();
    expect(root.dataset.chapterInk).toBe('pixels');
    expect(root.style.getPropertyValue('--chapter-ink-mask')).toBe('url("#bg-pixel-transition-mask")');
    expect(root.style.getPropertyValue('--chapter-ink-opacity')).toBe('0.75');
    expect(about.outerHTML).toBe(original);
  });

  it('keeps the same mask through the completed background and its reverse', () => {
    const { about, overlay } = scene();
    overlay.dataset.active = 'true';
    overlay.style.setProperty('--ground-in', '1');
    about.dataset.bgSettled = 'true';
    updateChapterInk();
    expect(root.dataset.chapterInk).toBe('pixels');
    delete about.dataset.bgSettled;
    about.dataset.bgActive = 'true';
    updateChapterInk();
    expect(root.dataset.chapterInk).toBe('pixels');
    delete about.dataset.bgActive;
    updateChapterInk();
    expect(root.dataset.chapterInk).toBe('none');
  });

  it('clips white ink to the moving Education edge rather than toggling all the footer', () => {
    const { education } = scene();
    education.dataset.visible = 'true';
    vi.spyOn(education, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, -30, window.innerWidth, window.innerHeight));
    updateChapterInk();
    expect(root.dataset.chapterInk).toBe('solid');
    expect(root.style.getPropertyValue('--chapter-ink-mask')).toBe('none');
    expect(root.style.getPropertyValue('--chapter-ink-clip')).toBe('inset(0px 0px 30px 0px)');
  });

  it('uses physical green coverage in the static/reduced-motion presentation', () => {
    const { ground } = scene();
    vi.spyOn(ground, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 70, window.innerWidth, window.innerHeight));
    updateChapterInk();
    expect(root.dataset.chapterInk).toBe('solid');
    expect(root.style.getPropertyValue('--chapter-ink-clip')).toBe('inset(70px 0px 0px 0px)');
  });

  it('leaves identical frames alone', () => {
    scene();
    updateChapterInk();
    const style = vi.spyOn(root.style, 'setProperty');
    const attributes = vi.spyOn(root, 'setAttribute');
    updateChapterInk();
    expect(style).not.toHaveBeenCalled();
    expect(attributes).not.toHaveBeenCalled();
  });

  it('observes late portals, stopped-scroll changes and releases all ownership on unmount', async () => {
    const { unmount } = renderHook(useChapterInk);
    const { about, overlay } = scene();
    await act(async () => {
      overlay.dataset.active = 'true';
      overlay.style.setProperty('--ground-in', '1');
      about.dataset.bgActive = 'true';
    });
    expect(root.dataset.chapterInk).toBe('pixels');
    await act(async () => { delete about.dataset.bgActive; });
    expect(root.dataset.chapterInk).toBe('none');
    unmount();
    expect(root).not.toHaveAttribute('data-chapter-ink');
    expect(root.style.getPropertyValue('--chapter-ink-mask')).toBe('');
  });

  it('paints generated labels once without duplicate readable text or controls', () => {
    const { queryAllByText } = render(<>
      <span>Scroll to explore</span>
      <ChapterInkLayer><InkLabel text="Scroll to explore" painted /></ChapterInkLayer>
    </>);
    expect(queryAllByText('Scroll to explore')).toHaveLength(1);
    expect(document.querySelector('[data-chapter-ink-layer]')).toHaveAttribute('aria-hidden', 'true');
  });
});
