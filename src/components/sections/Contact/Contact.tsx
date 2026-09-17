import { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Phone, MapPin, Github, Linkedin } from 'lucide-react';
import { TelegramIcon } from '../../ui/TelegramIcon';
import { KineticHeading } from '../../ui/KineticText';
import { ContactForm } from './ContactForm';
import { soundFx } from '@/lib/gateways/soundFx';
import { usePrefersReducedMotion } from '@/lib/gateways/animationGateway';
import styles from './Contact.module.css';
import { cvData } from '../../../data/cv';
import { FocusScrim } from '../../ui/FocusScrim';
import { useSectionEntrance } from '@/lib/scroll/useSectionFocus';
import { useContactSky } from './useContactSky';

export function Contact({ spatial = false }: { spatial?: boolean }) {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const { instant, mode } = useContactSky(container, spatial);
  const settled = reducedMotion || instant;
  const formEntrance = useSectionEntrance(!reducedMotion);
  const infoEntrance = useSectionEntrance(!reducedMotion);

  const handleSocialHover = () => {
    soundFx.playMagneticSnap();
  };

  return (
    <section
      ref={setContainer} className={styles.contact} id="contact"
      data-contact-spatial={spatial} data-contact-state={mode}
      data-contact-ready={mode !== 'departing' && mode !== 'returning'}
    >
      {!spatial && <div className={styles.flatSky} aria-hidden="true">
        {['body', 'vapor'].map(layer => <img
          key={layer} src={`/textures/hero-cloud/${layer}.webp`} alt="" draggable={false}
          onError={event => {
            console.warn(`Contact sky ${layer} texture unavailable; keeping the readable plain sky.`);
            event.currentTarget.style.visibility = 'hidden';
          }}
        />)}
      </div>}
      <FocusScrim maxOpacity={0.38} />
      <div className={styles.content}>
        <div className={styles.header}>
          <KineticHeading 
            text="Let's Connect" 
            as="h2" 
            className={styles.title} 
            highlightWords={["Connect"]} 
            instant={settled}
          />
          <p className={styles.subtitle}>
            Get in touch for engineering opportunities, collaborative 3D builds, or just to say hi
          </p>
        </div>

        <div className={styles.grid}>
          <motion.div 
            ref={formEntrance.ref}
            className={styles.formContainer}
            initial={settled ? false : { opacity: 0, x: -40 }}
            animate={settled ? { opacity: 1, x: 0 } : formEntrance.hasEntered
              ? { opacity: 1, x: 0 } : { opacity: 0, x: -40 }}
            transition={{ duration: settled ? 0 : 0.8, ease: [0.76, 0, 0.24, 1] }}
          >
            <ContactForm />
          </motion.div>

          <motion.div 
            ref={infoEntrance.ref}
            className={styles.contactInfo}
            initial={settled ? false : { opacity: 0, x: 40 }}
            animate={settled ? { opacity: 1, x: 0 } : infoEntrance.hasEntered
              ? { opacity: 1, x: 0 } : { opacity: 0, x: 40 }}
            transition={{ duration: settled ? 0 : 0.8, ease: [0.76, 0, 0.24, 1], delay: settled ? 0 : 0.15 }}
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
                  <span className={styles.socialIcon} aria-hidden="true"><TelegramIcon /></span>
                </a>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}