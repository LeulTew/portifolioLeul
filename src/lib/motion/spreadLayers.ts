import type { SequenceLayer } from '@/components/ui/PinnedSequence';

/**
 * Windows for a run of items sharing a stretch of scroll.
 *
 * Written rather than hand-listed because the items come from data: a
 * hand-tuned list silently stops covering the stretch the moment an entry is
 * added, leaving either a gap at the end or an item that never appears.
 *
 * Windows overlap by `overlap` of their own length, so one item is still
 * leaving as the next arrives. Butt-jointed windows leave a moment with
 * nothing on screen at every handover, which reads as a stall rather than a
 * sequence.
 */
export function spreadLayers(
  names: readonly string[],
  from: number,
  to: number,
  overlap = 0.35
): SequenceLayer[] {
  if (names.length === 0) return [];
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return [];

  const clampedOverlap = Math.min(Math.max(overlap, 0), 0.9);
  const span = to - from;
  // n windows with (n - 1) overlapping joins.
  const width = span / (names.length - clampedOverlap * (names.length - 1));
  const step = width * (1 - clampedOverlap);

  return names.map((name, index) => {
    const start = from + step * index;
    return {
      name,
      start,
      end: Math.min(start + width, to),
      // Long enough to be a resolve rather than a switch, short enough that an
      // item is fully up for part of its own window.
      feather: width * 0.34,
    };
  });
}
