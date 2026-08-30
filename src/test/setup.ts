import '@testing-library/jest-dom';

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

/*
 * Mock ResizeObserver.
 *
 * A class, not `vi.fn().mockImplementation(() => ({...}))`. An arrow function
 * cannot be constructed, so the mock threw "is not a constructor" the moment
 * any component actually did `new ResizeObserver(...)` -- which read as the
 * component being broken rather than the mock being wrong. Matches how
 * IntersectionObserver is mocked directly below.
 */
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  root: Element | null = null;
  rootMargin: string = '';
  thresholds: ReadonlyArray<number> = [];
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] { return []; }
};

// Mock emailjs
vi.mock('@emailjs/browser', () => ({
  default: {
    send: vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ status: 200, text: 'OK' }), 100))),
  },
}));