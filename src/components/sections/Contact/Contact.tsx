import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import styles from './Contact.module.css';

export function Contact() {
  const containerRef = useRef<HTMLElement>(null);
  
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end end"]
  });

  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 0.8]);
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "20%"]);

  return (
    <section ref={containerRef} className={styles.contact} id="contact">
      <motion.div 
        className={styles.content}
        style={{ opacity, scale, y }}
      >
        <motion.div 
          className={styles.header}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.76, 0, 0.24, 1] }}
        >
          <h2 className={styles.title}>Let's Connect</h2>
          <p className={styles.subtitle}>Get in touch for opportunities or just to say hi</p>
        </motion.div>

        <div className={styles.grid}>
          <motion.div 
            className={styles.formContainer}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.76, 0, 0.24, 1], delay: 0.2 }}
          >
            <form className={styles.form}>
              <div className={styles.inputGroup}>
                <input 
                  type="text" 
                  placeholder="Name" 
                  className={styles.input} 
                />
                <input 
                  type="email" 
                  placeholder="Email" 
                  className={styles.input} 
                />
              </div>
              <textarea 
                placeholder="Message" 
                className={styles.textarea}
              />
              <button type="submit" className={styles.submitButton}>
                Send Message
              </button>
            </form>
          </motion.div>

          <motion.div 
            className={styles.contactInfo}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.76, 0, 0.24, 1], delay: 0.3 }}
          >
            <div className={styles.infoGroup}>
              <h3 className={styles.infoTitle}>Phone</h3>
              <a href="tel:+25196623533" className={styles.infoLink}>
                +251 966 23533
              </a>
            </div>
            <div className={styles.infoGroup}>
              <h3 className={styles.infoTitle}>Email</h3>
              <a href="mailto:leulman2@gmail.com" className={styles.infoLink}>
                leulman2@gmail.com
              </a>
            </div>
            <div className={styles.infoGroup}>
              <h3 className={styles.infoTitle}>Location</h3>
              <span className={styles.infoText}>
                Addis Ababa, Ethiopia
              </span>
            </div>
            <div className={styles.infoGroup}>
              <h3 className={styles.infoTitle}>Follow</h3>
              <div className={styles.socialLinks}>
                <a href="https://github.com/yourusername" target="_blank" rel="noopener noreferrer" className={styles.socialLink}>GitHub</a>
                <a href="https://linkedin.com/in/yourusername" target="_blank" rel="noopener noreferrer" className={styles.socialLink}>LinkedIn</a>
                <a href="https://twitter.com/yourusername" target="_blank" rel="noopener noreferrer" className={styles.socialLink}>Twitter</a>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
} 