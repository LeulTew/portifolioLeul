import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { StrictMode } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { parse } from 'postcss';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HeroCloud } from './HeroCloud';

const cloudCss = readFileSync(join(__dirname, 'HeroCloud.module.css'), 'utf8');

type ObserverHarness = {
  callback: IntersectionObserverCallback;
  observe: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
};

let observers: ObserverHarness[];
let reducedMotion: boolean;
let visibility: DocumentVisibilityState;
let motionListeners: Set<EventListenerOrEventListenerObject>;
let mediaQuery: MediaQueryList;
let removeMediaListener: ReturnType<typeof vi.fn>;

function cloud(container: HTMLElement) {
  return container.querySelector<HTMLElement>('[data-hero-cloud]')!;
}

function intersect(root: HTMLElement, visible: boolean, observer = observers.at(-1)!) {
  act(() => {
    observer.callback(
      [{
        target: root,
        isIntersecting: visible,
        intersectionRatio: visible ? 1 : 0,
        boundingClientRect: root.getBoundingClientRect(),
        intersectionRect: root.getBoundingClientRect(),
        rootBounds: null,
        time: 0,
      }],
      {} as IntersectionObserver,
    );
  });
}

function setReducedMotion(value: boolean) {
  reducedMotion = value;
  act(() => {
    motionListeners.forEach((listener) => {
      const event = new Event('change');
      if (typeof listener === 'function') listener(event);
      else listener.handleEvent(event);
    });
  });
}

