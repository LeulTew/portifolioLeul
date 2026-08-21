import { useRef } from 'react';
import { motion } from 'framer-motion';
import { Mail, Phone, MapPin, Github, Linkedin } from 'lucide-react';
import { TelegramIcon } from '../../ui/TelegramIcon';
import { KineticHeading } from '../../ui/KineticText';
import { ContactForm } from './ContactForm';
import { soundFx } from '@/lib/gateways/soundFx';
import styles from './Contact.module.css';
import { cvData } from '../../../data/cv';

export function Contact() {
  const containerRef = useRef<HTMLElement>(null);

  const handleSocialHover = () => {
    soundFx.playMagneticSnap();
  };

  return (
    <section ref={containerRef} className={styles.contact} id="contact">
      <div className={styles.content}>
        <div className={styles.header}>
          <KineticHeading 
            text="Let's Connect" 
            as="h2" 
            className={styles.title} 
            highlightWords={["Connect"]} 
          />
          <p className={styles.subtitle}>
            Get in touch for engineering opportunities, collaborative 3D builds, or just to say hi
          </p>
        </div>

        <div className={styles.grid}>
          <motion.div 
            className={styles.formContainer}
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.76, 0, 0.24, 1] }}
          >
            <ContactForm />
          </motion.div>

          <motion.div 
            className={styles.contactInfo}
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.76, 0, 0.24, 1], delay: 0.15 }}
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

            <div>
              <div className={styles.socialLinks}>
                <a 
                  href={cvData.contact.social.github} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className={styles.socialLink} 
                  aria-label="GitHub"
                  onMouseEnter={handleSocialHover}
                >
                  <Github size={22} />
                </a>
                <a 
                  href={cvData.contact.social.linkedin} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className={styles.socialLink} 
                  aria-label="LinkedIn"
                  onMouseEnter={handleSocialHover}
                >
                  <Linkedin size={22} />
                </a>
                <a 
                  href={cvData.contact.social.telegram} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className={styles.socialLink} 
                  aria-label="Telegram"
                  onMouseEnter={handleSocialHover}
                >
                  <TelegramIcon />
                </a>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}