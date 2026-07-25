import { useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { LocateFixed, ZoomIn, ZoomOut } from 'lucide-react';
import type { ActionType, Player, Site } from '../../types/game';

type NetworkActionMode = Extract<ActionType, 'move' | 'restore'> | null;
type Edge = { from: string; to: string };

export function HeritageNetwork({ sites, metaSites, active, focusedId, reachableIds, actionMode, onFocus }: { sites: Record<string, Site>; metaSites: Record<string, Site>; active: Player; focusedId: string | null; reachableIds: ReadonlySet<string>; actionMode: NetworkActionMode; onFocus: (id: string) => void }) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const pointer = useRef<{ id: number; x: number; y: number; panX: number; panY: number } | null>(null);
  const dragged = useRef(false);
  const nodeList = Object.values(sites);
  const edges = useMemo<Edge[]>(() => {
    const unique = new Map<string, Edge>();
    for (const site of Object.values(metaSites)) for (const target of site.connections || []) {
      if (!metaSites[target]) continue;
      const [from, to] = [site.id, target].sort();
      unique.set(`${from}:${to}`, { from, to });
    }
    return [...unique.values()];
  }, [metaSites]);
  function begin(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
    dragged.current = false;
  }
  function move(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointer.current || pointer.current.id !== event.pointerId) return;
    const dx = event.clientX - pointer.current.x;
    const dy = event.clientY - pointer.current.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) dragged.current = true;
    setPan({ x: pointer.current.panX + dx, y: pointer.current.panY + dy });
  }
  function end(event: ReactPointerEvent<HTMLDivElement>) {
    if (pointer.current?.id === event.pointerId) {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      pointer.current = null;
    }
  }
  function selectNode(id: string) {
    if (dragged.current) { dragged.current = false; return; }
    onFocus(id);
  }
  const transform = `translate(${pan.x / 8}px, ${pan.y / 8}px) scale(${zoom})`;
  return <div className="network-frame" onPointerDown={begin} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
    <div className="network-tools"><button onClick={() => setZoom(value => Math.min(1.7, value + .15))} title="放大"><ZoomIn /></button><button onClick={() => setZoom(value => Math.max(.75, value - .15))} title="缩小"><ZoomOut /></button><button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} title="重置地图"><LocateFixed /></button></div>
    <svg viewBox="0 0 100 100" role="img" aria-label="云冈遗产节点网络" style={{ transform }}>
      <defs><filter id="glow"><feGaussianBlur stdDeviation="1.4" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
      <image href="/ui-assets/01_buddha_relief_medallion.webp" x="30" y="30" width="40" height="40" opacity=".65" />
      <g className="network-lines">{edges.map(edge => { const a = metaSites[edge.from]; const b = metaSites[edge.to]; const highlighted = actionMode === 'move' && reachableIds.has(edge.from) && reachableIds.has(edge.to) && (edge.from === active.location || edge.to === active.location); return <line key={`${edge.from}:${edge.to}`} x1={a.x || 50} y1={a.y || 50} x2={b.x || 50} y2={b.y || 50} className={highlighted ? 'highlighted' : ''} style={{ opacity: highlighted ? .95 : .38 }} />; })}</g>
    </svg>
    <div className="map-nodes" style={{ transform }}>{nodeList.map(site => { const meta = metaSites[site.id] || site; const current = active.location === site.id; const reachable = reachableIds.has(site.id); const target = actionMode !== null && reachable && !current; return <button key={site.id} className={`site-node ${current ? 'current' : ''} ${focusedId === site.id ? 'focused' : ''} ${reachable ? 'reachable' : ''} ${site.status === 'closed' ? 'closed' : ''}`} style={{ left: `${meta.x || 50}%`, top: `${meta.y || 50}%`, borderColor: target ? 'var(--accent-gold)' : undefined, boxShadow: target ? '0 0 28px rgba(209,173,99,.35)' : undefined }} onClick={() => selectNode(site.id)} aria-label={`${meta.name || site.id}，${site.status}`}><span className="node-ring" /><img src={`/ui-assets/${meta.icon_asset || 'icon_node_yungang.png'}`} alt="" /><b>{meta.name || site.id}</b><small>{site.status === 'closed' ? '已关闭' : current ? '当前位置' : target ? '可选目标' : `${site.damage}/${site.max_damage} 损伤`}</small></button>; })}</div>
    <div className="network-corner">光照关系图<span>{actionMode ? `选择${actionMode === 'move' ? '移动' : '修护'}目标 · Escape 取消` : '拖动查看 · 点击节点聚焦'}</span></div>
  </div>;
}
