// Explicit local real-stack probe. No tokens are printed or persisted.
import WebSocket from "ws";
import { setTimeout as delay } from "node:timers/promises";
import { execFileSync, spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
import net from "node:net";
const base = process.env.CREW_API_URL || "http://127.0.0.1:8000",
  roomsCount = Number(process.env.CREW_LOAD_ROOMS || 3),
  seconds = Number(process.env.CREW_LOAD_SECONDS || 180),
  backend = path.resolve("../among-us-backend"),
  python =
    process.env.CREW_BACKEND_PYTHON || path.join(backend, "venv/bin/python");
const rooms = [],
  clients = [],
  errors = [],
  latencies = [],
  samples = [];
let loop,
  heartbeat,
  trafficStart = 0,
  sent = 0,
  restart = null;
async function request(url, data, token, method = "POST") {
  for (let n = 0; n < 3; n++) {
    const response = await fetch(base + url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: "Guest " + token } : {}),
      },
      body: JSON.stringify(data),
    });
    if (response.status === 429) {
      console.log("Guest throttle: waiting for the real 60-second window");
      await delay(61000);
      continue;
    }
    if (!response.ok) throw new Error(url + " HTTP " + response.status);
    return response.status === 204 ? null : response.json();
  }
  throw new Error("Rate limit did not clear");
}
async function connect(c) {
  await new Promise((resolve, reject) => {
    let authenticated = false;
    const socket = new WebSocket(
      base.replace(/^http/, "ws") + "/ws/rooms/" + c.room.code + "/",
      { origin: "http://localhost:3000" },
    );
    c.socket = socket;
    socket.on("open", () =>
      socket.send(
        JSON.stringify({
          type: "auth",
          token: c.guest.token,
          protocol_version: 2,
        }),
      ),
    );
    socket.once("error", reject);
    const timeout = setTimeout(
      () => reject(new Error("Socket auth timeout")),
      15000,
    );
    socket.on("message", (raw) => {
      const m = JSON.parse(raw);
      if (m.type === "auth.ok") {
        authenticated = true;
        clearTimeout(timeout);
        resolve();
      }
      if (m.type === "error") errors.push({ code: m.code, room: c.room.index });
      if (m.type === "game.snapshot") {
        if (c.gameId && c.gameId !== m.game_id)
          errors.push({ code: "GAME_ID_CHANGED" });
        c.gameId = m.game_id;
        c.snapshot = m;
        c.snapshots++;
        if (m.phase !== "finished" && m.players.some((p) => "role" in p))
          errors.push({ code: "ROLE_LEAK" });
        if (m.roster.some((p) => !c.room.ids.has(p.id)))
          errors.push({ code: "CROSS_ROOM_LEAK" });
      }
      if (m.type === "game.self") {
        if (c.role && c.role !== m.role) errors.push({ code: "ROLE_CHANGED" });
        c.role = m.role;
        c.own = m;
        if (m.last_move_seq > c.lastAck) {
          c.lastAck = m.last_move_seq;
          if (trafficStart && m.last_move_seq <= Date.now() + 10)
            latencies.push(Math.max(0, Date.now() - m.last_move_seq));
        }
      }
    });
    socket.on("close", () => {
      clearTimeout(timeout);
      if (!authenticated) reject(new Error("Socket closed before auth"));
    });
  });
}
function send(c, command) {
  if (c.socket?.readyState === WebSocket.OPEN)
    c.socket.send(JSON.stringify(command));
}
async function redisPing() {
  const began = performance.now(),
    u = new URL(process.env.REDIS_URL || "redis://127.0.0.1:56379/0");
  return new Promise((resolve) => {
    const socket = net.createConnection({
      host: u.hostname,
      port: Number(u.port) || 6379,
    });
    socket.setTimeout(2000);
    socket.on("connect", () => socket.write("*1\r\n$4\r\nPING\r\n"));
    socket.on("data", () => {
      resolve(performance.now() - began);
      socket.destroy();
    });
    socket.on("error", () => resolve(null));
    socket.on("timeout", () => {
      resolve(null);
      socket.destroy();
    });
  });
}
async function resources() {
  const output = execFileSync("ps", ["-Ao", "rss,pcpu,args"], {
    encoding: "utf8",
  });
  const processes = output
    .split("\n")
    .filter(
      (line) =>
        /venv\/bin\/daphne|manage.py run_game_worker/.test(line) &&
        !line.includes("load-v2"),
    )
    .map((line) => {
      const [rss, cpu, ...args] = line.trim().split(/\s+/);
      return {
        rssKb: Number(rss),
        cpuPercent: Number(cpu),
        kind: args.join(" ").includes("daphne") ? "api" : "clock",
      };
    });
  let postgresConnections = null;
  try {
    postgresConnections = Number(
      execFileSync(
        python,
        [
          "-c",
          "import os,psycopg; c=psycopg.connect(os.environ['DATABASE_URL']); print(c.execute(\"select count(*) from pg_stat_activity where datname=current_database()\").fetchone()[0]); c.close()",
        ],
        { cwd: backend, env: process.env, encoding: "utf8" },
      ).trim(),
    );
  } catch {}
  samples.push({
    elapsedMs: Date.now() - trafficStart,
    processes,
    postgresConnections,
    redisPingMs: await redisPing(),
  });
}
try {
  heartbeat = setInterval(() => {
    for (const c of clients) send(c, { type: "ping" });
  }, 15000);
  for (let r = 0; r < roomsCount; r++) {
    const room = { index: r, code: "", ids: new Set(), clients: [] };
    rooms.push(room);
    for (let i = 0; i < 10; i++) {
      const guest = await request("/api/v1/guests/", {
        nickname: "Stress" + r + i + Date.now().toString().slice(-5),
      });
      if (!room.code)
        room.code = (
          await request("/api/v1/rooms/", { max_players: 10 }, guest.token)
        ).code;
      else
        await request("/api/v1/rooms/join/", { code: room.code }, guest.token);
      room.ids.add(guest.player_id);
      const c = {
        guest,
        room,
        seq: 0,
        lastAck: 0,
        role: null,
        gameId: null,
        snapshot: null,
        own: null,
        snapshots: 0,
        socket: null,
      };
      clients.push(c);
      room.clients.push(c);
      await connect(c);
    }
    await request(
      `/api/v1/rooms/${room.code}/settings/`,
      { map_version: 2, critical_seconds: 45 },
      room.clients[0].guest.token,
      "PATCH",
    );
    await request(
      `/api/v1/games/${room.code}/start/`,
      {},
      room.clients[0].guest.token,
    );
  }
  for (let i = 0; i < 150 && clients.some((c) => !c.snapshot); i++)
    await delay(100);
  if (clients.some((c) => !c.snapshot))
    throw new Error("Missing initial world");
  trafficStart = Date.now();
  let n = 0;
  loop = setInterval(() => {
    n++;
    for (const c of clients)
      if (
        c.snapshot?.phase === "playing" &&
        c.socket?.readyState === WebSocket.OPEN
      ) {
        c.seq = Math.max(c.seq + 1, Date.now());
        send(c, {
          type: "player.move",
          seq: c.seq,
          direction: {
            x: Math.floor(n / 10) % 2 ? 1 : -1,
            y: Math.floor(n / 20) % 2 ? 0.3 : -0.3,
          },
        });
        sent++;
      }
  }, 100);
  await resources();
  for (let elapsed = 0; elapsed < seconds; elapsed += 5) {
    await delay(Math.min(5, seconds - elapsed) * 1000);
    const t = elapsed + 5;
    if (t === 15 || t === 50 || t === 85)
      for (const room of rooms) {
        const imp = room.clients.find((c) => c.role === "impostor");
        send(imp, {
          type: "sabotage.start",
          kind: t === 15 ? "lights" : t === 50 ? "comms" : "doors",
          ...(t === 85 ? { group: "engineering" } : {}),
        });
      }
    if (t === 60)
      for (const room of rooms) {
        const c = room.clients[0],
          role = c.role;
        c.socket.close();
        await delay(100);
        await connect(c);
        if (c.role !== role) throw new Error("Reconnect changed role");
      }
    if (t === 120 && seconds >= 170) {
      const imp = rooms[0].clients.find((c) => c.role === "impostor");
      send(imp, { type: "sabotage.start", kind: "oxygen" });
    }
    if (t === 130 && process.env.CREW_CLOCK_PID) {
      const pid = Number(process.env.CREW_CLOCK_PID),
        args = execFileSync("ps", ["-p", String(pid), "-o", "args="], {
          encoding: "utf8",
        });
      if (!args.includes("manage.py run_game_worker"))
        throw new Error("Explicit clock PID is not the expected local worker");
      const before = rooms[0].clients[0].snapshot.sabotages.find(
        (s) => s.kind === "oxygen",
      )?.deadline_at;
      process.kill(pid, "SIGTERM");
      await delay(2500);
      const worker = spawn(python, ["manage.py", "run_game_worker"], {
        cwd: backend,
        env: process.env,
        stdio: "ignore",
        detached: true,
      });
      worker.unref();
      await delay(1000);
      restart = {
        oldPid: pid,
        newPid: worker.pid,
        gapMs: 3500,
        deadlineBefore: before,
        deadlineAfter: rooms[0].clients[0].snapshot.sabotages.find(
          (s) => s.kind === "oxygen",
        )?.deadline_at,
      };
      if (restart.deadlineBefore !== restart.deadlineAfter)
        errors.push({ code: "DEADLINE_CHANGED_ON_RESTART" });
    }
    if (t % 15 === 0) {
      await resources();
      console.log(
        `v2 load ${t}/${seconds}s; ${clients.length} clients in ${rooms.length} rooms`,
      );
    }
  }
  clearInterval(loop);
  for (const c of clients)
    if (c.snapshot?.phase === "playing")
      send(c, {
        type: "player.move",
        seq: Date.now() + 1,
        direction: { x: 0, y: 0 },
      });
  await delay(500);
  latencies.sort((a, b) => a - b);
  const report = {
    environment:
      "Local development Mac, real PostgreSQL/Redis/Daphne/durable clock, raw WebSocket clients; ps CPU is process-lifetime percentage, not an instantaneous profiler",
    rooms: rooms.length,
    clients: clients.length,
    durationMs: Date.now() - trafficStart,
    sent,
    configuredCommandsPerSecond: clients.length * 10,
    p50Ms: latencies[Math.floor(latencies.length * 0.5)],
    p95Ms: latencies[Math.floor(latencies.length * 0.95)],
    snapshots: clients.map((c) => c.snapshots),
    errors,
    restart,
    samples,
    final: rooms.map((r) => ({
      index: r.index,
      phase: r.clients[0].snapshot?.phase,
      reason: r.clients[0].snapshot?.result?.reason,
    })),
  };
  writeFileSync(
    process.env.CREW_LOAD_OUTPUT || "test-results/load-v2.json",
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify({
      rooms: report.rooms,
      clients: report.clients,
      p50Ms: report.p50Ms,
      p95Ms: report.p95Ms,
      errors: errors.length,
      restart: !!restart,
    }),
  );
  if (errors.length) throw new Error("Load probe observed rule/privacy errors");
  if (!latencies.length) throw new Error("No movement acknowledgments");
} finally {
  clearInterval(loop);
  clearInterval(heartbeat);
  for (const c of clients) {
    c.socket?.close();
    await request(
      `/api/v1/rooms/${c.room.code}/leave/`,
      {},
      c.guest.token,
    ).catch(() => {});
  }
}
