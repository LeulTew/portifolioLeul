import { useRef, useState, useEffect } from 'react';
import { motion, useScroll, useTransform, useSpring, useMotionValue, AnimatePresence } from 'framer-motion';
import { Globe, Smartphone, Brain, Gamepad2, Shapes, Grid3x3 } from 'lucide-react';
import styles from './Projects.module.css';
import { projectsData } from '../../../data/projects';
import { ExpandableTabs } from '../../ui/expandable-tabs';

const categories = [
  { title: 'All', icon: Grid3x3 },
  { title: 'Web Development', icon: Globe },
  { title: 'AI/ML & Data Science', icon: Brain },
  { title: 'Mobile Apps', icon: Smartphone },
  { title: 'Graphics & Algorithms', icon: Shapes },
  { title: 'Desktop & Games', icon: Gamepad2 }
];

export function Projects() {
  const containerRef = useRef<HTMLElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState('All');
  const dragX = useMotionValue(0);
  const dragStartX = useRef(0);
  const projectWidth = useRef(0);

  // Filter projects based on active category
  const filteredProjects = activeCategory === 'All' 
    ? projectsData 
    : projectsData.filter(project => project.categories.includes(activeCategory));

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"]
  });

  const y = useTransform(scrollYProgress, [0, 1], [100, -100]);
  const x = useSpring(dragX, { 
    damping: 30,
    stiffness: 200,
    mass: 0.5
  });

  const handleDragStart = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!carouselRef.current || e.button !== 0) return;
    setIsDragging(true);
    dragStartX.current = e.clientX;
    projectWidth.current = carouselRef.current.offsetWidth * 0.45;
    // e.preventDefault(); // Removed to allow clicks
  };

  const handleDragMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    e.preventDefault();
    const delta = e.clientX - dragStartX.current;
    const newX = dragX.get() + delta;
    dragX.set(newX);
    dragStartX.current = e.clientX;
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const handleProjectClick = (id: string) => {
    if (isDragging) return;
    
    // Toggle expansion: if already expanded, collapse it
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    const delta = e.deltaY;
    const newX = dragX.get() - delta;
    dragX.set(newX);
    return false;
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    setIsDragging(true);
    dragStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const delta = e.touches[0].clientX - dragStartX.current;
    const newX = dragX.get() + delta;
    dragX.set(newX);
    dragStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    const handleResize = () => {
      if (!carouselRef.current) return;
      projectWidth.current = carouselRef.current.offsetWidth * 0.45;
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <section ref={containerRef} className={styles.projects} id="projects">
      <div className={styles.content}>
        <header className={styles.header}>
          <motion.h2 
            className={styles.title}
            style={{ y }}
          >
            Projects
          </motion.h2>
        </header>
        
        {/* Category Filter Tabs */}
        <div className={styles.filterContainer}>
          <ExpandableTabs
            tabs={categories}
            onChange={(index) => {
              if (index !== null) {
                setActiveCategory(categories[index].title);
                setExpandedId(null);
                dragX.set(0);
              }
            }}
          />
        </div>

        <motion.div 
          ref={carouselRef}
          className={styles.carousel}
          onMouseDown={handleDragStart}
          onMouseMove={handleDragMove}
          onMouseUp={handleDragEnd}
          onMouseLeave={handleDragEnd}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onWheel={handleWheel}
        >
          <motion.div 
            className={`${styles.carouselTrack} ${isDragging ? styles.dragging : ''}`}
            style={{ x }}
          >
            {filteredProjects.map((project, index) => {
              const uniqueId = `${project.id}-${index}`;
              const isExpanded = expandedId === uniqueId;

              return (
                <motion.div 
                  key={uniqueId}
                  className={`${styles.project} ${isExpanded ? styles.expanded : ''}`}
                  animate={{
                    height: isExpanded ? 'auto' : 'auto'
                  }}
                  whileHover={{ scale: 1.02 }}
                  transition={{ 
                    duration: 0.5,
                    ease: [0.76, 0, 0.24, 1]
                  }}
                  onClick={() => handleProjectClick(uniqueId)}
                  layout={isExpanded}
                >
                  <div className={styles.projectContent}>
                    <div className={styles.projectImage}>
                      <img src={project.image} alt={project.title} onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80';
                      }}/>
                    </div>
                    <div className={styles.projectInfo}>
                      <h3 className={styles.projectTitle}>{project.title}</h3>
                      <p className={styles.projectDescription}>{project.description}</p>
                      <div className={styles.projectTech}>{project.tech}</div>
                      
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            className={styles.expandedDetails}
                          >
                            <p className={styles.longDescription}>{project.longDescription}</p>
                            <a 
                              href={project.githubUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className={styles.githubLink}
                              onClick={(e) => e.stopPropagation()}
                            >
                              View on GitHub →
                            </a>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
} 