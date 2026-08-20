import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { KineticHeading, DancingCharText, TelemetryBadge } from '../../ui/KineticText';
import styles from './Skills.module.css';

import { cvData } from '../../../data/cv';

const skillCategories = cvData.skills;

export function Skills() {
  const containerRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start center", "end center"]
  });

  const y = useTransform(scrollYProgress, [0, 1], ["0%", "25%"]);

  return (
    <section ref={containerRef} className={styles.skills} id="skills">
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
          <div className="flex items-center justify-end gap-2 mb-2">
            <TelemetryBadge label="ARSENAL" value="LANGUAGES & 3D" />
          </div>
          <KineticHeading text="Skills & Expertise" as="h2" className={styles.title} highlightWords={["Expertise"]} />
          <p className={styles.subtitle}>Technical capabilities, distributed systems, and creative 3D toolsets</p>
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
              whileHover={{ scale: 0.98 }}
            >
              <DancingCharText text={category.title} as="h3" className={styles.categoryTitle} />
              <div className={styles.skillList}>
                {category.items.map((skill, skillIndex) => (
                  <motion.span
                    key={skill}
                    className={styles.skill}
                    initial={{ opacity: 0, scale: 0.8 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ 
                      duration: 0.4, 
                      delay: 0.4 + (categoryIndex * 0.1) + (skillIndex * 0.05) 
                    }}
                    whileHover={{ 
                      scale: 1.08,
                      transition: { duration: 0.2 }
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