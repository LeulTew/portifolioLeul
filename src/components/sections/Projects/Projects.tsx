import { useMemo, useRef, useState, useEffect } from 'react';
import { Globe, Smartphone, Brain, Gamepad2, Shapes, Grid3x3 } from 'lucide-react';
import styles from './Projects.module.css';
import { projectsData } from '../../../data/projects';
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

const categories = [
  { title: 'All', icon: Grid3x3 },
  { title: 'Web Development', icon: Globe },
  { title: 'AI/DataScience', icon: Brain },
  { title: 'Mobile Apps', icon: Smartphone },
  { title: 'Graphics & Algorithms', icon: Shapes },
  { title: 'Desktop & Games', icon: Gamepad2 }
];

export function Projects({ theme }: { theme?: string }) {
  const [sectionElement, setSectionElement] = useState<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [activeCategory, setActiveCategory] = useState('All');
  const [isContactInView, setIsContactInView] = useState(false);
  const reducedMotion = getPrefersReducedMotion();
  const focusPhase = useRef<PhaseState>(PHASE_AT_REST);
  const focusActive = useRef(false);
  const focusFrame = useRef(0);
  const focusLastTime = useRef<number | null>(null);

  // The page scrolls inside the ScrollControls element, so window.scrollY is
  // always 0 here; section visibility has to come from IntersectionObserver,
  // which does account for the container's transform.
  useEffect(() => {
    const observed = ['projects', 'contact']
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);

    if (observed.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (visibleEntry?.target?.id === 'contact') {
          setIsContactInView(true);
        } else if (visibleEntry?.target?.id === 'projects') {
          setIsContactInView(false);
        }
      },
      {
        threshold: [0.15, 0.35, 0.55],
        rootMargin: '-35% 0px -35% 0px'
      }
    );

    observed.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

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
    description: project.longDescription ? (
      <div className="flex flex-col gap-3 text-left">
        {project.longDescription.split('\n').map((line, i) => {
          if (!line.trim()) return null;
          return (
            <p key={i} className="leading-relaxed text-neutral-300">
              {line.split(/(\*\*.*?\*\*)/g).map((part, j) => 
                part.startsWith('**') && part.endsWith('**') 
                  ? <strong key={j} className="text-emerald-400 font-bold">{part.slice(2, -2)}</strong> 
                  : part
              )}
            </p>
          );
        })}
      </div>
    ) : (
      project.description
    ),
    imageSrc: project.image,
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
            loop={true} 
            className="bg-transparent"
          />
        </StripReveal>
      </div>
    </section>
  );
}
 