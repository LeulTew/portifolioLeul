import { useRef, useState, useEffect } from 'react';
import { motion, useScroll, useTransform, useSpring, useMotionValue } from 'framer-motion';
import styles from './Projects.module.css';

const projects = [
  {
    id: 1,
    title: "Music Album Management System",
    description: "File-handling-based music album organizer",
    tech: "C++",
    image: "https://images.unsplash.com/photo-1483412033650-1015ddeb83d1?auto=format&fit=crop&w=1920&q=80"
  },
  {
    id: 2,
    title: "Digital Pharmacy",
    description: "Desktop app for pharmacy inventory and prescriptions",
    tech: "C#",
    image: "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=1920&q=80"
  },
  {
    id: 3,
    title: "Luna - Movie Website",
    description: "Responsive movie browsing and review website",
    tech: "HTML5, CSS3, JavaScript",
    image: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=1920&q=80"
  },
  {
    id: 4,
    title: "Car Rental Platform",
    description: "Full-stack app with 3D vehicle visualization",
    tech: "React, Three.js",
    image: "https://images.unsplash.com/photo-1580273916550-e323be2ae537?auto=format&fit=crop&w=1920&q=80"
  },
  {
    id: 5,
    title: "University Choice Helper",
    description: "JavaScript tool for informed university decisions",
    tech: "JavaScript",
    image: "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=1920&q=80"
  }
];

export function Projects() {
  const containerRef = useRef<HTMLElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragX = useMotionValue(0);
  const dragStartX = useRef(0);
  const projectWidth = useRef(0);

  const duplicatedProjects = [...projects, ...projects, ...projects];

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
    e.preventDefault();
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
        <motion.div 
          ref={carouselRef}
          className={styles.carousel}
          onMouseDown={handleDragStart}
          onMouseMove={handleDragMove}
          onMouseUp={handleDragEnd}
          onMouseLeave={handleDragEnd}
        >
          <motion.div 
            className={`${styles.carouselTrack} ${isDragging ? styles.dragging : ''}`}
            style={{ x }}
          >
            {duplicatedProjects.map((project, index) => (
              <motion.div 
                key={`${project.id}-${index}`}
                className={styles.project}
                whileHover={{ scale: 1.02 }}
                transition={{ 
                  duration: 0.5,
                  ease: [0.76, 0, 0.24, 1]
                }}
              >
                <div className={styles.projectContent}>
                  <div className={styles.projectImage}>
                    <img src={project.image} alt={project.title} />
                  </div>
                  <div className={styles.projectInfo}>
                    <h3 className={styles.projectTitle}>{project.title}</h3>
                    <p className={styles.projectDescription}>{project.description}</p>
                    <div className={styles.projectTech}>{project.tech}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
} 