import { forwardRef, type ButtonHTMLAttributes } from 'react';
import clsx from 'clsx';
import styles from './ControlButton.module.css';

export type ControlButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary';
  iconOnly?: boolean;
};

export const ControlButton = forwardRef<HTMLButtonElement, ControlButtonProps>(
  function ControlButton(
    { variant = 'secondary', iconOnly = false, className, type = 'button', children, ...props },
    ref,
  ) {
    return (
      <button
        {...props}
        ref={ref}
        type={type}
        className={clsx(styles.button, styles[variant], iconOnly && styles.iconOnly, className)}
      >
        <span className={styles.frame}>
          <span className={styles.surface}>{children}</span>
        </span>
      </button>
    );
  },
);
