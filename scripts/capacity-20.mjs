// Real local-stack capacity check: 20 signed guests, sockets, browser and votes.
// Guest credentials remain in memory and are never included in the evidence.
import WebSocket from "ws";
import { chromium, expect } from "@playwright/test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
const api = process.env.CREW_API_URL || "http://127.0.0.1:8000",
  frontend = process.env.CREW_FRONTEND_URL || "http://localhost:3000";
const map = JSON.parse(
  readFileSync("src/features/game/engine/asterion.json", "utf8"),
);
const guests = [],
  clients = [],
  errors = [],
  latencies = [];
let code = "",
  browser,
  page;
const began = performance.now();
const out = "docs/capacity-20";
mkdirSync(out, { recursive: true });
async function request(path, data, token, method = "POST", expected = 200) {
  let response;
  for (let retry = 0; retry < 3; retry++) {
    response = await fetch(api + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: "Guest " + token } : {}),
      },
      body: JSON.stringify(data),
    });
    if (response.status !== 429) break;
    console.log("Waiting for the actual guest throttle window");
    await sleep(61000);
  }
  if (response.status !== expected)
    throw new Error(
      path + " HTTP " + response.status + " expected " + expected,
    );
  return response.status === 204 ? null : response.json();
}
async function until(check, label, timeout = 30000) {
  const start = performance.now();
  while (!check()) {
    if (performance.now() - start > timeout)
      throw new Error("Timeout: " + label);
    await sleep(40);
  }
}
function send(c, data) {
  if (c.ws.readyState === WebSocket.OPEN) c.ws.send(JSON.stringify(data));
}
function nextSeq(c) {
  c.seq = Math.max(c.seq, c.own?.last_move_seq || 0, Date.now()) + 1;
  return c.seq;
}
async function connect(c) {
  const ws = new WebSocket(
    api.replace(/^http/, "ws") + "/ws/rooms/" + code + "/",
    { origin: frontend },
  );
  c.ws = ws;
  c.auth = false;
  ws.on("error", (e) => errors.push({ code: "SOCKET", detail: e.message }));
  ws.on("open", () =>
    send(c, { type: "auth", token: c.g.token, protocol_version: 2 }),
  );
  ws.on("message", (raw) => {
    const m = JSON.parse(raw);
    if (m.type === "auth.ok") c.auth = true;
    if (m.type === "error") errors.push({ code: m.code });
    if (m.type === "game.snapshot") {
      c.snapshot = m;
      c.snapshots++;
      if (m.phase !== "finished" && m.players.some((p) => "role" in p))
        errors.push({ code: "ROLE_LEAK" });
      if (m.roster.some((p) => !guests.some((g) => g.player_id === p.id)))
        errors.push({ code: "ROSTER_LEAK" });
    }
    if (m.type === "game.self") {
      c.own = m;
      const sent = c.pending.get(m.last_move_seq);
      if (sent !== undefined) {
        latencies.push(performance.now() - sent);
        c.pending.delete(m.last_move_seq);
      }
    }
  });
  await until(() => c.auth, "socket auth");
}
let heartbeat;
try {
  for (let i = 0; i < 21; i++)
    guests.push(
      await request(
        "/api/v1/guests/",
        { nickname: "Crew20_" + i + "_" + Date.now().toString().slice(-4) },
        null,
        "POST",
        201,
      ),
    );
  code = (await request("/api/v1/rooms/", {}, guests[0].token, "POST", 201))
    .code;
  for (let i = 1; i < 20; i++)
    await request("/api/v1/rooms/join/", { code }, guests[i].token);
  const overflow = await request("/api/v1/rooms/join/", { code }, guests[20].token, "POST", 409);
  if (overflow.code !== "ROOM_FULL") throw new Error("The 21st guest did not receive ROOM_FULL");
  await request(
    `/api/v1/rooms/${code}/settings/`,
    { max_players: 21 },
    guests[0].token,
    "PATCH",
    400,
  );
  await request(
    `/api/v1/rooms/${code}/settings/`,
    { max_players: 19 },
    guests[0].token,
    "PATCH",
    400,
  );
  await request(
    `/api/v1/rooms/${code}/settings/`,
    {
      map_version: 2,
      impostor_count: 3,
      discussion_seconds: 5,
      voting_seconds: 10,
    },
    guests[0].token,
    "PATCH",
  );
  for (let i = 0; i < 20; i++)
    await request(
      `/api/v1/rooms/${code}/appearance/`,
      { color: i },
      guests[i].token,
      "PATCH",
    );
  for (const g of guests.slice(0, 20)) {
    const c = {
      g,
      ws: null,
      own: null,
      snapshot: null,
      snapshots: 0,
      pending: new Map(),
      seq: 0,
    };
    clients.push(c);
    await connect(c);
  }
  heartbeat = setInterval(
    () => clients.forEach((c) => send(c, { type: "ping" })),
    10000,
  );
  browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  await context.addInitScript((g) => {
    if (location.origin !== "null")
      localStorage.setItem("crew-mission-guest-v1", JSON.stringify(g));
  }, guests[0]);
  page = await context.newPage();
  page.on("pageerror", (e) =>
    errors.push({ code: "BROWSER", detail: e.message }),
  );
  await page.goto(frontend + "/room/" + code);
  await expect(
    page.getByText("Игроки: 20 / 20", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Цвет 20", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: out + "/lobby-20.png", fullPage: true });
  await page.getByRole("button", { name: "Начать игру", exact: true }).click();
  await until(
    () => clients.every((c) => c.own && c.snapshot),
    "all game views",
  );
  if (clients.filter((c) => c.own.role === "impostor").length !== 3)
    throw new Error("Wrong impostor count");
  if (new Set(clients.map((c) => c.own.color)).size !== 20)
    throw new Error("Colors not unique");
  if (new Set(clients.map((c) => c.own.x + "," + c.own.y)).size !== 20)
    throw new Error("Spawns not unique");
  if (
    clients.some(
      (c) =>
        c.snapshot.map_mode !== "full" ||
        c.snapshot.roster.length !== 20 ||
        c.own.tasks.length !== (c.own.role === "crew" ? 7 : 0),
    )
  )
    throw new Error("Missing roster or task assignments");
  const before = clients.map((c) => ({ x: c.own.x, y: c.own.y }));
  const caller = clients
    .slice()
    .sort(
      (a, b) =>
        Math.hypot(a.own.x - map.emergency.x, a.own.y - map.emergency.y) -
        Math.hypot(b.own.x - map.emergency.x, b.own.y - map.emergency.y),
    )[0];
  const free = (x, y) =>
    !map.walls.some(
      (r) =>
        x - 14 < r.x + r.width &&
        x + 14 > r.x &&
        y - 14 < r.y + r.height &&
        y + 14 > r.y,
    );
  const directions = clients.map((c) => {
    const candidates = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ].filter((d) =>
      [10, 30, 60].every((n) =>
        free(c.own.x + d.x * n, c.own.y + d.y * n) &&
        (c !== caller || Math.hypot(
          c.own.x + d.x * n - map.emergency.x,
          c.own.y + d.y * n - map.emergency.y,
        ) < 85),
      ),
    );
    const d = candidates[0];
    if (!d) throw new Error("No clear movement direction");
    const strength = c === caller ? 0.3 : 0.55;
    return { x: d.x * strength, y: d.y * strength };
  });
  for (let pulse = 0; pulse < 4; pulse++) {
    clients.forEach((c, i) => {
      const seq = nextSeq(c);
      c.pending.set(seq, performance.now());
      send(c, { type: "player.move", seq, direction: directions[i] });
    });
    await sleep(120);
  }
  for (const c of clients) {
    const seq = nextSeq(c);
    c.stopSeq = seq;
    c.pending.set(seq, performance.now());
    send(c, { type: "player.move", seq, direction: { x: 0, y: 0 } });
  }
  await until(
    () => clients.every((c) => c.own.last_move_seq === c.stopSeq),
    "twenty stop acknowledgements",
  );
  const moved = clients.filter(
    (c, i) => Math.hypot(c.own.x - before[i].x, c.own.y - before[i].y) > 5,
  ).length;
  if (moved !== 20) throw new Error("Movement did not advance for all twenty clients: " + moved);
  const c = clients[0],
    role = c.own.role,
    position = { x: c.own.x, y: c.own.y },
    gameId = c.own.game_id;
  c.ws.close();
  await sleep(150);
  c.own = null;
  await connect(c);
  await until(() => c.own, "reconnected private state");
  if (
    c.own.role !== role ||
    c.own.game_id !== gameId ||
    Math.hypot(c.own.x - position.x, c.own.y - position.y) > 1
  )
    throw new Error("Reconnect changed state");
  send(caller, { type: "meeting.call" });
  await until(
    () => clients.every((c) => c.snapshot.phase === "meeting"),
    "twenty meeting views",
  );
  await expect(
    page.getByRole("heading", { name: /Обсуждение|Голосование/ }),
  ).toBeVisible();
  await page.screenshot({ path: out + "/meeting-20.png", fullPage: true });
  send(caller, {
    type: "meeting.chat.send",
    text: "CREWMATE X — связь для 20 игроков",
  });
  await until(
    () =>
      clients.every((c) =>
        c.snapshot.meeting?.messages.some((m) =>
          m.text.includes("связь для 20"),
        ),
      ),
    "twenty chat views",
  );
  await until(
    () => clients.every((c) => c.snapshot.meeting?.stage === "voting"),
    "voting phase",
  );
  for (const c of clients)
    send(c, { type: "vote.cast", target_player_id: null });
  await until(
    () => clients.every((c) => c.snapshot.meeting?.result?.counts?.skip === 20),
    "twenty committed votes",
  );
  await until(
    () => clients.every((c) => c.snapshot.phase === "playing"),
    "resume after meeting",
  );
  if (new Set(clients.map((c) => c.own.x + "," + c.own.y)).size !== 20)
    throw new Error("Respawn overlap");
  if (errors.length)
    throw new Error("Observed errors: " + JSON.stringify(errors));
  latencies.sort((a, b) => a - b);
  const report = {
    players: 20,
    overflowRejected: true,
    uniqueColors: 20,
    uniqueSpawns: 20,
    impostors: 3,
    crewTasks: 119,
    movedClients: moved,
    reconnectPreserved: true,
    chatRecipients: 20,
    skipVotes: 20,
    resumed: true,
    errors,
    p50AckMs: Math.round(latencies[Math.floor(latencies.length * 0.5)]),
    p95AckMs: Math.round(latencies[Math.floor(latencies.length * 0.95)]),
    snapshots: clients.map((c) => c.snapshots),
    durationMs: Math.round(performance.now() - began),
    environment:
      "Local PostgreSQL/Redis/Daphne/clock; 20 real WebSockets plus one Chromium browser, not twenty physical devices",
  };
  writeFileSync(
    out + "/real-20-clients.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
} finally {
  clearInterval(heartbeat);
  await browser?.close();
  for (const c of clients) c.ws?.close();
  if (code)
    for (const g of guests.slice(0, 20))
      await request(
        `/api/v1/rooms/${code}/leave/`,
        {},
        g.token,
        "POST",
        204,
      ).catch(() => {});
}
