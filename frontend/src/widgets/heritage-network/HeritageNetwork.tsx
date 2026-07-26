import { useEffect, useMemo, useRef, useState } from 'react';
import { select } from 'd3-selection';
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from 'd3-zoom';
import { LocateFixed, ZoomIn, ZoomOut } from 'lucide-react';
import type { ActionType, Player, Region, RouteState, Site } from '../../types/game';

type MapActionMode = Extract<ActionType, 'move' | 'restore' | 'survey_route' | 'restore_route' | 'establish_connection'> | null;
type RouteLine = { id: string; from: string; to: string; route: RouteState };
type Point = { x: number; y: number };

function point(site: Site | undefined): Point { return { x: site?.x ?? 50, y: site?.y ?? 50 }; }
function curve(a: Site, b: Site) {
  const p1 = point(a); const p2 = point(b); const dx = p2.x - p1.x; const dy = p2.y - p1.y;
  const distance = Math.hypot(dx, dy) || 1; const bend = Math.max(3.5, Math.min(10, distance * .15));
  return `M ${p1.x} ${p1.y} Q ${(p1.x + p2.x) / 2 - dy / distance * bend} ${(p1.y + p2.y) / 2 + dx / distance * bend} ${p2.x} ${p2.y}`;
}
function nodeKind(site: Site): 'core' | 'support' | 'event' { if (site.node_kind === 'event' || site.status === 'event') return 'event'; return site.node_kind === 'support' || site.kind === 'facility' ? 'support' : 'core'; }
function convexHull(points: Point[]) {
  if (points.length < 3) return points; const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (a: Point, b: Point, c: Point) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const makeHalf = (values: Point[]) => values.reduce<Point[]>((stack, item) => { while (stack.length > 1 && cross(stack[stack.length - 2], stack[stack.length - 1], item) <= 0) stack.pop(); stack.push(item); return stack; }, []);
  const lower = makeHalf(sorted); const upper = makeHalf([...sorted].reverse()); return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}
function softHull(points: Point[]) {
  const hull = convexHull(points); if (hull.length < 3) return '';
  const expanded = hull.map((point, index) => { const prev = hull[(index + hull.length - 1) % hull.length]; const next = hull[(index + 1) % hull.length]; return { x: Math.max(2, Math.min(98, point.x + (point.x - (prev.x + next.x) / 2) * .22)), y: Math.max(4, Math.min(96, point.y + (point.y - (prev.y + next.y) / 2) * .22)) }; });
  return expanded.map((item, index) => { const next = expanded[(index + 1) % expanded.length]; const mid = { x: (item.x + next.x) / 2, y: (item.y + next.y) / 2 }; return index ? `Q ${item.x} ${item.y} ${mid.x} ${mid.y}` : `M ${mid.x} ${mid.y} Q ${item.x} ${item.y} ${mid.x} ${mid.y}`; }).join(' ') + ' Z';
}

