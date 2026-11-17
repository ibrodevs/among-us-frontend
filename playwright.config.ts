import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  timeout: 180000,
  workers: 1,
  fullyParallel: false,
  use: {
    baseURL: "http://localhost:3000",
    actionTimeout: 15000,
    trace: {
      mode: "retain-on-failure",
      screenshots: false,
      snapshots: false,
      sources: true,
    },
    screenshot: "only-on-failure",
  },
  reporter: [["list"], ["json", { outputFile: "test-results/results.json" }]],
});
