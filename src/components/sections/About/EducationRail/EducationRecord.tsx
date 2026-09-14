import type { WheelEvent } from 'react';
import { EducationArtwork } from './EducationArtwork';
import { HilcoeMark } from './HilcoeMark';
import { SaintJosephMark } from './SaintJosephMark';
import { BlurText, DecryptedText } from './EducationText';
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

function CourseItem({ item, diagram }: { item: string; diagram?: 'logic' | 'responsive' }) {
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
          <span className={styles.scoreLabel}><DecryptedText text={score[1]} /></span>
          <strong className={styles.scoreValue}><DecryptedText text={score[2]} /></strong>
          <span className={styles.scoreScale}><DecryptedText text={score[3]} /></span>
        </span>
      ) : (
        <span className={styles.itemText}>
          {isProject ? (
            <strong className={styles.itemTitle}><BlurText text={title} /></strong>
          ) : (
            <span className={styles.itemTitle}><BlurText text={title} /></span>
          )}
          {date ? <>{' '}<span className={styles.itemDate}><DecryptedText text={date[1]} /></span></> : null}
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
              {bootdev ? <DecryptedText text={name} /> : name.split(' ').map((word, wordIndex) => (
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
              <BlurText text={record.title.replace(/^HiLCoE /, '')} />
            </p>
          ) : null}
        </div>

        <div className={styles.credential}>
          <p className={styles.award} data-part="row"><BlurText text={record.award} /></p>
          <div className={styles.recordMeta}>
            <span className={styles.kind} data-part="kind"><DecryptedText text={record.kind} /></span>
            <p className={styles.period} data-part="row">
              <DecryptedText text={record.kind === 'Certification' ? 'Featured from' : 'Completed'} />{' '}
              <time dateTime={completedDate(record.period)}><DecryptedText text={record.period} /></time>
            </p>
          </div>
        </div>
      </div>

      {record.summary ? (
        <p className={styles.summary} data-part="row"><BlurText text={record.summary} /></p>
      ) : null}

      <div className={styles.detail}>
        <span className={styles.detailRule} data-edu-rule="" aria-hidden="true" />
        {grouped ? (
          <div className={styles.courseColumns} data-dense="true">
            <div className={styles.courseGroup}>
              <h4 className={styles.groupTitle} data-part="row"><DecryptedText text="Selected builds" /></h4>
              <ul className={styles.items}>
                {projects.map((item) => <CourseItem item={item} key={item} />)}
              </ul>
              {bootdev ? <BootdevBrand /> : null}
            </div>
            <div className={styles.courseGroup}>
              <h4 className={styles.groupTitle} data-part="row"><DecryptedText text="Selected coursework" /></h4>
              <ul className={styles.items}>
                {coursework.map((item) => <CourseItem item={item} key={item} />)}
              </ul>
            </div>
          </div>
        ) : (
          <ul className={styles.items}>
            {record.items.map((item, index) => (
              <CourseItem
                item={item}
                diagram={freecodecamp ? index === 0 ? 'logic' : 'responsive' : undefined}
                key={item}
              />
            ))}
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
