import type { ScrollDirection } from '@/lib/scroll/scrollGesture';
import type { ProjectsPhase } from '@/lib/projects/projectsScene';

/**
 * The TV chapter's decisions, apart from the effect that carries them out:
 * what a reader's request does from each phase the TV rests in, and when the
 * TV claims the view. Pure and typed, so the choreography contract --
 * one movement per request, reverse mirroring forward -- is checked here
 * rather than inferred from a 380-line effect (round 8, TECH-006).
 */

/** The phases the TV rests in, waiting for the reader's next request. */
export type ProjectsRest = 'framed' | 'reading' | 'revealed';

/** What one request from a resting phase does. */
export type ProjectsStep =
  /** One camera movement on one axis, through a moving phase, to the next rest. */
  | { kind: 'move'; axis: 'turn' | 'approach'; to: 0 | 1; via: ProjectsPhase; rest: ProjectsRest }
  /** Pull back from the screen and fly on to Contact. */
  | { kind: 'depart' }
  /** Hand the view back to Skills. */
  | { kind: 'leave'; to: 'skills' };

export const PROJECTS_STEPS: Readonly<Record<ProjectsRest, Readonly<Record<'forward' | 'back', ProjectsStep>>>> = {
  framed: {
    forward: { kind: 'move', axis: 'approach', to: 1, via: 'approaching', rest: 'reading' },
    back: { kind: 'move', axis: 'turn', to: 0, via: 'unturning', rest: 'revealed' },
  },
  reading: {
    forward: { kind: 'depart' },
    back: { kind: 'move', axis: 'approach', to: 0, via: 'retreating', rest: 'framed' },
  },
  revealed: {
    forward: { kind: 'move', axis: 'turn', to: 1, via: 'turning', rest: 'framed' },
    back: { kind: 'leave', to: 'skills' },
  },
};

const isRest = (phase: ProjectsPhase): phase is ProjectsRest =>
  phase === 'framed' || phase === 'reading' || phase === 'revealed';

/** What a request in `direction` does from `phase`; nothing while the TV is moving or away. */
export function projectsStep(phase: ProjectsPhase, direction: -1 | 1): ProjectsStep | null {
  return isRest(phase) ? PROJECTS_STEPS[phase][direction > 0 ? 'forward' : 'back'] : null;
}

/** How near a window edge the rail has to come, in CSS pixels, for the TV to claim the view. */
export const PROJECTS_ENTRY_EDGE = 96;

export interface ProjectsEntryReading {
  /** Which side of the chapter the reader is on. */
  side: 'before' | 'after';
  /** The direction of the reader's current gesture wave, if any. */
  wave: ScrollDirection | null;
  /** The rail's box in the window. */
  top: number;
  height: number;
  /**
   * The window's height, asked for only past the chapter: reading it can
   * force layout, and this runs on every scroll publication.
   */
  viewportHeight: () => number;
  /** Skills still holds the view and has not released it to the TV. */
  skillsHolding: boolean;
  /** Where Contact, the chapter after the rail, begins in the window; the stretch between them is the TV's. */
  nextTop?: number;
}

/**
 * Whether the TV claims the view, and from which side: from Skills once the
 * rail reaches the top edge on a forward wave, from Contact once it reaches
 * the bottom edge on an upward one -- or once Contact has all but left the
 * window. At 900x560 a wheel back from Contact took its form out of view
 * 80px before the rail's edge arrived, and the page rested on empty sky
 * (round 16, D-UX-004).
 */
export function projectsEntry(reading: ProjectsEntryReading): 'skills' | 'contact' | null {
  const { side, wave, top, height, viewportHeight, skillsHolding, nextTop } = reading;
  if (height <= 0) return null;
  if (side === 'after') {
    if (wave !== 'up') return null;
    const edge = viewportHeight() - PROJECTS_ENTRY_EDGE;
    return top + height >= edge || (nextTop !== undefined && nextTop >= edge) ? 'contact' : null;
  }
  if (top > PROJECTS_ENTRY_EDGE || wave === 'up' || skillsHolding) return null;
  return 'skills';
}
