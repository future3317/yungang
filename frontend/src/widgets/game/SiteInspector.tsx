import { useEffect, useState } from 'react';
import { CircleAlert, ChevronLeft, Compass, HandHeart, Library, Target, X } from 'lucide-react';
import type { Action, ActionType, ContentCard, ContentEvent, GameState, Meta, Site, Task } from '../../types/game';

type InspectorTab = 'task' | 'event' | 'market';

const comboNames: Record<string, string> = {
  image_reconstruction: '图像对照',
  cross_origin: '跨来源互证',
  route_governance: '路线治理',
  archive_context: '档案互证',
};

function domainName(meta: Meta, id: string) {
  return meta.domain_meta?.[id]?.short_name || id;
}

export function SiteInspector({ state, meta, site, task, event, cards, legal, actionMode, collapsed, onCollapsedChange, onExplore, onSelectAction, eventTargetLabels = [] }: {
  state: GameState;
  meta: Meta;
  site: Site;
  task?: Task;
  event?: ContentEvent;
  cards: Record<string, ContentCard>;
  legal: Action[];
  actionMode: ActionType | null;
  collapsed: boolean;
  onCollapsedChange: (next: boolean) => void;
  onExplore: (id: string) => void;
  onSelectAction: (type: ActionType) => void;
  eventTargetLabels?: string[];
}) {
  const eventPriority = Boolean(state.pending_choice || state.shared.current_event_id);
  const initial: InspectorTab = actionMode === 'explore' ? 'market' : eventPriority ? 'event' : 'task';
  const [tab, setTab] = useState(initial);

  useEffect(() => {
    setTab(actionMode === 'explore' ? 'market' : eventPriority ? 'event' : 'task');
  }, [actionMode, eventPriority, site.id]);

  const active = state.players[state.shared.active_player_id];
  const isCurrentSite = active?.location === site.id;
  const action = isCurrentSite ? legal.find(item => item.type === actionMode) || legal[0] : undefined;
  const contributed = task?.contributed_cards.map(id => cards[id]).filter((card): card is ContentCard => Boolean(card)) || [];
  const contributedDomains = new Set(contributed.map(card => card.domain));
  const origins = new Set(contributed.flatMap(card => card.origin_tags || []));
  const canMove = legal.some(item => item.type === 'move');
  const canExplore = isCurrentSite && legal.some(item => item.type === 'explore');
  const canContribute = isCurrentSite && legal.some(item => item.type === 'contribute');
  const matchingHand = active?.hand.filter(id => task?.required_domains.includes(cards[id]?.domain || '')).length || 0;

  if (collapsed) {
    return <aside className="inspector-rail"><button className="inspector-expand" onClick={() => onCollapsedChange(false)} aria-label="展开地点检查器"><ChevronLeft size={18} /><span>地点</span></button></aside>;
  }

  return <aside className="site-inspector" aria-label="地点检查器">
    <button className="inspector-collapse" onClick={() => onCollapsedChange(true)} aria-label="收起地点检查器"><X size={16} /></button>
    <header className="inspector-summary">
      <span className="section-label">当前聚焦地点</span>
      <h2>{site.name || site.id}</h2>
      <div className="inspector-meta">
        <span>{site.kind === 'facility' ? '支持设施' : site.node_kind === 'event' ? '临时事件' : '遗产节点'}</span>
        <span className={`site-status ${site.status}`}>{site.status === 'closed' ? '已关闭' : site.status === 'at_risk' ? '需修护' : '稳定'}</span>
      </div>
      <p>{site.summary || '尚未取得该地点的文化摘要。'}</p>
      {!isCurrentSite && <div className="site-preview-note">
        <Compass size={16} />
        <div><b>尚未抵达此地</b><small>可预览任务与线索；抵达后才能探索、投入证据或修护。</small></div>
        {canMove && <button onClick={() => onSelectAction('move')}>规划移动</button>}
      </div>}
      {site.node_ability && <div className="ability-note"><b>{site.node_ability.name}</b><small>{site.node_ability.description}</small></div>}
      {action && <div className="relevant-action"><span>当前相关行动</span><b>{action.label}</b><small>{action.cost || 0} AP</small></div>}
    </header>
    <div className="inspector-tabs" role="tablist">
      <button role="tab" aria-selected={tab === 'task'} onClick={() => setTab('task')}><Target size={15} />任务</button>
      <button role="tab" aria-selected={tab === 'event'} onClick={() => setTab('event')}><CircleAlert size={15} />事件</button>
      <button role="tab" aria-selected={tab === 'market'} onClick={() => setTab('market')}><Library size={15} />市场</button>
    </div>
    <div className="inspector-content">
      {tab === 'task' && <section className="task-workflow">
        <h3>{task?.name || '等待探索解锁任务'}</h3>
        <p>{task?.culture_explanation || '在这里收集线索、建立联系，并完成地点任务。'}</p>
        {task && <>
          <div className="task-step"><span className={contributed.length >= task.required_card_count ? 'complete' : ''}>1</span><div><b>收集 {task.required_card_count} 张证据</b><small>{contributed.length} / {task.required_card_count} 已投入</small></div></div>
          <div className="task-step"><span className={task.required_domains.every(domain => contributedDomains.has(domain)) ? 'complete' : ''}>2</span><div><b>覆盖 {task.required_domains.map(domain => domainName(meta, domain)).join('、')}</b><small>{task.required_domains.filter(domain => !contributedDomains.has(domain)).length ? `还缺：${task.required_domains.filter(domain => !contributedDomains.has(domain)).map(domain => domainName(meta, domain)).join('、')}` : '领域条件已满足'}</small></div></div>
          <div className="task-step"><span className={origins.size >= task.required_origin_diversity ? 'complete' : ''}>3</span><div><b>形成至少 {task.required_origin_diversity} 种来源的对照</b><small>当前 {origins.size} 种来源{task.combo_requirement?.required_combo_tags?.length ? ` · 组合：${task.combo_requirement.required_combo_tags.map(tag => comboNames[tag] || tag).join('、')}` : ''}</small></div></div>
          {!isCurrentSite && <div className="task-access-hint"><Compass size={15} />这是远处地点的任务预览。请先移动到此处，再执行探索或贡献。</div>}
          <div className="task-action-row">
            <button disabled={!canExplore} onClick={() => onSelectAction('explore')}><Compass size={15} />{isCurrentSite ? '去探索证据' : '抵达后可探索'}</button>
            <button disabled={!canContribute} onClick={() => onSelectAction('contribute')}><HandHeart size={15} />{isCurrentSite ? `贡献手牌${matchingHand ? ` (${matchingHand})` : ''}` : '抵达后可贡献'}</button>
          </div>
          <div className="task-note">完成方式：先在市场探索证据，再从左侧手牌选择符合条件的卡牌投入。多人时由不同角色贡献可更快满足来源与协作条件。</div>
        </>}
      </section>}
      {tab === 'event' && <section><div className="event-art"><img src={`/ui-assets/${event?.scene_asset || 'scene_frontier_pass.png'}`} alt="" /><div><h3>{event?.name || '本回合尚无待处理事件'}</h3><p>{event?.description || event?.summary || '结束回合后，世界事件会根据路线和节点状态结算。'}</p>{event && <div className="event-brief"><b>风险预告 · {event.severity || 1} 级</b><span>{event.forecast_text || event.mitigation_hint}</span>{eventTargetLabels.length > 0 && <small>已锁定影响：{eventTargetLabels.join('、')}</small>}{event.mitigation_hint && <small>建议：{event.mitigation_hint}</small>}</div>}</div></div></section>}
      {tab === 'market' && <section className="market-tab"><h3>公开文化市场 <span>{state.market.length} 张</span></h3><p className="market-help">选择一张证据探索后，它会进入你的手牌；返回任务标签即可查看是否匹配。</p>{!isCurrentSite && <div className="task-access-hint"><Compass size={15} />可提前浏览证据；抵达该地点后才能将它们探索进手牌。</div>}<div className="market-row">{state.market.map(id => { const item = cards[id]; const explore = legal.find(candidate => candidate.type === 'explore' && candidate.card_id === id); const useful = task?.required_domains.includes(item?.domain || ''); return <button key={id} className={`culture-card ${actionMode === 'explore' && explore ? 'selected' : ''} ${useful ? 'useful' : ''}`} disabled={!isCurrentSite || !explore} onClick={() => onExplore(id)}><img src={`/ui-assets/${item?.icon_asset || 'icon_card_scroll.png'}`} alt="" /><span><b>{item?.name || id}</b><small>{item?.domain ? domainName(meta, item.domain) : '文化证据'}{useful ? ' · 适合当前任务' : ''}</small></span><i>{!isCurrentSite ? '抵达后探索' : explore ? `${explore.cost || 1} AP` : '不可选'}</i></button>; })}</div></section>}
    </div>
  </aside>;
}
