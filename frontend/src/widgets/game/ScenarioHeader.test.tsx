import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ScenarioHeader } from './ScenarioHeader';
import type { GameState } from '../../types/game';

const state = {
  shared: {
    turn: 1,
    max_rounds: 11,
    phase: 'player_action',
    weathering_track: 1,
    weathering_limit: 5,
    planning_marks_per_round: 1,
    player_order: ['p1'],
    active_player_id: 'p1',
  },
  players: {
    p1: { id: 'p1', name: '同行者', role_id: 'pingcheng_artisan', location: 'site_yungang', ap: 4, influence: 0 },
  },
  goal_status: {
    core_projects_completed: 0,
    core_projects_target: 1,
    objectives_completed: 0,
    objectives_target: 2,
    victory_conditions: [
      {
        id: 'project',
        kind: 'progress',
        label: '完成核心项目',
        current: 0,
        target: 1,
        remaining: 1,
        status: 'incomplete',
        related_ids: ['site_yungang'],
        related_labels: ['云冈多域总汇'],
      },
    ],
    failure_conditions: [
      {
        id: 'weathering_control',
        kind: 'limit',
        label: '风化压力',
        current: 1,
        target: 5,
        remaining: 4,
        operator: 'lt',
      },
    ],
    weathering: 1,
    weathering_limit: 5,
    rounds_remaining: 11,
  },
} as unknown as GameState;

describe('ScenarioHeader', () => {
  it('renders brand, event summary and turn info in the fixed header', () => {
    render(<ScenarioHeader state={state} scenarioName="风沙与石" connection="已连接" />);

    expect(screen.getByRole('link', { name: '返回首页' })).toHaveTextContent('云冈');
    expect(screen.getByText('风沙与石')).toBeVisible();
    expect(screen.getByText('第 1 回合')).toBeVisible();
    expect(screen.getByLabelText('胜利摘要')).toBeVisible();
  });

  it('opens the goal drawer and expands conditions', () => {
    render(<ScenarioHeader state={state} scenarioName="风沙与石" connection="已连接" />);

    fireEvent.click(screen.getByRole('button', { name: /^胜利条件$/ }));

    const drawer = screen.getByLabelText('胜利条件清单');
    expect(drawer).toBeVisible();
    expect(screen.getAllByText(/完成核心项目/).length).toBe(1);
    expect(screen.getByText('关联：云冈多域总汇')).toBeVisible();
  });

  it('focuses a related map target when a victory condition is selected', () => {
    const onFocusGoal = vi.fn();
    render(<ScenarioHeader state={state} scenarioName="风沙与石" connection="已连接" onFocusGoal={onFocusGoal} />);

    fireEvent.click(screen.getByRole('button', { name: /^胜利条件$/ }));
    const goalButton = screen
      .getAllByRole('button', { name: /完成核心项目/ })
      .find((button) => !button.hasAttribute('disabled'));
    expect(goalButton).toBeDefined();
    fireEvent.click(goalButton!);

    expect(onFocusGoal).toHaveBeenCalledWith(['site_yungang']);
  });
});
