import { cachedElement } from '@/lib/dom/cachedElement';
import { getContactView } from '@/lib/contact/contactScene';
import { getProjectsView } from '@/lib/projects/projectsScene';
import { isWorldOccluded } from '@/lib/render/frameGate';
import { getIslandReadiness } from './islandSecret';

const projectsStage = cachedElement(() => document.querySelector<HTMLElement>('[data-testid="projects-stage"]'));

/** Shared exposure, not membership in the Hero's covered/inert subtree. */
export function isIslandExposed(): boolean {
  const ready = getIslandReadiness();
  const projects = getProjectsView();
  if (!ready.layout || document.hidden || isWorldOccluded() || getContactView().mode !== 'outside') return false;
  if (projects.active && (!['revealed', 'framed'].includes(projectsStage()?.dataset.phase ?? '') ||
      (projects.turn > 0 && projects.turn < 1) || projects.approach > 0)) return false;
  return ready.hero || projects.active;
}
