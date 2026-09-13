import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTranslatedPositionReader, translatedY } from './translatedPosition';

afterEach(() => vi.restoreAllMocks());

describe('translated scroll position', () => {
  it.each([
    ['translate3d(0px, -125.125px, 0px)', -125.125],
    ['translate3d(0px, -1e-7px, 0)', -0.0000001],
    ['matrix(1, 0, 0, 1, 0, -40)', -40],
    ['scale(0.5)', null],
    ['matrix(2, 0, 0, 2, 0, -40)', null],
    ['translate3d(0px, -25%, 0)', null],
  ])('reads only a known translation from %s', (transform, value) => {
    expect(translatedY(transform)).toBe(value);
  });

  it('tracks fractional movement exactly without repeated layout reads', () => {
    const element = document.createElement('section');
    const layer = document.createElement('div');
    layer.style.transform = 'translate3d(0px, -100px, 0px)';
    const measure = vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 20, 100, 100));
    const reader = createTranslatedPositionReader(element, () => layer);
    expect(reader.read()).toBe(20);
    layer.style.transform = 'translate3d(0px, -175.25px, 0px)';
    expect(reader.read()).toBe(-55.25);
    for (let i = 0; i < 100; i++) expect(reader.read()).toBe(-55.25);
    expect(measure).toHaveBeenCalledTimes(1);
  });

  it('remeasures when layout or the scrolling layer changes', () => {
    const element = document.createElement('section');
    let layer = document.createElement('div');
    layer.style.transform = 'translate3d(0px, -100px, 0px)';
    const measure = vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 20, 100, 100));
    const reader = createTranslatedPositionReader(element, () => layer);
    expect(reader.read()).toBe(20);
    measure.mockReturnValue(new DOMRect(0, 40, 100, 100));
    reader.refresh();
    layer.style.transform = 'translate3d(0px, -150px, 0px)';
    expect(reader.read()).toBe(-10);
    layer = document.createElement('div');
    layer.style.transform = 'translate3d(0px, -20px, 0px)';
    measure.mockReturnValue(new DOMRect(0, 120, 100, 100));
    expect(reader.read()).toBe(120);
    expect(measure).toHaveBeenCalledTimes(3);
  });

  it('uses actual geometry for the no-WebGL layout or an unsupported transform', () => {
    const element = document.createElement('section');
    const layer = document.createElement('div');
    layer.style.transform = 'scale(0.5)';
    const measure = vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 10, 100, 100));
    const reader = createTranslatedPositionReader(element, () => layer);
    expect(reader.read()).toBe(10);
    measure.mockReturnValue(new DOMRect(0, -30, 100, 100));
    expect(reader.read()).toBe(-30);
    expect(createTranslatedPositionReader(element, () => null).read()).toBe(-30);
  });
});
