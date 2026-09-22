import {
  useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent,
  type PointerEvent, type WheelEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, ArrowUpRight, ChevronDown, ChevronUp } from 'lucide-react';
import { ControlButton } from '@/components/ui/ControlButton';
import { usePrefersReducedMotion } from '@/lib/gateways/animationGateway';
import { useTVScreenReady } from '@/lib/projects/projectsScene';
import { useAvatarEncounterPresenting } from '@/lib/avatar/avatarEncounter';
import { registerTVReader, setTVPagingAvailable, useTVState } from '@/lib/tv/tvState';
import type { SectionNavigate } from '@/lib/scroll/sectionNavigation';
import { findScrollContainer, scrollContainerBy } from '../About/EducationRail/scrollContainer';
import { projectsData, type Project } from '@/data/projects';
import { useProjectsFits, useProjectsPlayback } from './useProjectsPlayback';
import { PROJECT_CATEGORIES } from './projectCategories';
import { isProjectsReadingTarget } from './projectsInput';
import { ProjectWheelPaging } from './projectPaging';
import { useCRTPowerOn, useProjectBroadcast } from './projectBroadcast';
import { ProjectEvidence, ProjectVisualLink } from './ProjectEvidence';
import styles from './TVProjects.module.css';

function ProjectDescription({ project }: { project: Project }) {
  return (project.longDescription || project.description).split('\n')
    .filter(line => line.trim())
    .map((line, index) => (
      <p key={index}>
        {line.split(/(\*\*.*?\*\*)/g).map((part, partIndex) =>
          part.startsWith('**') && part.endsWith('**')
            ? <strong key={partIndex}>{part.slice(2, -2)}</strong> : part)}
      </p>
    ));
}

function ProjectImage({ project }: { project: Project }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  return failed
    ? <div className={styles.imageFallback} role="img" aria-label={`${project.title}: preview unavailable`}>
        <span>{project.title}</span>
        <p>Preview unavailable. Project details and links are still available.</p>
      </div>
    : <>
        {!loaded && <span className={styles.imageLoading} aria-hidden="true">Loading preview</span>}
        <img
          src={project.image} alt={`${project.title} preview`} width={960} height={720}
          aria-busy={!loaded} decoding="async" draggable={false}
          onLoad={() => setLoaded(true)} onError={() => setFailed(true)}
        />
      </>;
}

