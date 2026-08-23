import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CommandDock } from './CommandDock';

describe('CommandDock', () => {
  it('keeps action and strategy-card explanations anchored to their controls', () => {
    render(
      <CommandDock
        state={{ shared: { restoration_resource: 4, research_clues: 1 } } as never}
        active={{ id: 'p1', ap: 3, hand: [], action_hand: ['route_card'] } as never}
        cards={{} as never}
        legal={[]}
        actionOptions={
          [
            {
              id: 'action:explore',
              type: 'explore',
              label: '寻访证据',
              description: '从市场取走一件证据卡。',
              cost: { ap: 1 },
              enabled: true,
              targets: [],
            },
            {
              id: 'action:use_action_card:route_card',
              type: 'use_action_card',
              label: '整备行装',
              description: '选择一条相邻路线，降低风险。',
              cost: { ap: 1 },
              enabled: true,
              targets: [],
            },
          ] as never
        }
        actionMode={null}
        actionLabels={{ explore: '寻访证据' }}
        mutationPending={false}
        onChooseOption={vi.fn()}
        onCancel={vi.fn()}
        onCard={vi.fn()}
      />
    );

    const explore = screen.getByRole('button', { name: /寻访证据：从市场/ });
    expect(explore).toHaveAttribute('data-detail', '从市场取走一件证据卡。');

    const strategy = screen.getByTestId('strategy-card');
    expect(strategy).toHaveAttribute('data-detail', '选择一条相邻路线，降低风险。');
  });
});
