import { useRef } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import { Card } from '../../ui/Card';
import { CardTitle, CardText, StatsGrid, StatItem, TagsGrid, Tag } from '../../ui/Card';
import { CursorGlow } from '../../ui/CursorGlow/CursorGlow';
import styles from './About.module.css';
import { cvData } from '../../../data/cv';

export function About() {
  const containerRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"]
  });

  const smoothProgress = useSpring(scrollYProgress, {
    damping: 15,
    mass: 0.27,
    stiffness: 55
  });

  const containerY = useTransform(smoothProgress, [0, 1], ["10%", "-10%"]);
  const headerX = useTransform(smoothProgress, [0, 0.5], ["0%", "10%"]);
  const headerOpacity = useTransform(smoothProgress, [0, 0.5], [0.7, 0]);

  return (
    <section ref={containerRef} className={styles.about} id="about">
      <CursorGlow />
      <motion.div 
        className={styles.content}
        style={{ 
          y: containerY
        }}
      >
        <motion.div 
          ref={headerRef}
          className={styles.header}
          style={{
            x: headerX,
            opacity: headerOpacity
          }}
        >
          <h2 className={styles.title}>About Me</h2>
          <p className={styles.subtitle}>
            {cvData.about.subtitle}
          </p>
        </motion.div>

        <div className={styles.aboutGrid}>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.76, 0, 0.24, 1] }}
          >
            <Card>
              <div className={styles.cardContent}>
                <CardTitle>{cvData.about.title}</CardTitle>
                <CardText className={styles.description}>{cvData.about.description}</CardText>
                <StatsGrid>
                  {cvData.about.stats.map((stat, i) => (
                    <StatItem key={i} value={stat.value} label={stat.label} />
                  ))}
                </StatsGrid>
                <TagsGrid className={styles.highlights}>
                  {cvData.about.highlights.map((highlight, i) => (
                    <Tag key={i}>{highlight}</Tag>
                  ))}
                </TagsGrid>
              </div>
            </Card>
          </motion.div>
        </div>

        <div className={styles.sectionTitle}>Education</div>
        <div className={styles.educationGrid}>
          {cvData.education.map((edu, index) => (
            <motion.div
              key={edu.school}
              className={edu.school.includes('HiLCoE') ? styles.wide : ''}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ 
                duration: 0.8, 
                ease: [0.76, 0, 0.24, 1],
                delay: index * 0.1
              }}
            >
              <Card>
                <div className={styles.cardContent}>
                  <CardTitle>{edu.school}</CardTitle>
                  <div className={styles.educationMeta}>
                    <CardText>{edu.degree}</CardText>
                    <CardText>{edu.period}</CardText>
                  </div>
                  <TagsGrid>
                    {edu.details.map((detail, i) => (
                      <Tag key={i}>{detail}</Tag>
                    ))}
                  </TagsGrid>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className={styles.sectionTitle} style={{ marginTop: '3rem' }}>Certifications</div>
        <div className={styles.educationGrid}>
          {cvData.certifications.map((cert, index) => (
            <motion.div
              key={cert.issuer}
              className={cert.issuer.includes('Bootdev') ? styles.wide : ''}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ 
                duration: 0.8, 
                ease: [0.76, 0, 0.24, 1],
                delay: index * 0.1
              }}
            >
              <Card>
                <div className={styles.cardContent}>
                  <CardTitle>{cert.issuer}</CardTitle>
                  <div className={styles.educationMeta}>
                    <CardText>{cert.year}</CardText>
                  </div>
                  <CardText>{cert.description}</CardText>
                  <TagsGrid>
                    {cert.items.map((item, i) => (
                      <Tag key={i}>{item}</Tag>
                    ))}
                  </TagsGrid>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
} 