import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ActionTargetGuide } from './JourneyGuide';

describe('ActionTargetGuide', () => {
  it('shows a route name and lets the player cancel target selection', () => {
    const onCancel = vi.fn();
    render(
      <ActionTargetGuide
        mode="restore_route"
        actions={[{ type: 'restore_route', label: '修护路线', route_id: 'route_shanhua_temple_yungang', cost: 1 }]}
        sites={{}}
        routes={{
          route_shanhua_temple_yungang: { id: 'route_shanhua_temple_yungang', name: '善化寺—云冈石窟' } as never,
        }}
        cards={{}}
        onRun={vi.fn()}
        onCancel={onCancel}
      />
    );
    expect(screen.getByText('善化寺—云冈石窟')).toBeInTheDocument();
    expect(screen.queryByText('route_shanhua_temple_yungang')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '取消目标选择' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