function setVisibility(value: DocumentVisibilityState) {
  visibility = value;
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

beforeEach(() => {
  observers = [];
  reducedMotion = false;
  visibility = 'visible';
  motionListeners = new Set();
  removeMediaListener = vi.fn((_event: string, listener: EventListenerOrEventListenerObject) => {
    motionListeners.delete(listener);
  });
  mediaQuery = {
    get matches() { return reducedMotion; },
    media: '(prefers-reduced-motion: reduce)',
    addEventListener: vi.fn((_event: string, listener: EventListenerOrEventListenerObject) => {
      motionListeners.add(listener);
    }),
    removeEventListener: removeMediaListener,
  } as unknown as MediaQueryList;
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
  vi.stubGlobal('matchMedia', vi.fn(() => mediaQuery));
  vi.stubGlobal('IntersectionObserver', class {
    observe = vi.fn();
    disconnect = vi.fn();
    constructor(callback: IntersectionObserverCallback) {
      observers.push({ callback, observe: this.observe, disconnect: this.disconnect });
    }
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('HeroCloud', () => {
  it('is decorative and leaves root positioning, visibility, and phases to Home', () => {
    const { container } = render(<HeroCloud className="home-plate entered" />);
    const root = cloud(container);
    expect(root).toHaveAttribute('aria-hidden', 'true');
    expect(root).toHaveClass('home-plate', 'entered');
    expect(root.style.opacity).toBe('');
    expect(root.style.transform).toBe('');
    expect(root.style.getPropertyValue('--plate-shut')).toBe('');
    expect(root.textContent).toBe('');
    expect(root.querySelector('canvas, animate, animateTransform, button, a')).toBeNull();
    root.querySelectorAll('svg').forEach((svg) => {
      expect(svg).toHaveAttribute('focusable', 'false');
    });
  });

  describe('motion material', () => {
    it('animates only child transforms, never noise, blur, or the parent phase properties', () => {
      const sheet = parse(cloudCss);
      const animatedProperties: string[] = [];
      let keyframes = 0;
      sheet.walkAtRules('keyframes', (rule) => {
        keyframes += 1;
        rule.walkDecls((declaration) => { animatedProperties.push(declaration.prop); });
      });
      expect(keyframes).toBe(2);
      expect(new Set(animatedProperties)).toEqual(new Set(['transform']));
      sheet.walkRules('.cloud', (rule) => {
        const properties = rule.nodes.filter((node) => node.type === 'decl')
          .map((node) => node.prop);
        expect(properties).not.toEqual(expect.arrayContaining(['transform']));
        expect(properties).not.toEqual(expect.arrayContaining(['opacity']));
        expect(properties).toContain('pointer-events');
      });
    });

    it('has a CSS reduced-motion fallback that removes spatial animation and promotion', () => {
      const sheet = parse(cloudCss);
      const reducedRules: string[] = [];
      sheet.walkAtRules('media', (rule) => {
        if (rule.params !== '(prefers-reduced-motion: reduce)') return;
        rule.walkRules((child) => {
          reducedRules.push(child.selector);
          const declarations = new Map<string, string>();
          child.walkDecls((declaration) => {
            declarations.set(declaration.prop, declaration.value);
          });
          expect(declarations.get('animation')).toBe('none');
          expect(declarations.get('transform')).toBe('none');
          expect(declarations.get('will-change')).toBe('auto');
        });
      });
      expect(reducedRules).toHaveLength(1);
      expect(reducedRules[0]).toContain('.cloud[data-motion] .vapor');
      expect(reducedRules[0]).toContain('.cloud[data-motion] .shear');
    });
  });

  it('supports explicit themes and otherwise inherits the page theme', () => {
    const { container, rerender } = render(<HeroCloud theme="light" />);
    expect(cloud(container)).toHaveAttribute('data-cloud-theme', 'light');
    rerender(<HeroCloud theme="dark" />);
    expect(cloud(container)).toHaveAttribute('data-cloud-theme', 'dark');
    rerender(<HeroCloud />);
    expect(cloud(container)).not.toHaveAttribute('data-cloud-theme');
  });

  it('namespaces all material references across simultaneous instances', () => {
    const { container } = render(<><HeroCloud /><HeroCloud /></>);
    const ids = [...container.querySelectorAll('[id]')].map((element) => element.id);
    expect(new Set(ids).size).toBe(ids.length);
    container.querySelectorAll('[data-hero-cloud]').forEach((root) => {
      const localIds = new Set([...root.querySelectorAll('[id]')].map((element) => element.id));
      root.querySelectorAll('[fill], [filter]').forEach((element) => {
        ['fill', 'filter'].forEach((attribute) => {
          const reference = element.getAttribute(attribute)?.match(/^url\(#(.+)\)$/)?.[1];
          if (reference) expect(localIds.has(reference)).toBe(true);
        });
      });
    });
  });

  it('starts still, drifts only while intersecting, and pauses offscreen', () => {
    const { container } = render(<HeroCloud />);
    const root = cloud(container);
    expect(root).toHaveAttribute('data-motion', 'paused');
    expect(observers[0].observe).toHaveBeenCalledWith(root);
    intersect(root, true);
    expect(root).toHaveAttribute('data-motion', 'running');
    intersect(root, false);
    expect(root).toHaveAttribute('data-motion', 'paused');
    intersect(root, true);
    expect(root).toHaveAttribute('data-motion', 'running');
  });

  it('active=false stops drift without removing the cloud or overriding its exit', () => {
    const { container, rerender } = render(<HeroCloud />);
    const root = cloud(container);
    intersect(root, true);
    rerender(<HeroCloud active={false} />);
    expect(root).toHaveAttribute('data-motion', 'paused');
    expect(root.querySelectorAll('svg')).toHaveLength(3);
    expect(observers[0].disconnect).toHaveBeenCalledOnce();
    expect(motionListeners.size).toBe(0);
    // A queued observer notification cannot revive an inactive layer.
    intersect(root, true, observers[0]);
    expect(root).toHaveAttribute('data-motion', 'paused');
    rerender(<HeroCloud active />);
    expect(root).toHaveAttribute('data-motion', 'paused');
    intersect(root, true);
    expect(root).toHaveAttribute('data-motion', 'running');
  });

  it('does not subscribe when initially inactive', () => {
    const { container } = render(<HeroCloud active={false} />);
    expect(cloud(container)).toHaveAttribute('data-motion', 'paused');
    expect(observers).toHaveLength(0);
    expect(motionListeners.size).toBe(0);
  });

  it('respects hidden tabs without losing the offscreen gate on return', () => {
    const { container } = render(<HeroCloud />);
    const root = cloud(container);
    intersect(root, true);
    setVisibility('hidden');
    expect(root).toHaveAttribute('data-motion', 'paused');
    setVisibility('visible');
    expect(root).toHaveAttribute('data-motion', 'running');
    setVisibility('hidden');
    intersect(root, false);
    setVisibility('visible');
    expect(root).toHaveAttribute('data-motion', 'paused');
  });

  it('keeps a static cloud under reduced motion and responds to preference changes', () => {
    reducedMotion = true;
    const { container } = render(<HeroCloud />);
    const root = cloud(container);
    intersect(root, true);
    expect(root).toHaveAttribute('data-motion', 'paused');
    expect(root.querySelector('path')).toBeInTheDocument();
    setReducedMotion(false);
    expect(root).toHaveAttribute('data-motion', 'running');
    setReducedMotion(true);
    expect(root).toHaveAttribute('data-motion', 'paused');
  });

  it('remains static without IntersectionObserver rather than creating a fallback loop', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const { container } = render(<HeroCloud />);
    setVisibility('hidden');
    setVisibility('visible');
    expect(cloud(container)).toHaveAttribute('data-motion', 'paused');
  });

  it('cleans up both StrictMode effect lifetimes and ignores stale callbacks', () => {
    const removeDocumentListener = vi.spyOn(document, 'removeEventListener');
    const { container, unmount } = render(<StrictMode><HeroCloud /></StrictMode>);
    const root = cloud(container);
    expect(observers).toHaveLength(2);
    expect(observers[0].disconnect).toHaveBeenCalledOnce();
    intersect(root, true, observers[0]);
    expect(root).toHaveAttribute('data-motion', 'paused');
    intersect(root, true, observers[1]);
    expect(root).toHaveAttribute('data-motion', 'running');
    unmount();
    expect(observers[1].disconnect).toHaveBeenCalledOnce();
    expect(motionListeners.size).toBe(0);
    expect(removeMediaListener).toHaveBeenCalledTimes(2);
    expect(removeDocumentListener.mock.calls.filter(([type]) => type === 'visibilitychange'))
      .toHaveLength(2);
  });
});
