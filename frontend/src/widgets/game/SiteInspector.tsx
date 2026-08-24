import { useEffect, useState, type KeyboardEvent } from 'react';
import { Check, ChevronLeft, CircleAlert, Compass, HandHeart, Info, Library, MapPinned, Target } from 'lucide-react';
import type { Action, ActionOption, ActionType, ContentCard, ContentEvent, GameState, Meta, SiteReference, Task } from '../../types/game';
import { contentTagName, domainName, eventTargetRuleName, eventTypeName, formatProjectRequirements, formatProjectReward, formatRequirementValues, marketOutcome, marketReason, recordText, siteTypeName, textField } from './inspectorFormatters';
import { interpretationConfidenceGuidance, metricLabel, optionAction, previewDeltaText } from './gameUi';
import { assetUrl } from '../../shared/assetUrl';
import styles from './SiteInspector.module.css';
import { resolveEventSceneAsset } from './eventArtwork';
import { SiteInspectorSummary } from './SiteInspectorSummary';

type InspectorTab = 'task' | 'project' | 'event' | 'market';

const domainAssets: Partial<Record<string, string>> = {
  architecture: assetUrl('game-ui/domains/ui_yungang_domain_architecture_01.webp'),
  pattern: assetUrl('game-ui/domains/ui_yungang_domain_pattern_01.webp'),
};

