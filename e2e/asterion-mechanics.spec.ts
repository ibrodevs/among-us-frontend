import { test, expect } from "@playwright/test";
import { match } from "./helpers/match";
import { walk, type Client } from "./helpers/station";
import { solveTask } from "./helpers/tasks";
import station from "../src/features/game/engine/asterion.json";
import { writeFileSync } from "node:fs";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function readySabotage(imp: Client) {
  const wait =
    Date.parse(imp.own!.sabotage_available_at || "") - Date.now() + 250;
  if (wait > 0) await sleep(wait);
}
async function sabotage(imp: Client, kind: string, group?: string) {
  await readySabotage(imp);
  await imp.page.getByRole("button", { name: "Саботаж", exact: true }).click();
  await imp.page
    .getByRole("dialog")
    .getByRole("button", {
      name: group ? "Двери · " + group : kind,
      exact: true,
    })
    .click();
  await imp.page
    .getByRole("button", { name: "Закрыть карту", exact: true })
    .click();
  await expect
    .poll(() => imp.snapshot?.sabotages?.some((s) => s.kind === kind))
    .toBeTruthy();
}
async function solveNearbyTask(c: Client) {
  const task = c
    .own!.tasks.filter((t) => !t.is_completed)
    .sort(
      (a, b) =>
        Math.hypot(a.x - c.own!.x!, a.y - c.own!.y!) -
        Math.hypot(b.x - c.own!.x!, b.y - c.own!.y!),
    )[0];
  await walk(c, task);
  await c.page
    .getByRole("button", { name: "Использовать", exact: true })
    .click();
  await expect
    .poll(() => c.own?.tasks.find((t) => t.id === task.id)?.challenge.length)
    .toBeGreaterThan(0);
  await solveTask(
    c.page,
    c.own!.tasks.find((t) => t.id === task.id)!,
  );
  await expect
    .poll(
      () =>
        c.own?.tasks.find((t) => t.id === task.id)?.is_completed ||
        c.own?.tasks.find((t) => t.id === task.id)?.stage === 1,
    )
    .toBeTruthy();
  await expect(c.page.getByRole("dialog")).not.toBeVisible();
}

