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
    fireEvent.click(screen.getByRole('button', { name: /确认行动/ }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
