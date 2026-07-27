import { useEffect, useState } from 'react';
import { Check, ChevronLeft, CircleAlert, Compass, HandHeart, Info, Library, MapPinned, Target, X } from 'lucide-react';
import type { Action, ActionType, ContentCard, ContentEvent, GameState, Meta, Site, Task } from '../../types/game';

type InspectorTab = 'task' | 'event' | 'market';
type CardRecord = Record<string, unknown>;

const comboNames: Record<string, string> = {
  image_reconstruction: '图像对照',
  cross_origin: '跨来源互证',
  route_governance: '路线治理',
  archive_context: '档案互证',
};

function domainName(meta: Meta, id: string) {
  return meta.domain_meta?.[id]?.short_name || id;
}

function cardRecord(card?: ContentCard): CardRecord {
  return (card || {}) as unknown as CardRecord;
}

function textField(card: ContentCard | undefined, ...keys: string[]) {
  const record = cardRecord(card);
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return '';
}

function recordText(value: unknown, ...keys: string[]) {
  const record = (value || {}) as CardRecord;
  for (const key of keys) {
    const item = record[key];
    if (typeof item === 'string' && item.trim()) return item;
  }
  return '';
}

function marketReason(card: ContentCard | undefined, task?: Task, useful = false) {
  const domain = card?.domain;
  if (useful && domain) return `匹配当前任务的「${domain}」线索，优先用于完成任务。`;
  if (task?.required_origin_diversity && task.required_origin_diversity > 1) return '当前任务重视来源差异，可用它补足互证来源。';
  return domain ? `属于「${domain}」线索，适合作为备用证据或后续组合。` : '可作为备用文化线索，先记入手牌再决定用途。';
}

