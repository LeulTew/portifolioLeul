import {
  CONTACT_LIMITS,
  CONTACT_MAILTO_BUDGET,
  contactEmailDraft,
  exceedsContactLimits,
} from './contactLimits';

const encodedBody = (url: string) => url.slice(url.indexOf('&body=') + '&body='.length);
const NOTE = '\n\n[Trimmed for your email app. The full message is still in the form.]';

it('flags a draft only when a field passes its limit', () => {
  const draft = { name: 'n'.repeat(CONTACT_LIMITS.name), email: 'a@b.co', message: 'm'.repeat(CONTACT_LIMITS.message) };
  expect(exceedsContactLimits(draft)).toBe(false);
  expect(exceedsContactLimits({ ...draft, name: `${draft.name}n` })).toBe(true);
  expect(exceedsContactLimits({ ...draft, email: `${'e'.repeat(CONTACT_LIMITS.email)}@x` })).toBe(true);
  expect(exceedsContactLimits({ ...draft, message: `${draft.message}m` })).toBe(true);
});

it('keeps a short draft whole in the email-app fallback', () => {
  const url = contactEmailDraft('leul@example.com', { name: ' Ada ', email: 'ada@example.com', message: 'Hello & welcome' });
  expect(url).toBe(`mailto:leul@example.com?subject=${encodeURIComponent('Portfolio message from Ada')}` +
    `&body=${encodeURIComponent('Name:  Ada \nEmail: ada@example.com\n\nHello & welcome')}`);
});

it('trims a long non-Latin draft to the whole-URL budget without splitting a character', () => {
  const message = 'ሰላም 👋 '.repeat(800);
  const draft = { name: 'አበበ', email: 'abebe@example.com', message };
  const url = contactEmailDraft('leul@example.com', draft);
  expect(url.length).toBeLessThanOrEqual(CONTACT_MAILTO_BUDGET);
  // A split surrogate pair would make this throw.
  const decoded = decodeURIComponent(encodedBody(url));
  expect(decoded.endsWith(NOTE)).toBe(true);
  const header = `Name: ${draft.name}\nEmail: ${draft.email}\n\n`;
  const kept = decoded.slice(header.length, decoded.length - NOTE.length);
  expect(kept.length).toBeGreaterThan(0);
  expect(message.startsWith(kept)).toBe(true);
});

it.each([
  ['a 120-character CJK name', '汉'.repeat(CONTACT_LIMITS.name)],
  ['a 120-character emoji name', '🧑🏾‍💻'.repeat(Math.floor(CONTACT_LIMITS.name / 7))],
])('keeps the complete URL in budget for %s at every field limit', (_label, name) => {
  // Round 7 (TECH-011): the body alone was bounded, so the subject and headers pushed this to 2,948 characters.
  const draft = { name, email: `${'r'.repeat(CONTACT_LIMITS.email - 12)}@example.com`, message: '文'.repeat(CONTACT_LIMITS.message) };
  expect(exceedsContactLimits(draft)).toBe(false);
  const url = contactEmailDraft('leul@example.com', draft);
  expect(url.length).toBeLessThanOrEqual(CONTACT_MAILTO_BUDGET);
  expect(url).toContain(`subject=${encodeURIComponent('Portfolio message')}&`);
  const decoded = decodeURIComponent(encodedBody(url));
  expect(decoded.startsWith('Name: ')).toBe(true);
  expect(decoded.endsWith(NOTE)).toBe(true);
});
