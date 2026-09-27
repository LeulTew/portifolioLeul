import { describe, expect, it } from 'vitest';
import { landsOnOwnEdge } from './landingEdge';

describe('landing on a chapter\'s own edge (round 35)', () => {
  const section = (attributes: Record<string, string>) => {
    const element = document.createElement('section');
    for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
    return element;
  };

  it('lands a linear chapter that asks for it on its own edge', () => {
    expect(landsOnOwnEdge(section({ 'data-landing-edge': 'own', 'data-staged': 'false' }))).toBe(true);
    expect(landsOnOwnEdge(section({ 'data-landing-edge': 'own' }))).toBe(true);
  });

  it('keeps the navbar clearance for a staged chapter, whose entry is measured from it', () => {
    expect(landsOnOwnEdge(section({ 'data-landing-edge': 'own', 'data-staged': 'true' }))).toBe(false);
  });

  it('keeps the navbar clearance for every chapter that does not ask', () => {
    expect(landsOnOwnEdge(section({ 'data-staged': 'false' }))).toBe(false);
  });
});