function marketOutcome(card: ContentCard | undefined) {
  const instant = textField(card, 'instant_use_text', 'combo_reward_text');
  return instant ? `获得手牌；${instant}` : '获得手牌；之后可投入任务，或在合适时机使用。';
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
  const [tab, setTab] = useState<InspectorTab>(initial);

  useEffect(() => {
    setTab(actionMode === 'explore' ? 'market' : eventPriority ? 'event' : 'task');
  }, [actionMode, eventPriority, site.id]);

  const active = state.players[state.shared.active_player_id];
  const siteType = recordText(site, 'type', 'kind') || '遗产节点';
  const siteDescription = recordText(site, 'description');
  const taskRecord = task as unknown as CardRecord | undefined;
  const eventRecord = event as unknown as CardRecord | undefined;
  const isCurrentSite = active.location === site.id;
  const action = legal.find(item => item.target_id === site.id || item.target_site_id === site.id) || legal.find(item => item.type === 'explore' && isCurrentSite);
  const contributions = (taskRecord?.contributions as string[] | undefined) || (taskRecord?.contributed_card_ids as string[] | undefined) || [];
  const matchingHand = active.hand.filter(id => task?.required_domains.includes(cards[id]?.domain || '')).length;
  const marketCards = state.market.map(id => cards[id]).filter(Boolean);

  if (collapsed) {
    return <aside className="inspector-rail"><button className="inspector-expand" onClick={() => onCollapsedChange(false)} aria-label="展开地点详情"><ChevronLeft size={17} /><span>地点详情</span></button></aside>;
  }

  return <aside className="site-inspector" aria-label="地点详情">
    <button className="inspector-collapse" onClick={() => onCollapsedChange(true)} aria-label="收起地点详情"><X size={16} /></button>
    <header className="inspector-summary">
      <span className="eyebrow">当前聚焦地点</span>
      <h2>{site.name}</h2>
      <div className="inspector-meta"><span>{siteType}</span><span className={site.status}>{site.status || '稳定'}</span></div>
      <p>{site.summary || siteDescription || '在这里寻找能够连接不同地点与文化脉络的证据。'}</p>
      {action && <div className="relevant-action"><span>当前相关行动</span><b>{action.label}</b><small>{action.cost || 0} AP</small></div>}
    </header>
    <div className="inspector-tabs" role="tablist" aria-label="地点信息">
      <button role="tab" aria-selected={tab === 'task'} onClick={() => setTab('task')}><Target size={15} />任务</button>
      <button role="tab" aria-selected={tab === 'event'} onClick={() => setTab('event')}><CircleAlert size={15} />事件</button>
      <button role="tab" aria-selected={tab === 'market'} onClick={() => setTab('market')}><Library size={15} />市场</button>
    </div>
    <div className="inspector-content">
      {tab === 'task' && <section className="task-tab">
        {task ? <>
          <div className="tab-kicker"><Target size={14} />这个地点要完成什么</div>
          <h3>{task.name}</h3>
          <p>{recordText(task, 'description') || task.culture_explanation || '把相互印证的文化证据投入地点任务，推动共同目标。'}</p>
          <div className="task-workflow" aria-label="任务完成步骤">
            <div className="task-step"><span className={isCurrentSite ? 'complete' : ''}>{isCurrentSite ? <Check size={13} /> : '1'}</span><div><b>抵达任务地点</b><small>{isCurrentSite ? '你已经在这里，可以开始行动。' : `先移动到${site.name}，当前只能浏览信息。`}</small></div></div>
            <div className="task-step"><span className={matchingHand > 0 ? 'complete' : ''}>{matchingHand > 0 ? <Check size={13} /> : '2'}</span><div><b>从市场探索证据</b><small>消耗 1 AP，将选中的证据加入手牌，上限 3 张。</small></div></div>
            <div className="task-step"><span className={contributions.length >= (task.required_card_count || 1) ? 'complete' : ''}>{contributions.length >= (task.required_card_count || 1) ? <Check size={13} /> : '3'}</span><div><b>投入手牌并完成互证</b><small>{contributions.length} / {task.required_card_count || 1} 张；需要 {task.required_domains.map(domain => domainName(meta, domain)).join('、')}。</small></div></div>
          </div>
          {task.required_origin_diversity > 1 && <div className="task-rule-callout"><Info size={15} /><span>至少需要 {task.required_origin_diversity} 种来源。不要只拿同一类证据，跨来源组合才能形成可信解释。</span></div>}
          <div className="domain-list">{task.required_domains.map(domain => <span key={domain}>{domainName(meta, domain)}</span>)}</div>
          <div className="task-action-row"><button disabled={!isCurrentSite} onClick={() => onSelectAction('explore')}><Compass size={15} />去市场挑证据</button><button disabled={!isCurrentSite || matchingHand === 0} onClick={() => onSelectAction('contribute')}><HandHeart size={15} />投入手牌</button></div>
          {!isCurrentSite && <div className="task-access-hint"><MapPinned size={15} />可以提前规划，但必须抵达后才能探索和完成任务。</div>}
          {recordText(task, 'route_synergy') && <p className="task-note">完成后影响：{recordText(task, 'route_synergy')}</p>}
        </> : <div className="empty-tab"><Target size={22} /><h3>这里暂时没有开放任务</h3><p>先查看地图上其他节点，或等待事件目标出现。</p></div>}
      </section>}

      {tab === 'event' && <section className="event-tab">
        {event ? <><div className="tab-kicker"><CircleAlert size={14} />需要回应的世界变化</div><div className="event-art"><img src={`/ui-assets/${recordText(event, 'art_asset') || 'scene_yungang_day.png'}`} alt="" /><div><h3>{event.name}</h3><span>{recordText(event, 'type') || '区域事件'}</span></div></div><p>{recordText(eventRecord, 'description') || event.forecast_text}</p>{eventTargetLabels.length > 0 && <div className="event-brief"><b>影响范围</b><span>{eventTargetLabels.join('、')}</span></div>}{event.mitigation_hint && <div className="task-rule-callout"><Info size={15} /><span>{event.mitigation_hint}</span></div>}<button className="primary-action" onClick={() => onSelectAction('resolve_event')}>查看应对选项</button></> : <div className="empty-tab"><CircleAlert size={22} /><h3>本回合没有待处理事件</h3><p>事件出现时，这里会告诉你影响范围、风险和可选回应。</p></div>}
      </section>}

      {tab === 'market' && <section className="market-tab">
        <div className="market-heading"><div><div className="tab-kicker"><Library size={14} />行动前先比较</div><h3>公开文化市场</h3></div><span>{marketCards.length} 张候选</span></div>
        <p className="market-help">市场不是随机抽签：每张卡会占用 1 AP，加入手牌后再投入任务。先选能补齐当前任务的证据，再考虑来源和备用线索。</p>
        <div className="market-legend"><span className="legend-match">金边 · 匹配任务</span><span>灰边 · 备用线索</span><span>手牌上限 3 张</span></div>
        {!isCurrentSite && <div className="task-access-hint"><Compass size={15} />现在可以比较市场，但抵达{site.name}后才能真正探索；不会提前消耗 AP。</div>}
        <div className="market-row">{marketCards.map(item => {
          const explore = legal.find(candidate => candidate.type === 'explore' && candidate.card_id === item.id);
          const useful = Boolean(task?.required_domains.includes(item.domain || ''));
          const description = textField(item, 'description', 'summary') || '一条等待被放入更大文化脉络的线索。';
          const combo = textField(item, 'combo_name');
          return <button key={item.id} className={`culture-card ${useful ? 'useful' : ''} ${actionMode === 'explore' && explore ? 'selected' : ''}`} disabled={!isCurrentSite || !explore} onClick={() => onExplore(item.id)} aria-label={`选择${item.name}：${marketReason(item, task, useful)}`}>
            <img src={`/ui-assets/${item.icon_asset || 'icon_card_scroll.png'}`} alt="" />
            <span className="culture-card-copy"><b>{item.name}</b><small>{item.domain ? domainName(meta, item.domain) : '文化证据'} · {marketReason(item, task, useful)}</small><em>{description}</em>{combo && <i>{comboNames[combo] || combo} · 组合后获得额外影响</i>}</span>
            <strong>{!isCurrentSite ? '抵达后' : explore ? '选这张' : '不可选'}<small>{explore ? `${explore.cost || 1} AP` : ''}</small></strong>
          </button>;
        })}</div>
        {marketCards.length > 0 && <div className="market-outcome"><b>选中后会发生什么</b><span>{marketOutcome(marketCards[0])}</span><small>想比较另一张时可以先点开查看；确认前不会扣除 AP。</small></div>}
      </section>}
    </div>
  </aside>;
}
