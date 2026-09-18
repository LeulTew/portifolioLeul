import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import emailjs from '@emailjs/browser';
import gsap from 'gsap';
import { animationClock } from '@/test/animationClock';
import { publishSectionNavigation } from '@/lib/scroll/sectionNavigation';
import { ContactForm } from './ContactForm';
import { CONTACT_PAPER_PLANE, CONTACT_SEND_DURATION_MS, CONTACT_SEND_FOLD_MS } from './contactSendFlight';

let reduced = false;
let hidden = false;
let clock: ReturnType<typeof animationClock>;
const observers: Array<{ callback: IntersectionObserverCallback; observer: IntersectionObserver; disconnect: () => void }> = [];

vi.mock('@/lib/gateways/animationGateway', () => ({
  usePrefersReducedMotion: () => reduced,
}));

beforeEach(() => {
  reduced = hidden = false;
  observers.length = 0;
  vi.stubEnv('VITE_EMAILJS_SERVICE_ID', 'service_test');
  vi.stubEnv('VITE_EMAILJS_TEMPLATE_ID', 'template_test');
  vi.stubEnv('VITE_EMAILJS_PUBLIC_KEY', 'public_test');
  vi.mocked(emailjs.send).mockReset().mockResolvedValue({ status: 200, text: 'OK' });
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
  vi.stubGlobal('innerWidth', 1440);
  vi.stubGlobal('innerHeight', 900);
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(
    DOMRect.fromRect({ x: 800, y: 130, width: 540, height: 580 }),
  );
  vi.stubGlobal('IntersectionObserver', class implements IntersectionObserver {
    root = null;
    rootMargin = '';
    thresholds = [0];
    disconnect = vi.fn();
    constructor(callback: IntersectionObserverCallback) {
      observers.push({ callback, observer: this, disconnect: this.disconnect });
    }
    observe() {}
    unobserve() {}
    takeRecords() { return []; }
  });
  gsap.ticker.wake();
  gsap.ticker.sleep();
  vi.spyOn(gsap.ticker, 'wake').mockImplementation(() => {});
  clock = animationClock();
});

