import { Compass, HandHeart, MapPinned, Target } from 'lucide-react';
import type { Action, ActionType, ContentCard, GameState, Meta, Player, Site, Task } from '../../types/game';

const comboTagNames: Record<string, string> = {
  archive_context: '档案互证',
  craft_coordination: '工序协同',
  cross_origin: '跨来源互证',
  image_reconstruction: '图像重构',
  material_diagnosis: '材料诊断',
  route_governance: '路线治理',
};

function displayTag(tag: string) {
  return comboTagNames[tag] || readableTag(tag);
}

function domainName(meta: Meta, id: string) { return meta.domain_meta?.[id]?.short_name || id; }
function readableTag(tag: string) { const labels: Record<string, string> = { architecture: '建筑', statue: '造像', pattern: '纹样', frontier: '边地', trade: '交流', archive: '档案', material: '材料', religion: '信仰' }; return labels[tag] || tag.replaceAll('_', ' '); }

export function JourneyGuide({ task, cards, active, legal, meta, actionMode, onChoose }: { task?: Task; cards: Record<string, ContentCard>; active: Player; legal: Action[]; meta: Meta; actionMode: ActionType | null; onChoose: (type: ActionType) => void }) {
  const contributions = task?.contributed_cards || [];
  const matchingHand = active.hand.filter(id => task?.required_domains.includes(cards[id]?.domain || '')).length;
  const canContribute = legal.some(action => action.type === 'contribute');
  const canExplore = legal.some(action => action.type === 'explore');
  return <section className="journey-guide" aria-label="行动指引"><div className="section-label"><Target size={14} />旅途中的下一步</div>{actionMode ? <p>风向已经显现，金色标记是此刻可以前往的去处。</p> : task ? <><h3>{task.name}</h3><p>这里的故事还缺几件相互印证的线索。抵达节点，只是寻访的开始。</p><ul><li><b>{contributions.length} / {task.required_card_count}</b> 件线索</li><li>{task.required_domains.map(domain => domainName(meta, domain)).join('、')}</li><li>需来自 {task.required_origin_diversity} 种来处</li>{task.combo_requirement?.required_combo_tags?.length ? <li>组合线索：{task.combo_requirement.required_combo_tags.map(displayTag).join('、')}</li> : null}</ul><div className="guide-actions">{canContribute ? <button onClick={() => onChoose('contribute')}><HandHeart size={15} />交付手中线索 {matchingHand ? `(${matchingHand})` : ''}</button> : null}{canExplore ? <button onClick={() => onChoose('explore')}><Compass size={15} />寻访一件线索</button> : <button onClick={() => onChoose('move')}><MapPinned size={15} />沿路线前往节点</button>}</div></> : <><h3>追随下一条线索</h3><p>沿着显影的路线前往节点，在公开市场寻访文化线索；当不同来处的见证相遇，新的联系便会出现。</p><div className="guide-actions"><button onClick={() => onChoose('move')}><MapPinned size={15} />踏上显影路线</button></div></>}</section>;
}

export function ActionTargetGuide({ mode, actions, sites, cards, onRun, onCancel }: { mode: ActionType | null; actions: Action[]; sites: Record<string, Site>; cards: Record<string, ContentCard>; onRun: (action: Action) => void; onCancel: () => void }) {
  if (!mode) return null;
  const title = mode === 'explore' ? '从市集中取一件线索' : mode === 'contribute' ? '选择一件线索交付' : '选择下一处落脚点';
  const name = (action: Action) => action.card_id ? cards[action.card_id]?.name || action.card_id : action.target_id ? sites[action.target_id]?.name || action.target_id : action.label;
  return <section className="action-target-guide" role="status" aria-live="polite"><div><span>{title}</span><button onClick={onCancel}>收回脚步</button></div><p>金色标记已经显出路径，选择一处，便可启程。</p><div>{actions.map((action, index) => <button key={`${action.type}-${action.card_id || action.target_id || index}`} onClick={() => onRun(action)}><b>{name(action)}</b><small>{action.cost || 0} AP · {action.label}</small></button>)}</div></section>;
}
