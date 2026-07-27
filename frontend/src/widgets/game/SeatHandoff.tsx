import { ArrowRight, Handshake } from 'lucide-react';

export function SeatHandoff({ name, onContinue }: { name: string; onContinue: () => void }) {
  return <div className="dialog-backdrop seat-handoff-backdrop"><section className="dialog seat-handoff" role="dialog" aria-modal="true" aria-labelledby="seat-handoff-title"><div className="handoff-icon"><Handshake size={26} /></div><span className="eyebrow">席位交接</span><h2 id="seat-handoff-title">请把旅程交给下一位同行者</h2><p>下一段行动属于 <b>{name}</b>。确认屏幕已经交到对方手中，再继续点亮地图。</p><button className="primary-cta" onClick={onContinue}>我已接过席位 <ArrowRight size={16} /></button></section></div>;
}
