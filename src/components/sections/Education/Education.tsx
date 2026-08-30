import { PinnedSequence } from '../../ui/PinnedSequence';
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
  return (
    <section className={styles.education} id="education">
      <PinnedSequence
        screens={EDUCATION_SCREENS}
        layers={EDUCATION_LAYERS}
        className={styles.sequence}
        id="education-held"
        testId="education-sequence"
      >
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
