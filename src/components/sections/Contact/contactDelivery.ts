import type { ContactFormData } from './types';
import { exceedsContactLimits } from './contactLimits';

export const CONTACT_SEND_TIMEOUT_MS = 20_000;
export const CONTACT_SEND_ENDPOINT = 'https://api.emailjs.com/api/v1.0/email/send';

export type ContactDeliveryFailure =
  | 'configuration'
  | 'network'
  | 'timeout'
  | 'rate-limit'
  | 'rejected'
  | 'cancelled';

export interface ContactDeliveryConfig {
  serviceId: string;
  templateId: string;
  publicKey: string;
}

export class ContactDeliveryError extends Error {
  constructor(
    readonly kind: ContactDeliveryFailure,
    readonly status?: number,
  ) {
    super(`Contact submission: ${kind}${status ? ` (${status})` : ''}`);
    this.name = 'ContactDeliveryError';
  }
}

export function getContactDeliveryConfig(): ContactDeliveryConfig {
  const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID?.trim() ?? '';
  const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID?.trim() ?? '';
  const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY?.trim() ?? '';
  if (!serviceId || !templateId || !publicKey) throw new ContactDeliveryError('configuration');
  return { serviceId, templateId, publicKey };
}

export const CONTACT_DELIVERY_MESSAGES = {
  configuration: 'The form is unavailable right now. You can still email me directly.',
  network: "We couldn't confirm submission. Your draft is still here.",
  timeout: "The email service didn't respond in time. Submission isn't confirmed; your draft is still here.",
  'rate-limit': 'The email service is busy. Wait a minute before trying again, or use your email app.',
  rejected: "The email service couldn't accept this message. Your draft is still here.",
  cancelled: "Submission wasn't confirmed. Your draft is still here.",
} satisfies Record<ContactDeliveryFailure, string>;

export async function sendContactMessage(
  draft: ContactFormData,
  config: ContactDeliveryConfig,
  signal: AbortSignal,
): Promise<void> {
  if (signal.aborted) throw new ContactDeliveryError('cancelled');
  // Validation normally stops this first; nothing oversized leaves the page regardless.
  if (exceedsContactLimits(draft)) throw new ContactDeliveryError('rejected');
  const request = new AbortController();
  const cancel = () => request.abort();
  signal.addEventListener('abort', cancel, { once: true });
  let timedOut = false;
  const deadline = setTimeout(() => {
    timedOut = true;
    request.abort();
  }, CONTACT_SEND_TIMEOUT_MS);

  try {
    const email = draft.email.trim();
    const response = await fetch(CONTACT_SEND_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'omit',
      signal: request.signal,
      body: JSON.stringify({
        service_id: config.serviceId,
        template_id: config.templateId,
        user_id: config.publicKey,
        template_params: {
          from_name: draft.name.trim(),
          from_email: email,
          reply_to: email,
          message: draft.message,
        },
      }),
    });
    await response.text();
    if (request.signal.aborted) throw new ContactDeliveryError('cancelled');
    if (!response.ok) {
      throw new ContactDeliveryError(response.status === 429 ? 'rate-limit' : 'rejected', response.status);
    }
  } catch (error) {
    if (signal.aborted) throw new ContactDeliveryError('cancelled');
    if (timedOut) throw new ContactDeliveryError('timeout');
    if (error instanceof ContactDeliveryError) throw error;
    throw new ContactDeliveryError('network');
  } finally {
    clearTimeout(deadline);
    signal.removeEventListener('abort', cancel);
  }
}
