import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { checkIsFooterContrast, useFooterContrast } from './useFooterContrast';
import { setScrollProgress } from './scrollProgress';

describe('useFooterContrast & checkIsFooterContrast', () => {
  let originalInnerHeight: number;

  beforeEach(() => {
    originalInnerHeight = window.innerHeight;
    window.innerHeight = 1000;
    document.body.innerHTML = '';
    document.documentElement.removeAttribute('data-footer-contrast');
    document.documentElement.removeAttribute('data-navbar-contrary');
  });

  afterEach(() => {
    window.innerHeight = originalInnerHeight;
    document.body.innerHTML = '';
    document.documentElement.removeAttribute('data-footer-contrast');
    document.documentElement.removeAttribute('data-navbar-contrary');
  });

  it('returns false when no sections exist', () => {
    expect(checkIsFooterContrast()).toBe(false);
  });

  it('returns false when user is on Hero (About is far below footer)', () => {
    const about = document.createElement('div');
    about.id = 'about';
    // Top is at 1200px (below footer at 940px)
    vi.spyOn(about, 'getBoundingClientRect').mockReturnValue({
      top: 1200,
      bottom: 2500,
      left: 0,
      right: 1000,
      width: 1000,
      height: 1300,
      x: 0,
      y: 1200,
      toJSON: () => {},
    });
    document.body.appendChild(about);

    expect(checkIsFooterContrast()).toBe(false);
  });

  it('returns false when user is in About before pixel transition', () => {
    const about = document.createElement('div');
    about.id = 'about';
    vi.spyOn(about, 'getBoundingClientRect').mockReturnValue({
      top: 200,
      bottom: 2000,
      left: 0,
      right: 1000,
      width: 1000,
      height: 1800,
      x: 0,
      y: 200,
      toJSON: () => {},
    });
    document.body.appendChild(about);

    expect(checkIsFooterContrast()).toBe(false);
  });

  it('returns true when About has data-bg-transition="true"', () => {
    const about = document.createElement('div');
    about.id = 'about';
    about.setAttribute('data-bg-transition', 'true');
    vi.spyOn(about, 'getBoundingClientRect').mockReturnValue({
      top: -300,
      bottom: 1500,
      left: 0,
      right: 1000,
      width: 1000,
      height: 1800,
      x: 0,
      y: -300,
      toJSON: () => {},
    });
    document.body.appendChild(about);

    expect(checkIsFooterContrast()).toBe(true);
  });

  /**
   * Builds the pixel grid the rise is drawn from, with `litRows` counted from
   * the bottom -- which is the direction the wall climbs.
   */
  const buildGrid = (parent: HTMLElement, cols: number, rows: number, litRows: number) => {
    const grid = document.createElement('div');
    grid.setAttribute('data-testid', 'bg-pixel-transition-grid');
    grid.style.setProperty('--bg-cols', String(cols));
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const cell = document.createElement('span');
        cell.dataset.active = row >= rows - litRows ? 'true' : 'false';
        grid.appendChild(cell);
      }
    }
    parent.appendChild(grid);
    return grid;
  };

  const aboutOverTheFooter = () => {
    const about = document.createElement('div');
    about.id = 'about';
    vi.spyOn(about, 'getBoundingClientRect').mockReturnValue({
      top: -300, bottom: 1500, left: 0, right: 1000,
      width: 1000, height: 1800, x: 0, y: -300, toJSON: () => {},
    } as DOMRect);
    const overlay = document.createElement('div');
    overlay.setAttribute('data-pinned-sequence', 'true');
    overlay.setAttribute('data-active', 'true');
    overlay.style.setProperty('--seq', '0.82');
    about.appendChild(overlay);
    document.body.appendChild(about);
    return { about, overlay };
  };

  it('stays dark while the rise has been triggered but has not reached the footer', () => {
    /*
     * The behaviour this replaced. `seq >= 0.78` is where the rise is
     * TRIGGERED; it then climbs from the bottom of the screen over a second and
     * a half. Returning true on the threshold turned the footer light a whole
     * beat before the green arrived under it.
     */
    const { about } = aboutOverTheFooter();
    buildGrid(about, 10, 8, 0);

    expect(checkIsFooterContrast()).toBe(false);
  });

  it('turns light as soon as the wall reaches the strip it sits on', () => {
    // The footer is 60px off the bottom, so one row of an eight-row grid on a
    // 768px viewport is already enough to be underneath it.
    const { about } = aboutOverTheFooter();
    buildGrid(about, 10, 8, 1);

    expect(checkIsFooterContrast()).toBe(true);
  });

  it('needs a majority of the row, not one stray cell of it', () => {
    /*
     * The edge is deliberately ragged, so cells in a row light a couple of rows
     * deep apart. One lit cell would flip the ink while the strip still reads
     * as the old ground.
     */
    const { about } = aboutOverTheFooter();
    const grid = buildGrid(about, 10, 8, 0);
    const bottomRow = 7 * 10;
    for (let col = 0; col < 4; col++) {
      (grid.children[bottomRow + col] as HTMLElement).dataset.active = 'true';
    }

    expect(checkIsFooterContrast()).toBe(false);
  });

  it('is true once the solid backdrop is up, whatever the cells say', () => {
    const { about } = aboutOverTheFooter();
    buildGrid(about, 10, 8, 0);
    const backdrop = document.createElement('div');
    backdrop.setAttribute('data-testid', 'bg-pixel-transition-backdrop');
    backdrop.dataset.active = 'true';
    about.appendChild(backdrop);

    expect(checkIsFooterContrast()).toBe(true);
  });

  it('returns true when Education stage has data-visible="true"', () => {
    const about = document.createElement('div');
    about.id = 'about';
    vi.spyOn(about, 'getBoundingClientRect').mockReturnValue({
      top: -500,
      bottom: 1200,
      left: 0,
      right: 1000,
      width: 1000,
      height: 1700,
      x: 0,
      y: -500,
      toJSON: () => {},
    });
    document.body.appendChild(about);

    const stage = document.createElement('div');
    stage.setAttribute('data-testid', 'education-stage');
    stage.setAttribute('data-visible', 'true');
    vi.spyOn(stage, 'getBoundingClientRect').mockReturnValue({
      top: 0,
      bottom: 1000,
      left: 0,
      right: 1000,
      width: 1000,
      height: 1000,
      x: 0,
      y: 0,
      toJSON: () => {},
    });
    document.body.appendChild(stage);

    expect(checkIsFooterContrast()).toBe(true);
  });

  it('returns false when Education stage has released/lifted above the footer', () => {
    const about = document.createElement('div');
    about.id = 'about';
    about.setAttribute('data-education-active', 'true');
    vi.spyOn(about, 'getBoundingClientRect').mockReturnValue({
      top: -3000,
      bottom: 700, // < footerY (940)
      left: 0,
      right: 1000,
      width: 1000,
      height: 3700,
      x: 0,
      y: -3000,
      toJSON: () => {},
    });
    document.body.appendChild(about);

    const stage = document.createElement('div');
    stage.setAttribute('data-testid', 'education-stage');
    stage.setAttribute('data-visible', 'true');
    // Stage has translated up so its bottom is 700 (above footer at 940)
    vi.spyOn(stage, 'getBoundingClientRect').mockReturnValue({
      top: -300,
      bottom: 700,
      left: 0,
      right: 1000,
      width: 1000,
      height: 1000,
      x: 0,
      y: -300,
      toJSON: () => {},
    });
    document.body.appendChild(stage);

    expect(checkIsFooterContrast()).toBe(false);
  });

  it('returns false once Skills section reaches the footer area', () => {
    const about = document.createElement('div');
    about.id = 'about';
    about.setAttribute('data-bg-transition', 'true');
    vi.spyOn(about, 'getBoundingClientRect').mockReturnValue({
      top: -1500,
      bottom: 500,
      left: 0,
      right: 1000,
      width: 1000,
      height: 2000,
      x: 0,
      y: -1500,
      toJSON: () => {},
    });
    document.body.appendChild(about);

    const skills = document.createElement('div');
    skills.id = 'skills';
    // Footer is at window.innerHeight - 60 = 940. Skills top is at 900 (above footer)
    vi.spyOn(skills, 'getBoundingClientRect').mockReturnValue({
      top: 900,
      bottom: 2200,
      left: 0,
      right: 1000,
      width: 1000,
      height: 1300,
      x: 0,
      y: 900,
      toJSON: () => {},
    });
    document.body.appendChild(skills);

    expect(checkIsFooterContrast()).toBe(false);
  });

  it('syncs data-footer-contrast on document.documentElement via useFooterContrast hook', () => {
    const about = document.createElement('div');
    about.id = 'about';
    vi.spyOn(about, 'getBoundingClientRect').mockReturnValue({
      top: -300,
      bottom: 1500,
      left: 0,
      right: 1000,
      width: 1000,
      height: 1800,
      x: 0,
      y: -300,
      toJSON: () => {},
    });
    document.body.appendChild(about);

    const { result, unmount } = renderHook(() => useFooterContrast());
    expect(result.current).toBe(false);
    expect(document.documentElement.getAttribute('data-footer-contrast')).toBeNull();

    // Trigger contrast transition
    act(() => {
      about.setAttribute('data-bg-transition', 'true');
      setScrollProgress(0.5);
    });

    expect(result.current).toBe(true);
    expect(document.documentElement.getAttribute('data-footer-contrast')).toBe('true');

    unmount();
    expect(document.documentElement.getAttribute('data-footer-contrast')).toBeNull();
  });
});
