import type { ReactNode } from 'react';
import styles from './GameOverlayHost.module.css';

export function GameOverlayHost({ children }: { children: ReactNode }) {
  return (
    <div className={styles.root} data-overlay-host="true">
      {children}
    </div>
  );
}
