export function isProjectsReadingTarget(target: EventTarget | null): boolean {
  return target instanceof Element &&
    !!target.closest('[data-projects-display], [data-projects-tabs], [data-tv-controls]');
}
