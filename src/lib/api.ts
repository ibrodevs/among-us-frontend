import { API_BASE } from "@/lib/config";
import type { ApiErrorPayload, GuestSession, Room } from "@/lib/types";

export class ApiError extends Error { constructor(public status: number, message: string) { super(message); this.name = "ApiError"; } }

async function api<T>(path: string, options: { method?: string; token?: string; body?: unknown } = {}): Promise<T> {
  const response = await fetch(API_BASE + path, {
    method: options.method || "GET",
    headers: {
      ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(options.token ? { Authorization: "Guest " + options.token } : {}),
    },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    cache: "no-store",
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as ApiErrorPayload;
    const detail = typeof data.detail === "string" ? data.detail : Object.values(data).flat().filter(v => typeof v === "string").join(" · ");
    throw new ApiError(response.status, detail || "Ошибка сервера: " + response.status);
  }
  return response.status === 204 ? (undefined as T) : (response.json() as Promise<T>);
}

export const gameApi = {
  createGuest: (nickname: string) => api<GuestSession>("/api/v1/guests/", { method: "POST", body: { nickname } }),
  createRoom: (token: string, max_players = 10) => api<Room>("/api/v1/rooms/", { method: "POST", token, body: { max_players } }),
  joinRoom: (token: string, code: string) => api<Room>("/api/v1/rooms/join/", { method: "POST", token, body: { code } }),
  getRoom: (token: string, code: string) => api<Room>("/api/v1/rooms/" + encodeURIComponent(code) + "/", { token }),
  leaveRoom: (token: string, code: string) => api<void>("/api/v1/rooms/" + encodeURIComponent(code) + "/leave/", { method: "POST", token }),
  startGame: (token: string, code: string) => api<Room>("/api/v1/games/" + encodeURIComponent(code) + "/start/", { method: "POST", token }),
};