export function SiteInspector({ state, meta, site, task, event, cards, legal, actionOptions, actionMode, collapsed, onCollapsedChange, onExplore, onSelectAction, onInterpret, onFormInterpretation, onChooseIntervention, eventTargetLabels = [], eventTargetIds = [], eventOpenTargetLabels = [], requestedInspectorTab = null, onInspectorTabHandled, canAct = true, className = '' }: {
  state: GameState;
  meta: Meta;
  site: SiteReference;
  task?: Task;
  event?: ContentEvent;
  cards: Record<string, ContentCard>;
  legal: Action[];
  actionOptions: ActionOption[];
  actionMode: ActionType | null;
  collapsed: boolean;
  onCollapsedChange: (next: boolean) => void;
  onExplore: (id: string) => void;
  onSelectAction: (type: ActionType) => void;
  onInterpret: (cardId: string, relation: 'support' | 'conflict' | 'pending') => void;
  onFormInterpretation: () => void;
  onChooseIntervention: (choice: 'act_now' | 'minimal' | 'record') => void;
  eventTargetLabels?: string[];
  eventTargetIds?: string[];
  eventOpenTargetLabels?: string[];
  requestedInspectorTab?: InspectorTab | null;
  onInspectorTabHandled?: () => void;
  canAct?: boolean;
  className?: string;
}) {
  canAct = canAct ?? true;
  eventOpenTargetLabels = eventOpenTargetLabels || [];
  eventTargetLabels = eventTargetLabels || [];
  eventTargetIds = eventTargetIds || [];
  const [tab, setTab] = useState<InspectorTab>('task');
  const tabOrder: InspectorTab[] = ['task', 'project', 'event', 'market'];
  useEffect(() => {
    if (!requestedInspectorTab) return;
    setTab(requestedInspectorTab);
    onInspectorTabHandled?.();
  }, [onInspectorTabHandled, requestedInspectorTab]);
  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, current: InspectorTab) => {
    const index = tabOrder.indexOf(current);
    const next = event.key === 'ArrowRight' ? tabOrder[(index + 1) % tabOrder.length] : event.key === 'ArrowLeft' ? tabOrder[(index - 1 + tabOrder.length) % tabOrder.length] : event.key === 'Home' ? tabOrder[0] : event.key === 'End' ? tabOrder[tabOrder.length - 1] : null;
    if (!next) return;
    event.preventDefault();
    setTab(next);
    requestAnimationFrame(() => document.getElementById(tabId(next))?.focus());
  };
  const active = state.players[state.shared.active_player_id];
  const siteType = siteTypeName(recordText(site, 'type', 'kind'));
  const siteDescription = recordText(site, 'description');
  const eventRecord = event as unknown as Record<string, unknown> | undefined;
  const eventSceneAsset = resolveEventSceneAsset(event ? { id: event.id, scene_asset: recordText(eventRecord, 'scene_asset'), type: recordText(eventRecord, 'type') } : undefined);
  const isCurrentSite = active.location === site.id;
  const project = Object.values(state.projects || {}).find(projectItem => projectItem.site_id === site.id);
  const projectMeta = project ? meta.projects?.find(item => item.id === project.id) as (Record<string, unknown> | undefined) : undefined;
  const eventEffect = eventRecord?.effect && typeof eventRecord.effect === 'object' ? eventRecord.effect as Record<string, unknown> : undefined;
  const eventEffectType = typeof eventEffect?.type === 'string' ? eventEffect.type : '';
  const eventDamage = eventEffectType === 'damage_open_sites' ? Math.max(0, Number(eventEffect?.amount ?? event?.damage ?? 0)) : 0;
  const affectsRoutes = eventEffectType === 'block_route' || Object.keys(event?.preview_delta || {}).some(key => ['route_risk', 'route_status', 'travel_cost'].includes(key));
  const eventTone = recordText(eventRecord, 'tone') || (Array.isArray(event?.tags) && event.tags.includes('opportunity') ? 'opportunity' : eventDamage > 0 ? 'hazard' : 'neutral');
  const eventToneLabel = eventTone === 'opportunity' ? '本轮机会' : eventTone === 'hazard' ? '风险提示' : '环境变化';
  const projectStage = project?.stages?.[project.stage_index];
  const projectStageId = projectStage?.id || String(project?.stage_index || 0);
  const projectStageProgress = project ? project.stage_progress?.[projectStageId] || 0 : 0;
  const projectStageTarget = projectStage?.required_progress || 1;
  const eventResponseAvailable = state.pending_choice?.kind === 'event';
  const interventionActions = actionOptions.filter(item => item.type === 'choose_intervention').flatMap(option => option.targets.length ? option.targets.map(target => optionAction(option, target)) : [optionAction(option)]);
  const contributions = task?.contributed_cards || [];
  const requiredDomains = task?.required_domains ?? [];
  const matchingHand = active.hand.filter(id => requiredDomains.includes(cards[id]?.domain || '')).length;
  const cardRequirement = task?.progress?.requirements?.find(item => item.key === 'cards');
  const marketCards = state.market.map(id => cards[id]).filter(Boolean);
  const exploreAvailable = isCurrentSite && legal.some(item => item.type === 'explore');
  const exploreStatus = !isCurrentSite ? '抵达节点后才能寻访证据' : !marketCards.length ? '本轮市场暂时没有可取证据卡' : !exploreAvailable ? '行动点不足或当前阶段不可寻访证据' : matchingHand ? '证据卡里已有待归类证据' : '从市场挑选与地点任务相关的证据卡';
  const tabId = (name: InspectorTab) => `inspector-tab-${site.id}-${name}`;
  const panelId = (name: InspectorTab) => `inspector-panel-${site.id}-${name}`;

  if (collapsed) {
    return <aside className={`${styles.root} inspector-rail`.trim()}><button type="button" className="inspector-expand" onClick={() => onCollapsedChange(false)} aria-label="展开地点详情"><ChevronLeft size={17} /><span>地点详情</span></button></aside>;
  }

  return <aside className={`${styles.root} site-inspector ${className}`.trim()} aria-label="地点详情">
    <SiteInspectorSummary
      site={site}
      siteType={siteType}
      siteDescription={siteDescription}
      onCollapse={() => onCollapsedChange(true)}
    />
    <div className="inspector-tabs" role="tablist" aria-label="地点信息">
      <button type="button" id={tabId('task')} role="tab" aria-selected={tab === 'task'} aria-controls={panelId('task')} tabIndex={tab === 'task' ? 0 : -1} onKeyDown={(event) => onTabKeyDown(event, 'task')} onClick={() => setTab('task')}><Target size={15} aria-hidden="true" />地点任务</button>
      <button type="button" id={tabId('project')} role="tab" aria-selected={tab === 'project'} aria-controls={panelId('project')} tabIndex={tab === 'project' ? 0 : -1} onKeyDown={(event) => onTabKeyDown(event, 'project')} onClick={() => setTab('project')}><HandHeart size={15} aria-hidden="true" />团队项目</button>
      <button type="button" id={tabId('event')} role="tab" aria-selected={tab === 'event'} aria-controls={panelId('event')} tabIndex={tab === 'event' ? 0 : -1} onKeyDown={(event) => onTabKeyDown(event, 'event')} onClick={() => setTab('event')}><CircleAlert size={15} aria-hidden="true" />事件</button>
      <button type="button" id={tabId('market')} role="tab" aria-selected={tab === 'market'} aria-controls={panelId('market')} tabIndex={tab === 'market' ? 0 : -1} onKeyDown={(event) => onTabKeyDown(event, 'market')} onClick={() => setTab('market')}><Library size={15} aria-hidden="true" />市场</button>
    </div>
    <div className="inspector-content">
      {tab === 'task' && <section id={panelId('task')} className="task-tab" role="tabpanel" aria-labelledby={tabId('task')}>
        {task ? <>
          <div className="tab-kicker"><Target size={14} />地点任务</div>
          <div className="inspector-title-row"><img className="task-badge-art task-seal-art" src={assetUrl(task.completed ? 'game-ui/seals/ui_yungang_task_seal_complete_01.webp' : 'game-ui/seals/ui_yungang_task_seal_idle_01.webp')} alt="" /><h3>{task.name}</h3></div>
          <p>{recordText(task, 'description') || task.culture_explanation || '把相互印证的证据卡投入地点任务，推动胜利目标。'}</p>
          <div className="task-status-strip" aria-label="当前任务进度">
            <span>证据 <b>{cardRequirement?.current ?? 0}/{(cardRequirement?.target ?? task.required_card_count) || 1}</b></span>
            <span>领域 <b>{task.progress?.requirements?.find((item) => item.key.includes('domain'))?.current ?? 0}/{requiredDomains.length || 1}</b></span>
            <span>脉络 <b>{task.progress?.requirements?.find((item) => item.key.includes('origin'))?.current ?? 0}/{task.required_origin_diversity || 1}</b></span>
            <span>参与 <b>{task.progress?.requirements?.find((item) => item.key.includes('contributor'))?.current ?? 0}/{task.combo_requirement?.minimum_distinct_players || 1}</b></span>
          </div>
          <div className="task-next-step"><b>当前下一步</b><span>{!isCurrentSite ? `先沿路线抵达${site.name}。` : !cardRequirement?.complete ? '先取得一张符合任务的证据卡。' : !task.interpretation?.formed ? '在研究台归类证据并完成研判。' : '选择处理方式，完成这项委托。'}</span></div>
          <details className="task-rules">
            <summary>查看任务规则</summary>
            <div className="task-workflow" aria-label="任务完成步骤">
              <div className="task-step"><span className={isCurrentSite ? 'complete' : ''}>{isCurrentSite ? <Check size={13} /> : '1'}</span><div><b>抵达此处</b><small>{isCurrentSite ? '你已来到节点，可以开始寻访证据。' : `沿路线前往${site.name}，那里正在等待你的脚步。`}</small></div></div>
              <div className="task-step"><span className={matchingHand > 0 || contributions.length > 0 ? 'complete' : ''}>{matchingHand > 0 || contributions.length > 0 ? <Check size={13} /> : '2'}</span><div><b>寻访证据</b><small>从公开市场取走一张证据卡，证据卡最多收纳 3 张。</small></div></div>
              <div className="task-step"><span className={cardRequirement?.complete ? 'complete' : ''}>{cardRequirement?.complete ? <Check size={13} /> : '3'}</span><div><b>在研究台归类证据</b><small>{cardRequirement?.current ?? 0} / {(cardRequirement?.target ?? task.required_card_count) || 1} 件有效证据；需要 {requiredDomains.map(domain => domainName(meta, domain)).join('、') || '符合地点任务的证据'}。冲突证据不会计入有效数量。</small></div></div>
              <div className="task-step"><span className={task.completed ? 'complete' : ''}>{task.completed ? <Check size={13} /> : '4'}</span><div><b>完成研判并选择处理方式</b><small>{task.interpretation?.formed ? '研判已完成，请选择如何回应这段文化关系。' : '支持、冲突与待确认会共同决定研判的可信度。'}</small></div></div>
            </div>
            {task.required_origin_diversity > 1 && <div className="task-rule-callout"><Info size={15} /><span>这段故事需要 {task.required_origin_diversity} 种线索脉络彼此印证。{task.combo_requirement?.preferred_origins?.length ? `指定线索脉络：${formatRequirementValues(meta, 'origins', task.combo_requirement.preferred_origins)}。` : ''}</span></div>}
            <div className="domain-list">{requiredDomains.map((domain, index) => <span key={`${domain}-${index}`}>{domainAssets[domain] && <img src={domainAssets[domain]} alt="" />}{domainName(meta, domain)}</span>)}</div>
            {task.progress?.requirements?.length ? <div className="requirement-list" aria-label="任务条件进度">{task.progress.requirements.map(requirement => <div key={requirement.key} className={requirement.complete ? 'complete' : ''}><span className={requirement.complete ? 'complete' : 'pending'}>{requirement.complete ? <Check size={12} /> : null}</span><b>{requirement.label}</b><small>{requirement.missing?.length ? `还需要：${formatRequirementValues(meta, requirement.key, requirement.missing)}` : typeof requirement.current === 'number' && typeof requirement.target === 'number' ? `${requirement.current} / ${requirement.target}` : requirement.complete ? '已满足' : '尚未满足'}</small></div>)}</div> : null}
            {task.progress?.interpretation?.reason && <div className="task-rule-callout interpretation-guidance"><Info size={15} /><span>{task.progress.interpretation.reason}</span></div>}
            {!isCurrentSite && <div className="task-access-hint"><MapPinned size={15} />抵达节点后，才能亲自寻访证据并归类。</div>}
            {recordText(task, 'route_synergy') && <p className="task-note">完成后影响：{recordText(task, 'route_synergy')}</p>}
          </details>
          <EvidenceLedger task={task} cards={cards} hand={active.hand} disabled={!canAct || !isCurrentSite} formAvailable={legal.some(item => item.type === 'form_interpretation')} interventionActions={interventionActions} onInterpret={onInterpret} onForm={onFormInterpretation} onIntervene={onChooseIntervention} />
        <div className="task-action-row"><button type="button" disabled={!canAct || !exploreAvailable} onClick={() => onSelectAction('explore')}><Compass size={15} />打开文化市场</button><span className="task-action-status">{!isCurrentSite ? '抵达此节点后可打开文化市场' : !canAct ? '等待当前行动者完成本轮行动' : exploreStatus}</span></div>
        </> : <div className="empty-tab"><Target size={22} /><h3>这里暂时没有开放任务</h3><p>先查看地图上其他节点，或等待事件目标出现。</p></div>}
      </section>}

      {tab === 'project' && <section id={panelId('project')} className="project-tab" role="tabpanel" aria-labelledby={tabId('project')}>
        {project ? <><div className="tab-kicker"><HandHeart size={14} />当前团队项目</div><h3>{project.name}</h3><p>{String(projectMeta?.summary || '这个团队项目把地点行动串成一条共同完成的阶段路线。')}</p><div className="project-stage-track"><b>阶段 {Math.min(project.stage_index + 1, project.stages.length)} / {project.stages.length}</b><span>{project.status === 'completed' ? '团队项目已完成' : projectStage?.name || '当前阶段'}</span><strong>{project.status === 'completed' ? '✓' : `${projectStageProgress} / ${projectStageTarget}`}</strong></div>{projectMeta?.strategy_note && <div className="task-rule-callout"><Info size={15} /><span>{String(projectMeta.strategy_note)}</span></div>}<div className="project-stage-list" aria-label="团队项目阶段">{project.stages.map((stage, index) => { const complete = index < project.stage_index || project.completed_stages?.includes(stage.id) || project.status === 'completed'; const current = !complete && index === project.stage_index; const requirements = current && stage.requirements ? formatProjectRequirements(meta, stage.requirements) : ''; const reward = current ? formatProjectReward(stage.reward) : ''; return <div key={stage.id} className={`project-stage-item ${complete ? 'complete' : ''} ${current ? 'current' : ''}`.trim()}><div className="project-stage-line"><span aria-hidden="true">{complete ? '✓' : current ? '●' : '○'}</span><b>{index + 1} {stage.name}</b>{current && <strong>当前</strong>}</div>{current && <div className="project-stage-detail"><p>{stage.stage_text || '按当前阶段要求完成行动。'}</p>{requirements && <small>阶段条件：{requirements}</small>}{reward && reward !== '暂无额外奖励' && <small>奖励：{reward}</small>}<span className="project-stage-progress">进度 {projectStageProgress} / {projectStageTarget}</span></div>}</div>; })}</div><div className="task-access-hint"><MapPinned size={15} />团队项目进度会影响胜利目标；先完成当前阶段，再进入下一段。</div></> : <div className="empty-tab"><HandHeart size={22} /><h3>这里暂时没有关联团队项目</h3><p>地点任务仍可独立推进，完成后会汇入团队的胜利目标。</p></div>}
      </section>}

      {tab === 'event' && <section id={panelId('event')} className="event-tab" role="tabpanel" aria-labelledby={tabId('event')}>
        {event ? <><div className="tab-kicker"><CircleAlert size={14} />{eventToneLabel}</div><div className="event-art" data-event-id={event.id}><img className="event-art-scene" src={assetUrl(eventSceneAsset)} alt={`${event.name}场景`} /><div className="event-art-copy"><h3>{event.name}</h3><span>{eventTypeName(recordText(event, 'type'))}</span></div></div><div className="event-section"><b>会发生什么</b><p>{recordText(eventRecord, 'description') || event.forecast_text}</p></div><div className="event-section"><b>{eventTone === 'opportunity' ? '顺势回应会怎样' : eventTone === 'hazard' ? '如果不处理会怎样' : '环境会如何变化'}</b><p>{eventTargetLabels.length ? `${eventTargetLabels.join("、")}会按预告${eventTone === 'opportunity' ? '获得本轮机会' : `承受${eventDamage > 0 ? ` ${eventDamage} 点节点损伤` : "本事件影响"}`}${affectsRoutes ? '；相关路线也会按预告变化。' : '。'}` : "当前没有锁定的地点或路线，事件会按本局规则结算。"}</p></div><div className="event-rule-summary"><b>回合结束时结算</b><span>{event.target_rule ? `影响范围：${eventTargetRuleName(event.target_rule, meta)}` : '影响范围由本局种子锁定'}</span></div>{eventTargetLabels.length > 0 && <div className="event-brief"><b>影响范围</b><span>{eventTargetLabels.join('、')}</span>{eventOpenTargetLabels.length > 0 ? <small>仍可守护：{eventOpenTargetLabels.join('、')}</small> : <small>当前没有仍可守护的受影响地点。</small>}</div>}{eventTargetIds.length > 0 && eventDamage > 0 && <div className="event-projection"><b>如果不处理</b>{eventTargetIds.map(id => { const target = state.sites[id]; return target ? <span key={id}>{meta.sites?.find(item => item.id === id)?.name || '受影响地点'} · 损伤 {target.damage} → {Math.min(target.max_damage, target.damage + eventDamage)}{target.damage + eventDamage >= target.max_damage ? ' · 将关闭' : ''}</span> : null; })}</div>}{event.preview_delta && <div className="task-rule-callout"><Info size={15} /><span>预计变化：{Object.entries(event.preview_delta).map(([key, value]) => `${metricLabel(key)} ${Number(value) > 0 ? '+' : ''}${value}`).join('、')}</span></div>}{event.mitigation_hint && <div className="task-rule-callout"><Info size={15} /><span>{event.mitigation_hint}</span></div>}<div className="event-section event-action-section"><b>现在能做什么</b>{eventResponseAvailable ? <button type="button" className="primary-action" disabled={!canAct} onClick={() => onSelectAction('resolve_event')}>{canAct ? '查看应对选项' : '等待当前行动者回应'}</button> : <details className="event-response-details"><summary>查看影响范围</summary><div className="task-rule-callout"><Info size={15} /><span>当前仍在事件预告阶段。地图上的高亮标记就是本回合的影响范围，回合结算时会开放正式应对选项。</span></div></details>}</div></> : <div className="empty-tab"><CircleAlert size={22} /><h3>本回合没有待处理事件</h3><p>事件出现时，这里会告诉你影响范围、风险和可选回应。</p></div>}
      </section>}

      {tab === 'market' && <section id={panelId('market')} className="market-tab" role="tabpanel" aria-labelledby={tabId('market')}>
        <div className="market-heading"><div><div className="tab-kicker"><Library size={14} />行动前先比较</div><h3>公开文化市场</h3></div><span>{marketCards.length} 张候选</span></div>
        <p className="market-help">三件证据卡各自指向不同的文化脉络。标记为“推荐”的证据卡更适合回应眼前的地点任务，其他证据卡也许会在下一处节点派上用场；取走一件消耗 1 点行动点。</p>
        <div className="market-legend"><span className="legend-match">推荐证据卡 · 当前地点任务优先</span><span>其他证据卡 · 留作后用</span><span>证据卡最多 3 件</span></div>
        {!isCurrentSite && <div className="task-access-hint"><Compass size={15} />你可以先辨认市场中的证据卡；抵达{site.name}后，才能将它带走，不会提前消耗 行动点。</div>}
        {!marketCards.length && <div className="empty-tab"><Library size={22} /><h3>本轮没有可取证据卡</h3><p>等待下一次市场补充，或先处理手边已有的证据卡。</p></div>}<div className="market-row">{marketCards.map((item, index) => {
          const explore = legal.find(candidate => candidate.type === 'explore' && candidate.card_id === item.id);
          const useful = Boolean(requiredDomains.includes(item.domain || ''));
          const description = textField(item, 'description', 'summary') || '一张等待被放入更大文化脉络的证据卡。';
          const combo = textField(item, 'combo_name');
          const displayDomain = item.domain ? domainName(meta, item.domain) : '证据卡';
          const reason = marketReason(item, task, useful, meta);
          return <button type="button" key={`${item.id}-${index}`} data-card-id={item.id} className={`culture-card ${useful ? 'useful' : ''} ${actionMode === 'explore' && explore ? 'selected' : ''}`} disabled={!isCurrentSite || !explore} onClick={() => onExplore(item.id)} aria-label={`选择${item.name || '这件证据'}，${reason}`}>
            <img src={assetUrl(item.icon_asset)} alt="" />
            <span className="culture-card-copy"><b>{item.name}</b><small>{displayDomain} · {reason}</small><em>{description}</em>{combo && <i>{contentTagName(combo)} · 组合后获得额外影响</i>}</span>
            <strong>{!isCurrentSite ? '抵达后' : explore ? '选这件' : '不可选'}<small>{explore ? `${explore.cost || 1} 行动点` : ''}</small></strong>
            {useful && <em className="market-match-badge">推荐</em>}
            <span className="market-card-tooltip" role="tooltip"><b>{item.name}</b><span>{description}</span>{combo && <small>{contentTagName(combo)} · 组合后获得额外影响。</small>}</span>
          </button>;
        })}</div>
        {marketCards.length > 0 && <div className="market-outcome"><b>带走证据卡后</b><span>{marketOutcome(marketCards[0])}</span><small>确认之前不会消耗行动点；归类时再回到“地点任务”查看它是否合用。</small></div>}
      </section>}
    </div>
  </aside>;
}

