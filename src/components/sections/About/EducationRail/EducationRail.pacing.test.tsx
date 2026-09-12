import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import gsap from 'gsap';
import { EducationRail } from './EducationRail';
import { BEAT_COOLDOWN_MS } from '../aboutBeats';
import { publishSectionNavigation } from '@/lib/scroll/sectionNavigation';
import {
  advanceEducation as advance, placeEducation as place,
  wheelEducation as wheel, finishEducation as finish,
  setupEducationClock, cleanupEducationClock,
} from '@/test/educationClock';

const selected = () => [...screen.getByTestId('education-progress').children]
  .findIndex(element => element.getAttribute('aria-current') === 'true');

function mount(settled = true, onNavigate?: (section: string) => void) {
  render(
    <section id="about" data-title-settled={settled ? 'true' : undefined}>
      <EducationRail onNavigate={onNavigate} />
    </section>
  );
  gsap.ticker.sleep();
}

function enter(onNavigate?: (section: string) => void) {
  mount(true, onNavigate);
  place(-20);
  advance(BEAT_COOLDOWN_MS + 1);
  wheel(120);
  finish('education-sticky-header');
  advance(BEAT_COOLDOWN_MS + 1);
}

beforeEach(setupEducationClock);
afterEach(cleanupEducationClock);

