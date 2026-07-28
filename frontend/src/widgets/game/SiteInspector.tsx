import { useEffect, useState } from 'react';
import { Check, ChevronLeft, CircleAlert, Compass, HandHeart, Info, Library, MapPinned, Target, X } from 'lucide-react';
import type { Action, ActionType, ContentCard, ContentEvent, GameState, Meta, Site, Task } from '../../types/game';
import { comboNames, contentClassName, domainName, eventTypeName, formatRequirementValues, marketOutcome, marketReason, recordText, siteTypeName, statusName, textField } from './inspectorFormatters';

type InspectorTab = 'task' | 'event' | 'market';

const siteMedallionAssets: Record<string, string> = {
  yungang: 'heritage-medallion-1.png',
  huayan_temple: 'heritage-medallion-2.png',
  pingcheng_ruins: 'heritage-medallion-3.png',
  wall_pass: 'heritage-medallion-4.png',
  trade_post: 'heritage-medallion-5.png',
  northern_workshop: 'heritage-medallion-6.png',
};

const domainAssets: Partial<Record<string, string>> = {
  architecture: '/ui-assets/game-ui/domains/ui_yungang_domain_architecture_01.png',
  pattern: '/ui-assets/game-ui/domains/ui_yungang_domain_pattern_01.png',
};

