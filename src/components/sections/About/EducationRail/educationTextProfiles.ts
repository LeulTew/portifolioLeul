export type EducationTextStyle = 'fold' | 'letterpress' | 'decode' | 'flow';
export type EducationTextMotion =
  | 'fold' | 'wipe' | 'slide' | 'press' | 'wave' | 'blur'
  | 'type' | 'decrypt' | 'count';

const TEXT_CUES = {
  title: 0,
  institution: 0,
  award: 30,
  kind: 50,
  'period-label': 110,
  period: 150,
  summary: 20,
  'build-group': 80,
  'course-group': 100,
  project: 160,
  course: 170,
  date: 190,
  'score-label': 120,
  'score-value': 140,
  'score-scale': 220,
} as const;

export type EducationTextRole = keyof typeof TEXT_CUES;
export type EducationTextProfile = Readonly<
  Record<Exclude<EducationTextRole, 'course'>, EducationTextMotion> & {
    course: readonly [EducationTextMotion, ...EducationTextMotion[]];
  }
>;

export const EDUCATION_TEXT_PROFILES = {
  fold: {
    title: 'fold', institution: 'slide', award: 'fold', kind: 'press',
    'period-label': 'wipe', period: 'slide', summary: 'wipe',
    'build-group': 'fold', 'course-group': 'wipe', project: 'slide', course: ['wipe', 'slide', 'fold'],
    date: 'slide', 'score-label': 'press', 'score-value': 'count', 'score-scale': 'wipe',
  },
  letterpress: {
    title: 'press', institution: 'wipe', award: 'press', kind: 'wipe',
    'period-label': 'slide', period: 'fold', summary: 'slide',
    'build-group': 'press', 'course-group': 'wipe', project: 'fold', course: ['press', 'fold', 'wipe', 'slide'],
    date: 'wipe', 'score-label': 'wipe', 'score-value': 'press', 'score-scale': 'slide',
  },
  decode: {
    title: 'decrypt', institution: 'slide', award: 'slide', kind: 'decrypt',
    'period-label': 'type', period: 'decrypt', summary: 'wipe',
    'build-group': 'type', 'course-group': 'decrypt', project: 'type', course: ['slide', 'wipe', 'decrypt'],
    date: 'decrypt', 'score-label': 'type', 'score-value': 'count', 'score-scale': 'slide',
  },
  flow: {
    title: 'wave', institution: 'slide', award: 'wave', kind: 'press',
    'period-label': 'slide', period: 'fold', summary: 'blur',
    'build-group': 'wave', 'course-group': 'wipe', project: 'wipe', course: ['wave', 'wipe'],
    date: 'fold', 'score-label': 'slide', 'score-value': 'count', 'score-scale': 'wipe',
  },
} as const satisfies Record<EducationTextStyle, EducationTextProfile>;

const TEXT_WINDOWS: Record<EducationTextStyle, { start: number; end: number }> = {
  fold: { start: 420, end: 960 },
  letterpress: { start: 460, end: 950 },
  decode: { start: 400, end: 990 },
  flow: { start: 440, end: 970 },
};

const MOTIONS: ReadonlySet<string> = new Set<EducationTextMotion>([
  'fold', 'wipe', 'slide', 'press', 'wave', 'blur', 'type', 'decrypt', 'count',
]);

function isTextMotion(value: string): value is EducationTextMotion {
  return MOTIONS.has(value);
}

function isTextRole(value: string): value is EducationTextRole {
  return Object.prototype.hasOwnProperty.call(TEXT_CUES, value);
}

export function educationTextStyle(value = 'fold'): EducationTextStyle {
  switch (value) {
    case 'fold': case 'letterpress': case 'decode': case 'flow': return value;
    default: throw new Error(`Unknown Education text style: ${value}`);
  }
}

export interface EducationTextPart {
  element: HTMLElement;
  motion: EducationTextMotion;
  role: EducationTextRole;
  start: number;
  end: number;
}

export function educationTextParts(record: HTMLElement): EducationTextPart[] {
  const window = TEXT_WINDOWS[educationTextStyle(record.dataset.textStyle)];
  const parts: EducationTextPart[] = [];
  const groups = new Map<EducationTextRole, EducationTextPart[]>();
  for (const element of record.querySelectorAll<HTMLElement>('[data-edu-text]')) {
    const motion = element.dataset.eduText ?? '';
    if (motion === 'split') continue;
    const role = element.dataset.eduRole ?? 'course';
    if (!isTextMotion(motion) || !isTextRole(role)) {
      throw new Error(`Invalid Education text treatment: ${role}/${motion}`);
    }
    const part = { element, motion, role, start: window.start + TEXT_CUES[role], end: window.end };
    parts.push(part);
    const group = groups.get(role) ?? [];
    group.push(part);
    groups.set(role, group);
  }
  for (const group of groups.values()) {
    group.forEach((part, index) => {
      // A dense course list spends the same bounded cue window as a short one.
      part.start += group.length > 1 ? index / (group.length - 1) * 60 : 0;
    });
  }
  return parts;
}
