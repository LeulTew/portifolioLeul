import { describe, it, expect } from 'vitest';
import { spreadLayers } from './spreadLayers';
import { windowPresence } from './sequenceWindow';

const NAMES = ['a', 'b', 'c'];

describe('spreadLayers', () => {
  it('gives every item a window', () => {
    expect(spreadLayers(NAMES, 0.1, 0.9)).toHaveLength(3);
    expect(spreadLayers(NAMES, 0.1, 0.9).map((l) => l.name)).toEqual(NAMES);
  });

  it('covers the stretch it is given, end to end', () => {
    // A hand-listed set stops covering the stretch the moment an entry is
    // added; this must not.
    const layers = spreadLayers(NAMES, 0.1, 0.9);
    expect(layers[0].start).toBeCloseTo(0.1, 6);
    expect(layers[layers.length - 1].end).toBeCloseTo(0.9, 6);
  });

  it('keeps the order it was given', () => {
    const layers = spreadLayers(NAMES, 0, 1);
    expect(layers[0].start).toBeLessThan(layers[1].start);
    expect(layers[1].start).toBeLessThan(layers[2].start);
  });

  it('overlaps, so the stretch is never empty at a handover', () => {
    const layers = spreadLayers(NAMES, 0, 1);
    const join = layers[1].start + (layers[0].end - layers[1].start) / 2;
    const showing = layers.filter(
      (l) => windowPresence(join, l.start, l.end, l.feather!) > 0
    );
    expect(showing.length).toBeGreaterThan(0);
  });

  it('holds each item fully up for part of its own window', () => {
    const layers = spreadLayers(NAMES, 0, 1);
    for (const layer of layers) {
      const middle = (layer.start + layer.end) / 2;
      expect(windowPresence(middle, layer.start, layer.end, layer.feather!)).toBe(1);
    }
  });

  it('scales to any number of items', () => {
    for (const count of [1, 2, 5, 9]) {
      const names = Array.from({ length: count }, (_, i) => `i${i}`);
      const layers = spreadLayers(names, 0.05, 0.95);
      expect(layers).toHaveLength(count);
      expect(layers[count - 1].end).toBeCloseTo(0.95, 6);
    }
  });

  it('returns nothing rather than a broken window on bad input', () => {
    expect(spreadLayers([], 0, 1)).toEqual([]);
    expect(spreadLayers(NAMES, 0.9, 0.1)).toEqual([]);
    expect(spreadLayers(NAMES, Number.NaN, 1)).toEqual([]);
  });
});
