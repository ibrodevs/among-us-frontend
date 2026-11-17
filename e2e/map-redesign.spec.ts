import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import station from "../src/features/game/engine/asterion.json";
test("Asterion 2.1: 21 authored rooms, overview, sectors and stable visual scenes", async ({
  page,
}) => {
  test.setTimeout(180000);
  test.skip(
    process.env.MAP_REVIEW_ENABLED !== "true",
    "Explicit test/development review build required",
  );
  const target = "test-results/map-redesign";
  mkdirSync(target, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 960 });
  await page.goto("/demo/asterion/review");
  await page.evaluate(() => document.fonts.ready);
  const selector = page.getByLabel("Обзор помещения", { exact: true }),
    canvas = page.getByTestId("review-scene");
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const room of station.rooms) {
    await selector.selectOption(room.id);
    await page.waitForTimeout(180);
    await expect(
      page.getByRole("heading", { name: room.name, exact: true }),
    ).toBeVisible();
    await canvas.screenshot({ path: `${target}/${room.id}.png` });
  }
  await selector.selectOption("all");
  await page.waitForTimeout(150);
  await canvas.screenshot({ path: `${target}/overview.png` });
  for (const sector of ["engineering", "command", "science", "logistics"]) {
    await selector.selectOption("sector:" + sector);
    await page.waitForTimeout(150);
    await canvas.screenshot({ path: `${target}/sector-${sector}.png` });
  }
  await selector.selectOption("nexus");
  for (const scene of ["task", "vent", "doors", "emergency"]) {
    await selector.selectOption(["vent","task"].includes(scene) ? "power" : "nexus");
    await page.getByLabel("Сцена", { exact: true }).selectOption(scene);
    await page.waitForTimeout(250);
    await canvas.screenshot({ path: `${target}/scene-${scene}.png` });
  }
  await page.getByRole("button", { name: "Мини-карта", exact: true }).click();
  await page.getByRole("dialog").screenshot({ path: `${target}/minimap.png` });
  await page
    .getByRole("button", { name: "Закрыть карту", exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${target}/mobile.png`, fullPage: true });
  expect(errors).toEqual([]);
  const cards = station.rooms
    .map(
      (r) =>
        `<article><img src="${r.id}.png"><h2>${r.name}</h2><p>${r.visual.layoutId} · ${r.visual.floorMaterial}</p></article>`,
    )
    .join("");
  writeFileSync(
    `${target}/gallery.html`,
    `<!doctype html><meta charset="utf-8"><title>Asterion 2.1 · 21 room review</title><style>body{font:16px system-ui;background:#102737;color:#ebf8ff;padding:24px}main{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}article{background:#203b4d;border-radius:16px;overflow:hidden}img{width:100%}h2,p{margin:12px 18px}p{font-size:13px;color:#b5cbd8}</style><h1>ASTERION 2.1 · 21 помещений</h1><main>${cards}</main>`,
  );
  // Compare frozen major scenes to stored baselines; geometry/props stay stable.
  await page.setViewportSize({ width: 1280, height: 960 });
  await page.getByLabel("Сцена", { exact: true }).selectOption("normal");
  for (const id of [
    "reactor",
    "bridge",
    "medical",
    "biodome",
    "cargo",
    "nexus",
  ]) {
    await selector.selectOption(id);
    await page.waitForTimeout(250);
    await expect(canvas).toHaveScreenshot(`${id}.png`, {
      maxDiffPixelRatio: 0.025,
      animations: "disabled",
    });
  }
});
