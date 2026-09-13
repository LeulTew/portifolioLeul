import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Profiler, StrictMode } from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { parse } from 'postcss';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HeroCloud } from './HeroCloud';

const cloudCss = readFileSync(join(__dirname, 'HeroCloud.module.css'), 'utf8');
const textureDirectory = join(__dirname, '../../../../public/textures/hero-cloud');
const source = (layer: string) => document.importNode(new DOMParser().parseFromString(
  readFileSync(join(textureDirectory, `${layer}.svg`), 'utf8'), 'image/svg+xml',
).documentElement, true);

function declarationsFor(selector: string, reduced = false) {
  const declarations = new Map<string, string>();
  parse(cloudCss).walkRules((rule) => {
    if (!rule.selectors.includes(selector)) return;
    const inReducedMedia = rule.parent?.type === 'atrule'
      && rule.parent.name === 'media'
      && rule.parent.params === '(prefers-reduced-motion: reduce)';
    if (Boolean(inReducedMedia) !== reduced) return;
    rule.walkDecls((declaration) => {
      declarations.set(declaration.prop, declaration.value);
    });
  });
  return declarations;
}

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
    expect(root.style.getPropertyValue('--shut')).toBe('');
    expect(root.textContent).toBe('');
    expect(root.querySelector('canvas, animate, animateTransform, button, a')).toBeNull();
    root.querySelectorAll('img').forEach((image) => {
      expect(image).toHaveAttribute('alt', '');
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
      expect(declarationsFor('.dissolving').has('transform')).toBe(false);
      expect(declarationsFor('.dissolving').has('opacity')).toBe(false);
      sheet.walkDecls('transition', (declaration) => {
        expect(declaration.value).not.toMatch(/all|transform|opacity|mask/);
      });
    });

    it('keeps the baked pigment neutral and retains theme-specific ambient density', () => {
      const dark = declarationsFor('.cloud');
      const light = declarationsFor(".cloud[data-cloud-theme='light']");
      [dark, light].forEach((theme) => {
        expect(Number(theme.get('--cloud-density'))).toBe(1);
      });
      expect(declarationsFor('.body').get('opacity')).toBe('var(--cloud-density)');
      expect(declarationsFor('.vapor').get('opacity')).toBe('var(--cloud-vapor-density)');
      expect(declarationsFor('.cloud').get('mix-blend-mode')).toBe('normal');
      expect(declarationsFor(":global([data-theme='light']) .cloud:not([data-cloud-theme])"))
        .toEqual(light);
    });

    it('keeps white puff cores translucent and feathers their edges to transparency', () => {
      const root = source('body');
      const gradient = root.querySelector('radialGradient[id$="-puff"]')!;
      expect(gradient).not.toBeNull();
      const stops = [...gradient.querySelectorAll('stop')];
      expect(stops[0]).toHaveAttribute('stop-opacity', '.86');
      expect(stops[1]).toHaveAttribute('stop-opacity', '.8');
      expect(Number(stops[1].getAttribute('offset'))).toBeGreaterThanOrEqual(0.5);
      expect(stops.at(-1)).toHaveAttribute('stop-opacity', '0');
      stops.forEach((stop) => {
        expect(stop).toHaveAttribute('stop-color', '#ffffff');
      });
      const puffs = root.querySelector(`g[fill="url(#${gradient.id})"]`)!;
      expect(puffs.querySelectorAll('path')).toHaveLength(3);
      puffs.querySelectorAll('path').forEach((puff) => {
        expect(puff.getAttribute('d')!.match(/C /g)!.length).toBeGreaterThanOrEqual(6);
      });
      const coreAlpha = Number(stops[0].getAttribute('stop-opacity'));
      const greenTerrain = [12, 155, 83];
      const transmitted = greenTerrain.map((channel) => Math.round(255 * coreAlpha + channel * (1 - coreAlpha)));
      expect(transmitted.every(channel => channel > 200 && channel < 255)).toBe(true);
      expect(new Set(transmitted).size).toBeGreaterThan(1);
    });

    it('varies the body density instead of painting a flat opaque patch', () => {
      const root = source('body');
      const gradient = root.querySelector('radialGradient[id$="-density"]')!;
      expect(gradient).not.toBeNull();
      const stops = [...gradient.querySelectorAll('stop')];
      expect(stops.length).toBeGreaterThanOrEqual(3);
      expect(stops.map(stop => Number(stop.getAttribute('stop-opacity')))).toEqual([0.78, 0.64, 0]);
      stops.forEach((stop) => {
            const channels = stop.getAttribute('stop-color')!.slice(1).match(/../g)!
              .map(channel => parseInt(channel, 16));
            expect(new Set(channels).size).toBe(1);
            expect(channels[0]).toBeGreaterThanOrEqual(240);
      });
      const edge = root.querySelector('filter[id$="-edge"]')!;
      expect(edge.querySelector('feGaussianBlur'))
        .toHaveAttribute('stdDeviation', '12');
    });

    it('dissolves every material layer through the same soft, scalloped front and trailing wisps', () => {
      const { container } = render(<HeroCloud />);
      const root = cloud(container);
      const mask = root.querySelector<HTMLElement>('[data-cloud-mask]')!;
      const canonical = source('mask');
      const filteredFront = canonical.querySelector('g[filter]')!;
      const edgeId = filteredFront.getAttribute('filter')!.slice(5, -1);
      const edge = [...canonical.querySelectorAll('filter')].find(filter => filter.id === edgeId)!;
      const paths = filteredFront.querySelectorAll('path');

      expect(mask.style.getPropertyValue('--cloud-mask')).toBe('url("/textures/hero-cloud/mask.webp")');
      expect(canonical).toHaveAttribute('viewBox', '-660 -120 2100 880');
      expect(root.querySelector('filter, feTurbulence, feGaussianBlur')).toBeNull();
      expect(paths).toHaveLength(4);
      expect(paths[0].getAttribute('d')!.match(/C /g)!.length).toBeGreaterThanOrEqual(6);
      [...paths].slice(1).forEach((wisp) => {
        expect(wisp.getAttribute('d')).toContain('C ');
        expect(Number(wisp.getAttribute('opacity'))).toBeGreaterThan(0);
        expect(Number(wisp.getAttribute('opacity'))).toBeLessThan(1);
      });
      expect(edge.querySelector('feTurbulence')).toHaveAttribute('numOctaves', '2');
      expect(edge.querySelector('feTurbulence')).toHaveAttribute('seed', '23');
      expect(edge.querySelector('feDisplacementMap')).toHaveAttribute('scale', '38');
      expect(edge.querySelector('feGaussianBlur')).toHaveAttribute('stdDeviation', '14');
      expect(root.querySelectorAll('[data-cloud-mask]')).toHaveLength(1);
      expect(mask.querySelectorAll('img')).toHaveLength(3);
      expect(declarationsFor('.dissolving').get('mask-image')).toBe('var(--cloud-mask)');
    });

    it('inherits clamped --shut and traverses completely clear without moving the bank', () => {
      const mask = source('mask');
      const solid = mask.querySelector('rect')!;
      expect(declarationsFor('.cloud').get('--cloud-shut'))
        .toBe('clamp(0, var(--shut, 0), 1)');
      expect(declarationsFor('.dissolving').get('mask-size')).toBe('175% 137.5%');
      expect(declarationsFor('.dissolving').get('mask-position'))
        .toBe('calc(73.333333% - var(--cloud-shut) * 208.888889%) 50%');
      const left = (progress: number) => (1200 - 2100) * (73.333333 - progress * 208.888889) / 100;
      expect(left(0)).toBeCloseTo(-660, 3);
      expect(left(0.5)).toBeCloseTo(-660 + 1880 * 0.5, 3);
      expect(left(1)).toBeGreaterThan(1200);
      expect((640 - 880) * 0.5).toBe(-120);
      // The unfiltered overlap covers the complete mask at the starting pose.
      expect(Number(solid.getAttribute('x'))).toBeLessThanOrEqual(0);
      expect(Number(solid.getAttribute('y'))).toBeLessThanOrEqual(0);
      expect(Number(solid.getAttribute('width'))).toBeGreaterThanOrEqual(1200);
      expect(Number(solid.getAttribute('y')) + Number(solid.getAttribute('height')))
        .toBeGreaterThanOrEqual(640);
      expect(declarationsFor('.cloud').has('--shut')).toBe(false);
    });

    it('uses bounded raster assets without live SVG filters', () => {
      const { container } = render(<HeroCloud />);
      const root = cloud(container);
      expect(root).toHaveAttribute('data-cloud-texture', 'raster');
      expect(root.querySelectorAll('img')).toHaveLength(4);
      expect(root.querySelectorAll('filter')).toHaveLength(0);
      expect(root.querySelectorAll('svg')).toHaveLength(0);
      for (const layer of ['body', 'vapor', 'shear', 'mask']) {
        const bytes = readFileSync(join(textureDirectory, `${layer}.webp`));
        expect(bytes.subarray(0, 4).toString('ascii')).toBe('RIFF');
        expect(bytes.subarray(8, 12).toString('ascii')).toBe('WEBP');
        expect(bytes.length).toBeLessThan(180000);
      }
    });

    it('reports a failed texture and falls back to its editable vector source', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { container } = render(<HeroCloud />);
      const root = cloud(container);
      fireEvent.error(root.querySelector('img')!);
      expect(warn).toHaveBeenCalledOnce();
      expect(root).toHaveAttribute('data-cloud-texture', 'vector');
      root.querySelectorAll('img').forEach(image => expect(image.getAttribute('src')).toMatch(/\.svg$/));
      fireEvent.error(root.querySelector('img')!);
      expect(error).toHaveBeenCalledOnce();
    });

    it('accepts forward and reverse progress without React updates, new clocks, or changing noise', () => {
      const onRender = vi.fn();
      const requestFrame = vi.spyOn(window, 'requestAnimationFrame');
      const { container } = render(
        <div data-progress-host="">
          <Profiler id="cloud" onRender={onRender}><HeroCloud /></Profiler>
        </div>,
      );
      const root = cloud(container);
      const host = root.parentElement!;
      intersect(root, true);
      onRender.mockClear();
      requestFrame.mockClear();
      const material = root.innerHTML;
      [0.2, 0.6, 1, 0.6, 0.2, 0].forEach((progress) => {
        host.style.setProperty('--shut', String(progress));
        expect(root.innerHTML).toBe(material);
        expect(root).toHaveAttribute('data-motion', 'running');
      });
      expect(onRender).not.toHaveBeenCalled();
      expect(requestFrame).not.toHaveBeenCalled();
      expect(observers).toHaveLength(1);
    });

    it('uses a static unmasked cloud and only a fade under reduced motion', () => {
      ['vapor', 'shear'].forEach((layer) => {
        const declarations = declarationsFor(`.cloud[data-motion] .${layer}`, true);
        expect(declarations.get('animation')).toBe('none');
        expect(declarations.get('transform')).toBe('none');
        expect(declarations.get('will-change')).toBe('auto');
      });
      expect(declarationsFor('.dissolving', true).get('mask')).toBe('none');
      expect(declarationsFor('.dissolving', true).get('opacity'))
        .toBe('calc(1 - var(--cloud-shut))');
      expect(declarationsFor('.cloud', true).has('opacity')).toBe(false);
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

  it('keeps simultaneous instances independent without shared mutable SVG ids', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { container } = render(<><HeroCloud /><HeroCloud /></>);
    expect(container.querySelectorAll('[id]')).toHaveLength(0);
    const roots = container.querySelectorAll('[data-hero-cloud]');
    fireEvent.error(roots[0].querySelector('img')!);
    expect(roots[0]).toHaveAttribute('data-cloud-texture', 'vector');
    expect(roots[1]).toHaveAttribute('data-cloud-texture', 'raster');
    expect(warn).toHaveBeenCalledOnce();
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
    expect(root.querySelector('[data-cloud-mask]')!.querySelectorAll('img')).toHaveLength(3);
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
    expect(root.querySelector('img[src$="/body.webp"]')).toBeInTheDocument();
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
