import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { LandingPage } from './LandingPage';
import type { Meta } from '../../types/game';

const meta = {
  sites: [],
  roles: [],
  scenarios: [
    {
      id: 'tutorial',
      name: '新手导览',
      description: '四节点简化导览',
      recommended_players: [1, 2],
      recommended_minutes: '10–15',
      max_rounds: 4,
      victory_brief: '完成导览目标',
      failure_brief: '回合耗尽',
      enabled_site_ids: [],
      card_pool: {},
      tutorial: true,
    },
    {
      id: 'sand_and_stone',
      name: '风沙与石',
      description: '完整的云冈遗产网络',
      recommended_players: [1, 2, 3, 4],
      recommended_minutes: '25–35',
      max_rounds: 11,
      victory_brief: '完成胜利目标',
      failure_brief: '风化压力失控',
      enabled_site_ids: [],
      card_pool: {},
    },
  ],
  difficulty: [
    {
      id: 'guided',
      name: '引导',
      description: '适合第一次体验',
      max_rounds: 12,
      restoration_resource: 3,
      event_weight: 0.8,
      node_damage_base: 1,
      event_preview_count: 2,
      recommended_experience: '第一次游玩',
      solo_ap_bonus: 1,
    },
  ],
} as unknown as Meta;

function Wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('LandingPage', () => {
  it('keeps the first visit focused and opens the journey form on demand', () => {
    render(<LandingPage />, { wrapper: Wrapper });
    expect(screen.getByRole('button', { name: /开始新手导览/ })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '自定义旅程' }));
    expect(screen.getByRole('button', { name: /进入准备厅/ })).toBeVisible();
    expect(screen.getByText('旅程场景')).toBeInTheDocument();
    expect(screen.getByLabelText('旅程难度')).toBeInTheDocument();
  });

  it('keeps advanced seed controls progressively disclosed', () => {
    render(<LandingPage />, { wrapper: Wrapper });
    fireEvent.click(screen.getByRole('button', { name: '自定义旅程' }));
    fireEvent.click(screen.getByRole('button', { name: /高级设置/ }));
    expect(screen.getByRole('button', { name: /收起/ })).toBeVisible();
  });

  it('loads scenario metadata from the API', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => meta,
    } as Response);

    render(<LandingPage />, { wrapper: Wrapper });
    fireEvent.click(screen.getByRole('button', { name: '自定义旅程' }));
    await waitFor(() => expect(screen.getByText('风沙与石')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /风沙与石/ })).toHaveAttribute('aria-pressed', 'false');
  });
});