describe('Education completed-beat navigation', () => {
  it('does not select hidden records before the About title has completed', () => {
    mount(false);
    place(-100000);
    wheel(12000);
    advance(5000);
    expect(selected()).toBe(0);
    expect(screen.getByTestId('education-stage')).not.toHaveAttribute('data-visible', 'true');
  });

  it('takes over the first record after late completion even when scrolling has stopped past the rail', async () => {
    mount(false);
    place(-100000);
    await act(async () => {
      document.getElementById('about')!.setAttribute('data-title-settled', 'true');
    });
    advance(BEAT_COOLDOWN_MS + 1);
    expect(selected()).toBe(0);
    expect(screen.getByTestId('education-stage')).toHaveAttribute('data-visible', 'true');
    finish('education-sticky-header');
    advance(5000);
    expect(selected()).toBe(0);
  });

  it('does not retarget an unfinished crossing or queue momentum through its reading pause', () => {
    enter();
    wheel(500);
    expect(selected()).toBe(1);
    place(-2300);
    for (let i = 0; i < 12; i++) {
      advance(50);
      wheel(500);
    }
    expect(selected()).toBe(1);
    finish('education-track');
    for (let i = 0; i < 60; i++) {
      advance(50);
      wheel(500);
    }
    expect(selected()).toBe(1);
    advance(300);
    wheel(500);
    expect(selected()).toBe(2);
  });

  it('uses next/back to select one record without native smooth scrolling or an in-flight interruption', () => {
    enter();
    const next = screen.getByRole('button', { name: 'Next record' });
    fireEvent.click(next);
    expect(selected()).toBe(1);
    expect(next).toBeDisabled();
    fireEvent.click(next);
    expect(selected()).toBe(1);
    expect(window.scrollBy).not.toHaveBeenCalled();
    finish('education-track');
    expect(next).toBeDisabled();
    advance(BEAT_COOLDOWN_MS + 1);
    fireEvent.click(screen.getByRole('button', { name: 'Previous record' }));
    expect(selected()).toBe(0);
  });

  it('keeps the last record readable until a separate exit request', () => {
    enter();
    for (let index = 1; index < 4; index++) {
      fireEvent.click(screen.getByRole('button', { name: 'Next record' }));
      finish('education-track');
      advance(BEAT_COOLDOWN_MS + 1);
      expect(selected()).toBe(index);
    }
    place(-100000);
    advance(5000);
    expect(screen.getByTestId('education-stage')).toHaveAttribute('data-visible', 'true');
    expect(selected()).toBe(3);
  });

  it('cancels its reading wake and ownership on unmount', () => {
    enter();
    fireEvent.click(screen.getByRole('button', { name: 'Next record' }));
    finish('education-track');
    cleanup();
    advance(5000);
    expect(document.querySelector('[data-testid="education-stage"]')).toBeNull();
    expect(gsap.globalTimeline.getChildren().filter(animation => animation.isActive())).toHaveLength(0);
  });

  it('waits for the seal and every row, not merely the track, before starting the reading pause', () => {
    enter();
    fireEvent.click(screen.getByRole('button', { name: 'Next record' }));
    finish('education-track', 1.2);
    advance(BEAT_COOLDOWN_MS + 1);
    wheel(500);
    expect(selected()).toBe(1);
    expect(screen.getByRole('button', { name: 'Next record' })).toBeDisabled();
    finish('education-track');
    advance(BEAT_COOLDOWN_MS - 1);
    expect(screen.getByRole('button', { name: 'Next record' })).toBeDisabled();
    advance(2);
    expect(screen.getByRole('button', { name: 'Next record' })).toBeEnabled();
  });

  it('does not spend the opening pause in a hidden tab or queue a gesture during its remaining rest', () => {
    mount();
    place(-20);
    advance(400);
    const hidden = vi.spyOn(document, 'hidden', 'get');
    hidden.mockReturnValue(true);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    advance(5000);
    hidden.mockReturnValue(false);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    wheel(500);
    advance(801);
    expect(screen.getByTestId('education-frame')).not.toHaveAttribute('data-open', 'true');
    wheel(500);
    expect(screen.getByTestId('education-frame')).toHaveAttribute('data-open', 'true');
  });

  it('does not pull the page back into Education after a forward flick has already left it', () => {
    const navigate = vi.fn();
    enter(navigate);
    for (let index = 1; index < 4; index++) {
      fireEvent.click(screen.getByRole('button', { name: 'Next record' }));
      finish('education-track');
      advance(BEAT_COOLDOWN_MS + 1);
    }
    place(-100000);
    wheel(120);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('does not scroll down to About when the reader has already scrolled back above Education', () => {
    const navigate = vi.fn();
    enter(navigate);
    place(2000);
    wheel(-120);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('honors explicit section navigation after the current crossing and reading pause', () => {
    enter();
    fireEvent.click(screen.getByRole('button', { name: 'Next record' }));
    act(() => publishSectionNavigation('contact'));
    expect(screen.getByTestId('education-stage')).toHaveAttribute('data-visible', 'true');
    finish('education-track');
    advance(BEAT_COOLDOWN_MS - 1);
    expect(screen.getByTestId('education-stage')).toHaveAttribute('data-phase', 'reading');
    advance(2);
    finish('education-stage');
    expect(screen.getByTestId('education-stage')).not.toHaveAttribute('data-visible', 'true');
    place(-100000);
    advance(5000);
    expect(screen.getByTestId('education-stage')).not.toHaveAttribute('data-visible', 'true');
  });

  it('withdraws on a fresh upward wave instead of opening a chapter the reader has left', () => {
    mount();
    place(-20);
    advance(BEAT_COOLDOWN_MS + 1);
    wheel(-120);
    expect(screen.getByTestId('education-frame')).not.toHaveAttribute('data-open', 'true');
    expect(screen.getByTestId('education-stage')).toHaveAttribute('data-phase', 'returning');
  });

  it('aligns button-only reading with Skills instead of exposing an empty education rail', () => {
    const navigate = vi.fn();
    enter(navigate);
    for (let index = 1; index < 4; index++) {
      fireEvent.click(screen.getByRole('button', { name: 'Next record' }));
      finish('education-track');
      advance(BEAT_COOLDOWN_MS + 1);
    }
    wheel(120);
    expect(navigate).toHaveBeenCalledExactlyOnceWith('skills');
  });

  it('opens the last record on an upward wave when reentering from Skills', () => {
    enter();
    for (let index = 1; index < 4; index++) {
      fireEvent.click(screen.getByRole('button', { name: 'Next record' }));
      finish('education-track');
      advance(BEAT_COOLDOWN_MS + 1);
    }
    place(-100000);
    wheel(120);
    finish('education-stage');
    advance(300);
    place(-2100);
    wheel(-120);
    advance(BEAT_COOLDOWN_MS + 1);
    expect(screen.getByTestId('education-stage')).toHaveAttribute('data-phase', 'waiting');
    wheel(-120);
    expect(screen.getByTestId('education-stage')).toHaveAttribute('data-phase', 'opening');
    expect(screen.getByTestId('education-stage')).toHaveAttribute('data-active-record', '3');
  });
});
