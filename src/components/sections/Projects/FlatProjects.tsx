import { useMemo, useRef, useState, useEffect } from 'react';
import { useActiveSection } from '@/lib/scroll/useActiveSection';
import { Globe, Smartphone, Brain, Gamepad2, Shapes, Grid3x3 } from 'lucide-react';
import styles from './Projects.module.css';
import { projectsData } from '../../../data/projects';
import { ProjectEvidence, ProjectVisualLink, ProjectVisualNote } from './ProjectEvidence';
import { ExpandableTabs } from '../../ui/expandable-tabs';
import { FocusRail, type FocusRailItem } from '../../ui/focus-rail';
import { KineticHeading } from '../../ui/KineticText';
import { FocusScrim } from '../../ui/FocusScrim';
import { StripReveal } from '../../ui/StripReveal';
import { useViewportShareEffect } from '@/lib/scroll/viewportCoverage';
import { getPrefersReducedMotion } from '@/lib/gateways/animationGateway';
import {
  advancePhase,
  easeInOutCubic,
  isPhaseAtTarget,
  phaseGate,
  PHASE_AT_REST,
  type PhaseState,
} from '@/lib/motion/triggeredPhase';

const FOCUS_DURATION_MS = 500;

/** The reading copy retires once Contact takes the viewport's focus band. */
const READING_SECTIONS = ['projects', 'contact'] as const;

const categories = [
  { title: 'All', icon: Grid3x3 },
  { title: 'Web Development', icon: Globe },
  { title: 'AI/DataScience', icon: Brain },
  { title: 'Mobile Apps', icon: Smartphone },
  { title: 'Graphics & Algorithms', icon: Shapes },
  { title: 'Desktop & Games', icon: Gamepad2 }
];

export function FlatProjects({ theme }: { theme?: string }) {
  const [sectionElement, setSectionElement] = useState<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [activeCategory, setActiveCategory] = useState('All');
  // Pixel coverage of a fixed focus band, shared with navigation: Projects is
  // too tall at compact viewports to reach an element-relative threshold again.
  const isContactInView = useActiveSection(READING_SECTIONS) === 'contact';
  const reducedMotion = getPrefersReducedMotion();
  const focusPhase = useRef<PhaseState>(PHASE_AT_REST);
  const focusActive = useRef(false);
  const focusFrame = useRef(0);
  const focusLastTime = useRef<number | null>(null);

  // Filter projects based on active category
  const filteredProjects = useMemo(
    () =>
      activeCategory === 'All'
        ? projectsData
        : projectsData.filter((project) => project.categories.includes(activeCategory)),
    [activeCategory]
  );

  /*
   * Memoised on the category, which is the only thing that changes it.
   *
   * Building this list splits and regex-matches the long description of every
   * project and allocates a tree of elements for each. It used to be rebuilt
   * on every render -- and the section re-rendered on every one of a hundred
   * coverage steps per transit, purely to restyle itself. That is thirty
   * descriptions re-parsed and the whole carousel reconciled, per step, while
   * the reader scrolls past.
   */
  const railItems: FocusRailItem[] = useMemo(
    () =>
      filteredProjects.map((project) => ({
    id: project.id,
    title: project.title,
    description: (
      <div className="flex flex-col gap-3 text-left">
        <ProjectVisualNote project={project} />
        {(project.longDescription || project.description).split('\n').map((line, i) => {
          if (!line.trim()) return null;
          return (
            <p key={i} className={`leading-relaxed ${styles.description}`}>
              {line.split(/(\*\*.*?\*\*)/g).map((part, j) => 
                part.startsWith('**') && part.endsWith('**') 
                  ? <strong key={j}>{part.slice(2, -2)}</strong>
                  : part
              )}
            </p>
          );
        })}
        {project.evidence && <ProjectEvidence evidence={project.evidence} />}
        <ProjectVisualLink project={project} />
      </div>
    ),
    imageSrc: project.image,
    imageAlt: project.imageAlt,
    demoUrl: project.demoUrl,
    repoUrl: project.githubUrl,
    meta: project.categories.join(' • '),
      })),
    [filteredProjects]
  );

  const paintFocus = (progress: number) => {
    const content = contentRef.current;
    if (!content) return;
    const eased = easeInOutCubic(progress);
    const opacity = (0.35 + eased * 0.65).toFixed(3);
    const transform = reducedMotion ? 'none' : `scale(${(0.97 + eased * 0.03).toFixed(4)})`;
    if (content.style.opacity !== opacity) content.style.opacity = opacity;
    if (content.style.transform !== transform) content.style.transform = transform;
  };

  const animateFocus = (now: number) => {
    focusFrame.current = 0;
    const dt = focusLastTime.current === null ? 16.7 : now - focusLastTime.current;
    focusLastTime.current = now;
    focusPhase.current = advancePhase(focusPhase.current, focusActive.current, dt, FOCUS_DURATION_MS);
    paintFocus(focusPhase.current.t);
    if (isPhaseAtTarget(focusPhase.current, focusActive.current)) {
      focusLastTime.current = null;
    } else {
      focusFrame.current = requestAnimationFrame(animateFocus);
    }
  };

  useEffect(() => () => {
    cancelAnimationFrame(focusFrame.current);
    focusFrame.current = 0;
    focusLastTime.current = null;
  }, []);

  useViewportShareEffect(sectionElement, (share) => {
    if (reducedMotion) {
      paintFocus(1);
      return;
    }
    focusActive.current = phaseGate(share, focusActive.current, 0.2, 0.1);
    if (focusFrame.current === 0 && !isPhaseAtTarget(focusPhase.current, focusActive.current)) {
      focusFrame.current = requestAnimationFrame(animateFocus);
    }
  });

  return (
    <section ref={setSectionElement} className={styles.projects} id="projects">
      {/* Carries its own imagery, so the world stays faintly behind it. */}
      <FocusScrim />
      <div
        ref={contentRef}
        className={styles.content}
        style={{
          opacity: reducedMotion ? 1 : 0.35,
          transform: reducedMotion ? 'none' : 'scale(0.97)',
          willChange: reducedMotion ? 'auto' : 'opacity, transform',
        }}
      >
        <header className={styles.header}>
          <KineticHeading 
            text="Featured Projects" 
            as="h2" 
            className={styles.title} 
            highlightWords={["Projects"]} 
          />
        </header>
        
        {/* Category Filter Tabs */}
        <div className={styles.filterContainer}>
          <ExpandableTabs
            tabs={categories}
            ariaLabel="Filter projects"
            theme={theme}
            onChange={(index) => {
              if (index !== null) {
                setActiveCategory(categories[index].title);
              }
            }}
          />
        </div>

        {/* Focus Rail Component. Changing category swaps the whole rail, so the
            swap sweeps across as a bending sheet rather than cutting hard. */}
        <StripReveal revealKey={activeCategory} className="w-full mt-8">
          <FocusRail 
            items={railItems} 
            theme={theme}
            isFocused={!isContactInView}
            autoPlay={false}
            itemPickerLabel="Choose a project"
            loop={true} 
            className="bg-transparent"
          />
        </StripReveal>
      </div>
    </section>
  );
}
 