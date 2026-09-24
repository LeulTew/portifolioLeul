import { useEffect } from 'react';
import { cachedElement, writeAttribute, writeStyleProperty } from '@/lib/dom/cachedElement';
import { subscribeScrollProgress } from './scrollProgress';
import { translatedLayerOf, translatedY } from './translatedPosition';

const findAbout = cachedElement(() => document.getElementById('about'));
const findOverlay = cachedElement(() =>
  document.querySelector<HTMLElement>('[data-testid="about-sequence-overlay"]'));
const findEducation = cachedElement(() =>
  document.querySelector<HTMLElement>('[data-testid="education-stage"]'));
const findGround = cachedElement(() =>
  document.querySelector<HTMLElement>('#about [data-green-bg="true"]'));
const findSkills = cachedElement(() =>
  document.querySelector<HTMLElement>('[data-testid="skills-stage"]'));
const findProjects = cachedElement(() => document.getElementById('projects'));

const properties = [
  '--chapter-ink-mask', '--chapter-ink-clip', '--chapter-ink-opacity', '--chapter-ink-visibility',
] as const;

/*
 * The ink updates from scroll, mutation and resize paths, several times a
 * frame, after others have written styles, so a fresh rect per update forced
 * a layout each time. A cached rect is trusted only in a coordinate system it
 * can prove: the scrolling layer's translation (applied as a shift), the same
 * document scroll offset, the same parent and attributes, and no CSS
 * transition or animation that could move the surface between updates.
 * Layout changes bump `layoutEpoch`.
 */
interface CoverMeasurement {
  key: string; epoch: number; parent: Element | null; layer: HTMLElement | null;
  layerY: number; scrollX: number; scrollY: number; rect: DOMRect;
}
const measurements = new WeakMap<HTMLElement, CoverMeasurement>();
let layoutEpoch = 0;
const GEOMETRY = /^(all|transform|translate|scale|rotate|inset|top|right|bottom|left|width|height|margin.*|padding.*)$/;

function attributeKey(element: HTMLElement): string {
  let key = '';
  for (const attribute of element.attributes) key += `${attribute.name}=${attribute.value};`;
  return key;
}

/** Read right after a measurement, while style is fresh. */
function movesByItself(element: HTMLElement): boolean {
  const style = getComputedStyle(element);
  if (style.animationName.split(',').some(name => !['', 'none'].includes(name.trim()))) return true;
  const properties = style.transitionProperty.split(',').map(property => property.trim());
  const durations = style.transitionDuration.split(',').map(duration => Number.parseFloat(duration) || 0);
  return properties.some((property, index) =>
    GEOMETRY.test(property) && (durations[index % durations.length] ?? 0) > 0);
}

function coverRect(element: HTMLElement): DOMRect {
  const layer = translatedLayerOf(element);
  const layerY = layer ? translatedY(layer.style.transform) : 0;
  const key = attributeKey(element);
  const last = measurements.get(element);
  if (last && layerY !== null && last.key === key && last.epoch === layoutEpoch && last.layer === layer &&
      last.parent === element.parentElement && last.scrollX === window.scrollX && last.scrollY === window.scrollY) {
    const shift = layerY - last.layerY;
    return shift === 0 ? last.rect : new DOMRect(last.rect.x, last.rect.y + shift, last.rect.width, last.rect.height);
  }
  const rect = element.getBoundingClientRect();
  if (layerY !== null && !movesByItself(element)) {
    measurements.set(element, {
      key, epoch: layoutEpoch, parent: element.parentElement, layer, layerY,
      scrollX: window.scrollX, scrollY: window.scrollY, rect,
    });
  } else measurements.delete(element);
  return rect;
}

/** Layout may have moved a covering surface; the next update measures it again. */
export function invalidateChapterInkLayout(): void {
  layoutEpoch += 1;
}

/*
 * The painted chrome copies, which alone read the ink properties. They used to
 * be written on <html>, which every element inherits from: each change -- every
 * frame of a moving cover or a fading background -- restyled the whole document
 * (3,877 elements a frame in the Education to Skills handoff, measured natively).
 */
type InkValues = Record<(typeof properties)[number], string>;
const inkLayers = new Set<HTMLElement>();
let painted: InkValues | null = null;

function paint(layer: HTMLElement, values: InkValues): void {
  for (const property of properties) writeStyleProperty(layer, property, values[property]);
}