test("vents, lights, dual reactor, locked doors, ghost tasks, report, channels and parity on real clients", async ({
  browser,
  request,
}) => {
  test.setTimeout(600000);
  const m = await match(browser, request);
  const { clients } = m;
  try {
    const imp = clients.find((c) => c.own!.role === "impostor")!,
      crew = clients.filter((c) => c.own!.role === "crew"),
      a = crew[0],
      b = crew[1];
    const entry = station.vents.find((v) => v.room_id === "power")!;
    await Promise.all([walk(imp, entry), walk(a, entry)]);
    await imp.page.getByRole("button", { name: "Люк", exact: true }).click();
    await expect.poll(() => imp.own?.is_in_vent).toBe(true);
    const connections = imp.own!.vent_connections!;
    const exit =
      connections.find((v) => v.room_id === "cooling") || connections[0];
    const impName = imp.snapshot!.roster!.find(
      (p) => p.id === imp.id,
    )!.nickname;
    await expect
      .poll(() => a.snapshot?.players.some((p) => p.nickname === impName))
      .toBe(false);
    await sleep(1100);
    await imp.page
      .getByRole("button", {
        name: station.rooms.find((r) => r.id === exit.room_id)!.name,
        exact: true,
      })
      .click();
    await expect.poll(() => imp.own?.current_vent_id).toBe(exit.id);
    expect(a.snapshot?.players.some((p) => p.nickname === impName)).toBe(false);
    await imp.context.setOffline(true);
    await expect(
      imp.page.getByText("Переподключение…", { exact: false }),
    ).toBeVisible();
    await imp.context.setOffline(false);
    await expect(imp.page.getByText(/Онлайн ·/)).toBeVisible({
      timeout: 20000,
    });
    await imp.page.reload();
    await expect(
      imp.page.getByRole("heading", { name: "Сеть тоннелей" }),
    ).toBeVisible();
    expect(imp.own?.current_vent_id).toBe(exit.id);
    await sleep(1100);
    await imp.page
      .getByRole("button", { name: "Выйти из люка", exact: true })
      .click();
    await expect.poll(() => imp.own?.is_in_vent).toBe(false);
    await sabotage(imp, "lights");
    const lightPanel = station.sabotage_panels.find(
      (p) => p.type === "lights",
    )!;
    await walk(a, lightPanel);
    await a.page
      .getByRole("button", { name: "Ремонт · lights", exact: true })
      .click();
    await expect.poll(() => a.own?.repair?.kind).toBe("lights");
    const seed = a.own!.repair!.challenge;
    for (let i = 0; i < seed.length; i++)
      if (seed[i])
        await a.page
          .getByRole("button", { name: new RegExp(`Реле ${i + 1} ·`) })
          .click();
    await sleep(2200);
    await a.page
      .getByRole("button", { name: "Восстановить", exact: true })
      .click();
    await expect
      .poll(() => a.snapshot?.sabotages?.some((s) => s.kind === "lights"))
      .toBe(false);
    await sabotage(imp, "reactor");
    const panels = station.sabotage_panels.filter((p) => p.type === "reactor");
    await Promise.all([walk(a, panels[0]), walk(b, panels[1])]);
    for (const c of [a, b])
      await c.page
        .getByRole("button", { name: "Ремонт · reactor", exact: true })
        .click();
    for (const c of [a, b]) {
      await c.page.getByRole("button", {name:"Удерживать",exact:true}).scrollIntoViewIfNeeded();
      const r = await c.page
        .getByRole("button", { name: "Удерживать", exact: true })
        .boundingBox();
      if (!r) throw new Error("Reactor hold not visible");
      await c.page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
      await c.page.mouse.down();
    }
    await expect
      .poll(() => a.snapshot?.sabotages?.some((s) => s.kind === "reactor"), {
        timeout: 10000,
      })
      .toBe(false);
    for (const c of [a, b]) await c.page.mouse.up();
    const door = station.doors.find((d) => d.id === "power--security")!;
    await Promise.all([
      walk(a, {
        x: door.bounds.x - 65,
        y: door.bounds.y + door.bounds.height / 2,
      }),
      walk(imp, station.emergency),
      walk(b, station.emergency),
    ]);
    await sabotage(imp, "doors", door.group);
    await a.page.keyboard.down("ArrowRight");
    await sleep(1200);
    await a.page.keyboard.up("ArrowRight");
    expect(a.own!.x!).toBeLessThanOrEqual(door.bounds.x - 13);
    await expect
      .poll(() => a.snapshot?.doors?.find((d) => d.id === door.id)?.closed, {
        timeout: 15000,
      })
      .toBe(false);
    await a.page.keyboard.down("ArrowRight");
    await sleep(600);
    await a.page.keyboard.up("ArrowRight");
    await expect.poll(() => a.own!.x!).toBeGreaterThan(door.bounds.x + 20);
    await imp.page
      .getByRole("button", { name: "Устранить", exact: true })
      .click();
    await expect.poll(() => crew.filter((c) => !c.own?.alive).length).toBe(1);
    await expect(
      imp.page.getByRole("button", { name: /Устранить ·/ }),
    ).toBeDisabled();
    const ghost = crew.find((c) => !c.own?.alive)!;
    const completed = ghost.snapshot!.tasks_completed;
    await solveNearbyTask(ghost);
    await expect
      .poll(() => ghost.snapshot?.tasks_completed)
      .toBeGreaterThan(completed);
    const reporter = crew.find((c) => c.own?.alive && c !== a) || a;
    const body = reporter.snapshot?.bodies[0] || imp.snapshot!.bodies[0];
    await walk(reporter, body);
    await reporter.page
      .getByRole("button", { name: "Сообщить о теле", exact: true })
      .click();
    for (const c of clients)
      await expect.poll(() => c.snapshot?.phase).toBe("meeting");
    await ghost.page
      .getByLabel("Сообщение", { exact: true })
      .fill("Только призраки");
    await ghost.page
      .getByRole("button", { name: "Отправить", exact: true })
      .click();
    await expect(
      ghost.page.getByText("Только призраки", { exact: false }),
    ).toBeVisible();
    for (const c of clients.filter((c) => c.own?.alive))
      await expect(
        c.page.getByText("Только призраки", { exact: false }),
      ).not.toBeVisible();
    await expect
      .poll(() => imp.snapshot?.meeting?.stage, { timeout: 20000 })
      .toBe("voting");
    for (const c of clients.filter((c) => c.own?.alive))
      await c.page
        .getByRole("button", { name: "Пропустить", exact: true })
        .click();
    await expect
      .poll(() => imp.snapshot?.phase, { timeout: 15000 })
      .toBe("playing");
    const victim = crew.find((c) => c.own?.alive)!;
    await Promise.all([
      walk(imp, station.emergency),
      walk(victim, station.emergency),
    ]);
    const cooldown = Date.parse(imp.own!.kill_available_at!) - Date.now() + 250;
    if (cooldown > 0) await sleep(cooldown);
    await imp.page
      .getByRole("button", { name: "Устранить", exact: true })
      .click();
    for (const c of clients) {
      await expect.poll(() => c.snapshot?.phase).toBe("finished");
      expect(c.snapshot?.result?.winner).toBe("impostor");
      expect(c.snapshot?.result?.reason).toBe("parity");
    }
    writeFileSync(
      "test-results/v2-mechanics.json",
      JSON.stringify(
        {
          scenario: "no database fixtures or mocked requests",
          code: m.code,
          passed: [
            "vent graph and hidden travel",
            "offline and reload in vent",
            "lights repair",
            "two-player reactor hold",
            "10-second door collision",
            "kill cooldown UI",
            "ghost task",
            "report",
            "ghost chat isolation",
            "Skip",
            "parity",
          ],
        },
        null,
        2,
      ),
    );
  } finally {
    await m.close();
  }
});

