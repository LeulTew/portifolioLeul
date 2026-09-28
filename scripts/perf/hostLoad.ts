/**
 * How busy the machine was, so every perf report carries the load it was
 * measured under. Other sessions share this host; a report without its load
 * read as certification when it was not (round 41).
 *
 * From the operating system's per-core time counters: load averages are
 * always zero on Windows.
 */
import { cpus } from 'node:os';

export interface CpuTimes {
  idle: number;
  total: number;
}

type CoreTimes = { times: { user: number; nice: number; sys: number; idle: number; irq: number } };

export function cpuTimes(read: () => CoreTimes[] = cpus): CpuTimes {
  let idle = 0;
  let total = 0;
  for (const { times } of read()) {
    idle += times.idle;
    total += times.user + times.nice + times.sys + times.idle + times.irq;
  }
  return { idle, total };
}

/** The share of every core's time spent busy between two readings, in whole percent; null if none passed. */
export function busyPercent(from: CpuTimes, to: CpuTimes): number | null {
  const total = to.total - from.total;
  if (!(total > 0)) return null;
  return Math.round(Math.min(1, Math.max(0, 1 - (to.idle - from.idle) / total)) * 100);
}

/** Busy share over a short window of this process doing nothing: the load of everything else. */
export async function measureBusy(milliseconds: number, read: () => CoreTimes[] = cpus): Promise<number | null> {
  const from = cpuTimes(read);
  await new Promise(done => setTimeout(done, milliseconds));
  return busyPercent(from, cpuTimes(read));
}
