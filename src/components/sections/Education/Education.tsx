import { useContext } from 'react';
import { PinnedSequence } from '../../ui/PinnedSequence';
import { GroundWash, groundFor } from '../../ui/GroundWash';
import { ThemeContext } from '../theme/ThemeContext';
import { Card, CardTitle, CardText, TagsGrid, Tag } from '../../ui/Card';
import { cvData } from '../../../data/cv';
import { EDUCATION_LAYERS, EDUCATION_SCREENS } from './educationLayers';
import styles from './Education.module.css';

/**
 * Education, read through an opening in the page.
 *
 * The left is a portal: a frame that is drawn first and empty, whose contents
 * are then uncovered from the bottom as the reader is held. The frame never
 * moves -- what changes is how much of what is inside it can be seen, which is
 * what makes it read as looking THROUGH something rather than at a panel that
 * animates.
 *
 * The right is the opposite move. The panel that hides the world draws back
 * off it, so the scene behind is revealed without the scene itself doing
 * anything: the camera is held for this whole stretch, so what arrives is the
 * view, not a move.
 */
export function Education() {
  const theme = useContext(ThemeContext)?.theme ?? 'dark';
  /*
   * The same ground as the left panel. It is set here rather than inherited:
   * the wash declares its colours on its own element, so a sibling asking for
   * them would get the fallback and the two halves of the panel would be
   * different colours until the aperture opened.
   */
  const ground = groundFor('education', theme);

  return (
    <section className={styles.education} id="education">
      <PinnedSequence
        screens={EDUCATION_SCREENS}
        layers={EDUCATION_LAYERS}
        className={styles.sequence}
        testId="education-sequence"
      >
        {/*
          Left: stays, and arrives as its own water rising -- a shade shallower
          than About's, so crossing between the two sections is a change of
          depth rather than a change of page.
          Right: draws back to uncover the world.
        */}
        <GroundWash
          section="education"
          theme={theme}
          rise="--panel-in"
          className={styles.panelLeft}
        />
        <div
          className={styles.panelRight}
          aria-hidden="true"
          data-testid="education-aperture"
          style={{ ['--ground-base' as string]: ground.base }}
        />

        <div className={styles.portal} data-testid="education-portal">
          <div className={styles.frame} aria-hidden="true" />

          <div className={styles.portalHead}>
            <h2 className={styles.title}>Education</h2>
          </div>

          <ol className={styles.entries}>
            {cvData.education.map((entry, index) => (
              <li
                key={entry.school}
                className={styles.entry}
                style={{ ['--reveal' as string]: `var(--e${index}-in, 0)` }}
                data-testid="education-entry"
              >
                <p className={styles.period}>{entry.period}</p>
                <h3 className={styles.school}>{entry.school}</h3>
                <p className={styles.degree}>{entry.degree}</p>
                <ul className={styles.details}>
                  {entry.details.map((detail) => (
                    <li key={detail}>{detail}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </div>
      </PinnedSequence>

      {/* Past the held stretch, and read normally. */}
      <div className={styles.certifications}>
        <h2 className={styles.certificationsTitle}>Certifications</h2>
        <div className={styles.certificationsGrid}>
          {cvData.certifications.map((cert) => (
            <Card key={cert.issuer}>
              <div className={styles.cardContent}>
                <CardTitle>{cert.issuer}</CardTitle>
                <CardText>{cert.year}</CardText>
                <CardText>{cert.description}</CardText>
                <TagsGrid>
                  {cert.items.map((item) => (
                    <Tag key={item}>{item}</Tag>
                  ))}
                </TagsGrid>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
