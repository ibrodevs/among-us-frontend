export type Task = {
  id: string;
  task_type: "wires" | "sequence" | "upload";
  task_point: string;
  is_completed: boolean;
  started_at: string | null;
  challenge: number[];
  x: number;
  y: number;
  seconds: number;
};
export type OwnState = {
  type: "game.self";
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
  x: number;
  y: number;
  alive: boolean;
};
export type MeetingResult = {
  ejected_player_id: string | null;
  counts: Record<string, number>;
  next_phase: string;
};
export type Snapshot = {
  type: "game.snapshot";
  protocol_version: 1;
  game_id: string;
  state_version: number;
  server_time: string;
  phase: "playing" | "meeting" | "finished";
  players: LivePlayer[];
  bodies: { id: string; player_id: string; x: number; y: number }[];
  tasks_completed: number;
  tasks_total: number;
  last_meeting_result: MeetingResult | null;
  meeting: null | {
    id: string;
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
