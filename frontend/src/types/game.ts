import type { components } from '../shared/api/generated';

// API state is defined by OpenAPI. Keep UI-only types below this boundary.
export type ActionType = components['schemas']['ActionType'];
export type SiteStatus = components['schemas']['SiteStatus'];
export type Phase = components['schemas']['Phase'];
export type RouteStatus = components['schemas']['RouteStatus'];
export type ProjectStatus = components['schemas']['ProjectStatus'];
export type ChoiceKind = components['schemas']['ChoiceKind'];
export type EventStatus = components['schemas']['EventStatus'];
export type PlayMode = components['schemas']['PlayMode'];
export type GameOutcome = components['schemas']['GameOutcome'] | null;
export type ActionOption = Omit<components['schemas']['ActionOption'], 'targets' | 'recommendation_score' | 'reason' | 'confirmation' | 'category_label' | 'action_label'> & { targets: ActionTarget[]; recommendation_score?: number; reason?: string; confirmation?: string; category_label?: string; action_label?: string; };
export type ActionTarget = Omit<components['schemas']['ActionTarget'], 'recommendation_score' | 'reason'> & { recommendation_score?: number; reason?: string; };
export type Player = Omit<components['schemas']['PlayerState'], 'hand' | 'action_hand'> & { hand: string[]; action_hand: string[]; };
export type Site = components['schemas']['SiteState'] & {
  name?: string; summary?: string; icon_asset?: string; scene_asset?: string; x?: number; y?: number;
  layout?: { x?: number; y?: number; anchor?: 'start' | 'middle' | 'end'; labelAnchor?: 'left' | 'right' | 'above' | 'below' };
  node_kind?: 'core' | 'support' | 'event'; kind?: string; content_class?: 'documented' | 'interpretive' | 'gameplay';
  connections?: string[]; node_ability?: { name: string; description: string };
  active_task_id?: string | null;
};
export type Task = Partial<components['schemas']['TaskState']> & { id?: string; site_id?: string; name: string; required_domains: string[]; required_origin_diversity: number; required_card_count: number; contributed_cards: string[]; completed: boolean; combo_requirement?: { required_combo_tags?: string[]; preferred_origins?: string[]; minimum_distinct_players?: number; }; interpretation?: { placements: Array<{ card_id: string; relation: 'support' | 'conflict' | 'pending'; player_id: string }>; formed: boolean; intervention?: 'act_now' | 'minimal' | 'record' | null; confidence: number; }; culture_explanation?: string; ui_instruction?: string; required_cards_per_player_min?: number; progress?: { requirements: TaskRequirement[]; complete: boolean; interpretation?: { reason?: string; missing_domains?: string[]; missing_origins?: string[]; missing_tags?: string[]; can_form?: boolean } }; };
export type Shared = Omit<components['schemas']['SharedState'], 'player_order' | 'completed_domains' | 'log' | 'planning_marks' | 'journal' | 'event_targets' | 'event_history'> & { player_order: string[]; completed_domains: string[]; log: string[]; planning_marks?: Record<string, Array<{ target_id: string; turn: string; collaborated?: boolean; collaboration_action?: string | null }>>; journal?: Array<{ id: string; round: number; type: string; message: string; effects?: unknown[]; created_at: string; player_id?: string | null }>; event_targets?: string[]; event_history?: Array<{ event_id?: string | null; round: number; resolution?: Array<{ changes?: Record<string, string | number> }> }>; };
export type RouteState = components['schemas']['RouteState'];
export type ProjectState = Omit<components['schemas']['ProjectState'], 'stages' | 'contributors'> & { stages: components['schemas']['ProjectStage'][]; contributors: string[]; };
export type ObjectiveState = components['schemas']['ObjectiveState'];
export type ScoreState = components['schemas']['ScoreState'];
export type GoalCondition = components['schemas']['GoalCondition'];
export type GoalStatus = components['schemas']['GoalStatus'];
export type FeedbackChange = components['schemas']['FeedbackChange'];
export type FeedbackEvent = components['schemas']['FeedbackEvent'];
export type ResultState = components['schemas']['ResultState'];
export type ViewerState = components['schemas']['ViewerState'];
export type GameState = Omit<components['schemas']['GameState'], 'players' | 'sites' | 'tasks' | 'shared' | 'action_options' | 'routes' | 'projects' | 'objectives' | 'market' | 'decks'> & { players: Record<string, Player>; sites: Record<string, Site>; tasks: Record<string, Task>; shared: Shared; decks: Record<string, string[]>; market: string[]; action_options?: ActionOption[]; routes?: Record<string, RouteState>; projects?: Record<string, ProjectState>; objectives?: Record<string, ObjectiveState>; };

