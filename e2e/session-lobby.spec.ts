import { test, expect } from "@playwright/test";

test("lobby readiness, reload and resume preserve the same match and explicit leave clears recovery", async ({ browser, request }) => {
  const api = "http://127.0.0.1:8000";
  const guests: { token: string; player_id: string; nickname: string }[] = [];
  let code = "";
  const context = await browser.newContext();
  const call = async (path: string, data: unknown, token?: string, method = "POST") => {
    const response = await request.fetch(api + path, {
      method, data, headers: token ? { Authorization: "Guest " + token } : {},
    });
    expect(response.ok(), `${path}: ${response.status()}`).toBeTruthy();
    return response.json();
  };
  try {
    for (let i = 0; i < 4; i++) {
      const guest = await call("/api/v1/guests/", { nickname: `Session${i}${Date.now().toString().slice(-5)}` });
      guests.push(guest);
      if (!code) code = (await call("/api/v1/rooms/", { impostor_count: 1 }, guest.token)).code;
      else await call("/api/v1/rooms/join/", { code }, guest.token);
    }
    await context.addInitScript((guest) => {
      localStorage.setItem("crew-mission-guest-v1", JSON.stringify(guest));
    }, guests[0]);
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/room/" + code);
    const start = page.getByRole("button", { name: "Начать игру", exact: true });
    await expect(start).toBeDisabled();
    await page.getByRole("button", { name: "Я готов", exact: true }).click();
    await expect(page.getByRole("button", { name: "Отменить готовность" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: "Отменить готовность" })).toBeVisible();
    await expect(start).toBeDisabled();
    for (const guest of guests.slice(1))
      await call(`/api/v1/rooms/${code}/ready/`, { is_ready: true }, guest.token, "PATCH");
    await expect(start).toBeEnabled();
    await page.goto("/");
    await page.getByRole("button", { name: "Продолжить сессию" }).click();
    await expect(page).toHaveURL("/room/" + code);
    await page.getByRole("button", { name: "Отменить готовность" }).click();
    await expect(start).toBeDisabled();
    await page.getByRole("button", { name: "Я готов", exact: true }).click();
    await expect(start).toBeEnabled();
    await start.click();
    await expect(page).toHaveURL("/game/" + code);
    await expect(page.locator("canvas")).toBeVisible();
    await page.goto("/");
    await page.getByRole("button", { name: "Продолжить сессию" }).click();
    await expect(page).toHaveURL("/game/" + code);
    await expect(page.locator("canvas")).toBeVisible();
    await page.getByRole("button", { name: "Выйти", exact: true }).click();
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("button", { name: "Продолжить сессию" })).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
    if (code) for (const guest of guests)
      await request.post(api + `/api/v1/rooms/${code}/leave/`, { headers: { Authorization: "Guest " + guest.token } });
  }
});
