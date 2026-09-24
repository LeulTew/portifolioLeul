import {
  CONTACT_LIMITS,
  CONTACT_MAILTO_BODY_BUDGET,
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

it('trims a long non-Latin draft to the mailto budget without splitting a character', () => {
  const message = 'ሰላም 👋 '.repeat(800);
  const draft = { name: 'አበበ', email: 'abebe@example.com', message };
  const encoded = encodedBody(contactEmailDraft('leul@example.com', draft));
  expect(encoded.length).toBeLessThanOrEqual(CONTACT_MAILTO_BODY_BUDGET);
  // A split surrogate pair would make this throw.
  const decoded = decodeURIComponent(encoded);
  expect(decoded.endsWith(NOTE)).toBe(true);
  const header = `Name: ${draft.name}\nEmail: ${draft.email}\n\n`;
  const kept = decoded.slice(header.length, decoded.length - NOTE.length);
  expect(kept.length).toBeGreaterThan(0);
  expect(message.startsWith(kept)).toBe(true);
});
