import { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { PinnedSequence } from '../../ui/PinnedSequence';
import { STATEMENT_LAYERS, ABOUT_SCREENS } from './statementLayers';
import { ParallaxPlate } from '../../ui/ParallaxPlate';
import { getPrefersReducedMotion } from '@/lib/gateways/animationGateway';
import { Card } from '../../ui/Card';
import { CardTitle, CardText, TagsGrid, Tag } from '../../ui/Card';
import styles from './About.module.css';
import { cvData } from '../../../data/cv';
import { FocusScrim } from '../../ui/FocusScrim';
import { BackgroundPixelTransition } from './BackgroundPixelTransition';
import { TitlePixelTransition } from './TitlePixelTransition';

export function About() {
  const containerRef = useRef<HTMLElement>(null);
  const educationRef = useRef<HTMLDivElement>(null);
  const reducedMotion = getPrefersReducedMotion();

  useEffect(() => {
    const el = educationRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        const aboutEl = document.getElementById('about');
        if (!aboutEl) return;
        if (entry.isIntersecting) {
          aboutEl.setAttribute('data-bg-transition', 'true');
          document.documentElement.setAttribute('data-navbar-contrary', 'true');
        } else {
          const rect = aboutEl.getBoundingClientRect();
          if (rect.bottom < 80 || rect.top > 80) {
            document.documentElement.removeAttribute('data-navbar-contrary');
          }
        }
      },
      { rootMargin: '-5% 0px -10% 0px' }
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      document.documentElement.removeAttribute('data-navbar-contrary');
    };
  }, []);

  /**
   * Symmetric, and driven by the scroll rather than played once on arrival.
   *
   * `whileInView` with `once: true` can only ever animate in: the columns
   * would sit at full opacity for the rest of the page no matter how far past
   * them the reader had scrolled. Reading presence per frame makes the exit
   * the entrance in reverse, for free.
   */
  return (
    <section ref={containerRef} className={styles.about} id="about">
      {/* Mostly copy, and long: close the world out entirely. */}
      <FocusScrim variant="solid" />
      <div className={styles.content}>
        <PinnedSequence
          screens={ABOUT_SCREENS}
          layers={STATEMENT_LAYERS}
          className={styles.aboutSequence}
          testId="about-sequence"
        >
          {/* Shuts the world out for exactly as long as the reader is held,
              and gives it back on the way out. Hosts the bottom-up background pixel transition. */}
          <div className={styles.heldGround} aria-hidden="true">
            <BackgroundPixelTransition start={0.78} end={0.88} />
          </div>

          {/*
            Held with everything else rather than left in the flow. A heading
            above the pin travels with the page, so it climbs away while the
            reader is being held still underneath it -- the one thing naming
            the section leaves as the section begins. It stays for the whole
            stretch and flips horizontally left-to-right into Education once the
            background transition finishes fully.
          */}
          <div className={styles.heldHeader} data-testid="about-held-header">
            <TitlePixelTransition
              start={0.88}
              end={1.0}
              initialTitle="About Me"
              initialSubtitle={cvData.about.subtitle}
              flippedTitle="Education"
              flippedSubtitle="Academic Foundations & Industry Certifications"
            />
          </div>

          {/* Held for the whole stretch: the one thing that does not come and
              go, so the statements read as arriving on it. */}
          <div className={styles.heldField} aria-hidden="true">
            <ParallaxPlate reducedMotion={reducedMotion} />
            <ParallaxPlate flipped reducedMotion={reducedMotion} />
          </div>

          <div className={styles.statements}>
            <div
              className={`${styles.leftColumn} ${styles.layerOne}`}
              data-testid="about-left-column"
            >
              <h3 className={styles.statementText}>
                <span className={`${styles.statementLine} ${styles.lineFirst}`}>
                  KEEP IT SIMPLE
                </span>
                <span
                  className={`${styles.statementLine} ${styles.lineSecond} ${styles.statementHighlight}`}
                >
                  BUT SIGNIFICANT
                </span>
              </h3>

              <div className={styles.subStatement}>
                <span className={styles.subStatementBar} />
                <span className={styles.subStatementText}>
                  CREATIVE ENGINEERING &amp; FULL-STACK SYSTEMS
                </span>
              </div>
            </div>

            <div
              className={`${styles.rightColumn} ${styles.layerTwo}`}
              data-testid="about-right-column"
            >
              <h3 className={styles.statementText}>
                <span className={`${styles.statementLine} ${styles.lineFirst}`}>
                  SCALABLE SYSTEMS
                </span>
                <span
                  className={`${styles.statementLine} ${styles.lineSecond} ${styles.statementHighlight}`}
                >
                  CRAFTED TO EMPOWER
                </span>
              </h3>

              <div className={styles.metricsList}>
                <div className={styles.metricItem}>
                  <span className={styles.metricValue}>3+</span>
                  <span className={styles.metricLabel}>
                    Years Engineering Production Web &amp; Mobile Systems
                  </span>
                </div>
                <div className={styles.metricItem}>
                  <span className={styles.metricValue}>30+</span>
                  <span className={styles.metricLabel}>
                    Applications Delivered Across AI/ML, 3D &amp; Cloud
                  </span>
                </div>
                <div className={styles.metricItem}>
                  <span className={styles.metricValue}>BSc</span>
                  <span className={styles.metricLabel}>
                    Computer Science Graduate (HiLCoE)
                  </span>
                </div>
              </div>

              <div className={styles.pillContainer}>
                {cvData.about.highlights.map((highlight, i) => (
                  <span key={i} className={styles.editorialPill}>
                    {highlight}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Masked transition overlay: pure white text cutout over rising green transition background */}
          <div className={styles.transitionMaskedOverlay} aria-hidden="true">
            <div className={styles.transitionGreenFill} />
            <div className={`${styles.heldHeader} ${styles.heldHeaderWhite}`}>
              <div className={`${styles.title} ${styles.titleWhite}`} data-text="About Me" />
              <div
                className={`${styles.subtitle} ${styles.subtitleWhite}`}
                data-text={cvData.about.subtitle}
              />
            </div>
          </div>
        </PinnedSequence>

        {/* Education Section */}
        <div ref={educationRef} className={styles.educationWrapper} data-green-bg="true">
          <div className={styles.visuallyHiddenEducation}>Education</div>
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