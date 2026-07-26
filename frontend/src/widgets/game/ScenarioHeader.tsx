import type { GameState } from '../../types/game';

function Progress({ value, max }: { value: number; max: number }) { return <div className="progress gold"><span style={{ width: `${Math.min(100, max ? value / max * 100 : 0)}%` }} /></div>; }

export function ScenarioHeader({ state, connection }: { state: GameState; connection: string }) {
  return <header className="game-header"><a className="brand-mark" href="/" aria-label="返回首页"><img src="/ui-assets/04_yungang_seal_stamp.webp" alt="" /><span>石窟<strong>光谱</strong></span></a><div className="header-center"><span className="eyebrow">遗产网络 · 第 {state.shared.turn} / {state.shared.max_rounds} 回合</span><div className="goal-line"><Progress value={state.shared.influence} max={10} /><b>{state.shared.influence} / 10 共同影响</b></div></div><div className="header-actions"><span className={`sync-state ${connection === '离线' ? 'offline' : ''}`}><span />{connection}</span></div></header>;
}