function EvidenceLedger({ task, cards, hand, disabled, formAvailable, interventionActions, onInterpret, onForm, onIntervene }: { task: Task; cards: Record<string, ContentCard>; hand: string[]; disabled: boolean; formAvailable: boolean; interventionActions: Action[]; onInterpret: (cardId: string, relation: 'support' | 'conflict' | 'pending') => void; onForm: () => void; onIntervene: (choice: 'act_now' | 'minimal' | 'record') => void }) {
  const placements = task.interpretation?.placements || [];
  const contributed = placements.map(item => item.card_id);
  const requiredTags = task.combo_requirement?.required_combo_tags || [];
  const requiredDomains = task.required_domains ?? [];
  const contributedCards = contributed.map(id => cards[id]).filter(Boolean);
  const candidates = hand.map(id => cards[id]).filter((item): item is ContentCard => Boolean(item)).filter(item => !contributed.includes(item.id) && (requiredDomains.includes(item.domain || '') || (item.combo_tags || []).some(tag => requiredTags.includes(tag))));

  const relationLabel = { support: '支持', conflict: '冲突', pending: '待确认' } as const;
  const formed = Boolean(task.interpretation?.formed);
  return <section className="evidence-ledger" aria-label="当前互证台">
    <div className="evidence-ledger-head"><div><b>研究台</b><small>将证据归入支持 / 冲突 / 待确认</small></div><span>{contributed.length} 件已归位</span></div>
    <div className="evidence-ledger-track">
      {contributedCards.length ? placements.map(placement => { const item = cards[placement.card_id]; return item ? <span key={placement.card_id} className={`evidence-chip placed ${placement.relation}`}><img src={assetUrl(item.icon_asset)} alt="" />{relationLabel[placement.relation]} · {item.name}</span> : null; }) : <span className="evidence-empty">先把一件证据归入支持、冲突或待确认</span>}
    </div>
    {!formed && candidates.length > 0 && <div className="evidence-next"><b>选择证据关系</b><div className="evidence-legend"><span><strong>支持</strong><small>与当前研判相符，提高可信度</small></span><span><strong>冲突</strong><small>与当前研判不一致，保留重要矛盾</small></span><span><strong>待确认</strong><small>暂不判断，不改变当前可信度</small></span></div>{candidates.map((item, index) => <div className="evidence-choice" data-card-id={item.id} key={`${item.id}-${index}`}><span><img src={assetUrl(item.icon_asset)} alt="" />{item.name}</span><div><button disabled={disabled} aria-label={`${item.name}：支持，与当前研判相符，提高可信度`} onClick={() => onInterpret(item.id, 'support')}>支持</button><button disabled={disabled} aria-label={`${item.name}：冲突，与当前研判不一致`} onClick={() => onInterpret(item.id, 'conflict')}>冲突</button><button disabled={disabled} aria-label={`${item.name}：待确认，暂不判断`} onClick={() => onInterpret(item.id, 'pending')}>待确认</button></div></div>)}</div>}
    {!formed && contributed.length > 0 && <button className="interpretation-primary" disabled={disabled || !formAvailable} onClick={onForm}>完成当前研判</button>}
    {formed && <div className="intervention-choice"><b>研判已完成 · 可信度 {task.interpretation?.confidence || 0}</b><span>{interpretationConfidenceGuidance(task.interpretation?.confidence || 0)}</span><span>现在决定如何对待这处遗产。下面的变化来自当前局面的后端预览。</span><div>{(['act_now', 'minimal', 'record'] as const).map(choice => { const action = interventionActions.find(item => item.target_id === choice); const labels = { act_now: '立即处理', minimal: '最小干预', record: '先记录' }; const hints = { act_now: '推进研判并处理节点', minimal: '稳健修护并降低压力', record: '保留现场并获得研究点' }; return <button key={choice} disabled={disabled || !action} onClick={() => onIntervene(choice)}>{labels[choice]}<small>{action ? previewDeltaText(action.preview_delta, hints[choice]) : hints[choice]}</small></button>; })}</div></div>}
  </section>;
}
