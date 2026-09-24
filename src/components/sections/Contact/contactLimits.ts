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
 * Encoded body budget for the email-app fallback.
 *
 * Mail handlers truncate or refuse long `mailto:` URLs (about 2,000 characters
 * on several Windows clients), and non-Latin text encodes to several times its
 * length. Past the budget the body is trimmed with an explicit note; the whole
 * draft stays in the form.
 */
export const CONTACT_MAILTO_BODY_BUDGET = 1800;
const TRIMMED_NOTE = '\n\n[Trimmed for your email app. The full message is still in the form.]';

export function contactEmailDraft(to: string, draft: ContactFormData): string {
  const subject = encodeURIComponent(`Portfolio message from ${draft.name.trim() || 'a visitor'}`);
  const compose = (message: string) =>
    encodeURIComponent(`Name: ${draft.name}\nEmail: ${draft.email}\n\n${message}`);
  let body = compose(draft.message);
  if (body.length > CONTACT_MAILTO_BODY_BUDGET) {
    const characters = Array.from(draft.message);
    let low = 0;
    let high = characters.length;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (compose(characters.slice(0, middle).join('') + TRIMMED_NOTE).length <= CONTACT_MAILTO_BODY_BUDGET) low = middle;
      else high = middle - 1;
    }
    body = compose(characters.slice(0, low).join('') + TRIMMED_NOTE);
  }
  return `mailto:${to}?subject=${subject}&body=${body}`;
}
