import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  use: {
    baseURL: "http://127.0.0.1:4317",
    browserName: "chromium",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --port 4317 --strictPort",
    url: "http://127.0.0.1:4317",
    reuseExistingServer: !process.env.CI,
  },
});
