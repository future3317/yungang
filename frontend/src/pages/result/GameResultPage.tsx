import { useQuery } from '@tanstack/react-query';
import { Archive, Trophy } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../shared/api/client';
import { getRoomToken } from '../../shared/roomToken';
import type { GameState, Meta, ScoreState } from '../../types/game';
import { metricLabel } from '../../widgets/game/gameUi';
import { StateChangeList } from '../../widgets/game/StateChangeList';
import { Button } from '../../widgets/ui/Primitives';

const outcomeCopy: Record<string, { title: string; body: string }> = {
  core_project_and_objectives_completed: {
    title: '遗产网络已显影',
    body: '核心团队项目与胜利目标均已完成。你们把分散的证据、路线与守护行动连成了可持续的研判。',
  },
  domain_interpretation_completed: {
    title: '文化研判已完成',
    body: '团队完成了必要的证据互证，并在有限回合内守住了网络。',
  },
  too_many_closed_sites: {
    title: '守护网络失守',
    body: '关闭地点超过场景可承受上限。下一局可优先处理高风险节点与受阻路线。',
  },
  weathering_track_reached_limit: {
    title: '风化压力失控',
    body: '风化压力达到上限。准备、修护与事件应对需要更早介入。',
  },
  round_limit_reached: {
    title: '旅程暂告一段落',
    body: '回合耗尽前尚未完成胜利目标。可沿用相同种子复盘路线与证据选择。',
  },
};

