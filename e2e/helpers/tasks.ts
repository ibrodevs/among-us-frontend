import { expect, type Page } from "@playwright/test";
import type { Task } from "../../src/features/game/network/types";
export async function solveTask(page: Page, task: Task) {
  const dialog = page.getByRole("dialog"),
    seed = task.challenge,
    kind = task.task_type;
  const range = async (label: string, value: number, step = 1) => {
    const input = dialog.getByRole("slider", { name: label, exact: true });
    await input.focus();
    await input.press("Home");
    for (let n = 0; n < value; n += step) await input.press("ArrowRight");
  };
  const hold = async (ms: number) => {
    const b = dialog.getByRole("button", { name: /Удерживать/ }),
      bounds = await b.boundingBox();
    if (!bounds) throw new Error("No hold control");
    await page!.mouse.move(
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height / 2,
    );
    await page!.mouse.down();
    await page!.waitForTimeout(ms);
    await page!.mouse.up();
  };
  switch (kind) {
    case "wires":
      for (let i = 0; i < 4; i++) {
        await dialog
          .getByRole("button", { name: new RegExp("Кабель " + (i + 1) + "$") })
          .click();
        await dialog
          .getByRole("button", { name: "Разъём " + (seed[i] + 1), exact: true })
          .click();
      }
      break;
    case "power_routing":
      for (let i = 0; i < 6; i++)
        if (seed[i])
          await dialog
            .getByRole("button", { name: new RegExp("Реле " + (i + 1) + ":") })
            .click();
      break;
    case "upload":
      await hold(5300);
      break;
    case "engine_calibration":
      for (let i = 0; i < 2; i++) {
        await range(`Ротор ${i + 1} · цель ${seed[i]}`, seed[i], 5);
        await dialog
          .getByRole("button", {
            name: "Синхронизировать ротор " + (i + 1),
            exact: true,
          })
          .click();
      }
      break;
    case "oxygen_filters":
      for (let i = 0; i < 3; i++)
        for (let n = 0; n < 3; n++)
          await dialog
            .getByRole("button", {
              name: new RegExp("Фильтр " + (i + 1) + " ·"),
            })
            .click();
      for (const n of seed)
        await dialog
          .getByRole("button", { name: "Открыть " + (n + 1), exact: true })
          .click();
      break;
    case "fuel_distribution":
      for (let i = 0; i < (100 - seed[0]) / 5; i++)
        await dialog
          .getByRole("button", { name: "Перелить 5 л → 2", exact: true })
          .click();
      for (let i = 0; i < seed[2] / 5; i++)
        await dialog
          .getByRole("button", { name: "Перелить 5 л → 3", exact: true })
          .click();
      break;
    case "shield_alignment":
      for (let i = 0; i < 4; i++)
        for (let n = 0; n < seed[i]; n++)
          await dialog
            .locator("button")
            .filter({ hasText: /^[↑→↓←]$/ })
            .nth(i)
            .click();
      break;
    case "medical_scan":
      await hold(6300);
      break;
    case "sample_analysis":
      await dialog
        .getByRole("button", { name: "#" + (seed[0] + 1), exact: true })
        .click();
      break;
    case "cargo_sorting":
      for (let i = 0; i < 6; i++)
        await dialog
          .getByLabel("Отсек контейнера " + (i + 1), { exact: true })
          .selectOption(String(seed[i] + 1));
      break;
    case "antenna_alignment":
      await range("Азимут", seed[0], 10);
      await range("Высота", seed[1], 5);
      break;
    case "signal_frequency":
      await range("Частота", seed[0]);
      await range("Фаза", seed[1]);
      break;
    case "navigation_route":
      for (const n of seed)
        await dialog
          .getByRole("button", { name: String(n + 1), exact: true })
          .click();
      break;
    case "asteroid_defense":
      for (const n of seed)
        await dialog
          .getByRole("button", { name: "Астероид " + (n + 1), exact: true })
          .click();
      break;
    case "debris_removal":
      for (const n of seed) {
        await dialog
          .getByRole("button", { name: "⌁ Фрагмент " + (n + 1), exact: true })
          .click();
        await dialog.getByRole("button", { name: /Утилизировать \d/ }).click();
      }
      break;
    case "thermal_balance":
      for (let i = 0; i < 3; i++)
        await range(`Контур ${i + 1} · ${seed[i]}°`, seed[i], 5);
      break;
    case "coolant_valves":
      for (const n of seed)
        for (let i = 0; i < 3; i++)
          await dialog
            .getByRole("button", {
              name: new RegExp("Вентиль " + (n + 1) + " ·"),
            })
            .click();
      break;
    case "access_terminal":
      for (const n of seed)
        await dialog
          .getByRole("button", { name: String(n), exact: true })
          .click();
      break;
    case "sequence":
      await page.waitForTimeout(4600);
      for (const n of seed)
        await dialog
          .getByRole("button", { name: "● " + (n + 1), exact: true })
          .click();
      break;
    case "pressure_control":
      for (let i = 0; i < 3; i++)
        for (let n = 0; n < 10; n++)
          await dialog
            .getByRole("button", { name: "+5", exact: true })
            .nth(i)
            .click();
      break;
  }

  await expect(
    dialog.getByRole("button", { name: "Подтвердить", exact: true }),
  ).toBeEnabled({ timeout: 15000 });
  await dialog
    .getByRole("button", { name: "Подтвердить", exact: true })
    .click();
}
