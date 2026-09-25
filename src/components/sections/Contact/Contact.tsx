import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight, MapPin, Github, Linkedin } from 'lucide-react';
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
import { CONTACT_PAPER_PLANE } from './contactSendFlight';

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
        <div className={styles.grid}>
          <div className={styles.introduction}>
            <div className={styles.header} tabIndex={-1} data-section-landing="contact">
              <svg className={styles.messagePlane} viewBox="0 0 200 160" fill="none" aria-hidden="true">
                <path className={styles.flightPath} d="M8 141C46 146 19 74 59 76C98 78 72 109 117 83" />
                <path className={styles.planeWing} d={CONTACT_PAPER_PLANE.outline} />
                <path className={styles.planeFold} d={CONTACT_PAPER_PLANE.wing} />
                <path className={styles.planeEdge} d={CONTACT_PAPER_PLANE.crease} />
              </svg>
              <KineticHeading
                text="Let's Connect"
                as="h2"
                className={styles.title}
                highlightWords={["Connect"]}
                instant={settled}
              />
              <p className={styles.subtitle}>
                Engineering opportunities, collaborative builds, or a good conversation.
                It starts with a message.
              </p>
            </div>

            <motion.div
              ref={infoEntrance.ref}
              className={styles.contactInfo}
              initial={settled ? false : { opacity: 0, y: 20 }}
              animate={settled ? { opacity: 1, y: 0 } : infoEntrance.hasEntered
                ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ duration: settled ? 0 : 0.65, ease: [0.22, 1, 0.36, 1] }}
            >
              <a className={styles.emailLink} href={`mailto:${cvData.contact.email}`} aria-label={`Email ${cvData.contact.email}`}>
                <span>
                  <span className={styles.infoLabel}>Email</span>
                  <span className={styles.emailAddress}>{cvData.contact.email}</span>
                </span>
                <ArrowUpRight size={28} aria-hidden="true" />
              </a>

              <div className={styles.detailsRow}>
                <a className={styles.phoneLink} href={`tel:${cvData.contact.phone.replace(/[^\d+]/g, '')}`} aria-label={`Phone ${cvData.contact.phone}`}>
                  <span className={styles.infoLabel}>Phone</span>
                  <span className={styles.infoValue}>{cvData.contact.phone}</span>
                </a>
                <div className={styles.location}>
                  <span className={styles.infoLabel}>Location</span>
                  <span className={styles.infoValue}>
                    <MapPin size={16} aria-hidden="true" />
                    {cvData.contact.location}
                  </span>
                </div>
              </div>

              <div className={styles.socialLinks}>
                <a
                  href={cvData.contact.social.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.socialLink}
                  aria-label="GitHub"
                  onMouseEnter={handleSocialHover}
                >
                  <Github size={18} aria-hidden="true" />
                  <span>GitHub</span>
                </a>
                <a
                  href={cvData.contact.social.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.socialLink}
                  aria-label="LinkedIn"
                  onMouseEnter={handleSocialHover}
                >
                  <Linkedin size={18} aria-hidden="true" />
                  <span>LinkedIn</span>
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
                  <span>Telegram</span>
                </a>
              </div>
            </motion.div>
          </div>

          <motion.div
            ref={formEntrance.ref}
            className={styles.formContainer}
            data-contact-form-entrance
            initial={settled ? false : { opacity: 0, x: 28 }}
            animate={settled ? { opacity: 1, x: 0 } : formEntrance.hasEntered
              ? { opacity: 1, x: 0 } : { opacity: 0, x: 28 }}
            transition={{ duration: settled ? 0 : 0.75, ease: [0.22, 1, 0.36, 1] }}
          >
            <ContactForm flightEnabled={!spatial || mode === 'parked'} />
          </motion.div>
        </div>
      </div>
    </section>
  );
}