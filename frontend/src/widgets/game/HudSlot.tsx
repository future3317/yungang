import type { HTMLAttributes, ReactNode } from 'react';

type HudSlotName = 'top' | 'left' | 'center' | 'right' | 'bottom';

export function HudSlot({ name, children, className = '', ...props }: { name: HudSlotName; children: ReactNode; className?: string } & HTMLAttributes<HTMLDivElement>) {
  return <div className={`hud-slot hud-slot-${name} ${className}`.trim()} data-hud-slot={name} {...props}>{children}</div>;
}
