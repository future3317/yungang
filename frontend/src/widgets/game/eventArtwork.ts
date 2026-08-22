const fallbackByEventId: Record<string, string> = {
  sandstorm: 'generated/scene_frontier_pass.webp',
  pilgrims: 'generated/scene_trade_meeting.webp',
  quiet: 'generated/scene_yungang_night.webp',
  route_blocked: 'generated/scene_frontier_pass.webp',
  event_05: 'generated/scene_craft_restoration.webp',
  event_06: 'generated/scene_craft_restoration.webp',
  event_07: 'generated/scene_yungang_day.webp',
  event_08: 'generated/scene_archive_cave.webp',
  event_09: 'generated/scene_silk_road_expedition.webp',
  event_10: 'generated/scene_craft_restoration.webp',
  event_11: 'generated/scene_archive_cave.webp',
  event_12: 'generated/scene_craft_restoration.webp',
  event_13: 'generated/scene_silk_road_expedition.webp',
  event_14: 'generated/scene_trade_meeting.webp',
  event_15: 'generated/scene_archive_cave.webp',
  event_16: 'generated/scene_craft_restoration.webp',
  event_17: 'generated/scene_yungang_night.webp',
  event_18: 'generated/scene_trade_meeting.webp',
  event_19: 'generated/scene_silk_road_expedition.webp',
  event_20: 'generated/scene_yungang_day.webp',
  event_21: 'generated/scene_trade_meeting.webp',
  event_22: 'generated/scene_trade_meeting.webp',
  event_23: 'generated/scene_silk_road_expedition.webp',
  event_24: 'generated/scene_yungang_night.webp',
};

const fallbackByType: Record<string, string> = {
  weathering: 'generated/scene_craft_restoration.webp',
  route: 'generated/scene_frontier_pass.webp',
  exchange: 'generated/scene_trade_meeting.webp',
  research: 'generated/scene_archive_cave.webp',
};

export function resolveEventSceneAsset(event?: { id?: string; scene_asset?: string; type?: string }) {
  return event?.scene_asset || (event?.id ? fallbackByEventId[event.id] : undefined) || (event?.type ? fallbackByType[event.type] : undefined) || 'generated/scene_yungang_night.webp';
}
