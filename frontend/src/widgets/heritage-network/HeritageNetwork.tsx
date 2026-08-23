import { useEffect, useMemo, useRef, useState } from 'react';
import { LocateFixed, Maximize2, Minus, Plus } from 'lucide-react';
import { select } from 'd3-selection';
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from 'd3-zoom';
import type { ActionType, ContentSite, Meta, Player, Region, RouteState, Site, SiteReference } from '../../types/game';
import { assetUrl } from '../../shared/assetUrl';
import { displayText } from '../game/contentLabels';
import styles from './HeritageNetwork.module.css';

type MapActionMode = Extract<
  ActionType,
  'move' | 'restore' | 'survey_route' | 'restore_route' | 'establish_connection'
> | null;
type Point = { x: number; y: number };
type RouteLine = { id: string; from: string; to: string; route: RouteState };
export function getTargetRouteIds(
  routeLines: ReadonlyArray<Pick<RouteLine, 'id' | 'from' | 'to'>>,
  reachableIds: ReadonlySet<string>,
  actionMode: MapActionMode,
  activeLocation: string
) {
  const routeAction = actionMode === 'survey_route' || actionMode === 'restore_route' || actionMode === 'establish_connection';
  return new Set(
    routeLines
      .filter((line) =>
        routeAction
          ? reachableIds.has(line.id)
          : actionMode === 'move' && (reachableIds.has(line.from) || reachableIds.has(line.to)) &&
            (line.from === activeLocation || line.to === activeLocation)
      )
      .map((line) => line.id)
  );
}

function siteStatusName(value: string | undefined, catalog: Meta | undefined) {
  return displayText(catalog, 'statuses', value, '未标注状态');
}
function nodeReason(site: Site, meta: SiteReference, current: boolean, target: boolean, eventTarget: boolean, catalog?: Meta) {
  if (site.status === 'closed') return '节点已关闭：先完成修护才能继续推进。';
  if (site.status === 'at_risk') return '风险：再受一次损伤将关闭。优先修护可避免回合结算后失去它。';
  if (eventTarget) return '橙色标记：本轮事件可能影响这里，提前准备可以降低损伤。';
  if (target) return '金色标记：这是当前行动可以选择的合法目标。';
  if (current) return '这里是当前行动者的位置。';
  return `${meta.name || '此处节点'}目前${siteStatusName(site.status, catalog)}。点击可查看地点任务、团队项目和事件说明。`;
}

