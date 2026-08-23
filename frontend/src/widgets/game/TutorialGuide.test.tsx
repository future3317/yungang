import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { TutorialGuide } from './TutorialGuide';
import type { TutorialProgress } from '../../shared/useTutorialProgress';

function progress(): TutorialProgress {
  return {
    hasSeenManual: false,
    hasSeenContext: () => false,
    markManualSeen: vi.fn(),
    markContextSeen: vi.fn(),
  };
}

describe('TutorialGuide', () => {
  it('opens the contextual lesson and does not mark the full manual as seen', () => {
    const value = progress();
    const onOpenChange = vi.fn();
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <TutorialGuide
          open={open}
          onOpenChange={(next) => {
            onOpenChange(next);
            setOpen(next);
          }}
          triggerAction="move"
          progress={value}
        />
      );
    }
    render(<Harness />);

    expect(screen.getByRole('dialog')).toBeVisible();
    expect(screen.getByRole('heading', { name: '先抵达，再决定做什么' })).toBeVisible();
    expect(value.markContextSeen).toHaveBeenCalledWith('move');

    fireEvent.click(screen.getByRole('button', { name: '知道了' }));

    expect(value.markManualSeen).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('marks the full manual as seen only when the manual is closed', () => {
    const value = progress();
    render(<TutorialGuide open onOpenChange={vi.fn()} progress={value} />);

    fireEvent.click(screen.getByRole('button', { name: '跳过，自己寻访证据' }));

    expect(value.markManualSeen).toHaveBeenCalledTimes(1);
  });
});
