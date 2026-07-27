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

function statusName(status?: string) {
  const labels: Record<string, string> = { stable: '稳定', normal: '稳定', open: '开放', at_risk: '有风险', blocked: '受阻', strained: '紧张', restored: '已修护', illuminated: '已点亮', closed: '已关闭' };
  return labels[status || ''] || status || '稳定';
}

function siteTypeName(type?: string) {
  const labels: Record<string, string> = { heritage: '遗产节点', workshop: '协作节点', event: '事件节点', route: '路线节点' };
  return labels[type || ''] || type || '遗产节点';
}

const siteMedallionAssets: Record<string, string> = { yungang: 'heritage-medallion-1.png', huayan_temple: 'heritage-medallion-2.png', pingcheng_ruins: 'heritage-medallion-3.png', wall_pass: 'heritage-medallion-4.png', trade_post: 'heritage-medallion-5.png', northern_workshop: 'heritage-medallion-6.png' };

function eventTypeName(type?: string) {
  const labels: Record<string, string> = { weathering: '风化压力', route: '路线变化', exchange: '交流变化', research: '研究线索' };
  return labels[type || ''] || type || '区域事件';
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
  if (useful && domain) return `回应此处委托的「${domain}」线索，适合优先交付。`;
  if (task?.required_origin_diversity && task.required_origin_diversity > 1) return '来自另一条脉络，可补足这段故事的互证。';
  return domain ? `属于「${domain}」线索，也许会在后续节点显出意义。` : '先收入手中，等待合适的节点召唤它。';
}

