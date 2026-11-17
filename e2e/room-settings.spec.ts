import { test, expect } from "@playwright/test";

test("host selection syncs 1/2/3 impostors and only the host can edit", async ({
  browser,
  request,
}) => {
  const api = "http://127.0.0.1:8000",
    guests = [];
  const post = async (path: string, data: unknown, token?: string) => {
    let r = await request.post(api + path, {
      data,
      headers: token ? { Authorization: "Guest " + token } : {},
    });
    if (r.status() === 429) {
      await new Promise((r) => setTimeout(r, 61000));
      r = await request.post(api + path, {
        data,
        headers: token ? { Authorization: "Guest " + token } : {},
      });
    }
    expect(r.ok()).toBeTruthy();
    return r.json();
  };
  for (let i = 0; i < 4; i++)
    guests.push(
      await post("/api/v1/guests/", {
        nickname: "Setting" + i + Date.now().toString().slice(-4),
      }),
    );
  const room = await post("/api/v1/rooms/", {}, guests[0].token);
  for (const g of guests.slice(1))
    await post("/api/v1/rooms/join/", { code: room.code }, g.token);
  const contexts = [];
  try {
    for (const guest of guests.slice(0, 2)) {
      const ctx = await browser.newContext();
      contexts.push(ctx);
      await ctx.addInitScript((g) => {
        if (location.origin !== "null")
          localStorage.setItem("crew-mission-guest-v1", JSON.stringify(g));
      }, guest);
      const p = await ctx.newPage();
      await p.goto("/room/" + room.code);
      await p.getByText("Настройки матча", { exact: false }).click();
    }
    const host = contexts[0].pages()[0],
      member = contexts[1].pages()[0];
    await expect(
      host.getByRole("button", { name: "Начать игру", exact: true }),
    ).toBeDisabled();
    for (const count of [1, 3, 2, 1]) {
      await host
        .getByRole("button", { name: "Предателей: " + count, exact: true })
        .click();
      await expect(
        member.getByRole("button", {
          name: "Предателей: " + count,
          exact: true,
        }),
      ).toHaveAttribute("aria-pressed", "true");
      await expect(
        member.getByRole("button", {
          name: "Предателей: " + count,
          exact: true,
        }),
      ).toBeDisabled();
      if (count === 1)
        await expect(
          host.getByRole("button", { name: "Начать игру", exact: true }),
        ).toBeEnabled();
      else
        await expect(
          host.getByRole("button", { name: "Начать игру", exact: true }),
        ).toBeDisabled();
    }
    await host.getByLabel("Максимум игроков", { exact: true }).fill("4");
    await host.getByRole("button", { name: "Сохранить настройки" }).click();
    await expect(
      member.getByText("Игроки: 4 / 4", { exact: true }),
    ).toBeVisible();
  } finally {
    for (const ctx of contexts) await ctx.close();
    for (const g of guests)
      await request.post(api + "/api/v1/rooms/" + room.code + "/leave/", {
        headers: { Authorization: "Guest " + g.token },
      });
  }
});
