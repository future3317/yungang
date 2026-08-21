import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ActionPreview } from './ActionPreview';

describe('ActionPreview', () => {
  it('explains target and cost before confirmation', () => {
    const onConfirm = vi.fn();
    render(<ActionPreview action={{ type: 'move', label: '移动到云冈石窟', target_id: 'yungang', cost: 1 }} sites={{ yungang: { id: 'yungang', name: '云冈石窟' } as never }} cards={{}} onConfirm={onConfirm} onCancel={vi.fn()} />);
    expect(screen.getByRole('heading', { name: '移动到云冈石窟' })).toBeInTheDocument();
    expect(screen.getByText('云冈石窟')).toBeInTheDocument();
    expect(screen.getByText('1 AP')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /踏上这一步/ }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('uses the route name instead of exposing an internal route id', () => {
    render(<ActionPreview action={{ type: 'use_action_card', label: '使用策略牌', target_id: 'route_shanhua_temple_yungang', cost: 1 }} sites={{}} routes={{ route_shanhua_temple_yungang: { id: 'route_shanhua_temple_yungang', name: '善化寺—云冈石窟' } as never }} cards={{}} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('善化寺—云冈石窟')).toBeInTheDocument();
    expect(screen.queryByText('route_shanhua_temple_yungang')).not.toBeInTheDocument();
  });

  it('shows the backend-provided state changes before confirmation', () => {
    render(<ActionPreview action={{ type: 'restore_route', label: '修护路线', target_id: 'route_shanhua_temple_yungang', cost: 1, preview_delta: { research_clues: -1, risk: -1 } }} sites={{}} routes={{ route_shanhua_temple_yungang: { id: 'route_shanhua_temple_yungang', name: '善化寺—云冈石窟' } as never }} cards={{}} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('研究线索 -1 · 路线风险 -1')).toBeInTheDocument();
  });
});