function point(site: Site | ContentSite | undefined): Point {
  return {
    x:
      site?.layout &&
      typeof site.layout === 'object' &&
      !Array.isArray(site.layout) &&
      typeof site.layout.x === 'number'
        ? site.layout.x
        : (site?.x ?? 50),
    y:
      site?.layout &&
      typeof site.layout === 'object' &&
      !Array.isArray(site.layout) &&
      typeof site.layout.y === 'number'
        ? site.layout.y
        : (site?.y ?? 50),
  };
}
function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
type LabelLayout = { x: number; y: number; anchor: 'start' | 'middle' | 'end' };
type LabelBox = { left: number; right: number; top: number; bottom: number };
function labelWidth(name: string) {
  return Math.min(25, Math.max(8, [...name].length * 1.75));
}
function intersects(a: LabelBox, b: LabelBox) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}
export function labelBox(origin: Point, layout: LabelLayout, width: number): LabelBox {
  const left =
    layout.anchor === 'end'
      ? origin.x + layout.x - width
      : layout.anchor === 'middle'
        ? origin.x + layout.x - width / 2
        : origin.x + layout.x;
  return { left, right: left + width, top: origin.y + layout.y - 2, bottom: origin.y + layout.y + 1.8 };
}
export function computeNodePositions(sites: Site[], metas: Record<string, SiteReference>) {
  const output: Record<string, Point> = {};
  const placed: Array<{ point: Point; width: number }> = [];
  const gridFallback: Point[] = [];
  for (let y = 8; y <= 92; y += 9) for (let x = 6; x <= 94; x += 9) gridFallback.push({ x, y });
  [...sites]
    .sort((a, b) => a.id.localeCompare(b.id))
    .forEach((site, index) => {
      const meta = metas[site.id];
      const origin = meta?.layout ? point(meta) : point(site);
      const width = labelWidth((metas[site.id] || site).name || site.id);
      let candidate = origin;
      const separated = (next: Point) =>
        !placed.some((item) => distance(next, item.point) < Math.max(9, (width + item.width) * 0.34));
      let found = separated(candidate);
      for (let attempt = 0; !found && attempt < 128; attempt += 1) {
        const ring = Math.floor(attempt / 16) + 1;
        const angle = ((attempt * 22.5 + index * 17) * Math.PI) / 180;
        const radius = 9 + ring * 3.5;
        candidate = {
          x: Math.max(6, Math.min(94, origin.x + Math.cos(angle) * radius)),
          y: Math.max(8, Math.min(92, origin.y + Math.sin(angle) * radius)),
        };
        found = separated(candidate);
      }
      if (!found) {
        const fallback = [...gridFallback]
          .sort((a, b) => distance(a, origin) - distance(b, origin))
          .find((item) => separated(item));
        if (fallback) candidate = fallback;
      }
      output[site.id] = candidate;
      placed.push({ point: candidate, width });
    });
  return output;
}
function labelCandidates(preferred?: string): LabelLayout[] {
  const candidates: LabelLayout[] = [];
  const directions: Array<[number, number, LabelLayout['anchor']]> = [
    [1, 0, 'start'],
    [-1, 0, 'end'],
    [0, -1, 'middle'],
    [0, 1, 'middle'],
    [1, -1, 'start'],
    [-1, -1, 'end'],
    [1, 1, 'start'],
    [-1, 1, 'end'],
  ];
  const radii = [5.2, 8.8, 12.8, 17.2, 22.4, 28.4];
  const orderedDirections =
    preferred === 'left'
      ? [directions[1], ...directions.filter((_, index) => index !== 1)]
      : preferred === 'right'
        ? [directions[0], ...directions.filter((_, index) => index !== 0)]
        : preferred === 'above'
          ? [directions[2], ...directions.filter((_, index) => index !== 2)]
          : preferred === 'below'
            ? [directions[3], ...directions.filter((_, index) => index !== 3)]
            : directions;
  radii.forEach((radius) =>
    orderedDirections.forEach(([dx, dy, anchor]) =>
      candidates.push({ x: dx * radius, y: dy * radius * (Math.abs(dy) ? 0.72 : 0.18), anchor })
    )
  );
  return candidates;
}
export function computeLabelLayouts(
  sites: Site[],
  metas: Record<string, SiteReference>,
  lod: string,
  focusedId: string | null,
  nodePositions: Record<string, Point> = {}
) {
  const visible = sites.filter(
    (site) => (metas[site.id]?.node_kind || 'core') === 'core' || lod === 'detail' || focusedId === site.id
  );
  const occupied: LabelBox[] = sites.map((site) => {
    const p = nodePositions[site.id] || point(metas[site.id] || site);
    return { left: p.x - 3.6, right: p.x + 3.6, top: p.y - 3.6, bottom: p.y + 3.6 };
  });
  const output: Record<string, LabelLayout> = {};
  const ordered = [...visible].sort(
    (a, b) => Number(b.id === focusedId) - Number(a.id === focusedId) || a.id.localeCompare(b.id)
  );
  ordered.forEach((site) => {
    const meta = metas[site.id] || site;
    const origin = nodePositions[site.id] || point(meta);
    const preferred = meta.layout?.labelAnchor;
    const candidates = labelCandidates(preferred);
    const width = labelWidth(meta.name || site.id);
    const chosen = candidates.find((candidate) => {
      const box = labelBox(origin, candidate, width);
      return (
        box.left > 1 &&
        box.right < 99 &&
        box.top > 2 &&
        box.bottom < 98 &&
        !occupied.some((other) => intersects(box, other))
      );
    });
    if (chosen) {
      output[site.id] = chosen;
      occupied.push(labelBox(origin, chosen, width));
    }
  });
  return output;
}
function regionLabelPosition(region: Region, sites: Record<string, SiteReference>) {
  const label = region.label_position;
  return label && typeof label.x === 'number' && typeof label.y === 'number'
    ? label
    : region.site_ids.map((id) => point(sites[id])).filter(Boolean)[0] || { x: 50, y: 50 };
}
function routePath(from: Site | ContentSite, to: Site | ContentSite, route: RouteState) {
  const points = [point(from), ...(route.waypoints || []).map(([x, y]) => ({ x, y })), point(to)];
  return points.reduce(
    (path, item, index) => (index === 0 ? `M ${item.x} ${item.y}` : `${path} L ${item.x} ${item.y}`),
    ''
  );
}
function fitTransform(points: Point[]) {
  if (!points.length) return zoomIdentity;
  const minX = Math.min(...points.map((item) => item.x)) - 5;
  const maxX = Math.max(...points.map((item) => item.x)) + 5;
  const minY = Math.min(...points.map((item) => item.y)) - 7;
  const maxY = Math.max(...points.map((item) => item.y)) + 7;
  const span = Math.max(maxX - minX, maxY - minY, 1);
  const scale = Math.max(1, Math.min(1.55, 82 / span));
  return zoomIdentity.translate(50 - ((minX + maxX) / 2) * scale, 50 - ((minY + maxY) / 2) * scale).scale(scale);
}

