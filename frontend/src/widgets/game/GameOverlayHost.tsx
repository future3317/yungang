import type { ReactNode } from 'react';

export function GameOverlayHost({ children }: { children: ReactNode }) {
  return (
    <div className="hud-overlay-layer" data-overlay-host="true">
      {children}
    </div>
  );
}
