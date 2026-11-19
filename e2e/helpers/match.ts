import { expect, type Browser, type APIRequestContext } from "@playwright/test";
import type { Client } from "./station";
export async function match(
  browser: Browser,
  request: APIRequestContext,
  settings: Record<string, unknown> = {},
) {
  const api = "http://127.0.0.1:8000",
    guests: { token: string; nickname: string; player_id: string }[] = [],
    clients: Client[] = [];
  let code = "";
  const post = async (
    url: string,
    data: unknown,
    token?: string,
    method = "POST",
  ) => {
    let response = await request.fetch(api + url, {
      method,
      headers: token ? { Authorization: "Guest " + token } : {},
      data,
    });
    if (response.status() === 429) {
      await new Promise((r) => setTimeout(r, 61000));
      response = await request.fetch(api + url, {
        method,
        headers: token ? { Authorization: "Guest " + token } : {},
        data,
      });
    }
    expect(response.ok(), url + " HTTP " + response.status()).toBeTruthy();
    return response.json();
  };
  for (let i = 0; i < 4; i++) {
    const g = await post("/api/v1/guests/", {
      nickname: "Flow" + i + Date.now().toString().slice(-5),
    });
    guests.push(g);
    if (!code)
      code = (
        await post(
          "/api/v1/rooms/",
          { max_players: 4, impostor_count: 1 },
          g.token,
        )
      ).code;
    else await post("/api/v1/rooms/join/", { code }, g.token);
  }
  await post(
    `/api/v1/rooms/${code}/settings/`,
    {
      map_version: 2,
      impostor_count: 1,
      discussion_seconds: 10,
      voting_seconds: 15,
      ...settings,
    },
    guests[0].token,
    "PATCH",
  );
  for (const guest of guests)
    await post(`/api/v1/rooms/${code}/ready/`, { is_ready: true }, guest.token, "PATCH");
  await post(`/api/v1/games/${code}/start/`, {}, guests[0].token);
  for (const guest of guests) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
    });
    await context.addInitScript((g) => {
      if (location.origin !== "null")
        localStorage.setItem("crew-mission-guest-v1", JSON.stringify(g));
    }, guest);
    const page = await context.newPage();
    const c: Client = {
      page,
      context,
      own: null,
      snapshot: null,
      id: guest.player_id,
      errors: [],
    };
    clients.push(c);
    page.on("pageerror", (e) => c.errors.push(e.message));
    page.on("websocket", (ws) =>
      ws.on("framereceived", (f) => {
        const m = JSON.parse(String(f.payload));
        if (m.type === "game.self") c.own = m;
        if (m.type === "game.snapshot") c.snapshot = m;
      }),
    );
    await page.goto(`/game/${code}`);
    await expect.poll(() => c.own?.map_version).toBe(2);
  }
  const close = async () => {
    for (const c of clients) {
      expect(c.errors).toEqual([]);
      await c.context.close();
    }
    for (const g of guests)
      await request.post(`${api}/api/v1/rooms/${code}/leave/`, {
        headers: { Authorization: "Guest " + g.token },
      });
  };
  return { clients, code, guests, close };
}
