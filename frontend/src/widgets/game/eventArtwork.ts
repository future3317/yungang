const fallbackByEventId: Record<string, string> = {
  sandstorm: 'generated/scene_frontier_pass.png',
  pilgrims: 'generated/scene_trade_meeting.png',
  quiet: 'generated/scene_yungang_night.png',
  route_blocked: 'generated/scene_frontier_pass.png',
  event_05: 'generated/scene_craft_restoration.png',
  event_06: 'generated/scene_craft_restoration.png',
  event_07: 'generated/scene_yungang_day.png',
  event_08: 'generated/scene_archive_cave.png',
  event_09: 'generated/scene_frontier_pass.png',
  event_10: 'generated/scene_craft_restoration.png',
  event_11: 'generated/scene_archive_cave.png',
  event_12: 'generated/scene_craft_restoration.png',
  event_13: 'generated/scene_frontier_pass.png',
  event_14: 'generated/scene_trade_meeting.png',
  event_15: 'generated/scene_archive_cave.png',
  event_16: 'generated/scene_craft_restoration.png',
  event_17: 'generated/scene_yungang_night.png',
  event_18: 'generated/scene_trade_meeting.png',
  event_19: 'generated/scene_frontier_pass.png',
  event_20: 'generated/scene_frontier_pass.png',
  event_21: 'generated/scene_trade_meeting.png',
  event_22: 'generated/scene_trade_meeting.png',
  event_23: 'generated/scene_frontier_pass.png',
  event_24: 'generated/scene_yungang_night.png',
};

const fallbackByType: Record<string, string> = {
  weathering: 'generated/scene_craft_restoration.png',
  route: 'generated/scene_frontier_pass.png',
  exchange: 'generated/scene_trade_meeting.png',
  research: 'generated/scene_archive_cave.png',
};

export function resolveEventSceneAsset(event?: { id?: string; scene_asset?: string; type?: string }) {
  return event?.scene_asset || (event?.id ? fallbackByEventId[event.id] : undefined) || (event?.type ? fallbackByType[event.type] : undefined) || 'generated/scene_yungang_night.png';
}