export function SiteInspector({ state, meta, site, task, event, cards, legal, actionMode, collapsed, onCollapsedChange, onExplore, onSelectAction, onInterpret, onFormInterpretation, onChooseIntervention, eventTargetLabels = [], className = '' }: {
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
  onInterpret: (cardId: string, relation: 'support' | 'conflict' | 'pending') => void;
  onFormInterpretation: () => void;
  onChooseIntervention: (choice: 'act_now' | 'minimal' | 'record') => void;
  eventTargetLabels?: string[];
  className?: string;
}) {
  const eventPriority = Boolean(state.pending_choice || state.shared.current_event_id);
  const initialTab: InspectorTab = actionMode === 'explore' ? 'market' : eventPriority ? 'event' : 'task';
  const [tab, setTab] = useState<InspectorTab>(initialTab);

  useEffect(() => {
    setTab(actionMode === 'explore' ? 'market' : eventPriority ? 'event' : 'task');
  }, [actionMode, eventPriority, site.id, event?.id]);

  const active = state.players[state.shared.active_player_id];
  const siteType = siteTypeName(recordText(site, 'type', 'kind'));
  const siteDescription = recordText(site, 'description');
  const eventRecord = event as unknown as Record<string, unknown> | undefined;
  const isCurrentSite = active.location === site.id;
  const action = legal.find(item => item.target_id === site.id || item.target_site_id === site.id) || legal.find(item => item.type === 'explore' && isCurrentSite);
  const eventResponseAvailable = state.pending_choice?.kind === 'event';
  const contributions = task?.contributed_cards || [];
  const matchingHand = active.hand.filter(id => task?.required_domains.includes(cards[id]?.domain || '')).length;
  const marketCards = state.market.map(id => cards[id]).filter(Boolean);
  const tabId = (name: InspectorTab) => `inspector-tab-${site.id}-${name}`;
  const panelId = (name: InspectorTab) => `inspector-panel-${site.id}-${name}`;

  if (collapsed) {
    return <aside className="inspector-rail"><button type="button" className="inspector-expand" onClick={() => onCollapsedChange(false)} aria-label="展开地点详情"><ChevronLeft size={17} /><span>地点详情</span></button></aside>;
  }

  return <aside className={`site-inspector ${className}`.trim()} aria-label="地点详情">
    <button type="button" className="inspector-collapse" onClick={() => onCollapsedChange(true)} aria-label="收起地点详情"><X size={16} /></button>
    <header className="inspector-summary">
      <span className="eyebrow">当前聚焦地点</span>
      <div className="inspector-site-mark"><img src={`/ui-assets/ornaments/${siteMedallionAssets[site.id] || 'heritage-medallion-1.png'}`} alt="" /></div>
      <h2>{site.name}</h2>
      <div className="inspector-meta"><span>{siteType}</span><span className="content-class-badge">{contentClassName(site.content_class)}</span><span className={site.status}>{statusName(site.status)}</span></div>
      <p>{site.summary || siteDescription || '在这里寻找能够连接不同地点与文化脉络的证据。'}</p>
      {action && <div className="relevant-action"><span>当前相关行动</span><b>{action.label}</b><small>{action.cost || 0} AP</small></div>}
    </header>
    <div className="inspector-tabs" role="tablist" aria-label="地点信息">
      <button type="button" id={tabId('task')} role="tab" aria-selected={tab === 'task'} aria-controls={panelId('task')} tabIndex={tab === 'task' ? 0 : -1} onClick={() => setTab('task')}><Target size={15} aria-hidden="true" />任务</button>
      <button type="button" id={tabId('event')} role="tab" aria-selected={tab === 'event'} aria-controls={panelId('event')} tabIndex={tab === 'event' ? 0 : -1} onClick={() => setTab('event')}><CircleAlert size={15} aria-hidden="true" />事件</button>
      <button type="button" id={tabId('market')} role="tab" aria-selected={tab === 'market'} aria-controls={panelId('market')} tabIndex={tab === 'market' ? 0 : -1} onClick={() => setTab('market')}><Library size={15} aria-hidden="true" />市场</button>
    </div>
    <div className="inspector-content">
      {tab === 'task' && <section id={panelId('task')} className="task-tab" role="tabpanel" aria-labelledby={tabId('task')}>
        {task ? <>
          <div className="tab-kicker"><Target size={14} />节点委托</div>
          <div className="inspector-title-row"><img className="task-badge-art task-seal-art" src={task.completed ? '/ui-assets/game-ui/seals/ui_yungang_task_seal_complete_01.png' : '/ui-assets/game-ui/seals/ui_yungang_task_seal_idle_01.png'} alt="" /><h3>{task.name}</h3></div>
          <p>{recordText(task, 'description') || task.culture_explanation || '把相互印证的文化证据投入节点任务，推动共同目标。'}</p>
          <div className="task-workflow" aria-label="任务完成步骤">
            <div className="task-step"><span className={isCurrentSite ? 'complete' : ''}>{isCurrentSite ? <Check size={13} /> : '1'}</span><div><b>抵达此处</b><small>{isCurrentSite ? '你已来到节点，可以开始寻访。' : `沿路线前往${site.name}，那里正在等待你的脚步。`}</small></div></div>
            <div className="task-step"><span className={matchingHand > 0 ? 'complete' : ''}>{matchingHand > 0 ? <Check size={13} /> : '2'}</span><div><b>寻访文化线索</b><small>消耗 1 AP 从公开市场取走一件线索，手牌最多收纳 3 张。</small></div></div>
            <div className="task-step"><span className={contributions.length >= (task.required_card_count || 1) ? 'complete' : ''}>{contributions.length >= (task.required_card_count || 1) ? <Check size={13} /> : '3'}</span><div><b>在研究台归类证据</b><small>{contributions.length} / {task.required_card_count || 1} 件已归类；需要 {task.required_domains.map(domain => domainName(meta, domain)).join('、')}。</small></div></div>
            <div className="task-step"><span className={task.completed ? 'complete' : ''}>{task.completed ? <Check size={13} /> : '4'}</span><div><b>形成解释并选择干预</b><small>{task.interpretation?.formed ? '解释已形成，请选择如何回应这段文化关系。' : '支持、冲突与待确认会共同决定解释的可信度。'}</small></div></div>
          </div>
          {task.required_origin_diversity > 1 && <div className="task-rule-callout"><Info size={15} /><span>这段故事需要 {task.required_origin_diversity} 种来源彼此印证。带回不同来处的线索，才能让联系站得住脚。</span></div>}
          <div className="domain-list">{task.required_domains.map(domain => <span key={domain}>{domainAssets[domain] && <img src={domainAssets[domain]} alt="" />}{domainName(meta, domain)}</span>)}</div>
          <EvidenceLedger task={task} cards={cards} hand={active.hand} meta={meta} disabled={!isCurrentSite} onInterpret={onInterpret} onForm={onFormInterpretation} onIntervene={onChooseIntervention} />
          {task.progress?.requirements?.length ? <div className="requirement-list" aria-label="任务条件进度">{task.progress.requirements.map(requirement => <div key={requirement.key} className={requirement.complete ? 'complete' : ''}><span>{requirement.complete ? <Check size={12} /> : <Info size={12} />}</span><b>{requirement.label}</b><small>{requirement.missing?.length ? `还需要：${formatRequirementValues(meta, requirement.key, requirement.missing)}` : typeof requirement.current === 'number' && typeof requirement.target === 'number' ? `${requirement.current} / ${requirement.target}` : requirement.complete ? '已满足' : '尚未满足'}</small></div>)}</div> : null}
          <div className="task-action-row"><button type="button" disabled={!isCurrentSite} onClick={() => onSelectAction('explore')}><Compass size={15} />寻访一件线索</button><span className="task-action-status">{matchingHand ? '手牌里已有可研判证据' : '寻找与委托相关的证据'}</span></div>
          {!isCurrentSite && <div className="task-access-hint"><MapPinned size={15} />你可以先读完这里的记载；抵达节点后，才能亲自寻访和交付。</div>}
          {recordText(task, 'route_synergy') && <p className="task-note">完成后影响：{recordText(task, 'route_synergy')}</p>}
        </> : <div className="empty-tab"><Target size={22} /><h3>这里暂时没有开放任务</h3><p>先查看地图上其他节点，或等待事件目标出现。</p></div>}
      </section>}

      {tab === 'event' && <section id={panelId('event')} className="event-tab" role="tabpanel" aria-labelledby={tabId('event')}>
        {event ? <><div className="tab-kicker"><CircleAlert size={14} />需要回应的世界变化</div><div className="event-art"><img className="event-art-badge" src="/ui-assets/interaction/objective-badges/risk.png" alt="" /><img className="event-art-scene" src={`/ui-assets/generated/${recordText(event, 'art_asset') || 'scene_yungang_day.png'}`} alt="" /><div><h3>{event.name}</h3><span>{eventTypeName(recordText(event, 'type'))}</span></div></div><p>{recordText(eventRecord, 'description') || event.forecast_text}</p>{eventTargetLabels.length > 0 && <div className="event-brief"><b>影响范围</b><span>{eventTargetLabels.join('、')}</span></div>}{event.mitigation_hint && <div className="task-rule-callout"><Info size={15} /><span>{event.mitigation_hint}</span></div>}{eventResponseAvailable ? <button type="button" className="primary-action" onClick={() => onSelectAction('resolve_event')}>查看应对选项</button> : <details className="event-response-details"><summary>查看影响范围</summary><div className="task-rule-callout"><Info size={15} /><span>当前仍在事件预告阶段。回合结算时会锁定影响范围，并开放正式应对选项。</span></div></details>}</> : <div className="empty-tab"><CircleAlert size={22} /><h3>本回合没有待处理事件</h3><p>事件出现时，这里会告诉你影响范围、风险和可选回应。</p></div>}
      </section>}

      {tab === 'market' && <section id={panelId('market')} className="market-tab" role="tabpanel" aria-labelledby={tabId('market')}>
        <div className="market-heading"><div><div className="tab-kicker"><Library size={14} />行动前先比较</div><h3>公开文化市场</h3></div><span>{marketCards.length} 张候选</span></div>
        <p className="market-help">三件线索各自指向不同的文化脉络。金边线索能回应眼前的委托，其他线索也许会在下一处节点派上用场；取走一件消耗 1 AP。</p>
        <div className="market-legend"><span className="legend-match">金边 · 回应此处委托</span><span>灰边 · 留作后用</span><span>手牌最多 3 件</span></div>
        {!isCurrentSite && <div className="task-access-hint"><Compass size={15} />你可以先辨认市场中的线索；抵达{site.name}后，才能将它带走，不会提前消耗 AP。</div>}
        <div className="market-row">{marketCards.map(item => {
          const explore = legal.find(candidate => candidate.type === 'explore' && candidate.card_id === item.id);
          const useful = Boolean(task?.required_domains.includes(item.domain || ''));
          const description = textField(item, 'description', 'summary') || '一条等待被放入更大文化脉络的线索。';
          const combo = textField(item, 'combo_name');
          const displayDomain = item.domain ? domainName(meta, item.domain) : '文化证据';
          const reason = marketReason({ ...item, domain: displayDomain }, task, useful);
          return <button type="button" key={item.id} className={`culture-card ${useful ? 'useful' : ''} ${actionMode === 'explore' && explore ? 'selected' : ''}`} disabled={!isCurrentSite || !explore} onClick={() => onExplore(item.id)} aria-label={`选择${item.name}，${reason}`}>
            <img src={`/ui-assets/${item.icon_asset || 'icon_card_scroll.png'}`} alt="" />
            <span className="culture-card-copy"><b>{item.name}</b><small>{displayDomain} · {reason}</small><em>{description}</em>{combo && <i>{comboNames[combo] || combo} · 组合后获得额外影响</i>}</span>
            <strong>{!isCurrentSite ? '抵达后' : explore ? '选这件' : '不可选'}<small>{explore ? `${explore.cost || 1} AP` : ''}</small></strong>
            <span className="market-card-tooltip" role="tooltip"><b>{item.name}</b><span>{description}</span>{combo && <small>{comboNames[combo] || combo} · 组合后获得额外影响。</small>}</span>
          </button>;
        })}</div>
        {marketCards.length > 0 && <div className="market-outcome"><b>带走线索后</b><span>{marketOutcome(marketCards[0])}</span><small>确认之前不会消耗 AP；交付时再回到“节点委托”查看它是否合用。</small></div>}
      </section>}
    </div>
  </aside>;
}

