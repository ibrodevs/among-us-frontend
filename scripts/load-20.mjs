// Real 20-player gameplay soak. No DB fixtures, forged positions or saved credentials.
import WebSocket from "ws";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
const api = process.env.CREW_API_URL || "http://127.0.0.1:8000",
  seconds = Number(process.env.CREW_SOAK_SECONDS || 1800),
  out = process.env.CREW_SOAK_OUTPUT || "docs/capacity-20/soak-20.json";
const map = JSON.parse(
    readFileSync("src/features/game/engine/asterion.json", "utf8"),
  ),
  step = 20,
  W = Math.ceil(map.width / step),
  H = Math.ceil(map.height / step),
  free = new Uint8Array(W * H),
  trees = new Map(),
  repairers = new Map();
for (let y = 1; y < H - 1; y++)
  for (let x = 1; x < W - 1; x++) {
    const xx = x * step + 10,
      yy = y * step + 10;
    free[y * W + x] = !map.walls.some(
      (r) =>
        xx - 16 < r.x + r.width &&
        xx + 16 > r.x &&
        yy - 16 < r.y + r.height &&
        yy + 16 > r.y,
    );
  }
const guests = [],
  clients = [],
  errors = [],
  rejections = {},
  counts = {
    tasks: 0,
    vents: 0,
    ventTravel: 0,
    sabotages: 0,
    repairs: 0,
    kills: 0,
    reports: 0,
    meetings: 0,
    votes: 0,
    finishes: 0,
    reconnects: 0,
  },
  rtts = [],
  acks = [],
  samples = [];
let room = "",
  loop,
  heartbeat,
  epoch = 0,
  roundEpoch = 0,
  round = 0,
  reconnecting = false,
  saboIndex = 0,
  lastSabotage = 0,
  lastMeeting = 0,
  meetingsSeen = new Set(),
  finishedSeen = new Set();
