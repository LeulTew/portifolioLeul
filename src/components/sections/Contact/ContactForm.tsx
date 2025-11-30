import { motion } from 'framer-motion';
import styles from './ContactForm.module.css';
import { useContactForm } from './useContactForm';

export function ContactForm() {
  const {
    formData,
    handleChange,
    handleSubmit,
    isSubmitting,
    submitStatus,
  } = useContactForm();

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.formGroup}>
        <label htmlFor="name" className={styles.label}>Name</label>
        <input
          type="text"
          id="name"
          name="name"
          required
          className={styles.input}
          value={formData.name}
          onChange={handleChange}
        />
      </div>

      <div className={styles.formGroup}>
        <label htmlFor="email" className={styles.label}>Email</label>
        <input
          type="email"
          id="email"
          name="email"
          required
          className={styles.input}
          value={formData.email}
          onChange={handleChange}
        />
      </div>

      <div className={styles.formGroup}>
        <label htmlFor="message" className={styles.label}>Message</label>
        <textarea
          id="message"
          name="message"
          required
          className={styles.textarea}
          value={formData.message}
          onChange={handleChange}
        />
      </div>

      <motion.button
        type="submit"
        className={styles.submitButton}
        disabled={isSubmitting}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        {isSubmitting ? 'Sending...' : 'Send Message'}
      </motion.button>

      {submitStatus === 'success' && (
        <motion.p
          className={`${styles.message} ${styles.success}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
        >
          Message sent successfully!
        </motion.p>
      )}

      {submitStatus === 'error' && (
        <motion.p
          className={`${styles.message} ${styles.error}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
        >
          Failed to send message. Please try again.
        </motion.p>
      )}
    </form>
  );
}