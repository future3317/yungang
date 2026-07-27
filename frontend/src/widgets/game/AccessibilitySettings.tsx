import { Settings2, X } from 'lucide-react';
import { useEffect, useState } from 'react';

type Preferences = { largeText: boolean; highContrast: boolean; reducedMotion: boolean };
const storageKey = 'cave-light-atlas-accessibility';
const defaultPreferences: Preferences = { largeText: false, highContrast: false, reducedMotion: false };

function loadPreferences(): Preferences {
  try { return { ...defaultPreferences, ...JSON.parse(localStorage.getItem(storageKey) || '{}') }; } catch { return defaultPreferences; }
}

export function AccessibilitySettings() {
  const [preferences, setPreferences] = useState<Preferences>(loadPreferences);
  const [open, setOpen] = useState(() => localStorage.getItem(storageKey) === null);
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.largeText = String(preferences.largeText);
    root.dataset.highContrast = String(preferences.highContrast);
    root.dataset.reducedMotion = String(preferences.reducedMotion);
    localStorage.setItem(storageKey, JSON.stringify(preferences));
  }, [preferences]);
  const toggle = (key: keyof Preferences) => setPreferences(current => ({ ...current, [key]: !current[key] }));
  return <div className="accessibility-control"><button className="accessibility-trigger" onClick={() => setOpen(true)} aria-label="打开显示与辅助设置"><Settings2 size={18} /></button>{open && <section className="accessibility-panel" role="dialog" aria-modal="false" aria-label="显示与辅助设置"><button className="dialog-close" onClick={() => setOpen(false)} aria-label="关闭设置"><X size={16} /></button><span className="eyebrow">显示与辅助</span><h2>按你的方式阅读地图</h2><p>这些偏好仅保存在当前设备，可随时调整。</p><Toggle active={preferences.largeText} label="放大文字" hint="提高正文和操作文字尺寸" onClick={() => toggle('largeText')} /><Toggle active={preferences.highContrast} label="高对比度" hint="提高文字与界面边界对比" onClick={() => toggle('highContrast')} /><Toggle active={preferences.reducedMotion} label="减少动态" hint="关闭非必要动画与平移动效" onClick={() => toggle('reducedMotion')} /></section>}</div>;
}

function Toggle({ active, label, hint, onClick }: { active: boolean; label: string; hint: string; onClick: () => void }) {
  return <button className="accessibility-toggle" aria-pressed={active} onClick={onClick}><span><b>{label}</b><small>{hint}</small></span><i>{active ? '已开启' : '已关闭'}</i></button>;
}
