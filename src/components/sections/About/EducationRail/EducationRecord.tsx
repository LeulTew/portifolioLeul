import type { WheelEvent } from 'react';
import { EducationArtwork } from './EducationArtwork';
import { HilcoeMark } from './HilcoeMark';
import { SaintJosephMark } from './SaintJosephMark';
import { EducationText } from './EducationText';
import { EDUCATION_TEXT_PROFILES, type EducationTextProfile } from './educationTextProfiles';
import { BootdevBrand, CertificationDiagram } from './EducationBrand';
import type { EducationRecord as RecordData } from './educationRecords';
import styles from './EducationRail.module.css';

function displayName(record: RecordData) {
  if (record.logo === 'hilcoe') return 'HiLCoE';
  if (record.logo === 'saint-joseph') return 'Saint Joseph';
  if (record.title === 'Bootdev') return 'Boot.dev';
  return record.title;
}

function completedDate(period: string) {
  const monthYear = /^(\d{2})\/(\d{4})$/.exec(period);
  return monthYear ? `${monthYear[2]}-${monthYear[1]}` : period;
}

function CourseItem({ item, diagram, text, ordinal }: {
  item: string;
  diagram?: 'logic' | 'responsive';
  text: EducationTextProfile;
  ordinal: number;
}) {
  const date = / (\([A-Za-z]+ \d{4}\))$/.exec(item);
  const title = date ? item.slice(0, date.index) : item;
  const isProject = item.startsWith('Build ');
  const score = /^(GPA: )([\d.]+)( \/ [\d.]+)$/.exec(item);

  return (
    <li
      className={styles.item}
      data-part="row"
      data-build={isProject || undefined}
      data-score={!!score || undefined}
    >
      {diagram ? <CertificationDiagram kind={diagram} /> : null}
      {score ? (
        <span className={styles.score}>
          <span className={styles.scoreLabel}>
            <EducationText text={score[1]} motion={text['score-label']} role="score-label" />
          </span>
          <strong className={styles.scoreValue}>
            <EducationText text={score[2]} motion={text['score-value']} role="score-value" />
          </strong>
          <span className={styles.scoreScale}>
            <EducationText text={score[3]} motion={text['score-scale']} role="score-scale" />
          </span>
        </span>
      ) : (
        <span className={styles.itemText}>
          {isProject ? (
            <strong className={styles.itemTitle}>
              <EducationText text={title} motion={text.project} role="project" />
            </strong>
          ) : (
            <span className={styles.itemTitle}>
              <EducationText text={title} motion={text.course[ordinal % text.course.length]} role="course" />
            </span>
          )}
          {date ? <>{' '}<span className={styles.itemDate}>
            <EducationText text={date[1]} motion={text.date} role="date" />
          </span></> : null}
        </span>
      )}
    </li>
  );
}

