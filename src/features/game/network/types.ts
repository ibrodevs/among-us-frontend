export type Task = {
  id: string;
  task_type: string;
  task_point: string;
  is_completed: boolean;
  started_at: string | null;
  challenge: number[];
  x: number;
  y: number;
  seconds: number;
  title?: string;
  stage?: number;
  stage_total?: number;
  category?: string;
};
export type OwnState = {
  type: "game.self";
  protocol_version?: 1 | 2;
  communications_down?: boolean;
  map_version?: number;
  x?: number;
  y?: number;
  color?: number;
  is_in_vent?: boolean;
  current_vent_id?: string;
  vent_available_at?: string;
  vent_connections?: { id: string; x: number; y: number; room_id: string }[];
  special_role?: string;
  ability_available_at?: string;
  ability_state?: Record<string, unknown>;
  sabotage_available_at?: string;
  repair?: {
    sabotage_id: string;
    panel_id: string;
    kind: string;
    challenge: number[];
  };
  observation?: {
    type: string;
    counts?: Record<string, number>;
    bodies?: Snapshot["bodies"];
    effects?: Snapshot["effects"];
    players?: {
      id: string;
      nickname?: string;
      x?: number;
      y?: number;
      color?: number;
      status?: string;
    }[];
    camera?: { id: string; x: number; y: number; radius: number };
  };
  game_id: string;
  state_version: number;
  role: "crew" | "impostor";
  alive: boolean;
  last_move_seq: number;
  kill_available_at: string | null;
  emergency_used: boolean;
  has_voted: boolean;
  tasks: Task[];
};
export type LivePlayer = {
  id: string;
  nickname: string;
  color?: number;
  ghost?: boolean;
  in_vent?: boolean;
  x: number;
  y: number;
  alive: boolean;
};
export type MeetingResult = {
  ejected_role?: string;
  presentation_until?: string;
  ejected_player_id: string | null;
  counts: Record<string, number>;
  next_phase: string;
};
export type Snapshot = {
  type: "game.snapshot";
  protocol_version: 1 | 2;
  map_version?: number;
  map_mode?: string;
  vision_radius?: number;
  terminal_activity?: string[];
  settings?: Record<string, unknown>;
  roster?: { id: string; nickname: string; color: number }[];
  doors?: {
    id: string;
    bounds: { x: number; y: number; width: number; height: number };
    closed: boolean;
  }[];
  sabotages?: {
    id: string;
    kind: string;
    deadline_at: string | null;
    panels: { id: string; room_id: string; x: number; y: number }[];
    repaired_panels: string[];
  }[];
  effects?: { id: string; type: string; x: number; y: number; at: string }[];
  game_id: string;
  state_version: number;
  server_time: string;
  started_at?: string;
  phase: "playing" | "meeting" | "finished";
  players: LivePlayer[];
  bodies: {
    id: string;
    player_id: string;
    x: number;
    y: number;
    color?: number;
  }[];
  tasks_completed: number;
  tasks_total: number;
  last_meeting_result: MeetingResult | null;
  meeting: null | {
    id: string;
    channel?: string;
    source?: "report" | "emergency";
    messages?: {
      id: string;
      player_id: string;
      nickname: string;
      text: string;
      ghost: boolean;
    }[];
    reporter_id: string;
    stage: "discussion" | "voting" | "result";
    deadline_at: string;
    votes_cast: number;
    alive_voters: number;
    result: MeetingResult;
  };
  result?: {
    winner: "crew" | "impostor";
    reason: string;
    players_with_roles: { id: string; nickname: string; role: string }[];
  };
};
export type Command =
  | { type: "vent.enter"; vent_id: string }
  | { type: "vent.travel"; vent_id: string }
  | { type: "vent.exit" }
  | { type: "sabotage.start"; kind: string; group?: string }
  | {
      type: "sabotage.repair.begin" | "sabotage.repair.complete";
      sabotage_id: string;
      panel_id: string;
      solution?: number[];
    }
  | { type: "meeting.chat.send"; text: string }
  | { type: "door.interact"; door_id: string }
  | { type: "terminal.use"; terminal_id: string; camera_id?: string }
  | { type: "player.ability.use"; target_player_id: string }
  | { type: "player.move"; seq: number; direction: { x: number; y: number } }
  | { type: "task.begin"; task_id: string }
  | { type: "task.complete"; task_id: string; solution: number[] }
  | { type: "player.kill"; target_player_id: string }
  | { type: "body.report"; body_id: string }
  | { type: "meeting.call" }
  | { type: "vote.cast"; target_player_id: string | null };
export type ConnectionStatus =
  "connecting" | "connected" | "reconnecting" | "unauthorized";
export function acceptSnapshot(
  current: Snapshot | null,
  next: Snapshot,
): Snapshot {
  return !current ||
    next.game_id !== current.game_id ||
    next.state_version >= current.state_version
    ? next
    : current;
}
