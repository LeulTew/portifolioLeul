import type { SectionNavigate } from '@/lib/scroll/sectionNavigation';
import { FlatProjects } from './FlatProjects';
import { TVProjects } from './TVProjects';

export function Projects({
  theme, spatial = false, onNavigate,
}: {
  theme?: string;
  spatial?: boolean;
  onNavigate?: SectionNavigate;
}) {
  return spatial
    ? <TVProjects onNavigate={onNavigate} />
    : <FlatProjects theme={theme} />;
}