export function HeritageNetwork({ sites, metaSites, regions = [], routes = {}, active, focusedId, reachableIds, actionMode, onFocus }: { sites: Record<string, Site>; metaSites: Record<string, Site>; regions?: Region[]; routes?: Record<string, RouteState>; active: Player; focusedId: string | null; reachableIds: ReadonlySet<string>; actionMode: MapActionMode; onFocus: (id: string) => void }) {
  const svgRef = useRef<SVGSVGElement | null>(null); const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null); const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity);
  const routeLines = useMemo<RouteLine[]>(() => Object.values(routes).map(route => ({ id: route.id, from: route.from_site, to: route.to_site, route })).filter(line => metaSites[line.from] && metaSites[line.to]), [metaSites, routes]);
  const neighborRouteIds = useMemo(() => new Set(routeLines.filter(line => line.from === active.location || line.to === active.location).map(line => line.id)), [active.location, routeLines]);
  const regionShapes = useMemo(() => regions.map(region => { const points = region.hull_points?.length ? region.hull_points : region.site_ids.map(id => point(metaSites[id])); const label = region.label_position || points[0] || { x: 50, y: 50 }; return { ...region, shape: softHull(points), label }; }).filter(region => region.shape), [metaSites, regions]);
  useEffect(() => { if (!svgRef.current) return; const selection = select(svgRef.current); const behavior = zoom<SVGSVGElement, unknown>().scaleExtent([.72, 1.9]).on('zoom', event => setTransform(event.transform)); zoomRef.current = behavior; selection.call(behavior); return () => { selection.on('.zoom', null); }; }, []);
  const scaleBy = (factor: number) => { if (svgRef.current && zoomRef.current) select(svgRef.current).call(zoomRef.current.scaleBy, factor); };
  const resetWorld = () => { if (svgRef.current && zoomRef.current) select(svgRef.current).call(zoomRef.current.transform, zoomIdentity); };
  const lod = transform.k < .9 ? 'overview' : transform.k > 1.25 ? 'detail' : 'standard';
  const visibleLines = routeLines.filter(line => lod !== 'overview' || line.route.tags?.includes('main') || line.route.status !== 'open' || neighborRouteIds.has(line.id));
  return <div className="network-frame world-stage">
    <div className="network-tools"><button onClick={() => scaleBy(1.15)} aria-label="放大地图"><ZoomIn /></button><button onClick={() => scaleBy(.87)} aria-label="缩小地图"><ZoomOut /></button><button onClick={resetWorld} aria-label="适应全部节点"><LocateFixed /></button></div>
    <svg ref={svgRef} viewBox="0 0 100 100" role="img" aria-label="大同文化图谱" onDoubleClick={resetWorld}>
      <g className="map-world" transform={transform.toString()}>
        <g className="region-layer">{regionShapes.map(region => <g key={region.id} className={`region-shape region-${region.visual_token || region.id}`}><path d={region.shape} /><text x={region.label.x} y={region.label.y}>{region.name}</text></g>)}</g>
        <g className="route-layer">{visibleLines.map(line => { const focused = actionMode !== null && reachableIds.has(line.from) && reachableIds.has(line.to) && (line.from === active.location || line.to === active.location); const abnormal = line.route.status !== 'open' || line.route.risk > 0; const className = [focused ? 'is-target' : '', abnormal ? `is-${line.route.status}` : '', line.route.connection_level >= 2 ? 'is-illuminated' : ''].filter(Boolean).join(' '); return <path key={line.id} className={className} d={curve(metaSites[line.from], metaSites[line.to])} />; })}</g>
        <g className="node-layer">{Object.values(sites).filter(site => lod !== 'overview' || site.node_kind !== 'event').map(site => { const meta = metaSites[site.id] || site; const current = active.location === site.id; const reachable = reachableIds.has(site.id); const target = actionMode !== null && reachable && !current; const kind = nodeKind(meta); const size = kind === 'core' ? 4.2 : kind === 'support' ? 3.1 : 2.7; const icon = meta.icon_asset ? `/ui-assets/${meta.icon_asset}` : `/ui-assets/generated/nodes/states/${site.id}_${current ? 'active' : site.status === 'closed' ? 'closed' : target ? 'reachable' : 'normal'}.png`; const activate = () => onFocus(site.id); return <g key={site.id} className={`map-node node-${kind} ${current ? 'node-current' : ''} ${focusedId === site.id ? 'node-focused' : ''} ${target ? 'node-reachable' : ''} ${site.status === 'closed' ? 'node-closed' : ''} ${site.status === 'at_risk' ? 'node-risk' : ''}`} transform={`translate(${meta.x ?? 50} ${meta.y ?? 50})`} role="button" tabIndex={0} aria-label={`${meta.name || site.id}，${site.status}`} onClick={activate} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(); } }}><circle className="node-back" r={size} /><image className="node-image" href={icon} x={-size * .65} y={-size * .65} width={size * 1.3} height={size * 1.3} preserveAspectRatio="xMidYMid meet" />{(current || site.status === 'at_risk' || site.status === 'closed') && <circle className="node-mark" cx={size * .76} cy={-size * .76} r=".7" />}{(kind === 'core' || lod === 'detail' || focusedId === site.id) && <text className="node-label" x={size + 1.1} y=".7">{meta.name || site.id}</text>}{lod === 'detail' && (current || target || focusedId === site.id) && <text className="node-status" x={size + 1.1} y="2.8">{current ? '当前位置' : target ? '可选目标' : site.status === 'closed' ? '已关闭' : '查看节点'}</text>}</g>; })}</g>
      </g>
    </svg>
    <div className="network-corner">大同文化图谱<span>{actionMode ? `选择${actionMode === 'move' ? '移动' : '行动'}目标 · Escape 取消` : '滚轮缩放 · 拖动地图 · 双击适应全部节点'}</span></div>
  </div>;
}
