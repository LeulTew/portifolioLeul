import { useEffect, useId, useLayoutEffect, useRef, type FormEvent } from 'react';
import { ArrowUpRight, Loader2 } from 'lucide-react';
import { ControlButton } from '../../ui/ControlButton';
import styles from './ContactForm.module.css';
import { useContactForm } from './useContactForm';
import { cvData } from '@/data/cv';
import { usePrefersReducedMotion } from '@/lib/gateways/animationGateway';
import { CONTACT_PAPER_PLANE, useContactSendFlight } from './contactSendFlight';
import { CONTACT_DELIVERY_MESSAGES } from './contactDelivery';
import { CONTACT_COUNT_FROM, CONTACT_LIMITS, contactEmailDraft } from './contactLimits';
import { requestReveal } from '@/lib/scroll/layerFocus';

export function ContactForm({ flightEnabled = true }: { flightEnabled?: boolean }) {
  const {
    formData,
    errors,
    handleChange,
    handleSubmit,
    isSubmitting,
    submitStatus,
    submitError,
    resetForm,
  } = useContactForm();
  const stage = useRef<HTMLDivElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const nameField = useRef<HTMLInputElement>(null);
  const submitButton = useRef<HTMLButtonElement>(null);
  const anotherButton = useRef<HTMLButtonElement>(null);
  const errorNotice = useRef<HTMLParagraphElement>(null);
  const headingId = useId();
  const focusNewDraft = useRef(false);
  const accepted = submitStatus === 'success';
  const reduced = usePrefersReducedMotion();
  const phase = useContactSendFlight(stage, accepted, reduced, flightEnabled);
  const retired = accepted && phase === 'sent';
  const readOnly = isSubmitting || accepted;
  const emailDraft = contactEmailDraft(cvData.contact.email, formData);
  const counting = formData.message.length >= CONTACT_COUNT_FROM;
  const messageDescription = [errors.message && 'contact-message-error', counting && 'contact-message-count']
    .filter(Boolean).join(' ') || undefined;

  useLayoutEffect(() => {
    const node = form.current;
    if (!node) return;
    const ownsFocus = document.activeElement === stage.current || node.contains(document.activeElement);
    if (accepted && !retired && node.contains(document.activeElement) && !stage.current?.closest('[inert]')) {
      stage.current?.focus({ preventScroll: true });
    }
    if (retired && ownsFocus && !stage.current?.closest('[inert]')) {
      anotherButton.current?.focus({ preventScroll: true });
    }
    node.toggleAttribute('inert', retired);
    if (retired) node.setAttribute('aria-hidden', 'true');
    else node.removeAttribute('aria-hidden');
    if (!accepted && focusNewDraft.current) {
      focusNewDraft.current = false;
      nameField.current?.focus({ preventScroll: true });
    } else if (submitStatus === 'error' && !isSubmitting &&
        document.activeElement === stage.current && !node.closest('[inert]')) {
      submitButton.current?.focus({ preventScroll: true });
    }
  }, [accepted, retired, submitStatus, isSubmitting]);

  // A failed send shows its notice and the draft link whole, not cut off by the window's edge.
  useEffect(() => {
    if (submitStatus === 'error' && !isSubmitting && errorNotice.current) requestReveal(errorNotice.current);
  }, [submitStatus, submitError, isSubmitting]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    // The stable stage outlives both the disabled button and the departing sheet.
    if (form.current?.contains(document.activeElement)) stage.current?.focus({ preventScroll: true });
    void handleSubmit(event);
  };

  const startAnotherMessage = () => {
    focusNewDraft.current = true;
    resetForm();
  };

  return (
    <div ref={stage} className={styles.stage} tabIndex={-1} role="group" aria-label="Message submission"
      aria-busy={isSubmitting} data-send-phase={accepted ? phase : 'ready'}>
      <div className={styles.sheet} data-send-sheet>
        <form ref={form} className={styles.form} onSubmit={submit} aria-labelledby={headingId}
          aria-busy={isSubmitting} data-status={submitStatus}>
          <header className={styles.heading}>
            <h3 id={headingId}>Send a message</h3>
            <p>A project, an opportunity, or just hello.</p>
          </header>
          <div className={styles.identity}>
            <div className={styles.formGroup}>
              <label htmlFor="name" className={styles.label}>Name</label>
              <input
                ref={nameField}
                type="text"
                id="name"
                name="name"
                autoComplete="name"
                required
                maxLength={CONTACT_LIMITS.name}
                readOnly={readOnly}
                tabIndex={accepted ? -1 : undefined}
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? 'contact-name-error' : undefined}
                className={styles.input}
                value={formData.name}
                onChange={handleChange}
                placeholder="Your name"
              />
              {errors.name && <p id="contact-name-error" className={`${styles.message} ${styles.error}`} role="alert">{errors.name}</p>}
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="email" className={styles.label}>Email</label>
              <input
                type="email"
                id="email"
                name="email"
                autoComplete="email"
                required
                maxLength={CONTACT_LIMITS.email}
                readOnly={readOnly}
                tabIndex={accepted ? -1 : undefined}
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? 'contact-email-error' : undefined}
                className={styles.input}
                value={formData.email}
                onChange={handleChange}
                placeholder="you@example.com"
              />
              {errors.email && <p id="contact-email-error" className={`${styles.message} ${styles.error}`} role="alert">{errors.email}</p>}
            </div>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="message" className={styles.label}>Message</label>
            <textarea
              id="message"
              name="message"
              required
              maxLength={CONTACT_LIMITS.message}
              readOnly={readOnly}
              tabIndex={accepted ? -1 : undefined}
              aria-invalid={!!errors.message}
              aria-describedby={messageDescription}
              className={styles.textarea}
              value={formData.message}
              onChange={handleChange}
              placeholder="What would you like to build?"
            />
            {counting && <p id="contact-message-count" className={`${styles.message} ${styles.count}`}>
              {formData.message.length.toLocaleString('en-US')} / {CONTACT_LIMITS.message.toLocaleString('en-US')} characters
            </p>}
            {errors.message && <p id="contact-message-error" className={`${styles.message} ${styles.error}`} role="alert">{errors.message}</p>}
          </div>

          <div className={styles.submitRow}>
            <ControlButton
              ref={submitButton}
              type="submit"
              disabled={readOnly}
              variant="primary"
              className={styles.submitButton}
            >
              {isSubmitting ? 'Sending...' : 'Send Message'}
              {isSubmitting
                ? <Loader2 size={20} className={styles.sendingIcon} aria-hidden="true" />
                : <ArrowUpRight size={22} aria-hidden="true" />}
            </ControlButton>
          </div>

          {submitStatus === 'error' && (
            <p ref={errorNotice} role="alert" className={`${styles.message} ${styles.error}`}>
              <span>{CONTACT_DELIVERY_MESSAGES[submitError ?? 'network']}</span>{' '}
              <a
                className={styles.fallbackLink}
                href={emailDraft}
              >
                Open this draft in your email app
              </a>
            </p>
          )}
        </form>
        <svg className={styles.paper} data-send-paper viewBox="0 0 200 160" preserveAspectRatio="none" aria-hidden="true">
          <path className={styles.paperOutline} data-send-outline d={CONTACT_PAPER_PLANE.outline} />
          <path className={styles.paperWing} data-send-wing d="M0 0L0 80L0 160Z" />
          <path className={styles.paperTail} data-send-tail d="M200 0L200 80L200 160Z" />
          <path className={styles.paperKeel} data-send-keel d="M0 160L100 160L200 160Z" />
          <path className={styles.paperCrease} data-send-crease d={CONTACT_PAPER_PLANE.crease} />
        </svg>
      </div>
      <div className={styles.confirmation} hidden={!accepted}>
        {accepted && <>
          <h3>Submitted.</h3>
          <p role="status" className={`${styles.message} ${styles.success}`}>The email service accepted your message.</p>
          <p className={`${styles.message} ${styles.deliveryNote}`}>Inbox delivery isn't confirmed here. For a direct follow-up:</p>
          <a className={styles.fallbackLink} href={emailDraft}>Open this draft in your email app</a>
          <ControlButton ref={anotherButton} className={styles.anotherButton} onClick={startAnotherMessage}>
            Send another message
          </ControlButton>
        </>}
      </div>
    </div>
  );
}