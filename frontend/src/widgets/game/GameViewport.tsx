import type { ReactNode } from 'react';

export function GameViewport({ children }: { children: ReactNode }) {
  return <div className="game-viewport">{children}</div>;
}
