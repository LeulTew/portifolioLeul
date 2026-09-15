import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EducationRail } from './EducationRail';
import { EDUCATION_RECORDS } from './educationRecords';
import {
  RAIL_HEIGHT, FRAME_HEIGHT, placeEducation as placeRail,
  finishEducation as finish, setupEducationClock, cleanupEducationClock,
} from '@/test/educationClock';

beforeEach(setupEducationClock);
afterEach(cleanupEducationClock);

function openFrame() {
  placeRail(-20);
  finish('education-sticky-header');
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

    for (const [index, record] of EDUCATION_RECORDS.entries()) {
      expect(screen.getByRole('heading', { name: record.title, hidden: true })).toBeInTheDocument();
      const article = screen.getByTestId('education-track').querySelector(`[data-record="${index}"]`)!;
      const items = Array.from(article.querySelectorAll('li'), (item) => item.textContent);
      for (const item of record.items) {
        expect(items).toContain(item);
      }
      expect(article.textContent).toContain(record.award);
      expect(article.querySelector('time')?.textContent).toBe(record.period);
      if (record.summary) expect(article.textContent).toContain(record.summary);
    }
  });

  it('gives split display names one complete accessible institution heading', () => {
    render(<EducationRail />);
    const names = ['HiLCoE', 'Saint Joseph', 'Boot.dev', 'freeCodeCamp'];

    for (const [index, record] of EDUCATION_RECORDS.entries()) {
      const heading = screen.getByRole('heading', { name: record.title, hidden: true });
      expect(heading.getAttribute('aria-label')).toBe(record.title);
      expect(heading.textContent).toBe(names[index]);
      const title = heading.querySelector('[data-part="title"]')!;
      expect(title.getAttribute('aria-hidden')).toBe('true');
      const glyphs = title.querySelectorAll('[data-edu-glyph]');
      if (index === 2) {
        expect(title.querySelector('[data-edu-text="decrypt"]')).not.toBeNull();
      } else {
        expect(Array.from(glyphs, (glyph) => glyph.textContent).join(''))
          .toBe(names[index].replaceAll(' ', ''));
      }
      expect(glyphs.length).toBeLessThan(32);
    }
  });

  it('gives every piece of card copy a text effect, not just its heading', () => {
    render(<EducationRail />);
    const uncovered: string[] = [];
    for (const record of screen.getByTestId('education-track').querySelectorAll('[data-record]')) {
      const text = document.createTreeWalker(record, NodeFilter.SHOW_TEXT);
      while (text.nextNode()) {
        const node = text.currentNode;
        if (!node.textContent?.trim() || node.parentElement?.closest('svg')) continue;
        if (!node.parentElement?.closest('[data-edu-text], [data-edu-glyph]')) {
          uncovered.push(node.textContent);
        }
      }
    }
    expect(uncovered).toEqual([]);
  });

  it('gives each institution its own text treatment without changing its copy', () => {
    render(<EducationRail />);
    expect(Array.from(
      screen.getByTestId('education-track').querySelectorAll<HTMLElement>('[data-record]'),
      record => record.dataset.textStyle
    )).toEqual(['fold', 'letterpress', 'decode', 'flow']);
  });

  it('keeps the supplied Boot.dev variants small and separate from the academic marks', () => {
    render(<EducationRail />);
    const track = screen.getByTestId('education-track');
    const brand = track.querySelector('[data-record="2"] [data-edu-brand]')!;
    expect(brand.closest('[data-has-mark]')).toBeNull();
    expect(brand.closest('[data-dense]')).not.toBeNull();
    expect(brand.querySelector('[data-edu-brand-color]')).toHaveAttribute('src', '/images/education/bootdev-color.webp');
    expect(brand.querySelector('[data-edu-brand-white]')).toHaveAttribute('src', '/images/education/bootdev-white.webp');
    expect(brand.querySelector('[data-edu-brand-white]')).toHaveAttribute('aria-hidden', 'true');
    expect(brand.querySelector('a, button, [tabindex]')).toBeNull();
    expect(track.querySelectorAll('[data-edu-diagram]')).toHaveLength(2);
    for (const diagram of track.querySelectorAll('[data-edu-diagram]')) {
      expect(diagram.closest('[data-record="3"]')).not.toBeNull();
      expect(diagram).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('emphasizes the real GPA once without creating an hours dashboard', () => {
    render(<EducationRail />);
    const stage = screen.getByTestId('education-stage');
    const scores = stage.querySelectorAll('[data-score="true"]');
    expect(scores).toHaveLength(1);
    expect(scores[0].textContent).toBe('GPA: 3.92 / 4.00');
    expect(scores[0].querySelector('strong')?.textContent).toBe('3.92');
    expect(stage.textContent).toContain(
      'Each certification represents approximately 300 hours of coursework'
    );
    expect(stage.textContent).not.toMatch(/\b600\b/);
  });

  it('distinguishes completion totals from the featured courses and their years', () => {
    render(<EducationRail />);
    const track = screen.getByTestId('education-track');
    const bootdev = track.querySelector('[data-record="2"]')!;
    const freecodecamp = track.querySelector('[data-record="3"]')!;
    expect(bootdev.textContent).toContain('15+ courses & projects');
    expect(bootdev.textContent).toContain('Featured from 2025');
    expect(bootdev.textContent).toContain('Selected builds');
    expect(bootdev.textContent).toContain('Selected coursework');
    expect(freecodecamp.textContent).toContain('2+ certifications');
    expect(freecodecamp.textContent).toContain('Featured from 2024');
    expect(track.querySelector('[data-record="0"]')?.textContent).toContain('Completed 08/2025');
  });

  it('draws where the reader is in the set rather than numbering it', () => {
    render(<EducationRail />);
    const ticks = screen.getByTestId('education-progress').children;
    expect(ticks).toHaveLength(EDUCATION_RECORDS.length);
    expect(ticks[0].getAttribute('aria-current')).toBe('true');
    expect(ticks[1].getAttribute('aria-current')).toBeNull();
  });

  it('groups dense courses into projects and coursework instead of an inner scroller', () => {
    /*
     * The stage is a fixed, full-viewport overlay portalled to the body, and
     * the page scrolls inside an element that is not its ancestor. A scrollable
     * region on it is a wheel trap: the reader's scroll goes into the list
     * instead of into the page, and the whole section reads as frozen. Long
     * sets are set in columns instead, and nothing inside the frame scrolls.
     */
    render(<EducationRail />);
     const groups = screen.getByTestId('education-stage').querySelectorAll('[data-dense="true"]');
     expect(groups).toHaveLength(1);
     const lists = groups[0].querySelectorAll('ul');
     expect(lists).toHaveLength(2);
     expect(lists[0].children).toHaveLength(4);
     expect(lists[1].children).toHaveLength(6);
     expect(lists[0].querySelectorAll('[data-build="true"] strong')).toHaveLength(4);
     expect(lists[1].querySelector('[data-build]')).toBeNull();
     expect(groups[0].querySelectorAll('[data-part="row"]')).toHaveLength(12);
     expect(groups[0].querySelector('[tabindex]')).toBeNull();
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
    expect(frame.getAttribute('data-open')).toBe('true');
  });

  it('settles the heading out of the frame\'s way as it opens', async () => {
    render(<EducationRail />);
    const head = screen.getByTestId('education-sticky-header');

    await placeRail(300);
    expect(head.getAttribute('data-settled')).toBeNull();

    await placeRail(-10);
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
    expect(screen.getAllByRole('article')).toHaveLength(EDUCATION_RECORDS.length);
    for (const record of EDUCATION_RECORDS) {
      expect(screen.getByRole('heading', { name: record.title })).toBeInTheDocument();
    }
    const scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(() => {});
    const brand = screen.getByRole('img', { name: 'Boot.dev' }).parentElement!;
    expect(fireEvent.wheel(brand, { deltaY: 120, cancelable: true })).toBe(true);
    expect(scrollBy).not.toHaveBeenCalled();
  });
});
