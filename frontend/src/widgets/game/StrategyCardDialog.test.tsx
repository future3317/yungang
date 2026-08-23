import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StrategyCardDialog } from './StrategyCardDialog';

describe('StrategyCardDialog', () => {
  it('shows cost and immediate effect before target confirmation', () => {
    render(
      <StrategyCardDialog
        option={{
          id: 'card',
          type: 'use_action_card',
          label: '同行分灯',
          description: '把行动资源交给队友。',
          cost: { ap: 1 },
          payload: { effect: { type: 'transfer_resource', resource: 'ap', amount: 1 } },
          targets: [],
          enabled: true,
          category_label: '策略牌',
          action_label: '使用策略牌',
          recommendation_score: 0,
          reason: '',
          confirmation: '',
        }}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    expect(screen.getByText('消耗')).toBeVisible();
    expect(screen.getByText('为目标同行者增加 1 点行动点。')).toBeVisible();
  });
});
