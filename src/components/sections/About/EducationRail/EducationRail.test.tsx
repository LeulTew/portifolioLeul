import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EducationRail } from './EducationRail';
import { EDUCATION_RECORDS } from './educationRecords';
import { setScrollProgress, resetScrollProgress } from '@/lib/scroll/scrollProgress';

const RAIL_HEIGHT = 3000;
const FRAME_HEIGHT = 800;

/**
 * Where the rail currently sits, in viewport coordinates.
 *
 * Installed on the prototype rather than on the element, because the rail
 * reads its own rect on the very first tick of its effect -- before a test
 * could get hold of the node. jsdom reports every rect as zeros, and zero is
 * on the far side of the line the frame opens on, so a rail left unmocked
 * would already be open by the time the first assertion ran.
 */
let railTop = 400;

/** Moves the rail and ticks the scroll store, as a scroll would. */
async function placeRail(top: number) {
  railTop = top;

  await act(async () => {
    // Any change publishes; the value itself is not what the rail reads.
    setScrollProgress(Math.random());
    // The rail coalesces ticks through `requestAnimationFrame`. Stubbing that
    // to run inline is not an option: GSAP keeps a rAF of its own alive, and a
    // synchronous stub turns it into unbounded recursion.
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
  });
}

beforeEach(() => {
  resetScrollProgress();
  window.innerHeight = 800;
  railTop = 400;

  const original = Element.prototype.getBoundingClientRect;
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: Element
  ) {
    if ((this as HTMLElement).dataset?.testid !== 'education-rail') {
      return original.call(this);
    }
    return {
      top: railTop,
      height: RAIL_HEIGHT,
      bottom: railTop + RAIL_HEIGHT,
      left: 0,
      right: 1440,
      width: 1440,
      x: 0,
      y: railTop,
      toJSON: () => ({}),
    } as DOMRect;
  });

  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (
    this: HTMLElement
  ) {
    if (this.dataset?.testid === 'education-rail') return RAIL_HEIGHT;
    return FRAME_HEIGHT;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('EducationRail content', () => {
  it('names the section once, as a heading', () => {
    render(<EducationRail />);
    expect(screen.getByRole('heading', { level: 2, name: 'Education' })).toBeInTheDocument();
  });

  it('renders every record and every line item, not just the first', () => {
    // All four are in the DOM at once: the rail moves them, it does not swap
    // them, so a reader on a narrow screen or with motion off gets the lot.
    render(<EducationRail />);

    for (const record of EDUCATION_RECORDS) {
      expect(screen.getByRole('heading', { name: record.title })).toBeInTheDocument();
      for (const item of record.items) {
        expect(screen.getByText(item)).toBeInTheDocument();
      }
    }
  });

  it('draws where the reader is in the set rather than numbering it', () => {
    render(<EducationRail />);
    const ticks = screen.getByTestId('education-progress').children;
    expect(ticks).toHaveLength(EDUCATION_RECORDS.length);
    expect(ticks[0].getAttribute('aria-current')).toBe('true');
    expect(ticks[1].getAttribute('aria-current')).toBeNull();
  });

  it('marks a list too long to fit, so it is set in columns rather than scrolled', () => {
    /*
     * The stage is a fixed, full-viewport overlay portalled to the body, and
     * the page scrolls inside an element that is not its ancestor. A scrollable
     * region on it is a wheel trap: the reader's scroll goes into the list
     * instead of into the page, and the whole section reads as frozen. Long
     * sets are set in columns instead, and nothing inside the frame scrolls.
     */
    render(<EducationRail />);
    const lists = screen.getByTestId('education-stage').querySelectorAll('ul');

    for (const list of lists) {
      const long = list.children.length > 6;
      expect(list.getAttribute('data-dense')).toBe(long ? 'true' : null);
    }

    // Bootdev's ten courses are the only set long enough to need it.
    expect(screen.getByTestId('education-stage').querySelectorAll('ul[data-dense="true"]'))
      .toHaveLength(1);
  });
});

describe('EducationRail marks', () => {
  it('carries the real badge for the record we hold artwork for', () => {
    render(<EducationRail />);
    expect(
      screen.getByRole('img', { name: /HiLCoE School of Computer Science/i })
    ).toBeInTheDocument();
  });

  it('gives the records we have no artwork for no mark at all', () => {
    /*
     * Not a placeholder, and above all not an approximation: a real school's
     * badge drawn from memory misrepresents it. A record without artwork is a
     * two-column record.
     */
    render(<EducationRail />);
    const marked = screen
      .getByTestId('education-stage')
      .querySelectorAll('[data-has-mark="true"]');
    expect(marked).toHaveLength(EDUCATION_RECORDS.filter((r) => r.logo).length);
    expect(marked).toHaveLength(1);
    expect(screen.getAllByRole('img')).toHaveLength(1);
  });
});

describe('EducationRail hold', () => {
  it('keeps the stage off screen until the section takes it', async () => {
    // The About sequence's own overlay is still covering this while the two
    // hand over; a fixed stage switched on early would sit over that.
    render(<EducationRail />);
    await placeRail(400);

    expect(screen.getByTestId('education-stage').getAttribute('data-visible')).toBeNull();
  });

  it('holds the frame without moving it for the whole of the hold', async () => {
    /*
     * The heart of it. A hold computed per frame lands a frame behind the
     * layer it is holding against, and on a damped scroll that reads as the
     * frame vibrating. Fixed and offset by nothing, the browser holds it.
     */
    render(<EducationRail />);
    const stage = screen.getByTestId('education-stage');

    for (const top of [-1, -600, -1400, -(RAIL_HEIGHT - FRAME_HEIGHT)]) {
      await placeRail(top);
      expect(stage.getAttribute('data-visible')).toBe('true');
      expect(stage.style.getPropertyValue('--release')).toBe('0px');
    }
  });

  it('lets the frame go once the rail runs out, and only then', async () => {
    render(<EducationRail />);
    const stage = screen.getByTestId('education-stage');

    await placeRail(-(RAIL_HEIGHT - FRAME_HEIGHT) - 300);
    expect(stage.style.getPropertyValue('--release')).toBe('300px');
    expect(stage.getAttribute('data-visible')).toBe('true');

    // Carried clear of the top: nothing left to show.
    await placeRail(-(RAIL_HEIGHT - FRAME_HEIGHT) - FRAME_HEIGHT);
    expect(stage.getAttribute('data-visible')).toBeNull();
  });

  it('opens the frame when the section takes the screen, not before', async () => {
    /*
     * The About sequence hands over from a fixed overlay that covers this
     * frame right up to the moment the hold engages. Opening on mere
     * intersection played the whole thing behind that overlay, and the reader
     * arrived to find a frame that had already opened without them.
     */
    render(<EducationRail />);
    const frame = screen.getByTestId('education-frame');

    await placeRail(300);
    expect(frame.getAttribute('data-open')).toBeNull();

    await placeRail(-10);
    await waitFor(() => expect(frame.getAttribute('data-open')).toBe('true'));
  });

  it('settles the heading out of the frame\'s way as it opens', async () => {
    render(<EducationRail />);
    const head = screen.getByTestId('education-sticky-header');

    await placeRail(300);
    expect(head.getAttribute('data-settled')).toBeNull();

    await placeRail(-10);
    await waitFor(() => expect(head.getAttribute('data-settled')).toBe('true'));
  });
});

describe('EducationRail record selection', () => {
  it('reads the record the reader has scrolled to', async () => {
    render(<EducationRail />);
    expect(screen.getByText(EDUCATION_RECORDS[0].title, { selector: 'p' })).toBeInTheDocument();

    // Three fifths of the way through the record window of the hold.
    await placeRail(-(RAIL_HEIGHT - FRAME_HEIGHT) * (0.14 + 0.78 * 0.6));
    await waitFor(() =>
      expect(
        screen.queryByText(EDUCATION_RECORDS[0].title, { selector: 'p' })
      ).not.toBeInTheDocument()
    );
  });

  it('never runs past the end of the set', async () => {
    render(<EducationRail />);
    await placeRail(-100000);
    await waitFor(() =>
      expect(
        screen.getByText(EDUCATION_RECORDS[EDUCATION_RECORDS.length - 1].title, { selector: 'p' })
      ).toBeInTheDocument()
    );
  });
});

describe('EducationRail controls', () => {
  it('cannot step back from the first record', () => {
    render(<EducationRail />);
    expect(screen.getByRole('button', { name: 'Previous record' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next record' })).toBeEnabled();
  });

  it('spends the scroll a record costs rather than jumping the track alone', async () => {
    /*
     * Scroll chooses the record. A control that moved only the track would be
     * undone the instant the reader touched the wheel again, so next and
     * previous move the reader instead.
     */
    const scrollBy = vi.fn();
    window.scrollBy = scrollBy;

    render(<EducationRail />);
    await userEvent.click(screen.getByRole('button', { name: 'Next record' }));

    expect(scrollBy).toHaveBeenCalledTimes(1);
    const [{ top }] = scrollBy.mock.calls[0] as [{ top: number }];
    expect(top).toBeCloseTo((0.78 * (RAIL_HEIGHT - FRAME_HEIGHT)) / EDUCATION_RECORDS.length, 5);
  });
});

describe('EducationRail with reduced motion', () => {
  it('is open, unheld and unmoving on arrival', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) =>
        ({
          matches: query.includes('reduce'),
          media: query,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          addListener: vi.fn(),
          removeListener: vi.fn(),
          onchange: null,
          dispatchEvent: vi.fn(),
        }) as unknown as MediaQueryList
    );

    render(<EducationRail />);
    expect(screen.getByTestId('education-frame').getAttribute('data-open')).toBe('true');
    expect(screen.getByTestId('education-sticky-header').getAttribute('data-settled')).toBe('true');

    // No hold is computed at all, so nothing is being moved per frame.
    const pinned = screen.getByTestId('education-rail').firstElementChild as HTMLElement;
    expect(pinned.style.getPropertyValue('--pin')).toBe('');
  });
});
