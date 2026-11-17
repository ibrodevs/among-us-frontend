import {
  test,
  expect,
  type Browser,
  type Page,
  type BrowserContext,
} from "@playwright/test";
import type { Snapshot, OwnState } from "../src/features/game/network/types";
import { writeFileSync } from "node:fs";

test("responsive landing and local touch demo", async ({ browser }) => {
  for (const width of [1440, 768, 390, 360]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "В космосе",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await page.screenshot({
      path: `test-results/home-${width}.png`,
      fullPage: true,
    });
    await page.close();
  }
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  await page.goto("/demo");
  await expect(page.getByText("ДЕМО-РЕЖИМ")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await holdRight(page, 350);
  await page.screenshot({
    path: "test-results/demo-mobile.png",
    fullPage: true,
  });
  await page.close();
});

async function holdRight(page: Page, duration: number) {
  const button = await page
    .getByRole("button", { name: "Вправо", exact: true })
    .boundingBox();
  if (!button) throw new Error("Touch pad not visible");
  const cdp = await page.context().newCDPSession(page);
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
  await page.waitForTimeout(duration);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await cdp.detach();
}

type Client = {
  page: Page;
  context: BrowserContext;
  snapshot: Snapshot | null;
  own: OwnState | null;
  id: string;
  events: number;
  errors: string[];
  sent: unknown[];
};
async function connectPlayer(browser: Browser, index: number): Promise<Client> {
  const context = await browser.newContext({
      viewport: { width: index === 3 ? 390 : 1280, height: 900 },
      hasTouch: index === 3,
      recordVideo:
        index === 0
          ? { dir: "test-results/videos", size: { width: 1280, height: 900 } }
          : undefined,
    }),
    page = await context.newPage();
  const client: Client = {
    page,
    context,
    snapshot: null,
    own: null,
    id: "",
    events: 0,
    errors: [],
    sent: [],
  };
  page.on("pageerror", (e) => client.errors.push(e.message));
  page.on("websocket", (socket) => {
    socket.on("framesent", (frame) => {
      const m = JSON.parse(frame.payload.toString());
      if (m.type !== "auth") {
        client.sent.push({ time: Date.now(), ...m });
        if (client.sent.length > 30) client.sent.shift();
      }
    });
    socket.on("framereceived", (frame) => {
      const m = JSON.parse(frame.payload.toString());
      if (m.type === "game.snapshot") {
        client.snapshot = m;
        client.events++;
      }
      if (m.type === "game.self") client.own = m;
      if (m.type === "auth.ok") client.id = m.player_id;
    });
  });
  await page.goto("/");
  await page
    .getByLabel("Как тебя зовут, капитан?")
    .fill("QA" + index + Date.now().toString().slice(-5));
  return client;
}
for (const count of [4, 10])
  test(`${count} real browsers complete a match, preserve role on reconnect and vote`, async ({
    browser,
  }) => {
    const clients: Client[] = [];
    const started = Date.now();
    // Preserve the real 10/min guest throttle when the 4- and 10-player cases run together.
    if (count === 10)
      await new Promise((resolve) => setTimeout(resolve, 22000));
    try {
      for (let i = 0; i < count; i++) {
        const c = await connectPlayer(browser, i);
        clients.push(c);
        if (i === 0)
          await c.page.getByRole("button", { name: "Создать комнату" }).click();
        else {
          const code = new URL(clients[0].page.url()).pathname
            .split("/")
            .pop()!;
          await c.page.getByLabel("Уже есть приглашение?").fill(code);
          await c.page.getByRole("button", { name: "Войти в экипаж" }).click();
        }
        await expect(c.page).toHaveURL(/\/room\/[A-Z0-9]{6}/);
      }
      const host = clients[0];
      await expect(host.page.getByText(`Игроки: ${count} / 10`)).toBeVisible();
      await host.page.screenshot({
        path: `test-results/lobby-${count}.png`,
        fullPage: true,
      });
      await host.page.getByText("Настройки матча",{exact:false}).click();
      await host.page.getByLabel("Карта",{exact:true}).selectOption("1");
      await host.page.getByRole("button",{name:"Сохранить настройки"}).click();
      await expect(host.page.getByText("Настройки сохранены")).toBeVisible();
      await host.page.getByRole("button", { name: "Начать игру" }).click();
      for (const c of clients)
        await expect
          .poll(() => Boolean(c.snapshot && c.own), { timeout: 20000 })
          .toBeTruthy();
      expect(clients.filter((c) => c.own?.role === "impostor")).toHaveLength(
        count === 4 ? 1 : 2,
      );
      for (const c of clients) {
        expect(JSON.stringify(c.snapshot)).not.toContain("role");
        expect(c.own!.tasks).toHaveLength(c.own!.role === "crew" ? 3 : 0);
      }
      if (count === 10) {
        const before = clients.map(
          (c) => c.snapshot!.players.find((p) => p.id === c.id)!.x,
        );
        await Promise.all(
          clients.map((c) => c.page.keyboard.down("ArrowRight")),
        );
        await clients[0].page.waitForTimeout(1000);
        await Promise.all(clients.map((c) => c.page.keyboard.up("ArrowRight")));
        for (let i = 0; i < clients.length; i++) {
          const delta =
            clients[i].snapshot!.players.find((p) => p.id === clients[i].id)!
              .x - before[i];
          expect(delta).toBeGreaterThan(30);
          expect(delta).toBeLessThan(190);
        }
      }
      if (count === 4) {
        const mobile = clients[3],
          before = mobile.snapshot!.players.find((p) => p.id === mobile.id)!.x;
        await holdRight(mobile.page, 450);
        await expect
          .poll(
            () => mobile.snapshot!.players.find((p) => p.id === mobile.id)!.x,
          )
          .toBeGreaterThan(before + 20);
        expect(
          await mobile.page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBeTruthy();
        await mobile.page.screenshot({
          path: "test-results/live-mobile.png",
          fullPage: true,
        });
        const role = host.own!.role,
          game = host.snapshot!.game_id;
        await host.context.setOffline(true);
        await expect(
          host.page.getByText("Связь потеряна. Восстанавливаем прежний матч…"),
        ).toBeVisible();
        await host.page.screenshot({
          path: "test-results/reconnecting.png",
          fullPage: true,
        });
        await host.context.setOffline(false);
        await expect(
          host.page.getByText("Онлайн", { exact: false }),
        ).toBeVisible({ timeout: 15000 });
        expect(host.own!.role).toBe(role);
        expect(host.snapshot!.game_id).toBe(game);
      }
      const mover = clients[0],
        old = mover.snapshot!.players.find((p) => p.id === mover.id)!;
      await mover.page.keyboard.down("ArrowRight");
      await mover.page.waitForTimeout(700);
      await mover.page.keyboard.up("ArrowRight");
      await expect
        .poll(() => mover.snapshot!.players.find((p) => p.id === mover.id)!.x)
        .toBeGreaterThan(old.x + 30);
      const role = mover.own!.role;
      await mover.page.reload();
      await expect.poll(() => mover.own?.role).toBe(role);
      await expect(
        mover.page.getByText("Онлайн", { exact: false }),
      ).toBeVisible();
      await mover.page.screenshot({
        path: `test-results/game-${count}.png`,
        fullPage: true,
      });
      // Each emergency caller may call once; eject every impostor through real UI.
      const targets = clients.filter((c) => c.own!.role === "impostor");
      for (let round = 0; round < targets.length; round++) {
        const caller = clients.find(
          (c) => c.own?.alive && !c.own?.emergency_used,
        )!;
        const me = caller.snapshot!.players.find((p) => p.id === caller.id)!;
        if (Math.abs(me.x - 800) > 15) {
          const key = me.x < 800 ? "ArrowRight" : "ArrowLeft";
          await caller.page.keyboard.down(key);
          await expect
            .poll(
              () =>
                Math.abs(
                  caller.snapshot!.players.find((p) => p.id === caller.id)!.x -
                    800,
                ),
              { timeout: 8000, intervals: [100] },
            )
            .toBeLessThan(15);
          await caller.page.keyboard.up(key);
          await caller.page.waitForTimeout(400);
        }
        await expect(
          caller.page.getByRole("button", {
            name: "Собрание (1)",
            exact: true,
          }),
        ).toBeEnabled();
        await caller.page
          .getByRole("button", { name: "Собрание (1)", exact: true })
          .click();
        await expect(
          caller.page.getByRole("heading", { name: "Кому можно доверять?" }),
        ).toBeVisible();
        await caller.page.screenshot({
          path: `test-results/meeting-${count}-${round}.png`,
        });
        await expect(
          caller.page.getByRole("heading", { name: "Время голосовать" }),
        ).toBeVisible({ timeout: 40000 });
        const target = targets[round],
          name = target.snapshot!.players.find(
            (p) => p.id === target.id,
          )!.nickname;
        for (const c of clients.filter(
          (c) => c.snapshot!.players.find((p) => p.id === c.id)?.alive,
        )) {
          await c.page
            .getByRole("dialog")
            .getByRole("button", { name: new RegExp("^" + name) })
            .click();
        }
        if (round < targets.length - 1) {
          await expect(caller.page.getByRole("dialog")).toBeHidden({
            timeout: 12000,
          });
          await expect.poll(() => caller.snapshot?.phase).toBe("playing");
        }
      }
      for (const c of clients)
        await expect(
          c.page.getByRole("heading", { name: "Победа экипажа!" }),
        ).toBeVisible({ timeout: 15000 });
      await clients[0].page.screenshot({
        path: `test-results/finished-${count}.png`,
        fullPage: true,
      });
      const report = {
        players: count,
        elapsed_ms: Date.now() - started,
        snapshots: clients.map((c) => c.events),
        errors: clients.flatMap((c) => c.errors),
        result: clients[0].snapshot?.result,
      };
      writeFileSync(
        `test-results/match-${count}.json`,
        JSON.stringify(report, null, 2),
      );
      expect(report.errors).toEqual([]);
    } catch (error) {
      console.log(
        "Protocol diagnostics",
        JSON.stringify(
          clients.map((c) => ({
            id: c.id,
            position: c.snapshot?.players.find((p) => p.id === c.id),
            sent: c.sent,
          })),
        ),
      );
      throw error;
    } finally {
      for (const c of clients) await c.context.close();
      await clients[0]?.page
        .video()
        ?.saveAs(`test-results/match-${count}.webm`);
    }
  });

test("all three real task dialogs, kill, report, skip vote and impostor victory", async ({
  browser,
}) => {
  const clients: Client[] = [];
  try {
    for (let i = 0; i < 4; i++) {
      const c = await connectPlayer(browser, i);
      clients.push(c);
      if (i === 0)
        await c.page.getByRole("button", { name: "Создать комнату" }).click();
      else {
        await c.page
          .getByLabel("Уже есть приглашение?")
          .fill(new URL(clients[0].page.url()).pathname.split("/").pop()!);
        await c.page.getByRole("button", { name: "Войти в экипаж" }).click();
      }
      await expect(c.page).toHaveURL(/\/room\/[A-Z0-9]{6}/);
    }
    await expect(
      clients[0].page.getByRole("button", { name: "Начать игру" }),
    ).toBeEnabled();
    await clients[0].page.getByLabel("Карта", { exact: true }).selectOption("1");
    await clients[0].page.getByRole("button", { name: "Начать игру" }).click();
    for (const c of clients)
      await expect
        .poll(() => Boolean(c.snapshot && c.own), { timeout: 20000 })
        .toBeTruthy();
    const crew = clients.find((c) => c.own?.role === "crew")!;
    async function go(c: Client, x: number, y: number) {
      for (const [axis, target] of [
        ["x", x],
        ["y", y],
      ] as const) {
        for (let attempt = 0; attempt < 5; attempt++) {
          const value = c.snapshot!.players.find((p) => p.id === c.id)![axis];
          if (Math.abs(value - target) < 20) break;
          const positive = value < target;
          const key =
            axis === "x"
              ? positive
                ? "ArrowRight"
                : "ArrowLeft"
              : positive
                ? "ArrowDown"
                : "ArrowUp";
          await c.page.keyboard.down(key);
          try {
            await expect
              .poll(
                () => {
                  const current = c.snapshot!.players.find(
                    (p) => p.id === c.id,
                  )![axis];
                  return positive
                    ? current >= target - 10
                    : current <= target + 10;
                },
                { timeout: 12000, intervals: [50] },
              )
              .toBeTruthy();
          } finally {
            await c.page.keyboard.up(key);
          }
          await c.page.waitForTimeout(250);
        }
        expect(
          Math.abs(
            c.snapshot!.players.find((p) => p.id === c.id)![axis] - target,
          ),
        ).toBeLessThan(30);
      }
    }
    await go(crew, 432, 450);
    await go(crew, 432, 320);
    await go(crew, 568, 320);
    await crew.page
      .getByRole("button", { name: "○ Sequence · Навигация", exact: true })
      .click();
    await expect(crew.page.getByRole("dialog")).toBeVisible();
    await expect(
      crew.page.getByRole("button", { name: "Сигнал 1", exact: true }),
    ).toBeEnabled({ timeout: 7000 });
    const sequence = crew.own!.tasks.find((t) => t.task_type === "sequence")!;
    for (const value of sequence.challenge)
      await crew.page
        .getByRole("button", { name: `Сигнал ${value + 1}`, exact: true })
        .click();
    await crew.page
      .getByRole("button", { name: "Подтвердить", exact: true })
      .click();
    await expect(crew.page.getByRole("dialog")).toBeHidden();
    await go(crew, 432, 320);
    await go(crew, 432, 676);
    await go(crew, 400, 676);
    await crew.page
      .getByRole("button", { name: "○ Wire Link · Двигатели", exact: true })
      .click();
    await expect(crew.page.getByRole("dialog")).toBeVisible();
    const wire = crew.own!.tasks.find((t) => t.task_type === "wires")!;
    for (const value of wire.challenge)
      await crew.page
        .getByRole("dialog")
        .getByRole("button", { name: String(value + 1), exact: true })
        .click();
    await crew.page.screenshot({ path: "test-results/task-wires.png" });
    await expect(
      crew.page.getByRole("button", { name: "Подтвердить", exact: true }),
    ).toBeEnabled({ timeout: 5000 });
    await crew.page
      .getByRole("button", { name: "Подтвердить", exact: true })
      .click();
    await expect(crew.page.getByRole("dialog")).toBeHidden();
    await go(crew, 432, 450);
    await go(crew, 1166, 450);
    await go(crew, 1166, 320);
    await go(crew, 1067, 320);
    await crew.page
      .getByRole("button", { name: "○ Upload · Связь", exact: true })
      .click();
    await expect(crew.page.getByRole("progressbar")).toBeVisible();
    await crew.page.screenshot({ path: "test-results/task-upload.png" });
    await expect(
      crew.page.getByRole("button", { name: "Подтвердить", exact: true }),
    ).toBeEnabled({ timeout: 12000 });
    await crew.page
      .getByRole("button", { name: "Подтвердить", exact: true })
      .click();
    await expect(crew.page.getByRole("dialog")).toBeHidden();
    await expect
      .poll(() => crew.own!.tasks.filter((t) => t.is_completed).length)
      .toBe(3);
    const killer = clients.find((c) => c.own?.role === "impostor")!;
    await expect(
      killer.page.getByRole("button", { name: "Устранить", exact: true }),
    ).toBeEnabled({ timeout: 30000 });
    await killer.page
      .getByRole("button", { name: "Устранить", exact: true })
      .click();
    await expect.poll(() => killer.snapshot!.bodies.length).toBe(1);
    const reporter = clients.find(
      (c) =>
        c.snapshot!.players.find((p) => p.id === c.id)?.alive &&
        c.snapshot!.bodies.some((b) => {
          const p = c.snapshot!.players.find((p) => p.id === c.id)!;
          return Math.hypot(p.x - b.x, p.y - b.y) <= 110;
        }),
    )!;
    await reporter.page
      .getByRole("button", { name: "Сообщить о теле", exact: true })
      .click();
    await expect(
      reporter.page.getByRole("heading", { name: "Кому можно доверять?" }),
    ).toBeVisible();
    await expect(
      reporter.page.getByRole("heading", { name: "Время голосовать" }),
    ).toBeVisible({ timeout: 40000 });
    for (const c of clients.filter(
      (c) => c.snapshot!.players.find((p) => p.id === c.id)?.alive,
    ))
      await c.page
        .getByRole("button", { name: "Пропустить", exact: true })
        .click();
    await expect(
      reporter.page.getByRole("heading", { name: "Никто не исключён" }),
    ).toBeVisible();
    await expect(reporter.page.getByRole("dialog")).toBeHidden({
      timeout: 10000,
    });
    await expect(
      killer.page.getByRole("button", { name: "Устранить", exact: true }),
    ).toBeEnabled({ timeout: 30000 });
    await killer.page
      .getByRole("button", { name: "Устранить", exact: true })
      .click();
    for (const c of clients)
      await expect(
        c.page.getByRole("heading", { name: "Победа предателей!" }),
      ).toBeVisible();
    await killer.page.screenshot({
      path: "test-results/impostor-victory.png",
      fullPage: true,
    });
    expect(clients.flatMap((c) => c.errors)).toEqual([]);
  } finally {
    for (const c of clients) await c.context.close();
  }
});

test("room form validation, real 404 and expired guest recovery", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Как тебя зовут, капитан?").fill("Q");
  await expect(
    page.getByRole("button", { name: "Создать комнату" }),
  ).toBeDisabled();
  const nickname = "AuthQA" + Date.now().toString().slice(-5);
  await page.getByLabel("Как тебя зовут, капитан?").fill(nickname);
  await page.getByLabel("Уже есть приглашение?").fill("ZZZZZZ");
  await page.getByRole("button", { name: "Войти в экипаж" }).click();
  await expect(page.locator("p.error[role=alert]")).toContainText(
    /Room|Not found|найден/i,
  );
  await expect
    .poll(() =>
      page.evaluate(() =>
        Boolean(localStorage.getItem("crew-mission-guest-v1")),
      ),
    )
    .toBeTruthy();
  await page.evaluate(() => {
    const key = "crew-mission-guest-v1";
    const guest = JSON.parse(localStorage.getItem(key)!);
    guest.token = "invalid-expired-test-token";
    localStorage.setItem(key, JSON.stringify(guest));
  });
  await page.getByRole("button", { name: "Создать комнату" }).click();
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("crew-mission-guest-v1")),
    )
    .toBeNull();
  await page.getByRole("button", { name: "Создать комнату" }).click();
  await expect(page).toHaveURL(/\/room\/[A-Z0-9]{6}/);
  await page.getByRole("button", { name: "Выйти из комнаты" }).click();
  await expect(page).toHaveURL("/");
});