function EvidenceLedger({ task, cards, hand, meta, disabled, onInterpret, onForm, onIntervene }: { task: Task; cards: Record<string, ContentCard>; hand: string[]; meta: Meta; disabled: boolean; onInterpret: (cardId: string, relation: 'support' | 'conflict' | 'pending') => void; onForm: () => void; onIntervene: (choice: 'act_now' | 'minimal' | 'record') => void }) {
  const placements = task.interpretation?.placements || [];
  const contributed = placements.map(item => item.card_id);
  const requiredTags = task.combo_requirement?.required_combo_tags || [];
  const contributedCards = contributed.map(id => cards[id]).filter(Boolean);
  const contributedTags = new Set(contributedCards.flatMap(item => item.combo_tags || []));
  const candidates = hand.map(id => cards[id]).filter((item): item is ContentCard => Boolean(item)).filter(item => !contributed.includes(item.id) && (task.required_domains.includes(item.domain || '') || (item.combo_tags || []).some(tag => requiredTags.includes(tag))));
  const missingTags = requiredTags.filter(tag => !contributedTags.has(tag));

  const relationLabel = { support: '支持', conflict: '冲突', pending: '待确认' } as const;
  const formed = Boolean(task.interpretation?.formed);
  return <section className="evidence-ledger" aria-label="当前互证台">
    <div className="evidence-ledger-head"><b>研究台 · 不是配对，而是判断</b><small>{contributed.length} 件已归位 · {candidates.length} 件手中可用</small></div>
    <div className="evidence-ledger-track">
      {contributedCards.length ? placements.map(placement => { const item = cards[placement.card_id]; return item ? <span key={placement.card_id} className={`evidence-chip placed ${placement.relation}`}><img src={`/ui-assets/${item.icon_asset || 'icon_card_scroll.png'}`} alt="" />{relationLabel[placement.relation]} · {item.name}</span> : null; }) : <span className="evidence-empty">先把一件证据归入支持、冲突或待确认</span>}
    </div>
    {requiredTags.length > 0 && <div className="evidence-combo"><img src="/ui-assets/game-ui/ribbons/ui_yungang_combo_ribbon_01.png" alt="" /><b>本委托的关键互证</b><span>{missingTags.length ? `还差：${formatRequirementValues(meta, 'combos', missingTags)}` : '关键互证已经成立'}</span></div>}
    {!formed && candidates.length > 0 && <div className="evidence-next"><b>选择证据关系</b>{candidates.map(item => <div className="evidence-choice" key={item.id}><span><img src={`/ui-assets/${item.icon_asset || 'icon_card_scroll.png'}`} alt="" />{item.name}</span><div><button disabled={disabled} onClick={() => onInterpret(item.id, 'support')}>支持</button><button disabled={disabled} onClick={() => onInterpret(item.id, 'conflict')}>冲突</button><button disabled={disabled} onClick={() => onInterpret(item.id, 'pending')}>待确认</button></div></div>)}</div>}
    {!formed && contributed.length > 0 && <button className="interpretation-primary" disabled={disabled} onClick={onForm}>形成当前解释</button>}
    {formed && <div className="intervention-choice"><b>解释已形成 · 可信度 {task.interpretation?.confidence || 0}</b><span>现在决定如何对待这处遗产。每种选择都会真实改变资源、风险或项目。</span><div><button disabled={disabled} onClick={() => onIntervene('act_now')}>立即处理<small>推进最强；存在冲突时会提高风险</small></button><button disabled={disabled} onClick={() => onIntervene('minimal')}>最小干预<small>修护节点并降低压力</small></button><button disabled={disabled} onClick={() => onIntervene('record')}>先记录<small>保留现场，获得研究线索</small></button></div></div>}
  </section>;
}
