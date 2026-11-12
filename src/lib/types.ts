export type RoomStatus = "waiting" | "playing" | "meeting" | "finished";

export interface GuestSession {
  player_id: string;
  nickname: string;
  token: string;
}
export interface RoomPlayer {
  id: string;
  nickname: string;
  is_host: boolean;
  is_connected: boolean;
}
export interface Room {
  id: string;
  code: string;
  status: RoomStatus;
  min_players: number;
  max_players: number;
  host_player_id: string;
  players: RoomPlayer[];
  created_at: string;
}
export interface ApiErrorPayload { detail?: string; [key: string]: unknown; }
