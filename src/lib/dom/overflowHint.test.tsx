import { render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useOverflowHint } from './overflowHint';

const frames: FrameRequestCallback[] = [];
const flush = () => { while (frames.length) frames.shift()!(0); };
let resized: (() => void) | null = null;
const metrics = { scrollHeight: 500, clientHeight: 200, scrollTop: 0 };

function Reader({ project }: { project: number }) {
  const box = useRef<HTMLDivElement>(null);
  useOverflowHint(box, project);
  return <div ref={box} data-testid="copy"><p>Copy</p></div>;
}

beforeEach(() => {
  frames.length = 0;
  Object.assign(metrics, { scrollHeight: 500, clientHeight: 200, scrollTop: 0 });
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => frames.push(callback));
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => { frames.length = 0; });
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) { resized = callback; }
    observe() {}
    disconnect() { resized = null; }
  });
  for (const name of ['scrollHeight', 'clientHeight', 'scrollTop'] as const) {
    vi.spyOn(HTMLElement.prototype, name, 'get').mockImplementation(() => metrics[name]);
  }
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('saying there is more below the fold', () => {
  it('marks copy that continues past the fold until the reader reaches its end', () => {
    const { getByTestId } = render(<Reader project={1} />);
    const copy = getByTestId('copy');
    flush();
    expect(copy).toHaveAttribute('data-overflow', 'more');
    metrics.scrollTop = 299;
    copy.dispatchEvent(new Event('scroll'));
    expect(copy).toHaveAttribute('data-overflow', 'more');
    flush();
    expect(copy).not.toHaveAttribute('data-overflow');
  });

  it('measures again when the box or its content resizes, and for new content', () => {
    metrics.scrollHeight = 200;
    const { getByTestId, rerender } = render(<Reader project={1} />);
    const copy = getByTestId('copy');
    flush();
    expect(copy).not.toHaveAttribute('data-overflow');
    metrics.scrollHeight = 480;
    resized!();
    flush();
    expect(copy).toHaveAttribute('data-overflow', 'more');
    metrics.scrollHeight = 150;
    rerender(<Reader project={2} />);
    flush();
    expect(copy).not.toHaveAttribute('data-overflow');
  });

  it('leaves nothing behind when the reader goes', () => {
    const { getByTestId, unmount } = render(<Reader project={1} />);
    const copy = getByTestId('copy');
    flush();
    unmount();
    expect(copy).not.toHaveAttribute('data-overflow');
    expect(resized).toBeNull();
  });
});
