import { Settings2, X } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';

type Preferences = { largeText: boolean; highContrast: boolean; reducedMotion: boolean };
const storageKey = 'cave-light-atlas-accessibility';
const positionKey = 'cave-light-atlas-accessibility-position';
const defaultPreferences: Preferences = { largeText: false, highContrast: false, reducedMotion: false };
type Position = { x: number; y: number };

function loadPreferences(): Preferences {
  try { return { ...defaultPreferences, ...JSON.parse(localStorage.getItem(storageKey) || '{}') }; } catch { return defaultPreferences; }
}
function loadPosition(): Position {
  try { return { x: 0, y: 0, ...JSON.parse(localStorage.getItem(positionKey) || '{}') }; } catch { return { x: 0, y: 0 }; }
}

export function AccessibilitySettings() {
  const [preferences, setPreferences] = useState<Preferences>(loadPreferences);
  const [position, setPosition] = useState<Position>(loadPosition);
  const [open, setOpen] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number; moved: boolean } | null>(null);
  const suppressClickRef = useRef(false);
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.largeText = String(preferences.largeText);
    root.dataset.highContrast = String(preferences.highContrast);
    root.dataset.reducedMotion = String(preferences.reducedMotion);
    localStorage.setItem(storageKey, JSON.stringify(preferences));
  }, [preferences]);
  useEffect(() => { localStorage.setItem(positionKey, JSON.stringify(position)); }, [position]);
  useEffect(() => {
    const move = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const x = drag.originX + event.clientX - drag.startX;
      const y = drag.originY + event.clientY - drag.startY;
      if (Math.abs(x - drag.originX) > 4 || Math.abs(y - drag.originY) > 4) drag.moved = true;
      setPosition({ x: Math.max(-window.innerWidth + 62, Math.min(0, x)), y: Math.max(-window.innerHeight + 62, Math.min(0, y)) });
    };
    const end = () => { if (dragRef.current?.moved) suppressClickRef.current = true; dragRef.current = null; };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); };
  }, []);
  const toggle = (key: keyof Preferences) => setPreferences(current => ({ ...current, [key]: !current[key] }));
  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => { suppressClickRef.current = false; dragRef.current = { startX: event.clientX, startY: event.clientY, originX: position.x, originY: position.y, moved: false }; event.currentTarget.setPointerCapture?.(event.pointerId); };
  const handleClick = (event: ReactMouseEvent<HTMLButtonElement>) => { if (suppressClickRef.current || dragRef.current?.moved) { event.preventDefault(); suppressClickRef.current = false; dragRef.current = null; return; } setOpen(true); };
  const style = { '--accessibility-drag-x': `${position.x}px`, '--accessibility-drag-y': `${position.y}px` } as CSSProperties;
  return <div className="accessibility-control" style={style}><button className="accessibility-trigger" onPointerDown={handlePointerDown} onClick={handleClick} title="拖动调整位置，点击打开设置" aria-label="打开显示与辅助设置"><Settings2 size={18} /></button>{open && <section className="accessibility-panel" role="dialog" aria-modal="false" aria-label="显示与辅助设置"><button className="dialog-close" onClick={() => setOpen(false)} aria-label="关闭设置"><X size={16} /></button><span className="eyebrow">显示与辅助</span><h2>按你的方式阅读地图</h2><p>拖动圆形按钮可调整位置；偏好仅保存在当前设备。</p><Toggle active={preferences.largeText} label="放大文字" hint="提高正文和操作文字尺寸" onClick={() => toggle('largeText')} /><Toggle active={preferences.highContrast} label="高对比度" hint="提高文字与界面边界对比" onClick={() => toggle('highContrast')} /><Toggle active={preferences.reducedMotion} label="减少动态" hint="关闭非必要动画与平移动效" onClick={() => toggle('reducedMotion')} /></section>}</div>;
}

function Toggle({ active, label, hint, onClick }: { active: boolean; label: string; hint: string; onClick: () => void }) {
  return <button className="accessibility-toggle" aria-pressed={active} onClick={onClick}><span><b>{label}</b><small>{hint}</small></span><i>{active ? '已开启' : '已关闭'}</i></button>;
}
