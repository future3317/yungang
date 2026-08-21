import { useEffect, useState } from 'react';
import { Archive, ArrowRight, Compass, Flag, HelpCircle, Library, MapPinned, Target, X } from 'lucide-react';
import { useDraggablePosition } from '../../shared/useDraggablePosition';
import type { ActionOption, GameState } from '../../types/game';

const TUTORIAL_KEY = 'yungang-journey-tutorial-v1';

const steps = [
  { icon: Flag, eyebrow: '第 1 步 · 俯瞰全局', title: '让线索彼此照见', body: '旅程顶部记录着众人共同追寻的目标。每回合开始时，先看看队伍还缺哪一束线索，再决定沿哪条路线前行。', cue: '共同目标 · 回合 · 共同影响' },
  { icon: MapPinned, eyebrow: '第 2 步 · 踏上路线', title: '沿着线索前往下一处节点', body: '行动点有限。移动会带你抵达新的节点，寻访能取得证据，地图上的金色路线是此刻可以抵达的去处。', cue: '左侧行动 · 地图上的金色路线' },
  { icon: Target, eyebrow: '第 3 步 · 寻访遗迹', title: '在节点留下见证', body: '每个节点都藏着一段尚未连起的故事。抵达后查看当地委托，按所需领域寻访证据，再将它们放入任务，让故事显出完整轮廓。', cue: '地点详情 · 节点委托 · 寻访线索' },
  { icon: Library, eyebrow: '第 4 步 · 取一件线索', title: '三件线索，各自指向一条脉络', body: '公开市场呈现本回合可以带走的三件文化线索。金边线索能回应眼前的节点，其他线索可能为后续地点留下伏笔。每次寻访消耗 1 AP，线索会进入手牌。', cue: '公开市场 · 节点线索 · 后续伏笔' },
  { icon: Archive, eyebrow: '第 5 步 · 互证成章', title: '让不同来源的证据相互印证', body: '寻访所得会收在手牌中。回到节点，在研究台把线索判断为支持、冲突或待确认；当来源和领域都满足时，形成解释并选择干预。', cue: '手牌 · 研究台 · 形成解释' },
];

function markSeen() {
  try { window.localStorage.setItem(TUTORIAL_KEY, 'seen'); } catch { /* private browsing can reject storage */ }
}

export function TutorialGuide({ open, onOpenChange, state, actionOptions = [] }: { open: boolean; onOpenChange: (open: boolean) => void; state?: GameState; actionOptions?: ActionOption[] }) {
  const [step, setStep] = useState(0);
  const drag = useDraggablePosition('yungang-tutorial-trigger-position', { minVisibleWidth: 96, minVisibleHeight: 52 });
  const journeySteps = state ? steps.map((item, index) => index === 0 ? { ...item, body: `当前旅程需要在 ${state.goal_status?.rounds_remaining ?? state.shared.max_rounds - state.shared.turn + 1} 个回合内完成共同目标；风化压力达到上限会导致失败。` } : index === 1 ? { ...item, body: actionOptions.find(option => option.enabled && (option.recommendation_score || 0) > 0)?.reason || item.body } : index === 4 ? { ...item, body: actionOptions.some(option => option.type === 'choose_intervention' && option.enabled) ? '研究台条件已经接近满足：先完成证据关系判断，再形成解释并选择干预。' : item.body } : item) : steps;

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  const current = journeySteps[Math.min(step, journeySteps.length - 1)];
  const Icon = current.icon;
  const close = () => { markSeen(); onOpenChange(false); };
  const next = () => { if (step === journeySteps.length - 1) close(); else setStep(value => value + 1); };

  return <>
    <button type="button" className="tutorial-trigger" style={drag.style} onPointerDown={drag.onPointerDown} onClickCapture={drag.onClickCapture} onClick={() => onOpenChange(true)} aria-label="打开新手教程" title="拖动调整位置，点击打开教程"><HelpCircle size={18} /><span>怎么玩</span></button>
    {open && <div className="tutorial-backdrop" role="dialog" aria-modal="true" aria-labelledby="tutorial-title">
      <section className="tutorial-dialog">
        <button type="button" className="tutorial-close" onClick={close} aria-label="跳过新手教程"><X size={17} /></button>
        <div className="tutorial-icon"><Icon size={25} /></div>
        <span className="eyebrow">{current.eyebrow}</span>
        <h2 id="tutorial-title">{current.title}</h2>
        <p>{current.body}</p>
        <div className="tutorial-cue"><Compass size={15} /><span>{current.cue}</span></div>
        <div className="tutorial-progress" aria-label={`教程进度 ${step + 1} / ${journeySteps.length}`}><span>{journeySteps.map((_, index) => <i key={index} className={index === step ? 'active' : index < step ? 'done' : ''} />)}</span><small>{step + 1} / {journeySteps.length}</small></div>
        <div className="tutorial-actions"><button type="button" className="tutorial-skip" onClick={close}>跳过，自己探索</button><button type="button" className="primary-cta" onClick={next}>{step === journeySteps.length - 1 ? '开始旅程' : '下一步'}<ArrowRight size={16} /></button></div>
      </section>
    </div>}
  </>;
}
