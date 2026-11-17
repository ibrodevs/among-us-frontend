import { test, expect } from "@playwright/test";
import { match } from "./helpers/match";
import { walk, type Client } from "./helpers/station";
import station from "../src/features/game/engine/asterion.json";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function start(imp: Client, kind: string) {
  const wait =
    Date.parse(imp.own!.sabotage_available_at || "") - Date.now() + 250;
  if (wait > 0) await sleep(wait);
  await imp.page.getByRole("button", { name: "Саботаж", exact: true }).click();
  await imp.page
    .getByRole("dialog")
    .getByRole("button", { name: kind, exact: true })
    .click();
  await imp.page
    .getByRole("button", { name: "Закрыть карту", exact: true })
    .click();
  await expect
    .poll(() => imp.snapshot?.sabotages?.some((s) => s.kind === kind))
    .toBe(true);
}
async function range(c: Client, name: string, value: number) {
  const input = c.page.getByRole("slider", { name, exact: true });
  await input.focus();
  await input.press("Home");
  for (let n = 0; n < value; n++) await input.press("ArrowRight");
}
test("authorized cameras, admin and delayed vitals; comms repair and two oxygen codes", async ({
  browser,
  request,
}) => {
  test.setTimeout(600000);
  const m = await match(browser, request);
  try {
    const imp = m.clients.find((c) => c.own!.role === "impostor")!,
      crew = m.clients.filter((c) => c.own!.role === "crew"),
      a = crew[0],
      b = crew[1],
      c = crew[2];
    const security = station.terminals.find((t) => t.id === "security")!;
    await walk(a, security);
    await a.page
      .getByRole("button", { name: "Терминал · cameras", exact: true })
      .click();
    await expect.poll(() => a.own?.observation?.type).toBe("cameras");
    const camera = station.cameras.find((v) => v.room_id === "security")!;
    await a.page.getByLabel("Камера", { exact: true }).selectOption(camera.id);
    await expect.poll(() => a.own?.observation?.camera?.id).toBe(camera.id);
    expect(
      a.own?.observation?.players?.some(
        (p) =>
          p.nickname ===
          a.snapshot?.roster?.find((p) => p.id === a.id)?.nickname,
      ),
    ).toBe(true);
    console.log("Camera authorization and switching verified");
    await start(imp, "comms");
    await expect.poll(() => a.own?.observation).toBeNull();
    for (const player of crew)
      await expect.poll(() => player.own?.tasks.length).toBe(0);
    const comms = station.sabotage_panels.find((p) => p.type === "comms")!;
    await walk(a, comms);
    await a.page
      .getByRole("button", { name: "Ремонт · comms", exact: true })
      .click();
    await expect.poll(() => a.own?.repair?.kind).toBe("comms");
    const signal = a.own!.repair!.challenge;
    await range(a, "Частота", signal[0]);
    await range(a, "Фаза", signal[1]);
    await sleep(2100);
    await a.page
      .getByRole("button", { name: "Восстановить", exact: true })
      .click();
    await expect
      .poll(() => a.snapshot?.sabotages?.some((s) => s.kind === "comms"))
      .toBe(false);
    await expect.poll(() => a.own?.tasks.length).toBe(7);
    console.log("Comms repair and task restoration verified");
    const admin = station.terminals.find((t) => t.id === "admin")!;
    await walk(b, admin);
    await b.page
      .getByRole("button", { name: "Терминал · admin", exact: true })
      .click();
    await expect.poll(() => b.own?.observation?.type).toBe("admin");
    expect(JSON.stringify(b.own?.observation)).not.toContain("nickname");
    await b.page
      .getByRole("button", { name: "Закрыть терминал", exact: true })
      .click();
    console.log("Admin counts-only view verified");
    const vitals = station.terminals.find((t) => t.id === "vitals")!;
    await Promise.all([walk(c, vitals), walk(imp, vitals)]);
    await c.page
      .getByRole("button", { name: "Терминал · vitals", exact: true })
      .click();
    await expect.poll(() => c.own?.observation?.type).toBe("vitals");
    expect(
      c.own?.observation?.players?.every((p) => p.status === "alive"),
    ).toBe(true);
    await imp.page
      .getByRole("button", { name: "Устранить", exact: true })
      .click();
    await expect.poll(() => c.own?.alive).toBe(false);
    await walk(b, vitals);
    await b.page
      .getByRole("button", { name: "Терминал · vitals", exact: true })
      .click();
    await expect
      .poll(
        () => b.own?.observation?.players?.find((p) => p.id === c.id)?.status,
      )
      .toBe("dead");
    await b.page
      .getByRole("button", { name: "Закрыть терминал", exact: true })
      .click();
    console.log("Delayed vitals verified");
    await start(imp, "oxygen");
    const panels = station.sabotage_panels.filter((p) => p.type === "oxygen");
    for (const actor of [a, b]) {
      const panel = panels
        .slice()
        .sort(
          (p, q) =>
            Math.hypot(p.x - actor.own!.x!, p.y - actor.own!.y!) -
            Math.hypot(q.x - actor.own!.x!, q.y - actor.own!.y!),
        )[0];
      await walk(actor, panel);
      await actor.page
        .getByRole("button", { name: "Ремонт · oxygen", exact: true })
        .click();
      await expect.poll(() => actor.own?.repair?.kind).toBe("oxygen");
      const code = actor.own!.repair!.challenge;
      for (const n of code)
        await actor.page
          .getByRole("button", { name: String(n), exact: true })
          .click();
      await sleep(2100);
      await actor.page
        .getByRole("button", { name: "Восстановить", exact: true })
        .click();
    }
    for (const player of m.clients)
      await expect
        .poll(() =>
          player.snapshot?.sabotages?.some((s) => s.kind === "oxygen"),
        )
        .toBe(false);
  } finally {
    await m.close();
  }
});
