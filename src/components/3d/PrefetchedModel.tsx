import { useEffect, type ReactNode } from 'react';
import { markCriticalModelReady, readCriticalModel } from '@/lib/assets/criticalAssets';

/** Place inside the consumer's existing Suspense, with no inner boundary. */
export function PrefetchedModel({ url, children }: { url: string; children: ReactNode }) {
  readCriticalModel(url);
  useEffect(() => markCriticalModelReady(url), [url]);
  return children;
}
