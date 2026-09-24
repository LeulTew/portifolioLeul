import { useCallback, useEffect, useRef, type CSSProperties, type WheelEvent } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { ControlButton } from '@/components/ui/ControlButton';
import { findScrollContainer, scrollContainerBy } from '@/lib/scroll/scrollContainer';
import { SKILL_CHAPTERS, type SkillChapter } from './skillsData';
import { SkillInlineText, SkillText, TiltedInstrument } from './SkillsMotion';
import { SkillSculpture } from './SkillSculpture';
import { useSkillsPlayback, useSkillsStaged } from './useSkillsPlayback';
import type { SectionNavigate } from '@/lib/scroll/sectionNavigation';
import styles from './Skills.module.css';

function Chapter({
  chapter, index, staged, active, onWheel,
}: {
  chapter: SkillChapter;
  index: number;
  staged: boolean;
  active: boolean;
  onWheel: (event: WheelEvent<HTMLElement>) => void;
}) {
  return (
    <article
      className={styles.chapter}
      data-skill-chapter={index}
      data-scene={chapter.scene}
      data-composition={chapter.composition}
      aria-hidden={staged && !active ? true : undefined}
      aria-label={chapter.title}
    >
      <div className={styles.editorial} onWheel={onWheel}>
        <SkillText text={chapter.title} tag="h3" className={styles.title}
          animated={staged} mode={chapter.textMotion} />
        <p className={styles.summary} data-skill-summary="">{chapter.summary}</p>
        <ul className={styles.skillList} aria-label={`${chapter.title} toolkit`}>
          {chapter.items.map(skill => (
            <li key={skill} className={styles.skill} data-skill-copy="" aria-label={staged ? skill : undefined}>
              <span className={styles.skillMarker} aria-hidden="true" />
              <SkillInlineText text={skill} mode={chapter.inlineMotion} animated={staged} />
            </li>
          ))}
        </ul>
      </div>

      {!staged && <div className={styles.visual}>
        <TiltedInstrument enabled={false}>
          <SkillSculpture scene={chapter.scene} />
        </TiltedInstrument>
        <div className={styles.process} aria-hidden="true">
          {chapter.process.map((part, partIndex) => (
            <span key={part}>
              {partIndex > 0 && <ArrowRight size={14} strokeWidth={1.5} />}
              {part}
            </span>
          ))}
        </div>
      </div>}
    </article>
  );
}

export function Skills({ onNavigate }: { onNavigate?: SectionNavigate } = {}) {
  const hostRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLElement>(null);
  const controlRef = useRef<HTMLButtonElement | null>(null);
  const staged = useSkillsStaged();
  const { active, settledIndex, phase, ready, visible, step, select } = useSkillsPlayback(
    { host: hostRef, stage: stageRef }, staged, onNavigate,
  );
  useEffect(() => {
    if (!ready) return;
    if (document.activeElement === document.body) controlRef.current?.focus({ preventScroll: true });
    controlRef.current = null;
  }, [ready]);
  const forwardWheel = useCallback((event: WheelEvent<HTMLElement>) => {
    if (!staged || !visible) return;
    const scroller = findScrollContainer(hostRef.current);
    // In the flat document a portal's wheel already scrolls the window.
    if (!scroller) return;
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
    scrollContainerBy(scroller, event.deltaY * unit);
  }, [staged, visible]);

  const stage = (
    <section
      ref={stageRef}
      className={styles.stage}
      data-staged={staged}
      data-phase={phase}
      data-active-skill={active}
      data-testid="skills-stage"
      role={staged ? 'region' : undefined}
      aria-labelledby={staged ? 'skills-heading' : undefined}
      aria-hidden={staged && !visible ? true : undefined}
      aria-busy={staged && visible && phase !== 'reading'}
    >
      <div className={styles.content}>
        <div className={styles.header} data-skill-chrome="">
          <h2 id="skills-heading" className={styles.sectionTitle}>Skills</h2>
          <p className={styles.intro}>The tools behind the work.</p>
        </div>
        <div className={styles.chapters}>
          {SKILL_CHAPTERS.map((chapter, index) => (
            <Chapter
              key={chapter.scene}
              chapter={chapter}
              index={index}
              staged={staged}
              active={visible && index === active}
              onWheel={forwardWheel}
            />
          ))}
          {staged && <div className={styles.worldTrack} aria-hidden="true">
            <div className={styles.sharedVisual} data-skill-rig="">
              <TiltedInstrument enabled={visible} interactive={phase === 'reading'} onWheel={forwardWheel}>
                <div className={styles.sculptureObject} data-skill-object="">
                  <SkillSculpture shared />
                </div>
              </TiltedInstrument>
              <div className={styles.sharedCaptions}>
                {SKILL_CHAPTERS.map((chapter, index) => (
                  <div key={chapter.scene} className={styles.process} data-material-caption={index}>
                    {chapter.process.map((part, partIndex) => (
                      <span key={part}>
                        {partIndex > 0 && <ArrowRight size={14} strokeWidth={1.5} />}
                        {part}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>}
        </div>
        {staged && (
          <div className={styles.footer} data-skill-chrome="" onWheel={forwardWheel}>
            <div className={styles.sequence}>
              <ol className={styles.progress} aria-label="Skills chapters">
                {SKILL_CHAPTERS.map((chapter, index) => (
                  <li key={chapter.scene} data-complete={index < settledIndex ? 'true' : undefined}>
                    <button type="button" className={styles.progressButton}
                      aria-label={`Show ${chapter.title}`} title={chapter.title}
                      aria-current={settledIndex === index ? 'step' : undefined}
                      disabled={!visible || phase === 'leaving'}
                      onClick={event => { controlRef.current = event.currentTarget; select(index); }} />
                  </li>
                ))}
              </ol>
            </div>
            <div className={styles.controls}>
              <ControlButton iconOnly className={styles.previous} disabled={!ready}
                onClick={event => { controlRef.current = event.currentTarget; step(-1); }}
                aria-label={active === 0 ? 'Back to About' : 'Previous skill'}>
                <ArrowLeft size={19} strokeWidth={1.5} aria-hidden="true" />
              </ControlButton>
              <ControlButton variant="primary" className={styles.next} disabled={!ready}
                onClick={event => { controlRef.current = event.currentTarget; step(1); }}>
                {settledIndex === SKILL_CHAPTERS.length - 1
                  ? 'See projects'
                  : `Next: ${SKILL_CHAPTERS[settledIndex + 1].title}`}
                <ArrowRight size={18} strokeWidth={1.5} aria-hidden="true" />
              </ControlButton>
            </div>
            <p className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">
              {visible && phase === 'reading'
                ? `${active + 1} of ${SKILL_CHAPTERS.length}: ${SKILL_CHAPTERS[active].title}` : ''}
            </p>
          </div>
        )}
      </div>
    </section>
  );

  return (
    <section
      ref={hostRef}
      id="skills"
      className={styles.skills}
      data-staged={staged}
      aria-label="Skills"
      style={{ '--skill-count': SKILL_CHAPTERS.length } as CSSProperties}
    >
      {staged ? createPortal(stage, document.body) : stage}
    </section>
  );
}