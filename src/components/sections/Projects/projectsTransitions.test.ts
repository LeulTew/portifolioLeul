import { describe, expect, it } from 'vitest';
import type { ProjectsPhase } from '@/lib/projects/projectsScene';
import {
  PROJECTS_ENTRY_EDGE, PROJECTS_STEPS, projectsEntry, projectsStep,
  type ProjectsEntryReading, type ProjectsRest,
} from './projectsTransitions';

const RESTS = Object.keys(PROJECTS_STEPS) as ProjectsRest[];

describe('what a request does from each phase the TV rests in', () => {
  it('moves one axis per request, through a moving phase, to the next rest', () => {
    expect(projectsStep('framed', 1)).toEqual({ kind: 'move', axis: 'approach', to: 1, via: 'approaching', rest: 'reading' });
    expect(projectsStep('framed', -1)).toEqual({ kind: 'move', axis: 'turn', to: 0, via: 'unturning', rest: 'revealed' });
    expect(projectsStep('reading', -1)).toEqual({ kind: 'move', axis: 'approach', to: 0, via: 'retreating', rest: 'framed' });
    expect(projectsStep('revealed', 1)).toEqual({ kind: 'move', axis: 'turn', to: 1, via: 'turning', rest: 'framed' });
    expect(projectsStep('reading', 1)).toEqual({ kind: 'depart' });
    expect(projectsStep('revealed', -1)).toEqual({ kind: 'leave', to: 'skills' });
  });

  it('takes no request while the TV moves or is away', () => {
    // The contract's "nothing stacks": a request mid-movement is not queued as a second one.
    const moving: ProjectsPhase[] = ['outside', 'withdrawing', 'turning', 'approaching', 'retreating', 'unturning', 'departing'];
    for (const phase of moving) {
      expect(projectsStep(phase, 1), phase).toBeNull();
      expect(projectsStep(phase, -1), phase).toBeNull();
    }
  });

  it('mirrors every forward movement with the reverse one', () => {
    // Scroll choreography contract: reverse mirrors forward, on the same axis, back to the same rest.
    for (const from of RESTS) {
      for (const direction of ['forward', 'back'] as const) {
        const step = PROJECTS_STEPS[from][direction];
        if (step.kind !== 'move') continue;
        const reverse = PROJECTS_STEPS[step.rest][direction === 'forward' ? 'back' : 'forward'];
        expect(reverse, `${from} ${direction}`).toMatchObject({ kind: 'move', axis: step.axis, to: 1 - step.to, rest: from });
      }
    }
  });

  it('passes through moving phases only, never resting mid-movement', () => {
    for (const from of RESTS) {
      for (const step of Object.values(PROJECTS_STEPS[from])) {
        if (step.kind === 'move') expect(RESTS).not.toContain(step.via);
      }
    }
  });
});

describe('when the TV claims the view', () => {
  const reading = (overrides: Partial<ProjectsEntryReading>): ProjectsEntryReading => ({
    side: 'before', wave: 'down', top: 400, height: 2400, viewportHeight: () => 900, skillsHolding: false, ...overrides,
  });

  it('enters from Skills once the rail reaches the top edge on a forward wave', () => {
    expect(projectsEntry(reading({ top: PROJECTS_ENTRY_EDGE + 1 }))).toBeNull();
    expect(projectsEntry(reading({ top: PROJECTS_ENTRY_EDGE }))).toBe('skills');
    expect(projectsEntry(reading({ top: -50, wave: null }))).toBe('skills');
    expect(projectsEntry(reading({ top: 0, wave: 'up' }))).toBeNull();
  });

  it('waits for Skills to release the view', () => {
    expect(projectsEntry(reading({ top: 0, skillsHolding: true }))).toBeNull();
  });

  it('enters from Contact once the rail reaches the bottom edge on an upward wave', () => {
    const after = { side: 'after' as const, top: -2400 + 900 - PROJECTS_ENTRY_EDGE, height: 2400 };
    expect(projectsEntry(reading({ ...after, wave: 'up' }))).toBe('contact');
    expect(projectsEntry(reading({ ...after, top: after.top - 1, wave: 'up' }))).toBeNull();
    expect(projectsEntry(reading({ ...after, wave: 'down' }))).toBeNull();
    expect(projectsEntry(reading({ ...after, wave: null }))).toBeNull();
  });

  it('reads the window height only past the chapter, where it is needed', () => {
    // Reading innerHeight can force layout, and entry is judged on every scroll publication.
    let reads = 0;
    const viewportHeight = () => { reads++; return 900; };
    projectsEntry(reading({ top: 0, viewportHeight }));
    projectsEntry(reading({ top: 500, viewportHeight }));
    expect(reads).toBe(0);
    projectsEntry(reading({ side: 'after', wave: 'up', top: -1600, viewportHeight }));
    expect(reads).toBe(1);
  });

  it('never enters a rail that has no height yet', () => {
    expect(projectsEntry(reading({ top: 0, height: 0 }))).toBeNull();
    expect(projectsEntry(reading({ side: 'after', wave: 'up', top: 0, height: 0 }))).toBeNull();
  });
});
