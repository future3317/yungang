import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import styles from './Primitives.module.css';

type PanelProps = HTMLAttributes<HTMLElement> & { children: ReactNode };

export function Panel({ children, className = '', ...props }: PanelProps) {
  return (
    <section className={`${styles.panel} ${className}`.trim()} {...props}>
      {children}
    </section>
  );
}

type ButtonContext =
  | 'room-actions'
  | 'room-card'
  | 'help'
  | 'archive'
  | 'card'
  | 'card-immediate'
  | 'result'
  | 'start'
  | 'choice'
  | 'dialog'
  | 'handoff'
  | 'tutorial';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  context?: ButtonContext;
  children: ReactNode;
};

export function Button({ context, children, className = '', type = 'button', ...props }: ButtonProps) {
  const contextAttr = context ? { 'data-context': context } : {};
  return (
    <button type={type} className={`${styles.primaryCta} ${className}`.trim()} {...contextAttr} {...props}>
      {children}
    </button>
  );
}

export function Progress({
  value,
  max,
  className = '',
  'aria-label': ariaLabel = '进度',
  ...props
}: { value: number; max: number; className?: string } & HTMLAttributes<HTMLDivElement>) {
  const percentage = Math.min(100, max > 0 ? Math.max(0, (value / max) * 100) : 0);
  return (
    <div
      className={`${styles.progress} ${className}`.trim()}
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      {...props}
    >
      <span style={{ width: `${percentage}%` }} />
    </div>
  );
}
