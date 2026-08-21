import { useRef, useState, useEffect } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Globe, Smartphone, Brain, Gamepad2, Shapes, Grid3x3 } from 'lucide-react';
import styles from './Projects.module.css';
import { projectsData } from '../../../data/projects';
import { ExpandableTabs } from '../../ui/expandable-tabs';
import { FocusRail, type FocusRailItem } from '../../ui/focus-rail';
import { KineticHeading } from '../../ui/KineticText';

const categories = [
  { title: 'All', icon: Grid3x3 },
  { title: 'Web Development', icon: Globe },
  { title: 'AI/DataScience', icon: Brain },
  { title: 'Mobile Apps', icon: Smartphone },
  { title: 'Graphics & Algorithms', icon: Shapes },
  { title: 'Desktop & Games', icon: Gamepad2 }
];

export function Projects({ theme }: { theme?: string }) {
  const containerRef = useRef<HTMLElement>(null);
  const [activeCategory, setActiveCategory] = useState('All');
  const [isContactInView, setIsContactInView] = useState(false);

  // Replicate Nav Bar's section tracking logic to ensure consistent behavior
  useEffect(() => {
    const sections = ['projects', 'contact'];
    
    const handleScrollCheck = () => {
      const isAtBottom = window.scrollY > 100 && (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 100);
      if (isAtBottom) {
        setIsContactInView(true);
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const isAtBottom = window.scrollY > 100 && (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 100);
        
        if (isAtBottom) {
          setIsContactInView(true);
          return;
        }

        const visibleEntry = entries
          .filter(entry => entry.isIntersecting)
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

    sections.forEach(id => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    window.addEventListener('scroll', handleScrollCheck);
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', handleScrollCheck);
    };
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

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"]
  });

  const sectionOpacity = useTransform(scrollYProgress, [0, 0.12, 0.88, 1], [0.3, 1, 1, 0.2]);
  const sectionScale = useTransform(scrollYProgress, [0, 0.15, 0.85, 1], [0.97, 1, 1, 0.97]);

  return (
    <section ref={containerRef} className={styles.projects} id="projects">
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

        {/* Focus Rail Component */}
        <div className="w-full mt-8">
          <FocusRail 
            items={railItems} 
            theme={theme}
            isFocused={!isContactInView}
            autoPlay={false}
            loop={true} 
            className="bg-transparent"
          />
        </div>
      </motion.div>
    </section>
  );
}
 