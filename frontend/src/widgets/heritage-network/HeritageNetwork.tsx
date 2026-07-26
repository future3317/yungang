import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { select } from 'd3-selection';
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from 'd3-zoom';
import { LocateFixed, ZoomIn, ZoomOut } from 'lucide-react';
import type { ActionType, Player, Region, RouteState, Site } from '../../types/game';

type MapActionMode = Extract<ActionType, 'move' | 'restore' | 'survey_route' | 'restore_route' | 'establish_connection'> | null;
type RouteLine = { id: string; from: string; to: string; route: RouteState };

function point(site: Site) { return { x: site.x ?? 50, y: site.y ?? 50 }; }
function curve(a: Site, b: Site) {
  const p1 = point(a); const p2 = point(b);
  const dx = p2.x - p1.x; const dy = p2.y - p1.y;
  const bend = Math.max(4, Math.min(12, Math.hypot(dx, dy) * .18));
  const nx = -dy / (Math.hypot(dx, dy) || 1) * bend;
  const ny = dx / (Math.hypot(dx, dy) || 1) * bend;
  return `M ${p1.x} ${p1.y} Q ${(p1.x + p2.x) / 2 + nx} ${(p1.y + p2.y) / 2 + ny} ${p2.x} ${p2.y}`;
}

function nodeKind(site: Site): 'core' | 'support' | 'event' {
  if (site.node_kind === 'event' || site.status === 'event') return 'event';
  if (site.node_kind === 'support' || site.kind === 'facility') return 'support';
  return 'core';
}

