import styles from './Card.module.css';

interface StatItemProps {
  value: string;
  label: string;
}

export const CardTitle = ({ children }: { children: React.ReactNode }) => (
  <h3 className={styles.title} data-interactive="true">
    {children}
  </h3>
);

export const CardText = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <p className={`${styles.text} ${className || ''}`} data-interactive="true">
    {children}
  </p>
);

export const StatsGrid = ({ children }: { children: React.ReactNode }) => (
  <div className={styles.statsGrid}>
    {children}
  </div>
);

export const StatItem = ({ value, label }: StatItemProps) => (
  <div className={styles.statItem} data-interactive="true">
    <span className={styles.statValue} data-interactive="true">{value}</span>
    <span className={styles.statLabel} data-interactive="true">{label}</span>
  </div>
);

export const TagsGrid = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={`${styles.tagsGrid} ${className || ''}`}>
    {children}
  </div>
);

export const Tag = ({ children }: { children: React.ReactNode }) => (
  <span className={styles.tag} data-interactive="true">
    {children}
  </span>
); 