export function EducationRecord({
  record,
  position,
  onWheel,
  inactive,
  interactive,
}: {
  record: RecordData;
  position: number;
  onWheel: (event: WheelEvent) => void;
  inactive: boolean;
  interactive: boolean;
}) {
  const name = displayName(record);
  const projects = record.items.filter((item) => item.startsWith('Build '));
  const coursework = record.items.filter((item) => !item.startsWith('Build '));
  const grouped = record.items.length > 6 && projects.length > 0;
  const bootdev = record.title === 'Bootdev';
  const freecodecamp = record.title === 'freeCodeCamp';
  const textStyle = bootdev ? 'decode' : freecodecamp ? 'flow'
    : record.logo === 'saint-joseph' ? 'letterpress' : 'fold';
  const text = EDUCATION_TEXT_PROFILES[textStyle];
  let courseOrdinal = 0;
  const summary = record.summary ? (
    <p className={styles.summary} data-part="row">
      <EducationText text={record.summary} motion={text.summary} role="summary" />
    </p>
  ) : null;

  return (
    <article
      className={styles.record}
      data-record={position}
      data-program={record.logo ? 'academic' : 'practice'}
      data-provider={bootdev ? 'bootdev' : freecodecamp ? 'freecodecamp' : undefined}
      data-text-style={textStyle}
      data-has-mark={record.logo ? 'true' : undefined}
      data-mark-side={record.markSide}
      aria-hidden={inactive || undefined}
      aria-label={`${record.kind}: ${record.title}`}
    >
      <div className={styles.plate}>
        <div className={styles.plateHead}>
          <h3 className={styles.recordTitle} aria-label={record.title}>
            <span className={styles.recordTitleInner} data-part="title" data-edu-text={bootdev ? undefined : 'split'} aria-hidden="true">
              {bootdev ? <EducationText text={name} motion={text.title} role="title" /> : name.split(' ').map((word, wordIndex) => (
                <span className={styles.titleWord} key={`${word}-${wordIndex}`}>
                  {wordIndex > 0 ? ' ' : null}
                  {Array.from(word).map((glyph, index) => (
                    <span className={styles.glyph} data-edu-glyph="" key={`${glyph}-${index}`}>
                      {glyph}
                    </span>
                  ))}
                </span>
              ))}
            </span>
          </h3>
          {record.logo === 'hilcoe' ? (
            <p className={styles.institutionName} data-part="row">
              <EducationText text={record.title.replace(/^HiLCoE /, '')} motion={text.institution} role="institution" />
            </p>
          ) : null}
        </div>

        <div className={styles.credential}>
          <p className={styles.award} data-part="row">
            <EducationText text={record.award} motion={text.award} role="award" />
          </p>
          <div className={styles.recordMeta}>
            <span className={styles.kind} data-part="kind">
              <EducationText text={record.kind} motion={text.kind} role="kind" />
            </span>
            <p className={styles.period} data-part="row">
              <EducationText
                text={record.kind === 'Certification' ? 'Featured from' : 'Completed'}
                motion={text['period-label']} role="period-label"
              />{' '}
              <time dateTime={completedDate(record.period)}>
                <EducationText text={record.period} motion={text.period} role="period" />
              </time>
            </p>
          </div>
        </div>
        {bootdev ? summary : null}
      </div>

      {!bootdev ? summary : null}

      <div className={styles.detail}>
        {!bootdev ? <span className={styles.detailRule} data-edu-rule="" aria-hidden="true" /> : null}
        {grouped ? (
          <div className={styles.courseColumns} data-dense="true">
            <div className={styles.courseGroup} data-course-group="builds">
              <h4 className={styles.groupTitle} data-part="row">
                <EducationText text="Selected builds" motion={text['build-group']} role="build-group" />
              </h4>
              <ul className={styles.items}>
                {projects.map((item, index) => <CourseItem item={item} text={text} ordinal={index} key={item} />)}
              </ul>
            </div>
            <div className={styles.courseGroup} data-course-group="coursework">
              {bootdev ? <BootdevBrand onWheel={onWheel} /> : null}
              <h4 className={styles.groupTitle} data-part="row">
                <EducationText text="Selected coursework" motion={text['course-group']} role="course-group" />
              </h4>
              <ul className={styles.items}>
                {coursework.map((item, index) => <CourseItem item={item} text={text} ordinal={index} key={item} />)}
              </ul>
            </div>
          </div>
        ) : (
          <ul className={styles.items}>
            {record.items.map((item, index) => {
              const ordinal = courseOrdinal;
              if (!item.startsWith('GPA:') && !item.startsWith('Build ')) courseOrdinal++;
              return (
                <CourseItem
                  item={item}
                  text={text}
                  ordinal={ordinal}
                  diagram={freecodecamp ? index === 0 ? 'logic' : 'responsive' : undefined}
                  key={item}
                />
              );
            })}
          </ul>
        )}
      </div>

      {record.logo ? (
        <div className={styles.mark} data-edu-art="">
          <EducationArtwork active={interactive} onWheel={onWheel}>
            {record.logo === 'hilcoe' ? (
              <HilcoeMark className={styles.markArt} />
            ) : (
              <SaintJosephMark />
            )}
          </EducationArtwork>
        </div>
      ) : null}
    </article>
  );
}
