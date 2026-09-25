/**
 * Which chapter holds the view while the story beneath it is inert.
 *
 * Skills' pinned stage and the TV each take the whole window and leave the
 * story's `main` inert behind them. Each used to decide on its own whether it
 * had set that flag: Skills from whether `main` was inert when its effect
 * started, the TV from whether it found `main` already inert. So the TV could
 * find Skills' flag and never own one, then Skills leaving reopened the story
 * under the TV; and a motion-preference roundtrip remounted Skills while the
 * TV held `main`, so Skills never took the flag at all and focus fell back to
 * the covered native track (round 9, TECH-006 and TECH-027).
 *
 * Now every owner holds a claim. The story is inert exactly while any claim
 * on it stands (and stays so if something else made it inert first), and the
 * newest standing claim names the chapter on screen.
 */

export type ViewChapter = 'skills' | 'projects';

interface Claim {
  readonly chapter: ViewChapter;
  readonly story: HTMLElement | null;
}

const claims: Claim[] = [];
/** Stories this module made inert, so a flag it did not set is never removed. */
const heldByClaims = new Set<HTMLElement>();

function sync(story: HTMLElement) {
  const claimed = claims.some(claim => claim.story === story);
  if (claimed && !story.hasAttribute('inert')) {
    story.setAttribute('inert', '');
    heldByClaims.add(story);
  } else if (!claimed && heldByClaims.delete(story)) {
    story.removeAttribute('inert');
  }
}

/**
 * Claims the view for `chapter`, making `story` inert while the claim stands.
 * Returns the release, which is idempotent.
 */
export function claimView(chapter: ViewChapter, story: HTMLElement | null): () => void {
  const claim: Claim = { chapter, story };
  claims.push(claim);
  if (story) sync(story);
  return () => {
    const index = claims.indexOf(claim);
    if (index < 0) return;
    claims.splice(index, 1);
    if (story) sync(story);
  };
}

/** The chapter whose reader holds the view, newest claim first; null while none does. */
export function viewOwner(): ViewChapter | null {
  return claims.at(-1)?.chapter ?? null;
}
