import { act, cleanup, render, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { invalidateChapterInkLayout, registerChapterInkLayer, updateChapterInk, useChapterInk } from './chapterInk';
import { ChapterInkLayer, InkLabel } from '@/components/ui/ChapterInkLayer/ChapterInkLayer';

// The painted chrome copy that reads the ink; the root must stay clean.
let ink: HTMLDivElement;
let releaseInk: () => void;
beforeEach(() => {
  ink = document.createElement('div');
  releaseInk = registerChapterInkLayer(ink);
});

afterEach(() => {
  releaseInk();
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
    expect(ink.style.getPropertyValue('--chapter-ink-visibility')).toBe('hidden');
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
    expect(ink.style.getPropertyValue('--chapter-ink-mask')).toBe('url("#bg-pixel-transition-mask")');
    expect(ink.style.getPropertyValue('--chapter-ink-opacity')).toBe('0.75');
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
    expect(ink.style.getPropertyValue('--chapter-ink-mask')).toBe('none');
    expect(ink.style.getPropertyValue('--chapter-ink-clip')).toBe('inset(0px 0px 30px 0px)');
  });

  it('uses physical green coverage in the static/reduced-motion presentation', () => {
    const { ground } = scene();
    vi.spyOn(ground, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 70, window.innerWidth, window.innerHeight));
    updateChapterInk();
    expect(root.dataset.chapterInk).toBe('solid');
    expect(ink.style.getPropertyValue('--chapter-ink-clip')).toBe('inset(70px 0px 0px 0px)');
  });

  it.each(['ground', 'overlay', 'education'] as const)(
    'does not paint the green navbar from a Projects-covered %s',
    source => {
      const { about, overlay, education, ground } = scene();
      const target = { ground, overlay, education }[source];
      vi.spyOn(target, 'getBoundingClientRect').mockReturnValue(
        new DOMRect(0, 0, window.innerWidth, window.innerHeight));
      if (source === 'overlay') {
        overlay.dataset.active = 'true';
        overlay.style.setProperty('--ground-in', '1');
        about.dataset.bgSettled = 'true';
      } else if (source === 'education') education.dataset.visible = 'true';
      updateChapterInk();
      const painted = root.dataset.chapterInk;
      expect(painted).not.toBe('none');
      const covered = source === 'ground' ? about : target;
      covered.setAttribute('data-projects-covered', '');
      updateChapterInk();
      expect(root.dataset.chapterInk).toBe('none');
      expect(ink.style.getPropertyValue('--chapter-ink-visibility')).toBe('hidden');
      covered.removeAttribute('data-projects-covered');
      updateChapterInk();
      expect(root.dataset.chapterInk).toBe(painted);
    },
  );

  it('refreshes hidden ground coverage on Projects claim and release without another scroll', async () => {
    const { about, ground } = scene();
    const projects = document.createElement('section');
    projects.id = 'projects';
    document.body.appendChild(projects);
    vi.spyOn(ground, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 0, window.innerWidth, window.innerHeight));
    const { unmount } = renderHook(useChapterInk);
    expect(root.dataset.chapterInk).toBe('solid');
    await act(async () => {
      about.setAttribute('data-projects-covered', '');
      projects.dataset.projectsActive = 'true';
    });
    expect(root.dataset.chapterInk).toBe('none');
    await act(async () => {
      about.removeAttribute('data-projects-covered');
      delete projects.dataset.projectsActive;
    });
    expect(root.dataset.chapterInk).toBe('solid');
    unmount();
  });

  it('keeps the ink off the document root and paints a late layer at once', () => {
    const { education } = scene();
    education.dataset.visible = 'true';
    vi.spyOn(education, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, -30, window.innerWidth, window.innerHeight));
    updateChapterInk();
    const rootProperties = Array.from({ length: root.style.length }, (_, index) => root.style.item(index));
    expect(rootProperties.filter(property => property.startsWith('--chapter-ink'))).toEqual([]);
    const late = document.createElement('div');
    const release = registerChapterInkLayer(late);
    expect(late.style.getPropertyValue('--chapter-ink-clip')).toBe('inset(0px 0px 30px 0px)');
    release();
    expect(late.style.getPropertyValue('--chapter-ink-clip')).toBe('');
  });

  it('leaves identical frames alone', () => {
    scene();
    updateChapterInk();
    const style = vi.spyOn(ink.style, 'setProperty');
    const attributes = vi.spyOn(root, 'setAttribute');
    updateChapterInk();
    expect(style).not.toHaveBeenCalled();
    expect(attributes).not.toHaveBeenCalled();
  });

  it('follows the scrolling layer without re-reading layout, and re-measures when layout can have moved', () => {
    // Measured natively: these reads forced a layout 34 times in one journey, after other writers.
    const layer = document.createElement('div');
    layer.style.transform = 'translate3d(0px, 0px, 0px)';
    document.body.append(layer);
    const { container } = render(<section id="about"><div data-green-bg="true" data-testid="ground" /></section>,
      { container: layer });
    const ground = container.querySelector<HTMLElement>('[data-testid="ground"]')!;
    const measure = vi.spyOn(ground, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 300, window.innerWidth, window.innerHeight));
    updateChapterInk();
    expect(ink.style.getPropertyValue('--chapter-ink-clip')).toBe('inset(300px 0px 0px 0px)');
    for (let step = 1; step <= 20; step++) {
      layer.style.transform = `translate3d(0px, ${-step * 10}px, 0px)`;
      updateChapterInk();
    }
    expect(ink.style.getPropertyValue('--chapter-ink-clip')).toBe('inset(100px 0px 0px 0px)');
    expect(measure).toHaveBeenCalledTimes(1);
    measure.mockReturnValue(new DOMRect(0, 40, window.innerWidth, window.innerHeight));
    invalidateChapterInkLayout();
    updateChapterInk();
    expect(ink.style.getPropertyValue('--chapter-ink-clip')).toBe('inset(40px 0px 0px 0px)');
    ground.style.setProperty('--release', '12px');
    updateChapterInk();
    expect(measure).toHaveBeenCalledTimes(3);
  });

  it('composites white chrome with the actual Skills plate rather than the green hidden behind it', () => {
    const { education } = scene();
    education.dataset.visible = 'true';
    vi.spyOn(education, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 0, window.innerWidth, window.innerHeight));
    const skills = document.createElement('div');
    skills.dataset.testid = 'skills-stage';
    skills.dataset.visible = 'true';
    skills.style.opacity = '0.6';
    document.body.appendChild(skills);
    updateChapterInk();
    expect(ink.style.getPropertyValue('--chapter-ink-opacity')).toBe('0.4');
    skills.style.opacity = '1';
    updateChapterInk();
    expect(root.dataset.chapterInk).toBe('none');
    expect(ink.style.getPropertyValue('--chapter-ink-visibility')).toBe('hidden');
    delete skills.dataset.visible;
    updateChapterInk();
    expect(root.dataset.chapterInk).toBe('solid');
    expect(ink.style.getPropertyValue('--chapter-ink-opacity')).toBe('1');
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
    expect(ink.style.getPropertyValue('--chapter-ink-mask')).toBe('');
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
