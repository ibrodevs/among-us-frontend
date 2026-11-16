import { test, expect, chromium, webkit } from "@playwright/test";
import { writeFileSync } from "node:fs";
for (const engine of [chromium, webkit])
  test(`${engine.name()} audio gesture unlock, mute persistence and scene rendering`, async () => {
    test.setTimeout(120000);
    const browser = await engine.launch();
    try {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true,
      });
      await context.addInitScript(() => {
        const native = window.AudioContext;
        const contexts: AudioContext[] = [];
        (window as unknown as { audioContexts: AudioContext[] }).audioContexts =
          contexts;
        window.AudioContext = class extends native {
          constructor(options?: AudioContextOptions) {
            super(options);
            contexts.push(this);
          }
        };
      });
      const page = await context.newPage(),
        errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto("/");
      expect(
        await page.evaluate(
          () =>
            (window as unknown as { audioContexts: AudioContext[] })
              .audioContexts.length,
        ),
      ).toBe(0);
      await page
        .getByText("Звук · нажмите для включения", { exact: false })
        .click();
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              (window as unknown as { audioContexts: AudioContext[] })
                .audioContexts[0]?.state,
          ),
        )
        .toBe("running");
      await page
        .getByRole("button", { name: "Выключить звук", exact: true })
        .click();
      expect(
        await page.evaluate(
          () => JSON.parse(localStorage.getItem("crew.audio.v2") || "{}").muted,
        ),
      ).toBe(true);
      await page.reload();
      await expect(
        page.getByText("Звук · выключен", { exact: false }),
      ).toBeVisible();
      await page.getByText("Звук · выключен", { exact: false }).click();
      await page
        .getByRole("button", { name: "Включить звук", exact: true })
        .click();
      await page.goto("/demo/asterion");
      await expect(
        page.getByRole("heading", { name: "ASTERION · Демо карты" }),
      ).toBeVisible();
      await page.waitForTimeout(6000);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBeTruthy();
      expect(errors).toEqual([]);
      await page.screenshot({
        path: `test-results/${engine.name()}-asterion-mobile.png`,
        fullPage: true,
      });
      await context.close();
    } finally {
      await browser.close();
    }
  });
test("measured desktop and CPU-throttled mobile frame times and heap", async ({
  browser,
}) => {
  test.setTimeout(180000);
  const results = [];
  for (const [name, width, rate] of [
    ["desktop", 1440, 1],
    ["mobile-cpu4", 390, 4],
  ] as const) {
    const context = await browser.newContext({
        viewport: { width, height: 900 },
        hasTouch: width < 500,
      }),
      page = await context.newPage(),
      cdp = await context.newCDPSession(page);
    await cdp.send("Performance.enable");
    await cdp.send("Emulation.setCPUThrottlingRate", { rate });
    await page.goto("/demo/asterion");
    await page.waitForTimeout(4000);
    await cdp.send("HeapProfiler.collectGarbage");
    const initial = await cdp.send("Performance.getMetrics");
    const samples = [];
    for (const key of ["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft"]) {
      await page.keyboard.down(key);
      await page.waitForTimeout(3500);
      await page.keyboard.up(key);
      samples.push({
        fps: Number(await page.locator("canvas").getAttribute("data-fps")),
        chunks: Number(
          await page.locator("canvas").getAttribute("data-chunks"),
        ),
      });
    }
    await cdp.send("HeapProfiler.collectGarbage");
    const final = await cdp.send("Performance.getMetrics");
    const heap = (m: { metrics: { name: string; value: number }[] }) =>
      m.metrics.find((v) => v.name === "JSHeapUsedSize")?.value;
    results.push({
      name,
      width,
      cpuThrottle: rate,
      samples,
      initialHeapBytes: heap(initial),
      finalHeapBytes: heap(final),
    });
    expect(samples.every((s) => s.chunks <= 24)).toBeTruthy();
    await context.close();
  }
  writeFileSync(
    "test-results/v2-render-profile.json",
    JSON.stringify(
      {
        environment:
          "Playwright Chromium headless on development Mac, emulated mobile viewport and CPU throttle; not a physical-device benchmark",
        results,
      },
      null,
      2,
    ),
  );
});
