import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useBandPresence } from '@/lib/scroll/bandPresence';
import { useBandProgress } from '@/lib/scroll/bandProgress';
import { ParallaxPlate } from '../../ui/ParallaxPlate';
import { getPrefersReducedMotion } from '@/lib/gateways/animationGateway';
import { Card } from '../../ui/Card';
import { CardTitle, CardText, TagsGrid, Tag } from '../../ui/Card';
import styles from './About.module.css';
import { cvData } from '../../../data/cv';
import { FocusScrim } from '../../ui/FocusScrim';

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

/**
 * How far each column starts out from its resting place, in rem.
 *
 * The columns already sit either side of the 3D, so they converge from the
 * edges they belong to rather than arriving from nowhere.
 */
const COLUMN_TRAVEL_REM = 7;

/**
 * One statement per screen, each vertically centred in its own stage.
 *
 * The two used to sit side by side in a single row, which meant they arrived
 * and left together and neither was ever the thing being read. Given a stage
 * each, the first is centred and held while it is read, leaves to the side it
 * lives on, and the second arrives from the other -- and the space each leaves
 * is where the plate goes, so nothing is standing empty.
 */
function useStage() {
  const [element, setElement] = useState<HTMLElement | null>(null);
  return {
    ref: setElement,
    presence: useBandPresence(element),
    progress: useBandProgress(element),
  };
}

export function About() {
  const containerRef = useRef<HTMLElement>(null);
  const first = useStage();
  const second = useStage();
  const reducedMotion = getPrefersReducedMotion();

  /**
   * Symmetric, and driven by the scroll rather than played once on arrival.
   *
   * `whileInView` with `once: true` can only ever animate in: the columns
   * would sit at full opacity for the rest of the page no matter how far past
   * them the reader had scrolled. Reading presence per frame makes the exit
   * the entrance in reverse, for free.
   */
  const column = (direction: -1 | 1, presence: number) => ({
    opacity: presence,
    transform: reducedMotion
      ? undefined
      : `translate3d(${(direction * (1 - presence) * COLUMN_TRAVEL_REM).toFixed(
          3
        )}rem, 0, 0)`,
    filter: reducedMotion ? undefined : `blur(${((1 - presence) * 5).toFixed(2)}px)`,
  });

  return (
    <section ref={containerRef} className={styles.about} id="about">
      {/* Mostly copy, and long: close the world out entirely. */}
      <FocusScrim variant="solid" />
      <div className={styles.content}>
        {/* Section Header: Left-Aligned Directly Below the Indicator Arrow */}
        <motion.div 
          className={styles.header}
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2 className={styles.title}>
            About Me
          </h2>
          <p className={styles.subtitle}>
            {cvData.about.subtitle}
          </p>
        </motion.div>

        {/* Spatial Editorial Layout Framing the 3D Canvas across the Full Screen */}
        <div className={styles.stage} ref={first.ref} data-testid="about-stage-one">
          {/* Left Column: Bold Philosophy / Core Identity */}
          <motion.div
            className={styles.leftColumn}
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            style={column(-1, first.presence)}
            data-testid="about-left-column"
          >
            <h3 className={styles.statementText}>
              <span className={styles.lineOverflowWrapper}>
                <motion.span variants={lineVariants} className={styles.statementLine}>
                  KEEP IT SIMPLE
                </motion.span>
              </span>
              <span className={styles.lineOverflowWrapper}>
                <motion.span variants={lineVariants} className={`${styles.statementLine} ${styles.statementHighlight}`}>
                  BUT SIGNIFICANT
                </motion.span>
              </span>
            </h3>
            
            <motion.div variants={subItemVariants} className={styles.subStatement}>
              <span className={styles.subStatementBar} />
              <span className={styles.subStatementText}>CREATIVE ENGINEERING &amp; FULL-STACK SYSTEMS</span>
            </motion.div>
          </motion.div>

          <div className={styles.centerSpace}>
            <ParallaxPlate
              progress={first.progress}
              presence={first.presence}
              reducedMotion={reducedMotion}
            />
          </div>
        </div>

        {/* The second statement takes the screen once the first has left it. */}
        <div className={styles.stage} ref={second.ref} data-testid="about-stage-two">
          <div className={styles.centerSpace}>
            <ParallaxPlate
              progress={second.progress}
              presence={second.presence}
              flipped
              reducedMotion={reducedMotion}
            />
          </div>

          <motion.div
            className={styles.rightColumn}
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            style={column(1, second.presence)}
            data-testid="about-right-column"
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