afterEach(() => {
  cleanup();
  gsap.ticker.sleep();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function mount(enabled = true) {
  const result = render(<><button>Elsewhere</button><ContactForm flightEnabled={enabled} /></>);
  const form = result.container.querySelector('form')!;
  const stage = result.container.querySelector<HTMLElement>('[data-send-phase]')!;
  const sheet = result.container.querySelector<HTMLElement>('[data-send-sheet]')!;
  const name = screen.getByRole('textbox', { name: 'Name' });
  const message = screen.getByRole('textbox', { name: 'Message' });
  fireEvent.change(name, { target: { value: 'Ada & Leul' } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Email' }), { target: { value: 'qa@example.invalid' } });
  fireEvent.change(message, { target: { value: 'Clouds & folds?\n<Keep this draft>' } });
  const submit = async () => { await act(async () => { fireEvent.submit(form); }); };
  const refresh = (flightEnabled = enabled) => result.rerender(
    <><button>Elsewhere</button><ContactForm flightEnabled={flightEnabled} /></>,
  );
  return { ...result, form, stage, sheet, name, message, submit, refresh };
}

it('folds the filled native panel continuously into the authored plane, then flies and restores that same form', async () => {
  let accept!: (value: { status: number; text: string }) => void;
  vi.mocked(emailjs.send).mockReturnValueOnce(new Promise(resolve => { accept = resolve; }));
  const { form, stage, sheet, name, message, submit, container } = mount();
  name.focus();
  await submit();
  expect(form).toHaveAttribute('aria-busy', 'true');
  expect(stage).toHaveAttribute('data-send-phase', 'ready');
  expect(clock.pending).toBe(0);
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  await act(async () => { accept({ status: 200, text: 'OK' }); });
  expect(stage).toHaveAttribute('data-send-phase', 'folding');
  expect(form).toHaveAttribute('aria-busy', 'false');
  expect(name).toHaveValue('Ada & Leul');
  expect(message).toHaveValue('Clouds & folds?\n<Keep this draft>');
  expect(screen.getByRole('status')).toHaveTextContent('Message sent successfully!');
  fireEvent.submit(form);
  expect(emailjs.send).toHaveBeenCalledOnce();

  const wing = sheet.querySelector('[data-send-wing]')!;
  await clock.run(250);
  expect(wing.getAttribute('d')).not.toBe('M0 0L0 80L0 160Z');
  expect(wing.getAttribute('d')).not.toBe(CONTACT_PAPER_PLANE.wing);
  expect(Number(gsap.getProperty(sheet, 'scaleX'))).toBeLessThan(1);
  expect(name).toHaveValue('Ada & Leul');
  await clock.run(250);
  expect(Number(form.style.opacity)).toBeGreaterThan(0);
  expect(Number(form.style.opacity)).toBeLessThan(1);
  expect(form.style.clipPath).toContain('polygon(');
  expect(container.querySelectorAll('form')).toHaveLength(1);
  expect(container.querySelectorAll('input, textarea')).toHaveLength(3);
  expect(wing.closest('svg')).toHaveAttribute('aria-hidden', 'true');

  await clock.run(CONTACT_SEND_FOLD_MS - 500);
  expect(wing.getAttribute('d')).toBe(CONTACT_PAPER_PLANE.wing);
  expect(sheet.querySelector('[data-send-outline]')).toHaveAttribute('d', CONTACT_PAPER_PLANE.outline);
  expect(Number(gsap.getProperty(sheet, 'scaleX'))).toBeCloseTo(200 / 540, 3);
  expect(Number(gsap.getProperty(sheet, 'scaleY'))).toBeCloseTo(160 / 580, 3);
  await clock.run(CONTACT_SEND_DURATION_MS - CONTACT_SEND_FOLD_MS - 10);
  expect(stage).toHaveAttribute('data-send-phase', 'folding');
  expect(Number(gsap.getProperty(sheet, 'x'))).toBeLessThan(-200);
  expect(Number(gsap.getProperty(sheet, 'y'))).toBeLessThan(-400);
  await clock.run(10);
  expect(stage).toHaveAttribute('data-send-phase', 'sent');
  expect(clock.pending).toBe(0);
  expect(sheet.style.transform).toBe('');
  expect(form).toHaveAttribute('inert');
  expect(form).toHaveAttribute('aria-hidden', 'true');
  expect(screen.getByRole('button', { name: 'Send another message' })).toHaveFocus();

  fireEvent.click(screen.getByRole('button', { name: 'Send another message' }));
  expect(stage).toHaveAttribute('data-send-phase', 'ready');
  expect(name).toBe(screen.getByRole('textbox', { name: 'Name' }));
  expect(name.closest('form')).toBe(form);
  expect(name).toHaveFocus();
  expect(name).toHaveValue('');
  expect(message).toHaveValue('');
  expect(form).not.toHaveAttribute('inert');
  expect(form).not.toHaveAttribute('aria-hidden');
  expect(form.style.clipPath).toBe('');
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(emailjs.send).toHaveBeenCalledOnce();
});

it('never animates invalid or rejected sends and keeps an escaped fallback draft ready for retry', async () => {
  vi.mocked(emailjs.send).mockRejectedValueOnce(new Error('Offline'));
  const { form, stage, name, message, submit } = mount();
  fireEvent.change(name, { target: { value: ' ' } });
  await submit();
  expect(screen.getByRole('alert')).toHaveTextContent('Name is required');
  expect(emailjs.send).not.toHaveBeenCalled();
  expect(clock.pending).toBe(0);
  fireEvent.change(name, { target: { value: 'Ada & Leul' } });
  await submit();
  expect(stage).toHaveAttribute('data-send-phase', 'ready');
  expect(clock.pending).toBe(0);
  expect(screen.getByRole('alert')).toHaveTextContent('Failed to send message');
  expect(name).toHaveValue('Ada & Leul');
  expect(message).toHaveValue('Clouds & folds?\n<Keep this draft>');
  expect(form).not.toHaveAttribute('inert');
  const fallback = new URL(screen.getByRole('link', { name: 'Open this draft in your email app' }).getAttribute('href')!);
  expect(fallback.searchParams.get('body')).toBe('Name: Ada & Leul\nEmail: qa@example.invalid\n\nClouds & folds?\n<Keep this draft>');
  expect(fallback.searchParams.get('subject')).toBe('Portfolio message from Ada & Leul');
  await submit();
  expect(stage).toHaveAttribute('data-send-phase', 'folding');
  expect(emailjs.send).toHaveBeenCalledTimes(2);
});

it('pauses hidden-tab time and caps the first stalled frame without completing the remaining flight', async () => {
  const { stage, sheet, submit } = mount();
  await submit();
  await clock.run(200);
  const before = sheet.style.transform;
  hidden = true;
  act(() => document.dispatchEvent(new Event('visibilitychange')));
  expect(clock.pending).toBe(0);
  await clock.frame(60000);
  expect(sheet.style.transform).toBe(before);
  hidden = false;
  act(() => document.dispatchEvent(new Event('visibilitychange')));
  await clock.frame(60000);
  expect(stage).toHaveAttribute('data-send-phase', 'folding');
  expect(Number(gsap.getProperty(sheet, 'scaleX'))).toBeGreaterThan(0.9);
  await clock.run(CONTACT_SEND_DURATION_MS - 250);
  expect(stage).toHaveAttribute('data-send-phase', 'sent');
  expect(clock.pending).toBe(0);
});

it.each(['reduced', 'hidden', 'outside'] as const)('settles acceptance while %s without any flight or stuck pending state', async mode => {
  reduced = mode === 'reduced';
  hidden = mode === 'hidden';
  const { stage, sheet, form, submit, refresh } = mount(mode !== 'outside');
  await submit();
  expect(stage).toHaveAttribute('data-send-phase', 'sent');
  expect(form).toHaveAttribute('aria-busy', 'false');
  expect(sheet.style.transform).toBe('');
  expect(clock.pending).toBe(0);
  reduced = hidden = false;
  refresh(true);
  expect(stage).toHaveAttribute('data-send-phase', 'sent');
  expect(clock.pending).toBe(0);
  expect(screen.getByRole('button', { name: 'Send another message' })).toBeEnabled();
});

it.each(['navigation', 'offscreen', 'resize', 'live reduced', 'camera return'] as const)(
  'settles %s cancellation to a recoverable confirmation without stealing outside focus or replaying',
  async reason => {
    const { stage, sheet, form, submit, refresh } = mount();
    await submit();
    await clock.run(400);
    const elsewhere = screen.getByRole('button', { name: 'Elsewhere' });
    elsewhere.focus();
    if (reason === 'navigation') act(() => publishSectionNavigation('projects', { source: 'navbar' }));
    if (reason === 'resize') act(() => window.dispatchEvent(new Event('resize')));
    if (reason === 'live reduced') { reduced = true; refresh(); }
    if (reason === 'camera return') refresh(false);
    if (reason === 'offscreen') {
      const { callback, observer } = observers[0];
      act(() => callback([{
        target: stage, isIntersecting: false, intersectionRatio: 0,
        boundingClientRect: stage.getBoundingClientRect(), intersectionRect: new DOMRect(),
        rootBounds: null, time: performance.now(),
      }], observer));
    }
    expect(stage).toHaveAttribute('data-send-phase', 'sent');
    expect(form).toHaveAttribute('aria-busy', 'false');
    expect(elsewhere).toHaveFocus();
    expect(sheet.style.transform).toBe('');
    expect(clock.pending).toBe(0);
    expect(observers[0].disconnect).toHaveBeenCalled();
    reduced = false;
    refresh(true);
    expect(stage).toHaveAttribute('data-send-phase', 'sent');
    expect(clock.pending).toBe(0);
    expect(emailjs.send).toHaveBeenCalledOnce();
  },
);

it('allows an explicit new draft to cancel the optional flight without cancelling reader input', async () => {
  const { stage, name, form, submit } = mount();
  await submit();
  await clock.run(800);
  for (const event of [
    new WheelEvent('wheel', { deltaY: -800, bubbles: true, cancelable: true }),
    new KeyboardEvent('keydown', { key: 'PageUp', bubbles: true, cancelable: true }),
  ]) {
    act(() => { window.dispatchEvent(event); });
    expect(event.defaultPrevented).toBe(false);
  }
  fireEvent.click(screen.getByRole('button', { name: 'Send another message' }));
  expect(stage).toHaveAttribute('data-send-phase', 'ready');
  expect(name).toHaveFocus();
  expect(name).toHaveValue('');
  expect(form).not.toHaveAttribute('inert');
  expect(clock.pending).toBe(0);
  expect(emailjs.send).toHaveBeenCalledOnce();
});

it.each(['pending', 'folding'] as const)('cleans up an unmount while %s and never starts a late flight', async when => {
  let accept!: (value: { status: number; text: string }) => void;
  vi.mocked(emailjs.send).mockReturnValueOnce(new Promise(resolve => { accept = resolve; }));
  const { sheet, submit, unmount } = mount();
  await submit();
  if (when === 'folding') {
    await act(async () => { accept({ status: 200, text: 'OK' }); });
    await clock.run(300);
  }
  unmount();
  if (when === 'pending') await act(async () => { accept({ status: 200, text: 'OK' }); });
  await clock.frame(10000);
  expect(clock.pending).toBe(0);
  expect(sheet.style.transform).toBe('');
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(emailjs.send).toHaveBeenCalledOnce();
});
