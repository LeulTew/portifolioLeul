import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EducationRail } from './EducationRail';
import { EDUCATION_RECORDS } from './educationRecords';
import { BEAT_COOLDOWN_MS } from '../aboutBeats';
import {
  RAIL_HEIGHT, FRAME_HEIGHT, placeEducation as placeRail,
  advanceEducation as advance, wheelEducation as wheel,
  finishEducation as finish, setupEducationClock, cleanupEducationClock,
} from '@/test/educationClock';

beforeEach(setupEducationClock);
afterEach(cleanupEducationClock);

function openFrame() {
  placeRail(-20);
  advance(BEAT_COOLDOWN_MS + 1);
  wheel(120);
  finish('education-sticky-header');
  advance(BEAT_COOLDOWN_MS + 1);
}

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
      expect(screen.getByRole('heading', { name: record.title, hidden: true })).toBeInTheDocument();
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

  it('gives each institution its own mark, not one shared treatment', () => {
    // Two marks, built differently on purpose: a vector badge that fills with
    // its own colours, and a raster seal that wipes in and cross-fades.
    render(<EducationRail />);
    expect(
      screen.getByRole('img', { name: /HiLCoE School of Computer Science/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Saint Joseph School', hidden: true })).toBeInTheDocument();
  });

  it('stands the two marks on opposite sides of their records', () => {
    // Where the mark sits is the first thing the eye registers about a record,
    // so the two do not share a side any more than they share a treatment.
    render(<EducationRail />);
    const stage = screen.getByTestId('education-stage');
    expect(stage.querySelectorAll('[data-mark-side="left"]')).toHaveLength(1);
    expect(stage.querySelectorAll('[data-mark-side="right"]')).toHaveLength(1);

    const seal = screen.getByRole('img', { name: 'Saint Joseph School', hidden: true });
    expect(seal.closest('[data-mark-side]')?.getAttribute('data-mark-side')).toBe('left');
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
    expect(marked).toHaveLength(2);
    // The two certifications carry nothing.
    expect(EDUCATION_RECORDS.filter((r) => !r.logo)).toHaveLength(2);
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

  it('retains its fixed stage when a flick spends the rail before the records are read', async () => {
    render(<EducationRail />);
    const stage = screen.getByTestId('education-stage');

    await placeRail(-(RAIL_HEIGHT - FRAME_HEIGHT) - 300);
    expect(stage.style.getPropertyValue('--release')).toBe('0px');
    expect(stage.getAttribute('data-visible')).toBe('true');

    await placeRail(-(RAIL_HEIGHT - FRAME_HEIGHT) - FRAME_HEIGHT);
    expect(stage.getAttribute('data-visible')).toBe('true');
    expect(stage.style.getPropertyValue('--release')).toBe('0px');
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
    expect(frame.getAttribute('data-open')).toBeNull();
    advance(BEAT_COOLDOWN_MS + 1);
    wheel(120);
    expect(frame.getAttribute('data-open')).toBe('true');
  });

  it('settles the heading out of the frame\'s way as it opens', async () => {
    render(<EducationRail />);
    const head = screen.getByTestId('education-sticky-header');

    await placeRail(300);
    expect(head.getAttribute('data-settled')).toBeNull();

    await placeRail(-10);
    advance(BEAT_COOLDOWN_MS + 1);
    wheel(120);
    expect(head.getAttribute('data-settled')).toBeNull();
    finish('education-sticky-header');
    expect(head.getAttribute('data-settled')).toBe('true');
  });
});

describe('EducationRail record selection', () => {
  it('does not derive the record from scroll distance', async () => {
    render(<EducationRail />);
    expect(screen.getByText(EDUCATION_RECORDS[0].title, { selector: 'p' })).toBeInTheDocument();

    // Three fifths of the way through the record window of the hold.
    await placeRail(-(RAIL_HEIGHT - FRAME_HEIGHT) * (0.14 + 0.78 * 0.6));
    expect(screen.getByText(EDUCATION_RECORDS[0].title, { selector: 'p' })).toBeInTheDocument();
  });

  it('never runs past the end of the set', async () => {
    render(<EducationRail />);
    openFrame();
    for (let index = 1; index < EDUCATION_RECORDS.length; index++) {
      fireEvent.click(screen.getByRole('button', { name: 'Next record' }));
      finish('education-track');
      advance(BEAT_COOLDOWN_MS + 1);
    }
    await placeRail(-100000);
    expect(screen.getByText(EDUCATION_RECORDS[EDUCATION_RECORDS.length - 1].title, { selector: 'p' }))
      .toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next record' })).toBeDisabled();
  });
});

describe('EducationRail controls', () => {
  it('cannot step back from the first record', () => {
    render(<EducationRail />);
    expect(screen.getByRole('button', { name: 'Previous record' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next record' })).toBeDisabled();
  });

  it('changes one logical record without spending page scroll', () => {
    const scrollBy = vi.fn();
    window.scrollBy = scrollBy;

    render(<EducationRail />);
    openFrame();
    fireEvent.click(screen.getByRole('button', { name: 'Next record' }));
    expect(scrollBy).not.toHaveBeenCalled();
    expect(screen.getByText(EDUCATION_RECORDS[1].title, { selector: 'p' })).toBeInTheDocument();
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
