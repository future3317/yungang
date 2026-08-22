import { describe, expect, it } from 'vitest';
import type { Site } from '../../types/game';
import { computeLabelLayouts, computeNodePositions, labelBox } from './HeritageNetwork';

const site = (id: string, name: string, x: number, y: number): Site => ({
  id,
  name,
  x,
  y,
  layout: { x, y },
  node_kind: 'core',
  damage: 0,
  max_damage: 3,
  durability: 3,
  max_durability: 3,
  status: 'stable',
  influence: 0,
  discovered: true,
  domains: [],
  contributions: [],
});

describe('map label layout', () => {
  it('does not place visible labels on top of each other or their nodes', () => {
    const sites = [
      site('a', '华严寺', 48, 48),
      site('b', '云冈石窟', 48, 48),
      site('c', '善化寺', 48, 48),
      site('d', '大同古城', 48, 48),
      site('e', '北线工坊', 48, 48),
      site('f', '档案库', 48, 48),
    ];
    const metas = Object.fromEntries(sites.map(item => [item.id, item]));
    const layouts = computeLabelLayouts(sites, metas, 'detail', null);
    const boxes = sites.map(item => labelBox({ x: item.x!, y: item.y! }, layouts[item.id], Math.min(25, Math.max(8, [...item.name!].length * 1.75))));
    for (let index = 0; index < boxes.length; index += 1) {
      for (let next = index + 1; next < boxes.length; next += 1) {
        expect(boxes[index].left >= boxes[next].right || boxes[next].left >= boxes[index].right || boxes[index].top >= boxes[next].bottom || boxes[next].top >= boxes[index].bottom).toBe(true);
      }
    }
  });

  it('separates coincident node coordinates before rendering the map', () => {
    const positions = computeNodePositions([site('a', '华严寺', 48, 48), site('b', '云冈石窟', 48, 48), site('c', '善化寺', 48, 48)], { a: site('a', '华严寺', 48, 48), b: site('b', '云冈石窟', 48, 48), c: site('c', '善化寺', 48, 48) });
    const values = Object.values(positions);
    expect(new Set(values.map(item => `${item.x},${item.y}`)).size).toBe(values.length);
    for (let index = 0; index < values.length; index += 1) for (let next = index + 1; next < values.length; next += 1) expect(Math.hypot(values[index].x - values[next].x, values[index].y - values[next].y)).toBeGreaterThanOrEqual(9);
  });

  it('keeps a dense cluster separated after the radial candidates are exhausted', () => {
    const sites = Array.from({ length: 24 }, (_, index) => site(`cluster-${index}`, `节点${index}`, 50, 50));
    const positions = computeNodePositions(sites, Object.fromEntries(sites.map(item => [item.id, item])));
    const values = Object.values(positions);
    for (let index = 0; index < values.length; index += 1) for (let next = index + 1; next < values.length; next += 1) expect(Math.hypot(values[index].x - values[next].x, values[index].y - values[next].y)).toBeGreaterThanOrEqual(9);
  });
});