/** Registers a painted chrome copy, which receives the current ink at once. */
export function registerChapterInkLayer(layer: HTMLElement): () => void {
  inkLayers.add(layer);
  if (painted) paint(layer, painted);
  return () => {
    inkLayers.delete(layer);
    for (const property of properties) layer.style.removeProperty(property);
  };
}

/** A second paint of the chrome uses the same live mask as About's white title. */
export function updateChapterInk(): void {
  const root = document.documentElement;
  const education = findEducation();
  const overlay = findOverlay();
  const about = findAbout();
  const skills = findSkills();
  const skillsCoverage = skills?.dataset.visible === 'true'
    ? Math.min(1, Math.max(0, Number(skills.style.opacity))) : 0;
  let mode = 'none';
  let opacity = 1;
  let clip = 'inset(0px)';

  const cover = (element: HTMLElement) => {
    if (element.closest('[data-projects-covered]')) return;
    const rect = coverRect(element);
    if (rect.bottom <= 0 || rect.top >= window.innerHeight ||
        rect.right <= 0 || rect.left >= window.innerWidth) return;
    mode = 'solid';
    clip = `inset(${Math.max(0, rect.top)}px ${Math.max(0, window.innerWidth - rect.right)}px ` +
      `${Math.max(0, window.innerHeight - rect.bottom)}px ${Math.max(0, rect.left)}px)`;
  };

  if (skillsCoverage === 1) {
    mode = 'none';
  } else if (education?.dataset.visible === 'true') {
    cover(education);
  } else if (overlay?.dataset.active === 'true' && !overlay.closest('[data-projects-covered]')) {
    if (about?.dataset.bgActive === 'true' || about?.dataset.bgSettled === 'true') {
      mode = 'pixels';
      opacity = Math.min(1, Math.max(0, Number(overlay.style.getPropertyValue('--ground-in'))));
    }
  } else {
    const ground = findGround();
    if (ground) cover(ground);
  }
  // The held Skills plate covers the physical green underlay. Its actual
  // alpha, not scroll distance, determines how much white chrome still shows.
  opacity *= 1 - skillsCoverage;

  writeAttribute(root, 'data-chapter-ink', mode);
  painted = {
    '--chapter-ink-mask': mode === 'pixels' ? 'url("#bg-pixel-transition-mask")' : 'none',
    '--chapter-ink-clip': clip,
    '--chapter-ink-opacity': String(opacity),
    '--chapter-ink-visibility': mode === 'none' ? 'hidden' : 'visible',
  };
  for (const layer of inkLayers) paint(layer, painted);
}

export function useChapterInk(): void {
  useEffect(() => {
    const observed = new Set<HTMLElement>();
    // Per-frame style writes on the About overlay and Skills plate never move a covering surface.
    const observer = new MutationObserver(records => {
      if (records.some(record => record.attributeName !== 'style' ||
          (record.target !== findOverlay() && record.target !== findSkills()))) invalidateChapterInkLayout();
      update();
    });
    const discovery = new MutationObserver(() => {
      invalidateChapterInkLayout();
      update();
    });
    const layout = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => {
      invalidateChapterInkLayout();
      update();
    });
    let observedMain: Element | null = null;
    function update() {
      const main = findAbout()?.closest('main') ?? null;
      if (layout && main && main !== observedMain) {
        if (observedMain) layout.unobserve(observedMain);
        layout.observe(main);
        observedMain = main;
      }
      const elements = [findAbout(), findOverlay(), findEducation(), findSkills(), findProjects()];
      for (const element of elements) {
        if (element && !observed.has(element)) {
          observed.add(element);
          observer.observe(element, {
            attributes: true,
            attributeFilter: [
              'style', 'data-active', 'data-visible', 'data-bg-active', 'data-bg-settled',
              'data-projects-active', 'data-projects-covered',
            ],
          });
        }
      }
      if (elements.every(Boolean)) discovery.disconnect();
      updateChapterInk();
    }
    const resize = () => {
      invalidateChapterInkLayout();
      update();
    };
    discovery.observe(document.body, { childList: true, subtree: true });
    update();
    const unsubscribe = subscribeScrollProgress(update);
    document.addEventListener('scroll', update, { passive: true, capture: true });
    window.addEventListener('resize', resize);
    return () => {
      unsubscribe();
      observer.disconnect();
      discovery.disconnect();
      layout?.disconnect();
      document.removeEventListener('scroll', update, { capture: true });
      window.removeEventListener('resize', resize);
      for (const layer of inkLayers) for (const property of properties) layer.style.removeProperty(property);
      painted = null;
      document.documentElement.removeAttribute('data-chapter-ink');
    };
  }, []);
}