export function HeritageNetwork({
  sites,
  metaSites,
  regions = [],
  routes = {},
  players,
  active,
  focusedId,
  reachableIds,
  actionMode,
  eventTargetIds = [],
  catalog,
  onFocus,
  onRouteSelect,
}: {
  sites: Record<string, Site>;
  metaSites: Record<string, SiteReference>;
  regions?: Region[];
  routes?: Record<string, RouteState>;
  players: Player[];
  active: Player;
  focusedId: string | null;
  reachableIds: ReadonlySet<string>;
  actionMode: MapActionMode;
  eventTargetIds?: ReadonlyArray<string>;
  catalog?: Meta;
  onFocus: (id: string) => void;
  onRouteSelect: (id: string) => void;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const transformRef = useRef<ZoomTransform>(zoomIdentity);
  const pointerRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity);
  const [hoveredRouteId, setHoveredRouteId] = useState<string | null>(null);
  const enabledSites = useMemo(() => Object.values(sites).filter((site) => metaSites[site.id]), [metaSites, sites]);
  const enabledSiteKey = useMemo(
    () =>
      enabledSites
        .map((site) => site.id)
        .sort()
        .join('|'),
    [enabledSites]
  );
  const eventTargets = new Set(eventTargetIds);
  const routeLines = useMemo<RouteLine[]>(
    () =>
      Object.values(routes)
        .map((route) => ({ id: route.id, from: route.from_site, to: route.to_site, route }))
        .filter((line) => metaSites[line.from] && metaSites[line.to]),
    [metaSites, routes]
  );
  const neighborRouteIds = useMemo(
    () =>
      new Set(
        routeLines.filter((line) => line.from === active.location || line.to === active.location).map((line) => line.id)
      ),
    [active.location, routeLines]
  );
  const nodePositions = useMemo(() => computeNodePositions(enabledSites, metaSites), [enabledSites, metaSites]);
  const mapPoint = (siteId: string) => nodePositions[siteId] || point(metaSites[siteId]);
  const regionLabels = useMemo(
    () =>
      regions
        .filter((region) => region.name)
        .map((region) => ({ ...region, label: regionLabelPosition(region, metaSites) })),
    [metaSites, regions]
  );
  const applyTransform = (next: ZoomTransform, duration = 0) => {
    if (!svgRef.current || !zoomRef.current) return;
    const selection = select(svgRef.current);
    const start = transformRef.current;
    if (!duration) {
      selection.call(zoomRef.current.transform, next);
      return;
    }
    const startedAt = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const frame = zoomIdentity
        .translate(start.x + (next.x - start.x) * eased, start.y + (next.y - start.y) * eased)
        .scale(start.k + (next.k - start.k) * eased);
      selection.call(zoomRef.current!.transform, frame);
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const fitBounds = () => applyTransform(fitTransform(Object.values(nodePositions)), 280);
  useEffect(() => {
    if (!svgRef.current) return;
    const selection = select(svgRef.current);
    const behavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.85, 2.2])
      .on('zoom', (event) => {
        transformRef.current = event.transform;
        setTransform(event.transform);
      });
    zoomRef.current = behavior;
    selection.call(behavior);
    requestAnimationFrame(fitBounds);
    return () => {
      selection.on('.zoom', null);
    };
  }, [enabledSiteKey]);
  const centerCurrent = () => {
    const target = mapPoint(active.location);
    const scale = Math.max(transform.k, 1.12);
    applyTransform(zoomIdentity.translate(50 - target.x * scale, 50 - target.y * scale).scale(scale), 360);
  };
  const zoomBy = (factor: number) => {
    const nextScale = Math.max(0.85, Math.min(2.2, transform.k * factor));
    applyTransform(zoomIdentity.translate(50, 50).scale(nextScale).translate(-50, -50), 220);
  };
  const lod = transform.k < 0.94 ? 'overview' : transform.k > 1.34 ? 'detail' : 'standard';
  const labelLayouts = useMemo(
    () => computeLabelLayouts(enabledSites, metaSites, lod, focusedId, nodePositions),
    [enabledSites, focusedId, lod, metaSites, nodePositions]
  );
  const routeAction = actionMode === 'survey_route' || actionMode === 'restore_route' || actionMode === 'establish_connection';
  const targetRouteIds = getTargetRouteIds(routeLines, reachableIds, actionMode, active.location);
  const eventTargetRouteIds = new Set(eventTargetIds.filter((id) => routeLines.some((line) => line.id === id)));
  const hoveredRoute = routeLines.find((line) => line.id === hoveredRouteId);
  const visibleLines = routeLines.filter(
    (line) =>
      lod !== 'overview' ||
      line.route.tags?.includes('main') ||
      line.route.status !== 'open' ||
      neighborRouteIds.has(line.id)
  );
  const currentPoint = mapPoint(active.location);
  const selectedPoint = focusedId && focusedId !== active.location ? mapPoint(focusedId) : null;
  return (
    <div className={`${styles.root} network-frame world-stage ${routeAction ? 'route-action' : ''}`.trim()}>
      <div className="network-tools">
        <button title="聚焦当前玩家" onClick={centerCurrent} aria-label="聚焦当前玩家">
          <LocateFixed />
        </button>
        <button title="放大地图" onClick={() => zoomBy(1.2)} aria-label="放大地图">
          <Plus />
        </button>
        <button title="缩小地图" onClick={() => zoomBy(1 / 1.2)} aria-label="缩小地图">
          <Minus />
        </button>
        <button title="适应全部节点" onClick={fitBounds} aria-label="适应全部节点">
          <Maximize2 />
        </button>
      </div>
      <svg
        ref={svgRef}
        viewBox="0 0 100 100"
        role="application"
        aria-label="本局地图，可用 Tab 选择路线和地点"
        onDoubleClick={fitBounds}
      >
        <g className="network-atmosphere-layer" aria-hidden="true">
          <image
            className="network-atmosphere network-atmosphere-muted"
            href={assetUrl('interaction/network/network-muted.webp')}
            x="8"
            y="14"
            width="84"
            height="62"
            preserveAspectRatio="xMidYMid meet"
          />
          <image
            className="network-atmosphere network-atmosphere-lit"
            href={assetUrl('interaction/network/network-lit.webp')}
            x="8"
            y="14"
            width="84"
            height="62"
            preserveAspectRatio="xMidYMid meet"
          />
        </g>
        <g className="map-world" transform={transform.toString()}>
          <g className={`region-layer lod-${lod}`}>
            {regionLabels.map((region) => (
              <g key={region.id} className={`region-label region-${region.visual_token || region.id}`}>
                <text x={region.label.x} y={region.label.y}>
                  {region.name}
                </text>
              </g>
            ))}
          </g>
          <g className="map-focus-layer" aria-hidden="true">
            <image
              className="map-player-focus-art"
              href={assetUrl('interaction/rings/focus.webp')}
              x={currentPoint.x - 9}
              y={currentPoint.y - 9}
              width="18"
              height="18"
              preserveAspectRatio="xMidYMid meet"
            />
            {selectedPoint && (
              <image
                className="map-selection-focus-art"
                href={assetUrl('interaction/rings/neutral.webp')}
                x={selectedPoint.x - 6.5}
                y={selectedPoint.y - 6.5}
                width="13"
                height="13"
                preserveAspectRatio="xMidYMid meet"
              />
            )}
          </g>
          <g className="route-layer">
            {visibleLines.map((line) => {
              const target = targetRouteIds.has(line.id);
              const eventTarget = eventTargetRouteIds.has(line.id);
              const abnormal = line.route.status !== 'open' || line.route.risk > 0;
              const classes = [
                line.route.road_class ? `road-${line.route.road_class}` : '',
                neighborRouteIds.has(line.id) ? 'is-neighbor' : '',
                target ? 'is-target' : '',
                eventTarget ? 'is-event-target' : '',
                abnormal ? `is-${line.route.status}` : '',
                line.route.connection_level >= 2 ? 'is-illuminated' : '',
                hoveredRouteId === line.id ? 'is-hovered' : '',
                actionMode && !target && !neighborRouteIds.has(line.id) ? 'is-muted' : '',
              ]
                .filter(Boolean)
                .join(' ');
              const d = routePath(
                    { ...metaSites[line.from], layout: mapPoint(line.from) },
                    { ...metaSites[line.to], layout: mapPoint(line.to) },
                    line.route
                  );
              return (
                <g key={line.id} className="route-hit-group">
                  <path className="route-hit-area" d={d} aria-hidden="true" />
                  <path
                  className={classes}
                  d={d}
                  tabIndex={0}
                  role="button"
                  aria-label={`${line.route.name || '路线'}，${line.route.cost} 行动点，风险 ${line.route.risk}`}
                  onMouseEnter={() => setHoveredRouteId(line.id)}
                  onMouseLeave={() => setHoveredRouteId(null)}
                  onFocus={() => setHoveredRouteId(line.id)}
                  onBlur={() => setHoveredRouteId(null)}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (routeAction) onRouteSelect(line.id);
                    else onFocus(line.to);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      if (routeAction) onRouteSelect(line.id);
                      else onFocus(line.to);
                    }
                  }}
                  />
                </g>
              );
            })}
          </g>
          <g className="node-layer">
            {enabledSites
              .filter((site) => lod !== 'overview' || site.node_kind !== 'event')
              .map((site) => {
                const meta = metaSites[site.id] || site;
                const current = active.location === site.id;
                const reachable = reachableIds.has(site.id);
                const target = actionMode !== null && reachable && !current;
                const eventTarget = eventTargets.has(site.id);
                const reason = nodeReason(site, meta, current, target, eventTarget, catalog);
                const hoverEndpoint = hoveredRoute && (hoveredRoute.from === site.id || hoveredRoute.to === site.id);
                const kind = meta.node_kind || 'core';
                const size = kind === 'core' ? 4.2 : kind === 'support' ? 3.1 : 2.7;
                const labelPosition = labelLayouts[site.id];
                const icon = assetUrl(meta.icon_asset || 'generated/nodes/icon_node_yungang.webp');
                const frame =
                  site.status === 'closed' || site.status === 'at_risk'
                    ? 'damaged'
                    : kind === 'event'
                      ? 'warning'
                      : kind === 'support'
                        ? 'network'
                        : current
                          ? 'lotus'
                          : 'neutral';
                const surface =
                  site.status === 'closed' || site.status === 'at_risk' ? 'damaged' : current ? 'focused' : 'neutral';
                const alert = site.status === 'at_risk' || site.status === 'closed';
                const position = nodePositions[site.id] || point(meta);
                return (
                  <g
                    key={site.id}
                    className={`map-node node-${kind} ${current ? 'node-current' : ''} ${focusedId === site.id ? 'node-focused' : ''} ${target ? 'node-reachable' : ''} ${alert ? 'node-alert' : ''} ${site.status === 'closed' ? 'node-closed' : ''} ${site.status === 'at_risk' ? 'node-risk' : ''} ${hoverEndpoint ? 'node-route-hover' : ''}`}
                    transform={`translate(${position.x} ${position.y})`}
                    role="button"
                    tabIndex={0}
                    aria-label={`${meta.name || '此处节点'}：${reason}`}
                    onPointerDown={(event) => {
                      pointerRef.current = { x: event.clientX, y: event.clientY, time: performance.now() };
                    }}
                    onPointerUp={(event) => {
                      const start = pointerRef.current;
                      pointerRef.current = null;
                      if (
                        start &&
                        Math.hypot(event.clientX - start.x, event.clientY - start.y) < 8 &&
                        performance.now() - start.time < 700
                      )
                        onFocus(site.id);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onFocus(site.id);
                      }
                    }}
                  >
                    <title>{reason}</title>
                    <circle className="node-back" r={size} />
                    <image
                      className="node-surface"
                      href={assetUrl(`interaction/surfaces/${surface}.webp`)}
                      x={-size * 0.92}
                      y={-size * 0.92}
                      width={size * 1.84}
                      height={size * 1.84}
                      preserveAspectRatio="xMidYMid meet"
                    />
                    <image
                      className="node-frame"
                      href={assetUrl(`interaction/node-frames/${frame}.webp`)}
                      x={-size * 0.86}
                      y={-size * 0.86}
                      width={size * 1.72}
                      height={size * 1.72}
                      preserveAspectRatio="xMidYMid meet"
                    />
                    <image
                      className="node-image"
                      href={icon}
                      x={-size * 0.65}
                      y={-size * 0.65}
                      width={size * 1.3}
                      height={size * 1.3}
                      preserveAspectRatio="xMidYMid meet"
                    />
                    {labelPosition && (kind === 'core' || lod === 'detail' || focusedId === site.id) && (
                      <text
                        className="node-label"
                        x={labelPosition.x}
                        y={labelPosition.y}
                        textAnchor={labelPosition.anchor}
                      >
                        {meta.name || '此处节点'}
                      </text>
                    )}
                    {labelPosition && lod === 'detail' && (current || target || focusedId === site.id) && (
                      <text
                        className="node-status"
                        x={labelPosition.x}
                        y={labelPosition.y + 2.1}
                        textAnchor={labelPosition.anchor}
                      >
                        {current ? '当前位置' : target ? '可选目标' : site.status === 'closed' ? '已关闭' : '查看节点'}
                      </text>
                    )}
                  </g>
                );
              })}
          </g>

          <g className="event-target-layer" aria-hidden="true">
            {eventTargetIds.map((id) => {
              const target = metaSites[id];
              if (!target) return null;
              const location = mapPoint(id);
              return (
                <g key={id} transform={`translate(${location.x} ${location.y})`}>
                  <circle className="event-target-ring" r="5.2" />
                  <circle className="event-target-dot" r=".8" />
                </g>
              );
            })}
          </g>
          <g className="player-marker-layer">
            {players.map((player, index) => {
              const location = mapPoint(player.location);
              const companions = players.filter((item) => item.location === player.location);
              const slot = companions.findIndex((item) => item.id === player.id);
              const angle = companions.length > 1 ? (slot / companions.length) * Math.PI * 2 : -Math.PI / 2;
              const offset = companions.length > 1 ? 4.3 : 4.8;
              return (
                <g
                  key={player.id}
                  className={`player-marker marker-${index % 4} ${player.id === active.id ? 'marker-active' : 'marker-idle'}`}
                  transform={`translate(${location.x + Math.cos(angle) * offset} ${location.y + Math.sin(angle) * offset})`}
                  aria-label={`${player.name}，位于${metaSites[player.location]?.name || player.location}`}
                >
                  <circle className="player-marker-halo" r="2.1" />
                  <circle className="player-marker-core" r="1.15" />
                  <text x="0" y=".38">
                    {index + 1}
                  </text>
                </g>
              );
            })}
          </g>
        </g>
      </svg>
      <details className="network-access-list">
        <summary><span>地点与路线清单</span><small>点击可聚焦地图</small></summary>
        <div className="network-access-content">
          <section>
            <b>地点</b>
            {enabledSites.map((site) => {
              const isCurrent = site.id === active.location;
              const status = isCurrent ? '当前位置' : site.status === 'closed' ? '已关闭' : site.status === 'at_risk' ? '有风险' : '可查看';
              return <button key={site.id} className={isCurrent ? 'is-current' : ''} onClick={() => onFocus(site.id)}>
                <span>{metaSites[site.id]?.name || site.name || '未命名节点'}</span><small>{status}</small>
              </button>;
            })}
          </section>
          <section>
            <b>路线</b>
            {routeLines.map((line) => {
              const neighbor = line.from === active.location || line.to === active.location;
              const routeStatus = line.route.status === 'blocked' ? '已阻断' : line.route.status === 'strained' ? '承压' : neighbor ? '相邻路线' : '可查看';
              return <button key={line.id} className={neighbor ? 'is-current' : ''} onClick={() => (routeAction ? onRouteSelect(line.id) : onFocus(line.to))}>
                <span>{line.route.name || `${metaSites[line.from]?.name}—${metaSites[line.to]?.name}`}</span><small>{routeStatus} · 风险 {line.route.risk}</small>
              </button>;
            })}
          </section>
        </div>
      </details>

    </div>
  );
}
