import type { GuestSession } from "./types";

const KEY = "crew-mission-room-v1";
type SavedRoom = { code: string; player_id: string };

export function readRoomSession(guest: GuestSession | null): string | null {
  if (!guest || typeof window === "undefined") return null;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "null") as SavedRoom | null;
    return saved?.player_id === guest.player_id && /^[A-Z0-9]{6}$/.test(saved.code)
      ? saved.code : null;
  } catch { return null; }
}

export function rememberRoom(guest: GuestSession, code: string) {
  if (typeof window === "undefined" || !/^[A-Z0-9]{6}$/.test(code)) return;
  try { localStorage.setItem(KEY, JSON.stringify({ code, player_id: guest.player_id })); }
  catch { /* The current match remains usable when browser storage is unavailable. */ }
}

export function forgetRoom(code?: string) {
  if (typeof window === "undefined") return;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "null") as SavedRoom | null;
    if (!code || saved?.code === code) localStorage.removeItem(KEY);
  } catch { /* A damaged or unavailable storage entry cannot be resumed. */ }
}
