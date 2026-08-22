import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ScenarioHeader } from './ScenarioHeader';
import type { GameState } from '../../types/game';

const state = {
  shared: {
    turn: 1,
    max_rounds: 11,
    phase: 'player_action',
    weathering_track: 1,
    weathering_limit: 5,
  },
  goal_status: {
    core_projects_completed: 0,
    core_projects_target: 1,
    objectives_completed: 0,
    objectives_target: 2,
    victory_conditions: [{ id: 'project', kind: 'progress', label: '完成核心项目', current: 0, target: 1, remaining: 1, status: 'incomplete', related_labels: ['云冈多域总汇'] }],
    failure_conditions: [{ id: 'weathering_control', kind: 'limit', label: '风化压力', current: 1, target: 5, remaining: 4, operator: 'lt' }],
    weathering: 1,
    weathering_limit: 5,
    rounds_remaining: 11,
  },
} as unknown as GameState;

describe('ScenarioHeader', () => {
  it('anchors the goal control in the header actions and expands its conditions in place', () => {
    render(<ScenarioHeader state={state} scenarioName="风沙与石" connection="已连接" />);

    expect(screen.getByRole('link', { name: '返回首页' })).toHaveTextContent('云冈');
    expect(screen.getByText('风沙与石')).toBeVisible();
    const goal = screen.getByLabelText('胜利清单');
    expect(goal.parentElement?.className).toContain('header-center');
    expect(screen.getByLabelText('拖动胜利清单面板')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: /查看胜利条件/ }));

    expect(screen.getAllByText(/完成核心项目/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole('button', { name: /收起胜利条件/ })).toBeVisible();
    expect(screen.getByText('关联：云冈多域总汇')).toBeVisible();
  });
});
