import type { ReactNode } from 'react';
import styles from './Toast.module.css';

export function Toast({ children, index }: { children: ReactNode; index: number }) {
  return (
    <div className={styles.root} data-toast="true" data-toast-index={index} role="status">
      {children}
    </div>
  );
}
