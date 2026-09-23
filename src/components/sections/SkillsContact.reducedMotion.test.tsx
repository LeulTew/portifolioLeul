// @vitest-environment happy-dom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Skills } from './Skills/Skills';
import { Contact } from './Contact/Contact';
import { KineticHeading } from '../ui/KineticText';

const observers: Array<{
  callback: IntersectionObserverCallback;
  instance: IntersectionObserver;
  targets: Set<Element>;
}> = [];
let reducedMotion = false;

beforeEach(() => {
  reducedMotion = false;
  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
    ...mediaQuery,
    media: query,
    matches: reducedMotion && query === '(prefers-reduced-motion: reduce)',
  })));
  observers.length = 0;
  vi.stubGlobal('IntersectionObserver', class implements IntersectionObserver {
    root = null;
    rootMargin = '';
    thresholds = [0];
    targets = new Set<Element>();
    constructor(callback: IntersectionObserverCallback) {
      observers.push({ callback, instance: this, targets: this.targets });
    }
    observe(target: Element) { this.targets.add(target); }
    unobserve(target: Element) { this.targets.delete(target); }
    disconnect() { this.targets.clear(); }
    takeRecords() { return []; }
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const cases = [
  { name: 'Contact', content: <Contact />, entrance: 'translateX(28px)' },
  {
    name: 'their kinetic heading',
    content: <KineticHeading text="Let's Connect" as="h2" highlightWords={['Connect']} />,
    entrance: 'translateY(25px) rotateX(-30deg)',
  },
];

function expectReadable(container: HTMLElement) {
  const textAndFields = [...container.querySelectorAll<HTMLElement>('*')]
    .filter(element => (
      element.children.length === 0 && element.textContent?.trim()
    ) || element.matches('input, textarea'));
  expect(textAndFields.length).toBeGreaterThan(0);
  for (const element of textAndFields) expect(element).toBeVisible();
}

describe.each(cases)('$name reduced-motion reveal', ({ content, entrance }) => {
  it('keeps the authored hidden, transformed entrance without a reduced-motion preference', () => {
    const { container } = render(content);
    expect([...container.querySelectorAll<HTMLElement>('[style]')]
      .some(element => element.style.transform === entrance && element.style.opacity === '0'))
      .toBe(true);
  });

  describe('Skills reduced-motion presentation', () => {
    it('exposes every chapter without pinning, hidden words, or animated transforms', async () => {
      reducedMotion = true;
      const { container } = render(<Skills />);
      expect(container.querySelector('[data-staged="false"]')).not.toBeNull();
      expect(container.querySelector('[data-skill-word]')).toBeNull();
      expect(container.querySelectorAll('article')).toHaveLength(6);
      expectReadable(container);
      await act(async () => {
        window.dispatchEvent(new WheelEvent('wheel', { deltaY: 1000 }));
      });
      expect(container.querySelector('[data-skills-active="true"]')).toBeNull();
      expect([...container.querySelectorAll<HTMLElement>('[style]')]
        .some(element => element.style.transform && element.style.transform !== 'none')).toBe(false);
      expectReadable(container);
    });
  });

  it('mounts readable final content and never starts a transform reveal on intersection', async () => {
    reducedMotion = true;
    const { container } = render(content);
    expectReadable(container);

    const displaced: string[] = [];
    const recordTransforms = () => {
      for (const element of container.querySelectorAll<HTMLElement>('[style]')) {
        if (element.style.transform && element.style.transform !== 'none') {
          displaced.push(element.style.transform);
        }
      }
    };
    const mutations = new MutationObserver(recordTransforms);
    mutations.observe(container, { subtree: true, attributes: true, attributeFilter: ['style'] });
    recordTransforms();
    try {
      await act(async () => {
        for (const { callback, instance, targets } of observers) {
          callback([...targets].map(target => ({
            target,
            isIntersecting: true,
            intersectionRatio: 1,
            boundingClientRect: target.getBoundingClientRect(),
            intersectionRect: target.getBoundingClientRect(),
            rootBounds: null,
            time: performance.now(),
          })), instance);
        }
        // Includes the longest original reveal delay and duration.
        await new Promise(resolve => setTimeout(resolve, 1600));
      });
      expect(displaced).toEqual([]);
      expectReadable(container);
    } finally {
      mutations.disconnect();
    }
  });
});
