import { Compass, HandHeart, MapPinned, Target, X } from 'lucide-react';
import type { Action, ActionType, ContentCard, Meta, Player, RouteState, Site, Task } from '../../types/game';
import { contentTagName, domainName } from './contentLabels';
import { actionLabels, localizeActionText } from './gameUi';
import { resolveActionTargetName } from './ActionPreview';

export function JourneyGuide({ task, cards, active, legal, meta, actionMode, onChoose }: { task?: Task; cards: Record<string, ContentCard>; active: Player; legal: Action[]; meta: Meta; actionMode: ActionType | null; onChoose: (type: ActionType) => void }) {
  const contributions = task?.contributed_cards || [];
  const matchingHand = active.hand.filter(id => task?.required_domains.includes(cards[id]?.domain || '')).length;
  const canInterpret = legal.some(action => action.type === 'interpret_evidence');
  const canExplore = legal.some(action => action.type === 'explore');
  return <section className="journey-guide" aria-label="行动指引"><div className="section-label"><Target size={14} />旅途中的下一步</div>{actionMode ? <p>风向已经显现，金色标记是此刻可以前往的去处。</p> : task ? <><h3>{task.name}</h3><p>这里的故事需要证据关系，而不只是正确配对。抵达节点后，在研究台判断它们互相说明了什么。</p><ul><li><b>{contributions.length} / {task.required_card_count}</b> 件已归位证据</li><li>{task.required_domains.map(domain => domainName(meta, domain)).join('、')}</li><li>需来自 {task.required_origin_diversity} 种来源</li>{task.combo_requirement?.required_combo_tags?.length ? <li>关键互证：{task.combo_requirement.required_combo_tags.map(contentTagName).join('、')}</li> : null}</ul><div className="guide-actions">{canInterpret ? <button type="button" onClick={() => onChoose('interpret_evidence')}><HandHeart size={15} />在研究台判断证据 {matchingHand ? `(${matchingHand})` : ''}</button> : null}{canExplore ? <button type="button" onClick={() => onChoose('explore')}><Compass size={15} />寻访一件线索</button> : <button type="button" onClick={() => onChoose('move')}><MapPinned size={15} />沿路线前往节点</button>}</div></> : <><h3>追随下一条线索</h3><p>沿着显影的路线前往节点，在公开市场寻访文化线索；当不同来处的见证相遇，新的联系便会出现。</p><div className="guide-actions"><button type="button" onClick={() => onChoose('move')}><MapPinned size={15} />踏上显影路线</button></div></>}</section>;
}

export function ActionTargetGuide({ mode, actions, sites, routes, cards, onRun, onCancel }: { mode: ActionType | null; actions: Action[]; sites: Record<string, Site>; routes?: Record<string, RouteState>; cards: Record<string, ContentCard>; onRun: (action: Action) => void; onCancel: () => void }) {
  if (!mode) return null;
  const title = mode === 'explore' ? '从市场中取一件线索' : mode === 'interpret_evidence' ? '回到研究台判断证据关系' : '选择下一处落脚点';
  const name = (action: Action) => action.card_id ? cards[action.card_id]?.name || '已选证据' : resolveActionTargetName(action, sites, routes);
  return <section className="action-target-guide" role="status" aria-live="polite"><div><span>{title}</span><button type="button" className="action-target-guide-close" onClick={onCancel} aria-label="取消目标选择"><X size={15} /><span>取消选择</span></button></div><p>金色标记已经显出路径，选择一处，便可启程。</p><div>{actions.map((action, index) => <button type="button" key={`${action.type}-${action.card_id || action.target_id || index}`} onClick={() => onRun(action)}><b>{localizeActionText(name(action))}</b><small>{action.cost || 0} AP · {actionLabels[action.type] || localizeActionText(action.label)}</small></button>)}</div></section>;
}
