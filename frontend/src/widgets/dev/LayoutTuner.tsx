import { useEffect, useMemo, useState } from 'react';
import { Copy, RotateCcw, SlidersHorizontal, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import '../../styles/layout-debug.css';

type LayoutValue = {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  fallback: number;
};

const STORAGE_KEY = 'yungang-layout-debug-v1';
const values: LayoutValue[] = [
  { key: '--hud-left-width', label: '左侧栏宽', min: 210, max: 360, step: 2, fallback: 274 },
  { key: '--hud-right-width', label: '右侧栏宽', min: 260, max: 430, step: 2, fallback: 338 },
  { key: '--hud-center-gutter', label: '中心留白', min: 12, max: 64, step: 2, fallback: 30 },
  { key: '--hud-panel-top', label: '侧栏顶部', min: 58, max: 150, step: 2, fallback: 92 },
  { key: '--hud-panel-bottom', label: '侧栏底部', min: 0, max: 48, step: 2, fallback: 14 },
  { key: '--hud-footer-bottom', label: '底部浮层', min: 6, max: 72, step: 2, fallback: 20 },
];

type LayoutState = Record<string, number>;

function defaults(): LayoutState {
  return Object.fromEntries(values.map(item => [item.key, item.fallback]));
}

function load(): LayoutState {
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}') as LayoutState;
    return Object.fromEntries(values.map(item => [item.key, Number.isFinite(stored[item.key]) ? stored[item.key] : item.fallback]));
  } catch {
    return defaults();
  }
}

function layoutRoot() {
  return document.querySelector<HTMLElement>('.game-viewport');
}

function applyLayout(layout: LayoutState) {
  const root = layoutRoot();
  if (!root) return;
  values.forEach(item => root.style.setProperty(item.key, `${layout[item.key]}px`));
}

function clearLayoutOverrides() {
  const root = layoutRoot();
  if (!root) return;
  values.forEach(item => root.style.removeProperty(item.key));
}

export function LayoutTuner() {
  const location = useLocation();
  const available = import.meta.env.DEV && (/^\/game\//.test(location.pathname) || /^\/room\/[^/]+\/game/.test(location.pathname));
  const queryEnabled = useMemo(() => new URLSearchParams(location.search).get('layoutDebug') === '1', [location.search]);
  const [open, setOpen] = useState(queryEnabled);
  const [layout, setLayout] = useState<LayoutState>(load);
  const [overrides, setOverrides] = useState(() => window.localStorage.getItem(STORAGE_KEY) !== null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!available) return;
    if (overrides) {
      applyLayout(layout);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
    } else {
      clearLayoutOverrides();
      window.localStorage.removeItem(STORAGE_KEY);
    }
    return clearLayoutOverrides;
  }, [available, layout, overrides]);

  useEffect(() => {
    if (!available) return;
    const toggle = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'l') {
        event.preventDefault();
        setOpen(value => !value);
      }
    };
    window.addEventListener('keydown', toggle);
    return () => window.removeEventListener('keydown', toggle);
  }, [available]);

  if (!available) return null;

  const reset = () => {
    window.localStorage.removeItem(STORAGE_KEY);
    clearLayoutOverrides();
    setLayout(defaults());
    setOverrides(false);
  };
  const copy = async () => {
    const css = values.map(item => `  ${item.key}: ${layout[item.key]}px;`).join('\n');
    await navigator.clipboard.writeText(`:root {\n${css}\n}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  if (!open) {
    return <button type="button" className="layout-tuner-trigger" onClick={() => setOpen(true)} title="布局调试（Ctrl+Shift+L）"><SlidersHorizontal size={16} /><span>布局</span></button>;
  }

  return <aside className="layout-tuner" aria-label="开发布局调试器">
    <header><div><span>DEV TOOL</span><b>HUD 布局调试</b></div><button type="button" onClick={() => setOpen(false)} aria-label="收起布局调试器"><X size={16} /></button></header>
    <p>调整会实时生效并保存在本机。正式视觉仍由 CSS 变量控制。</p>
    <div className="layout-tuner-controls">{values.map(item => <label key={item.key}><span>{item.label}<output>{layout[item.key]} px</output></span><input type="range" min={item.min} max={item.max} step={item.step} value={layout[item.key]} onChange={event => { setOverrides(true); setLayout(current => ({ ...current, [item.key]: Number(event.target.value) })); }} /></label>)}</div>
    <footer><button type="button" onClick={reset}><RotateCcw size={14} />恢复默认</button><button type="button" onClick={() => void copy()}><Copy size={14} />{copied ? '已复制' : '复制 CSS'}</button></footer>
  </aside>;
}
