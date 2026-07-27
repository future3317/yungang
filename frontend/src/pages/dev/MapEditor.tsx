import { useEffect, useMemo, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { Download, Grid3X3, Lock, RotateCcw, Save } from 'lucide-react';
import { api } from '../../shared/api/client';
import type { Meta, Site } from '../../types/game';
import '../../styles/components.css';

const STORAGE_KEY = 'yungang-map-layout-draft';

export function MapEditor() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [layout, setLayout] = useState<Record<string, { x: number; y: number }>>({});
  const [locked, setLocked] = useState<Set<string>>(new Set());
  const [grid, setGrid] = useState(true);
  const [dragging, setDragging] = useState<string | null>(null);
  useEffect(() => { if (!import.meta.env.DEV) return; void api.meta().then(value => { setMeta(value); const saved = window.localStorage.getItem(STORAGE_KEY); if (saved) setLayout(JSON.parse(saved)); }); }, []);
  const sites = useMemo(() => meta?.sites || [], [meta]);
  const position = (site: Site) => layout[site.id] || { x: site.layout?.x ?? site.x ?? 50, y: site.layout?.y ?? site.y ?? 50 };
  const updatePosition = (event: ReactPointerEvent<SVGElement>, id: string) => { if (locked.has(id)) return; const rect = event.currentTarget.ownerSVGElement?.getBoundingClientRect(); if (!rect) return; const x = Math.max(3, Math.min(97, ((event.clientX - rect.left) / rect.width) * 100)); const y = Math.max(5, Math.min(95, ((event.clientY - rect.top) / rect.height) * 100)); setLayout(value => ({ ...value, [id]: { x: grid ? Math.round(x / 2) * 2 : x, y: grid ? Math.round(y / 2) * 2 : y } })); };
  const exportLayout = () => { const payload = sites.map(site => ({ id: site.id, layout: { ...position(site), labelAnchor: site.layout?.labelAnchor || 'right' } })); navigator.clipboard?.writeText(JSON.stringify(payload, null, 2)); const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'sites.layout.json'; link.click(); URL.revokeObjectURL(link.href); };
  if (!import.meta.env.DEV) return <main className="state-screen"><h1>地图编辑器仅在开发环境开放</h1><p>运行本地开发服务器后访问此页面。</p></main>;
  return <main className="map-editor"><header><div><span className="eyebrow">开发工具 / Map Layout</span><h1>遗产网络布局编辑器</h1><p>拖动节点只改变布局坐标，不会修改文化内容；路线端点始终绑定节点。</p></div><div className="map-editor-actions"><button onClick={() => setGrid(value => !value)} aria-pressed={grid}><Grid3X3 size={15} />网格吸附</button><button onClick={() => setLocked(value => new Set(value.size ? [] : sites.map(site => site.id)))}><Lock size={15} />{locked.size ? '解锁全部' : '锁定全部'}</button><button onClick={() => { const saved = window.localStorage.getItem(STORAGE_KEY); if (saved) setLayout(JSON.parse(saved)); }}><RotateCcw size={15} />恢复提交布局</button><button onClick={() => { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout)); }}><Save size={15} />保存草稿</button><button className="primary-cta" onClick={exportLayout}><Download size={15} />导出 JSON</button></div></header><section className="map-editor-canvas"><svg viewBox="0 0 100 100" role="img" aria-label="开发地图布局编辑器">{meta?.regions?.map(region => <path key={region.id} className="editor-region" d={(region.hull_points || region.site_ids.map(id => position(sites.find(site => site.id === id) || { id, x: 50, y: 50 } as Site))).map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ') + ' Z'} />)}{meta?.sites.map(site => { const p = position(site); return <g key={site.id} transform={`translate(${p.x} ${p.y})`} className={dragging === site.id ? 'is-dragging' : ''} onPointerDown={() => setDragging(site.id)} onPointerMove={event => dragging === site.id && updatePosition(event, site.id)} onPointerUp={() => setDragging(null)}><circle r="2.6" /><text x="3.8" y=".7">{site.name || site.id}</text></g>; })}</svg></section><p className="map-editor-note">提示：导出的 JSON 可回填 `data/sites.json` 的 `layout` 字段；路线的 `waypoints` 仍由路线数据独立维护。</p></main>;
}
