import { API_BASE } from "@/lib/config";
import type { ApiErrorPayload, GuestSession, Room } from "@/lib/types";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function api<T>(
  path: string,
  options: { method?: string; token?: string; body?: unknown } = {},
): Promise<T> {
  const response = await fetch(API_BASE + path, {
    method: options.method || "GET",
    headers: {
      ...(options.body !== undefined
        ? { "Content-Type": "application/json" }
        : {}),
      ...(options.token ? { Authorization: "Guest " + options.token } : {}),
    },
    ...(options.body !== undefined
      ? { body: JSON.stringify(options.body) }
      : {}),
    cache: "no-store",
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as ApiErrorPayload;
    const detail =
      typeof data.detail === "string"
        ? data.detail
        : Object.values(data)
            .flat()
            .filter((v) => typeof v === "string")
            .join(" · ");
    throw new ApiError(
      response.status,
      detail || "Ошибка сервера: " + response.status,
    );
  }
  return response.status === 204
    ? (undefined as T)
    : (response.json() as Promise<T>);
}

type Appearance={players:{player_id:string;color:number|null}[]};
export const gameApi = {
 getAppearance:(token:string,code:string)=>api<Appearance>("/api/v1/rooms/"+encodeURIComponent(code)+"/appearance/",{token}),
 setAppearance:(token:string,code:string,color:number)=>api<Appearance>("/api/v1/rooms/"+encodeURIComponent(code)+"/appearance/",{token,method:"PATCH",body:{color}}),
  getSettings: (token: string, code: string) =>
    api<Record<string, number | string | boolean>>(
      "/api/v1/rooms/" + encodeURIComponent(code) + "/settings/",
      { token },
    ),
  saveSettings: (
    token: string,
    code: string,
    body: Record<string, number | string | boolean>,
  ) =>
    api<Record<string, number | string | boolean>>(
      "/api/v1/rooms/" + encodeURIComponent(code) + "/settings/",
      { token, method: "PATCH", body },
    ),
  createGuest: (nickname: string) =>
    api<GuestSession>("/api/v1/guests/", {
      method: "POST",
      body: { nickname },
    }),
  createRoom: (token: string, max_players = 20, impostor_count = 2) =>
    api<Room>("/api/v1/rooms/", {
      method: "POST",
      token,
      body: { max_players, impostor_count },
    }),
  joinRoom: (token: string, code: string) =>
    api<Room>("/api/v1/rooms/join/", { method: "POST", token, body: { code } }),
  getRoom: (token: string, code: string) =>
    api<Room>("/api/v1/rooms/" + encodeURIComponent(code) + "/", { token }),
  leaveRoom: (token: string, code: string) =>
    api<void>("/api/v1/rooms/" + encodeURIComponent(code) + "/leave/", {
      method: "POST",
      token,
    }),
  startGame: (token: string, code: string) =>
    api<Room>("/api/v1/games/" + encodeURIComponent(code) + "/start/", {
      method: "POST",
      token,
    }),
};
