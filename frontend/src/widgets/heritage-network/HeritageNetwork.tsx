import { useEffect, useMemo, useRef, useState } from 'react';
import { select } from 'd3-selection';
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from 'd3-zoom';
import { LocateFixed, Maximize2, ZoomIn, ZoomOut } from 'lucide-react';
import type { ActionType, Player, Region, RouteState, Site } from '../../types/game';

type MapActionMode = Extract<ActionType, 'move' | 'restore' | 'survey_route' | 'restore_route' | 'establish_connection'> | null;
type RouteLine = { id: string; from: string; to: string; route: RouteState };
type Point = { x: number; y: number };
function point(site: Site | undefined): Point { return { x: site?.x ?? 50, y: site?.y ?? 50 }; }
function clamp(value: number, min: number, max: number) { return Math.max(min, Math.min(max, value)); }
function textWidth(value: string, unit = 2.1) { return Math.max(6, value.length * unit); }
function overlaps(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) { return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y; }
function layoutRegionLabels(regions: Region[], metaSites: Record<string, Site>) {
  const occupied = Object.values(metaSites).map(site => ({ x: (site.x ?? 50) - 4.8, y: (site.y ?? 50) - 4.8, width: 9.6, height: 9.6 }));
  const placed: Array<{ x: number; y: number; width: number; height: number }> = [];
  return regions.map(region => {
    const base = region.label_position || region.site_ids.map(id => point(metaSites[id]))[0] || { x: 50, y: 50 };
    const width = textWidth(region.name, 1.65);
    const candidates = [
      { x: base.x - width / 2, y: base.y - 1.2 },
      { x: base.x - width / 2, y: base.y - 6.2 },
      { x: base.x - width / 2, y: base.y + 4.2 },
      { x: base.x - width / 2 - 7, y: base.y - 1.2 },
      { x: base.x - width / 2 + 7, y: base.y - 1.2 },
    ].map(candidate => ({ ...candidate, x: clamp(candidate.x, 2, 98 - width), y: clamp(candidate.y, 3, 97) }));
    const label = candidates.find(candidate => {
      const box = { ...candidate, width, height: 2.8 };
      return !occupied.some(item => overlaps(box, item)) && !placed.some(item => overlaps(box, item));
    }) || candidates[0];
    const box = { ...label, width, height: 2.8 };
    placed.push(box);
    return { ...region, label: { x: label.x, y: label.y } };
  });
}
function nodeLabelPosition(site: Site, meta: Site, allSites: Site[]) {
  const kind = nodeKind(meta);
  const size = kind === 'core' ? 4.2 : kind === 'support' ? 3.1 : 2.7;
  const name = meta.name || site.id;
  const width = textWidth(name, 2.05);
  const candidates = [
    { x: size + 1.1, y: .7 },
    { x: -width - size - 1.1, y: .7 },
    { x: -width / 2, y: -size - 2.3 },
    { x: -width / 2, y: size + 4.1 },
  ];
  const score = (candidate: { x: number; y: number }) => {
    const box = { x: (meta.x ?? 50) + candidate.x, y: (meta.y ?? 50) + candidate.y - 2, width, height: 3.2 };
    let value = box.x < 1 || box.x + width > 99 || box.y < 1 || box.y + box.height > 99 ? 100 : 0;
    for (const other of allSites) {
      if (other.id === site.id) continue;
      const otherPoint = point(other);
      if (overlaps(box, { x: otherPoint.x - 4, y: otherPoint.y - 4, width: 8, height: 8 })) value += 20;
    }
    return value;
  };
  return candidates.reduce((best, candidate) => score(candidate) < score(best) ? candidate : best, candidates[0]);
}
function curve(a: Site, b: Site) { const p1 = point(a); const p2 = point(b); const dx = p2.x - p1.x; const dy = p2.y - p1.y; const distance = Math.hypot(dx, dy) || 1; const bend = Math.max(3.5, Math.min(10, distance * .15)); return `M ${p1.x} ${p1.y} Q ${(p1.x + p2.x) / 2 - dy / distance * bend} ${(p1.y + p2.y) / 2 + dx / distance * bend} ${p2.x} ${p2.y}`; }
function nodeKind(site: Site): 'core' | 'support' | 'event' { return site.node_kind === 'event' || site.status === 'event' ? 'event' : site.node_kind === 'support' || site.kind === 'facility' ? 'support' : 'core'; }
function convexHull(points: Point[]) { if (points.length < 3) return points; const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y); const cross = (a: Point, b: Point, c: Point) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x); const half = (values: Point[]) => values.reduce<Point[]>((stack, item) => { while (stack.length > 1 && cross(stack[stack.length - 2], stack[stack.length - 1], item) <= 0) stack.pop(); stack.push(item); return stack; }, []); const lower = half(sorted); const upper = half([...sorted].reverse()); return [...lower.slice(0, -1), ...upper.slice(0, -1)]; }
function softHull(points: Point[]) { const hull = convexHull(points); if (hull.length < 3) return ''; const expanded = hull.map((item, index) => { const prev = hull[(index + hull.length - 1) % hull.length]; const next = hull[(index + 1) % hull.length]; return { x: Math.max(2, Math.min(98, item.x + (item.x - (prev.x + next.x) / 2) * .22)), y: Math.max(4, Math.min(96, item.y + (item.y - (prev.y + next.y) / 2) * .22)) }; }); return expanded.map((item, index) => { const next = expanded[(index + 1) % expanded.length]; const mid = { x: (item.x + next.x) / 2, y: (item.y + next.y) / 2 }; return index ? `Q ${item.x} ${item.y} ${mid.x} ${mid.y}` : `M ${mid.x} ${mid.y} Q ${item.x} ${item.y} ${mid.x} ${mid.y}`; }).join(' ') + ' Z'; }
function fitTransform(allSites: Site[]) { const points = allSites.map(point); const minX = Math.min(...points.map(item => item.x)); const maxX = Math.max(...points.map(item => item.x)); const minY = Math.min(...points.map(item => item.y)); const maxY = Math.max(...points.map(item => item.y)); const span = Math.max(maxX - minX, maxY - minY, 1); const scale = Math.max(.82, Math.min(1.34, 70 / span)); return zoomIdentity.translate(47 - (minX + maxX) / 2 * scale, 50 - (minY + maxY) / 2 * scale).scale(scale); }

