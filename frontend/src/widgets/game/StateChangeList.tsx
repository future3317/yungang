type StateChange = {
  label?: string;
  before?: string | number | null;
  after?: string | number | null;
  delta?: number | null;
};

export function StateChangeList({ changes, compact = false }: { changes: StateChange[]; compact?: boolean }) {
  const visible = changes.filter(change => change.label || change.before !== undefined || change.after !== undefined);
  if (!visible.length) return null;
  return <ul className={`state-change-list${compact ? ' compact' : ''}`} aria-label="状态变化">
    {visible.map((change, index) => {
      const delta = typeof change.delta === 'number' ? change.delta : null;
      const direction = delta === null ? '' : delta > 0 ? 'positive' : delta < 0 ? 'negative' : '';
      const hasRange = change.before !== undefined || change.after !== undefined;
      return <li key={`${change.label || 'change'}-${index}`} className={direction}>
        <span>{change.label || '状态变化'}</span>
        <b>{hasRange ? `${change.before ?? '—'} → ${change.after ?? '—'}` : delta === null ? '已更新' : `${delta > 0 ? '+' : ''}${delta}`}</b>
      </li>;
    })}
  </ul>;
}
