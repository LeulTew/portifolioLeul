/**
 * Which refused responses a native-scroll pass may excuse.
 *
 * The 900x560 form pass fails every off-origin request while it sends, so no
 * message can ever leave, and counts those itself. Only those are excused, and
 * only while it was failing them: an off-origin failure before or after the
 * send is a failure of the page (round 41, TECH-091).
 */
export interface RefusedRequest {
  url: string;
  reason: string;
}

export interface ExcusedWindow {
  /** Index of the first refusal recorded once requests began to be failed. */
  from: number;
  /** Index past the last refusal recorded before they stopped being failed. */
  to: number;
  /** The addresses (origin and path) the pass failed. */
  addresses: Set<string>;
}

/** An address as origin and path, the way the pass records what it failed. */
export function requestAddress(url: string): string {
  try {
    const at = new URL(url);
    return at.origin + at.pathname;
  } catch {
    return url;
  }
}

export function unexcusedRefusals(refused: readonly RefusedRequest[], excused?: ExcusedWindow): RefusedRequest[] {
  return refused.filter(({ url }, index) => !excused ||
    index < excused.from || index >= excused.to || !excused.addresses.has(requestAddress(url)));
}
