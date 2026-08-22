import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EvidenceCardDialog } from './EvidenceCardDialog';

describe('EvidenceCardDialog', () => {
  it('separates research placement from immediate discard effect', () => {
    render(<EvidenceCardDialog
      id="card-route"
      item={{ id: 'card-route', name: '行旅记录', description: '记录沿途节点。', evidence_use_text: '投入当前委托，补足路线证据。', instant_use_text: '立即获得 1 点行动力。' } as never}
      action={{ type: 'play_card', card_id: 'card-route', label: '行旅记录', description: '立即获得 1 点行动力。', preview_delta: { ap: 1 } } as never}
      interpretActions={[{ type: 'interpret_evidence', card_id: 'card-route', target_id: 'support', label: '支持', cost: 1 } as never]}
      onClose={vi.fn()}
      onUse={vi.fn()}
    />);

    expect(screen.getByText(/投入当前委托/)).toBeInTheDocument();
    expect(screen.getByText(/立即获得 1 点行动力/)).toBeInTheDocument();
    expect(screen.getByText('投入研究台')).toBeInTheDocument();
    expect(screen.getByText('发动即时效果并弃置')).toBeInTheDocument();
  });
});
