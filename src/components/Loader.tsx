import { motion } from 'framer-motion';
import styles from './Loader.module.css';

export function Loader() {
  return (
    <motion.div 
      className={styles.loader}
      initial={{ opacity: 1 }}
      exit={{ 
        opacity: 0,
        transition: {
          duration: 1,
          ease: [0.76, 0, 0.24, 1]
        }
      }}
    >
      <motion.div 
        className={styles.progress}
        initial={{ scaleX: 0 }}
        animate={{ 
          scaleX: 1,
          transition: {
            duration: 2,
            ease: [0.76, 0, 0.24, 1]
          }
        }}
      />
      <motion.div 
        className={styles.text}
        initial={{ opacity: 0, y: 20 }}
        animate={{ 
          opacity: 1, 
          y: 0,
          transition: {
            duration: 0.8,
            ease: [0.76, 0, 0.24, 1]
          }
        }}
      >
        Leul
      </motion.div>
    </motion.div>
  );
} 