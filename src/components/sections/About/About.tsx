import { useRef, useContext } from 'react';
import { motion } from 'framer-motion';
import { Card } from '../../ui/Card';
import { CardTitle, CardText, TagsGrid, Tag } from '../../ui/Card';
import { ThemeContext } from '../theme/ThemeContext';
import { usePortfolioScroll } from '../scroll/ScrollContext';
import styles from './About.module.css';
import { cvData } from '../../../data/cv';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.14,
      delayChildren: 0.08,
    }
  }
};

const lineVariants = {
  hidden: { 
    opacity: 0, 
    y: "120%", 
    rotateX: -25,
    filter: "blur(10px)" 
  },
  visible: {
    opacity: 1,
    y: "0%",
    rotateX: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.9,
      ease: [0.16, 1, 0.3, 1]
    }
  }
};

const subItemVariants = {
  hidden: { opacity: 0, y: 24, filter: "blur(6px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.8,
      ease: [0.16, 1, 0.3, 1]
    }
  }
};

export function About() {
  const containerRef = useRef<HTMLElement>(null);
  const themeContext = useContext(ThemeContext);
  const isLight = themeContext?.theme === 'light';

  const { progress } = usePortfolioScroll();

  // Scroll entrance & focus fill progress inside About section:
  // Starts filling at progress = 0.03, fully saturated solid white at progress >= 0.10
  const enterProgress = Math.min(1, Math.max(0, (progress - 0.02) / 0.08));
  const fillAlpha = 0.35 + enterProgress * 0.65;
  const titleColor = isLight 
    ? `rgba(17, 24, 39, ${fillAlpha})` 
    : `rgba(255, 255, 255, ${fillAlpha})`;

  const titleGlow = isLight 
    ? 'none' 
    : `0 0 ${enterProgress * 35}px rgba(255, 255, 255, ${enterProgress * 0.45})`;

  const titleScale = 0.96 + enterProgress * 0.04;

  return (
    <section ref={containerRef} className={styles.about} id="about">
      <div className={styles.content}>
        {/* Section Header: Left-Aligned Directly Below the Indicator Arrow with Scroll Fill */}
        <div className={styles.header}>
          <h2 
            className={styles.title}
            style={{
              color: titleColor,
              textShadow: titleGlow,
              transform: `scale(${titleScale})`,
              transformOrigin: 'left center',
              transition: 'color 0.1s ease-out, text-shadow 0.15s ease-out, transform 0.15s ease-out',
            }}
          >
            About Me
          </h2>
          <p className={styles.subtitle}>
            {cvData.about.subtitle}
          </p>
        </div>

        {/* Spatial Editorial Layout Framing the 3D Canvas across the Full Screen */}
        <div className={styles.heroSpatialLayout}>
          {/* Left Column: Bold Philosophy / Core Identity */}
          <motion.div
            className={styles.leftColumn}
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
          >
            <h3 className={styles.statementText}>
              <span className={styles.lineOverflowWrapper}>
                <motion.span variants={lineVariants} className={styles.statementLine}>
                  INTELLIGENT LOGIC
                </motion.span>
              </span>
              <span className={styles.lineOverflowWrapper}>
                <motion.span variants={lineVariants} className={`${styles.statementLine} ${styles.statementHighlight}`}>
                  SHAPED WITH PURPOSE
                </motion.span>
              </span>
            </h3>
            
            <motion.div variants={subItemVariants} className={styles.subStatement}>
              <span className={styles.subStatementBar} />
              <span className={styles.subStatementText}>CREATIVE ENGINEERING &amp; FULL-STACK SYSTEMS</span>
            </motion.div>
          </motion.div>

          {/* Center Column: Expansive Breathing Space for 3D TV & Terrain */}
          <div className={styles.centerSpace} aria-hidden="true" />

          {/* Right Column: Anchored on the Far Right Edge of the Screen */}
          <motion.div
            className={styles.rightColumn}
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
          >
            <h3 className={styles.statementText}>
              <span className={styles.lineOverflowWrapper}>
                <motion.span variants={lineVariants} className={styles.statementLine}>
                  SCALABLE SYSTEMS
                </motion.span>
              </span>
              <span className={styles.lineOverflowWrapper}>
                <motion.span variants={lineVariants} className={`${styles.statementLine} ${styles.statementHighlight}`}>
                  CRAFTED TO EMPOWER
                </motion.span>
              </span>
            </h3>
            
            <motion.div variants={subItemVariants} className={styles.metricsList}>
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

            <motion.div variants={subItemVariants} className={styles.pillContainer}>
              {cvData.about.highlights.map((highlight, i) => (
                <span key={i} className={styles.editorialPill}>{highlight}</span>
              ))}
            </motion.div>
          </motion.div>
        </div>

        {/* Education Section */}
        <div className={styles.educationWrapper}>
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
          <div className={styles.sectionTitle} style={{ marginTop: '5rem' }}>Certifications</div>
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
        </div>
      </div>
    </section>
  );
}