import {
  CONTACT_SEND_ENDPOINT,
  CONTACT_SEND_TIMEOUT_MS,
  ContactDeliveryError,
  getContactDeliveryConfig,
  sendContactMessage,
} from './contactDelivery';

vi.unmock('@/components/sections/Contact/contactDelivery');

const draft = { name: ' Ada & Leul ', email: ' ada@example.com ', message: '  A draft\n<not markup>' };
const config = { serviceId: 'service_test', templateId: 'template_test', publicKey: 'public_test' };
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock.mockReset().mockResolvedValue(new Response('OK', { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function pendingFetch() {
  fetchMock.mockImplementationOnce((_url, options) => new Promise((_resolve, reject) => {
    options?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  }));
}

it('sends the documented public-key request with both reply-to aliases and no client-controlled recipient', async () => {
  await sendContactMessage(draft, config, new AbortController().signal);
  expect(fetchMock).toHaveBeenCalledOnce();
  const [url, options] = fetchMock.mock.calls[0];
  expect(url).toBe(CONTACT_SEND_ENDPOINT);
  expect(options).toMatchObject({ method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json' } });
  expect(options?.signal).toBeInstanceOf(AbortSignal);
  expect(JSON.parse(String(options?.body))).toEqual({
    service_id: 'service_test',
    template_id: 'template_test',
    user_id: 'public_test',
    template_params: {
      from_name: 'Ada & Leul',
      from_email: 'ada@example.com',
      reply_to: 'ada@example.com',
      message: '  A draft\n<not markup>',
    },
  });
  expect(vi.getTimerCount()).toBe(0);
});

it('normalizes complete public configuration and fails explicitly before a request for missing settings', () => {
  vi.stubEnv('VITE_EMAILJS_SERVICE_ID', ' service_test ');
  vi.stubEnv('VITE_EMAILJS_TEMPLATE_ID', ' template_test\n');
  vi.stubEnv('VITE_EMAILJS_PUBLIC_KEY', ' public_test ');
  expect(getContactDeliveryConfig()).toEqual(config);
  vi.stubEnv('VITE_EMAILJS_TEMPLATE_ID', ' ');
  expect(getContactDeliveryConfig).toThrowError(new ContactDeliveryError('configuration'));
  expect(fetchMock).not.toHaveBeenCalled();
});

it.each([400, 401, 403, 429, 500])('does not accept HTTP %s or expose provider response content', async status => {
  fetchMock.mockResolvedValueOnce(new Response('Provider detail that must not appear in the UI', { status }));
  await expect(sendContactMessage(draft, config, new AbortController().signal)).rejects.toMatchObject({
    kind: status === 429 ? 'rate-limit' : 'rejected',
    status,
    message: `Contact submission: ${status === 429 ? 'rate-limit' : 'rejected'} (${status})`,
  });
  expect(vi.getTimerCount()).toBe(0);
});

it('classifies a network failure without claiming the provider did not receive the request', async () => {
  fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
  await expect(sendContactMessage(draft, config, new AbortController().signal))
    .rejects.toMatchObject({ kind: 'network' });
  expect(vi.getTimerCount()).toBe(0);
});

it('aborts a stalled request at the deadline without automatically sending again', async () => {
  pendingFetch();
  const rejection = expect(sendContactMessage(draft, config, new AbortController().signal))
    .rejects.toMatchObject({ kind: 'timeout' });
  await vi.advanceTimersByTimeAsync(CONTACT_SEND_TIMEOUT_MS);
  await rejection;
  expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
  expect(fetchMock).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});

it('forwards owner cancellation and clears its timer', async () => {
  pendingFetch();
  const owner = new AbortController();
  const rejection = expect(sendContactMessage(draft, config, owner.signal))
    .rejects.toMatchObject({ kind: 'cancelled' });
  owner.abort();
  await rejection;
  expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});

it('does not start a request for an already cancelled owner', async () => {
  const owner = new AbortController();
  owner.abort();
  await expect(sendContactMessage(draft, config, owner.signal)).rejects.toMatchObject({ kind: 'cancelled' });
  expect(fetchMock).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});
