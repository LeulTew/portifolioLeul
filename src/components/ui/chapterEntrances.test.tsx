import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KineticHeading } from './KineticText';
import { Contact } from '../sections/Contact/Contact';

vi.mock('framer-motion', async () => {
  const React = await import('react');
  interface Props {
    children?: React.ReactNode;
    className?: string;
    animate?: object | string;
    whileInView?: object | string;
  }
  const component = (tag: 'div' | 'span') => React.forwardRef<HTMLElement, Props>(
    ({ children, className, animate, whileInView }, ref) => React.createElement(tag, {
      ref, className,
      'data-animate': JSON.stringify(animate),
      'data-native-in-view': whileInView ? 'true' : undefined,
    }, children)
  );
  return {
    motion: { div: component('div'), span: component('span') },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  };
});
vi.mock('../sections/Contact/ContactForm', () => ({ ContactForm: () => <form /> }));
vi.mock('./FocusScrim', () => ({ FocusScrim: () => null }));

const observers: FakeObserver[] = [];
class FakeObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin: string;
  readonly thresholds = [0];
  readonly targets = new Set<Element>();
  constructor(
    readonly callback: IntersectionObserverCallback,
    options?: IntersectionObserverInit
  ) {
    this.rootMargin = options?.rootMargin ?? '0px';
    observers.push(this);
  }
  observe(target: Element) { this.targets.add(target); }
  unobserve(target: Element) { this.targets.delete(target); }
  disconnect() { this.targets.clear(); }
  takeRecords() { return []; }
}

function intersect(target: HTMLElement, visible: boolean) {
  const rect = DOMRect.fromRect({ x: 100, y: 100, width: 500, height: visible ? 80 : 0 });
  for (const observer of observers) {
    if (!observer.targets.has(target)) continue;
    observer.callback([{
      target, isIntersecting: visible, intersectionRatio: visible ? 1 : 0,
      boundingClientRect: rect, intersectionRect: rect,
      rootBounds: DOMRect.fromRect({ width: 1200, height: window.innerHeight }),
      time: performance.now(),
    }], observer);
  }
}

function hidden(node: HTMLElement) {
  const animation: unknown = JSON.parse(node.dataset.animate ?? 'null');
  return animation === 'hidden' || (
    animation !== null && typeof animation === 'object' &&
    'opacity' in animation && animation.opacity === 0
  );
}

let about: HTMLElement;
beforeEach(() => {
  observers.length = 0;
  vi.stubGlobal('IntersectionObserver', FakeObserver);
  about = document.createElement('section');
  about.id = 'about';
  about.dataset.educationActive = 'true';
  document.body.appendChild(about);
});
afterEach(() => {
  cleanup();
  about.remove();
  vi.unstubAllGlobals();
});

describe('real section entrance wiring', () => {
  it.each(['heading', 'contact'])('does not consume %s entrances behind Education', async kind => {
    const { container } = render(kind === 'heading'
      ? <KineticHeading text="Still ahead" />
      : <Contact />);
    const entrances = Array.from(container.querySelectorAll<HTMLElement>('[data-animate]'));
    expect(entrances).toHaveLength(kind === 'heading' ? 1 : 3);
    for (const node of entrances) {
      expect(node).not.toHaveAttribute('data-native-in-view');
      node.getBoundingClientRect = () => DOMRect.fromRect({
        x: 100, y: window.innerHeight + 100, width: 500, height: 80,
      });
      act(() => intersect(node, true));
    }
    expect(entrances.every(hidden)).toBe(true);
    await act(async () => { about.removeAttribute('data-education-active'); });
    expect(entrances.every(hidden)).toBe(true);
    for (const node of entrances) {
      node.getBoundingClientRect = () => DOMRect.fromRect({ x: 100, y: 100, width: 500, height: 80 });
      act(() => intersect(node, true));
    }
    expect(entrances.some(hidden)).toBe(false);
    act(() => entrances.forEach(node => intersect(node, false)));
    expect(entrances.some(hidden)).toBe(false);
  });

  it('preserves the heading inset when ownership ends before a new intersection report', async () => {
    const { container } = render(<KineticHeading text="Below the inset" />);
    const heading = container.querySelector<HTMLElement>('[data-animate]')!;
    const observer = observers.find(observer => observer.targets.has(heading))!;
    expect(observer.rootMargin).toBe('-20px');
    act(() => intersect(heading, true));
    heading.getBoundingClientRect = () => DOMRect.fromRect({
      x: 100, y: window.innerHeight - 10, width: 500, height: 80,
    });
    await act(async () => { about.removeAttribute('data-education-active'); });
    expect(hidden(heading)).toBe(true);
    act(() => intersect(heading, true));
    expect(hidden(heading)).toBe(false);
  });
});