export function HeritageNetwork({ sites, metaSites, regions = [], routes = {}, players, active, focusedId, reachableIds, actionMode, onFocus }: { sites: Record<string, Site>; metaSites: Record<string, Site>; regions?: Region[]; routes?: Record<string, RouteState>; players: Player[]; active: Player; focusedId: string | null; reachableIds: ReadonlySet<string>; actionMode: MapActionMode; onFocus: (id: string) => void }) {
  const svgRef = useRef<SVGSVGElement | null>(null); const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null); const transformRef = useRef<ZoomTransform>(zoomIdentity); const lastSizeRef = useRef<{ width: number; height: number } | null>(null); const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity); const [hoveredRouteId, setHoveredRouteId] = useState<string | null>(null);
  const enabledSites = useMemo(() => Object.values(sites).filter(site => metaSites[site.id]), [metaSites, sites]);
  const enabledSiteKey = useMemo(() => enabledSites.map(site => site.id).sort().join('|'), [enabledSites]);
  const routeLines = useMemo<RouteLine[]>(() => Object.values(routes).map(route => ({ id: route.id, from: route.from_site, to: route.to_site, route })).filter(line => metaSites[line.from] && metaSites[line.to]), [metaSites, routes]);
  const neighborRouteIds = useMemo(() => new Set(routeLines.filter(line => line.from === active.location || line.to === active.location).map(line => line.id)), [active.location, routeLines]);
  const regionShapes = useMemo(() => layoutRegionLabels(regions, metaSites).map(region => { const points = region.hull_points?.length ? region.hull_points : region.site_ids.map(id => point(metaSites[id])); return { ...region, shape: softHull(points) }; }).filter(region => region.shape), [metaSites, regions]);
  const applyTransform = (next: ZoomTransform, duration = 0) => { if (!svgRef.current || !zoomRef.current) return; const selection = select(svgRef.current); const start = transformRef.current; if (!duration) { selection.call(zoomRef.current.transform, next); return; } const startedAt = performance.now(); const step = (now: number) => { const progress = Math.min(1, (now - startedAt) / duration); const eased = 1 - Math.pow(1 - progress, 3); const frame = zoomIdentity.translate(start.x + (next.x - start.x) * eased, start.y + (next.y - start.y) * eased).scale(start.k + (next.k - start.k) * eased); selection.call(zoomRef.current!.transform, frame); if (progress < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); };
  const fitBounds = () => applyTransform(fitTransform(enabledSites), 280);
  useEffect(() => { if (!svgRef.current) return; const selection = select(svgRef.current); const behavior = zoom<SVGSVGElement, unknown>().scaleExtent([.72, 2.2]).on('zoom', event => { transformRef.current = event.transform; setTransform(event.transform); }); zoomRef.current = behavior; selection.call(behavior); const observer = new ResizeObserver(entries => { const rect = entries[0]?.contentRect; if (!rect) return; const previous = lastSizeRef.current; const changed = !previous || previous.width !== rect.width || previous.height !== rect.height; lastSizeRef.current = { width: rect.width, height: rect.height }; if (changed) fitBounds(); }); observer.observe(svgRef.current); requestAnimationFrame(fitBounds); return () => { observer.disconnect(); selection.on('.zoom', null); }; }, [enabledSiteKey]);
  const scaleBy = (factor: number) => { if (svgRef.current && zoomRef.current) select(svgRef.current).call(zoomRef.current.scaleBy, factor); };
  const centerCurrent = () => { const target = point(metaSites[active.location]); const scale = Math.max(transform.k, 1.12); applyTransform(zoomIdentity.translate(50 - target.x * scale, 50 - target.y * scale).scale(scale), 360); };
  const lod = transform.k < .94 ? 'overview' : transform.k > 1.34 ? 'detail' : 'standard';
  const targetRouteIds = new Set(routeLines.filter(line => actionMode && (reachableIds.has(line.from) || reachableIds.has(line.to)) && (line.from === active.location || line.to === active.location)).map(line => line.id));
  const hoveredRoute = routeLines.find(line => line.id === hoveredRouteId);
  const visibleLines = routeLines.filter(line => lod !== 'overview' || line.route.tags?.includes('main') || line.route.status !== 'open' || neighborRouteIds.has(line.id));
  const currentPoint = point(metaSites[active.location]);
  const selectedPoint = focusedId ? point(metaSites[focusedId]) : null;
  return <div className="network-frame world-stage">
    <div className="network-tools"><button onClick={() => scaleBy(1.14)} aria-label="放大地图"><ZoomIn /></button><button onClick={() => scaleBy(.88)} aria-label="缩小地图"><ZoomOut /></button><button onClick={centerCurrent} aria-label="聚焦当前玩家"><LocateFixed /></button><button onClick={fitBounds} aria-label="适应全部节点"><Maximize2 /></button></div>
    <svg ref={svgRef} viewBox="0 0 100 100" role="img" aria-label="大同文化图谱" onDoubleClick={fitBounds}>
      <g className="map-world" transform={transform.toString()}>
        <g className={`region-layer lod-${lod}`}>{regionShapes.map(region => <g key={region.id} className={`region-shape region-${region.visual_token || region.id}`}><path d={region.shape} /><text x={region.label.x} y={region.label.y}>{region.name}</text></g>)}</g>
        <g className="map-focus-layer" aria-hidden="true"><circle className="map-player-focus" cx={currentPoint.x} cy={currentPoint.y} r="10" />{selectedPoint && <circle className="map-selection-focus" cx={selectedPoint.x} cy={selectedPoint.y} r="7" />}</g>
        <g className="route-layer">{visibleLines.map(line => { const target = targetRouteIds.has(line.id); const abnormal = line.route.status !== 'open' || line.route.risk > 0; const classes = [neighborRouteIds.has(line.id) ? 'is-neighbor' : '', target ? 'is-target' : '', abnormal ? `is-${line.route.status}` : '', line.route.connection_level >= 2 ? 'is-illuminated' : '', hoveredRouteId === line.id ? 'is-hovered' : '', actionMode && !target && !neighborRouteIds.has(line.id) ? 'is-muted' : ''].filter(Boolean).join(' '); return <path key={line.id} className={classes} d={curve(metaSites[line.from], metaSites[line.to])} onMouseEnter={() => setHoveredRouteId(line.id)} onMouseLeave={() => setHoveredRouteId(null)} />; })}</g>
        <g className="node-layer">{enabledSites.filter(site => lod !== 'overview' || site.node_kind !== 'event').map(site => { const meta = metaSites[site.id] || site; const current = active.location === site.id; const reachable = reachableIds.has(site.id); const target = actionMode !== null && reachable && !current; const hoverEndpoint = hoveredRoute && (hoveredRoute.from === site.id || hoveredRoute.to === site.id); const kind = nodeKind(meta); const size = kind === 'core' ? 4.2 : kind === 'support' ? 3.1 : 2.7; const labelPosition = nodeLabelPosition(site, meta, enabledSites); const icon = meta.icon_asset ? `/ui-assets/${meta.icon_asset}` : `/ui-assets/generated/nodes/states/${site.id}_${current ? 'active' : site.status === 'closed' ? 'closed' : target ? 'reachable' : 'normal'}.png`; return <g key={site.id} className={`map-node node-${kind} ${current ? 'node-current' : ''} ${focusedId === site.id ? 'node-focused' : ''} ${target ? 'node-reachable' : ''} ${site.status === 'closed' ? 'node-closed' : ''} ${site.status === 'at_risk' ? 'node-risk' : ''} ${hoverEndpoint ? 'node-route-hover' : ''}`} transform={`translate(${meta.x ?? 50} ${meta.y ?? 50})`} role="button" tabIndex={0} aria-label={`${meta.name || site.id}，${site.status}`} onPointerDown={event => event.stopPropagation()} onPointerUp={event => { event.stopPropagation(); onFocus(site.id); }} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onFocus(site.id); } }}><circle className="node-back" r={size} /><image className="node-image" href={icon} x={-size * .65} y={-size * .65} width={size * 1.3} height={size * 1.3} preserveAspectRatio="xMidYMid meet" />{(current || site.status === 'at_risk' || site.status === 'closed') && <circle className="node-mark" cx={size * .76} cy={-size * .76} r=".7" />}{(kind === 'core' || lod === 'detail' || focusedId === site.id) && <text className="node-label" x={labelPosition.x} y={labelPosition.y}>{meta.name || site.id}</text>}{lod === 'detail' && (current || target || focusedId === site.id) && <text className="node-status" x={labelPosition.x} y={labelPosition.y + 2.1}>{current ? '当前位置' : target ? '可选目标' : site.status === 'closed' ? '已关闭' : '查看节点'}</text>}</g>; })}</g>
        <g className="player-marker-layer">{players.map((player, index) => { const location = point(metaSites[player.location]); const companions = players.filter(item => item.location === player.location); const slot = companions.findIndex(item => item.id === player.id); const angle = companions.length > 1 ? (slot / companions.length) * Math.PI * 2 : -Math.PI / 2; const offset = companions.length > 1 ? 4.3 : 4.8; return <g key={player.id} className={`player-marker marker-${index % 4} ${player.id === active.id ? 'marker-active' : 'marker-idle'}`} transform={`translate(${location.x + Math.cos(angle) * offset} ${location.y + Math.sin(angle) * offset})`} aria-label={`${player.name} at ${metaSites[player.location]?.name || player.location}`}><circle className="player-marker-halo" r="2.1" /><circle className="player-marker-core" r="1.15" /><text x="0" y=".38">{index + 1}</text></g>; })}</g>
      </g>
    </svg>
    <div className="network-corner">大同文化图谱<span>{hoveredRoute ? `线路：${hoveredRoute.route.status} · ${hoveredRoute.route.cost} AP · 风险 ${hoveredRoute.route.risk}` : actionMode ? `正在选择目标 · 已突出合法线路 · Escape 取消` : '滚轮缩放 · 拖动地图 · 双击适应全部节点'}</span></div>
  </div>;
}