function marketOutcome(card: ContentCard | undefined) {
  const instant = textField(card, 'instant_use_text', 'combo_reward_text');
  return instant ? `收入手中；${instant}` : '收入手中；之后可交付给委托，或在合适时机使用。';
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
  const siteType = siteTypeName(recordText(site, 'type', 'kind'));
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
      <div className="inspector-site-mark"><img src={`/ui-assets/ornaments/${siteMedallionAssets[site.id] || 'heritage-medallion-1.png'}`} alt="" /></div>
      <h2>{site.name}</h2>
      <div className="inspector-meta"><span>{siteType}</span><span className={site.status}>{statusName(site.status)}</span></div>
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
          <div className="tab-kicker"><Target size={14} />节点委托</div>
          <h3>{task.name}</h3>
          <p>{recordText(task, 'description') || task.culture_explanation || '把相互印证的文化证据投入地点任务，推动共同目标。'}</p>
          <div className="task-workflow" aria-label="任务完成步骤">
            <div className="task-step"><span className={isCurrentSite ? 'complete' : ''}>{isCurrentSite ? <Check size={13} /> : '1'}</span><div><b>抵达此处</b><small>{isCurrentSite ? '你已来到节点，可以开始寻访。' : `沿路线前往${site.name}，那里正在等待你的脚步。`}</small></div></div>
            <div className="task-step"><span className={matchingHand > 0 ? 'complete' : ''}>{matchingHand > 0 ? <Check size={13} /> : '2'}</span><div><b>寻访文化线索</b><small>消耗 1 AP 从公开市场取走一件线索，手牌最多收纳 3 张。</small></div></div>
            <div className="task-step"><span className={contributions.length >= (task.required_card_count || 1) ? 'complete' : ''}>{contributions.length >= (task.required_card_count || 1) ? <Check size={13} /> : '3'}</span><div><b>交付并完成互证</b><small>{contributions.length} / {task.required_card_count || 1} 件线索；需要 {task.required_domains.map(domain => domainName(meta, domain)).join('、')}。</small></div></div>
          </div>
          {task.required_origin_diversity > 1 && <div className="task-rule-callout"><Info size={15} /><span>这段故事需要 {task.required_origin_diversity} 种来源彼此映证。带回不同来处的线索，才能让联系站得住脚。</span></div>}
          <div className="domain-list">{task.required_domains.map(domain => <span key={domain}>{domainName(meta, domain)}</span>)}</div>
          <div className="task-action-row"><button disabled={!isCurrentSite} onClick={() => onSelectAction('explore')}><Compass size={15} />寻访一件线索</button><button disabled={!isCurrentSite || matchingHand === 0} onClick={() => onSelectAction('contribute')}><HandHeart size={15} />交付手中线索</button></div>
          {!isCurrentSite && <div className="task-access-hint"><MapPinned size={15} />你可以先读完这里的记载；抵达节点后，才能亲自寻访和交付。</div>}
          {recordText(task, 'route_synergy') && <p className="task-note">完成后影响：{recordText(task, 'route_synergy')}</p>}
        </> : <div className="empty-tab"><Target size={22} /><h3>这里暂时没有开放任务</h3><p>先查看地图上其他节点，或等待事件目标出现。</p></div>}
      </section>}

      {tab === 'event' && <section className="event-tab">
        {event ? <><div className="tab-kicker"><CircleAlert size={14} />需要回应的世界变化</div><div className="event-art"><img src={`/ui-assets/generated/${recordText(event, 'art_asset') || 'scene_yungang_day.png'}`} alt="" /><div><h3>{event.name}</h3><span>{eventTypeName(recordText(event, 'type'))}</span></div></div><p>{recordText(eventRecord, 'description') || event.forecast_text}</p>{eventTargetLabels.length > 0 && <div className="event-brief"><b>影响范围</b><span>{eventTargetLabels.join('、')}</span></div>}{event.mitigation_hint && <div className="task-rule-callout"><Info size={15} /><span>{event.mitigation_hint}</span></div>}<button className="primary-action" onClick={() => onSelectAction('resolve_event')}>查看应对选项</button></> : <div className="empty-tab"><CircleAlert size={22} /><h3>本回合没有待处理事件</h3><p>事件出现时，这里会告诉你影响范围、风险和可选回应。</p></div>}
      </section>}

      {tab === 'market' && <section className="market-tab">
        <div className="market-heading"><div><div className="tab-kicker"><Library size={14} />行动前先比较</div><h3>公开文化市场</h3></div><span>{marketCards.length} 张候选</span></div>
        <p className="market-help">三件线索各自指向不同的文化脉络。金边线索能回应眼前的委托，其他线索或许会在下一处节点派上用场；取走一件消耗 1 AP。</p>
        <div className="market-legend"><span className="legend-match">金边 · 回应此处委托</span><span>灰边 · 留作后用</span><span>手牌最多 3 件</span></div>
        {!isCurrentSite && <div className="task-access-hint"><Compass size={15} />你可以先辨认市场中的线索；抵达{site.name}后，才能将它带走，不会提前消耗 AP。</div>}
        <div className="market-row">{marketCards.map(item => {
          const explore = legal.find(candidate => candidate.type === 'explore' && candidate.card_id === item.id);
          const useful = Boolean(task?.required_domains.includes(item.domain || ''));
          const description = textField(item, 'description', 'summary') || '一条等待被放入更大文化脉络的线索。';
          const combo = textField(item, 'combo_name');
          return <button key={item.id} className={`culture-card ${useful ? 'useful' : ''} ${actionMode === 'explore' && explore ? 'selected' : ''}`} disabled={!isCurrentSite || !explore} onClick={() => onExplore(item.id)} aria-label={`选择${item.name}：${marketReason({ ...item, domain: item.domain ? domainName(meta, item.domain) : item.domain }, task, useful)}`}>
            <img src={`/ui-assets/${item.icon_asset || 'icon_card_scroll.png'}`} alt="" />
            <span className="culture-card-copy"><b>{item.name}</b><small>{item.domain ? domainName(meta, item.domain) : '文化证据'} · {marketReason({ ...item, domain: item.domain ? domainName(meta, item.domain) : item.domain }, task, useful)}</small><em>{description}</em>{combo && <i>{comboNames[combo] || combo} · 组合后获得额外影响</i>}</span>
            <strong>{!isCurrentSite ? '抵达后' : explore ? '选这张' : '不可选'}<small>{explore ? `${explore.cost || 1} AP` : ''}</small></strong>
          </button>;
        })}</div>
        {marketCards.length > 0 && <div className="market-outcome"><b>带走线索后</b><span>{marketOutcome(marketCards[0])}</span><small>确认之前不会消耗 AP；交付时再回到“节点委托”查看它是否合用。</small></div>}
      </section>}
    </div>
  </aside>;
}
