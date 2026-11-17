import { walk, type Client } from "./helpers/station";
import { solveTask } from "./helpers/tasks";
import { test, expect } from "@playwright/test";
import station from "../src/features/game/engine/asterion.json";
import { writeFileSync } from "node:fs";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
for (const count of [4, 10])
  test(`Asterion ${count} browsers: private world, movement, map, reconnect, meeting chat`, async ({
    browser,
  }) => {
    test.setTimeout(300000);
    if (count === 10) await sleep(61000);
    const clients: Client[] = [];
    let code = "";
    try {
      for (let i = 0; i < count; i++) {
        const context = await browser.newContext({
            viewport: { width: i === 3 ? 390 : 1280, height: 900 },
            hasTouch: i === 3,
          }),
          page = await context.newPage();
        const c: Client = {
          page,
          context,
          own: null,
          snapshot: null,
          id: "",
          errors: [],
        };
        clients.push(c);
        page.on("pageerror", (e) => c.errors.push(e.message));
        page.on("websocket", (ws) =>
          ws.on("framereceived", (frame) => {
            const m = JSON.parse(String(frame.payload));
            if (m.type === "game.self") c.own = m;
            if (m.type === "game.snapshot") c.snapshot = m;
            if (m.type === "auth.ok") c.id = m.player_id;
          }),
        );
        await page.goto("/");
        await page
          .getByLabel("Как тебя зовут, капитан?")
          .fill(`V2${i}${Date.now().toString().slice(-5)}`);
        if (i === 0) {
          await page.getByRole("button", { name: "Создать комнату" }).click();
          await expect(page).toHaveURL(/\/room\//);
          code = page.url().split("/").pop()!;
        } else {
          await page.getByLabel("Уже есть приглашение?").fill(code);
          await page.getByRole("button", { name: "Войти в экипаж" }).click();
          await expect(page).toHaveURL(/\/room\//);
        }
      }
      const host = clients[0];
      await expect(
        host.page.getByText(`Игроки: ${count} / 20`, { exact: true }),
      ).toBeVisible();
      await host.page
        .getByRole("button", { name: "Цвет 20", exact: true })
        .click();
      await expect(
        host.page.getByRole("button", { name: "Цвет 20", exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
      await host.page.getByText("Настройки матча", { exact: false }).click();
      await host.page.getByLabel("Обсуждение, с", { exact: true }).fill("10");
      await host.page.getByLabel("Голосование, с", { exact: true }).fill("15");
      await host.page
        .getByRole("button", { name: "Сохранить настройки" })
        .click();
      await expect(host.page.getByText("Настройки сохранены")).toBeVisible();
      if (count === 4) {
        await host.page
          .getByRole("button", { name: "Предателей: 1", exact: true })
          .click();
        await expect(
          host.page.getByRole("button", { name: "Начать игру", exact: true }),
        ).toBeEnabled();
      }
      await host.page.getByRole("button", { name: "Начать игру" }).click();
      for (const c of clients) {
        await expect.poll(() => c.snapshot?.protocol_version).toBe(2);
        await expect.poll(() => c.own?.map_version).toBe(2);
        expect(c.snapshot?.map_mode).toBe(count === 4 ? "compact" : "full");
        const canvasBounds = await c.page.locator("canvas").boundingBox();
        expect(canvasBounds!.width).toBeGreaterThan(
          c === clients[3] ? 330 : 800,
        );
        expect(c.own?.tasks.length).toBe(c.own?.role === "crew" ? 7 : 0);
        expect(c.snapshot?.players.every((p) => !("role" in p))).toBeTruthy();
        expect(
          await c.page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBeTruthy();
      }
      expect(host.own?.color).toBe(19);
      const mobile = clients[3],
        beforeTouch = mobile.own!.x!;
      const button = await mobile.page
        .getByRole("button", { name: "Вправо", exact: true })
        .boundingBox();
      if (!button) throw new Error("Touch control missing");
      const cdp = await mobile.context.newCDPSession(mobile.page);
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [
          {
            x: button.x + button.width / 2,
            y: button.y + button.height / 2,
            id: 1,
          },
        ],
      });
      await sleep(400);
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      await cdp.detach();
      await expect.poll(() => mobile.own!.x!).toBeGreaterThan(beforeTouch + 20);
      const crew = clients.find((c) => c.own?.role === "crew")!,
        imp = clients.find((c) => c.own?.role === "impostor")!;
      await crew.page.getByRole("button", { name: "Карта · M" }).click();
      await expect(crew.page.getByRole("dialog")).toBeVisible();
      await crew.page.screenshot({
        path: `test-results/asterion-map-${count}.png`,
        fullPage: true,
      });
      await crew.page.getByRole("button", { name: "Закрыть карту" }).click();
      const x = crew.own!.x!;
      await crew.page.keyboard.down("ArrowRight");
      await sleep(650);
      await crew.page.keyboard.up("ArrowRight");
      await expect.poll(() => crew.own!.x!).toBeGreaterThan(x + 40);
      const role = imp.own!.role;
      await imp.page.reload();
      await expect.poll(() => imp.own!.role).toBe(role);
      await expect(
        imp.page.getByRole("heading", { name: "ASTERION", exact: true }),
      ).toBeVisible();
      // Walk a crew member from the spawn hall to a server-assigned station with real key events.
      if (count === 4) {
        const task = crew
          .own!.tasks.slice()
          .sort(
            (a, b) =>
              Math.hypot(a.x - crew.own!.x!, a.y - crew.own!.y!) -
              Math.hypot(b.x - crew.own!.x!, b.y - crew.own!.y!),
          )[0];
        await walk(crew, task);
        await crew.page
          .getByRole("button", { name: "Использовать", exact: true })
          .click();
        await expect(crew.page.getByRole("dialog")).toBeVisible();
        await expect(
          crew.page.getByRole("heading", { name: task.title!, exact: true }),
        ).toBeVisible();
        await crew.page.screenshot({ path: "test-results/asterion-task.png" });
        await expect
          .poll(
            () =>
              crew.own?.tasks.find((t) => t.id === task.id)?.challenge.length,
          )
          .toBeGreaterThan(0);
        const attempt = crew.own!.tasks.find((t) => t.id === task.id)!;
        await solveTask(crew.page, attempt);
        await expect
          .poll(
            () =>
              crew.own?.tasks.find((t) => t.id === task.id)?.is_completed ||
              crew.own?.tasks.find((t) => t.id === task.id)?.stage === 1,
          )
          .toBeTruthy();
        await expect(crew.page.getByRole("dialog")).not.toBeVisible();
        await walk(crew, station.emergency);
      } else await walk(crew, station.emergency);
      await crew.page
        .getByRole("button", { name: "Собрание", exact: true })
        .click();
      for (const c of clients)
        await expect.poll(() => c.snapshot?.phase).toBe("meeting");
      await crew.page
        .getByLabel("Сообщение", { exact: true })
        .fill("Проверка связи ASTERION");
      await crew.page
        .getByRole("button", { name: "Отправить", exact: true })
        .click();
      for (const c of clients)
        await expect(
          c.page.getByText("Проверка связи ASTERION", { exact: false }),
        ).toBeVisible();
      await expect
        .poll(() => crew.page.locator("canvas").getAttribute("data-fps"))
        .toBeTruthy();
      const fps = await crew.page.locator("canvas").getAttribute("data-fps"),
        chunks = await crew.page.locator("canvas").getAttribute("data-chunks");
      const impostors = clients.filter((c) => c.own?.role === "impostor");
      for (let round = 0; round < impostors.length; round++) {
        if (round > 0) {
          await expect
            .poll(() => crew.snapshot?.phase, { timeout: 15000 })
            .toBe("playing");
          const caller = clients.find(
            (c) =>
              c.own?.alive && c.own.role === "crew" && !c.own.emergency_used,
          )!;
          await walk(caller, station.emergency);
          await caller.page
            .getByRole("button", { name: "Собрание", exact: true })
            .click();
        }
        await expect
          .poll(() => crew.snapshot?.meeting?.stage, { timeout: 20000 })
          .toBe("voting");
        const target = impostors[round],
          name = crew.snapshot!.roster!.find(
            (p) => p.id === target.id,
          )!.nickname;
        for (const c of clients.filter((c) => c.own?.alive))
          await c.page
            .getByRole("dialog")
            .getByRole("button", { name, exact: true })
            .click();
      }
      for (const c of clients) {
        await expect
          .poll(() => c.snapshot?.phase, { timeout: 15000 })
          .toBe("finished");
        expect(c.snapshot?.result?.winner).toBe("crew");
      }
      for (const c of clients) {
        expect(c.errors).toEqual([]);
        await c.page.screenshot({
          path: `test-results/asterion-${count}-${c.id.slice(0, 5)}.png`,
          fullPage: true,
        });
      }
      writeFileSync(
        `test-results/asterion-${count}.json`,
        JSON.stringify(
          {
            count,
            mode: crew.snapshot?.map_mode,
            fps: Number(fps),
            chunks: Number(chunks),
            errors: clients.flatMap((c) => c.errors),
          },
          null,
          2,
        ),
      );
    } finally {
      for (const c of clients) await c.context.close();
    }
  });
