import { useEffect, useMemo, useRef, useState } from 'react';
import { LocateFixed, Maximize2, ZoomIn, ZoomOut } from 'lucide-react';
import { select } from 'd3-selection';
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from 'd3-zoom';
import type { ActionType, ContentSite, Player, Region, RouteState, Site, SiteReference } from '../../types/game';
import { assetUrl } from '../../shared/assetUrl';

type MapActionMode = Extract<
  ActionType,
  'move' | 'restore' | 'survey_route' | 'restore_route' | 'establish_connection'
> | null;
type Point = { x: number; y: number };
type RouteLine = { id: string; from: string; to: string; route: RouteState };

const routeRoadNames: Record<string, string> = { main: '主干道', regional: '区域道路', local: '支路' };
const routeStatusNames: Record<string, string> = {
  open: '通行',
  blocked: '阻断',
  strained: '承压',
  restored: '已修护',
  illuminated: '已点亮',
  closed: '已关闭',
};
const siteStatusNames: Record<string, string> = { stable: '稳定', at_risk: '有风险', closed: '已关闭', normal: '稳定' };
function routeRoadName(value?: string) {
  return routeRoadNames[value || ''] || '支路';
}
function routeStatusName(value?: string) {
  return routeStatusNames[value || ''] || '通行';
}
function siteStatusName(value?: string) {
  return siteStatusNames[value || ''] || '稳定';
}
function nodeReason(site: Site, meta: SiteReference, current: boolean, target: boolean, eventTarget: boolean) {
  if (site.status === 'closed') return '红点：这个节点已经关闭，先完成修护才能继续推进。';
  if (site.status === 'at_risk') return '红点：节点接近关闭，优先修护可避免回合结算后失去它。';
  if (eventTarget) return '橙色标记：本轮事件可能影响这里，提前准备可以降低损伤。';
  if (target) return '金色标记：这是当前行动可以选择的合法目标。';
  if (current) return '这里是当前行动者的位置。';
  return `${meta.name || site.id}目前${siteStatusName(site.status)}。点击可查看地点任务、团队项目和事件说明。`;
}