test("crew complete all assigned tasks and critical oxygen expires after reconnect", async ({
  browser,
  request,
}) => {
  test.setTimeout(600000);
  const m = await match(browser, request, {
    common_tasks: 1,
    short_tasks: 3,
    long_tasks: 0,
  });
  try {
    const crew = m.clients.filter((c) => c.own!.role === "crew");
    await Promise.all(
      crew.map(async (c) => {
        while (
          c.own!.tasks.some((t) => !t.is_completed) &&
          c.snapshot?.phase === "playing"
        )
          await solveNearbyTask(c);
      }),
    );
    for (const c of m.clients) {
      await expect.poll(() => c.snapshot?.phase).toBe("finished");
      expect(c.snapshot?.result?.reason).toBe("tasks_completed");
    }
  } finally {
    await m.close();
  }
  const n = await match(browser, request, { critical_seconds: 45 });
  try {
    const imp = n.clients.find((c) => c.own!.role === "impostor")!;
    await sabotage(imp, "oxygen");
    const deadline = imp.snapshot!.sabotages![0].deadline_at;
    await imp.page.reload();
    await expect(
      imp.page.getByText("Авария: oxygen", { exact: false }),
    ).toBeVisible();
    expect(imp.snapshot!.sabotages![0].deadline_at).toBe(deadline);
    for (const c of n.clients) {
      await expect
        .poll(() => c.snapshot?.phase, { timeout: 55000 })
        .toBe("finished");
      expect(c.snapshot?.result?.reason).toBe("oxygen_timeout");
    }
  } finally {
    await n.close();
  }
});
