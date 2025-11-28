import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import styles from './Skills.module.css';

interface SkillCategory {
  title: string;
  items: string[];
}

const skillCategories: SkillCategory[] = [
  {
    title: "Languages & Frameworks",
    items: ["C++", "C#", "JavaScript", "HTML", "CSS", "PHP", "ASP.NET", "Three.js"]
  },
  {
    title: "Tools & Software",
    items: ["Visual Studio", "Git", "Figma", "Adobe Photoshop", "Adobe Express"]
  },
  {
    title: "Multimedia Editing",
    items: ["Adobe Premiere Pro", "CapCut"]
  }
];

export function Skills() {
  const containerRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start center", "end center"]
  });

  const y = useTransform(scrollYProgress, [0, 1], ["0%", "25%"]);

  return (
    <section ref={containerRef} className={styles.skills}>
      <motion.div 
        className={styles.content}
        style={{ y }}
      >
        <motion.div 
          className={styles.header}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.76, 0, 0.24, 1] }}
        >
          <h2 className={styles.title}>Skills</h2>
          <p className={styles.subtitle}>Technical capabilities and creative expertise</p>
        </motion.div>

        <motion.div 
          className={styles.skillsGrid}
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.76, 0, 0.24, 1], delay: 0.2 }}
        >
          {skillCategories.map((category, categoryIndex) => (
            <motion.div
              key={category.title}
              className={styles.skillCard}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ 
                duration: 0.8, 
                ease: [0.76, 0, 0.24, 1], 
                delay: 0.3 + (categoryIndex * 0.1) 
              }}
              whileHover={{ 
                scale: 0.98,
                backgroundColor: "rgba(255, 255, 255, 0.05)",
                borderColor: "rgba(255, 255, 255, 0.2)"
              }}
            >
              <h3 className={styles.categoryTitle}>{category.title}</h3>
              <div className={styles.skillList}>
                {category.items.map((skill, skillIndex) => (
                  <motion.span
                    key={skill}
                    className={styles.skill}
                    initial={{ opacity: 0, scale: 0.8 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{
                      duration: 0.5,
                      ease: [0.76, 0, 0.24, 1],
                      delay: 0.4 + (categoryIndex * 0.1) + (skillIndex * 0.05)
                    }}
                    whileHover={{
                      scale: 1.05,
                      y: -4,
                      backgroundColor: "rgba(255, 255, 255, 0.08)",
                      borderColor: "rgba(255, 255, 255, 0.3)"
                    }}
                  >
                    {skill}
                  </motion.span>
                ))}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </section>
  );
} 