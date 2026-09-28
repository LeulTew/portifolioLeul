import { landingInset, NAVBAR_CLEARANCE_PX, type LandingRequest } from './navigationLanding';

const box = (top: number) => ({ top, bottom: top + 10, left: 0, right: 0, width: 0, height: 10, x: 0, y: top, toJSON: () => ({}) }) as DOMRect;

function section(attributes: Record<string, string> = {}, height = 3000, top = 500) {
  const element = document.createElement('section');
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  Object.defineProperty(element, 'offsetHeight', { configurable: true, value: height });
  element.getBoundingClientRect = () => box(top);
  return element;
}

const aboutInset = vi.fn((height: number, source?: string) => (source === 'navbar' ? height * 2 : height * 0.08));
const ask = (request: Partial<LandingRequest> & Pick<LandingRequest, 'id' | 'target'>) =>
  landingInset({ landing: null, viewportHeight: 900, aboutInset, ...request });

describe('landingInset', () => {
  it('puts Home at the page top, whatever it is asked with', () => {
    expect(ask({ id: 'home', target: section(), options: { source: 'navbar', edge: 'end' } })).toBeNull();
  });

  it('lands a resumed chapter under the navbar, measured from its section', () => {
    const target = section({}, 3000, 500);
    const landing = document.createElement('div');
    landing.getBoundingClientRect = () => box(1700);
    expect(ask({ id: 'skills', target, landing })).toBe(1700 - 500 - NAVBAR_CLEARANCE_PX);
    // Ahead of About's own depth: Education resumes to its record, not to About's first beat.
    expect(ask({ id: 'about', target, landing, options: { source: 'navbar' } })).toBe(1200 - NAVBAR_CLEARANCE_PX);
  });

  it("asks About for its own depth, with the navigation's source", () => {
    aboutInset.mockClear();
    expect(ask({ id: 'about', target: section(), options: { source: 'navbar' } })).toBe(1800);
    expect(aboutInset).toHaveBeenLastCalledWith(900, 'navbar');
    expect(ask({ id: 'about', target: section() })).toBe(72);
  });

  it('lands a reverse handoff at the chapter end, the navbar clear of its last screen', () => {
    expect(ask({ id: 'skills', target: section({}, 3000), options: { edge: 'end' } })).toBe(3000 - 900 + NAVBAR_CLEARANCE_PX);
    expect(ask({ id: 'contact', target: section({}, 1200), options: { source: 'navbar', edge: 'end' }, viewportHeight: 1000 }))
      .toBe(1200 - 1000 + NAVBAR_CLEARANCE_PX);
  });

  it('keeps the navbar clearance above a chapter, or lands on its own edge while it is laid out linearly', () => {
    expect(ask({ id: 'projects', target: section() })).toBe(-NAVBAR_CLEARANCE_PX);
    expect(ask({ id: 'skills', target: section({ 'data-landing-edge': 'own', 'data-staged': 'false' }) })).toBe(1);
    expect(ask({ id: 'skills', target: section({ 'data-landing-edge': 'own', 'data-staged': 'true' }) })).toBe(-NAVBAR_CLEARANCE_PX);
  });

  it('answers combinations the page never asks for by one fixed precedence: Home, a landing, About, the end', () => {
    // The page asks for anchors only in About and Skills, and for the end only of Skills and Contact.
    // Asked for more, the order below holds, so no caller can come to rely on an accident of order.
    const target = section({ 'data-landing-edge': 'own', 'data-staged': 'false' }, 3000, 500);
    const landing = document.createElement('div');
    landing.getBoundingClientRect = () => box(900);
    expect(ask({ id: 'home', target, landing })).toBeNull();
    expect(ask({ id: 'contact', target, landing, options: { edge: 'end' } })).toBe(900 - 500 - NAVBAR_CLEARANCE_PX);
    expect(ask({ id: 'about', target, options: { source: 'navbar', edge: 'end' } })).toBe(1800);
    expect(ask({ id: 'skills', target, options: { edge: 'end' } })).toBe(3000 - 900 + NAVBAR_CLEARANCE_PX);
  });
});
