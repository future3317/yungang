import type { ReactNode } from 'react';
import styles from './GameOverlayHost.module.css';

export function DialogBackdrop({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`${styles.backdrop} ${className}`.trim()}>{children}</div>;
}
