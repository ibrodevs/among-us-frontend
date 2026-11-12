import { gameApi } from "@/lib/api";
import type { GuestSession } from "@/lib/types";

const KEY = "crew-mission-guest-v1";
export function readGuest(): GuestSession | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || "null") as GuestSession | null;
    return value?.token && value.player_id && value.nickname ? value : null;
  } catch { return null; }
}
export async function ensureGuest(nickname: string): Promise<GuestSession> {
  const normalized = nickname.trim();
  if (normalized.length < 2 || normalized.length > 16) throw new Error("Имя должно содержать 2–16 символов");
  const existing = readGuest();
  if (existing?.nickname === normalized) return existing;
  const guest = await gameApi.createGuest(normalized);
  localStorage.setItem(KEY, JSON.stringify(guest));
  return guest;
}
