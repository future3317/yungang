import { Compass, HandHeart, MapPinned, Target } from 'lucide-react';
import type { Action, ActionType, ContentCard, GameState, Meta, Player, Site, Task } from '../../types/game';

function domainName(meta: Meta, id: string) { return meta.domain_meta?.[id]?.short_name || id; }
function readableTag(tag: string) { return tag.replaceAll('_', ' '); }

export function JourneyGuide({ task, cards, active, legal, meta, actionMode, onChoose }: { task?: Task; cards: Record<string, ContentCard>; active: Player; legal: Action[]; meta: Meta; actionMode: ActionType | null; onChoose: (type: ActionType) => void }) {
  const contributions = task?.contributed_cards || [];
  const matchingHand = active.hand.filter(id => task?.required_domains.includes(cards[id]?.domain || '')).length;
  const canContribute = legal.some(action => action.type === 'contribute');
  const canExplore = legal.some(action => action.type === 'explore');
  return <section className="journey-guide" aria-label="行动指引"><div className="section-label"><Target size={14} />下一步指引</div>{actionMode ? <p>正在选择目标。地图和下方目标清单中只有高亮项目可以执行。</p> : task ? <><h3>{task.name}</h3><p>完成这项任务需要把合适证据投入当前地点，而不只是抵达这里。</p><ul><li><b>{contributions.length} / {task.required_card_count}</b> 张证据</li><li>{task.required_domains.map(domain => domainName(meta, domain)).join('、')}</li><li>至少 {task.required_origin_diversity} 种来源</li>{task.combo_requirement?.required_combo_tags?.length ? <li>组合线索：{task.combo_requirement.required_combo_tags.map(readableTag).join('、')}</li> : null}</ul><div className="guide-actions">{canContribute ? <button onClick={() => onChoose('contribute')}><HandHeart size={15} />投入手牌 {matchingHand ? `(${matchingHand})` : ''}</button> : null}{canExplore ? <button onClick={() => onChoose('explore')}><Compass size={15} />先去探索证据</button> : <button onClick={() => onChoose('move')}><MapPinned size={15} />移动寻找线索</button>}</div></> : <><h3>建立下一条线索</h3><p>先移动到可达节点，再探索市场中的文化证据；收集到匹配手牌后即可贡献给地点任务。</p><div className="guide-actions"><button onClick={() => onChoose('move')}><MapPinned size={15} />选择移动目标</button></div></>}</section>;
}

export function ActionTargetGuide({ mode, actions, sites, cards, onRun, onCancel }: { mode: ActionType | null; actions: Action[]; sites: Record<string, Site>; cards: Record<string, ContentCard>; onRun: (action: Action) => void; onCancel: () => void }) {
  if (!mode) return null;
  const title = mode === 'explore' ? '从市场选择一张证据' : mode === 'contribute' ? '选择一张手牌投入任务' : '选择一个可执行目标';
  const name = (action: Action) => action.card_id ? cards[action.card_id]?.name || action.card_id : action.target_id ? sites[action.target_id]?.name || action.target_id : action.label;
  return <section className="action-target-guide" role="status" aria-live="polite"><div><span>{title}</span><button onClick={onCancel}>取消</button></div><p>高亮节点与下列项目都可执行，点击任一项目立即确认行动。</p><div>{actions.map((action, index) => <button key={`${action.type}-${action.card_id || action.target_id || index}`} onClick={() => onRun(action)}><b>{name(action)}</b><small>{action.cost || 0} AP · {action.label}</small></button>)}</div></section>;
}