const clock = () => performance.now(),
  near = (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
  percentile = (a, p) =>
    a.length
      ? a.slice().sort((x, y) => x - y)[Math.floor((a.length - 1) * p)]
      : null;
async function until(fn, label, ms = 30000) {
  const t = clock();
  while (!fn()) {
    if (clock() - t > ms) throw new Error("Timeout: " + label);
    await sleep(40);
  }
}
async function request(path, data, token, method = "POST", expected = 200) {
  for (let n = 0; n < 4; n++) {
    const res = await fetch(api + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: "Guest " + token } : {}),
      },
      body: JSON.stringify(data),
    });
    if (res.status === 429) {
      console.log("Waiting for the real guest throttle");
      await sleep(61000);
      continue;
    }
    if (res.status !== expected) throw new Error(path + " HTTP " + res.status);
    return res.status === 204 ? null : res.json();
  }
  throw new Error("Guest throttle persisted");
}
function send(c, data) {
  if (c.ws?.readyState !== WebSocket.OPEN) return false;
  c.ws.send(JSON.stringify(data));
  return true;
}
function move(c, d) {
  const key = d.x + "," + d.y;
  if (key === "0,0" && c.direction === key) return;
  c.seq = Math.max(c.seq + 1, Date.now());
  c.pending.set(c.seq, clock());
  while (c.pending.size > 100) c.pending.delete(c.pending.keys().next().value);
  send(c, { type: "player.move", seq: c.seq, direction: d });
  c.direction = key;
}
async function connect(c) {
  c.auth = false;
  const ws = new WebSocket(
    api.replace(/^http/, "ws") + "/ws/rooms/" + room + "/",
    { origin: "http://localhost:3000" },
  );
  c.ws = ws;
  ws.on("open", () =>
    send(c, { type: "auth", token: c.g.token, protocol_version: 2 }),
  );
  ws.on("error", (e) => errors.push({ type: "socket", detail: e.message }));
  ws.on("close", () => {
    c.auth = false;
    if (!c.plannedClose && !reconnecting)
      errors.push({ type: "unexpected-disconnect", client: c.index });
  });
  ws.on("message", (raw) => {
    const m = JSON.parse(raw);
    c.bytes += raw.length;
    if (m.type === "auth.ok") c.auth = true;
    if (m.type === "pong" && c.pingAt) {
      rtts.push(clock() - c.pingAt);
      c.pingAt = 0;
    }
    if (m.type === "error") {
      rejections[m.code] = (rejections[m.code] || 0) + 1;
      if (
        ![
          "COOLDOWN",
          "ALREADY_DONE",
          "INVALID_PHASE",
          "OUT_OF_RANGE",
          "FORBIDDEN",
          "TOO_EARLY",
          "RATE_LIMITED",
          "STALE_SEQ",
          "CRITICAL_ACTIVE",
        ].includes(m.code)
      )
        errors.push({ type: "rule", code: m.code });
    }
    if (m.type === "game.snapshot") {
      if (
        c.snapshot &&
        m.game_id === c.snapshot.game_id &&
        m.state_version < c.snapshot.state_version
      )
        errors.push({ type: "version-regression" });
      c.snapshot = m;
      c.snapshots++;
      if (m.phase !== "finished" && m.players.some((p) => "role" in p))
        errors.push({ type: "role-leak" });
      if (m.roster.some((p) => !guests.some((g) => g.player_id === p.id)))
        errors.push({ type: "cross-room-leak" });
    }
    if (m.type === "game.self") {
      if (c.own) {
        counts.tasks += m.tasks.filter(
          (t) =>
            t.is_completed &&
            !c.own.tasks.find((q) => q.id === t.id)?.is_completed,
        ).length;
        if (m.is_in_vent && !c.own.is_in_vent) counts.vents++;
        if (!m.alive && c.own.alive) counts.kills++;
      }
      c.own = m;
      const at = c.pending.get(m.last_move_seq);
      if (at !== undefined) {
        acks.push(clock() - at);
        c.pending.delete(m.last_move_seq);
      }
    }
  });
  await until(() => c.auth, "auth");
}
function treeFor(target) {
  const gx = Math.floor(target.x / step),
    gy = Math.floor(target.y / step),
    key = gx + "," + gy;
  if (trees.has(key)) return trees.get(key);
  let goal = -1,
    dist = Infinity;
  for (let yy = gy - 4; yy <= gy + 4; yy++)
    for (let xx = gx - 4; xx <= gx + 4; xx++) {
      const k = yy * W + xx,
        d = Math.hypot(xx * step + 10 - target.x, yy * step + 10 - target.y);
      if (free[k] && d < dist) {
        goal = k;
        dist = d;
      }
    }
  if (goal < 0) return null;
  const ds = new Int32Array(W * H);
  ds.fill(-1);
  const queue = new Int32Array(W * H);
  let head = 0,
    tail = 1;
  queue[0] = goal;
  ds[goal] = 0;
  while (head < tail) {
    const n = queue[head++];
    for (const q of [n - 1, n + 1, n - W, n + W])
      if (free[q] && ds[q] < 0) {
        ds[q] = ds[n] + 1;
        queue[tail++] = q;
      }
  }
  trees.set(key, ds);
  if (trees.size > 100) trees.delete(trees.keys().next().value);
  return ds;
}
function walk(c, target, radius = 65) {
  if (near(c.own, target) <= radius) {
    move(c, { x: 0, y: 0 });
    return true;
  }
  const ds = treeFor(target);
  if (!ds) return false;
  let n = Math.floor(c.own.y / step) * W + Math.floor(c.own.x / step);
  let recovery = false;
  if (ds[n] < 0) {
    const cx = Math.floor(c.own.x / step),
      cy = Math.floor(c.own.y / step);
    let distance = Infinity;
    for (let y = cy - 4; y <= cy + 4; y++)
      for (let x = cx - 4; x <= cx + 4; x++) {
        const q = y * W + x,
          d = Math.hypot(x * step + 10 - c.own.x, y * step + 10 - c.own.y);
        if (ds[q] >= 0 && d < distance) {
          n = q;
          distance = d;
          recovery = true;
        }
      }
    if (!recovery) return false;
  }
  let best = n,
    delta = 0;
  for (let i = 0; !recovery && i < 4; i++) {
    const next = [best - 1, best + 1, best - W, best + W].find(
      (q) => ds[q] >= 0 && ds[q] < ds[best],
    );
    if (next === undefined) break;
    if (i && next - best !== delta) break;
    delta = next - best;
    best = next;
  }
  const targetX = (best % W) * step + 10,
    targetY = Math.floor(best / W) * step + 10,
    dx = targetX - c.own.x,
    dy = targetY - c.own.y;
  const safe = (axis, delta) => {
    for (let t = 0; t <= 1; t += 0.1) {
      const x = c.own.x + (axis === "x" ? delta * t : 0),
        y = c.own.y + (axis === "y" ? delta * t : 0);
      if (
        map.walls.some(
          (r) =>
            x - 14 < r.x + r.width &&
            x + 14 > r.x &&
            y - 14 < r.y + r.height &&
            y + 14 > r.y,
        )
      )
        return false;
    }
    return true;
  };
  const axes =
    Math.abs(dx) > Math.abs(dy)
      ? [
          ["x", dx],
          ["y", dy],
        ]
      : [
          ["y", dy],
          ["x", dx],
        ];
  const axis = axes.find(
    ([key, d]) =>
      Math.abs(d) > 2 && safe(key, Math.sign(d) * Math.min(44, Math.abs(d))),
  );
  if (axis)
    move(c, {
      x: axis[0] === "x" ? Math.max(-1, Math.min(1, axis[1] / 44)) : 0,
      y: axis[0] === "y" ? Math.max(-1, Math.min(1, axis[1] / 44)) : 0,
    });
  else move(c, { x: 0, y: 0 });
  return false;
}
function solve(t) {
  const s = t.challenge;
  if (["upload", "sample_analysis"].includes(t.task_type)) return [s[0]];
  if (t.task_type === "medical_scan") return [s[0], 3];
  if (t.task_type === "oxygen_filters") return [3, 3, 3, ...s];
  if (t.task_type === "coolant_valves") return s.flatMap((n) => [n, n, n]);
  return s;
}
function bot(c, elapsed) {
  if (!c.auth || !c.own || !c.snapshot || clock() < c.nextAction) return;
  const o = c.own,
    s = c.snapshot;
  if (s.phase === "finished") {
    move(c, { x: 0, y: 0 });
    return;
  }
  if (s.phase === "meeting") {
    move(c, { x: 0, y: 0 });
    if (!meetingsSeen.has(s.meeting.id)) {
      meetingsSeen.add(s.meeting.id);
      counts.meetings++;
    }
    if (
      s.meeting.stage === "voting" &&
      o.alive &&
      !o.has_voted &&
      c.voted !== s.meeting.id
    ) {
      const targets = clients.filter(
        (q) => q.own?.role === "impostor" && q.own.alive,
      );
      send(c, {
        type: "vote.cast",
        target_player_id: targets[0]?.g.player_id || null,
      });
      c.voted = s.meeting.id;
      counts.votes++;
      c.nextAction = clock() + 400;
    }
    return;
  }
  const body = s.bodies.find((b) => near(o, b) < 105);
  if (body && o.alive && counts.repairs) {
    move(c, { x: 0, y: 0 });
    send(c, { type: "body.report", body_id: body.id });
    counts.reports++;
    c.nextAction = clock() + 1000;
    return;
  }
  // The three impostor bots coordinate only through the test harness; aliases
  // submitted to kills still come exclusively from each filtered public view.
  if (o.role === "impostor" && o.alive) {
    const target = s.players.find(
      (p) =>
        p.id !== c.g.player_id &&
        p.alive &&
        near(o, p) < 85 &&
        clients.some(
          (q) => q.own.role === "crew" && q.g.nickname === p.nickname,
        ),
    );
    if (
      target &&
      counts.repairs &&
      Date.parse(o.kill_available_at || "") < Date.now()
    ) {
      send(c, { type: "player.kill", target_player_id: target.id });
      c.nextAction = clock() + 500;
      return;
    }
    if (o.is_in_vent) {
      move(c, { x: 0, y: 0 });
      if (
        clock() - c.ventAt > 1800 &&
        !c.ventTravelled &&
        o.vent_connections.length
      ) {
        send(c, { type: "vent.travel", vent_id: o.vent_connections[0].id });
        counts.ventTravel++;
        c.ventTravelled = true;
        c.nextAction = clock() + 1500;
        return;
      }
      if (clock() - c.ventAt > 4000) {
        send(c, { type: "vent.exit" });
        c.ventDone = true;
        c.nextAction = clock() + 500;
      }
      return;
    }
    if (!c.ventDone) {
      const vent = map.vents.slice().sort((a, b) => near(o, a) - near(o, b))[0];
      if (
        walk(c, vent, 65) &&
        (!o.vent_available_at || Date.parse(o.vent_available_at) < Date.now())
      ) {
        send(c, { type: "vent.enter", vent_id: vent.id });
        c.ventAt = clock();
        c.nextAction = clock() + 300;
      }
      return;
    }
  }
  if (
    process.env.CREW_SOAK_DEBUG &&
    c.index === 0 &&
    clock() - (c.debugAt || 0) > 5000
  ) {
    c.debugAt = clock();
    console.log(
      "DEBUG",
      JSON.stringify({
        phase: s.phase,
        ownPhase: o.phase,
        sabos: s.sabotages.map((x) => [x.kind, x.id]),
        repairers: [...repairers],
        repairs: counts.repairs,
        version: s.state_version,
        ownVersion: o.state_version,
      }),
    );
  }
  const light = s.sabotages.find(
    (q) => q.kind === "lights" || q.kind === "comms",
  );
  const crews = clients.filter((q) => q.own?.role === "crew" && q.own.alive);
  if (
    light &&
    o.role === "crew" &&
    o.alive &&
    crews
      .slice()
      .sort(
        (a, b) => near(a.own, light.panels[0]) - near(b.own, light.panels[0]),
      )[0] === c
  ) {
    const panel = light.panels[0];
    if (walk(c, panel, 70)) {
      const attempt = o.repair;
      if (process.env.CREW_SOAK_DEBUG)
        console.log(
          "REPAIR",
          c.index,
          light.kind,
          attempt,
          c.repairAt,
          clock(),
        );
      if (!attempt || attempt.sabotage_id !== light.id) {
        send(c, {
          type: "sabotage.repair.begin",
          sabotage_id: light.id,
          panel_id: panel.id,
        });
        c.repairAt = clock();
        c.nextAction = clock() + 400;
      } else if (clock() - c.repairAt > 2200) {
        send(c, {
          type: "sabotage.repair.complete",
          sabotage_id: light.id,
          panel_id: panel.id,
          solution: attempt.challenge,
        });
        counts.repairs++;
        c.nextAction = clock() + 1000;
      }
    }
    return;
  }
  if (
    elapsed > 65 &&
    counts.repairs > 0 &&
    o.alive &&
    !o.emergency_used &&
    !s.sabotages.some((q) => ["reactor", "oxygen"].includes(q.kind)) &&
    clock() - lastMeeting > 18000
  ) {
    if (walk(c, map.emergency, 65)) {
      send(c, { type: "meeting.call" });
      lastMeeting = clock();
      c.nextAction = clock() + 1000;
    }
    return;
  }
  if (o.role === "crew") {
    const task = o.tasks
      .filter((t) => !t.is_completed)
      .sort((a, b) => near(o, a) - near(o, b))[0];
    if (task && walk(c, task, 65)) {
      if (!task.started_at) {
        send(c, { type: "task.begin", task_id: task.id });
        c.nextAction = clock() + 400;
      } else if (
        Date.now() - Date.parse(task.started_at) >
        (task.seconds + 1) * 1000
      ) {
        send(c, {
          type: "task.complete",
          task_id: task.id,
          solution: solve(task),
        });
        c.nextAction = clock() + 500;
      }
    } else if (!task)
      walk(
        c,
        map.navigation.nodes[
          (c.index + Math.floor(elapsed / 12)) % map.navigation.nodes.length
        ],
      );
  } else
    walk(
      c,
      map.navigation.nodes[
        (c.index + Math.floor(elapsed / 12)) % map.navigation.nodes.length
      ],
    );
}
async function startRound() {
  round++;
  roundEpoch = clock();
  saboIndex = 0;
  lastSabotage = 0;
  lastMeeting = clock();
  room = (
    await request(
      "/api/v1/rooms/",
      { max_players: 20, impostor_count: 3 },
      guests[0].token,
      "POST",
      201,
    )
  ).code;
  for (const g of guests.slice(1))
    await request("/api/v1/rooms/join/", { code: room }, g.token);
  await request(
    `/api/v1/rooms/${room}/settings/`,
    {
      impostor_count: 3,
      discussion_seconds: 5,
      voting_seconds: 10,
      kill_cooldown: 10,
      critical_seconds: 45,
    },
    guests[0].token,
    "PATCH",
  );
  for (const [index, g] of guests.entries()) {
    let c = clients[index];
    if (!c) {
      c = { g, index, seq: 0, pending: new Map(), snapshots: 0, bytes: 0 };
      clients.push(c);
    }
    Object.assign(c, {
      own: null,
      snapshot: null,
      plannedClose: false,
      direction: "",
      nextAction: 0,
      ventDone: false,
      ventTravelled: false,
      voted: null,
    });
    await connect(c);
  }
  await request(`/api/v1/games/${room}/start/`, {}, guests[0].token);
  await until(() => clients.every((c) => c.own && c.snapshot), "round states");
  if (clients.filter((c) => c.own.role === "impostor").length !== 3)
    throw new Error("Wrong selected roles");
  console.log("Started 20-player round " + round);
}
async function closeRound() {
  reconnecting = true;
  for (const c of clients) {
    c.plannedClose = true;
    c.ws?.close();
  }
  for (const g of guests)
    await request(
      `/api/v1/rooms/${room}/leave/`,
      {},
      g.token,
      "POST",
      204,
    ).catch(() => {});
  reconnecting = false;
}
function sample() {
  let processes = [];
  try {
    processes = execFileSync("ps", ["-axo", "pid,%cpu,rss,command"], {
      encoding: "utf8",
    })
      .split("\n")
      .filter(
        (s) =>
          /venv\/bin\/daphne|manage.py run_game_worker/.test(s) &&
          !s.includes("load-20"),
      )
      .map((s) => s.trim());
  } catch {}
  let worker = null,
    server = null;
  try {
    worker = JSON.parse(readFileSync("/tmp/crewmate-x-worker.json", "utf8"));
    server = JSON.parse(readFileSync("/tmp/crewmate-x-api.json", "utf8"));
  } catch {}
  samples.push({
    elapsedSeconds: Math.round((clock() - epoch) / 1000),
    processes,
    worker,
    server,
  });
}
try {
  for (let i = 0; i < 20; i++)
    guests.push(
      await request(
        "/api/v1/guests/",
        { nickname: "Soak" + i + "_" + Date.now().toString().slice(-4) },
        null,
        "POST",
        201,
      ),
    );
  await startRound();
  epoch = clock();
  heartbeat = setInterval(() => {
    for (const c of clients) {
      c.pingAt = clock();
      send(c, { type: "ping" });
    }
  }, 3000);
  loop = setInterval(() => {
    const elapsed = (clock() - roundEpoch) / 1000;
    for (const c of clients) bot(c, elapsed);
    const imp = clients.find(
      (c) =>
        c.own?.role === "impostor" &&
        c.own.alive &&
        c.snapshot?.phase === "playing",
    );
    if (
      imp &&
      elapsed > 15 &&
      clock() - lastSabotage > 40000 &&
      (!imp.own.sabotage_available_at ||
        Date.parse(imp.own.sabotage_available_at) < Date.now())
    ) {
      const kind = ["lights", "comms", "oxygen"][saboIndex++ % 3];
      send(imp, { type: "sabotage.start", kind });
      lastSabotage = clock();
      counts.sabotages++;
    }
  }, 200);
  let nextReconnect = 90000,
    nextSample = 0;
  while (clock() - epoch < seconds * 1000) {
    await sleep(500);
    if (clock() - epoch > nextSample) {
      sample();
      nextSample += 15000;
      console.log(
        "Soak " +
          Math.round((clock() - epoch) / 1000) +
          "/" +
          seconds +
          "s; rounds " +
          round +
          "; tasks " +
          counts.tasks +
          "; votes " +
          counts.votes +
          "; repairs " +
          counts.repairs,
      );
    }
    if (clients.every((c) => c.snapshot?.phase === "finished")) {
      const id = clients[0].snapshot.game_id;
      if (!finishedSeen.has(id)) {
        finishedSeen.add(id);
        counts.finishes++;
      }
      clearInterval(loop);
      await closeRound();
      if (clock() - epoch < seconds * 1000) {
        await startRound();
        loop = setInterval(() => {
          for (const c of clients) bot(c, (clock() - roundEpoch) / 1000);
          const imp = clients.find(
            (c) =>
              c.own?.role === "impostor" &&
              c.own.alive &&
              c.snapshot?.phase === "playing",
          );
          if (
            imp &&
            clock() - roundEpoch > 15000 &&
            clock() - lastSabotage > 40000 &&
            (!imp.own.sabotage_available_at ||
              Date.parse(imp.own.sabotage_available_at) < Date.now())
          ) {
            send(imp, {
              type: "sabotage.start",
              kind: ["lights", "comms", "oxygen"][saboIndex++ % 3],
            });
            lastSabotage = clock();
            counts.sabotages++;
          }
        }, 200);
      }
    }
    if (
      clock() - epoch > nextReconnect &&
      clients[0].snapshot?.phase === "playing"
    ) {
      reconnecting = true;
      const c = clients[(counts.reconnects * 7) % 20],
        role = c.own.role,
        id = c.own.game_id;
      c.plannedClose = true;
      c.ws.close();
      await sleep(150);
      c.own = null;
      await connect(c);
      await until(() => c.own, "reconnect state");
      if (c.own.role !== role || c.own.game_id !== id)
        errors.push({ type: "reconnect-identity" });
      c.plannedClose = false;
      counts.reconnects++;
      reconnecting = false;
      nextReconnect += 90000;
    }
  }
  clearInterval(loop);
  sample();
  const report = {
    requestedSeconds: seconds,
    durationSeconds: (clock() - epoch) / 1000,
    playersPerMatch: 20,
    selectedImpostors: 3,
    rounds: round,
    counts,
    rtt: {
      samples: rtts.length,
      mean: rtts.reduce((a, b) => a + b, 0) / rtts.length,
      p95: percentile(rtts, 0.95),
      p99: percentile(rtts, 0.99),
    },
    ack: {
      samples: acks.length,
      p95: percentile(acks, 0.95),
      p99: percentile(acks, 0.99),
    },
    errors,
    rejections,
    bytes: clients.reduce((n, c) => n + c.bytes, 0),
    samples,
    environment:
      "Local development machine, real PostgreSQL/Redis/Daphne/clock and 20 active bots. Not a Northflank Free performance claim.",
  };
  mkdirSync(out.slice(0, out.lastIndexOf("/")), { recursive: true });
  writeFileSync(out, JSON.stringify(report, null, 2) + "\n");
  console.log(
    JSON.stringify({
      duration: report.durationSeconds,
      counts,
      rtt: report.rtt,
      errors: errors.length,
      rejections,
    }),
  );
  if (errors.length) throw new Error("Unexpected soak errors");
  for (const key of [
    "tasks",
    "vents",
    "ventTravel",
    "sabotages",
    "repairs",
    "kills",
    "reports",
    "meetings",
    "votes",
    "finishes",
    "reconnects",
  ])
    if (!counts[key]) throw new Error("Scenario did not exercise " + key);
} finally {
  clearInterval(loop);
  clearInterval(heartbeat);
  await closeRound().catch(() => {});
}
