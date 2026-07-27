import { useEffect, useState } from 'react';
import { Archive, ArrowRight, Compass, Flag, HelpCircle, Library, MapPinned, Target, X } from 'lucide-react';

const TUTORIAL_KEY = 'yungang-journey-tutorial-v1';

const steps = [
  { icon: Flag, eyebrow: '第 1 步 · 先看共同目标', title: '你不是在找唯一正确答案', body: '顶部的共同目标告诉你这局要一起推进什么。每个回合先判断团队最缺哪种证据或路线，再决定谁行动。', cue: '顶部目标 · 回合 · 共同影响' },
  { icon: MapPinned, eyebrow: '第 2 步 · 选择行动', title: '先移动，再在地点做事', body: '左侧行动会告诉你当前能做什么。点击移动、探索或贡献后，地图只会突出合法目标；不亮的节点可以查看，但不能执行。', cue: '左侧行动栏 · 地图高亮目标' },
  { icon: Target, eyebrow: '第 3 步 · 读懂任务', title: '任务不是一段需要猜的文字', body: '地点右侧的任务页已经拆成抵达、探索、投入三步。按照步骤推进，看到金色勾选就说明这一环完成了。', cue: '右侧「任务」标签 · 三步工作流' },
  { icon: Library, eyebrow: '第 4 步 · 比较市场', title: '三张卡不是同一种选择', body: '金边卡通常匹配当前任务，优先补齐任务要求；其他卡可能提供另一种来源或作为备用线索。每张卡消耗 1 AP，选中后先进入确认预览。', cue: '右侧「市场」标签 · 匹配任务 · 备用线索' },
  { icon: Archive, eyebrow: '第 5 步 · 形成互证', title: '把证据放进手牌，再投入任务', body: '探索得到的证据会进入左侧手牌。回到任务页点击“投入手牌”，选择符合条件的卡；达标后任务才会结算，最后再结束回合。', cue: '左侧手牌 · 投入任务 · 结束回合' },
];

function markSeen() {
  try { window.localStorage.setItem(TUTORIAL_KEY, 'seen'); } catch { /* private browsing can reject storage */ }
}

export function TutorialGuide({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  const current = steps[step];
  const Icon = current.icon;
  const close = () => { markSeen(); onOpenChange(false); };
  const next = () => {
    if (step === steps.length - 1) close();
    else setStep(value => value + 1);
  };

  return <>
    <button className="tutorial-trigger" onClick={() => onOpenChange(true)} aria-label="打开新手教程"><HelpCircle size={18} /><span>怎么玩</span></button>
    {open && <div className="tutorial-backdrop" role="dialog" aria-modal="true" aria-labelledby="tutorial-title">
      <section className="tutorial-dialog">
        <button className="tutorial-close" onClick={close} aria-label="跳过新手教程"><X size={17} /></button>
        <div className="tutorial-icon"><Icon size={25} /></div>
        <span className="eyebrow">{current.eyebrow}</span>
        <h2 id="tutorial-title">{current.title}</h2>
        <p>{current.body}</p>
        <div className="tutorial-cue"><Compass size={15} /><span>{current.cue}</span></div>
        <div className="tutorial-progress" aria-label={`教程进度 ${step + 1} / ${steps.length}`}><span>{steps.map((_, index) => <i key={index} className={index === step ? 'active' : index < step ? 'done' : ''} />)}</span><small>{step + 1} / {steps.length}</small></div>
        <div className="tutorial-actions"><button className="tutorial-skip" onClick={close}>跳过，自己探索</button><button className="primary-cta" onClick={next}>{step === steps.length - 1 ? '开始旅程' : '下一步'}<ArrowRight size={16} /></button></div>
      </section>
    </div>}
  </>;
}
