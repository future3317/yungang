import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Panel, Progress } from './Primitives';

describe('UI primitives', () => {
  it('keeps panel semantics while allowing a component-specific class', () => {
    render(<Panel className="planning-phase">内容</Panel>);
    expect(screen.getByText('内容').closest('section')).toHaveClass('planning-phase');
  });

  it('clamps progress to the declared range', () => {
    render(<Progress value={8} max={4} aria-label="进度" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '8');
    expect(screen.getByRole('progressbar').firstElementChild).toHaveStyle({ width: '100%' });
  });
});
