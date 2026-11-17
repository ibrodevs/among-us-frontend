import { solveTask } from "./helpers/tasks";
import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { existsSync } from "node:fs";
import type { OwnState } from "../src/features/game/network/types";
import catalog from "../src/features/game/engine/task-catalog.json";
const fixture = `import os,sys,django
os.environ.setdefault('DJANGO_SETTINGS_MODULE','config.settings');django.setup()
from django.db import transaction
from rooms.models import Room
from game.models import GameSession
from game.services.simulation import public_snapshot
from game.services.transport import publish_update
from game.maps import game_map
with transaction.atomic():
 r=Room.objects.select_for_update().get(code=sys.argv[1]);g=GameSession.objects.select_for_update().get(room=r)
 p=g.player_states.get(player_id=sys.argv[2]);t=g.tasks.filter(player_id=p.player_id).order_by('task_point').first()
 point=next(q for q in game_map(g)['tasks'] if q['point']==t.task_point)
 p.x,p.y=point['x'],point['y'];p.direction_x=p.direction_y=0;p.save()
 t.task_type=sys.argv[3];t.stage=0;t.stage_total=1;t.is_completed=False;t.started_at=None;t.challenge=[];t.save()
 g.state_version+=1;g.save()
publish_update(r.code,public_snapshot(g),[],True)
`;
test("all 20 real task panels submit through WebSocket to Django validators", async ({
  browser,
  request,
}) => {
  test.skip(
    process.env.CREW_UI_FIXTURES !== "true",
    "Explicit disposable local database fixture opt-in required",
  );
  test.setTimeout(360000);
  const api = "http://127.0.0.1:8000",
    guests: { token: string; player_id: string; nickname: string }[] = [];
  let code = "";
  let page: Page | null = null;
  const post = async (url: string, body: unknown, token?: string) => {
    const response = await request.post(api + url, {
      headers: token ? { Authorization: "Guest " + token } : {},
      data: body,
    });
    expect(response.ok()).toBeTruthy();
    return response.json();
  };
  try {
    for (let i = 0; i < 4; i++) {
      const g = await post("/api/v1/guests/", {
        nickname: "Panel" + i + Date.now().toString().slice(-5),
      });
      guests.push(g);
      if (i === 0)
        code = (await post("/api/v1/rooms/", { max_players: 4 }, g.token)).code;
      else await post("/api/v1/rooms/join/", { code }, g.token);
    }
    await post(`/api/v1/games/${code}/start/`, {}, guests[0].token);
    let own: OwnState | null = null;
    let crewIndex = -1;
    for (let i = 0; i < 4; i++) {
      const context = await browser.newContext();
      await context.addInitScript((g) => {
        if (location.origin !== "null")
          localStorage.setItem("crew-mission-guest-v1", JSON.stringify(g));
      }, guests[i]);
      const candidate = await context.newPage();
      candidate.on("websocket", (ws) =>
        ws.on("framereceived", (f) => {
          const m = JSON.parse(String(f.payload));
          if (m.type === "game.self") own = m;
        }),
      );
      await candidate.goto(`/game/${code}`);
      await expect.poll(() => own?.role).toBeTruthy();
      if (own!.role === "crew") {
        page = candidate;
        crewIndex = i;
        break;
      }
      await context.close();
      own = null;
    }
    if (!page) throw new Error("Crew not found");
    const backend = path.resolve(
        process.env.CREW_BACKEND_DIR ||
          (existsSync("backend/manage.py") ? "backend" : "../among-us-backend"),
      ),
      python =
        process.env.CREW_BACKEND_PYTHON ||
        path.join(backend, "venv/bin/python");
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    for (const kind of Object.keys(catalog)) {
      execFileSync(
        python,
        ["-c", fixture, code, guests[crewIndex].player_id, kind],
        {
          cwd: backend,
          env: {
            ...process.env,
            DJANGO_DEBUG: "true",
            DJANGO_SECRET_KEY:
              process.env.DJANGO_SECRET_KEY || "local-test-key-only",
            DATABASE_URL:
              process.env.DATABASE_URL ||
              "postgres://Apple@127.0.0.1:55432/crew_mission",
            REDIS_URL: process.env.REDIS_URL || "redis://127.0.0.1:56379/0",
          },
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      await expect
        .poll(() =>
          own?.tasks.some((t) => t.task_type === kind && !t.is_completed),
        )
        .toBeTruthy();
      await page
        .getByRole("button", { name: "Использовать", exact: true })
        .click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expect
        .poll(
          () => own?.tasks.find((t) => t.task_type === kind)?.challenge.length,
        )
        .toBeGreaterThan(0);
      const task = own!.tasks.find(
        (t) => t.task_type === kind && !t.is_completed,
      )!;
      await solveTask(page, task);
      await expect
        .poll(() => own?.tasks.find((t) => t.id === task.id)?.is_completed)
        .toBe(true);
      await expect(dialog).not.toBeVisible();
    }
    expect(errors).toEqual([]);
  } finally {
    await page?.context().close();
    for (const guest of guests)
      if (code)
        await request.post(`${api}/api/v1/rooms/${code}/leave/`, {
          headers: { Authorization: "Guest " + guest.token },
        });
  }
});
