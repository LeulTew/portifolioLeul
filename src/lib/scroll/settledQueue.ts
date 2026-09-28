/**
 * Work that has to land on the page the track is being rebuilt into.
 *
 * Content that grows at the reader's place -- a failed send's notice, a blank
 * send's field errors -- is followed by a reveal of what grew. The same growth
 * rebuilds drei's track 120ms later, and the rebuild restores the reader's
 * place as it was sampled before the growth: the reveal was made and then
 * undone, and the notice sat below the window (round 37). A reveal asked for
 * while a rebuild is owed waits for it, as a navbar choice made during one is
 * taken again after it.
 */
export interface SettledQueue {
  /** Runs now when nothing is owed, else once the rebuild owed has landed. */
  whenSettled(run: () => void): void;
  /** Called every frame: releases the queue, outside the frame, once nothing is owed. */
  flush(): void;
  clear(): void;
}

export function createSettledQueue(owed: () => boolean): SettledQueue {
  let runs: Array<() => void> = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  return {
    whenSettled(run) {
      // Behind anything already waiting, so the latest request still lands last.
      if (!runs.length && !owed()) run();
      else runs.push(run);
    },
    flush() {
      if (!runs.length || timer !== null || owed()) return;
      timer = setTimeout(() => {
        timer = null;
        // A newer change owes another rebuild: the next frame's flush takes them after it.
        if (owed()) return;
        const due = runs;
        runs = [];
        for (const run of due) run();
      }, 0);
    },
    clear() {
      runs = [];
      if (timer !== null) clearTimeout(timer);
      timer = null;
    },
  };
}
