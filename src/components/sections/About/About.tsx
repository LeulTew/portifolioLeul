import { useRef } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import { Card } from '../../ui/Card';
import { CardTitle, CardText, TagsGrid, Tag } from '../../ui/Card';
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

  const containerY = useTransform(smoothProgress, [0, 1], ["5%", "-5%"]);
  const headerX = useTransform(smoothProgress, [0, 0.5], ["0%", "8%"]);
  const headerOpacity = useTransform(smoothProgress, [0, 0.5], [0.8, 0]);

  return (
    <section ref={containerRef} className={styles.about} id="about">
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

        {/* Spatial Editorial Layout Framing the 3D Canvas */}
        <div className={styles.heroSpatialLayout}>
          {/* Left Column: Bold Philosophy / Core Identity */}
          <motion.div
            className={styles.leftColumn}
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.76, 0, 0.24, 1] }}
          >
            <h3 className={styles.statementText}>
              <span>INTELLIGENT LOGIC</span>
              <span className={styles.statementHighlight}>SHAPED WITH PURPOSE</span>
            </h3>
            <div className={styles.subStatement}>
              <span className={styles.statementDot} />
              <span className={styles.subStatementText}>CREATIVE ENGINEERING &amp; FULL-STACK SYSTEMS</span>
            </div>
          </motion.div>

          {/* Center Column: Open breathing space for 3D TV & Terrain */}
          <div className={styles.centerSpace} aria-hidden="true" />

          {/* Right Column: Bold Architecture / Impact Metrics */}
          <motion.div
            className={styles.rightColumn}
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.76, 0, 0.24, 1], delay: 0.15 }}
          >
            <h3 className={styles.statementText}>
              <span>SCALABLE SYSTEMS</span>
              <span className={styles.statementHighlight}>CRAFTED TO EMPOWER</span>
            </h3>
            
            <div className={styles.metricsList}>
              <div className={styles.metricItem}>
                <span className={styles.metricValue}>3+</span>
                <span className={styles.metricLabel}>Years Engineering Production Web &amp; Mobile Systems</span>
              </div>
              <div className={styles.metricItem}>
                <span className={styles.metricValue}>30+</span>
                <span className={styles.metricLabel}>Applications Delivered Across AI/ML, 3D &amp; Cloud</span>
              </div>
              <div className={styles.metricItem}>
                <span className={styles.metricValue}>BSc</span>
                <span className={styles.metricLabel}>Computer Science Graduate (HiLCoE)</span>
              </div>
            </div>

            <div className={styles.pillContainer}>
              {cvData.about.highlights.map((highlight, i) => (
                <span key={i} className={styles.editorialPill}>{highlight}</span>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Education Section */}
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

        {/* Certifications Section */}
        <div className={styles.sectionTitle} style={{ marginTop: '4rem' }}>Certifications</div>
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