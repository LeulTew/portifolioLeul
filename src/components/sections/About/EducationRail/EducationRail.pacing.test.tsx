import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import gsap from 'gsap';
import { EducationRail } from './EducationRail';
import styles from './EducationRail.module.css';
import { SCROLL_WAVE_IDLE_MS } from '@/lib/scroll/scrollGesture';
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
  advance(SCROLL_WAVE_IDLE_MS);
  finish('education-sticky-header');
}

beforeEach(setupEducationClock);
afterEach(cleanupEducationClock);

describe('Education completed-beat navigation', () => {
  it('opens directly on title completion before the rail reaches the viewport', async () => {
    mount(false);
    expect(screen.getByTestId('education-rail').getBoundingClientRect().top).toBeGreaterThan(0);
    await act(async () => {
      document.getElementById('about')!.setAttribute('data-title-settled', 'true');
    });
    expect(screen.getByTestId('education-stage')).toHaveAttribute('data-phase', 'opening');
    expect(screen.getByTestId('education-frame')).toHaveAttribute('data-open', 'true');
    expect(selected()).toBe(0);
  });

  it('does not claim a return while Skills is finishing its own reverse beat', async () => {
    const skills = document.createElement('section');
    skills.id = 'skills';
    skills.dataset.skillsActive = 'true';
    document.body.appendChild(skills);
    mount();
    act(() => publishSectionNavigation('skills'));
    place(-20);
    advance(SCROLL_WAVE_IDLE_MS + 1);
    wheel(-120);
    expect(screen.getByTestId('education-stage')).not.toHaveAttribute('data-visible', 'true');
    await act(async () => { delete skills.dataset.skillsActive; });
    expect(screen.getByTestId('education-stage')).toHaveAttribute('data-visible', 'true');
    skills.remove();
  });

  it('does not reclaim skipped Education on the first upward wave while the reader is still below it', () => {
    mount(false);
    act(() => publishSectionNavigation('skills'));
    document.getElementById('about')!.dataset.titleSettled = 'true';
    place(-10000);
    advance(SCROLL_WAVE_IDLE_MS + 1);
    wheel(-500);
    expect(screen.getByTestId('education-stage')).not.toHaveAttribute('data-visible', 'true');
    place(-2100);
    advance(300);
    wheel(-500);
    expect(screen.getByTestId('education-stage')).toHaveAttribute('data-visible', 'true');
  });

  it('does not treat a temporarily unmeasured track rebuild as a reverse entry', () => {
    mount(false);
    act(() => publishSectionNavigation('projects'));
    document.getElementById('about')!.dataset.titleSettled = 'true';
    place(-10000);
    const rail = screen.getByTestId('education-rail');
    Object.defineProperty(rail, 'getBoundingClientRect', {
      configurable: true,
      value: () => new DOMRect(),
    });
    wheel(-500);
    advance(SCROLL_WAVE_IDLE_MS + 1);
    expect(screen.getByTestId('education-stage')).not.toHaveAttribute('data-visible', 'true');
    Reflect.deleteProperty(rail, 'getBoundingClientRect');
    place(-2100);
    expect(screen.getByTestId('education-stage')).toHaveAttribute('data-visible', 'true');
  });
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
    expect(screen.getByTestId('education-stage')).toHaveAttribute('data-phase', 'opening');
    expect(selected()).toBe(0);
    expect(screen.getByTestId('education-stage')).toHaveAttribute('data-visible', 'true');
    finish('education-sticky-header');
    advance(5000);
    expect(selected()).toBe(0);
  });

  it('does not retarget an unfinished crossing or let momentum advance again after completion', () => {
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

  it.each([
    { delta: 120, expected: 2 },
    { delta: -120, expected: 0 },
  ])('accepts a fresh $delta scroll immediately when the full crossing finishes', ({ delta, expected }) => {
    enter();
    wheel(120);
    expect(selected()).toBe(1);
    advance(SCROLL_WAVE_IDLE_MS);
    finish('education-track');
    wheel(delta);
    expect(selected()).toBe(expected);
    expect(screen.getByTestId('education-stage')).toHaveAttribute('data-phase', 'crossing');
    wheel(delta);
    expect(selected()).toBe(expected);
  });

  it('accepts the first record switch immediately when the full opening finishes', () => {
    mount();
    place(-20);
    wheel(120);
    advance(SCROLL_WAVE_IDLE_MS);
    finish('education-sticky-header');
    wheel(120);
    expect(selected()).toBe(1);
  });

  it('discards a wave started during a crossing instead of replaying it on completion', () => {
    enter();
    wheel(120);
    advance(SCROLL_WAVE_IDLE_MS);
    wheel(120);
    expect(selected()).toBe(1);
    expect(screen.getByRole('button', { name: 'Next record' })).toBeDisabled();
    finish('education-track');
    expect(screen.getByRole('button', { name: 'Next record' })).toBeEnabled();
    expect(selected()).toBe(1);
    wheel(120);
    expect(selected()).toBe(1);
    advance(SCROLL_WAVE_IDLE_MS);
    wheel(120);
    expect(selected()).toBe(2);
  });

  it('requires a released scroll key rather than advancing on repeats after completion', () => {
    enter();
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    expect(selected()).toBe(1);
    finish('education-track');
    fireEvent.keyDown(window, { key: 'ArrowDown', repeat: true });
    expect(selected()).toBe(1);
    fireEvent.keyUp(window, { key: 'ArrowDown' });
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    expect(selected()).toBe(2);
  });

  it('requires a new touch gesture rather than continuing the same swipe after completion', () => {
    enter();
    fireEvent.touchStart(window, { touches: [{ clientY: 300 }] });
    fireEvent.touchMove(window, { touches: [{ clientY: 250 }] });
    expect(selected()).toBe(1);
    finish('education-track');
    fireEvent.touchMove(window, { touches: [{ clientY: 200 }] });
    expect(selected()).toBe(1);
    fireEvent.touchEnd(window);
    fireEvent.touchStart(window, { touches: [{ clientY: 200 }] });
    fireEvent.touchMove(window, { touches: [{ clientY: 150 }] });
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
    expect(next).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Previous record' }));
    expect(selected()).toBe(0);
  });

  it('keeps the last record readable until a separate exit request', () => {
    enter();
    for (let index = 1; index < 4; index++) {
      fireEvent.click(screen.getByRole('button', { name: 'Next record' }));
      finish('education-track');
      expect(selected()).toBe(index);
    }
    place(-100000);
    advance(5000);
    expect(screen.getByTestId('education-stage')).toHaveAttribute('data-visible', 'true');
    expect(selected()).toBe(3);
  });

  it('releases playback and ownership on unmount', () => {
    enter();
    fireEvent.click(screen.getByRole('button', { name: 'Next record' }));
    finish('education-track');
    cleanup();
    advance(5000);
    expect(document.querySelector('[data-testid="education-stage"]')).toBeNull();
    expect(gsap.globalTimeline.getChildren().filter(animation => animation.isActive())).toHaveLength(0);
  });

  it('finishes the track, seals and every row within one second before unlocking in either direction', () => {
    enter();
    const track = screen.getByTestId('education-track');
    const next = screen.getByRole('button', { name: 'Next record' });
    const back = screen.getByRole('button', { name: 'Previous record' });
    let previous = 0;
    for (const index of [1, 2, 3, 2, 1, 0, 1]) {
      fireEvent.click(index > previous ? next : back);
      const timeline = gsap.getTweensOf(track)
        .find(tween => tween.parent !== gsap.globalTimeline)?.parent;
      if (!timeline) throw new Error('Education crossing timeline is missing');
      expect(timeline.duration()).toBe(1);

      finish('education-track', 0.99);
      advance(SCROLL_WAVE_IDLE_MS);
      wheel(500);
      fireEvent.click(next);
      fireEvent.click(back);
      expect(selected()).toBe(index);
      expect(next).toBeDisabled();
      expect(back).toBeDisabled();
      expect(screen.getByTestId('education-stage')).toHaveAttribute('data-phase', 'crossing');

      finish('education-track', 1);
      expect(screen.getByTestId('education-stage')).toHaveAttribute('data-phase', 'reading');
      for (const animation of timeline.getChildren()) {
        expect(animation.totalProgress()).toBe(1);
      }
      const record = track.querySelector(`[data-record="${index}"]`)!;
      for (const element of record.querySelectorAll<HTMLElement>(
        '[data-part="row"], [data-edu-glyph], [data-edu-word], [data-edu-text], [data-edu-art]'
      )) {
        expect(element.style.opacity).toBe('');
        expect(element.style.transform).toBe('');
        expect(element.style.filter).toBe('');
      }
      expect(record.querySelector('[data-edu-text-active]')).toBeNull();
      expect(screen.getByTestId('education-stage')).not.toHaveAttribute('data-reveal');
      if (index < 3) expect(next).toBeEnabled();
      else expect(next).toBeDisabled();
      if (index > 0) expect(back).toBeEnabled();
      else expect(back).toBeDisabled();
      previous = index;
    }
  });

  it('replays the incoming text and artwork whenever direction changes', () => {
    enter();
    const stage = screen.getByTestId('education-stage');
    let previous = 0;
    for (const index of [1, 0, 1, 2, 1, 0]) {
      fireEvent.click(screen.getByRole('button', {
        name: index > previous ? 'Next record' : 'Previous record',
      }));
      finish('education-track', 0.6);
      expect(stage).toHaveAttribute('data-phase', 'crossing');
      expect(stage).toHaveAttribute('data-reveal', 'true');
      expect(screen.getByRole('button', { name: 'Next record' })).toBeDisabled();
      const record = stage.querySelector(`[data-record="${index}"]`)!;
      const glyph = record.querySelector<HTMLElement>('[data-edu-glyph]');
      if (glyph) {
        expect(glyph.style.transform).not.toBe('');
        expect(Number(glyph.style.opacity)).toBeLessThan(1);
      } else {
        expect(record.querySelector('[data-part="title"] [data-edu-text-active]')).not.toBeNull();
      }
      const course = record.querySelector<HTMLElement>('[data-edu-role="course"]')!;
      if (index === 2) {
        expect(course).toHaveAttribute('data-edu-text', 'scan');
        expect(course.style.transform).toBe('');
        expect(course.style.clipPath).toBe('inset(0% 100% 0% 0%)');
        finish('education-track', 0.72);
        expect(course.style.clipPath).toBe('inset(0% 75% 0% 0%)');
        expect(screen.getByRole('button', { name: 'Next record' })).toBeDisabled();
      } else {
        const word = course.querySelector<HTMLElement>('[data-edu-word]')!;
        expect(word.style.transform).not.toBe('');
        expect(Number(word.style.opacity)).toBeLessThan(1);
      }
      finish('education-track');
      expect(stage).toHaveAttribute('data-phase', 'reading');
      expect(course.style.clipPath).toBe('');
      previous = index;
    }
  });

  it('does not add a pause when returning to a completed record or replay hidden input', () => {
    enter();
    wheel(120);
    finish('education-track');
    const hidden = vi.spyOn(document, 'hidden', 'get');
    hidden.mockReturnValue(true);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    advance(5000);
    wheel(120);
    expect(selected()).toBe(1);
    advance(SCROLL_WAVE_IDLE_MS);
    hidden.mockReturnValue(false);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(screen.getByRole('button', { name: 'Next record' })).toBeEnabled();
    wheel(120);
    expect(selected()).toBe(2);
  });

  it('keeps seal arrival transforms separate from the CSS hover targets', () => {
    enter();
    fireEvent.click(screen.getByRole('button', { name: 'Next record' }));
    finish('education-track', 0.5);
    const record = screen.getByTestId('education-track').querySelector('[data-record="1"]')!;
    for (const [motion, hover] of [
      [styles.sealDiscMotion, styles.sealDisc],
      [styles.sealRingMotion, styles.sealRing],
    ]) {
      const arrival = record.querySelector<HTMLElement>(`.${motion}`)!;
      const target = arrival.querySelector<HTMLElement | SVGElement>(`.${hover}`)!;
      expect(arrival.style.transform).not.toBe('');
      expect(target.style.transform).toBe('');
      expect(gsap.getTweensOf(target)).toHaveLength(0);
    }
  });

  it('pauses the opening animation while hidden and resumes without adding a reading lock', () => {
    mount();
    const timeline = gsap.getTweensOf(screen.getByTestId('education-sticky-header'))
      .find(tween => tween.parent !== gsap.globalTimeline)?.parent;
    if (!timeline) throw new Error('Education opening timeline is missing');
    const hidden = vi.spyOn(document, 'hidden', 'get');
    hidden.mockReturnValue(true);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(timeline.paused()).toBe(true);
    advance(5000);
    wheel(500);
    expect(selected()).toBe(0);
    expect(screen.getByTestId('education-stage')).toHaveAttribute('data-phase', 'opening');
    hidden.mockReturnValue(false);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(timeline.paused()).toBe(false);
    advance(SCROLL_WAVE_IDLE_MS);
    finish('education-sticky-header');
    expect(screen.getByRole('button', { name: 'Next record' })).toBeEnabled();
    wheel(500);
    expect(selected()).toBe(1);
  });

  it('lands on Skills rather than skipping later sections after a forward flick under Education', () => {
    const navigate = vi.fn();
    enter(navigate);
    for (let index = 1; index < 4; index++) {
      fireEvent.click(screen.getByRole('button', { name: 'Next record' }));
      finish('education-track');
    }
    place(-100000);
    wheel(120);
    expect(navigate).toHaveBeenCalledExactlyOnceWith('skills');
  });

  it('settles a natural landing at completion after momentum interrupts its initial glide', () => {
    const navigate = vi.fn((target: string) => publishSectionNavigation(target));
    enter(navigate);
    for (let index = 1; index < 4; index++) {
      fireEvent.click(screen.getByRole('button', { name: 'Next record' }));
      finish('education-track');
    }
    wheel(120);
    for (let event = 0; event < 18; event++) {
      advance(24);
      wheel(80);
    }
    expect(navigate).toHaveBeenCalledExactlyOnceWith('skills');
    finish('education-stage');
    expect(navigate).toHaveBeenLastCalledWith('skills', { immediate: true });
    expect(navigate).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('education-stage')).not.toHaveAttribute('data-visible');
  });

  it('never replaces explicit navigation during a natural departure with its pending landing', () => {
    const navigate = vi.fn();
    enter(navigate);
    for (let index = 1; index < 4; index++) {
      fireEvent.click(screen.getByRole('button', { name: 'Next record' }));
      finish('education-track');
    }
    wheel(120);
    act(() => publishSectionNavigation('contact'));
    finish('education-stage');
    expect(navigate).toHaveBeenCalledExactlyOnceWith('skills');
  });

  it('does not scroll down to About when the reader has already scrolled back above Education', () => {
    const navigate = vi.fn();
    enter(navigate);
    place(2000);
    wheel(-120);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('honors explicit section navigation as soon as the current crossing completes', () => {
    enter();
    fireEvent.click(screen.getByRole('button', { name: 'Next record' }));
    act(() => publishSectionNavigation('contact'));
    expect(screen.getByTestId('education-stage')).toHaveAttribute('data-visible', 'true');
    expect(screen.getByTestId('education-stage')).toHaveAttribute('data-phase', 'crossing');
    finish('education-track');
    expect(screen.getByTestId('education-stage')).toHaveAttribute('data-phase', 'closing');
    finish('education-stage');
    expect(screen.getByTestId('education-stage')).not.toHaveAttribute('data-visible', 'true');
    place(-100000);
    advance(5000);
    expect(screen.getByTestId('education-stage')).not.toHaveAttribute('data-visible', 'true');
  });

  it.each(['opening', 'reading', 'crossing', 'closing'])(
    'navbar navigation releases Education immediately during %s without a stale landing', phase => {
      const navigate = vi.fn();
      mount(true, navigate);
      if (phase !== 'opening') finish('education-sticky-header');
      if (phase === 'crossing') fireEvent.click(screen.getByRole('button', { name: 'Next record' }));
      if (phase === 'closing') wheel(-120);
      const panel = screen.getByTestId('education-stage');
      expect(panel).toHaveAttribute('data-phase', phase);
      const before = navigate.mock.calls.length;
      act(() => publishSectionNavigation('contact', { source: 'navbar' }));
      expect(panel).toHaveAttribute('data-phase', 'outside');
      expect(panel).not.toHaveAttribute('data-visible');
      expect(panel).not.toHaveAttribute('data-reveal');
      expect(document.querySelector('[data-education-covered]')).toBeNull();
      expect(document.getElementById('about')).not.toHaveAttribute('data-education-owned');
      expect(document.getElementById('about')).not.toHaveAttribute('data-education-released');
      expect(document.querySelector('[data-edu-text-active]')).toBeNull();
      advance(3000);
      expect(panel).not.toHaveAttribute('data-visible');
      expect(navigate).toHaveBeenCalledTimes(before);
    },
  );

  it('preserves natural reverse entry after a navbar skip', () => {
    mount();
    act(() => publishSectionNavigation('skills', { source: 'navbar' }));
    place(-2100);
    advance(SCROLL_WAVE_IDLE_MS + 1);
    wheel(-120);
    expect(screen.getByTestId('education-stage')).toHaveAttribute('data-phase', 'opening');
    expect(selected()).toBe(3);
    finish('education-sticky-header');
    fireEvent.click(screen.getByRole('button', { name: 'Previous record' }));
    expect(screen.getByTestId('education-stage')).toHaveAttribute('data-phase', 'crossing');
    finish('education-track');
    expect(selected()).toBe(2);
  });

  it('releases the About title on reverse completion without replaying in-flight requests', () => {
    const navigate = vi.fn();
    mount(true, navigate);
    const about = document.getElementById('about')!;
    about.getBoundingClientRect = () =>
      DOMRect.fromRect({ x: 0, y: -1600, width: 1440, height: 4600 });
    expect(screen.getByTestId('education-rail').getBoundingClientRect().top).toBeGreaterThan(0);
    finish('education-sticky-header');
    wheel(-120);
    expect(navigate).toHaveBeenCalledExactlyOnceWith('about');
    expect(screen.getByTestId('education-stage')).toHaveAttribute('data-phase', 'closing');
    expect(about).toHaveAttribute('data-education-owned', 'true');
    advance(SCROLL_WAVE_IDLE_MS);
    wheel(120);
    finish('education-sticky-header', 0);
    expect(navigate).toHaveBeenLastCalledWith('about', { immediate: true });
    expect(about).not.toHaveAttribute('data-education-owned');
    expect(screen.getByTestId('education-stage')).toHaveAttribute('data-phase', 'outside');
    place(-20);
    expect(screen.getByTestId('education-stage')).not.toHaveAttribute('data-visible', 'true');
  });

  it('aligns a direct handoff back to About without a navigation callback', () => {
    mount();
    document.getElementById('about')!.getBoundingClientRect = () =>
      DOMRect.fromRect({ x: 0, y: -1600, width: 1440, height: 4600 });
    finish('education-sticky-header');
    wheel(-120);
    expect(window.scrollBy).toHaveBeenCalledExactlyOnceWith({ top: -1600, behavior: 'auto' });
  });

  it('aligns button-only reading with Skills instead of exposing an empty education rail', () => {
    const navigate = vi.fn();
    enter(navigate);
    for (let index = 1; index < 4; index++) {
      fireEvent.click(screen.getByRole('button', { name: 'Next record' }));
      finish('education-track');
    }
    wheel(120);
    expect(navigate).toHaveBeenCalledExactlyOnceWith('skills');
  });

  it('opens the last record on an upward wave when reentering from Skills', () => {
    enter();
    for (let index = 1; index < 4; index++) {
      fireEvent.click(screen.getByRole('button', { name: 'Next record' }));
      finish('education-track');
    }
    place(-100000);
    wheel(120);
    finish('education-stage');
    advance(300);
    place(-2100);
    wheel(-120);
    expect(screen.getByTestId('education-stage')).toHaveAttribute('data-phase', 'opening');
    expect(screen.getByTestId('education-stage')).toHaveAttribute('data-active-record', '3');
    finish('education-sticky-header', 0.6);
    expect(screen.getByTestId('education-stage')).toHaveAttribute('data-reveal', 'true');
    const returningCopy = screen.getByTestId('education-track').querySelector<HTMLElement>(
      '[data-record="3"] [data-edu-role="course"] [data-edu-word]'
    )!;
    expect(returningCopy.style.transform).toContain('rotateZ(');
    expect(Number(returningCopy.style.opacity)).toBeLessThan(1);
    finish('education-sticky-header');
    wheel(-120);
    expect(selected()).toBe(3);
    advance(SCROLL_WAVE_IDLE_MS);
    wheel(-120);
    expect(selected()).toBe(2);
  });

  it.each(['home', 'about'])('starts a fresh Education chapter after explicit %s navigation', async target => {
    enter();
    for (let index = 1; index < 4; index++) {
      fireEvent.click(screen.getByRole('button', { name: 'Next record' }));
      finish('education-track');
    }
    wheel(120);
    finish('education-stage');
    act(() => publishSectionNavigation(target));
    expect(selected()).toBe(0);
    const about = document.getElementById('about')!;
    await act(async () => { about.removeAttribute('data-title-settled'); });
    advance(SCROLL_WAVE_IDLE_MS);
    wheel(120);
    await act(async () => { about.dataset.titleSettled = 'true'; });
    expect(screen.getByTestId('education-stage')).toHaveAttribute('data-phase', 'opening');
    expect(screen.getByTestId('education-stage')).toHaveAttribute('data-active-record', '0');
  });

  it('publishes completed forward release and waits for Skills to release its return', async () => {
    const skills = document.createElement('section');
    skills.id = 'skills';
    document.body.appendChild(skills);
    try {
      enter();
      for (let index = 1; index < 4; index++) {
        fireEvent.click(screen.getByRole('button', { name: 'Next record' }));
        finish('education-track');
      }
      const about = document.getElementById('about')!;
      wheel(120);
      expect(about).not.toHaveAttribute('data-education-released');
      finish('education-stage');
      expect(about).toHaveAttribute('data-education-released', 'true');
      skills.dataset.skillsActive = 'true';
      advance(SCROLL_WAVE_IDLE_MS);
      place(-2100);
      wheel(-120);
      expect(screen.getByTestId('education-stage')).toHaveAttribute('data-phase', 'outside');
      await act(async () => { skills.removeAttribute('data-skills-active'); });
      expect(screen.getByTestId('education-stage')).toHaveAttribute('data-phase', 'opening');
      expect(about).not.toHaveAttribute('data-education-released');
      finish('education-sticky-header');
      cleanup();
      expect(about).not.toHaveAttribute('data-education-released');
    } finally {
      skills.remove();
    }
  });
});