export function TVProjects({ onNavigate }: { onNavigate?: SectionNavigate }) {
  const host = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const display = useRef<HTMLDivElement>(null);
  const broadcast = useRef<HTMLDivElement>(null);
  const paging = useRef<ProjectWheelPaging | null>(null);
  if (paging.current === null) paging.current = new ProjectWheelPaging();
  const detailsButton = useRef<HTMLButtonElement>(null);
  const sceneControl = useRef<{ element: HTMLButtonElement; enterScreen: boolean } | null>(null);
  const pointer = useRef<{ x: number; y: number; id: number } | null>(null);
  const [{ category, index }, setSelection] = useState({ category: 'All', index: 0 });
  const [details, setDetails] = useState(false);
  const available = useTVScreenReady();
  const fits = useProjectsFits();
  const reduced = usePrefersReducedMotion();
  const avatarPresenting = useAvatarEncounterPresenting();
  const television = useTVState();
  const staged = available && fits;
  const { phase, visible, ready, step } = useProjectsPlayback({ host, stage, surface }, staged, reduced, onNavigate);
  const interactive = !staged || ready;
  const hardwarePaging = staged && ready && television.layout === 'all';
  const filtered = useMemo(() => category === 'All'
    ? projectsData : projectsData.filter(project => project.categories.includes(category)), [category]);
  const project = filtered[index % Math.max(filtered.length, 1)];
  const activeTab = PROJECT_CATEGORIES.findIndex(value => value === category);
  useCRTPowerOn(display, staged && ready, reduced);
  useProjectBroadcast(broadcast, project?.id ?? 0, interactive, reduced, details);

  const selectCategory = (value: string) => {
    if (!interactive) return;
    setSelection({ category: value, index: 0 });
    setDetails(false);
    paging.current?.reset();
  };
  const selectProject = useCallback((direction: -1 | 1) => {
    if (!interactive) return;
    setSelection(previous => {
      const count = previous.category === 'All' ? projectsData.length
        : projectsData.filter(project => project.categories.includes(previous.category)).length;
      if (count < 2) return previous;
      return { ...previous, index: (previous.index + direction + count) % count };
    });
    setDetails(false);
    paging.current?.reset();
  }, [interactive]);
  const tabsKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!interactive || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;
    const next = (activeTab + (event.key === 'ArrowRight' ? 1 : -1) + PROJECT_CATEGORIES.length) %
      PROJECT_CATEGORIES.length;
    selectCategory(PROJECT_CATEGORIES[next]);
    event.currentTarget.querySelector<HTMLButtonElement>(`#project-category-${next}`)?.focus({ preventScroll: true });
  };
  const readerKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && details) {
      setDetails(false);
      detailsButton.current?.focus({ preventScroll: true });
      return;
    }
    if (event.target instanceof Element && event.target !== event.currentTarget &&
        event.target.closest('button, a, input, textarea, select, [contenteditable], [data-projects-scrollable]')) return;
    if (event.key === 'ArrowLeft') selectProject(-1);
    else if (event.key === 'ArrowRight') selectProject(1);
  };
  const forwardWheel = useCallback((event: WheelEvent<HTMLDivElement>) => {
    if (!staged || !visible || isProjectsReadingTarget(event.target)) return;
    const scroller = findScrollContainer(host.current);
    if (!scroller) return;
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
    scrollContainerBy(scroller, event.deltaY * unit);
  }, [staged, visible]);
  const browseWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (!interactive || details) return;
    const direction = paging.current?.take(event, window.innerHeight);
    if (direction) selectProject(direction);
  };
  const swipeStart = (event: PointerEvent<HTMLDivElement>) => {
    if (!interactive || (event.pointerType === 'mouse' && event.button !== 0)) return;
    pointer.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
  };
  const swipeEnd = (event: PointerEvent<HTMLDivElement>) => {
    const start = pointer.current;
    pointer.current = null;
    if (!start || start.id !== event.pointerId) return;
    const x = event.clientX - start.x;
    const y = event.clientY - start.y;
    if (Math.abs(x) >= 60 && Math.abs(x) > Math.abs(y) * 1.5) selectProject(x < 0 ? 1 : -1);
  };

  useEffect(() => {
    if (content.current) content.current.scrollTop = 0;
    paging.current?.reset();
  }, [project?.id, details]);
  useEffect(() => registerTVReader({ page: selectProject, retreat: () => step(-1) }), [selectProject, step]);
  useEffect(() => {
    setTVPagingAvailable(staged && ready && filtered.length > 1);
    return () => setTVPagingAvailable(false);
  }, [staged, ready, filtered.length]);
  useEffect(() => { if (!interactive) paging.current?.reset(); }, [interactive]);
  useEffect(() => {
    if (!stage.current) return;
    stage.current.inert = staged && !visible;
    if (surface.current) surface.current.inert = !interactive;
  }, [interactive, staged, visible]);
  useEffect(() => {
    if (!staged || !visible) {
      sceneControl.current = null;
      return;
    }
    if (!['reading', 'framed', 'revealed'].includes(phase)) return;
    const control = sceneControl.current;
    sceneControl.current = null;
    if (!control || (document.activeElement !== document.body && document.activeElement !== control.element)) return;
    if (control.enterScreen && phase === 'reading') {
      surface.current?.querySelector<HTMLElement>('#project-display')?.focus({ preventScroll: true });
    } else control.element.focus({ preventScroll: true });
  }, [phase, staged, visible]);

  const reader = (
    <div
      ref={stage} className={styles.stage} data-staged={staged} data-phase={phase}
      data-testid="projects-stage" data-visible={staged && visible ? 'true' : undefined}
      aria-hidden={staged && !visible ? true : undefined} onWheel={forwardWheel}
    >
      <div ref={surface} className={styles.surface} data-projects-surface="">
        <div
          className={styles.tabs} role="tablist" aria-label="Project categories"
          data-projects-tabs="" onKeyDown={tabsKeyboard}
        >
          {PROJECT_CATEGORIES.map((value, categoryIndex) => (
            <ControlButton
              key={value} type="button" role="tab" id={`project-category-${categoryIndex}`}
              aria-selected={category === value} aria-controls="project-display"
              tabIndex={category === value && interactive ? 0 : -1}
              disabled={!interactive} className={styles.tab}
              onClick={() => selectCategory(value)}
            >
              {value}
            </ControlButton>
          ))}
        </div>
        <div
          ref={display} id="project-display" className={styles.display} role="tabpanel"
          aria-labelledby={`project-category-${activeTab}`} tabIndex={interactive ? 0 : -1}
          aria-hidden={!interactive ? true : undefined} onKeyDown={readerKeyboard}
          data-details={details} data-projects-display="" onWheel={browseWheel}
        >
          <header className={styles.displayHeader}>
            <h2 id="projects-heading">Projects</h2>
            <span className={styles.position} aria-label={`${index + 1} of ${filtered.length} projects`}>
              {String(index + 1).padStart(2, '0')} <span>/ {String(filtered.length).padStart(2, '0')}</span>
            </span>
          </header>
          {project ? (
            <div ref={broadcast} className={styles.work} data-project-id={project.id}>
              <div className={styles.broadcastSignal} data-broadcast-signal="" aria-hidden="true" />
              {!details && <div
                className={styles.image} data-broadcast-image="" onPointerDown={swipeStart} onPointerUp={swipeEnd}
                onPointerCancel={() => { pointer.current = null; }}
              >
                <ProjectImage key={project.id} project={project} />
              </div>}
              <div
                ref={content} className={styles.copy} data-projects-scrollable=""
                tabIndex={interactive ? 0 : -1}
                aria-label={`${project.title} ${details ? 'details' : 'summary'}`}
              >
                <h3 data-broadcast-title="">{project.title}</h3>
                {details ? <>
                  <ProjectDescription project={project} />
                  {project.evidence && <ProjectEvidence evidence={project.evidence} />}
                  <dl className={styles.technology}>
                    <dt>Built with</dt><dd>{project.tech}</dd>
                    <dt>Categories</dt><dd>{project.categories.join(' / ')}</dd>
                  </dl>
                </> : <>
                  <p className={styles.summary} data-broadcast-copy="">{project.description}</p>
                  {project.evidence?.access && <p className={styles.access} data-broadcast-copy="">
                    {project.evidence.access}
                  </p>}
                </>}
                <div className={styles.links} data-broadcast-copy="">
                  {project.demoUrl && <a href={project.demoUrl} target="_blank" rel="noopener noreferrer">
                    See project <ArrowUpRight size={17} aria-hidden="true" />
                  </a>}
                  {project.githubUrl && <a href={project.githubUrl} target="_blank" rel="noopener noreferrer">
                    {project.demoUrl ? 'Source' : 'See project'} <ArrowUpRight size={17} aria-hidden="true" />
                  </a>}
                </div>
                {!details && <p className={styles.stack} data-broadcast-copy="">{project.tech}</p>}
                {details && <div data-broadcast-copy=""><ProjectVisualLink project={project} /></div>}
              </div>
            </div>
          ) : <p className={styles.empty}>No projects in this category. Choose All to browse the work.</p>}
          <footer className={styles.displayFooter}>
            <ControlButton
              ref={detailsButton} disabled={!interactive || !project}
              aria-expanded={details} aria-controls="project-display"
              onClick={() => { paging.current?.reset(); setDetails(value => !value); }} className={styles.detailsButton}
            >
              {details ? 'Preview' : 'Details'}
              {details ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
            </ControlButton>
            {!details && project && <ProjectVisualLink project={project} shortLabel />}
            {!hardwarePaging && <div className={styles.projectNavigation}>
              <ControlButton iconOnly aria-label="Previous project"
                disabled={!interactive || filtered.length < 2} onClick={() => selectProject(-1)}>
                <ArrowLeft size={19} aria-hidden="true" />
              </ControlButton>
              <ControlButton variant="primary" aria-label="Next project" className={styles.next}
                disabled={!interactive || filtered.length < 2} onClick={() => selectProject(1)}>
                Next <ArrowRight size={19} aria-hidden="true" />
              </ControlButton>
            </div>}
          </footer>
          <div className={styles.crtShutter} data-crt-shutter="" aria-hidden="true" />
          <div className={styles.crtBeam} data-crt-beam="" aria-hidden="true" />
          <div className={styles.crtRaster} data-crt-raster="" aria-hidden="true" />
        </div>
      </div>
      {staged && <div className={styles.sceneControls} data-avatar-active={avatarPresenting || undefined}
        aria-hidden={!visible || avatarPresenting ? true : undefined}>
        <ControlButton onClick={event => {
          sceneControl.current = { element: event.currentTarget, enterScreen: false };
          step(-1);
        }}
          disabled={avatarPresenting || !['reading', 'framed', 'revealed'].includes(phase)} className={styles.sceneBack}>
          <ArrowLeft size={17} aria-hidden="true" />
          {phase === 'revealed' ? 'Back to Skills' : 'Back to the scene'}
        </ControlButton>
        {phase !== 'revealed' && <p className={styles.cue} role="status">
          {phase === 'withdrawing' || phase === 'turning' ? 'Turning toward the work'
            : phase === 'approaching' ? 'Approaching the display'
              : phase === 'departing' ? 'Continuing to Contact'
                : phase === 'unturning' || phase === 'retreating' ? 'Returning through the scene'
                  : phase === 'reading'
                    ? details ? 'Scroll to read. Preview returns to browsing.' : 'Scroll on the screen to browse. Scroll outside to continue.'
                    : 'The work is on the screen'}
        </p>}
        <ControlButton variant="primary" data-tv-scene-next="" onClick={event => {
          sceneControl.current = { element: event.currentTarget, enterScreen: phase === 'framed' };
          step(1);
        }}
          disabled={avatarPresenting || !['reading', 'framed', 'revealed'].includes(phase)} className={styles.sceneNext}>
          {phase === 'reading' ? 'Contact' : phase === 'revealed' ? 'Turn to the TV' : 'Open the screen'}
          <ArrowRight size={17} aria-hidden="true" />
        </ControlButton>
      </div>}
      <p className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">
        {interactive && project ? `${index + 1} of ${filtered.length}: ${project.title}. ${category}.` : ''}
      </p>
    </div>
  );

  return (
    <section ref={host} id="projects" className={styles.projects} data-staged={staged} aria-label="Projects">
      {staged ? createPortal(reader, document.body) : reader}
    </section>
  );
}
