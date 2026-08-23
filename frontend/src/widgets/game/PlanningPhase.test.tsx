import { render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { PlanningPhase } from './PlanningPhase';
import type { GameState } from '../../types/game';

const baseState = {
  shared: {
    turn: 1,
    active_player_id: 'p1',
    planning_marks_per_round: 1,
    planning_marks: { p1: [{ target_id: 'site-1', turn: '1' }] },
  },
  players: { p1: { name: '同行者' } },
} as unknown as GameState;

test('a declared target waits for another player instead of promising a free effect', () => {
  render(
    <PlanningPhase
      state={baseState}
      sites={{ 'site-1': { id: 'site-1', name: '云冈石窟' } as never }}
      routes={{}}
      projects={{}}
      actions={[]}
      onChoose={vi.fn()}
    />
  );

  expect(screen.getByText('等待另一位同行者接续；未接续不会改变状态')).toBeInTheDocument();
  expect(screen.queryByText('声明一个本轮目标')).not.toBeInTheDocument();
});

test('skips the planning panel for tutorial scenarios', () => {
  const tutorialState = {
    ...baseState,
    scenario_id: 'tutorial',
    shared: { ...baseState.shared, planning_marks_per_round: 0 },
  } as unknown as GameState;

  const { container } = render(
    <PlanningPhase
      state={tutorialState}
      sites={{}}
      routes={{}}
      projects={{}}
      actions={[]}
      onChoose={vi.fn()}
    />
  );

  expect(container.firstChild).toBeNull();
});

test('skips the planning panel when planning marks per round is zero', () => {
  const guidedState = {
    ...baseState,
    shared: { ...baseState.shared, planning_marks_per_round: 0 },
  } as unknown as GameState;

  const { container } = render(
    <PlanningPhase
      state={guidedState}
      sites={{}}
      routes={{}}
      projects={{}}
      actions={[]}
      onChoose={vi.fn()}
    />
  );

  expect(container.firstChild).toBeNull();
});
