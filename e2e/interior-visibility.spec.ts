import { test, expect } from "@playwright/test";
import station from "../src/features/game/engine/asterion.json";
test("furniture behind the visibility boundary remains readable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/demo/asterion");
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  await page.waitForTimeout(300);
  const table = station.decorations.find(
    (p) => p.room_id === "nexus" && p.kind === "meetingtable",
  )!;
  const brightness = await canvas.evaluate(
    (el, { table, spawn }) => {
      const canvas = el as HTMLCanvasElement,
        box = canvas.getBoundingClientRect(),
        scale = Math.max(0.65, Math.min(1.1, box.width / 1000));
      const vx = Math.max(
          0,
          Math.min(6144 - box.width / scale, spawn.x - box.width / scale / 2),
        ),
        vy = Math.max(
          0,
          Math.min(4096 - box.height / scale, spawn.y - box.height / scale / 2),
        );
      const x =
          ((table.x + table.width / 2 - vx) * scale * canvas.width) / box.width,
        y =
          ((table.y + table.height / 2 - vy) * scale * canvas.height) /
          box.height;
      const data = canvas
        .getContext("2d")!
        .getImageData(Math.round(x) - 3, Math.round(y) - 3, 6, 6).data;
      let sum = 0;
      for (let i = 0; i < data.length; i += 4)
        sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      return sum / (data.length / 4);
    },
    { table: table.bounds, spawn: station.spawns[0] },
  );
  expect(brightness).toBeGreaterThan(40);
  await page.screenshot({
    path: "test-results/interior-visible.png",
    fullPage: true,
  });
});
