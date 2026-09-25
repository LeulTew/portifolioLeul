import type { ContactFormData } from './types';

/**
 * Field limits, enforced by the inputs, by validation and again before sending.
 *
 * The public EmailJS keys mean the form is not the only way to reach the
 * service, but nothing leaving this page is unbounded.
 */
export const CONTACT_LIMITS = {
  name: 120,
  email: 254,
  message: 5000,
} as const satisfies Record<keyof ContactFormData, number>;

/** The counter appears only once the message nears its limit. */
export const CONTACT_COUNT_FROM = Math.floor(CONTACT_LIMITS.message * 0.9);

export function exceedsContactLimits(draft: ContactFormData): boolean {
  return (Object.keys(CONTACT_LIMITS) as (keyof ContactFormData)[])
    .some(field => draft[field].length > CONTACT_LIMITS[field]);
}

/**
 * Budget for the whole email-app fallback URL.
 *
 * Mail handlers truncate or refuse long `mailto:` URLs (about 2,000 characters
 * on several Windows clients), and non-Latin text encodes to several times its
 * length. The subject, recipient and header lines count too: a long name falls
 * back to a generic subject and, if the headers alone would overflow, is
 * trimmed; past the budget the message is trimmed with an explicit note. The
 * whole draft always stays in the form.
 */
export const CONTACT_MAILTO_BUDGET = 2000;
const SUBJECT_BUDGET = 240;
const TRIMMED_NOTE = '\n\n[Trimmed for your email app. The full message is still in the form.]';

/** The longest prefix, in whole characters, whose encoding with `suffix` fits `budget`. */
function fittingPrefix(text: string, budget: number, encode: (prefix: string) => string): string {
  const characters = Array.from(text);
  let low = 0;
  let high = characters.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (encode(characters.slice(0, middle).join('')).length <= budget) low = middle;
    else high = middle - 1;
  }
  return characters.slice(0, low).join('');
}

export function contactEmailDraft(to: string, draft: ContactFormData): string {
  const personal = encodeURIComponent(`Portfolio message from ${draft.name.trim() || 'a visitor'}`);
  const subject = personal.length <= SUBJECT_BUDGET ? personal : encodeURIComponent('Portfolio message');
  const prefix = `mailto:${to}?subject=${subject}&body=`;
  const budget = CONTACT_MAILTO_BUDGET - prefix.length;
  const compose = (name: string, message: string) =>
    encodeURIComponent(`Name: ${name}\nEmail: ${draft.email}\n\n${message}`);
  let name = draft.name;
  if (compose(name, TRIMMED_NOTE).length > budget) {
    name = `${fittingPrefix(draft.name, budget, kept => compose(`${kept}…`, TRIMMED_NOTE))}…`;
  }
  let body = compose(name, draft.message);
  if (body.length > budget) {
    body = compose(name, fittingPrefix(draft.message, budget, kept => compose(name, kept + TRIMMED_NOTE)) + TRIMMED_NOTE);
  }
  return prefix + body;
}
