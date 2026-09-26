import { ArrowUpRight } from 'lucide-react';
import { IMAGE_KIND_LABEL, type Project, type ProjectEvidence as Evidence } from '@/data/projects';
import styles from './ProjectEvidence.module.css';

/** What the preview image is -- for every project -- and anything more it needs said. */
export function ProjectVisualNote({ project }: { project: Pick<Project, 'imageKind' | 'imageNote'> }) {
  return (
    <p className={styles.visualNote} data-project-visual-note="" data-image-kind={project.imageKind}>
      {IMAGE_KIND_LABEL[project.imageKind]}{project.imageNote ? ` · ${project.imageNote}` : ''}
    </p>
  );
}

export function ProjectEvidence({ evidence }: { evidence: Evidence }) {
  return (
    <div className={styles.notes} data-project-evidence="">
      <section>
        <h4>What to inspect</h4>
        <p>{evidence.inspect}</p>
        {evidence.access && <p className={styles.access}>{evidence.access}</p>}
        {evidence.sourceNote && <p className={styles.access}>{evidence.sourceNote}</p>}
      </section>
      {(evidence.role || evidence.decision) && <section>
        <h4>Implementation</h4>
        {evidence.role && <p className={styles.role} data-project-role="">{evidence.role}</p>}
        {evidence.decision && <p>{evidence.decision.summary}</p>}
        {evidence.decision?.sourceUrl && <a href={evidence.decision.sourceUrl} target="_blank" rel="noopener noreferrer"
          onClick={event => event.stopPropagation()}>
          {evidence.decision.sourceLabel} <ArrowUpRight size="1em" aria-hidden="true" />
        </a>}
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
