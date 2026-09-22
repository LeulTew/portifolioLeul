import { ArrowUpRight } from 'lucide-react';
import type { Project, ProjectEvidence as Evidence } from '@/data/projects';
import styles from './ProjectEvidence.module.css';

export function ProjectEvidence({ evidence }: { evidence: Evidence }) {
  return (
    <div className={styles.notes} data-project-evidence="">
      <section>
        <h4>What to inspect</h4>
        <p>{evidence.inspect}</p>
        {evidence.access && <p className={styles.access}>{evidence.access}</p>}
        {evidence.sourceNote && <p className={styles.access}>{evidence.sourceNote}</p>}
      </section>
      {evidence.decision && <section>
        <h4>Implementation</h4>
        <p>{evidence.decision.summary}</p>
        <a href={evidence.decision.sourceUrl} target="_blank" rel="noopener noreferrer"
          onClick={event => event.stopPropagation()}>
          {evidence.decision.sourceLabel} <ArrowUpRight size="1em" aria-hidden="true" />
        </a>
      </section>}
    </div>
  );
}

export function ProjectVisualLink({ project, shortLabel = false }: {
  project: Pick<Project, 'title' | 'image'>;
  shortLabel?: boolean;
}) {
  return (
    <a className={styles.visualLink} href={project.image} target="_blank" rel="noopener noreferrer"
      aria-label={`Open ${project.title} portfolio image at full size (new tab)`}
      data-project-visual="" onClick={event => event.stopPropagation()}>
      {shortLabel ? 'Full image' : 'Full-size portfolio image'} <ArrowUpRight size="1em" aria-hidden="true" />
    </a>
  );
}