// Actions are a UI command model, not a second server state model.
export interface Action { type: ActionType; label?: string; description?: string; cost?: number; target_id?: string; target_site_id?: string; target_ids?: string[]; card_id?: string; recipient_id?: string; route_id?: string; upgrade_id?: string; skill?: string; request_id?: string; preview_delta?: Record<string, unknown>; requirements?: string[]; }

export interface TaskRequirement { key: string; label: string; current?: number; target?: number; complete: boolean; missing?: string[]; }
export interface ContentCard { id: string; name: string; icon_asset?: string; domain?: string; origin_tags?: string[]; description?: string; summary?: string; combo_name?: string; combo_tags?: string[]; combo_reward_text?: string; evidence_use_text?: string; instant_use_text?: string; strategic_role?: string; effect?: Record<string, unknown>; }
export interface ContentEvent { id: string; name: string; scene_asset?: string; description?: string; summary?: string; forecast_text?: string; mitigation_hint?: string; mitigation?: Array<Record<string, unknown>>; preview_delta?: Record<string, unknown>; target_rule?: string; action_cost_modifiers?: Record<string, number>; severity?: number; tags?: string[]; effect?: Record<string, unknown>; }
export interface ContentRole { id: string; name: string; origin?: string; icon?: string; icon_asset?: string; color?: string; meaning?: string; team_role?: string; play_style?: string; solo_rule?: string; starting_hint?: string; upgrade_ids?: string[]; start_site_id?: string; summary?: string; ability?: { name: string; action?: string; description?: string; ap_cost?: number; max_hops?: number; }; }
export interface DomainMeta { name: string; short_name: string; color_token?: string; }
export interface Region { id: string; name: string; site_ids: string[]; label_position?: { x: number; y: number }; hull_points?: Array<{ x: number; y: number }>; visual_token?: string; description?: string; content_review_status?: string; }
export interface Scenario { id: string; name: string; description?: string; recommended_minutes?: string | number; max_rounds?: number; recommended_players?: number[]; victory_brief?: string; failure_brief?: string; scenario_rule?: { description?: string; trigger?: string; effect?: { type?: string; amount?: number }; additional_effects?: Array<{ trigger?: string; effect?: { type?: string; amount?: number } }>; }; }
export interface Meta { schema_version: number; mode: string; domains: string[]; domain_meta: Record<string, DomainMeta>; terminology?: Record<string, unknown>; regions?: Region[]; scenarios?: Scenario[]; roles: ContentRole[]; sites: Site[]; cards: ContentCard[]; action_cards?: Array<Record<string, unknown>>; events: ContentEvent[]; tasks: Task[]; projects?: ProjectState[]; objectives?: ObjectiveState[]; facets?: Array<Record<string, unknown>>; difficulty: Array<{ id: string; name?: string; description?: string; max_rounds?: number; restoration_resource?: number; event_weight?: number; node_damage_base?: number; event_preview_count?: number; recommended_experience?: string; solo_ap_bonus?: number }>; effective_rules_preview?: Record<string, Record<string, number | string>>; }
export type RoomSeat = components['schemas']['RoomSeat'];
export type Room = components['schemas']['RoomPublic'] & { play_mode: PlayMode; seats: RoomSeat[]; session_id?: string | null; };
export type RoomCredentials = components['schemas']['RoomCredentials'];
export type ArchiveSummary = Omit<components['schemas']['ArchiveSummary'], 'players'> & { players: components['schemas']['ArchivePlayer'][]; };
