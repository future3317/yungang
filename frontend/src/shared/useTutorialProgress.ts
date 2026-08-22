import { useCallback, useState } from 'react';

const STORAGE_KEY = 'yungang-journey-tutorial-v2';
type Progress = { manual: boolean; contexts: string[] };
export type TutorialContext = 'move' | 'explore' | 'interpret_evidence' | 'resolve_event' | 'use_action_card';
const actionContexts: Record<string, TutorialContext> = {
  move: 'move',
  explore: 'explore',
  interpret_evidence: 'interpret_evidence',
  resolve_event: 'resolve_event',
  use_action_card: 'use_action_card',
  play_card: 'use_action_card',
};

export function tutorialContextForAction(type: string): TutorialContext | null {
  return actionContexts[type] || null;
}

export type TutorialProgress = {
  hasSeenManual: boolean;
  hasSeenContext: (context: string) => boolean;
  markManualSeen: () => void;
  markContextSeen: (context: string) => void;
};

function readProgress(): Progress {
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}') as Partial<Progress>;
    return { manual: value.manual === true, contexts: Array.isArray(value.contexts) ? value.contexts : [] };
  } catch {
    return { manual: false, contexts: [] };
  }
}

function writeProgress(value: Progress) {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch { /* private browsing can reject storage */ }
}

export function useTutorialProgress(): TutorialProgress {
  const [progress, setProgress] = useState(readProgress);
  const markManualSeen = useCallback(() => setProgress(current => { const next = { ...current, manual: true }; writeProgress(next); return next; }), []);
  const markContextSeen = useCallback((context: string) => setProgress(current => { if (current.contexts.includes(context)) return current; const next = { ...current, contexts: [...current.contexts, context] }; writeProgress(next); return next; }), []);
  return { hasSeenManual: progress.manual, hasSeenContext: (context: string) => progress.contexts.includes(context), markManualSeen, markContextSeen };
}
