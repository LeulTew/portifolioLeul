import { describe, expect, it } from 'vitest';
import { requestAddress, unexcusedRefusals } from './requestGate';

const endpoint = 'https://api.emailjs.com/api/v1.0/email/send';
const refusal = (url: string, reason = 'net::ERR_FAILED') => ({ url, reason });

describe('unexcusedRefusals', () => {
  it('counts every refusal when nothing was failed on purpose', () => {
    const refused = [refusal('http://127.0.0.1:4320/models/island.glb', 'HTTP 404'), refusal('https://fonts.example/x.woff2')];
    expect(unexcusedRefusals(refused)).toEqual(refused);
  });

  it('excuses only the addresses the pass failed, and only while it failed them', () => {
    const before = refusal('https://cdn.example/lib.js');
    const sent = refusal(endpoint);
    const alongside = refusal('https://tracker.example/pixel');
    const after = refusal(`${endpoint}?retry=1`);
    const refused = [before, sent, alongside, after];
    // Round 41 (TECH-091): every off-origin failure of the form pass was excused, before and after the send.
    expect(unexcusedRefusals(refused, { from: 1, to: 3, addresses: new Set([requestAddress(endpoint)]) }))
      .toEqual([before, alongside, after]);
  });

  it('reads an address as origin and path, and leaves an unparsable one as it is', () => {
    expect(requestAddress(`${endpoint}?a=1#b`)).toBe(endpoint);
    expect(requestAddress('(unknown)')).toBe('(unknown)');
  });
});