export function GameResultPage() {
  const { roomId = '' } = useParams();
  const navigate = useNavigate();
  const roomToken = roomId ? getRoomToken(roomId) : '';
  const gameQuery = useQuery<GameState>({
    queryKey: ['room-result', roomId, roomToken],
    queryFn: () => api.roomGame(roomId, roomToken),
  });
  const metaQuery = useQuery<Meta>({ queryKey: ['meta'], queryFn: api.meta });
  if (gameQuery.isLoading || metaQuery.isLoading)
    return (
      <main className="result-screen">
        <p>正在整理旅程档案…</p>
      </main>
    );
  if (gameQuery.isError || metaQuery.isError || !gameQuery.data || !metaQuery.data)
    return (
      <main className="result-screen">
        <h1>暂时无法读取旅程结算</h1>
        <p>
          席位凭证可能已失效；返回房间即可重新恢复席位后查看结算。
        </p>
        <div className="result-actions">
          <Button
            context="result"
            disabled={gameQuery.isFetching || metaQuery.isFetching}
            onClick={() => {
              void gameQuery.refetch();
              void metaQuery.refetch();
            }}
          >
            {gameQuery.isFetching || metaQuery.isFetching ? '重新读取中…' : '重新读取'}
          </Button>
          <button onClick={() => navigate(roomId ? `/room/${roomId}` : '/')}>返回{roomId ? '房间' : '首页'}</button>
        </div>
      </main>
    );
  const state = gameQuery.data;
  const result = outcomeCopy[state.shared.outcome_reason || ''] || {
    title: state.shared.outcome === 'victory' ? '旅程完成' : '旅程结束',
    body: '本局记录已保存，可从首页继续新的旅程。',
  };
  const score: ScoreState = {
    tasks: 0,
    routes: 0,
    diversity: 0,
    protection: 0,
    resources: 0,
    efficiency: 0,
    discovery: 0,
    total: 0,
    grade: 'stone',
    ...state.score,
  };
  const closedSites = Object.values(state.sites).filter((site) => site.status === 'closed').length;
  const failureDetail =
    state.shared.outcome === 'victory'
      ? ''
      : state.shared.outcome_reason === 'too_many_closed_sites'
        ? `本局有 ${closedSites} 个节点已关闭，场景上限为 ${state.goal_status?.failure_conditions?.find((item) => item.id === 'closed_sites')?.target ?? '当前上限'} 个。`
        : state.shared.outcome_reason === 'weathering_track_reached_limit'
          ? `本局风化压力达到 ${state.shared.weathering_track} / ${state.shared.weathering_limit}，超过后事件与冲突会让网络失去承受力。`
          : state.shared.outcome_reason === 'round_limit_reached'
            ? `本局已到第 ${state.shared.turn} / ${state.shared.max_rounds} 回合，剩余行动不足以完成胜利目标。`
            : '';
  const roomSeats = state.viewer?.seats || [];
  const projects = Object.fromEntries((metaQuery.data.projects || []).map((project) => [project.id, project]));
  const objectives = Object.fromEntries(
    (metaQuery.data.objectives || []).map((objective) => [objective.id, objective])
  );
  const roles = Object.fromEntries(metaQuery.data.roles.map((role) => [role.id, role]));
  const eventHistory = state.shared.event_history || [];
  const siteNames = Object.fromEntries((metaQuery.data.sites || []).map((site) => [site.id, site.name]));
  const eventDetails = eventHistory.map((item) => {
    const record = item as Record<string, unknown>;
    const event = metaQuery.data.events.find((candidate) => candidate.id === record.event_id);
    const targetIds = (record.resolved_targets || record.revealed_targets || record.event_targets || []) as string[];
    const resolution = Array.isArray(record.resolution) ? (record.resolution as Array<Record<string, unknown>>) : [];
    const changes = resolution.flatMap((result) =>
      Object.entries((result.changes || {}) as Record<string, string | number>).map(([metric, value]) =>
        typeof value === 'number'
          ? { label: metricLabel(metric), delta: value }
          : { label: metricLabel(metric), after: value }
      )
    );
    return {
      name: event?.name || '世界事件',
      targets: targetIds.map((id) => siteNames[id] || state.routes?.[id]?.name || '受影响路线').filter(Boolean),
      changes,
      reason: resolution
        .map((result) => (typeof result.reason === 'string' ? result.reason : ''))
        .filter(Boolean)
        .join('；'),
    };
  });
  const seatSummary = roomSeats
    .map((seat) => `${seat.name || '同行者'} · ${roles[seat.role_id || '']?.name || '尚未选择角色'}`)
    .join('　');
  return (
    <main className="result-screen">
      <section className={`result-card ${state.shared.outcome}`}>
        <span className="eyebrow">
          <Trophy size={16} />
          {roomId ? '房间旅程结算' : '旅程结算'}
        </span>
        <h1>{result.title}</h1>
        <p>{state.result?.outcome_summary || result.body}</p>
        {failureDetail && (
          <div className="result-failure-reason" role="status">
            <b>这局为什么结束</b>
            <span>{failureDetail}</span>
          </div>
        )}
        {roomId ? (
          <div className="result-context">
            <b>
              {state.viewer?.play_mode === 'multi_device'
                ? '多设备同行'
                : state.viewer?.play_mode === 'local'
                  ? '本地协作'
                  : '单人协作'}
            </b>
            <span>{seatSummary}</span>
          </div>
        ) : null}
        <div className="result-score">
          <strong>{score.total}</strong>
          <span>团队评分 · {score.grade === 'gold' ? '金' : score.grade === 'silver' ? '银' : '铜'}级</span>
        </div>
        <div className="result-metrics">
          <span>
            地点任务 <b>{score.tasks}</b>
          </span>
          <span>
            路线 <b>{score.routes}</b>
          </span>
          <span>
            来源 <b>{score.diversity}</b>
          </span>
          <span>
            守护 <b>{score.protection}</b>
          </span>
          <span>
            发现 <b>{score.discovery}</b>
          </span>
          <span>
            效率 <b>{score.efficiency}</b>
          </span>
          <span title="资源余量不计入团队评分">
            资源余量 <b>{score.resources}</b>
          </span>
        </div>
        {state.result?.completed_projects?.length ? (
          <div className="result-projects">
            <span className="eyebrow">已完成团队项目</span>
            <p>{state.result.completed_projects.map((id) => projects[id]?.name || '已完成项目').join(' · ')}</p>
          </div>
        ) : null}
        {state.result?.completed_objectives?.length ? (
          <div className="result-projects">
            <span className="eyebrow">胜利目标</span>
            <p>{state.result.completed_objectives.map((id) => objectives[id]?.name || '已完成目标').join(' · ')}</p>
          </div>
        ) : null}
        {eventDetails.length ? (
          <div className="result-projects result-event-log">
            <span className="eyebrow">事件复盘</span>
            {eventDetails.map((item, index) => (
              <div className="result-event-entry" key={`${item.name}-${index}`}>
                <b>{item.name}</b>
                <span>影响：{item.targets.length ? item.targets.join('、') : '本轮未记录具体地点'}</span>
                {item.reason && <small>{item.reason}</small>}
                <StateChangeList compact changes={item.changes} />
              </div>
            ))}
          </div>
        ) : null}
        <div className="result-explanation">
          <span className="eyebrow">评分依据</span>
          <p>地点任务与团队项目体现研判完成度；路线与守护体现网络稳定度；来源与发现体现研究广度；效率分取决于剩余回合。</p>
        </div>
        <p className="result-seed">复盘种子：{state.seed ?? '本局随机'}</p>
        <div className="result-actions">
          <button onClick={() => navigate('/')}>
            <Archive size={17} />
            返回首页
          </button>
        </div>
      </section>
    </main>
  );
}
