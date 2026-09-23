import { act, cleanup, render, screen } from '@testing-library/react';
import { animationClock } from '@/test/animationClock';
import { ModernTVLoader } from './ModernTVLoader';

const state = vi.hoisted(() => ({
  progress: 50,
  reduced: false,
  complete: undefined as (() => void) | undefined,
}));
vi.mock('./useAssetLoadingProgress', () => ({
  useAssetLoadingProgress: ({ onComplete }: { onComplete?: () => void }) => {
    state.complete = onComplete;
    return { progress: state.progress };
  },
}));
vi.mock('@/lib/gateways/animationGateway', () => ({
  usePrefersReducedMotion: () => state.reduced,
}));

const context: Pick<CanvasRenderingContext2D,
  'save' | 'restore' | 'scale' | 'clearRect' | 'beginPath' | 'moveTo' | 'lineTo' | 'closePath' | 'fill' | 'fillStyle'> = {
  save: vi.fn(), restore: vi.fn(), scale: vi.fn(), clearRect: vi.fn(),
  beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), closePath: vi.fn(), fill: vi.fn(), fillStyle: '',
};
const originalContext = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'getContext')!;
let clock: ReturnType<typeof animationClock>;
let width = 940;
let height = 235;
let hidden = false;

beforeEach(() => {
  state.progress = 50;
  state.reduced = false;
  state.complete = undefined;
  width = 940;
  height = 235;
  hidden = false;
  vi.clearAllMocks();
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => width);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(() => height);
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
  vi.stubGlobal('innerWidth', 1440);
  vi.stubGlobal('devicePixelRatio', 1);
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true, value: vi.fn(() => context),
  });
  clock = animationClock();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', originalContext);
});

it('allocates integer canvas dimensions once instead of resetting fractional-height buffers every paint', async () => {
  const widthWrites = vi.spyOn(HTMLCanvasElement.prototype, 'width', 'set');
  const heightWrites = vi.spyOn(HTMLCanvasElement.prototype, 'height', 'set');
  const measureWidth = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get');
  const { container } = render(<ModernTVLoader />);
  const canvas = container.querySelector('canvas')!;
  expect(canvas.width).toBe(940);
  expect(canvas.height).toBe(314);
  const measured = measureWidth.mock.calls.length;
  for (let frame = 0; frame < 180; frame++) await clock.frame(1000 / 180);
  expect(widthWrites).toHaveBeenCalledTimes(1);
  expect(heightWrites).toHaveBeenCalledTimes(1);
  expect(measureWidth.mock.calls.length).toBe(measured);
  expect(context.fill).toHaveBeenCalled();
  expect(vi.mocked(context.fill).mock.calls.length).toBeLessThanOrEqual(62);
});

it('updates the buffer once per genuine layout change and preserves its wave over hidden time', async () => {
  const heightWrites = vi.spyOn(HTMLCanvasElement.prototype, 'height', 'set');
  const { container, unmount } = render(<ModernTVLoader />);
  width = 800;
  height = 200;
  act(() => window.dispatchEvent(new Event('resize')));
  expect(container.querySelector('canvas')?.width).toBe(800);
  expect(container.querySelector('canvas')?.height).toBe(279);
  expect(heightWrites).toHaveBeenCalledTimes(2);
  await clock.run(100);
  hidden = true;
  act(() => document.dispatchEvent(new Event('visibilitychange')));
  const draws = vi.mocked(context.fill).mock.calls.length;
  await clock.frame(60000);
  expect(vi.mocked(context.fill).mock.calls.length).toBe(draws);
  hidden = false;
  act(() => document.dispatchEvent(new Event('visibilitychange')));
  await clock.frame(20);
  expect(vi.mocked(context.fill).mock.calls.length).toBeGreaterThan(draws);
  unmount();
  const stopped = vi.mocked(context.fill).mock.calls.length;
  await clock.frame(1000);
  expect(vi.mocked(context.fill).mock.calls.length).toBe(stopped);
});

it('provides static progress without a Canvas or wave loop when reduced motion is requested', async () => {
  state.reduced = true;
  const { container, rerender } = render(<ModernTVLoader theme="light" />);
  expect(screen.getByRole('progressbar')).toHaveAttribute('data-reduced-motion', 'true');
  expect(container.querySelector('canvas')).toBeNull();
  expect(container.querySelector('[class*="staticFill"]')).toHaveStyle({ transform: 'scaleY(0.5)' });
  await clock.run(1000);
  expect(context.fill).not.toHaveBeenCalled();
  state.progress = 100;
  rerender(<ModernTVLoader theme="light" />);
  expect(container.querySelector('[class*="staticFill"]')).toHaveStyle({ transform: 'scaleY(1)' });
});

it('releases the real Canvas when reduced motion is enabled during loading', async () => {
  const { container, rerender } = render(<ModernTVLoader />);
  await clock.run(100);
  state.reduced = true;
  rerender(<ModernTVLoader />);
  expect(container.querySelector('canvas')).toBeNull();
  const draws = vi.mocked(context.fill).mock.calls.length;
  await clock.run(1000);
  expect(vi.mocked(context.fill).mock.calls.length).toBe(draws);
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
  state.reduced = false;
  rerender(<ModernTVLoader />);
  expect(container.querySelector('canvas')).not.toBeNull();
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
});

it('finishes the reduced-motion exit once without a zoom or a surviving drawing loop', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  state.reduced = true;
  state.progress = 100;
  const onLoaded = vi.fn();
  const { container } = render(<ModernTVLoader onLoaded={onLoaded} />);
  await act(async () => {
    state.complete?.();
    await vi.advanceTimersByTimeAsync(0);
  });
  const mask = container.querySelector<HTMLElement>('[class*="logoMask"]')!;
  await clock.run(100);
  expect(mask.style.transform).not.toMatch(/scale\([2-9]/);
  await act(async () => { await vi.advanceTimersByTimeAsync(200); });
  expect(onLoaded).toHaveBeenCalledOnce();
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  await clock.run(1000);
  await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
  expect(onLoaded).toHaveBeenCalledOnce();
  expect(context.fill).not.toHaveBeenCalled();
});
