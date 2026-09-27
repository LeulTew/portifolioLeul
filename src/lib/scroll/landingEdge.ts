/**
 * Whether a navigation lands on a chapter's own top edge rather than 80px above
 * it, the navbar's clearance.
 *
 * Laid out linearly -- reduced motion, a compact window, the flat page -- Skills
 * already sits well clear of the navbar inside its own padding, and the 80px
 * above it belonged to the chapter before: Education's green, a band under the
 * navbar over the top of Skills (round 35, D-R35-001). A chapter asks for this
 * with `data-landing-edge="own"`, and only while it is not staged: a staged
 * chapter's entry is measured from the ordinary landing.
 */
export function landsOnOwnEdge(section: HTMLElement): boolean {
  return section.dataset.landingEdge === 'own' && section.dataset.staged !== 'true';
}