export function HeritageNetwork({ sites, metaSites, regions = [], routes = {}, active, focusedId, reachableIds, actionMode, onFocus }: { sites: Record<string, Site>; metaSites: Record<string, Site>; regions?: Region[]; routes?: Record<string, RouteState>; active: Player; focusedId: string | null; reachableIds: ReadonlySet<string>; actionMode: MapActionMode; onFocus: (id: string) => void }) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [worldTransform, setWorldTransform] = useState<ZoomTransform>(zoomIdentity);
  const routeLines = useMemo<RouteLine[]>(() => Object.values(routes).map(route => ({ id: route.id, from: route.from_site, to: route.to_site, route })).filter(item => metaSites[item.from] && metaSites[item.to]), [metaSites, routes]);
  const neighborRouteIds = useMemo(() => new Set(routeLines.filter(line => line.from === active.location || line.to === active.location).map(line => line.id)), [active.location, routeLines]);
  const regionShapes = useMemo(() => regions.map(region => {
    const explicit = region.hull_points?.length ? region.hull_points : region.site_ids.map(id => point(metaSites[id])).filter(Boolean);
    if (!explicit.length) return null;
    const minX = Math.max(2, Math.min(...explicit.map(p => p.x)) - 8); const maxX = Math.min(98, Math.max(...explicit.map(p => p.x)) + 8);
    const minY = Math.max(5, Math.min(...explicit.map(p => p.y)) - 8); const maxY = Math.min(95, Math.max(...explicit.map(p => p.y)) + 8);
    const label = region.label_position || { x: (minX + maxX) / 2, y: minY + 3 };
    return { ...region, shape: `M ${minX} ${minY} L ${maxX} ${minY} L ${maxX} ${maxY} L ${minX} ${maxY} Z`, label };
  }).filter(Boolean), [metaSites, regions]);
  useEffect(() => {
    if (!svgRef.current) return;
    const selection = select(svgRef.current);
    const behavior = zoom<SVGSVGElement, unknown>().scaleExtent([.72, 1.9]).on('zoom', event => setWorldTransform(event.transform));
    zoomRef.current = behavior;
    selection.call(behavior);
    return () => { selection.on('.zoom', null); };
  }, []);
  const scaleBy = (factor: number) => { if (svgRef.current && zoomRef.current) select(svgRef.current).call(zoomRef.current.scaleBy, factor); };
  const resetWorld = () => { if (svgRef.current && zoomRef.current) select(svgRef.current).call(zoomRef.current.transform, zoomIdentity); };
  const lod = worldTransform.k < .9 ? 'overview' : worldTransform.k > 1.25 ? 'detail' : 'standard';
  const contentTransform = worldTransform.toString();
  const visibleLines = routeLines.filter(line => lod !== 'overview' || line.route.tags?.includes('main') || line.route.status !== 'open' || neighborRouteIds.has(line.id));
  return <div className="network-frame world-stage">
    <div className="network-tools"><button onClick={() => scaleBy(1.15)} title="放大"><ZoomIn /></button><button onClick={() => scaleBy(.87)} title="缩小"><ZoomOut /></button><button onClick={resetWorld} title="重置地图"><LocateFixed /></button></div>
    <svg ref={svgRef} viewBox="0 0 100 100" role="img" aria-label="大同文化舆图">
      <defs><filter id="route-focus"><feGaussianBlur stdDeviation=".55" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
      <g className="map-world" transform={contentTransform}>
        <g className="region-layer">{regionShapes.map(region => region && <g key={region.id} className={`region-shape region-${region.visual_token || region.id}`}><path d={region.shape} /><text x={region.label.x} y={region.label.y}>{region.name}</text></g>)}</g>
        <g className="route-layer">{visibleLines.map(line => {
          const from = metaSites[line.from]; const to = metaSites[line.to];
          const focused = actionMode !== null && reachableIds.has(line.from) && reachableIds.has(line.to) && (line.from === active.location || line.to === active.location);
          const abnormal = line.route.status !== 'open' || line.route.risk > 0;
          const className = [focused ? 'is-target' : '', abnormal ? `is-${line.route.status}` : '', line.route.connection_level >= 2 ? 'is-illuminated' : ''].filter(Boolean).join(' ');
          return <path key={line.id} className={className} d={curve(from, to)} filter={focused ? 'url(#route-focus)' : undefined} />;
        })}</g>
      </g>
    </svg>
    <div className="map-nodes" style={{ transform: `translate(${worldTransform.x}px, ${worldTransform.y}px) scale(${worldTransform.k})` }}>{Object.values(sites).filter(site => lod !== 'overview' || site.node_kind !== 'event').map(site => {
      const meta = metaSites[site.id] || site; const current = active.location === site.id; const reachable = reachableIds.has(site.id); const target = actionMode !== null && reachable && !current; const kind = nodeKind(meta);
      const icon = meta.icon_asset ? `/ui-assets/${meta.icon_asset}` : `/ui-assets/generated/nodes/states/${site.id}_${current ? 'active' : site.status === 'closed' ? 'closed' : target ? 'reachable' : 'normal'}.png`;
      return <button key={site.id} className={`site-node node-${kind} ${current ? 'current' : ''} ${focusedId === site.id ? 'focused' : ''} ${target ? 'reachable' : ''} ${site.status === 'closed' ? 'closed' : ''}`} style={{ left: `${meta.x ?? 50}%`, top: `${meta.y ?? 50}%`, '--node-scale': `${1 / worldTransform.k}` } as CSSProperties} onClick={() => onFocus(site.id)} aria-label={`${meta.name || site.id}，${site.status}`}>
        <span className="node-ring" /><img className="node-icon" src={icon} alt="" />{site.status === 'at_risk' && <span className="node-risk" aria-label="有风险" />}{kind === 'event' && <span className="node-event-mark">!</span>}<b>{meta.name || site.id}</b>{lod === 'detail' && <small>{site.status === 'closed' ? '已关闭' : current ? '当前位置' : target ? '可选目标' : site.damage > 0 ? '需要关注' : '稳定'}</small>}
      </button>;
    })}</div>
    <div className="network-corner">大同文化舆图<span>{actionMode ? `选择${actionMode === 'move' ? '移动' : '行动'}目标 · Escape 取消` : '滚轮缩放 · 拖动地图 · 点击节点查看详情'}</span></div>
  </div>;
}
