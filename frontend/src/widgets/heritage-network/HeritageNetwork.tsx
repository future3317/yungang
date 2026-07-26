import { useEffect, useMemo, useRef, useState } from 'react';
import { select } from 'd3-selection';
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from 'd3-zoom';
import { LocateFixed, ZoomIn, ZoomOut } from 'lucide-react';
import type { ActionType, Player, Region, RouteState, Site } from '../../types/game';

type NetworkActionMode = Extract<ActionType, 'move' | 'restore' | 'survey_route' | 'restore_route' | 'establish_connection'> | null;
type Edge = { from: string; to: string; routeId?: string };

export function HeritageNetwork({ sites, metaSites, regions = [], routes = {}, active, focusedId, reachableIds, actionMode, onFocus }: { sites: Record<string, Site>; metaSites: Record<string, Site>; regions?: Region[]; routes?: Record<string, RouteState>; active: Player; focusedId: string | null; reachableIds: ReadonlySet<string>; actionMode: NetworkActionMode; onFocus: (id: string) => void }) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [worldTransform, setWorldTransform] = useState<ZoomTransform>(zoomIdentity);
  const nodeList = Object.values(sites);
  const edges = useMemo<Edge[]>(() => {
    const routeByPair = new Map(Object.values(routes).map(route => [`${[route.from_site, route.to_site].sort().join(':')}`, route.id]));
    const unique = new Map<string, Edge>();
    for (const site of Object.values(metaSites)) for (const target of site.connections || []) {
      if (!metaSites[target]) continue;
      const [from, to] = [site.id, target].sort();
      unique.set(`${from}:${to}`, { from, to, routeId: routeByPair.get(`${from}:${to}`) });
    }
    return [...unique.values()];
  }, [metaSites, routes]);
  const regionLabels = useMemo(() => regions.map(region => {
    const points = region.site_ids.map(id => metaSites[id]).filter(Boolean);
    if (!points.length) return null;
    return { ...region, x: points.reduce((sum, point) => sum + (point.x || 50), 0) / points.length, y: points.reduce((sum, point) => sum + (point.y || 50), 0) / points.length };
  }).filter(Boolean), [metaSites, regions]);
  useEffect(() => {
    if (!svgRef.current) return;
    const selection = select(svgRef.current);
    const behavior = zoom<SVGSVGElement, unknown>().scaleExtent([.75, 1.7]).on('zoom', event => setWorldTransform(event.transform));
    zoomRef.current = behavior;
    selection.call(behavior);
    return () => { selection.on('.zoom', null); };
  }, []);
  function scaleBy(factor: number) { if (svgRef.current && zoomRef.current) select(svgRef.current).call(zoomRef.current.scaleBy, factor); }
  function resetWorld() { if (svgRef.current && zoomRef.current) select(svgRef.current).call(zoomRef.current.transform, zoomIdentity); }
  const overlayTransform = `translate(${worldTransform.x}px, ${worldTransform.y}px) scale(${worldTransform.k})`;
  return <div className="network-frame world-stage">
    <div className="network-tools"><button onClick={() => scaleBy(1.15)} title="放大"><ZoomIn /></button><button onClick={() => scaleBy(.87)} title="缩小"><ZoomOut /></button><button onClick={resetWorld} title="适配世界"><LocateFixed /></button></div>
    <svg ref={svgRef} viewBox="0 0 100 100" role="img" aria-label="云冈遗产节点网络">
      <defs><filter id="glow"><feGaussianBlur stdDeviation="1.4" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
      <g transform={worldTransform.toString()}><image href="/ui-assets/01_buddha_relief_medallion.webp" x="30" y="30" width="40" height="40" opacity=".65" /><g className="network-lines">{edges.map(edge => { const a = metaSites[edge.from]; const b = metaSites[edge.to]; const x1 = a.x || 50; const y1 = a.y || 50; const x2 = b.x || 50; const y2 = b.y || 50; const highlighted = Boolean(actionMode) && reachableIds.has(edge.from) && reachableIds.has(edge.to) && (edge.from === active.location || edge.to === active.location); const route = edge.routeId ? routes[edge.routeId] : undefined; const restored = route?.status === 'restored' || route?.connection_level && route.connection_level >= 2; const routeAsset = highlighted ? actionMode === 'establish_connection' ? 'route_connected' : actionMode === 'survey_route' ? 'route_surveyed' : 'route_active' : restored ? 'route_restored' : route?.risk && route.risk >= 3 ? 'route_danger' : 'route_base'; const length = Math.hypot(x2 - x1, y2 - y1); const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI; return <g key={`${edge.from}:${edge.to}`} className={highlighted ? 'route-highlight' : ''}><line x1={x1} y1={y1} x2={x2} y2={y2} className={highlighted ? 'highlighted' : ''} style={{ opacity: highlighted ? .35 : .14 }} /><image href={`/ui-assets/generated/routes/${routeAsset}.png`} x={x1} y={y1 - .9} width={length} height="1.8" transform={`rotate(${angle} ${x1} ${y1})`} preserveAspectRatio="none" opacity={highlighted ? .95 : .65} /></g>; })}</g></g>
    </svg>
    <div className="world-region-layer">{regionLabels.map(region => region && <span key={region.id} className="world-region" style={{ left: `${region.x}%`, top: `${region.y}%` }}>{region.name}</span>)}</div>
    <div className="map-nodes" style={{ transform: overlayTransform }}>{nodeList.map(site => { const meta = metaSites[site.id] || site; const current = active.location === site.id; const reachable = reachableIds.has(site.id); const target = actionMode !== null && reachable && !current; const variant = current ? 'active' : site.status === 'closed' ? 'closed' : target ? 'reachable' : 'normal'; const icon = `/ui-assets/generated/nodes/states/${site.id}_${variant}.png`; const damageBadge = site.status === 'at_risk' ? '/ui-assets/generated/badges/badge_damaged.png' : undefined; return <button key={site.id} className={`site-node ${current ? 'current' : ''} ${focusedId === site.id ? 'focused' : ''} ${reachable ? 'reachable' : ''} ${site.status === 'closed' ? 'closed' : ''}`} style={{ left: `${meta.x || 50}%`, top: `${meta.y || 50}%`, borderColor: target ? 'var(--accent-gold)' : undefined, boxShadow: target ? '0 0 28px rgba(209,173,99,.35)' : undefined }} onClick={() => onFocus(site.id)} aria-label={`${meta.name || site.id}，${site.status}`}><span className="node-ring" /><img className="node-icon" src={icon} alt="" />{damageBadge && <img className="node-status-badge" src={damageBadge} alt="" />}<b>{meta.name || site.id}</b><small>{site.status === 'closed' ? '已关闭' : current ? '当前位置' : target ? '可选目标' : `${site.damage}/${site.max_damage} 损伤`}</small></button>; })}</div>
    <div className="network-corner">遗产世界<span>{actionMode ? `选择${actionMode === 'move' ? '移动' : actionMode === 'restore' ? '修护' : '路线'}目标 · Escape 取消` : '滚轮缩放 · 拖动查看 · 点击节点聚焦'}</span></div>
  </div>;
}
