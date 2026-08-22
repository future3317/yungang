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
export type GameState = Omit<components['schemas']['GameStateResponse'], 'players' | 'sites' | 'tasks' | 'shared' | 'action_options' | 'routes' | 'projects' | 'objectives' | 'market' | 'decks'> & { players: Record<string, Player>; sites: Record<string, Site>; tasks: Record<string, Task>; shared: Shared; decks: Record<string, string[]>; market: string[]; action_options?: ActionOption[]; routes?: Record<string, RouteState>; projects?: Record<string, ProjectState>; objectives?: Record<string, ObjectiveState>; };

// Actions are a UI command model, not a second server state model.
export interface Action { type: ActionType; label?: string; description?: string; cost?: number; target_id?: string; target_site_id?: string; target_ids?: string[]; card_id?: string; recipient_id?: string; route_id?: string; upgrade_id?: string; skill?: string; request_id?: string; preview_delta?: Record<string, unknown>; requirements?: string[]; }

export interface TaskRequirement { key: string; label: string; current?: number; target?: number; complete: boolean; missing?: string[]; }
export type ContentCard = components['schemas']['CultureCardContract'] & { summary?: string; };
export type ContentEvent = components['schemas']['EventContract'] & { summary?: string; action_cost_modifiers?: Record<string, number>; mitigation?: Array<Record<string, unknown>>; };
export type ContentRole = Omit<components['schemas']['RoleContract'], 'ability' | 'icon_asset'> & { icon_asset?: string; summary?: string; ability: { name: string; action?: string; description?: string; ap_cost?: number; max_hops?: number; [key: string]: unknown; }; };
export type DomainMeta = components['schemas']['DomainMetaContract'];
export type Region = components['schemas']['RegionContract'] & { hull_points?: Array<{ x: number; y: number }>; label_position?: { x: number; y: number }; content_review_status?: string; };
export type Scenario = Omit<components['schemas']['ScenarioContract'], 'scenario_rule'> & { scenario_rule?: { description: string; trigger: string; effect: { type?: string; amount?: number }; additional_effects?: Array<{ trigger?: string; effect?: { type?: string; amount?: number } }>; } | null; };
export type Meta = Omit<components['schemas']['MetaResponse'], 'terminology' | 'domain_meta' | 'regions' | 'scenarios' | 'roles' | 'sites' | 'cards' | 'events' | 'tasks' | 'projects' | 'objectives' | 'difficulty'> & { terminology?: Partial<components['schemas']['TerminologyContract']>; domain_meta: Record<string, DomainMeta>; regions: Region[]; scenarios: Scenario[]; roles: ContentRole[]; sites: Site[]; cards: ContentCard[]; action_cards: components['schemas']['ActionCardContract'][]; events: ContentEvent[]; tasks: Task[]; projects: components['schemas']['ProjectContract'][]; objectives: components['schemas']['ObjectiveContract'][]; facets: components['schemas']['SiteFacetContract'][]; difficulty: components['schemas']['DifficultyContract'][]; effective_rules_preview?: Record<string, Record<string, unknown>>; };
export type RoomSeat = components['schemas']['RoomSeat'];
export type Room = components['schemas']['RoomPublic'] & { play_mode: PlayMode; seats: RoomSeat[]; session_id?: string | null; };
export type RoomCredentials = components['schemas']['RoomCredentials'];
export type ArchiveSummary = Omit<components['schemas']['ArchiveSummary'], 'players'> & { players: components['schemas']['ArchivePlayer'][]; };
