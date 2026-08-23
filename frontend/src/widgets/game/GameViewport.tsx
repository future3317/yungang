import type { ReactNode } from 'react';
import styles from './GameViewport.module.css';

export function GameViewport({ children }: { children: ReactNode }) {
  return (
    <div className={`${styles.root} game-viewport`} data-hud-root="true">
      {children}
    </div>
  );
}
