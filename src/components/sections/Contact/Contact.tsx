import { useRef } from 'react';
import { motion } from 'framer-motion';
import { Mail, Phone, MapPin, Github, Linkedin } from 'lucide-react';
import { TelegramIcon } from '../../ui/TelegramIcon';
import { KineticHeading } from '../../ui/KineticText';
import { ContactForm } from './ContactForm';
import { soundFx } from '@/lib/gateways/soundFx';
import { getPrefersReducedMotion } from '@/lib/gateways/animationGateway';
import styles from './Contact.module.css';
import { cvData } from '../../../data/cv';
import { FocusScrim } from '../../ui/FocusScrim';
import { useSectionEntrance } from '@/lib/scroll/useSectionFocus';

export function Contact() {
  const containerRef = useRef<HTMLElement>(null);
  const reducedMotion = getPrefersReducedMotion();
  const formEntrance = useSectionEntrance(!reducedMotion);
  const infoEntrance = useSectionEntrance(!reducedMotion);

  const handleSocialHover = () => {
    soundFx.playMagneticSnap();
  };

  return (
    <section ref={containerRef} className={styles.contact} id="contact">
      {/* Left as a veil on purpose: the camera arc comes to rest here, on the
          shot that turns the television to face the viewer. Covering this
          section would hide the payoff of the whole scroll. */}
      <FocusScrim />
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
            ref={formEntrance.ref}
            className={styles.formContainer}
            initial={reducedMotion ? false : { opacity: 0, x: -40 }}
            animate={reducedMotion ? undefined : formEntrance.hasEntered
              ? { opacity: 1, x: 0 } : { opacity: 0, x: -40 }}
            transition={{ duration: 0.8, ease: [0.76, 0, 0.24, 1] }}
          >
            <ContactForm />
          </motion.div>

          <motion.div 
            ref={infoEntrance.ref}
            className={styles.contactInfo}
            initial={reducedMotion ? false : { opacity: 0, x: 40 }}
            animate={reducedMotion ? undefined : infoEntrance.hasEntered
              ? { opacity: 1, x: 0 } : { opacity: 0, x: 40 }}
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