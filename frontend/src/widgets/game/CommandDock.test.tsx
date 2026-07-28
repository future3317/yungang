import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CommandDock } from './CommandDock';

describe('CommandDock', () => {
  it('uses the in-app overlay for action and strategy-card explanations', () => {
    render(<CommandDock state={{} as never} active={{ id: 'p1', ap: 3, hand: [], action_hand: ['route_card'] } as never} cards={{}} legal={[]} actionOptions={[
      { id: 'action:explore', type: 'explore', label: '探索', description: '从市场取走一件文化线索。', cost: { ap: 1 }, enabled: true, targets: [] },
      { id: 'action:use_action_card:route_card', type: 'use_action_card', label: '整备行装', description: '选择一条相邻路线，降低风险。', cost: { ap: 1 }, enabled: true, targets: [] },
    ] as never} actionMode={null} actionLabels={{ explore: '探索' }} mutationPending={false} onChooseOption={vi.fn()} onCancel={vi.fn()} onCard={vi.fn()} />);

    fireEvent.mouseEnter(screen.getByRole('button', { name: /探索/ }));
    expect(screen.getByRole('tooltip')).toHaveTextContent('从市场取走一件文化线索。');

    const strategy = document.querySelector<HTMLButtonElement>('.strategy-card');
    expect(strategy).not.toBeNull();
    expect(strategy).not.toHaveAttribute('title');
    fireEvent.mouseEnter(strategy!);
    expect(screen.getByRole('tooltip')).toHaveTextContent('选择一条相邻路线，降低风险。');
  });
});
