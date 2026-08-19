import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Mail, Phone, MapPin, Github, Linkedin, Send } from 'lucide-react';
import emailjs from '@emailjs/browser';
import { TelegramIcon } from '../../ui/TelegramIcon';
import styles from './Contact.module.css';
import { cvData } from '../../../data/cv';

export function Contact() {
  const containerRef = useRef<HTMLElement>(null);
  const [formState, setFormState] = useState({
    name: '',
    email: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID || 'service_default';
      const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID || 'template_default';
      const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY || 'public_key_default';

      if (serviceId !== 'service_default' && publicKey !== 'public_key_default') {
        await emailjs.send(
          serviceId,
          templateId,
          {
            from_name: formState.name,
            from_email: formState.email,
            message: formState.message,
          },
          publicKey
        );
      } else {
        await new Promise((resolve) => setTimeout(resolve, 1200));
      }

      setSubmitStatus('success');
      setFormState({ name: '', email: '', message: '' });
    } catch {
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setSubmitStatus('idle'), 5000);
    }
  };

  return (
    <section ref={containerRef} className={styles.contact} id="contact">
      <div className={styles.content}>
        <div className={styles.header}>
          <motion.h2 
            className={styles.title}
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            Let's Connect
          </motion.h2>
          <motion.p 
            className={styles.subtitle}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            Get in touch for opportunities or just to say hi
          </motion.p>
        </div>

        <div className={styles.grid}>
          <motion.div 
            className={styles.formContainer}
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.inputGroup}>
                <input
                  type="text"
                  placeholder="Name"
                  value={formState.name}
                  onChange={e => setFormState({...formState, name: e.target.value})}
                  className={styles.input}
                  required
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={formState.email}
                  onChange={e => setFormState({...formState, email: e.target.value})}
                  className={styles.input}
                  required
                />
              </div>
              <textarea
                placeholder="Message"
                value={formState.message}
                onChange={e => setFormState({...formState, message: e.target.value})}
                className={styles.textarea}
                required
              />
              <button 
                type="submit" 
                className={styles.submitButton}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Sending...' : (
                  <>
                    Send Message <Send size={18} />
                  </>
                )}
              </button>
              {submitStatus === 'success' && (
                <p className={styles.successMessage}>Message sent successfully!</p>
              )}
              {submitStatus === 'error' && (
                <p className={styles.errorMessage}>Failed to send message. Please try again.</p>
              )}
            </form>
          </motion.div>

          <motion.div 
            className={styles.contactInfo}
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <div className={styles.infoItem}>
              <Phone className={styles.icon} />
              <div>
                <h3 className={styles.infoLabel}>Phone</h3>
                <p className={styles.infoValue}>{cvData.contact.phone}</p>
              </div>
            </div>
            <div className={styles.infoItem}>
              <Mail className={styles.icon} />
              <div>
                <h3 className={styles.infoLabel}>Email</h3>
                <p className={styles.infoValue}>{cvData.contact.email}</p>
              </div>
            </div>
            <div className={styles.infoItem}>
              <MapPin className={styles.icon} />
              <div>
                <h3 className={styles.infoLabel}>Location</h3>
                <p className={styles.infoValue}>{cvData.contact.location}</p>
              </div>
            </div>

            <div className={styles.socialLinks}>
              <a href={cvData.contact.social.github} target="_blank" rel="noopener noreferrer" className={styles.socialLink} aria-label="GitHub">
                <Github size={24} />
              </a>
              <a href={cvData.contact.social.linkedin} target="_blank" rel="noopener noreferrer" className={styles.socialLink} aria-label="LinkedIn">
                <Linkedin size={24} />
              </a>
              <a href={cvData.contact.social.telegram} target="_blank" rel="noopener noreferrer" className={styles.socialLink} aria-label="Telegram">
                <TelegramIcon />
              </a>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}