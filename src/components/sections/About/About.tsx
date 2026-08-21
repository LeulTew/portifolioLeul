import { useRef } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import { Card } from '../../ui/Card';
import { CardTitle, CardText, TagsGrid, Tag } from '../../ui/Card';
import styles from './About.module.css';
import { cvData } from '../../../data/cv';

const containerReveal = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.05,
    }
  }
};

const lineReveal = {
  hidden: { 
    opacity: 0, 
    y: "110%", 
    rotateX: -18,
    filter: "blur(6px)" 
  },
  visible: {
    opacity: 1,
    y: "0%",
    rotateX: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.85,
      ease: [0.16, 1, 0.3, 1]
    }
  }
};

const fadeUpVariant = {
  hidden: { opacity: 0, y: 20, filter: "blur(4px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.7,
      ease: [0.16, 1, 0.3, 1]
    }
  }
};

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

  const containerY = useTransform(smoothProgress, [0, 1], ["4%", "-4%"]);
  const headerX = useTransform(smoothProgress, [0, 0.5], ["0%", "6%"]);
  const headerOpacity = useTransform(smoothProgress, [0, 0.5], [1, 0.2]);

  return (
    <section ref={containerRef} className={styles.about} id="about">
      <motion.div 
        className={styles.content}
        style={{ 
          y: containerY
        }}
      >
        {/* Left-Aligned Section Header Below the Indicator Arrow */}
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

        {/* Spatial Editorial Layout Framing the 3D Canvas across the Full Screen */}
        <div className={styles.heroSpatialLayout}>
          {/* Left Column: Bold Philosophy / Core Identity */}
          <motion.div
            className={styles.leftColumn}
            variants={containerReveal}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
          >
            <h3 className={styles.statementText}>
              <span className={styles.lineOverflowWrapper}>
                <motion.span variants={lineReveal} className={styles.statementLine}>
                  INTELLIGENT LOGIC
                </motion.span>
              </span>
              <span className={styles.lineOverflowWrapper}>
                <motion.span variants={lineReveal} className={`${styles.statementLine} ${styles.statementHighlight}`}>
                  SHAPED WITH PURPOSE
                </motion.span>
              </span>
            </h3>
            
            <motion.div variants={fadeUpVariant} className={styles.subStatement}>
              <span className={styles.subStatementBar} />
              <span className={styles.subStatementText}>CREATIVE ENGINEERING &amp; FULL-STACK SYSTEMS</span>
            </motion.div>
          </motion.div>

          {/* Center Column: Expansive Breathing Space for 3D TV & Terrain */}
          <div className={styles.centerSpace} aria-hidden="true" />

          {/* Right Column: Anchored on the Far Right Edge of the Screen */}
          <motion.div
            className={styles.rightColumn}
            variants={containerReveal}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
          >
            <h3 className={styles.statementText}>
              <span className={styles.lineOverflowWrapper}>
                <motion.span variants={lineReveal} className={styles.statementLine}>
                  SCALABLE SYSTEMS
                </motion.span>
              </span>
              <span className={styles.lineOverflowWrapper}>
                <motion.span variants={lineReveal} className={`${styles.statementLine} ${styles.statementHighlight}`}>
                  CRAFTED TO EMPOWER
                </motion.span>
              </span>
            </h3>
            
            <motion.div variants={fadeUpVariant} className={styles.metricsList}>
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
            </motion.div>

            <motion.div variants={fadeUpVariant} className={styles.pillContainer}>
              {cvData.about.highlights.map((highlight, i) => (
                <span key={i} className={styles.editorialPill}>{highlight}</span>
              ))}
            </motion.div>
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