import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Globe, Smartphone, Brain, Gamepad2, Shapes, Grid3x3 } from 'lucide-react';
import styles from './Projects.module.css';
import { projectsData } from '../../../data/projects';
import { ExpandableTabs } from '../../ui/expandable-tabs';
import { FocusRail, type FocusRailItem } from '../../ui/focus-rail';
import { KineticHeading } from '../../ui/KineticText';
import { FocusScrim } from '../../ui/FocusScrim';
import { StripReveal } from '../../ui/StripReveal';
import { useViewportCoverage } from '@/lib/scroll/viewportCoverage';

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
  const [activeCategory, setActiveCategory] = useState('All');
  const [isContactInView, setIsContactInView] = useState(false);

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
  const filteredProjects = activeCategory === 'All' 
    ? projectsData 
    : projectsData.filter(project => project.categories.includes(activeCategory));

  // Map projects to FocusRail items
  const railItems: FocusRailItem[] = filteredProjects.map((project) => ({
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
  }));

  // Was driven by framer-motion's useScroll, which tracks the viewport's own
  // scroll. This page scrolls inside the ScrollControls element, so that
  // progress was pinned at 0 and the section rendered permanently at its
  // starting values: opacity 0.3 and scale 0.97.
  const coverage = useViewportCoverage(sectionElement);
  const sectionOpacity = 0.35 + coverage * 0.65;
  const sectionScale = 0.97 + coverage * 0.03;

  return (
    <section ref={setSectionElement} className={styles.projects} id="projects">
      {/* Carries its own imagery, so the world stays faintly behind it. */}
      <FocusScrim />
      <motion.div
        className={styles.content}
        style={{
          opacity: sectionOpacity,
          scale: sectionScale,
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
      </motion.div>
    </section>
  );
}
 