function wrapMapText(value: string, maxChars = 18) {
  const chars = Array.from(value);
  const lines: string[] = [];
  for (let index = 0; index < chars.length; index += maxChars)
    lines.push(chars.slice(index, index + maxChars).join(''));
  return lines.slice(0, 4);
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
      const origin = point(metas[site.id] || site);
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
function convexHull(points: Point[]) {
  if (points.length < 3) return points;
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (a: Point, b: Point, c: Point) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const half = (values: Point[]) =>
    values.reduce<Point[]>((stack, item) => {
      while (stack.length > 1 && cross(stack[stack.length - 2], stack[stack.length - 1], item) <= 0) stack.pop();
      stack.push(item);
      return stack;
    }, []);
  const lower = half(sorted);
  const upper = half([...sorted].reverse());
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}
function softHull(points: Point[]) {
  const hull = convexHull(points);
  if (hull.length < 3) return '';
  const expanded = hull.map((item, index) => {
    const prev = hull[(index + hull.length - 1) % hull.length];
    const next = hull[(index + 1) % hull.length];
    return {
      x: Math.max(2, Math.min(98, item.x + (item.x - (prev.x + next.x) / 2) * 0.22)),
      y: Math.max(4, Math.min(96, item.y + (item.y - (prev.y + next.y) / 2) * 0.22)),
    };
  });
  return (
    expanded
      .map((item, index) => {
        const next = expanded[(index + 1) % expanded.length];
        const mid = { x: (item.x + next.x) / 2, y: (item.y + next.y) / 2 };
        return index
          ? `Q ${item.x} ${item.y} ${mid.x} ${mid.y}`
          : `M ${mid.x} ${mid.y} Q ${item.x} ${item.y} ${mid.x} ${mid.y}`;
      })
      .join(' ') + ' Z'
  );
}
function routePath(from: Site | ContentSite, to: Site | ContentSite, route: RouteState) {
  const points = [point(from), ...(route.waypoints || []).map(([x, y]) => ({ x, y })), point(to)];
  return points.reduce(
    (path, item, index) => (index === 0 ? `M ${item.x} ${item.y}` : `${path} L ${item.x} ${item.y}`),
    ''
  );
}
function fitTransform(sites: Site[]) {
  const points = sites.map(point);
  if (!points.length) return zoomIdentity;
  const minX = Math.min(...points.map((item) => item.x)) - 5;
  const maxX = Math.max(...points.map((item) => item.x)) + 5;
  const minY = Math.min(...points.map((item) => item.y)) - 7;
  const maxY = Math.max(...points.map((item) => item.y)) + 7;
  const span = Math.max(maxX - minX, maxY - minY, 1);
  const scale = Math.max(0.78, Math.min(2.2, 76 / span));
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
  eventTargetLabels = [],
  eventName,
  onFocus,
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
  eventTargetLabels?: string[];
  eventName?: string;
  onFocus: (id: string) => void;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const transformRef = useRef<ZoomTransform>(zoomIdentity);
  const pointerRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity);
  const [hoveredRouteId, setHoveredRouteId] = useState<string | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [hoveredSiteId, setHoveredSiteId] = useState<string | null>(null);
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
  const regionShapes = useMemo(
    () =>
      regions
        .map((region) => {
          const points = region.hull_points?.length
            ? region.hull_points
            : region.site_ids.map((id) => nodePositions[id] || point(metaSites[id]));
          return { ...region, shape: softHull(points), label: regionLabelPosition(region, metaSites) };
        })
        .filter((region) => region.shape),
    [metaSites, nodePositions, regions]
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
  const fitBounds = () => applyTransform(fitTransform(enabledSites), 280);
  useEffect(() => {
    if (!svgRef.current) return;
    const selection = select(svgRef.current);
    const behavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.72, 2.2])
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
  const scaleBy = (factor: number) => {
    if (svgRef.current && zoomRef.current) select(svgRef.current).call(zoomRef.current.scaleBy, factor);
  };
  const centerCurrent = () => {
    const target = mapPoint(active.location);
    const scale = Math.max(transform.k, 1.12);
    applyTransform(zoomIdentity.translate(50 - target.x * scale, 50 - target.y * scale).scale(scale), 360);
  };
  const lod = transform.k < 0.94 ? 'overview' : transform.k > 1.34 ? 'detail' : 'standard';
  const labelLayouts = useMemo(
    () => computeLabelLayouts(enabledSites, metaSites, lod, focusedId, nodePositions),
    [enabledSites, focusedId, lod, metaSites, nodePositions]
  );
  const targetRouteIds = new Set(
    routeLines
      .filter(
        (line) =>
          actionMode &&
          (reachableIds.has(line.from) || reachableIds.has(line.to)) &&
          (line.from === active.location || line.to === active.location)
      )
      .map((line) => line.id)
  );
  const eventTargetRouteIds = new Set(eventTargetIds.filter((id) => routeLines.some((line) => line.id === id)));
  const hoveredRoute = routeLines.find((line) => line.id === hoveredRouteId);
  const selectedRoute = routeLines.find((line) => line.id === selectedRouteId);
  const visibleLines = routeLines.filter(
    (line) =>
      lod !== 'overview' ||
      line.route.tags?.includes('main') ||
      line.route.status !== 'open' ||
      neighborRouteIds.has(line.id)
  );
  const currentPoint = mapPoint(active.location);
  const selectedPoint = focusedId && focusedId !== active.location ? mapPoint(focusedId) : null;
  const hintSiteId = hoveredSiteId || focusedId;
  const hintSite = hintSiteId ? enabledSites.find((site) => site.id === hintSiteId) : undefined;
  return (
    <div className="network-frame world-stage">
      <div className="network-tools">
        <button title="放大地图" onClick={() => scaleBy(1.14)} aria-label="放大地图">
          <ZoomIn />
        </button>
        <button title="缩小地图" onClick={() => scaleBy(0.88)} aria-label="缩小地图">
          <ZoomOut />
        </button>
        <button title="聚焦当前玩家" onClick={centerCurrent} aria-label="聚焦当前玩家">
          <LocateFixed />
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
            {regionShapes.map((region) => (
              <g key={region.id} className={`region-shape region-${region.visual_token || region.id}`}>
                <path d={region.shape} />
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
                hoveredRouteId === line.id || selectedRouteId === line.id ? 'is-hovered' : '',
                actionMode && !target && !neighborRouteIds.has(line.id) ? 'is-muted' : '',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <path
                  key={line.id}
                  className={classes}
                  d={routePath(
                    { ...metaSites[line.from], layout: mapPoint(line.from) },
                    { ...metaSites[line.to], layout: mapPoint(line.to) },
                    line.route
                  )}
                  tabIndex={0}
                  role="button"
                  aria-label={`${line.route.name || '路线'}，${line.route.cost} 行动点，风险 ${line.route.risk}`}
                  onMouseEnter={() => setHoveredRouteId(line.id)}
                  onMouseLeave={() => setHoveredRouteId(null)}
                  onFocus={() => setHoveredRouteId(line.id)}
                  onBlur={() => setHoveredRouteId(null)}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedRouteId(line.id);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedRouteId(line.id);
                    }
                  }}
                />
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
                const reason = nodeReason(site, meta, current, target, eventTarget);
                const hoverEndpoint = hoveredRoute && (hoveredRoute.from === site.id || hoveredRoute.to === site.id);
                const kind = meta.node_kind || 'core';
                const size = kind === 'core' ? 4.2 : kind === 'support' ? 3.1 : 2.7;
                const labelPosition = labelLayouts[site.id];
                const icon = meta.icon_asset
                  ? assetUrl(meta.icon_asset)
                  : assetUrl(
                      `generated/nodes/states/${site.id}_${current ? 'active' : site.status === 'closed' ? 'closed' : target ? 'reachable' : 'normal'}.webp`
                    );
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
                    aria-label={`${meta.name || site.id}：${reason}`}
                    onPointerEnter={() => setHoveredSiteId(site.id)}
                    onPointerLeave={() => setHoveredSiteId(null)}
                    onFocus={() => setHoveredSiteId(site.id)}
                    onBlur={() => setHoveredSiteId(null)}
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
                    {alert && <circle className="node-mark" cx={size * 0.76} cy={-size * 0.76} r=".8" />}
                    {labelPosition && (kind === 'core' || lod === 'detail' || focusedId === site.id) && (
                      <text
                        className="node-label"
                        x={labelPosition.x}
                        y={labelPosition.y}
                        textAnchor={labelPosition.anchor}
                      >
                        {meta.name || site.id}
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
          {hintSite &&
            (() => {
              const meta = metaSites[hintSite.id] || hintSite;
              const current = active.location === hintSite.id;
              const target = actionMode !== null && reachableIds.has(hintSite.id) && !current;
              const reason = nodeReason(hintSite, meta, current, target, eventTargets.has(hintSite.id));
              const location = mapPoint(hintSite.id);
              const lines = wrapMapText(reason);
              const title = meta.name || hintSite.id;
              const width = Math.min(
                64,
                Math.max(38, Math.max(title.length * 1.8, ...lines.map((line) => line.length * 1.15)) + 4)
              );
              const height = 5 + lines.length * 2.7;
              return (
                <g
                  className="node-hover-card"
                  transform={`translate(${Math.max(8, Math.min(100 - width - 8, location.x - width / 2))} ${Math.max(8, location.y - height - 4)})`}
                  pointerEvents="none"
                >
                  <rect width={width} height={height} rx="1.2" />
                  <text x="1.2" y="2.8">
                    {meta.name || hintSite.id}
                  </text>
                  {lines.map((line, index) => (
                    <text key={index} x="1.2" y={5.6 + index * 2.5}>
                      {line}
                    </text>
                  ))}
                </g>
              );
            })()}
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
      {selectedRoute && (
        <aside className="route-inspector" aria-label="路线检查器">
          <button title="关闭路线检查器" aria-label="关闭路线检查器" onClick={() => setSelectedRouteId(null)}>
            ×
          </button>
          <span className="eyebrow">路线检查器</span>
          <h3>
            {selectedRoute.route.name || `${metaSites[selectedRoute.from]?.name}—${metaSites[selectedRoute.to]?.name}`}
          </h3>
          <p>
            {selectedRoute.route.ui_hint ||
              selectedRoute.route.risk_profile ||
              '这条路线连接两个协作节点，状态会随事件和团队治理改变。'}
          </p>
          <dl>
            <div>
              <dt>道路</dt>
              <dd>{routeRoadName(selectedRoute.route.road_class)}</dd>
            </div>
            <div>
              <dt>成本</dt>
              <dd>{selectedRoute.route.cost} 行动点</dd>
            </div>
            <div>
              <dt>风险</dt>
              <dd>{selectedRoute.route.risk}</dd>
            </div>
            <div>
              <dt>状态</dt>
              <dd>{routeStatusName(selectedRoute.route.status)}</dd>
            </div>
          </dl>
          <small>相关行动：勘察、修护或建立连接会根据当前合法行动出现。</small>
        </aside>
      )}
      <details className="network-access-list">
        <summary>地点与路线清单</summary>
        <div>
          {enabledSites.map((site) => (
            <button key={site.id} onClick={() => onFocus(site.id)}>
              {metaSites[site.id]?.name || site.name || site.id}
            </button>
          ))}
          {routeLines.map((line) => (
            <button key={line.id} onClick={() => setSelectedRouteId(line.id)}>
              {line.route.name || `${metaSites[line.from]?.name}—${metaSites[line.to]?.name}`}
            </button>
          ))}
        </div>
      </details>
      {eventTargetLabels.length > 0 ? (
        <div className="event-map-notice" role="status">
          <b>{eventName || '当前事件'}</b>
          <span>影响地点：{eventTargetLabels.join('、')}</span>
          <small>橙色环表示本回合会受影响；橙色实点表示仍可守护。</small>
        </div>
      ) : null}
      <div className="network-corner">
        本局地图
        <span>
          {hoveredRoute
            ? `线路：${routeStatusName(hoveredRoute.route.status)} · ${hoveredRoute.route.cost} 行动点 · 风险 ${hoveredRoute.route.risk}`
            : actionMode
              ? `正在选择目标 · 已突出合法线路 · Escape 取消`
              : '滚轮缩放 · 拖动地图 · 双击适应全部节点'}
        </span>
      </div>
    </div>
  );
}
