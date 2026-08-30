import { useContext, useRef } from 'react';
import { PinnedSequence } from '../../ui/PinnedSequence';
import { GroundWash } from '../../ui/GroundWash';
import { TypedText } from '../../ui/TypedText';
import { ThemeContext } from '../theme/ThemeContext';
import { STATEMENT_LAYERS, ABOUT_SCREENS } from './statementLayers';
import { ParallaxPlate } from '../../ui/ParallaxPlate';
import { getPrefersReducedMotion } from '@/lib/gateways/animationGateway';
import styles from './About.module.css';
import { cvData } from '../../../data/cv';
import { FocusScrim } from '../../ui/FocusScrim';









export function About() {
  const containerRef = useRef<HTMLElement>(null);
  const reducedMotion = getPrefersReducedMotion();
  const theme = useContext(ThemeContext)?.theme ?? 'dark';

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
              and gives it back on the way out -- as water rising over it,
              rather than as a panel dimming up. */}
          <GroundWash
            section="about"
            theme={theme}
            rise="--ground-in"
            className={styles.heldGround}
          />

          {/*
            Held with everything else rather than left in the flow. A heading
            above the pin travels with the page, so it climbs away while the
            reader is being held still underneath it -- the one thing naming
            the section leaves as the section begins. It stays for the whole
            stretch and lifts out at the end, once there is nothing left to
            name.
          */}
          <div className={styles.heldHeader} data-testid="about-held-header">
            <h2 className={styles.title}>About Me</h2>
            <p className={styles.subtitle}>{cvData.about.subtitle}</p>
          </div>

          {/* Held for the whole stretch: the one thing that does not come and
              go, so the statements read as arriving on it. */}
          <div className={styles.heldField} aria-hidden="true">
            <ParallaxPlate reducedMotion={reducedMotion} />
            <ParallaxPlate flipped reducedMotion={reducedMotion} />
          </div>

          <div className={styles.statements}>
            {/*
              The opening beat: the person, then what they have to say. The
              window opens from its middle and the line types itself out
              beside it, so the two halves arrive as one move rather than a
              picture and a paragraph that happen to share a screen.
            */}
            <div className={styles.introBeat} data-testid="about-intro">
              <div className={styles.windowMask} data-testid="about-window">
                <figure className={styles.window}>
                  <div className={styles.windowInner}>
                    <img
                      className={styles.portrait}
                      src="/images/leul-about.webp"
                      alt="Leul Tewodros Agonafer"
                      width={900}
                      height={1125}
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                </figure>
              </div>

              <div className={styles.introCopy}>
                <TypedText text={cvData.about.intro} typedVar="--intro-in" />
              </div>
            </div>

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
        </PinnedSequence>

      </div>
    </section>
  );
}