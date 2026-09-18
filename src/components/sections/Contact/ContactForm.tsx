import { ArrowUpRight, Loader2 } from 'lucide-react';
import { ControlButton } from '../../ui/ControlButton';
import styles from './ContactForm.module.css';
import { useContactForm } from './useContactForm';
import { cvData } from '@/data/cv';

export function ContactForm() {
  const {
    formData,
    errors,
    handleChange,
    handleSubmit,
    isSubmitting,
    submitStatus,
  } = useContactForm();

  return (
    <form className={styles.form} onSubmit={handleSubmit} aria-busy={isSubmitting} data-status={submitStatus}>
      <header className={styles.heading}>
        <h3>Send a message</h3>
        <p>A project, an opportunity, or just hello.</p>
      </header>
      <div className={styles.identity}>
      <div className={styles.formGroup}>
        <label htmlFor="name" className={styles.label}>Name</label>
        <input
          type="text"
          id="name"
          name="name"
          autoComplete="name"
          required
          readOnly={isSubmitting}
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
          readOnly={isSubmitting}
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
          readOnly={isSubmitting}
          aria-invalid={!!errors.message}
          aria-describedby={errors.message ? 'contact-message-error' : undefined}
          className={styles.textarea}
          value={formData.message}
          onChange={handleChange}
          placeholder="What would you like to build?"
        />
        {errors.message && <p id="contact-message-error" className={`${styles.message} ${styles.error}`} role="alert">{errors.message}</p>}
      </div>

      <div className={styles.submitRow}>
        <ControlButton
          type="submit"
          disabled={isSubmitting}
          variant="primary"
          className={styles.submitButton}
        >
          {isSubmitting ? 'Sending...' : 'Send Message'}
          {isSubmitting
            ? <Loader2 size={20} className={styles.sendingIcon} aria-hidden="true" />
            : <ArrowUpRight size={22} aria-hidden="true" />}
        </ControlButton>
      </div>

      {submitStatus === 'success' && (
        <p
          role="status"
          className={`${styles.message} ${styles.success}`}
        >
          Message sent successfully!
        </p>
      )}

      {submitStatus === 'error' && (
        <p
          role="alert"
          className={`${styles.message} ${styles.error}`}
        >
          <span>Failed to send message. Please try again.</span>{' '}
          <a
            className={styles.fallbackLink}
            href={`mailto:${cvData.contact.email}?subject=${encodeURIComponent(`Portfolio message from ${formData.name.trim() || 'a visitor'}`)}&body=${encodeURIComponent(`Name: ${formData.name}\nEmail: ${formData.email}\n\n${formData.message}`)}`}
          >
            Open this draft in your email app
          </a>
        </p>
      )}
    </form>
  );
}