// Optional real-stack probe. Never prints or persists guest tokens.
import WebSocket from "ws";
import { setTimeout as delay } from "node:timers/promises";
import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const base = process.env.CREW_API_URL || "http://127.0.0.1:8000";
const seconds = Number(process.env.CREW_LOAD_SECONDS || 180);
const clients = [],
  latencies = [],
  errors = [],
  samples = [];
let code = "",
  timer,
  sampleTimer;
async function request(path, body, token) {
  const response = await fetch(base + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Guest " + token } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(path + " HTTP " + response.status);
  return response.status === 204 ? null : response.json();
}
function resources() {
  const output = execFileSync("ps", ["-Ao", "rss,pcpu,args"], {
    encoding: "utf8",
  });
  const rows = output
    .split("\n")
    .filter(
      (line) =>
        /daphne|manage.py run_game_worker/.test(line) &&
        !line.includes("load-probe"),
    );
  return {
    elapsed_ms: Date.now() - began,
    processes: rows.map((line) => {
      const [rss, cpu, ...command] = line.trim().split(/\s+/);
      return {
        rss_kb: Number(rss),
        cpu_percent: Number(cpu),
        kind: command.join(" ").includes("daphne") ? "api" : "clock",
      };
    }),
  };
}
const began = Date.now();
try {
  for (let i = 0; i < 10; i++) {
    const guest = await request("/api/v1/guests/", {
      nickname: "Load" + i + Date.now().toString().slice(-5),
    });
    if (i === 0)
      code = (await request("/api/v1/rooms/", { max_players: 10 }, guest.token))
        .code;
    else await request("/api/v1/rooms/join/", { code }, guest.token);
    const c = { guest, socket: null, snapshots: 0, moves: 0, snapshot: null };
    clients.push(c);
    await new Promise((resolve, reject) => {
      const socket = new WebSocket(
        base.replace(/^http/, "ws") + "/ws/rooms/" + code + "/",
        { origin: "http://localhost:3000" },
      );
      c.socket = socket;
      socket.once("error", reject);
      socket.on("open", () =>
        socket.send(JSON.stringify({ type: "auth", token: guest.token })),
      );
      socket.on("message", (raw) => {
        const m = JSON.parse(raw);
        if (m.type === "auth.ok") resolve();
        if (m.type === "error") errors.push(m.code);
        if (m.type === "game.snapshot") {
          c.snapshots++;
          c.snapshot = m;
          if (m.phase !== "finished" && JSON.stringify(m).includes('"role"'))
            errors.push("ROLE_LEAK");
        }
        if (m.type === "player.moved" && m.player_id === guest.player_id) {
          c.moves++;
          if (latencies.length < 50000) latencies.push(Date.now() - m.seq);
        }
      });
    });
  }
  await request(
    "/api/v1/games/" + code + "/start/",
    {},
    clients[0].guest.token,
  );
  for (let i = 0; i < 100 && clients.some((c) => !c.snapshot); i++)
    await delay(100);
  if (clients.some((c) => !c.snapshot))
    throw new Error("Missing initial snapshot");
  const trafficStart = Date.now();
  let n = 0;
  timer = setInterval(() => {
    n++;
    for (const c of clients)
      if (c.socket.readyState === WebSocket.OPEN)
        c.socket.send(
          JSON.stringify({
            type: "player.move",
            seq: Date.now(),
            direction: { x: Math.floor(n / 20) % 2 ? 1 : -1, y: 0 },
          }),
        );
  }, 100);
  sampleTimer = setInterval(() => samples.push(resources()), 30000);
  samples.push(resources());
  for (let elapsed = 0; elapsed < seconds; elapsed += 30) {
    await delay(Math.min(30, seconds - elapsed) * 1000);
    process.stdout.write(
      "load probe " + Math.min(seconds, elapsed + 30) + "/" + seconds + "s\n",
    );
  }
  clearInterval(timer);
  clearInterval(sampleTimer);
  for (const c of clients)
    c.socket.send(
      JSON.stringify({
        type: "player.move",
        seq: Date.now() + 1,
        direction: { x: 0, y: 0 },
      }),
    );
  await delay(500);
  latencies.sort((a, b) => a - b);
  const report = {
    clients: 10,
    traffic_ms: Date.now() - trafficStart,
    commands_per_second: 100,
    snapshots: clients.map((c) => c.snapshots),
    local_move_events: clients.map((c) => c.moves),
    latency_p50_ms: latencies[Math.floor(latencies.length * 0.5)],
    latency_p95_ms: latencies[Math.floor(latencies.length * 0.95)],
    errors,
    samples,
  };
  writeFileSync(
    process.env.CREW_LOAD_OUTPUT || "test-results/load-probe.json",
    JSON.stringify(report, null, 2),
  );
  if (errors.length)
    throw new Error("Server errors: " + [...new Set(errors)].join(","));
  if (!latencies.length || report.latency_p95_ms > 1000)
    throw new Error("Movement delivery latency exceeded probe budget");
  console.log(
    JSON.stringify({
      clients: 10,
      p50_ms: report.latency_p50_ms,
      p95_ms: report.latency_p95_ms,
      errors: errors.length,
    }),
  );
} finally {
  clearInterval(timer);
  clearInterval(sampleTimer);
  for (const c of clients) {
    c.socket?.close();
    if (code)
      await request(
        "/api/v1/rooms/" + code + "/leave/",
        {},
        c.guest.token,
      ).catch(() => {});
  }
}
